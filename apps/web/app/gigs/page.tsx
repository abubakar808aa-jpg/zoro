'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import ProfileCard from '@/components/ProfileCard';
import { getGigProfiles } from '@/lib/firestore';
import { GIG_CATEGORIES } from '@jobman/shared/src/constants/categories';
import type { GigProfile } from '@jobman/shared/src/types';

function GigsContent() {
  const params = useSearchParams();
  const [profiles, setProfiles] = useState<GigProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(params.get('category') ?? '');

  useEffect(() => {
    setLoading(true);
    getGigProfiles(selected || undefined)
      .then(setProfiles)
      .finally(() => setLoading(false));
  }, [selected]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <div className="mb-8">
        <p className="mb-2 text-xs font-bold tracking-[0.18em] text-primary-600">LOCAL LEGENDS, SKILLS INCLUDED</p>
        <h1 className="text-3xl font-bold text-slate-900">Gig Workers</h1>
        <p className="text-slate-500 mt-1">Browse talented people for the quick jobs, big saves, and oddly specific missions on your list.</p>
      </div>

      <section className="mb-10" aria-labelledby="gig-actions-heading">
        <h2 id="gig-actions-heading" className="mb-3 text-lg font-bold text-ink">What are we getting done?</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Link href="#gig-workers" className="group rounded-2xl border-2 border-ink bg-white p-4 shadow-pop-sm transition-transform hover:-translate-y-1">
            <span className="text-2xl" aria-hidden="true">🔎</span>
            <h3 className="mt-2 font-bold text-ink">Find gig help</h3>
            <p className="mt-1 text-sm text-slate-600">Browse people who can get it done.</p>
          </Link>
          <Link href="/services/request" className="group rounded-2xl border-2 border-ink bg-acid-100 p-4 shadow-pop-sm transition-transform hover:-translate-y-1">
            <span className="text-2xl" aria-hidden="true">🏠</span>
            <h3 className="mt-2 font-bold text-ink">Request home help</h3>
            <p className="mt-1 text-sm text-slate-700">Your house chose chaos. Send backup.</p>
          </Link>
          <Link href="/dashboard/create-gig-profile" className="group rounded-2xl border-2 border-ink bg-pink-100 p-4 shadow-pop-sm transition-transform hover:-translate-y-1">
            <span className="text-2xl" aria-hidden="true">💸</span>
            <h3 className="mt-2 font-bold text-ink">Offer my skills</h3>
            <p className="mt-1 text-sm text-slate-700">Get discovered and grow your bag.</p>
          </Link>
        </div>
      </section>

      <section id="gig-workers" className="scroll-mt-24" aria-labelledby="gig-workers-heading">
        <h2 id="gig-workers-heading" className="mb-3 text-lg font-bold text-ink">Browse gig workers</h2>
        <div className="-mx-4 mb-8 flex flex-nowrap gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          <button onClick={() => setSelected('')}
            className={`badge shrink-0 px-3 py-1.5 text-sm font-medium cursor-pointer ${!selected ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            All
          </button>
          {GIG_CATEGORIES.map(cat => (
            <button key={cat.id} onClick={() => setSelected(cat.id)}
              className={`badge shrink-0 px-3 py-1.5 text-sm font-medium cursor-pointer ${selected === cat.id ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card animate-pulse h-44 bg-slate-100" />
            ))}
          </div>
        ) : profiles.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <div className="text-5xl mb-4">🔍</div>
            <p className="text-lg font-medium">No gig workers found in this category yet.</p>
            <p className="text-sm mt-2">Be the first — <a href="/dashboard" className="text-primary-600 hover:underline">create your profile</a></p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {profiles.map(p => <ProfileCard key={p.uid} profile={p} />)}
          </div>
        )}
      </section>
    </div>
  );
}

export default function GigsPage() {
  return (
    <Suspense>
      <GigsContent />
    </Suspense>
  );
}
