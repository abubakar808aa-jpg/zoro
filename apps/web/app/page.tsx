import Link from 'next/link';
import { GIG_CATEGORIES, PROFESSIONAL_CATEGORIES } from '@jobman/shared/src/constants/categories';

export default function LandingPage() {
  const marqueeItems = [...GIG_CATEGORIES, ...PROFESSIONAL_CATEGORIES].map(c => `${c.icon} ${c.label}`);

  return (
    <div className="min-h-screen">

      {/* Hero */}
      <section className="relative bg-ink text-white py-28 px-4 overflow-hidden">
        {/* Neon blobs */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute -top-20 -left-20 w-96 h-96 rounded-full bg-primary-600 blur-3xl" />
          <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-accent-500 blur-3xl" />
          <div className="absolute top-1/3 right-1/4 w-64 h-64 rounded-full bg-acid-400 blur-3xl opacity-60" />
        </div>
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="sticker bg-acid-300 text-ink mb-8 animate-wiggle">
            🇺🇸 Built for the United States
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold leading-tight tracking-tight">
            Find work.<br />Hire talent.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-acid-300 via-accent-400 to-primary-500">Level up. ⚡</span>
          </h1>
          <p className="mt-6 text-xl text-white/70 max-w-2xl mx-auto leading-relaxed">
            JobMan connects gig workers, professionals, and employers across all 50 states.
            Need a plumber today or a software engineer for your team? Say less.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-5 justify-center">
            <Link href="/jobs" className="bg-acid-300 text-ink font-bold px-8 py-4 rounded-2xl text-lg border-2 border-ink shadow-pop-pink transition-all hover:-translate-y-1 hover:shadow-pop-lg">
              🔍 Find a Job
            </Link>
            <Link href="/jobs/post" className="bg-accent-500 text-white font-bold px-8 py-4 rounded-2xl text-lg border-2 border-ink shadow-pop-lime transition-all hover:-translate-y-1 hover:shadow-pop-lg">
              📋 Post a Job
            </Link>
          </div>
          <p className="mt-6 text-white/40 text-sm">Free to post in v1 · No credit card · No cap 🧢</p>
        </div>
      </section>

      {/* Category marquee */}
      <div className="bg-acid-300 border-y-2 border-ink py-3 overflow-hidden">
        <div className="flex whitespace-nowrap animate-marquee w-max">
          {[...marqueeItems, ...marqueeItems].map((item, i) => (
            <span key={i} className="mx-6 font-display font-bold text-ink text-sm">{item}</span>
          ))}
        </div>
      </div>

      {/* Stats */}
      <section className="py-12">
        <div className="max-w-5xl mx-auto px-4 grid grid-cols-3 gap-4 md:gap-8 text-center">
          {[
            ['10K+', 'Workers Listed', 'bg-primary-100', '-rotate-2'],
            ['5K+', 'Jobs Posted', 'bg-acid-200', 'rotate-1'],
            ['All 50', 'States Covered', 'bg-pink-100', '-rotate-1'],
          ].map(([val, label, bg, tilt]) => (
            <div key={label} className={`${bg} ${tilt} rounded-3xl border-2 border-ink shadow-pop py-6 px-2 hover:rotate-0 transition-transform`}>
              <div className="text-3xl md:text-4xl font-display font-bold text-ink">{val}</div>
              <div className="text-slate-600 text-sm mt-1 font-medium">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Gig Categories */}
      <section className="py-16 px-4 max-w-7xl mx-auto">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-xs font-bold text-accent-500 uppercase tracking-widest mb-1">Gig Workers</p>
            <h2 className="text-3xl font-bold text-ink">Find Skilled Tradespeople 🛠️</h2>
            <p className="text-slate-500 mt-1">Plumbers, electricians, cleaners, and more — near you, today.</p>
          </div>
          <Link href="/gigs" className="hidden sm:block text-primary-600 font-bold hover:underline whitespace-nowrap">View all →</Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {GIG_CATEGORIES.slice(0, 10).map(cat => (
            <Link key={cat.id} href={`/gigs?category=${cat.id}`}
              className="flex flex-col items-center gap-2.5 p-4 bg-white rounded-3xl border-2 border-ink shadow-pop-sm hover:shadow-pop hover:-translate-y-1 transition-all text-center group">
              <span className="text-3xl group-hover:scale-125 group-hover:-rotate-6 transition-transform">{cat.icon}</span>
              <span className="text-sm font-bold text-ink">{cat.label}</span>
            </Link>
          ))}
        </div>
        <div className="mt-4 sm:hidden text-center">
          <Link href="/gigs" className="text-primary-600 font-bold text-sm hover:underline">View all gig workers →</Link>
        </div>
      </section>

      {/* Professional Categories */}
      <section className="py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-8">
            <div>
              <p className="text-xs font-bold text-primary-600 uppercase tracking-widest mb-1">Professional Jobs</p>
              <h2 className="text-3xl font-bold text-ink">Full-Time & Contract Roles 💼</h2>
              <p className="text-slate-500 mt-1">Engineers, accountants, lawyers, marketers — find your next career move.</p>
            </div>
            <Link href="/professionals" className="hidden sm:block text-primary-600 font-bold hover:underline whitespace-nowrap">View all →</Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {PROFESSIONAL_CATEGORIES.slice(0, 8).map(cat => (
              <Link key={cat.id} href={`/professionals?category=${cat.id}`}
                className="flex items-center gap-3 p-4 bg-white rounded-3xl border-2 border-ink shadow-pop-sm hover:shadow-pop hover:-translate-y-1 transition-all group">
                <span className="text-2xl group-hover:scale-125 group-hover:rotate-6 transition-transform">{cat.icon}</span>
                <span className="text-sm font-bold text-ink">{cat.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-xs font-bold text-primary-600 uppercase tracking-widest mb-2">How it works</p>
          <h2 className="text-3xl font-bold text-ink mb-12">Up and running in minutes ⏱️</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: '👤', title: 'Create Your Profile', desc: 'Sign up free as a worker or employer. Build your profile in under 5 minutes.', bg: 'bg-primary-100' },
              { icon: '🔍', title: 'Browse or Get Found', desc: 'Search for the right hire, or let employers discover you based on your skills.', bg: 'bg-acid-200' },
              { icon: '💬', title: 'Connect & Get to Work', desc: 'Message directly, share files and photos, and close the deal — all in-app.', bg: 'bg-pink-100' },
            ].map((step, i) => (
              <div key={step.title} className={`${step.bg} rounded-3xl border-2 border-ink shadow-pop p-6 text-center relative hover:-translate-y-1 transition-transform`}>
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-ink text-acid-300 text-sm font-display font-bold flex items-center justify-center border-2 border-ink">
                  {i + 1}
                </div>
                <div className="text-4xl mb-4 mt-2">{step.icon}</div>
                <h3 className="text-lg font-bold text-ink">{step.title}</h3>
                <p className="text-slate-600 text-sm mt-2 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="relative bg-ink text-white py-20 px-4 text-center overflow-hidden">
        <div className="absolute inset-0 opacity-25">
          <div className="absolute top-0 left-1/4 w-64 h-64 rounded-full bg-accent-500 blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full bg-primary-600 blur-3xl" />
        </div>
        <div className="relative max-w-2xl mx-auto">
          <h2 className="text-4xl font-bold mb-4">Ready to get started? 🚀</h2>
          <p className="text-white/60 mb-8 text-lg">Join thousands of workers and employers on JobMan — it&apos;s 100% free to get started.</p>
          <Link href="/sign-up" className="inline-block bg-acid-300 text-ink font-bold px-10 py-4 rounded-2xl text-lg border-2 border-ink shadow-pop-pink hover:-translate-y-1 hover:shadow-pop-lg transition-all">
            Create Free Account →
          </Link>
        </div>
      </section>

    </div>
  );
}
