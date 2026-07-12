'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
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
        <h1 className="text-3xl font-bold text-slate-900">Gig Workers</h1>
        <p className="text-slate-500 mt-1">Hire skilled tradespeople for any task</p>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2 mb-8">
        <button onClick={() => setSelected('')}
          className={`badge px-3 py-1.5 text-sm font-medium cursor-pointer ${!selected ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
          All
        </button>
        {GIG_CATEGORIES.map(cat => (
          <button key={cat.id} onClick={() => setSelected(cat.id)}
            className={`badge px-3 py-1.5 text-sm font-medium cursor-pointer ${selected === cat.id ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
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
