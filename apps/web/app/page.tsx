import Link from 'next/link';
import { GIG_CATEGORIES, PROFESSIONAL_CATEGORIES } from '@jobman/shared/src/constants/categories';

export default function LandingPage() {
  return (
    <div className="min-h-screen">

      {/* Hero */}
      <section className="relative bg-gradient-to-br from-primary-900 via-primary-700 to-violet-700 text-white py-28 px-4 overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-72 h-72 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 rounded-full bg-violet-400 blur-3xl" />
        </div>
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white/90 text-sm font-medium px-4 py-1.5 rounded-full mb-6 backdrop-blur-sm">
            🇺🇸 Built for the United States
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold leading-tight tracking-tight">
            Find Work.<br />Hire Talent.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">Build America.</span>
          </h1>
          <p className="mt-6 text-xl text-white/80 max-w-2xl mx-auto leading-relaxed">
            JobMan connects gig workers, professionals, and employers across all 50 states.
            Need a plumber today or a software engineer for your team? We've got you covered.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/jobs" className="bg-white text-primary-700 font-bold px-8 py-4 rounded-2xl text-lg transition-all hover:bg-primary-50 hover:scale-105 shadow-lg">
              🔍 Find a Job
            </Link>
            <Link href="/jobs/post" className="bg-accent-500 hover:bg-accent-600 text-white font-bold px-8 py-4 rounded-2xl text-lg transition-all hover:scale-105 shadow-lg">
              📋 Post a Job
            </Link>
          </div>
          <p className="mt-6 text-white/50 text-sm">Free to post in v1 · No credit card required</p>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-white py-10 border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-4 grid grid-cols-3 gap-8 text-center">
          {[
            ['10K+', 'Workers Listed'],
            ['5K+', 'Jobs Posted'],
            ['All 50', 'States Covered'],
          ].map(([val, label]) => (
            <div key={label}>
              <div className="text-3xl md:text-4xl font-extrabold text-primary-600">{val}</div>
              <div className="text-slate-500 text-sm mt-1">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Gig Categories */}
      <section className="py-16 px-4 max-w-7xl mx-auto">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-1">Gig Workers</p>
            <h2 className="text-3xl font-extrabold text-slate-900">Find Skilled Tradespeople</h2>
            <p className="text-slate-500 mt-1">Plumbers, electricians, cleaners, and more — near you, today.</p>
          </div>
          <Link href="/gigs" className="hidden sm:block text-primary-600 font-semibold hover:underline whitespace-nowrap">View all →</Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {GIG_CATEGORIES.slice(0, 10).map(cat => (
            <Link key={cat.id} href={`/gigs?category=${cat.id}`}
              className="flex flex-col items-center gap-2.5 p-4 bg-white rounded-2xl border border-slate-100 hover:border-orange-200 hover:shadow-md transition-all text-center group">
              <span className="text-3xl group-hover:scale-110 transition-transform">{cat.icon}</span>
              <span className="text-sm font-semibold text-slate-700">{cat.label}</span>
            </Link>
          ))}
        </div>
        <div className="mt-4 sm:hidden text-center">
          <Link href="/gigs" className="text-primary-600 font-semibold text-sm hover:underline">View all gig workers →</Link>
        </div>
      </section>

      {/* Professional Categories */}
      <section className="py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-8">
            <div>
              <p className="text-xs font-bold text-primary-500 uppercase tracking-widest mb-1">Professional Jobs</p>
              <h2 className="text-3xl font-extrabold text-slate-900">Full-Time & Contract Roles</h2>
              <p className="text-slate-500 mt-1">Engineers, accountants, lawyers, marketers — find your next career move.</p>
            </div>
            <Link href="/professionals" className="hidden sm:block text-primary-600 font-semibold hover:underline whitespace-nowrap">View all →</Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {PROFESSIONAL_CATEGORIES.slice(0, 8).map(cat => (
              <Link key={cat.id} href={`/professionals?category=${cat.id}`}
                className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-slate-100 hover:border-primary-200 hover:shadow-md transition-all group">
                <span className="text-2xl group-hover:scale-110 transition-transform">{cat.icon}</span>
                <span className="text-sm font-semibold text-slate-700">{cat.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-xs font-bold text-primary-500 uppercase tracking-widest mb-2">How it works</p>
          <h2 className="text-3xl font-extrabold text-slate-900 mb-12">Up and running in minutes</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: '👤', title: 'Create Your Profile', desc: 'Sign up free as a worker or employer. Build your profile in under 5 minutes.' },
              { icon: '🔍', title: 'Browse or Get Found', desc: 'Search for the right hire, or let employers discover you based on your skills.' },
              { icon: '💬', title: 'Connect & Get to Work', desc: 'Message directly, share files and photos, and close the deal — all in-app.' },
            ].map((step, i) => (
              <div key={step.title} className="card text-center relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-primary-600 text-white text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </div>
                <div className="text-4xl mb-4 mt-2">{step.icon}</div>
                <h3 className="text-lg font-bold text-slate-900">{step.title}</h3>
                <p className="text-slate-500 text-sm mt-2 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="relative bg-gradient-to-r from-primary-700 to-violet-700 text-white py-20 px-4 text-center overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-1/4 w-64 h-64 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full bg-violet-300 blur-3xl" />
        </div>
        <div className="relative max-w-2xl mx-auto">
          <h2 className="text-4xl font-extrabold mb-4">Ready to get started?</h2>
          <p className="text-white/70 mb-8 text-lg">Join thousands of workers and employers on JobMan — it's 100% free to get started.</p>
          <Link href="/sign-up" className="inline-block bg-white text-primary-700 font-bold px-10 py-4 rounded-2xl text-lg hover:bg-primary-50 transition-all hover:scale-105 shadow-xl">
            Create Free Account →
          </Link>
        </div>
      </section>

    </div>
  );
}
