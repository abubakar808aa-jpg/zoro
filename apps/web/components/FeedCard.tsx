'use client';

import Link from 'next/link';
import type { FeedEvent } from '@jobman/shared/src/types';

function eventCopy(event: FeedEvent) {
  switch (event.type) {
    case 'job_posted':
      return { badge: 'Fresh role', text: `posted ${event.payload.jobTitle || 'a new job'}`, emoji: '💼' };
    case 'hired':
      return { badge: 'Big win', text: `landed ${event.payload.jobTitle || 'a new role'}`, emoji: '🎉' };
    case 'joined':
      return { badge: 'New around here', text: `joined as ${event.payload.role || 'a JobMan member'}`, emoji: '👋' };
    default:
      return { badge: 'Career tea', text: event.payload.text || 'shared an update', emoji: '💡' };
  }
}

function eventDate(value: unknown) {
  if (value && typeof value === 'object' && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  if (value && typeof value === 'object' && 'seconds' in value) {
    return new Date(Number((value as { seconds: number }).seconds) * 1_000);
  }
  const date = new Date(String(value || ''));
  return Number.isNaN(date.getTime()) ? null : date;
}

export default function FeedCard({ event, onReport }: { event: FeedEvent; onReport?: (event: FeedEvent) => void }) {
  const copy = eventCopy(event);
  const createdAt = eventDate(event.createdAt);
  const jobHref = event.type === 'job_posted' && event.payload.jobId ? `/jobs/${event.payload.jobId}` : null;

  return (
    <article className="group rounded-3xl border-2 border-ink bg-white p-5 shadow-pop-sm transition duration-300 hover:-translate-y-1 hover:shadow-pop">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 border-ink bg-acid-200 text-xl" aria-hidden="true">
          {event.actorPhoto ? <img src={event.actorPhoto} alt="" className="h-full w-full rounded-[0.8rem] object-cover" /> : copy.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="sticker bg-primary-100 text-primary-800">{copy.badge}</span>
            {createdAt && <time className="text-xs font-medium text-slate-400" dateTime={createdAt.toISOString()}>{createdAt.toLocaleDateString()}</time>}
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            <Link href={`/profile/${event.actorId}`} className="font-display font-bold text-ink hover:text-primary-700">{event.actorName}</Link>{' '}
            {copy.text}
          </p>
          <div className="mt-4 flex items-center justify-between border-t border-ink/10 pt-3">
            {jobHref ? <Link href={jobHref} className="text-sm font-bold text-primary-700 hover:text-primary-900">See the role →</Link> : <span />}
            {onReport && <button type="button" onClick={() => onReport(event)} className="text-xs font-semibold text-slate-400 hover:text-pink-600">Report</button>}
          </div>
        </div>
      </div>
    </article>
  );
}
