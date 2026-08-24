'use client';

import { useState } from 'react';
import { auth } from '@/lib/firebase';

const YELP_SERVICE_CATEGORIES = ['cleaning', 'electricians', 'handyman', 'hvac', 'landscaping', 'movers', 'painters', 'plumbing'] as const;
type YelpServiceCategory = typeof YELP_SERVICE_CATEGORIES[number];
type ProviderDiscoveryCandidate = {
  id: string;
  source: 'yelp';
  sourceId: string;
  sourceUrl: string;
  name: string;
  searchCategory: YelpServiceCategory;
  categories: Array<{ alias: string; title: string }>;
  rating: number | null;
  reviewCount: number;
  location: { city: string; state: string };
};

async function adminRequest(url: string, options?: RequestInit) {
  const token = await auth.currentUser?.getIdToken();
  const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options?.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Provider discovery failed.');
  return data;
}

export default function ProviderDiscoveryPage() {
  const [category, setCategory] = useState<YelpServiceCategory>('cleaning');
  const [items, setItems] = useState<ProviderDiscoveryCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [queued, setQueued] = useState<Set<string>>(new Set());

  async function search() {
    setLoading(true); setError('');
    try { setItems((await adminRequest(`/api/admin/provider-discovery?category=${encodeURIComponent(category)}`)).candidates || []); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Search failed.'); }
    finally { setLoading(false); }
  }

  async function queue(candidate: ProviderDiscoveryCandidate) {
    setError('');
    try {
      await adminRequest('/api/admin/provider-discovery', { method: 'POST', body: JSON.stringify({ action: 'queue', candidate }) });
      setQueued(current => new Set(current).add(candidate.id));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Review queue failed.'); }
  }

  return <section>
    <div className="rounded-3xl border-2 border-ink bg-white p-6 shadow-pop-sm">
      <p className="text-xs font-bold uppercase tracking-widest text-primary-600">Discovery only</p>
      <h2 className="mt-2 text-2xl font-bold text-ink">Find Bay Area pros without the fake-profile nonsense.</h2>
      <p className="mt-2 text-sm text-slate-600">Search Yelp, review candidates, then invite people manually. Nothing here publishes a JobMan profile or contacts a business.</p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <select className="input" value={category} onChange={event => setCategory(event.target.value as YelpServiceCategory)}>
          {YELP_SERVICE_CATEGORIES.map(value => <option key={value} value={value}>{value}</option>)}
        </select>
        <button className="btn-primary whitespace-nowrap" onClick={search} disabled={loading}>{loading ? 'Searching…' : 'Scout the Bay →'}</button>
      </div>
      {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p>}
    </div>
    <div className="mt-5 space-y-3">
      {items.map(item => <article key={item.id} className="rounded-2xl border-2 border-ink/10 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h3 className="font-bold text-ink">{item.name}</h3><p className="text-sm text-slate-500">{item.location.city}, {item.location.state} · {item.rating ?? 'No rating'} ★ · {item.reviewCount} reviews</p></div>
          <button className="btn-secondary text-sm" onClick={() => queue(item)} disabled={queued.has(item.id)}>{queued.has(item.id) ? 'Queued ✓' : 'Add to review queue'}</button>
        </div>
        <a className="mt-3 inline-block text-xs font-bold text-primary-700" href={item.sourceUrl} target="_blank" rel="noopener noreferrer">View on Yelp ↗</a>
      </article>)}
      {items.length > 0 && <p className="text-center text-xs text-slate-400">Provider discovery data supplied by Yelp.</p>}
    </div>
  </section>;
}
