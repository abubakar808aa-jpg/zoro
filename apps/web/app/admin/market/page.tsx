'use client';

import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import type { DataSfInsight } from '@/lib/market-intelligence/datasf';

export default function MarketDemandPage() {
  const [items, setItems] = useState<DataSfInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    auth.currentUser?.getIdToken().then(token => fetch('/api/admin/market-demand', { headers: { Authorization: `Bearer ${token}` } }))
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data; })
      .then(data => { if (active) setItems(data.insights || []); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Demand data failed.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) return <div className="card h-52 animate-pulse" role="status" aria-label="Loading demand signals" />;
  return <section>
    <div className="rounded-3xl border-2 border-ink bg-acid-100 p-6 shadow-pop-sm">
      <p className="text-xs font-bold uppercase tracking-widest text-primary-700">Public signals, private people</p>
      <h2 className="mt-2 text-2xl font-bold text-ink">Where the Bay Area’s “somebody fix this” energy is trending.</h2>
      <p className="mt-2 text-sm text-slate-600">Aggregate 90-day counts from SF 311 and building permits. No addresses, people, leads, or crystal-ball claims.</p>
    </div>
    {error && <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-4 text-rose-700">{error}</p>}
    {!error && items.length === 0 && <p className="mt-5 rounded-xl bg-white p-5 text-slate-500">No demand signals arrived. The data pipes may be taking a tiny union break.</p>}
    <div className="mt-5 grid gap-3 md:grid-cols-2">
      {items.slice(0, 30).map((item, index) => <article key={`${item.dataset}-${item.category}-${item.neighborhood}-${index}`} className="rounded-2xl border-2 border-ink/10 bg-white p-4">
        <p className="text-xs font-bold uppercase text-primary-700">{item.dataset === '311' ? 'SF 311' : 'Building permits'}</p>
        <h3 className="mt-1 font-bold text-ink">{item.category}</h3>
        <p className="mt-1 text-sm text-slate-500">{item.neighborhood} · {item.count.toLocaleString()} records</p>
      </article>)}
    </div>
  </section>;
}
