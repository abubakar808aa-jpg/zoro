'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import ProfileCard from '@/components/ProfileCard';
import { getGigProfiles, getProfessionalProfiles } from '@/lib/firestore';
import type { GigProfile, ProfessionalProfile } from '@jobman/shared/src/types';

type DirectoryProfile = GigProfile | ProfessionalProfile;
type PeopleFilter = 'all' | 'gig' | 'professional';

function searchableText(profile: DirectoryProfile) {
  const role = profile.type === 'gig' ? profile.category : profile.title;
  return [profile.name, role, profile.category, profile.location, profile.bio, ...profile.skills]
    .join(' ')
    .toLowerCase();
}

export default function PeoplePage() {
  const [profiles, setProfiles] = useState<DirectoryProfile[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<PeopleFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getGigProfiles(), getProfessionalProfiles()])
      .then(([gigProfiles, professionalProfiles]) => {
        setProfiles([...gigProfiles, ...professionalProfiles]);
        setError('');
      })
      .catch(() => setError('The people directory is taking a tiny networking break. Try again shortly.'))
      .finally(() => setLoading(false));
  }, []);

  const visibleProfiles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return profiles.filter(profile => {
      const matchesType = filter === 'all' || profile.type === filter;
      const matchesQuery = !normalizedQuery || searchableText(profile).includes(normalizedQuery);
      return matchesType && matchesQuery;
    });
  }, [filter, profiles, query]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#f8f5ff] via-white to-acid-100/30">
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="relative overflow-hidden rounded-[2rem] border-2 border-ink bg-ink px-6 py-9 text-white shadow-pop sm:px-9">
          <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary-500/40 blur-3xl" />
          <div className="absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-acid-300/20 blur-3xl" />
          <div className="relative max-w-3xl">
            <span className="sticker bg-acid-300 text-ink">Networking, minus the awkward small talk</span>
            <h1 className="mt-5 font-display text-4xl font-bold tracking-tight sm:text-5xl">Find people who get the assignment.</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/70">
              Search gig talent and professionals by name, skill, role, or location. Your next collaborator may be one scroll away.
            </p>
          </div>
        </div>

        <div className="relative z-10 -mt-5 mx-auto max-w-5xl rounded-3xl border-2 border-ink bg-white p-4 shadow-pop-sm sm:p-5">
          <label htmlFor="people-search" className="sr-only">Search people</label>
          <div className="flex flex-col gap-3 lg:flex-row">
            <input
              id="people-search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              className="input flex-1"
              placeholder="Try “React”, “designer”, or “Austin”"
            />
            <div className="flex flex-wrap gap-2" aria-label="Filter people by profile type">
              {([
                ['all', 'Everyone'],
                ['gig', 'Gig talent'],
                ['professional', 'Professionals'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={`rounded-full border-2 border-ink px-4 py-2 text-sm font-bold transition ${filter === value ? 'bg-primary-600 text-white shadow-[3px_3px_0_#1b1230]' : 'bg-white text-ink hover:bg-acid-200'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-600">The human side of the job board</p>
            <h2 className="mt-2 font-display text-2xl font-bold text-ink">People worth knowing</h2>
          </div>
          {!loading && !error && <p className="text-sm font-semibold text-slate-500">{visibleProfiles.length} found</p>}
        </div>

        {loading ? (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => <div key={index} className="card h-56 animate-pulse bg-white" />)}
          </div>
        ) : error ? (
          <div className="mt-6 rounded-3xl border-2 border-ink bg-pink-50 p-8 text-center shadow-pop-sm">
            <div className="text-4xl">📡</div>
            <h2 className="mt-3 font-display text-xl font-bold text-ink">The directory ghosted us. Rude.</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">{error}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Link href="/gigs" className="btn-secondary text-sm">Browse gig talent</Link>
              <Link href="/professionals" className="btn-primary text-sm">Browse professionals</Link>
            </div>
          </div>
        ) : visibleProfiles.length === 0 ? (
          <div className="mt-6 rounded-3xl border-2 border-dashed border-primary-300 bg-white p-12 text-center">
            <div className="text-5xl">🕵️</div>
            <h2 className="mt-4 font-display text-xl font-bold text-ink">No exact matches. The algorithm checked twice.</h2>
            <p className="mt-2 text-sm text-slate-500">Try a broader skill, role, or location.</p>
            <button type="button" onClick={() => { setQuery(''); setFilter('all'); }} className="btn-secondary mt-5 text-sm">Clear filters</button>
          </div>
        ) : (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visibleProfiles.map(profile => <ProfileCard key={profile.uid} profile={profile} />)}
          </div>
        )}
      </section>
    </main>
  );
}
