'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { getJob, applyToJob, getProfile, setJobStatus, deleteJob } from '@/lib/firestore';
import { generateCoverLetter, vibeCheckJob, analyzeSkillGaps, checkSalaryFairness, type VibeCheck, type SkillGaps, type SalaryIntel } from '@/lib/ai';
import { useAuth } from '@/components/AuthProvider';
import { GEN_Z_TAGS, type JobListing } from '@jobman/shared/src/types';

function salaryString(job: JobListing): string {
  if (!job.salary) return '';
  return `$${job.salary.min.toLocaleString()}–$${job.salary.max.toLocaleString()} per ${job.salary.period === 'hourly' ? 'hour' : 'year'}`;
}

const FAIRNESS_STYLES: Record<SalaryIntel['fairness'], { label: string; cls: string }> = {
  below: { label: '📉 Below market', cls: 'bg-red-100 text-red-600' },
  fair: { label: '⚖️ Fair pay', cls: 'bg-green-100 text-green-700' },
  above: { label: '🚀 Above market', cls: 'bg-acid-300 text-ink' },
};

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
  const [vibe, setVibe] = useState<VibeCheck | null>(null);
  const [vibeLoading, setVibeLoading] = useState(false);
  const [gaps, setGaps] = useState<SkillGaps | null>(null);
  const [gapsLoading, setGapsLoading] = useState(false);
  const [salaryIntel, setSalaryIntel] = useState<SalaryIntel | null>(null);
  const [salaryLoading, setSalaryLoading] = useState(false);

  async function handleVibeCheck() {
    if (!job) return;
    setVibeLoading(true); setError('');
    try {
      let candidateSummary: string | undefined;
      if (user) {
        const profile = await getProfile(user.uid);
        if (profile) candidateSummary = `${profile.bio ?? ''} Skills: ${profile.skills?.join(', ') ?? ''}`;
      }
      setVibe(await vibeCheckJob({
        jobTitle: job.title,
        jobDescription: job.description,
        requirements: job.requirements,
        salary: salaryString(job),
        candidateSummary,
      }));
    } catch (err: any) {
      setError(err.message);
    } finally { setVibeLoading(false); }
  }

  async function handleSkillGaps() {
    if (!job || !user) return;
    setGapsLoading(true); setError('');
    try {
      const profile = await getProfile(user.uid);
      setGaps(await analyzeSkillGaps({
        jobTitle: job.title,
        requirements: job.requirements,
        jobSkills: job.skills,
        candidateSkills: profile?.skills ?? [],
      }));
    } catch (err: any) {
      setError(err.message);
    } finally { setGapsLoading(false); }
  }

  async function handleSalaryIntel() {
    if (!job?.salary) return;
    setSalaryLoading(true); setError('');
    try {
      setSalaryIntel(await checkSalaryFairness({
        jobTitle: job.title,
        location: job.location,
        remote: job.remote,
        salary: salaryString(job),
        type: job.type,
      }));
    } catch (err: any) {
      setError(err.message);
    } finally { setSalaryLoading(false); }
  }

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
          {job.genZTags?.map(tag => {
            const t = GEN_Z_TAGS.find(g => g.id === tag);
            return t ? <span key={tag} className="badge bg-primary-100 text-primary-700">{t.emoji} {t.label}</span> : null;
          })}
          {job.status === 'closed' && <span className="badge bg-red-100 text-red-600">Closed</span>}
        </div>

        {/* Salary intel */}
        {job.salary && (
          <div className="mt-3">
            {salaryIntel ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className={`badge ${FAIRNESS_STYLES[salaryIntel.fairness].cls}`}>{FAIRNESS_STYLES[salaryIntel.fairness].label}</span>
                <span className="text-slate-500 text-xs">Market: {salaryIntel.marketRange} · {salaryIntel.note}</span>
              </div>
            ) : (
              <button type="button" onClick={handleSalaryIntel} disabled={salaryLoading}
                className="text-xs font-semibold text-violet-600 hover:text-violet-700 disabled:opacity-50">
                {salaryLoading ? '✨ Checking…' : '💸 Is this pay fair?'}
              </button>
            )}
          </div>
        )}

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

      {/* Vibe Check — native open jobs only (imported roles apply out) */}
      {!job.isImported && accountType !== 'employer' && job.status === 'open' && (
        <div className="card mb-6">
          {vibe ? (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="sticker bg-acid-300">✨ Vibe Check: {vibe.score}/10</span>
                <p className="font-display font-bold text-ink">{vibe.verdict}</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-semibold text-green-700 mb-1">The good stuff</p>
                  <ul className="space-y-1 text-slate-600">
                    {vibe.pros.map((p, i) => <li key={i}>✅ {p}</li>)}
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-amber-600 mb-1">Keep in mind</p>
                  <ul className="space-y-1 text-slate-600">
                    {vibe.cons.map((c, i) => <li key={i}>⚠️ {c}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-display font-bold text-ink">Is this job your vibe?</p>
                <p className="text-sm text-slate-500">AI scores the fit against your profile — honest pros and cons.</p>
              </div>
              <button type="button" onClick={handleVibeCheck} disabled={vibeLoading} className="btn-secondary text-sm">
                {vibeLoading ? '✨ Checking…' : '✨ Run Vibe Check'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Apply Section */}
      {job.isImported && job.applyUrl ? (
        /* Imported roles keep applications with the original employer. */
        <div className="card text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-primary-600">Original employer listing</p>
          <h2 className="mt-2 font-display text-xl font-bold text-ink">Apply directly with {job.postedByName}</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-slate-500">JobMan found and organized this role. Your application stays with the employer — no weird detours.</p>
          <a href={job.applyUrl} target="_blank" rel="noreferrer" className="btn-primary mt-5 inline-flex">Apply on the employer site ↗</a>
        </div>
      ) : accountType !== 'employer' && job.status !== 'open' ? (
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
            <div className="py-4">
              <div className="text-center">
                <div className="text-4xl mb-2">✅</div>
                <p className="font-semibold text-slate-900">Application Sent!</p>
                <p className="text-sm text-slate-500 mt-1">The employer will reach out via messages.</p>
              </div>
              {gaps ? (
                <div className="mt-6 text-left text-sm border-t border-slate-100 pt-5">
                  <p className="font-display font-bold text-ink mb-2">🔍 Your skill gap report</p>
                  {gaps.matched.length > 0 && (
                    <p className="text-slate-600 mb-2">💪 Already got: {gaps.matched.join(', ')}</p>
                  )}
                  {gaps.gaps.length === 0 ? (
                    <p className="text-green-700">No gaps — you check every box. 🎯</p>
                  ) : (
                    <ul className="space-y-2">
                      {gaps.resources.map((r, i) => (
                        <li key={i} className="bg-slate-50 rounded-xl px-4 py-2.5">
                          <span className="font-semibold text-slate-900">{r.skill}:</span>{' '}
                          <span className="text-slate-600">{r.how}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-xs text-slate-400 mt-3">{gaps.note}</p>
                </div>
              ) : (
                <div className="text-center mt-5">
                  <button type="button" onClick={handleSkillGaps} disabled={gapsLoading} className="btn-secondary text-sm">
                    {gapsLoading ? '✨ Analyzing…' : '🔍 Check my skill gaps for this job'}
                  </button>
                </div>
              )}
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
