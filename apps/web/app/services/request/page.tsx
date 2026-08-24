'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

import { useAuth } from '@/components/AuthProvider';
import { createServiceRequest } from '@/lib/firestore';
import { GIG_CATEGORIES } from '@jobman/shared/src/constants/categories';
import type { ServiceTimeWindow } from '@jobman/shared/src/types';

const HOME_SERVICE_CATEGORIES = GIG_CATEGORIES.filter(category =>
  ['plumber', 'electrician', 'cleaner', 'painter', 'carpenter', 'landscaper', 'mover', 'handyman', 'hvac'].includes(category.id),
);

const TIME_WINDOWS: { value: ServiceTimeWindow; label: string }[] = [
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
  { value: 'flexible', label: 'I can vibe with anything' },
];

export default function ServiceRequestPage() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    category: '',
    description: '',
    city: '',
    preferredDate: '',
    timeWindow: 'flexible' as ServiceTimeWindow,
    estimatedDurationMinutes: '120',
    budgetMin: '',
    budgetMax: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [requestId, setRequestId] = useState('');

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  function set(field: keyof typeof form, value: string) {
    setForm(current => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');

    if (!user) {
      setError('Sign in first so we know where to send the good news.');
      return;
    }
    if (form.description.trim().length < 10) {
      setError('Give the pros at least ten characters of context. “Help” is a mood, not a scope.');
      return;
    }
    if (form.preferredDate && form.preferredDate < today) {
      setError('Unless your toolbox includes a time machine, please choose today or later.');
      return;
    }

    const budgetMin = form.budgetMin ? Number(form.budgetMin) : null;
    const budgetMax = form.budgetMax ? Number(form.budgetMax) : null;
    if (budgetMin !== null && budgetMax !== null && budgetMax < budgetMin) {
      setError('Your maximum budget needs to be at least your minimum budget. Math is being dramatic.');
      return;
    }
    const estimatedDurationMinutes = Number(form.estimatedDurationMinutes);
    if (!Number.isInteger(estimatedDurationMinutes) || estimatedDurationMinutes < 30 || estimatedDurationMinutes > 720) {
      setError('Choose a rough duration from 30 minutes to 12 hours. No time-machine math today.');
      return;
    }

    setSubmitting(true);
    try {
      const id = await createServiceRequest({
        customerId: user.uid,
        customerName: user.displayName ?? user.email ?? 'JobMan customer',
        category: form.category,
        description: form.description.trim(),
        city: form.city.trim(),
        preferredDate: form.preferredDate,
        timeWindow: form.timeWindow,
        estimatedDurationMinutes,
        currency: 'USD',
        budgetMin,
        budgetMax,
      });
      setRequestId(id);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The request wandered off. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (requestId) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:py-24">
        <section role="status" className="overflow-hidden rounded-3xl border-2 border-ink bg-acid-200 shadow-pop">
          <div className="border-b-2 border-ink bg-ink px-6 py-3 text-sm font-bold text-white">REQUEST RECEIVED · NO MONEY MOVED</div>
          <div className="p-7 sm:p-10">
            <div className="mb-5 text-5xl" aria-hidden="true">🧰</div>
            <h1 className="text-3xl font-bold text-ink sm:text-4xl">The toolbox wheels are turning.</h1>
            <p className="mt-4 max-w-xl leading-relaxed text-slate-700">
              Your request is safely saved. Matching, quotes, booking, and payments are the next foundation pieces, so nobody has been charged today.
            </p>
            <p className="mt-4 text-xs font-medium text-slate-600">Request reference: {requestId}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/gigs" className="btn-primary">Meet local pros</Link>
              <button type="button" className="btn-secondary" onClick={() => setRequestId('')}>Make another request</button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="bg-[#fcfbff]">
      <section className="border-b-2 border-ink bg-ink text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_0.72fr] lg:px-8 lg:py-16">
          <div>
            <p className="mb-4 text-xs font-bold tracking-[0.18em] text-acid-300">HOME HELP, MINUS THE GROUP-CHAT PANIC</p>
            <h1 className="max-w-3xl text-4xl font-bold leading-tight sm:text-6xl">Tell us what broke. We’ll keep the drama to a minimum.</h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-violet-100 sm:text-lg">
              Start a private request for a Bay Area home-service professional. Share the neighbourhood-level details now; the exact address waits until a real booking exists.
            </p>
          </div>
          <aside className="rounded-3xl border-2 border-acid-300 bg-white/10 p-6" aria-label="What happens after submitting">
            <p className="font-display text-lg font-bold text-acid-300">What happens next?</p>
            <ol className="mt-4 space-y-3 text-sm text-violet-50">
              <li>1. JobMan cleans up the scope.</li>
              <li>2. Suitable pros review it.</li>
              <li>3. You approve a final quote.</li>
              <li>4. Payment happens only after the secure booking flow is ready.</li>
            </ol>
          </aside>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[0.7fr_1.3fr] lg:px-8 lg:py-14">
        <aside className="h-fit rounded-3xl border-2 border-ink bg-pink-100 p-6 shadow-pop-sm">
          <p className="text-3xl" aria-hidden="true">🕵️‍♀️</p>
          <h2 className="mt-3 text-xl font-bold text-ink">Good scope, fewer plot twists</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-700">
            Mention what is happening, how long it has been happening, and anything a professional should bring. Please leave passwords, alarm codes, and exact entry instructions out of this box.
          </p>
          <div className="mt-5 rounded-2xl border border-ink/15 bg-white p-4 text-sm text-slate-700">
            <span className="font-bold text-ink">Example:</span> “My bathroom faucet has a slow leak. The shutoff works, and I’d like it repaired next Friday in Oakland.”
          </div>
        </aside>

        <form onSubmit={handleSubmit} className="space-y-5 rounded-3xl border-2 border-ink bg-white p-6 shadow-pop sm:p-8">
          <div>
            <label htmlFor="service-category" className="mb-1 block text-sm font-bold text-ink">What kind of help do you need?</label>
            <select id="service-category" className="input" required value={form.category} onChange={event => set('category', event.target.value)}>
              <option value="">Choose a service</option>
              {HOME_SERVICE_CATEGORIES.map(category => (
                <option key={category.id} value={category.id}>{category.icon} {category.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="service-description" className="mb-1 block text-sm font-bold text-ink">Give us the useful gossip</label>
            <textarea
              id="service-description"
              className="input min-h-36 resize-y"
              required
              minLength={10}
              maxLength={2000}
              value={form.description}
              onChange={event => set('description', event.target.value)}
              placeholder="What needs doing, what have you already tried, and what should the pro know?"
            />
            <p className="mt-1 text-right text-xs text-slate-500">{form.description.length}/2000</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="service-city" className="mb-1 block text-sm font-bold text-ink">Bay Area city</label>
              <input id="service-city" className="input" required maxLength={120} value={form.city} onChange={event => set('city', event.target.value)} placeholder="Oakland" />
            </div>
            <div>
              <label htmlFor="preferred-date" className="mb-1 block text-sm font-bold text-ink">Preferred date</label>
              <input id="preferred-date" type="date" min={today} className="input" required value={form.preferredDate} onChange={event => set('preferredDate', event.target.value)} />
            </div>
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-bold text-ink">Best time window</legend>
            <div className="flex flex-wrap gap-2">
              {TIME_WINDOWS.map(window => (
                <button
                  key={window.value}
                  type="button"
                  aria-pressed={form.timeWindow === window.value}
                  onClick={() => set('timeWindow', window.value)}
                  className={`filter-pill ${form.timeWindow === window.value ? '!border-ink !bg-acid-300' : ''}`}
                >
                  {window.label}
                </button>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="estimated-duration" className="mb-1 block text-sm font-bold text-ink">Roughly how long is the job?</label>
            <select
              id="estimated-duration"
              className="input"
              required
              value={form.estimatedDurationMinutes}
              onChange={event => set('estimatedDurationMinutes', event.target.value)}
            >
              <option value="30">About 30 minutes</option>
              <option value="60">About 1 hour</option>
              <option value="120">About 2 hours</option>
              <option value="180">About 3 hours</option>
              <option value="240">About 4 hours</option>
              <option value="360">About 6 hours</option>
              <option value="480">About 8 hours</option>
            </select>
            <p className="mt-1 text-xs text-slate-500">Just an estimate for matching—not a quote, booking, or promise to finish by then.</p>
          </div>

          <fieldset>
            <legend className="mb-1 text-sm font-bold text-ink">Budget range <span className="font-normal text-slate-500">(optional, honesty is hot)</span></legend>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <input aria-label="Minimum budget" className="input" min="0" type="number" placeholder="$ minimum" value={form.budgetMin} onChange={event => set('budgetMin', event.target.value)} />
              <span className="text-slate-400">to</span>
              <input aria-label="Maximum budget" className="input" min="0" type="number" placeholder="$ maximum" value={form.budgetMax} onChange={event => set('budgetMax', event.target.value)} />
            </div>
          </fieldset>

          {error && (
            <div role="alert" className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error} {!user && <Link href="/sign-in" className="ml-1 font-bold underline">Sign in</Link>}
            </div>
          )}

          <button type="submit" disabled={submitting} className="motion-cta motion-cta-violet w-full rounded-2xl px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">
            {submitting ? 'Saving the day-ish…' : 'Start my request'} <span className="cta-arrow" aria-hidden="true">→</span>
          </button>
          <p className="text-center text-xs leading-relaxed text-slate-500">No payment is collected in this foundation release.</p>
        </form>
      </div>
    </div>
  );
}
