'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { getProfile, getOrCreateConversation, followUser, unfollowUser, isFollowing, getFollowerCount } from '@/lib/firestore';
import { useAuth } from '@/components/AuthProvider';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { GigProfile, ProfessionalProfile } from '@jobman/shared/src/types';

export default function ProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<GigProfile | ProfessionalProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [messaging, setMessaging] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followBusy, setFollowBusy] = useState(false);

  useEffect(() => {
    getProfile(id).then(setProfile).finally(() => setLoading(false));
    getFollowerCount(id).then(setFollowerCount).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (user && user.uid !== id) {
      isFollowing(user.uid, id).then(setFollowing).catch(() => {});
    }
  }, [user, id]);

  async function handleFollowToggle() {
    if (!user) { router.push('/sign-in'); return; }
    if (!profile || followBusy) return;
    setFollowBusy(true);
    const next = !following;
    setFollowing(next);
    setFollowerCount(c => c + (next ? 1 : -1));
    try {
      if (next) {
        await followUser(user.uid, { uid: id, name: profile.name, photoURL: profile.photoURL });
      } else {
        await unfollowUser(user.uid, id);
      }
    } catch {
      setFollowing(!next);
      setFollowerCount(c => c + (next ? -1 : 1));
    } finally {
      setFollowBusy(false);
    }
  }

  async function handleMessage() {
    if (!user) { router.push('/sign-in'); return; }
    setMessaging(true);
    try {
      const targetSnap = await getDoc(doc(db, 'users', id));
      const targetData = targetSnap.data();
      const convId = await getOrCreateConversation(
        user.uid, id,
        { [user.uid]: user.displayName ?? 'Me', [id]: targetData?.name ?? 'User' },
        { [user.uid]: user.photoURL ?? '', [id]: targetData?.photoURL ?? '' }
      );
      router.push(`/messages/${convId}`);
    } finally { setMessaging(false); }
  }

  if (loading) return <div className="max-w-3xl mx-auto px-4 py-10"><div className="card animate-pulse h-64" /></div>;
  if (!profile) return <div className="text-center py-20 text-slate-400">Profile not found.</div>;

  const isGig = profile.type === 'gig';
  const gig = profile as GigProfile;
  const pro = profile as ProfessionalProfile;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      {/* Header */}
      <div className="card">
        <div className="flex items-start gap-5">
          {profile.photoURL ? (
            <Image src={profile.photoURL} alt={profile.name} width={80} height={80} className="rounded-2xl object-cover flex-shrink-0" />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-3xl flex-shrink-0">
              {profile.name[0]?.toUpperCase()}
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{profile.name}</h1>
                <p className="text-primary-600 font-medium mt-0.5">
                  {isGig ? gig.category : pro.title}
                </p>
                <p className="text-slate-500 text-sm">{profile.location}</p>
                <p className="text-xs text-slate-400 mt-1">👥 {followerCount} follower{followerCount !== 1 ? 's' : ''}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                {isGig ? (
                  <span className="text-xl font-bold text-slate-900">${gig.hourlyRate}<span className="text-sm font-normal text-slate-500">/hr</span></span>
                ) : (
                  pro.desiredSalary && <span className="text-sm text-slate-600">${pro.desiredSalary.toLocaleString()}/yr</span>
                )}
                <span className={`badge ${isGig ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                  {isGig ? 'Gig Worker' : 'Professional'}
                </span>
              </div>
            </div>
            {user && user.uid !== id && (
              <div className="flex gap-2 mt-4">
                <button onClick={handleMessage} disabled={messaging} className="btn-primary text-sm">
                  {messaging ? 'Opening chat…' : '💬 Send Message'}
                </button>
                <button onClick={handleFollowToggle} disabled={followBusy} className="btn-secondary text-sm">
                  {following ? '✓ Following' : '➕ Follow'}
                </button>
              </div>
            )}
          </div>
        </div>

        <hr className="my-5 border-slate-100" />

        <h2 className="font-semibold text-slate-900 mb-2">About</h2>
        <p className="text-slate-600 text-sm leading-relaxed">{profile.bio}</p>

        {profile.skills?.length > 0 && (
          <>
            <h2 className="font-semibold text-slate-900 mt-5 mb-2">Skills</h2>
            <div className="flex flex-wrap gap-2">
              {profile.skills.map(s => <span key={s} className="badge bg-primary-50 text-primary-700">{s}</span>)}
            </div>
          </>
        )}
      </div>

      {/* Gig-specific */}
      {isGig && (
        <div className="card">
          <h2 className="font-semibold text-slate-900 mb-3">Availability</h2>
          <span className={`badge ${gig.availability === 'available' ? 'bg-green-100 text-green-700' : gig.availability === 'weekends' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
            {gig.availability === 'available' ? '✅ Available Now' : gig.availability === 'weekends' ? '📅 Weekends Only' : '⏳ Currently Busy'}
          </span>
        </div>
      )}

      {/* Professional-specific */}
      {!isGig && pro.experience?.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-slate-900 mb-4">Experience</h2>
          <div className="space-y-4">
            {pro.experience.map((exp, i) => (
              <div key={i} className="flex gap-3">
                <div className="w-2 h-2 rounded-full bg-primary-400 mt-2 flex-shrink-0" />
                <div>
                  <p className="font-medium text-slate-900">{exp.title}</p>
                  <p className="text-sm text-primary-600">{exp.company}</p>
                  <p className="text-xs text-slate-400">{exp.from} – {exp.current ? 'Present' : exp.to}</p>
                  {exp.description && <p className="text-sm text-slate-600 mt-1">{exp.description}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isGig && pro.education?.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-slate-900 mb-4">Education</h2>
          <div className="space-y-3">
            {pro.education.map((edu, i) => (
              <div key={i}>
                <p className="font-medium text-slate-900">{edu.degree} in {edu.field}</p>
                <p className="text-sm text-primary-600">{edu.school}</p>
                <p className="text-xs text-slate-400">{edu.from} – {edu.to}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
