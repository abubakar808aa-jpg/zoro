'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

// UX guard only — every admin mutation is re-authorized server-side in /api/admin.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading, error } = useAuth();
  const pathname = usePathname();

  if (loading) return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="rounded-3xl border-2 border-ink bg-white p-8 shadow-pop" role="status">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary-600">Admin access</p>
        <h1 className="mt-2 text-2xl font-bold text-ink">Checking your command-center credentials…</h1>
        <p className="mt-2 text-sm text-slate-500">The dashboard will appear as soon as authentication finishes.</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="rounded-3xl border-2 border-rose-300 bg-rose-50 p-8 shadow-pop" role="alert">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-rose-600">Configuration needed</p>
        <h1 className="mt-2 text-2xl font-bold text-ink">The agent dashboard could not verify admin access.</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-700">{error}</p>
        <button type="button" onClick={() => window.location.reload()} className="btn-secondary mt-5 text-sm">Try again</button>
      </div>
    </div>
  );

  if (!user) return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="rounded-3xl border-2 border-ink bg-white p-8 shadow-pop">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary-600">Sign-in required</p>
        <h1 className="mt-2 text-2xl font-bold text-ink">This cockpit is for JobMan admins.</h1>
        <p className="mt-2 text-sm text-slate-500">Sign in with an administrator account to review agents and record approval decisions.</p>
        <Link href="/sign-in" className="btn-primary mt-5 inline-flex text-sm">Go to sign in</Link>
      </div>
    </div>
  );

  if (!isAdmin) return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="rounded-3xl border-2 border-amber-300 bg-amber-50 p-8 shadow-pop" role="alert">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">Access denied</p>
        <h1 className="mt-2 text-2xl font-bold text-ink">Your account is signed in, but it is not an admin.</h1>
        <p className="mt-2 text-sm text-slate-600">No agent data or approval controls were loaded.</p>
        <Link href="/" className="btn-secondary mt-5 inline-flex text-sm">Back to JobMan</Link>
      </div>
    </div>
  );

  const tabs = [
    { href: '/admin', label: '📊 Overview' },
    { href: '/admin/agents', label: '🧠 Agents' },
    { href: '/admin/users', label: '👥 Users' },
    { href: '/admin/jobs', label: '📋 Jobs' },
    { href: '/admin/reports', label: '⚑ Reports' },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-3xl font-bold text-slate-900">Admin</h1>
        <span className="sticker bg-accent-500 text-white text-xs">STAFF ONLY</span>
      </div>
      <p className="text-slate-500 mb-6">Moderation &amp; account management</p>

      <div className="flex flex-wrap gap-2 mb-8">
        {tabs.map(t => (
          <Link key={t.href} href={t.href}
            className={`badge px-4 py-2 text-sm font-bold cursor-pointer ${pathname === t.href ? 'bg-ink text-white' : 'bg-white border-2 border-ink text-ink hover:bg-acid-200'}`}>
            {t.label}
          </Link>
        ))}
      </div>

      {children}
    </div>
  );
}
