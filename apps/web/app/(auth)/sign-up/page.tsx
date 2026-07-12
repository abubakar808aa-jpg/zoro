'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signUpWithEmail, signInWithGoogle } from '@/lib/auth';
import type { AccountType } from '@jobman/shared/src/types';

export default function SignUpPage() {
  const router = useRouter();
  const [step, setStep] = useState<'type' | 'form'>('type');
  const [accountType, setAccountType] = useState<AccountType>('worker');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await signUpWithEmail(name, email, password, accountType);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message ?? 'Sign up failed.');
    } finally { setLoading(false); }
  }

  async function handleGoogle() {
    setError(''); setLoading(true);
    try {
      await signInWithGoogle(accountType);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message ?? 'Google sign up failed.');
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold">J</span>
            </div>
            <span className="font-bold text-2xl text-slate-900">JobMan</span>
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Create your account</h1>
          <p className="text-slate-500 mt-1">Free forever — no credit card needed</p>
        </div>

        <div className="card">
          {step === 'type' ? (
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-4 text-center">I am joining as a…</p>
              <div className="grid grid-cols-2 gap-3 mb-6">
                {([
                  { type: 'worker', icon: '🔨', label: 'Worker / Job Seeker', desc: 'Post my profile, find jobs & gigs' },
                  { type: 'employer', icon: '🏢', label: 'Employer / Client', desc: 'Post jobs & hire talent' },
                ] as const).map(opt => (
                  <button key={opt.type} onClick={() => setAccountType(opt.type)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${accountType === opt.type ? 'border-primary-500 bg-primary-50' : 'border-slate-200 hover:border-slate-300'}`}>
                    <div className="text-2xl mb-2">{opt.icon}</div>
                    <div className="font-semibold text-sm text-slate-900">{opt.label}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{opt.desc}</div>
                  </button>
                ))}
              </div>
              <button onClick={() => setStep('form')} className="btn-primary w-full">
                Continue as {accountType === 'worker' ? 'Worker' : 'Employer'}
              </button>
            </div>
          ) : (
            <div>
              <button onClick={() => setStep('type')} className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1 mb-4">
                ← Change account type
              </button>
              <button onClick={handleGoogle} disabled={loading} className="btn-google mb-5">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Sign up with Google
              </button>
              <div className="relative mb-5">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
                <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-slate-400">or with email</span></div>
              </div>
              <form onSubmit={handleEmail} className="space-y-4">
                {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</p>}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                  <input value={name} onChange={e => setName(e.target.value)} required className="input" placeholder="John Smith" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="input" placeholder="you@example.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} className="input" placeholder="Min. 6 characters" />
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full">
                  {loading ? 'Creating account…' : 'Create Account'}
                </button>
              </form>
            </div>
          )}
        </div>

        <p className="text-center text-sm text-slate-500 mt-6">
          Already have an account?{' '}
          <Link href="/sign-in" className="text-primary-600 font-semibold hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
