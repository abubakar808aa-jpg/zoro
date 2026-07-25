'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/components/AuthProvider';
import ConnectButton from '@/components/ConnectButton';
import { Reveal } from '@/components/motion/Reveal';
import {
  getProfilesForSearch, getPendingRequests, getUserDoc,
} from '@/lib/firestore';
import type { GigProfile, ProfessionalProfile, Connection } from '@jobman/shared/src/types';

type Person = GigProfile | ProfessionalProfile;

function roleOf(p: Person): string {
  return p.type === 'gig' ? (p as GigProfile).category : (p as ProfessionalProfile).title;
}

type PendingCard = { conn: Connection; name: string; photo?: string };

export default function DiscoverPage() {
  const { user } = useAuth();
  const [people, setPeople] = useState<Person[]>([]);
  const [pending, setPending] = useState<PendingCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    getProfilesForSearch(200)
      .then(setPeople)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) { setPending([]); return; }
    let cancelled = false;
    (async () => {
      const requests = await getPendingRequests(user.uid);
      const cards = await Promise.all(requests.map(async (conn) => {
        const requester = await getUserDoc(conn.requesterId).catch(() => null);
        return { conn, name: requester?.name ?? 'Someone', photo: requester?.photoURL };
      }));
      if (!cancelled) setPending(cards);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    return people.filter((p) => {
      if (user && p.uid === user.uid) return false;      // never list yourself
      if (!term) return true;
      const haystack = [
        p.name, roleOf(p), p.location, p.category,
        (p as ProfessionalProfile).title,
        ...(p.skills ?? []),
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(term);
    });
  }, [people, q, user]);

  function refreshPending(connId: string) {
    setPending((cards) => cards.filter((c) => c.conn.id !== connId));
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">Find People</h1>
        <p className="text-slate-500 mt-1">Search by name, skill, role, location, or industry — then connect.</p>
      </div>

      {/* Incoming connection requests */}
      {user && pending.length > 0 && (
        <div className="mb-8 rounded-3xl border-2 border-ink bg-lime-50 p-5 shadow-pop-sm">
          <h2 className="font-display font-bold text-ink mb-3">
            Connection requests <span className="badge bg-ink text-white ml-1">{pending.length}</span>
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pending.map(({ conn, name, photo }) => (
              <div key={conn.id} className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-white p-3">
                <Link href={`/profile/${conn.requesterId}`} className="flex min-w-0 items-center gap-3">
                  {photo ? (
                    <Image src={photo} alt={name} width={40} height={40} className="rounded-xl object-cover" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 font-bold text-primary-700">{name[0]?.toUpperCase()}</div>
                  )}
                  <span className="truncate font-semibold text-slate-900">{name}</span>
                </Link>
                <div className="ml-auto" onClick={() => setTimeout(() => refreshPending(conn.id), 400)}>
                  <ConnectButton targetUid={conn.requesterId} targetName={name} targetPhoto={photo} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="mb-8">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="input max-w-xl"
          placeholder="Try “designer”, “plumber near Austin”, or a skill…"
          aria-label="Search people"
        />
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="card h-40 animate-pulse bg-slate-100" />)}
        </div>
      ) : results.length === 0 ? (
        <div className="py-20 text-center text-slate-400">
          <div className="mb-4 text-5xl">🔍</div>
          <p className="text-lg font-medium">No people match that search yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((p, i) => (
            <Reveal key={p.uid} delay={(i % 3) * 0.05}>
              <div className="flex h-full flex-col rounded-3xl border-2 border-ink bg-white p-5 shadow-pop-sm transition-all hover:-translate-y-1 hover:shadow-pop">
                <Link href={`/profile/${p.uid}`} className="flex items-start gap-3">
                  {p.photoURL ? (
                    <Image src={p.photoURL} alt={p.name} width={52} height={52} className="rounded-2xl object-cover ring-2 ring-ink" />
                  ) : (
                    <div className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl border-2 border-ink bg-gradient-to-br from-primary-500 to-accent-500 text-lg font-bold text-white">
                      {p.name[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-display font-bold text-ink">{p.name}</h3>
                    <p className="truncate text-sm font-semibold text-primary-600">{roleOf(p)}</p>
                    <p className="truncate text-xs text-slate-400">📍 {p.location}</p>
                  </div>
                </Link>
                {p.bio && <p className="mt-3 line-clamp-2 text-sm text-slate-500">{p.bio}</p>}
                {p.skills?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {p.skills.slice(0, 3).map((s) => <span key={s} className="badge bg-slate-100 text-xs text-slate-600">{s}</span>)}
                  </div>
                )}
                <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3">
                  <ConnectButton targetUid={p.uid} targetName={p.name} targetPhoto={p.photoURL} size="md" />
                  <Link href={`/profile/${p.uid}`} className="badge bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200">View</Link>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}
