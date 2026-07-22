'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { getProfile, getMyApplications, setJobStatus, deleteJob } from '@/lib/firestore';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import type { JobListing, GigProfile, ProfessionalProfile, Application, ApplicationStatus } from '@jobman/shared/src/types';

const APP_STATUS_STYLES: Record<ApplicationStatus, string> = {
  pending: 'bg-amber-100 text-amber-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-slate-100 text-slate-500',
};

export default function DashboardPage() {
  const { user, accountType, loading: authLoading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<GigProfile | ProfessionalProfile | null>(null);
  const [myJobs, setMyJobs] = useState<JobListing[]>([]);
  const [myApplications, setMyApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/sign-in'); return; }

    Promise.all([
      getProfile(user.uid).then(setProfile),
      getDocs(query(collection(db, 'jobs'), where('postedBy', '==', user.uid), orderBy('createdAt', 'desc')))
        .then(snap => setMyJobs(snap.docs.map(d => ({ id: d.id, ...d.data() } as JobListing)))),
      getMyApplications(user.uid).then(setMyApplications).catch(() => setMyApplications([])),
    ]).finally(() => setLoading(false));
  }, [user, authLoading]);

  async function handleToggleJobStatus(job: JobListing) {
    const next = job.status === 'open' ? 'closed' : 'open';
    await setJobStatus(job.id, next);
    setMyJobs(jobs => jobs.map(j => j.id === job.id ? { ...j, status: next } : j));
  }

  async function handleDeleteJob(job: JobListing) {
    if (!window.confirm(`Delete "${job.title}"? This cannot be undone.`)) return;
    await deleteJob(job.id);
    setMyJobs(jobs => jobs.filter(j => j.id !== job.id));
  }

  const [boostError, setBoostError] = useState('');

  function isBoostActive(job: JobListing) {
    const until = job.boostedUntil as unknown as Timestamp | undefined;
    return job.boosted && until && until.toMillis() > Date.now();
  }

  async function handleBoostJob(job: JobListing) {
    setBoostError('');
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ jobId: job.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not start checkout');
      window.location.href = data.url;
    } catch (err: any) {
      setBoostError(err.message);
    }
  }

  if (authLoading || loading) return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-4">
      {[1,2,3].map(i => <div key={i} className="card animate-pulse h-24" />)}
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Dashboard</h1>
      <p className="text-slate-500 mb-8">Welcome back, {user?.displayName ?? user?.email}!</p>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Profile status */}
        <div className="card">
          <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">👤 My Profile</h2>
          {profile ? (
            <div>
              <p className="text-sm text-slate-600 mb-3">
                Your <span className="font-medium">{profile.type === 'gig' ? 'Gig Worker' : 'Professional'}</span> profile is live.
              </p>
              <div className="flex gap-2">
                <Link href={`/profile/${user?.uid}`} className="btn-secondary text-sm">View Profile</Link>
                <Link href={profile.type === 'gig' ? '/dashboard/create-gig-profile' : '/dashboard/create-pro-profile'} className="btn-primary text-sm">Edit Profile</Link>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm text-slate-500 mb-3">You haven't created a profile yet. Get discovered by employers!</p>
              <div className="flex gap-2">
                <Link href="/dashboard/create-gig-profile" className="btn-secondary text-sm">🔨 Gig Profile</Link>
                <Link href="/dashboard/create-pro-profile" className="btn-primary text-sm">💼 Pro Profile</Link>
              </div>
            </div>
          )}
        </div>

        {/* Quick links */}
        <div className="card">
          <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">🔗 Quick Actions</h2>
          <div className="space-y-2">
            <Link href="/jobs" className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-primary-50 transition-colors text-sm font-medium text-slate-700">
              📋 Browse Job Listings
            </Link>
            <Link href="/gigs" className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-primary-50 transition-colors text-sm font-medium text-slate-700">
              🔨 Browse Gig Workers
            </Link>
            <Link href="/professionals" className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-primary-50 transition-colors text-sm font-medium text-slate-700">
              💼 Browse Professionals
            </Link>
            {accountType === 'employer' && (
              <Link href="/jobs/post" className="flex items-center gap-3 p-3 rounded-xl bg-primary-50 hover:bg-primary-100 transition-colors text-sm font-medium text-primary-700">
                ➕ Post a Job
              </Link>
            )}
            <Link href="/messages" className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-primary-50 transition-colors text-sm font-medium text-slate-700">
              💬 Messages
            </Link>
          </div>
        </div>

        {/* My job postings */}
        {myJobs.length > 0 && (
          <div className="card md:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-900">My Job Postings</h2>
              <Link href="/jobs/post" className="btn-primary text-sm">+ Post New</Link>
            </div>
            {boostError && <p className="text-sm text-red-500 mb-3">{boostError}</p>}
            <div className="space-y-3">
              {myJobs.map(job => (
                <div key={job.id} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-50">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 text-sm">{job.title}</p>
                    <p className="text-xs text-slate-500">
                      <Link href={`/dashboard/jobs/${job.id}/applicants`} className="text-primary-600 font-semibold hover:underline">
                        👥 {job.applicantCount} applicant{job.applicantCount !== 1 ? 's' : ''}
                      </Link>
                      {' '}· {job.location} · {job.type}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isBoostActive(job) ? (
                      <span className="badge text-xs bg-acid-300 text-ink border border-ink">⚡ Featured</span>
                    ) : job.status === 'open' && (
                      <button type="button" onClick={() => handleBoostJob(job)}
                        className="text-xs font-bold text-accent-600 hover:text-accent-500">
                        ⚡ Boost $5
                      </button>
                    )}
                    <span className={`badge text-xs ${job.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {job.status}
                    </span>
                    <button type="button" onClick={() => handleToggleJobStatus(job)}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-700">
                      {job.status === 'open' ? 'Close' : 'Reopen'}
                    </button>
                    <button type="button" onClick={() => handleDeleteJob(job)}
                      className="text-xs font-semibold text-red-400 hover:text-red-600">
                      Delete
                    </button>
                    <Link href={`/jobs/${job.id}`} className="text-xs text-primary-600 hover:underline">View →</Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* My applications (workers) */}
        {myApplications.length > 0 && (
          <div className="card md:col-span-2">
            <h2 className="font-semibold text-slate-900 mb-4">📨 My Applications</h2>
            <div className="space-y-3">
              {myApplications.map(app => (
                <div key={app.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50">
                  <Link href={`/jobs/${app.jobId}`} className="font-medium text-slate-900 text-sm hover:text-primary-600 truncate">
                    {app.jobTitle || 'Job posting'}
                  </Link>
                  <span className={`badge text-xs flex-shrink-0 ${APP_STATUS_STYLES[app.status]}`}>{app.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
