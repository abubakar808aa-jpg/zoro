'use client';

import { useState } from 'react';

import {
  PASS_REASON_OPTIONS,
  type OpportunityCard as OpportunityCardData,
} from '@/lib/opportunity-contracts';
import type { OpportunityPassReason, OpportunityResponseInput } from '@/lib/opportunity-policy';
import { formatDuration, formatMinorCurrency } from '@/lib/opportunity-ui';
import { GIG_CATEGORIES } from '@jobman/shared/src/constants/categories';

interface OpportunityCardProps {
  opportunity: OpportunityCardData;
  isResponding: boolean;
  actionError?: string;
  onRespond: (input: OpportunityResponseInput) => Promise<void>;
}
function formatRequestedDate(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(date);
}

function timeWindowLabel(value: OpportunityCardData['timeWindow']): string {
  return value === 'flexible' ? 'Flexible time' : `${value[0].toUpperCase()}${value.slice(1)}`;
}

export default function OpportunityCard({
  opportunity,
  isResponding,
  actionError,
  onRespond,
}: OpportunityCardProps) {
  const [passReason, setPassReason] = useState<OpportunityPassReason | ''>('');
  const category = GIG_CATEGORIES.find(item => item.id === opportunity.category);
  const responseLabel = opportunity.response?.decision === 'interested'
    ? 'Interest sent — cute, calm, not a booking.'
    : opportunity.response?.decision === 'passed'
      ? 'Passed — no penalty, no weird algorithm grudge.'
      : null;

  return (
    <article className="overflow-hidden rounded-3xl border-2 border-ink bg-white shadow-pop-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-ink bg-acid-100 p-5 sm:p-6">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-primary-700">New side-quest candidate</p>
          <h2 className="mt-1 font-display text-2xl font-bold text-ink">
            <span aria-hidden="true">{category?.icon ?? '🧰'} </span>
            {category?.label ?? opportunity.category}
          </h2>
          <p className="mt-2 text-sm font-medium text-slate-600">
            {opportunity.city} · about {opportunity.approximateDistanceMiles} miles · city-centre estimate
          </p>
        </div>
        <div className="rounded-2xl border-2 border-ink bg-white px-4 py-3 text-right shadow-pop-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Est. take-home</p>
          <p className="font-display text-2xl font-bold text-ink">
            {formatMinorCurrency(opportunity.earnings.takeHomeMinor, opportunity.earnings.currency)}
          </p>
          <p className="text-xs font-semibold text-slate-600">
            {formatMinorCurrency(opportunity.earnings.hourlyTakeHomeMinor, opportunity.earnings.currency)}/hr
          </p>
        </div>
      </div>

      <div className="space-y-6 p-5 sm:p-6">
        <section aria-labelledby={`scope-${opportunity.id}`}>
          <h3 id={`scope-${opportunity.id}`} className="text-sm font-black uppercase tracking-wide text-ink">The useful gossip</h3>
          <p className="mt-2 whitespace-pre-wrap leading-relaxed text-slate-700">{opportunity.scopeSummary}</p>
        </section>

        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-slate-50 p-3">
            <dt className="font-bold text-slate-500">Requested</dt>
            <dd className="mt-1 font-semibold text-ink">{formatRequestedDate(opportunity.requestedDate)}</dd>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3">
            <dt className="font-bold text-slate-500">Window</dt>
            <dd className="mt-1 font-semibold text-ink">{timeWindowLabel(opportunity.timeWindow)}</dd>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3">
            <dt className="font-bold text-slate-500">Rough duration</dt>
            <dd className="mt-1 font-semibold text-ink">{formatDuration(opportunity.estimatedDurationMinutes)}</dd>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3">
            <dt className="font-bold text-slate-500">Budget floor</dt>
            <dd className="mt-1 font-semibold text-ink">
              {formatMinorCurrency(opportunity.earnings.grossMinor, opportunity.earnings.currency)}
            </dd>
          </div>
        </dl>

        <section aria-labelledby={`why-${opportunity.id}`} className="rounded-2xl border border-ink/15 bg-primary-50 p-4">
          <h3 id={`why-${opportunity.id}`} className="font-bold text-ink">Why JobMan showed you this</h3>
          <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
            {opportunity.matchReasons.map(reason => (
              <li key={reason.code} className="flex gap-2">
                <span aria-hidden="true">✓</span>
                <span>{reason.label}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            Known JobMan fee today: {formatMinorCurrency(opportunity.earnings.knownFeesMinor, opportunity.earnings.currency)}.
            This estimate is based on the customer&apos;s budget floor and excludes unknown materials, travel costs, taxes, and future fees.
          </p>
        </section>

        {responseLabel ? (
          <div role="status" aria-live="polite" className="rounded-2xl border-2 border-ink bg-acid-200 px-4 py-3 font-bold text-ink">
            {responseLabel}
          </div>
        ) : (
          <fieldset disabled={isResponding} className="space-y-3">
            <legend className="font-bold text-ink">Your move, boss</legend>
            <p className="text-sm text-slate-600">
              Interest only tells JobMan you want to talk next. It does not confirm a match, quote, booking, address release, or payment.
            </p>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
              <div>
                <label htmlFor={`pass-reason-${opportunity.id}`} className="mb-1 block text-xs font-bold text-slate-600">
                  Pass reason <span className="font-normal">(optional and never used to punish you)</span>
                </label>
                <select
                  id={`pass-reason-${opportunity.id}`}
                  className="input"
                  value={passReason}
                  onChange={event => setPassReason(event.target.value as OpportunityPassReason | '')}
                >
                  <option value="">No reason</option>
                  {PASS_REASON_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                className="btn-secondary min-h-12 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => onRespond({
                  decision: 'passed',
                  ...(passReason ? { passReason } : {}),
                })}
              >
                Pass, bestie
              </button>
              <button
                type="button"
                className="btn-primary min-h-12 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => onRespond({ decision: 'interested' })}
              >
                {isResponding ? 'Sending…' : 'I’m interested →'}
              </button>
            </div>
          </fieldset>
        )}

        {actionError && <p role="alert" className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{actionError}</p>}
      </div>
    </article>
  );
}
