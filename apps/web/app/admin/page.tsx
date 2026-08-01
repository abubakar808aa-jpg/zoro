'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, getCountFromServer, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<{ users: number; jobs: number; openJobs: number; reports: number } | null>(null);

  useEffect(() => {
    Promise.all([
      getCountFromServer(collection(db, 'users')),
      getCountFromServer(collection(db, 'jobs')),
      getCountFromServer(query(collection(db, 'jobs'), where('status', '==', 'open'))),
      getCountFromServer(query(collection(db, 'reports'), where('resolved', '==', false))),
    ]).then(([u, j, oj, r]) => setStats({
      users: u.data().count,
      jobs: j.data().count,
      openJobs: oj.data().count,
      reports: r.data().count,
    })).catch(() => setStats({ users: 0, jobs: 0, openJobs: 0, reports: 0 }));
  }, []);

  const cards = [
    { label: 'Total Users', value: stats?.users, emoji: '👥' },
    { label: 'Total Jobs', value: stats?.jobs, emoji: '📋' },
    { label: 'Open Jobs', value: stats?.openJobs, emoji: '🟢' },
    { label: 'Open Reports', value: stats?.reports, emoji: '⚑' },
  ];

  return (
    <div className="space-y-6">
      <Link href="/admin/agents" className="group block overflow-hidden rounded-3xl border-2 border-ink bg-ink p-6 text-white shadow-pop transition hover:-translate-y-1">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-acid-300">New control surface</p>
            <h2 className="mt-2 text-2xl font-bold">Open the Agent Command Center</h2>
            <p className="mt-2 max-w-xl text-sm text-white/70">Oversee four specialist workstreams and approve only the next action each agent needs.</p>
          </div>
          <span className="rounded-full bg-acid-300 px-5 py-2.5 text-sm font-bold text-ink transition group-hover:translate-x-1">Review agents →</span>
        </div>
      </Link>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(c => (
          <div key={c.label} className="card !p-5 text-center">
            <div className="text-3xl mb-1">{c.emoji}</div>
            <div className="text-3xl font-display font-bold text-ink">
              {c.value === undefined ? '…' : c.value}
            </div>
            <div className="text-sm text-slate-500 mt-1">{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
