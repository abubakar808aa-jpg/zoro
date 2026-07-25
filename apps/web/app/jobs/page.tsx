'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import JobCard from '@/components/JobCard';
import { getOpenJobsForSearch, getBoostedJobs, getProfile } from '@/lib/firestore';
import { useAuth } from '@/components/AuthProvider';
import { parseJobSearch, type ParsedSearch } from '@/lib/ai';
import { scoreJobMatch } from '@jobman/shared/src/utils/matching';
import { toMillis, SOURCE_LABELS } from '@/lib/freshness';
import type { JobListing, GigProfile, ProfessionalProfile } from '@jobman/shared/src/types';

const SEARCH_WINDOW = 200; // client-side filtering over the current DB (spec §6)

const TYPES = [
  { id: '', label: 'All types' },
  { id: 'fulltime', label: 'Full-Time' },
  { id: 'parttime', label: 'Part-Time' },
  { id: 'contract', label: 'Contract' },
  { id: 'gig', label: 'Gig' },
];
const REMOTE = [
  { id: '', label: 'Any location type' },
  { id: 'remote', label: 'Remote' },
  { id: 'hybrid', label: 'Hybrid' },
  { id: 'onsite', label: 'On-site' },
];
const SOURCES = [
  { id: '', label: 'All sources' },
  { id: 'native', label: 'Posted on JobMan' },
  { id: 'greenhouse', label: 'Greenhouse' },
  { id: 'lever', label: 'Lever' },
  { id: 'ashby', label: 'Ashby' },
  { id: 'smartrecruiters', label: 'SmartRecruiters' },
];
const POSTED = [
  { id: '', label: 'Any time' },
  { id: '1', label: 'Past 24 hours' },
  { id: '7', label: 'Past week' },
  { id: '30', label: 'Past month' },
];

const empty = {
  type: '', remoteType: '', source: '', category: '', company: '', salaryMin: '', postedWithin: '',
};

