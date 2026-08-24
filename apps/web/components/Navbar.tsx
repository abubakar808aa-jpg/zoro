'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from './AuthProvider';
import { logout } from '@/lib/auth';
import ThemeToggle from './ThemeToggle';

export default function Navbar() {
  const { user, accountType, isAdmin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const mobileLinks = [
    { href: '/', label: 'Home', icon: '⌂' },
    { href: '/gigs', label: 'Gigs', icon: '🛠' },
    { href: '/jobs', label: 'Jobs', icon: '◫' },
    { href: '/feed', label: 'Feed', icon: '◉' },
    { href: '/people', label: 'People', icon: '☺' },
  ];

  function isActive(href: string) {
    if (href === '/gigs' && pathname.startsWith('/services')) return true;
    return href === '/' ? pathname === '/' : pathname.startsWith(href);
  }

  async function handleLogout() {
    await logout();
    router.push('/');
  }

  return (
    <>
      <nav aria-label="Main navigation" className="bg-white/90 backdrop-blur-sm border-b-2 border-ink sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <img src="/logo.svg" alt="" aria-hidden="true" className="w-9 h-9 group-hover:-rotate-12 transition-transform" />
            <span className="font-display font-bold text-xl tracking-tight text-ink">Job<span className="text-primary-600">Man</span></span>
          </Link>

          {/* Center Nav */}
          <div className="hidden lg:flex items-center gap-1">
            <Link href="/gigs" className="px-4 py-2 text-slate-700 hover:text-ink hover:bg-acid-200 font-bold transition-colors rounded-full text-sm">
              Gig Workers
            </Link>
            <Link href="/professionals" className="px-4 py-2 text-slate-700 hover:text-ink hover:bg-primary-100 font-bold transition-colors rounded-full text-sm">
              Professionals
            </Link>
            <Link href="/jobs" className="px-4 py-2 text-slate-700 hover:text-ink hover:bg-pink-100 font-bold transition-colors rounded-full text-sm">
              Job Listings
            </Link>
            <Link href="/feed" className="px-4 py-2 text-slate-700 hover:text-ink hover:bg-acid-200 font-bold transition-colors rounded-full text-sm">
              News Feed
            </Link>
            <Link href="/people" className="px-4 py-2 text-slate-700 hover:text-ink hover:bg-primary-100 font-bold transition-colors rounded-full text-sm">
              Find People
            </Link>
          </div>

          {/* Right */}
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            {user ? (
              <>
                <Link href="/messages" aria-label="Messages" className="relative p-2 text-slate-600 hover:text-ink hover:bg-acid-200 rounded-full transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M21 16a2 2 0 01-2 2H7l-4 4V6a2 2 0 012-2h14a2 2 0 012 2v10z" />
                  </svg>
                </Link>
                {accountType === 'employer' && (
                  <Link href="/jobs/post" className="btn-primary text-sm py-2">Post a Job</Link>
                )}
                <div className="relative">
                  <button onClick={() => setMenuOpen(!menuOpen)} aria-label="Open account menu" aria-expanded={menuOpen} aria-haspopup="menu" className="flex items-center gap-2">
                    {user.photoURL ? (
                      <Image src={user.photoURL} alt="avatar" width={36} height={36} className="rounded-full ring-2 ring-ink" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 border-2 border-ink flex items-center justify-center text-white font-bold text-sm">
                        {(user.displayName?.[0] ?? user.email?.[0] ?? 'U').toUpperCase()}
                      </div>
                    )}
                  </button>
                  {menuOpen && (
                    <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-pop border-2 border-ink py-2 z-10">
                      <div className="px-4 py-2 border-b border-slate-100 mb-1">
                        <p className="text-sm font-semibold text-slate-900 truncate">{user.displayName ?? 'User'}</p>
                        <p className="text-xs text-slate-400 truncate">{user.email}</p>
                      </div>
                      <Link href="/dashboard" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                        📊 Dashboard
                      </Link>
                      {accountType === 'worker' && (
                        <Link href="/dashboard/opportunities" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-primary-700 hover:bg-primary-50">
                          🧰 Opportunity Inbox
                        </Link>
                      )}
                      <Link href={`/profile/${user.uid}`} onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                        👤 My Profile
                      </Link>
                      {isAdmin && (
                        <Link href="/admin" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-accent-600 font-semibold hover:bg-slate-50">
                          🛡️ Admin
                        </Link>
                      )}
                      <hr className="my-1 border-slate-100" />
                      <button onClick={handleLogout} className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50">
                        🚪 Sign Out
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link href="/sign-in" className="px-1 py-2 text-sm font-bold text-ink hover:text-primary-600 sm:px-2">Sign In</Link>
                <Link href="/sign-up" className="btn-primary !px-3 text-sm py-2 sm:!px-5">
                  <span className="sm:hidden">Join</span>
                  <span className="hidden sm:inline">Get Started</span>
                </Link>
              </>
            )}
          </div>
          </div>
        </div>
      </nav>
      <nav aria-label="Quick navigation" className="fixed inset-x-0 bottom-0 z-50 border-t-2 border-ink bg-white/95 px-1 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {mobileLinks.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[0.7rem] font-bold transition-colors ${active ? 'bg-acid-200 text-ink' : 'text-slate-500 hover:bg-slate-100 hover:text-ink'}`}
              >
                <span className="text-lg leading-none" aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
