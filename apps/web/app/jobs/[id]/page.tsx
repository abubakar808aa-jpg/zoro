'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { getJob, applyToJob, getProfile, setJobStatus, deleteJob } from '@/lib/firestore';
import { generateCoverLetter } from '@/lib/ai';
import { useAuth } from '@/components/AuthProvider';
import type { JobListing } from '@jobman/shared/src/types';

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, accountType } = useAuth();
  const router = useRouter();
  const [job, setJob] = useState<JobListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [coverLetter, setCoverLetter] = useState('');
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState('');
  const [aiWriting, setAiWriting] = useState(false);

  async function handleAICoverLetter() {
    if (!user || !job) return;
    setAiWriting(true); setError('');
    try {
      const profile = await getProfile(user.uid);
      const background = profile
        ? `${profile.bio ?? ''} Skills: ${profile.skills?.join(', ') ?? ''}`
        : undefined;
      const { coverLetter: letter } = await generateCoverLetter({
        jobTitle: job.title,
        jobDescription: job.description,
        requirements: job.requirements,
        applicantName: user.displayName ?? 'Applicant',
        applicantBackground: background,
      });
      setCoverLetter(letter);
    } catch (err: any) {
      setError(err.message);
    } finally { setAiWriting(false); }
  }

  useEffect(() => {
    getJob(id).then(setJob).finally(() => setLoading(false));
  }, [id]);

  async function handleApply(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !job) { router.push('/sign-in'); return; }
    setApplying(true); setError('');
    try {
      await applyToJob(
        { id, title: job.title, postedBy: job.postedBy },
        user.uid, user.displayName ?? user.email ?? 'Anonymous', coverLetter
      );
      setApplied(true);
    } catch (err: any) {
      setError(err.message);
    } finally { setApplying(false); }
  }

  async function handleToggleStatus() {
    if (!job) return;
    const next = job.status === 'open' ? 'closed' : 'open';
    await setJobStatus(id, next);
    setJob({ ...job, status: next });
  }

  async function handleDelete() {
    if (!job) return;
    if (!window.confirm('Delete this job posting? This cannot be undone.')) return;
    await deleteJob(id);
    router.push('/dashboard');
  }

  if (loading) return <div className="max-w-3xl mx-auto px-4 py-10"><div className="card animate-pulse h-64" /></div>;
  if (!job) return <div className="text-center py-20 text-slate-400">Job not found.</div>;

  const posted = job.createdAt ? formatDistanceToNow(new Date((job.createdAt as any).seconds * 1000), { addSuffix: true }) : '';

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <Link href="/jobs" className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1 mb-6">← Back to Jobs</Link>

      <div className="card mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{job.title}</h1>
            <p className="text-slate-500 mt-1">{job.postedByName} · {job.location}{job.remote ? ' · Remote OK' : ''}</p>
            <p className="text-xs text-slate-400 mt-0.5">Posted {posted}</p>
          </div>
          {job.salary && (
            <div className="text-right flex-shrink-0">
              <div className="font-bold text-lg text-slate-900">
                ${job.salary.min.toLocaleString()}–${job.salary.max.toLocaleString()}
              </div>
              <div className="text-xs text-slate-500">per {job.salary.period === 'hourly' ? 'hour' : 'year'}</div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          <span className="badge bg-blue-100 text-blue-700">{job.type}</span>
          <span className="badge bg-slate-100 text-slate-600">{job.category}</span>
          <span className="badge bg-slate-100 text-slate-500">{job.applicantCount} applicants</span>
          {job.status === 'closed' && <span className="badge bg-red-100 text-red-600">Closed</span>}
        </div>

        {/* Owner controls */}
        {user && user.uid === job.postedBy && (
          <div className="flex flex-wrap items-center gap-3 mt-5 pt-4 border-t border-slate-100">
            <Link href={`/dashboard/jobs/${id}/applicants`} className="btn-primary text-sm">
              👥 View Applicants ({job.applicantCount})
            </Link>
            <button type="button" onClick={handleToggleStatus} className="btn-secondary text-sm">
              {job.status === 'open' ? '🔒 Close Job' : '🔓 Reopen Job'}
            </button>
            <button type="button" onClick={handleDelete}
              className="text-sm font-semibold text-red-500 hover:text-red-600 px-3 py-2">
              🗑️ Delete
            </button>
          </div>
        )}

        <hr className="my-5 border-slate-100" />

        <h2 className="font-semibold text-slate-900 mb-2">Job Description</h2>
        <p className="text-slate-600 whitespace-pre-wrap text-sm leading-relaxed">{job.description}</p>

        {job.requirements?.length > 0 && (
          <>
            <h2 className="font-semibold text-slate-900 mt-5 mb-2">Requirements</h2>
            <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
              {job.requirements.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </>
        )}

        {job.skills?.length > 0 && (
          <>
            <h2 className="font-semibold text-slate-900 mt-5 mb-2">Skills</h2>
            <div className="flex flex-wrap gap-2">
              {job.skills.map(s => <span key={s} className="badge bg-primary-50 text-primary-700">{s}</span>)}
            </div>
          </>
        )}
      </div>

      {/* Apply Section */}
      {accountType !== 'employer' && job.status !== 'open' ? (
        <div className="card text-center py-8">
          <div className="text-4xl mb-2">🔒</div>
          <p className="font-semibold text-slate-900">This job is closed</p>
          <p className="text-sm text-slate-500 mt-1">The employer is no longer accepting applications.</p>
        </div>
      ) : accountType !== 'employer' && (
        <div className="card">
          <h2 className="font-bold text-slate-900 text-lg mb-4">Apply for this Job</h2>
          {!user ? (
            <div className="text-center py-4">
              <p className="text-slate-500 mb-4">Sign in to apply</p>
              <Link href="/sign-in" className="btn-primary">Sign In to Apply</Link>
            </div>
          ) : applied ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-2">✅</div>
              <p className="font-semibold text-slate-900">Application Sent!</p>
              <p className="text-sm text-slate-500 mt-1">The employer will reach out via messages.</p>
            </div>
          ) : (
            <form onSubmit={handleApply} className="space-y-4">
              {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</p>}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-slate-700">Cover Letter / Message</label>
                  <button type="button" onClick={handleAICoverLetter} disabled={aiWriting}
                    className="text-xs font-semibold text-violet-600 hover:text-violet-700 disabled:opacity-50">
                    {aiWriting ? '✨ Writing…' : '✨ Write with AI'}
                  </button>
                </div>
                <textarea value={coverLetter} onChange={e => setCoverLetter(e.target.value)} required rows={7}
                  className="input resize-none" placeholder="Introduce yourself and explain why you're a great fit…" />
              </div>
              <button type="submit" disabled={applying} className="btn-primary w-full">
                {applying ? 'Submitting…' : 'Submit Application'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
