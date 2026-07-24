'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getAllJobs } from '@/lib/firestore';
import { adminAction } from '@/lib/admin';
import type { JobListing } from '@jobman/shared/src/types';

export default function AdminJobsPage() {
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [lastDoc, setLastDoc] = useState<Awaited<ReturnType<typeof getAllJobs>>['lastDoc']>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getAllJobs()
      .then(({ jobs, lastDoc }) => { setJobs(jobs); setLastDoc(lastDoc); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function loadMore() {
    if (!lastDoc) return;
    setLoadingMore(true);
    try {
      const { jobs: more, lastDoc: next } = await getAllJobs(lastDoc);
      setJobs(prev => [...prev, ...more]);
      setLastDoc(next);
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleClose(job: JobListing) {
    setError('');
    try {
      await adminAction({ action: 'closeJob', jobId: job.id });
      setJobs(list => list.map(j => j.id === job.id ? { ...j, status: 'closed' } : j));
    } catch (err: any) { setError(err.message); }
  }

  async function handleDelete(job: JobListing) {
    if (!window.confirm(`Delete "${job.title}" permanently?`)) return;
    setError('');
    try {
      await adminAction({ action: 'deleteJob', jobId: job.id });
      setJobs(list => list.filter(j => j.id !== job.id));
    } catch (err: any) { setError(err.message); }
  }

  if (loading) return <div className="card animate-pulse h-64" />;

  return (
    <div>
      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}
      <div className="space-y-2">
        {jobs.map(job => (
          <div key={job.id} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-white border-2 border-ink/10">
            <div className="min-w-0">
              <Link href={`/jobs/${job.id}`} className="font-semibold text-slate-900 text-sm hover:text-primary-600">
                {job.title}
              </Link>
              <p className="text-xs text-slate-400">by {job.postedByName} · {job.location} · {job.type}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`badge text-xs ${job.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                {job.status}
              </span>
              {job.status === 'open' && (
                <button type="button" onClick={() => handleClose(job)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-full transition-colors">
                  Close
                </button>
              )}
              <button type="button" onClick={() => handleDelete(job)}
                className="text-xs font-bold text-red-500 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-full transition-colors">
                Delete
              </button>
            </div>
          </div>
        ))}
        {jobs.length === 0 && <p className="text-center text-slate-400 py-10">No jobs yet.</p>}
      </div>

      {lastDoc && (
        <div className="text-center mt-6">
          <button type="button" onClick={loadMore} disabled={loadingMore} className="btn-secondary text-sm">
            {loadingMore ? 'Loading…' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  );
}
