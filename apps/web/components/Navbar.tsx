'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from './AuthProvider';
import { logout } from '@/lib/auth';

export default function Navbar() {
  const { user, accountType } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout() {
    await logout();
    router.push('/');
  }

  return (
    <nav className="bg-white/90 backdrop-blur-sm border-b border-slate-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="JobMan" className="w-9 h-9" />
            <span className="font-extrabold text-xl tracking-tight text-slate-900">Job<span className="text-primary-600">Man</span></span>
          </Link>

          {/* Center Nav */}
          <div className="hidden md:flex items-center gap-1">
            <Link href="/gigs" className="px-4 py-2 text-slate-600 hover:text-primary-600 hover:bg-primary-50 font-medium transition-colors rounded-xl text-sm">
              Gig Workers
            </Link>
            <Link href="/professionals" className="px-4 py-2 text-slate-600 hover:text-primary-600 hover:bg-primary-50 font-medium transition-colors rounded-xl text-sm">
              Professionals
            </Link>
            <Link href="/jobs" className="px-4 py-2 text-slate-600 hover:text-primary-600 hover:bg-primary-50 font-medium transition-colors rounded-xl text-sm">
              Job Listings
            </Link>
          </div>

          {/* Right */}
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <Link href="/messages" className="relative p-2 text-slate-500 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M21 16a2 2 0 01-2 2H7l-4 4V6a2 2 0 012-2h14a2 2 0 012 2v10z" />
                  </svg>
                </Link>
                {accountType === 'employer' && (
                  <Link href="/jobs/post" className="btn-primary text-sm py-2">Post a Job</Link>
                )}
                <div className="relative">
                  <button onClick={() => setMenuOpen(!menuOpen)} className="flex items-center gap-2">
                    {user.photoURL ? (
                      <Image src={user.photoURL} alt="avatar" width={36} height={36} className="rounded-full ring-2 ring-primary-100" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-500 to-violet-600 flex items-center justify-center text-white font-semibold text-sm">
                        {(user.displayName?.[0] ?? user.email?.[0] ?? 'U').toUpperCase()}
                      </div>
                    )}
                  </button>
                  {menuOpen && (
                    <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-10">
                      <div className="px-4 py-2 border-b border-slate-100 mb-1">
                        <p className="text-sm font-semibold text-slate-900 truncate">{user.displayName ?? 'User'}</p>
                        <p className="text-xs text-slate-400 truncate">{user.email}</p>
                      </div>
                      <Link href="/dashboard" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                        📊 Dashboard
                      </Link>
                      <Link href={`/profile/${user.uid}`} onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                        👤 My Profile
                      </Link>
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
                <Link href="/sign-in" className="btn-secondary text-sm py-2">Sign In</Link>
                <Link href="/sign-up" className="btn-primary text-sm py-2">Get Started</Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
