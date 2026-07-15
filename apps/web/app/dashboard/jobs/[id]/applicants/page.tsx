'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/components/AuthProvider';
import {
  getJob, getApplicationsForJob, updateApplicationStatus, getOrCreateConversation,
} from '@/lib/firestore';
import type { JobListing, Application, ApplicationStatus } from '@jobman/shared/src/types';

const STATUS_STYLES: Record<ApplicationStatus, string> = {
  pending: 'bg-amber-100 text-amber-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-slate-100 text-slate-500',
};

export default function ApplicantsPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [job, setJob] = useState<JobListing | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/sign-in'); return; }

    getJob(id).then(async j => {
      setJob(j);
      if (j && j.postedBy === user.uid) {
        setApplications(await getApplicationsForJob(id));
      }
    }).catch(err => setError(err.message)).finally(() => setLoading(false));
  }, [id, user, authLoading]);

  async function handleStatus(app: Application, status: ApplicationStatus) {
    const prev = applications;
    setApplications(apps => apps.map(a => a.id === app.id ? { ...a, status } : a));
    try {
      await updateApplicationStatus(app.id, status);
    } catch (err: any) {
      setApplications(prev);
      setError(err.message);
    }
  }

  async function handleMessage(app: Application) {
    if (!user) return;
    const convId = await getOrCreateConversation(
      user.uid, app.applicantId,
      { [user.uid]: user.displayName ?? 'Employer', [app.applicantId]: app.applicantName },
      { [user.uid]: user.photoURL ?? '', [app.applicantId]: '' },
    );
    router.push(`/messages/${convId}`);
  }

  if (authLoading || loading) {
    return <div className="max-w-3xl mx-auto px-4 py-10"><div className="card animate-pulse h-64" /></div>;
  }
  if (!job) return <div className="text-center py-20 text-slate-400">Job not found.</div>;
  if (user && job.postedBy !== user.uid) {
    return <div className="text-center py-20 text-slate-400">Only the job poster can view applicants.</div>;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1 mb-6">← Back to Dashboard</Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Applicants</h1>
        <p className="text-slate-500 mt-1">
          {applications.length} application{applications.length !== 1 ? 's' : ''} for{' '}
          <Link href={`/jobs/${job.id}`} className="text-primary-600 font-semibold hover:underline">{job.title}</Link>
        </p>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-4">{error}</p>}

      {applications.length === 0 ? (
        <div className="card text-center py-14 text-slate-400">
          <div className="text-5xl mb-4">📭</div>
          <p className="text-lg font-medium">No applications yet.</p>
          <p className="text-sm mt-1">Share your job posting to attract applicants.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {applications.map(app => {
            const applied = app.appliedAt
              ? formatDistanceToNow(new Date((app.appliedAt as any).seconds * 1000), { addSuffix: true })
              : '';
            const isExpanded = expanded === app.id;
            return (
              <div key={app.id} className="card">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/profile/${app.applicantId}`} className="font-bold text-slate-900 hover:text-primary-600">
                        {app.applicantName}
                      </Link>
                      <span className={`badge text-xs ${STATUS_STYLES[app.status]}`}>{app.status}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">Applied {applied}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {app.status !== 'accepted' && (
                      <button type="button" onClick={() => handleStatus(app, 'accepted')}
                        className="text-xs font-semibold text-green-600 hover:text-green-700 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-full transition-colors">
                        ✓ Accept
                      </button>
                    )}
                    {app.status !== 'rejected' && (
                      <button type="button" onClick={() => handleStatus(app, 'rejected')}
                        className="text-xs font-semibold text-slate-500 hover:text-red-600 bg-slate-50 hover:bg-red-50 px-3 py-1.5 rounded-full transition-colors">
                        ✕ Reject
                      </button>
                    )}
                    <button type="button" onClick={() => handleMessage(app)}
                      className="text-xs font-semibold text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 px-3 py-1.5 rounded-full transition-colors">
                      💬 Message
                    </button>
                  </div>
                </div>

                <div className="mt-3">
                  <p className={`text-sm text-slate-600 whitespace-pre-wrap leading-relaxed ${isExpanded ? '' : 'line-clamp-3'}`}>
                    {app.coverLetter}
                  </p>
                  {app.coverLetter.length > 200 && (
                    <button type="button" onClick={() => setExpanded(isExpanded ? null : app.id)}
                      className="text-xs font-semibold text-primary-600 hover:underline mt-1">
                      {isExpanded ? 'Show less' : 'Read full letter'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
