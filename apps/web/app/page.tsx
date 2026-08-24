'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { GIG_CATEGORIES, PROFESSIONAL_CATEGORIES } from '@jobman/shared/src/constants/categories';
import Reveal from '@/components/Reveal';

const floatingSignals = [
  { text: 'Product Designer', top: '18%', left: '8%', color: 'bg-acid-300', drift: 0.7 },
  { text: 'Remote friendly', top: '23%', left: '73%', color: 'bg-white', drift: 1.1 },
  { text: '$95k–$120k', top: '65%', left: '9%', color: 'bg-accent-400 text-white', drift: 1.3 },
  { text: 'New today', top: '73%', left: '75%', color: 'bg-primary-500 text-white', drift: 0.8 },
  { text: 'No cover letter', top: '43%', left: '83%', color: 'bg-acid-300', drift: 1.5 },
];

export default function LandingPage() {
  const [query, setQuery] = useState('');
  const [scrollY, setScrollY] = useState(0);
  const [pointer, setPointer] = useState({ x: 0.5, y: 0.5 });
  const scrollFrame = useRef<number | null>(null);

  useEffect(() => {
    const onScroll = () => {
      if (scrollFrame.current !== null) return;
      scrollFrame.current = window.requestAnimationFrame(() => {
        setScrollY(window.scrollY);
        scrollFrame.current = null;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (scrollFrame.current !== null) window.cancelAnimationFrame(scrollFrame.current);
    };
  }, []);

  const marqueeItems = [...GIG_CATEGORIES, ...PROFESSIONAL_CATEGORIES].map(c => `${c.icon} ${c.label}`);
  const heroProgress = Math.min(scrollY / 650, 1);

  return (
    <div className="overflow-hidden">
      <section
        className="hero-shell relative isolate min-h-[790px] overflow-hidden bg-ink px-4 pb-24 pt-24 text-white sm:px-6 lg:min-h-[820px] lg:pt-32"
        onPointerMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setPointer({ x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height });
        }}
      >
        <div className="hero-grid absolute inset-0 opacity-40" style={{ transform: `translate3d(0, ${heroProgress * 42}px, 0) scale(1.04)` }} />
        <div className="hero-aurora hero-aurora-one" style={{ transform: `translate3d(${(pointer.x - 0.5) * 22}px, ${(pointer.y - 0.5) * 22 + heroProgress * 24}px, 0)` }} />
        <div className="hero-aurora hero-aurora-two" style={{ transform: `translate3d(${(pointer.x - 0.5) * -30}px, ${(pointer.y - 0.5) * -20 + heroProgress * 48}px, 0)` }} />
        <div className="hero-aurora hero-aurora-three" style={{ transform: `translate3d(${(pointer.x - 0.5) * 18}px, ${(pointer.y - 0.5) * -18 + heroProgress * 34}px, 0)` }} />

        {floatingSignals.map((signal, index) => (
          <div
            aria-hidden="true"
            className="signal-parallax absolute hidden md:block"
            key={signal.text}
            style={{
              top: signal.top,
              left: signal.left,
              transform: `translate3d(${(pointer.x - 0.5) * signal.drift * 36}px, ${(pointer.y - 0.5) * signal.drift * 28 + heroProgress * signal.drift * 72}px, 0) rotate(${heroProgress * (signal.drift - 1) * 12}deg)`,
            }}
          >
            <span
              className={`signal-chip signal-float block rounded-full border border-ink/10 px-4 py-2 text-sm font-bold text-ink shadow-lg ${signal.color}`}
              style={{ animationDelay: `${index * -0.7}s`, animationDuration: `${4.8 + signal.drift}s` }}
            >
              <span className="mr-2 text-xs">✦</span>{signal.text}
            </span>
          </div>
        ))}

        <div className="relative mx-auto flex max-w-5xl flex-col items-center text-center">
          <Reveal>
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold tracking-wide text-white/90 backdrop-blur-md">
              <span className="inline-flex h-2 w-2 rounded-full bg-acid-300 shadow-[0_0_14px_#bef264]" />
              JOB SEARCH, WITHOUT THE TAB HOARDING
            </div>
          </Reveal>
          <h1 className="max-w-4xl font-display text-5xl font-bold leading-[0.95] tracking-[-0.055em] sm:text-7xl lg:text-8xl">
            The job market is scattered.<br />
            <span className="hero-gradient-text">We&apos;re not.</span>
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-relaxed text-white/70 sm:text-xl">
            Find work worth applying for, discover people worth hiring, and leave the 47-tab career spiral behind. You&apos;re welcome.
          </p>

          <form action="/jobs" method="get" className="hero-search mt-10 flex w-full max-w-3xl flex-col gap-3 rounded-[1.6rem] border border-white/15 bg-white/10 p-3 backdrop-blur-xl sm:flex-row">
            <label className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl bg-white px-5 py-4 text-left">
              <span className="text-xl">⌕</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                name="q"
                className="min-w-0 w-full bg-transparent text-base font-medium text-ink outline-none placeholder:text-slate-400"
                placeholder="Job title, skill, or company"
                aria-label="Search jobs"
              />
            </label>
            <button type="submit" className="motion-cta motion-cta-lime group rounded-2xl px-7 py-4 font-bold text-ink">
              Find my next flex <span className="cta-arrow" aria-hidden="true">→</span>
            </button>
          </form>
          <p className="mt-4 text-sm text-white/45">Try “product designer” or “electrician near me” — we don&apos;t judge the plot twists.</p>
        </div>

        <div className="hero-orbit pointer-events-none absolute bottom-0 left-1/2 hidden h-56 w-[min(92vw,920px)] -translate-x-1/2 rounded-t-[100%] border-x border-t border-white/15 bg-white/[0.035] md:block" />
      </section>

      <section className="relative z-10 -mt-10 px-4 sm:px-6">
        <Reveal>
          <div className="mx-auto grid max-w-6xl gap-3 rounded-[2rem] border border-slate-200 bg-white p-3 shadow-[0_24px_70px_rgba(30,16,51,0.12)] md:grid-cols-3">
            {[
              ['Fresh drops', 'Roles found in the last 24 hours', '✦', 'bg-primary-50'],
              ['Original links', 'Apply where the employer lives', '↗', 'bg-pink-50'],
              ['Less noise', 'A calmer route to your next move', '⌁', 'bg-lime-50'],
            ].map(([title, copy, icon, color]) => (
              <div key={title} className={`flex items-start gap-4 rounded-[1.4rem] p-5 ${color}`}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink text-lg text-acid-300">{icon}</span>
                <div><p className="font-display font-bold text-ink">{title}</p><p className="mt-1 text-sm leading-relaxed text-slate-600">{copy}</p></div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      <section className="relative px-4 pb-28 pt-32 sm:px-6">
        <div className="motion-line absolute left-1/2 top-0 hidden h-full w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-primary-200 to-transparent lg:block" />
        <div className="relative mx-auto max-w-6xl">
          <Reveal className="max-w-xl">
            <p className="eyebrow">DISCOVERY, BUT MAKE IT CIVILISED</p>
            <h2 className="section-title">We did the lurking for you.</h2>
            <p className="section-copy">Job hunting is noisy. JobMan turns the mess into a cleaner, more useful shortlist—so you can spend less time opening tabs and more time opening doors.</p>
          </Reveal>

          <div className="mt-14 grid gap-6 lg:grid-cols-3">
            {([
              ['01', 'Gather the signal', 'Career pages, trusted feeds, and the corners of the internet where good roles like to hide.', '🌐'],
              ['02', 'Cut the chaos', 'Spot duplicate listings, show what matters first, and keep the useful details easy to scan.', '✂️'],
              ['03', 'Send you straight there', 'Find a role you like? Head straight to the original listing. No weird detours. No catfishing.', '↗️'],
            ] as const).map(([number, title, description, icon], index) => (
              <Reveal key={number} delay={index * 90}>
                <article className="story-card group relative h-full overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm">
                  <div className="absolute right-5 top-5 text-4xl transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110">{icon}</div>
                  <span className="text-xs font-bold tracking-[0.18em] text-primary-600">{number}</span>
                  <h3 className="mt-12 font-display text-2xl font-bold tracking-tight text-ink">{title}</h3>
                  <p className="mt-3 leading-relaxed text-slate-600">{description}</p>
                  <div className="mt-8 h-1.5 w-16 rounded-full bg-acid-300 transition-all duration-500 group-hover:w-full" />
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#f4efff] px-4 py-28 sm:px-6">
        <div className="absolute -right-20 top-20 h-80 w-80 rounded-full bg-accent-400/15 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal>
            <p className="eyebrow">YOUR TYPE, BUT PROFESSIONALLY</p>
            <h2 className="section-title">Good jobs should feel less like a scavenger hunt.</h2>
            <p className="section-copy">Browse local gigs, full-time roles, and the people who can make the work happen. Big career energy, fewer browser tabs.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              {['Remote', 'Entry-level', 'Great pay', 'Near me'].map((filter) => <button key={filter} className="filter-pill" type="button">{filter} <span>+</span></button>)}
            </div>
            <div className="mt-9 flex flex-wrap gap-4">
              <Link href="/jobs" className="motion-cta motion-cta-violet group rounded-2xl px-5 py-3 font-bold text-white">Explore job listings <span className="cta-arrow" aria-hidden="true">→</span></Link>
              <Link href="/gigs" className="motion-cta motion-cta-outline rounded-2xl px-5 py-3 font-bold text-ink">Browse local talent <span className="cta-arrow" aria-hidden="true">→</span></Link>
            </div>
          </Reveal>

          <Reveal className="relative mx-auto w-full max-w-xl" delay={100}>
            <div className="radar-ring radar-ring-one" />
            <div className="radar-ring radar-ring-two" />
            <div className="featured-job-card relative rounded-[2rem] border border-ink/10 bg-white p-5 shadow-[0_24px_70px_rgba(30,16,51,0.16)] sm:p-7">
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
                <div><p className="text-xs font-bold uppercase tracking-widest text-primary-600">Freshly found</p><h3 className="mt-1 font-display text-xl font-bold text-ink">Senior Product Designer</h3><p className="mt-1 text-sm text-slate-500">Northstar Studio · Remote</p></div>
                <span className="rounded-full bg-acid-200 px-3 py-1.5 text-xs font-bold text-ink">92% fit</span>
              </div>
              <div className="grid grid-cols-2 gap-3 py-5 text-sm"><span className="job-detail">$110k–$140k</span><span className="job-detail">Full-time</span><span className="job-detail">Updated today</span><span className="job-detail">Original source ↗</span></div>
              <div className="rounded-2xl bg-primary-50 p-4 text-sm leading-relaxed text-primary-900"><span className="font-bold">Why it&apos;s a match:</span> You&apos;ve got the product, systems, and “make it make sense” energy this role is asking for.</div>
              <button className="motion-cta motion-cta-dark mt-5 w-full rounded-xl px-5 py-3.5 font-bold text-white" type="button">Save this good one <span aria-hidden="true">♡</span></button>
            </div>
          </Reveal>
        </div>
      </section>

      <Reveal>
        <div className="marquee-shell overflow-hidden border-y border-ink bg-acid-300 py-3">
          <div className="marquee-track whitespace-nowrap">
            <div className="marquee-group">
              {marqueeItems.map((item) => <span key={item} className="mx-6 font-display text-sm font-bold text-ink">{item}</span>)}
            </div>
            <div className="marquee-group" aria-hidden="true">
              {marqueeItems.map((item) => <span key={`copy-${item}`} className="mx-6 font-display text-sm font-bold text-ink">{item}</span>)}
            </div>
          </div>
        </div>
      </Reveal>

      <section className="px-4 py-28 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <Reveal className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div className="max-w-2xl"><p className="eyebrow">PICK A LANE. OR DON&apos;T.</p><h2 className="section-title">Real work comes in more than one flavour.</h2></div>
            <Link href="/jobs" className="font-bold text-primary-600 hover:text-primary-700">See every listing →</Link>
          </Reveal>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[...GIG_CATEGORIES.slice(0, 4), ...PROFESSIONAL_CATEGORIES.slice(0, 4)].map((category, index) => (
              <Reveal key={category.id} delay={(index % 4) * 55}>
                <Link href={index < 4 ? `/gigs?category=${category.id}` : `/professionals?category=${category.id}`} className="category-tile group">
                  <span className="text-4xl transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-110">{category.icon}</span>
                  <span className="mt-8 font-display text-lg font-bold text-ink">{category.label}</span>
                  <span className="mt-1 text-sm text-slate-500">Go where your skills are wanted →</span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-ink px-4 py-28 text-white sm:px-6">
        <div className="hero-grid absolute inset-0 opacity-25" />
        <div className="hero-aurora hero-aurora-one opacity-50" />
        <Reveal className="relative mx-auto max-w-3xl text-center">
          <span className="inline-flex rounded-full bg-white/10 px-4 py-2 text-xs font-bold tracking-widest text-acid-300">YOUR NEXT ROLE IS NOT HIDING IN ANOTHER TAB</span>
          <h2 className="mt-7 font-display text-4xl font-bold leading-tight tracking-tight sm:text-6xl">Make LinkedIn jealous.<br /><span className="text-acid-300">Respectfully.</span></h2>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-white/65">Create a profile, find the good stuff, and get a little closer to work that works for you.</p>
          <div className="mt-9 flex flex-col justify-center gap-4 sm:flex-row">
            <Link href="/sign-up" className="motion-cta motion-cta-lime group rounded-2xl px-7 py-4 font-bold text-ink">Create your free profile <span className="cta-arrow" aria-hidden="true">→</span></Link>
            <Link href="/jobs" className="motion-cta motion-cta-outline-dark rounded-2xl px-7 py-4 font-bold text-white">Browse all jobs</Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