export default function JobsPage() {
  const { user, accountType } = useAuth();
  const [allJobs, setAllJobs] = useState<JobListing[]>([]);
  const [boostedJobs, setBoostedJobs] = useState<JobListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ ...empty });
  const [showFilters, setShowFilters] = useState(false);
  const [aiFilters, setAiFilters] = useState<ParsedSearch | null>(null);
  const [aiSearching, setAiSearching] = useState(false);
  const [aiError, setAiError] = useState('');
  const [profile, setProfile] = useState<GigProfile | ProfessionalProfile | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getOpenJobsForSearch(SEARCH_WINDOW),
      getBoostedJobs().catch(() => [] as JobListing[]),
    ])
      .then(([jobs, boosted]) => {
        setBoostedJobs(boosted);
        setAllJobs(jobs);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q');
    if (q) setSearch(q);
  }, []);

  useEffect(() => {
    if (user) getProfile(user.uid).then(setProfile).catch(() => setProfile(null));
    else setProfile(null);
  }, [user]);

  function set(field: keyof typeof empty, value: string) {
    setFilters(f => ({ ...f, [field]: value }));
  }

  async function handleAISearch() {
    if (!search.trim()) return;
    setAiSearching(true); setAiError('');
    try {
      const result = await parseJobSearch(search);
      setAiFilters(result);
      if (result.type) set('type', result.type);
      if (result.remote) set('remoteType', 'remote');
    } catch (err: any) {
      setAiFilters(null);
      setAiError(err.message ?? 'AI search failed');
    } finally {
      setAiSearching(false);
    }
  }

  function clearAll() {
    setAiFilters(null);
    setFilters({ ...empty });
    setSearch('');
  }

  const categories = useMemo(
    () => Array.from(new Set(allJobs.map(j => j.category).filter(Boolean))).sort(),
    [allJobs],
  );

  const hasActiveQuery = Boolean(
    search.trim() || aiFilters ||
    filters.type || filters.remoteType || filters.source || filters.category ||
    filters.company || filters.salaryMin || filters.postedWithin,
  );

  const filtered = useMemo(() => {
    const kw = (aiFilters?.keywords?.length ? aiFilters.keywords : search.trim() ? [search.trim()] : []);
    const boostedIds = new Set(boostedJobs.map(b => b.id));
    const salaryMin = Number(filters.salaryMin) || 0;
    const postedDays = Number(filters.postedWithin) || 0;
    const now = Date.now();

    let list = allJobs.filter(j => {
      if (!hasActiveQuery && boostedIds.has(j.id)) return false; // avoid dupes with pinned row

      if (kw.length) {
        const text = `${j.title} ${j.description} ${j.category} ${(j.skills ?? []).join(' ')} ${j.companyName ?? j.postedByName}`.toLowerCase();
        if (!kw.some(k => text.includes(k.toLowerCase()))) return false;
      }
      const loc = aiFilters?.location;
      if (loc && !(j.location.toLowerCase().includes(loc.toLowerCase()) || (aiFilters?.remote && j.remote))) return false;

      if (filters.type && j.type !== filters.type) return false;

      if (filters.remoteType) {
        const rt = j.remoteType ?? (j.remote ? 'remote' : 'onsite');
        if (rt !== filters.remoteType) return false;
      }
      if (filters.source) {
        if (filters.source === 'native' ? j.isImported : j.sourceProvider !== filters.source) return false;
      }
      if (filters.category && j.category !== filters.category) return false;
      if (filters.company) {
        const co = (j.companyName ?? j.postedByName ?? '').toLowerCase();
        if (!co.includes(filters.company.toLowerCase())) return false;
      }
      if (salaryMin > 0) {
        if (!j.salary) return false;
        const annualMax = j.salary.period === 'hourly' ? j.salary.max * 2080 : j.salary.max;
        if (annualMax < salaryMin) return false;
      }
      if (aiFilters?.maxHourly != null && j.salary?.period === 'hourly' && j.salary.max > aiFilters.maxHourly) return false;

      if (postedDays > 0) {
        const t = toMillis(j.postedAt) ?? toMillis(j.createdAt);
        if (!t || now - t > postedDays * 86_400_000) return false;
      }
      return true;
    });

    if (profile) list = [...list].sort((a, b) => scoreJobMatch(b, profile) - scoreJobMatch(a, profile));
    return list;
  }, [allJobs, boostedJobs, filters, search, aiFilters, hasActiveQuery, profile]);

  const selectCls = 'input !py-2 text-sm';

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Job Listings</h1>
          <p className="text-slate-500 mt-1">
            {loading ? 'Loading…' : `${filtered.length} ${hasActiveQuery ? 'matching' : 'open'} position${filtered.length !== 1 ? 's' : ''}`}
            {allJobs.length >= SEARCH_WINDOW && !hasActiveQuery ? ` · showing newest ${SEARCH_WINDOW}` : ''}
          </p>
          {profile && <p className="text-xs text-violet-600 mt-1">✨ Sorted by best match for your profile</p>}
        </div>
        {user && accountType === 'employer' && (
          <Link href="/jobs/post" className="btn-primary">+ Post a Job</Link>
        )}
      </div>

      {/* Keyword search + AI */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input value={search} onChange={e => { setSearch(e.target.value); setAiFilters(null); }}
            className="input pl-11" placeholder="Search by title, company, or keyword…" />
        </div>
        <button type="button" onClick={handleAISearch} disabled={aiSearching || !search.trim()}
          className="shrink-0 px-4 rounded-2xl border-2 border-ink bg-violet-50 text-sm font-bold text-violet-700 hover:bg-violet-100 disabled:opacity-50 transition-colors">
          {aiSearching ? '✨ …' : '✨ AI Search'}
        </button>
        <button type="button" onClick={() => setShowFilters(s => !s)}
          className="shrink-0 px-4 rounded-2xl border-2 border-ink bg-white text-sm font-bold text-ink hover:bg-slate-50">
          Filters
        </button>
      </div>

      {aiError && <p className="text-sm text-red-500 mb-3">{aiError}</p>}
      {aiFilters && (
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <span className="badge bg-violet-100 text-violet-700 px-3 py-1.5 text-sm">
            ✨ AI: {[aiFilters.keywords.join(', '), aiFilters.location, aiFilters.remote ? 'remote' : '', aiFilters.maxHourly != null ? `≤ $${aiFilters.maxHourly}/hr` : ''].filter(Boolean).join(' · ') || 'none'}
          </span>
        </div>
      )}

      {/* Filter panel */}
      {showFilters && (
        <div className="card !p-4 mb-4 grid grid-cols-2 md:grid-cols-3 gap-3">
          <select className={selectCls} value={filters.type} onChange={e => set('type', e.target.value)}>
            {TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <select className={selectCls} value={filters.remoteType} onChange={e => set('remoteType', e.target.value)}>
            {REMOTE.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
          <select className={selectCls} value={filters.source} onChange={e => set('source', e.target.value)}>
            {SOURCES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <select className={selectCls} value={filters.category} onChange={e => set('category', e.target.value)}>
            <option value="">All categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className={selectCls} value={filters.postedWithin} onChange={e => set('postedWithin', e.target.value)}>
            {POSTED.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <input className={selectCls} value={filters.company} onChange={e => set('company', e.target.value)} placeholder="Company" />
          <input className={selectCls} type="number" min={0} step={5000} value={filters.salaryMin}
            onChange={e => set('salaryMin', e.target.value)} placeholder="Min salary ($/yr)" />
          {hasActiveQuery && (
            <button type="button" onClick={clearAll} className="text-sm font-semibold text-slate-500 hover:text-slate-700 text-left px-1">
              ✕ Clear all filters
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="card animate-pulse h-36 bg-slate-100" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <div className="text-5xl mb-4">📋</div>
          <p className="text-lg font-medium">No jobs match your search.</p>
          {hasActiveQuery && <button type="button" onClick={clearAll} className="mt-4 btn-secondary text-sm">Clear filters</button>}
        </div>
      ) : (
        <div className="space-y-4">
          {!hasActiveQuery && boostedJobs.map(j => <JobCard key={j.id} job={j} featured />)}
          {filtered.map(j => <JobCard key={j.id} job={j} />)}
        </div>
      )}
    </div>
  );
}
