'use client';

import Link from 'next/link';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import type { FeedEvent } from '@jobman/shared/src/types';

export default function FeedCard({
  event,
  onReport,
}: {
  event: FeedEvent;
  onReport: (event: FeedEvent) => void;
}) {
  const when = event.createdAt
    ? formatDistanceToNow(new Date((event.createdAt as any).seconds * 1000), { addSuffix: true })
    : '';

  return (
    <div className="card !p-5">
      <div className="flex items-start gap-3">
        <Link href={`/profile/${event.actorId}`} className="flex-shrink-0">
          {event.actorPhoto ? (
            <Image src={event.actorPhoto} alt={event.actorName} width={40} height={40} className="rounded-xl object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center text-primary-700 font-bold">
              {event.actorName[0]?.toUpperCase()}
            </div>
          )}
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-700">
            <Link href={`/profile/${event.actorId}`} className="font-bold text-ink hover:text-primary-600">
              {event.actorName}
            </Link>{' '}
            {event.type === 'job_posted' && (
              <>posted a job:{' '}
                <Link href={`/jobs/${event.payload.jobId}`} className="font-semibold text-primary-600 hover:underline">
                  {event.payload.jobTitle}
                </Link> 📢
              </>
            )}
            {event.type === 'hired' && (
              <>hired <span className="font-semibold">{event.payload.applicantName}</span> for &ldquo;{event.payload.jobTitle}&rdquo; 🎉</>
            )}
            {event.type === 'joined' && (
              <>joined JobMan{event.payload.role ? <> as a <span className="font-semibold">{event.payload.role}</span></> : null} 👋</>
            )}
            {event.type === 'tip' && <>shared a tip 💡</>}
          </p>
          {event.type === 'tip' && (
            /* Rendered as plain text — React escapes it, so no injected markup runs */
            <p className="mt-2 text-sm text-slate-700 bg-acid-200/40 border-2 border-ink/10 rounded-2xl px-4 py-3 whitespace-pre-wrap break-words">
              {event.payload.text}
            </p>
          )}
          <p className="text-xs text-slate-400 mt-1.5">{when}</p>
        </div>
        <button
          type="button"
          onClick={() => onReport(event)}
          title="Report this post"
          className="text-slate-300 hover:text-red-500 transition-colors flex-shrink-0"
        >
          ⚑
        </button>
      </div>
    </div>
  );
}
