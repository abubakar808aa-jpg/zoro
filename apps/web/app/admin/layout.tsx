'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

// UX guard only — every admin mutation is re-authorized server-side in /api/admin.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) router.replace('/');
  }, [user, isAdmin, loading]);

  if (loading || !user || !isAdmin) return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="card animate-pulse h-40" />
    </div>
  );

  const tabs = [
    { href: '/admin', label: '📊 Overview' },
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
