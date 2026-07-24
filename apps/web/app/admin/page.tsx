'use client';

import { useEffect, useState } from 'react';
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
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
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
  );
}
