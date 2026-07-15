'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import JobCard from '@/components/JobCard';
import { getJobs, getProfile } from '@/lib/firestore';
import { useAuth } from '@/components/AuthProvider';
import { parseJobSearch, type ParsedSearch } from '@/lib/ai';
import { scoreJobMatch } from '@jobman/shared/src/utils/matching';
import type { JobListing, GigProfile, ProfessionalProfile } from '@jobman/shared/src/types';

const TYPES = [
  { id: '', label: 'All' },
  { id: 'fulltime', label: 'Full-Time' },
  { id: 'parttime', label: 'Part-Time' },
  { id: 'contract', label: 'Contract' },
  { id: 'gig', label: 'Gig' },
];

export default function JobsPage() {
  const { user, accountType } = useAuth();
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [lastDoc, setLastDoc] = useState<Awaited<ReturnType<typeof getJobs>>['lastDoc']>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [aiFilters, setAiFilters] = useState<ParsedSearch | null>(null);
  const [aiSearching, setAiSearching] = useState(false);
  const [aiError, setAiError] = useState('');
  const [profile, setProfile] = useState<GigProfile | ProfessionalProfile | null>(null);

  useEffect(() => {
    setLoading(true);
    getJobs(typeFilter ? { type: typeFilter } : undefined)
      .then(({ jobs, lastDoc }) => { setJobs(jobs); setLastDoc(lastDoc); })
      .finally(() => setLoading(false));
  }, [typeFilter]);

  useEffect(() => {
    if (user) getProfile(user.uid).then(setProfile).catch(() => setProfile(null));
    else setProfile(null);
  }, [user]);

  async function loadMore() {
    if (!lastDoc) return;
    setLoadingMore(true);
    try {
      const { jobs: more, lastDoc: next } = await getJobs(typeFilter ? { type: typeFilter } : undefined, lastDoc);
      setJobs(prev => [...prev, ...more]);
      setLastDoc(next);
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleAISearch() {
    if (!search.trim()) return;
    setAiSearching(true);
    setAiError('');
    try {
      const result = await parseJobSearch(search);
      setAiFilters(result);
      if (result.type) setTypeFilter(result.type);
    } catch (err: any) {
      setAiFilters(null);
      setAiError(err.message ?? 'AI search failed');
    } finally {
      setAiSearching(false);
    }
  }

  function clearAIFilters() {
    setAiFilters(null);
    setTypeFilter('');
  }

  let filtered = aiFilters
    ? jobs.filter(j => {
        const locOk = !aiFilters.location ||
          j.location.toLowerCase().includes(aiFilters.location.toLowerCase()) ||
          (aiFilters.remote && j.remote);
        const text = `${j.title} ${j.description} ${j.category}`.toLowerCase();
        const kwOk = aiFilters.keywords.length === 0 ||
          aiFilters.keywords.some(k => text.includes(k.toLowerCase()));
        const rateOk = aiFilters.maxHourly === null || !j.salary ||
          j.salary.period !== 'hourly' || j.salary.max <= aiFilters.maxHourly;
        return locOk && kwOk && rateOk;
      })
    : search
    ? jobs.filter(j =>
        j.title.toLowerCase().includes(search.toLowerCase()) ||
        j.description.toLowerCase().includes(search.toLowerCase()) ||
        j.location.toLowerCase().includes(search.toLowerCase())
      )
    : jobs;

  if (profile) {
    filtered = [...filtered].sort((a, b) => scoreJobMatch(b, profile) - scoreJobMatch(a, profile));
  }

  const aiSummary = aiFilters
    ? [
        aiFilters.keywords.join(', '),
        aiFilters.location,
        aiFilters.remote ? 'remote' : '',
        aiFilters.maxHourly !== null ? `≤ $${aiFilters.maxHourly}/hr` : '',
      ].filter(Boolean).join(' · ')
    : '';

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Job Listings</h1>
          <p className="text-slate-500 mt-1">Showing {jobs.length} open position{jobs.length !== 1 ? 's' : ''}</p>
          {profile && <p className="text-xs text-violet-600 mt-1">✨ Sorted by best match for your profile</p>}
        </div>
        {user && accountType === 'employer' && (
          <Link href="/jobs/post" className="btn-primary">+ Post a Job</Link>
        )}
      </div>

      {/* Search */}
      <div className="flex gap-2 mb-5">
        <div className="relative flex-1">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="input pl-11" placeholder="Search by title, description, or location…" />
        </div>
        <button type="button" onClick={handleAISearch} disabled={aiSearching || !search.trim()}
          className="shrink-0 px-4 rounded-lg border border-violet-200 bg-violet-50 text-sm font-semibold text-violet-600 hover:text-violet-700 hover:bg-violet-100 disabled:opacity-50 transition-colors">
          {aiSearching ? '✨ Searching…' : '✨ AI Search'}
        </button>
      </div>

      {aiError && (
        <p className="text-sm text-red-500 mb-4">{aiError}</p>
      )}

      {aiFilters && (
        <div className="flex items-center gap-2 flex-wrap mb-5">
          <span className="badge bg-violet-100 text-violet-700 px-3 py-1.5 text-sm font-medium">
            ✨ AI filters: {aiSummary || 'none'}
          </span>
          <button type="button" onClick={clearAIFilters}
            className="text-sm text-slate-500 hover:text-slate-700 font-medium">✕ Clear</button>
        </div>
      )}

      {/* Type filter */}
      <div className="flex flex-wrap gap-2 mb-8">
        {TYPES.map(t => (
          <button key={t.id} onClick={() => setTypeFilter(t.id)}
            className={`badge px-3 py-1.5 text-sm font-medium cursor-pointer ${typeFilter === t.id ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="card animate-pulse h-36 bg-slate-100" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <div className="text-5xl mb-4">📋</div>
          <p className="text-lg font-medium">No jobs found.</p>
          {accountType === 'employer' && (
            <Link href="/jobs/post" className="inline-block mt-4 btn-primary text-sm">Post the First Job</Link>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {filtered.map(j => <JobCard key={j.id} job={j} />)}
          </div>
          {lastDoc && !aiFilters && !search && (
            <div className="text-center mt-8">
              <button type="button" onClick={loadMore} disabled={loadingMore} className="btn-secondary">
                {loadingMore ? 'Loading…' : 'Load More Jobs'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
