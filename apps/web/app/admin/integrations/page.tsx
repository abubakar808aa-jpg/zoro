'use client';

import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import type { ConnectorGate } from '@/lib/integrations/partner-adapters';

export default function IntegrationsPage() {
  const [items, setItems] = useState<ConnectorGate[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    auth.currentUser?.getIdToken().then(token => fetch('/api/admin/integrations', { headers: { Authorization: `Bearer ${token}` } }))
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data; })
      .then(data => setItems(data.integrations || []))
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Integration status failed.'));
  }, []);
  return <section>
    <div className="rounded-3xl border-2 border-ink bg-white p-6 shadow-pop-sm">
      <p className="text-xs font-bold uppercase tracking-widest text-primary-600">Fail closed, sleep better</p>
      <h2 className="mt-2 text-2xl font-bold text-ink">Partner connector gates</h2>
      <p className="mt-2 text-sm text-slate-600">These adapters make zero network requests until their access, terms, attribution, and implementation are explicitly approved.</p>
    </div>
    {error && <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-4 text-rose-700">{error}</p>}
    <div className="mt-5 space-y-3">
      {items.map(item => <article key={item.id} className="rounded-2xl border-2 border-ink/10 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold text-ink">{item.name}</h3><span className="badge bg-amber-100 text-amber-800">Disabled safely</span></div>
        <p className="mt-2 text-sm text-slate-600">{item.nextStep}</p>
        <p className="mt-2 text-xs font-bold uppercase text-slate-400">Gate: {item.reason.replaceAll('_', ' ')}</p>
      </article>)}
      {items.length === 0 && !error && <div className="card animate-pulse h-40" role="status" aria-label="Loading connector gates" />}
    </div>
  </section>;
}
