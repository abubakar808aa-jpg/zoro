'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { GigProfile, ProfessionalProfile } from '@jobman/shared/src/types';

type Props = { profile: GigProfile | ProfessionalProfile };

export default function ProfileCard({ profile }: Props) {
  const stars = Array.from({ length: 5 }, (_, i) => i < Math.round(profile.rating));
  const isGig = profile.type === 'gig';

  return (
    <Link href={`/profile/${profile.uid}`} className="block bg-white rounded-3xl border-2 border-ink shadow-pop-sm hover:shadow-pop hover:-translate-y-1 transition-all overflow-hidden group">
      {/* Accent bar */}
      <div className={`h-2 w-full border-b-2 border-ink ${isGig ? 'bg-gradient-to-r from-accent-400 to-orange-400' : 'bg-gradient-to-r from-primary-500 to-accent-400'}`} />

      <div className="p-5">
        <div className="flex items-start gap-4">
          {profile.photoURL ? (
            <Image src={profile.photoURL} alt={profile.name} width={56} height={56} className="rounded-2xl object-cover flex-shrink-0 ring-2 ring-ink" />
          ) : (
            <div className={`w-14 h-14 rounded-2xl border-2 border-ink flex items-center justify-center text-white font-bold text-xl flex-shrink-0 ${isGig ? 'bg-gradient-to-br from-accent-400 to-orange-500' : 'bg-gradient-to-br from-primary-500 to-accent-500'}`}>
              {profile.name[0]?.toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-bold text-ink truncate group-hover:text-primary-600 transition-colors">{profile.name}</h3>
            <p className={`text-sm font-semibold mt-0.5 ${isGig ? 'text-accent-600' : 'text-primary-600'}`}>
              {isGig ? (profile as GigProfile).category : (profile as ProfessionalProfile).title}
            </p>
            <p className="text-xs text-slate-400 mt-0.5 truncate">📍 {profile.location}</p>

            <div className="flex items-center gap-1 mt-2">
              {stars.map((filled, i) => (
                <svg key={i} className={`w-3.5 h-3.5 ${filled ? 'text-amber-400' : 'text-slate-200'}`} fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
              <span className="text-xs text-slate-400 ml-1">{profile.reviewCount} reviews</span>
            </div>
          </div>

          <div className="text-right flex-shrink-0">
            {isGig ? (
              <span className="font-bold text-slate-900 text-lg">${(profile as GigProfile).hourlyRate}<span className="text-xs font-normal text-slate-400">/hr</span></span>
            ) : (
              <span className="text-sm font-semibold text-slate-600">{(profile as ProfessionalProfile).experienceYears}y exp</span>
            )}
            <div className="mt-1.5">
              <span className={`badge text-xs font-bold ${isGig ? 'bg-pink-100 text-accent-600' : 'bg-primary-100 text-primary-700'}`}>
                {isGig ? '🔨 Gig' : '💼 Pro'}
              </span>
            </div>
          </div>
        </div>

        <p className="text-sm text-slate-500 mt-3 line-clamp-2 leading-relaxed">{profile.bio}</p>

        {profile.skills?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {profile.skills.slice(0, 4).map(s => (
              <span key={s} className="badge bg-slate-100 text-slate-600 text-xs">{s}</span>
            ))}
            {profile.skills.length > 4 && <span className="badge bg-slate-100 text-slate-400 text-xs">+{profile.skills.length - 4}</span>}
          </div>
        )}
      </div>
    </Link>
  );
}
