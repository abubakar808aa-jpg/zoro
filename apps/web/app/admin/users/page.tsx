'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getAllUsers } from '@/lib/firestore';
import { adminAction } from '@/lib/admin';
import type { User } from '@jobman/shared/src/types';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [lastDoc, setLastDoc] = useState<Awaited<ReturnType<typeof getAllUsers>>['lastDoc']>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    getAllUsers()
      .then(({ users, lastDoc }) => { setUsers(users); setLastDoc(lastDoc); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function loadMore() {
    if (!lastDoc) return;
    setLoadingMore(true);
    try {
      const { users: more, lastDoc: next } = await getAllUsers(lastDoc);
      setUsers(prev => [...prev, ...more]);
      setLastDoc(next);
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleBanToggle(u: User) {
    setError('');
    try {
      if (u.banned) {
        await adminAction({ action: 'unbanUser', uid: u.uid });
        setUsers(list => list.map(x => x.uid === u.uid ? { ...x, banned: false } : x));
      } else {
        const reason = window.prompt(`Ban ${u.name}? Enter a reason:`);
        if (reason === null) return;
        await adminAction({ action: 'banUser', uid: u.uid, reason });
        setUsers(list => list.map(x => x.uid === u.uid ? { ...x, banned: true, bannedReason: reason } : x));
      }
    } catch (err: any) {
      setError(err.message);
    }
  }

  const q = search.trim().toLowerCase();
  const filtered = q
    ? users.filter(u => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
    : users;

  if (loading) return <div className="card animate-pulse h-64" />;

  return (
    <div>
      <input value={search} onChange={e => setSearch(e.target.value)}
        className="input mb-5" placeholder="Search by name or email…" />
      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

      <div className="space-y-2">
        {filtered.map(u => (
          <div key={u.uid} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-white border-2 border-ink/10">
            <div className="min-w-0">
              <Link href={`/profile/${u.uid}`} className="font-semibold text-slate-900 text-sm hover:text-primary-600">
                {u.name || '(no name)'}
              </Link>
              <p className="text-xs text-slate-400">{u.email} · {u.accountType}</p>
              {u.banned && u.bannedReason && (
                <p className="text-xs text-red-400 mt-0.5">Banned: {u.bannedReason}</p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`badge text-xs ${u.banned ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                {u.banned ? 'banned' : 'active'}
              </span>
              {u.isAdmin && <span className="badge text-xs bg-primary-100 text-primary-700">admin</span>}
              <button type="button" onClick={() => handleBanToggle(u)}
                className={`text-xs font-bold px-3 py-1.5 rounded-full transition-colors ${u.banned ? 'text-green-700 bg-green-50 hover:bg-green-100' : 'text-red-500 bg-red-50 hover:bg-red-100'}`}>
                {u.banned ? 'Unban' : 'Ban'}
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-center text-slate-400 py-10">No users match.</p>}
      </div>

      {lastDoc && !q && (
        <div className="text-center mt-6">
          <button type="button" onClick={loadMore} disabled={loadingMore} className="btn-secondary text-sm">
            {loadingMore ? 'Loading…' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  );
}
