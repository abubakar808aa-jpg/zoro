'use client';

import { formatDistanceToNow } from 'date-fns';
import type { NewsItem } from '@jobman/shared/src/types';

function when(ts: unknown): string {
  const seconds = (ts as { seconds?: number } | null)?.seconds;
  if (!seconds) return '';
  return formatDistanceToNow(new Date(seconds * 1000), { addSuffix: true });
}

// A news item is clearly differentiated from user posts: a "News" badge, the
// source name, and a link out to the original. Only the headline and excerpt
// are shown — never the full article — and the whole card links to the source.
export default function NewsCard({ item }: { item: NewsItem }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="card !p-5 block border-l-4 border-l-primary-400 transition-all hover:-translate-y-1 hover:shadow-pop"
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="badge bg-primary-100 text-primary-700">📰 News</span>
        <span className="text-xs font-semibold text-slate-500">{item.source}</span>
        {item.category && <span className="badge bg-slate-100 text-xs text-slate-500">{item.category}</span>}
        {when(item.publishedAt) && <span className="text-xs text-slate-400">· {when(item.publishedAt)}</span>}
      </div>
      <h3 className="font-display text-lg font-bold leading-snug text-ink">{item.title}</h3>
      {item.excerpt && <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-slate-600">{item.excerpt}</p>}
      <p className="mt-3 text-sm font-bold text-primary-600">Read on {item.source} <span aria-hidden="true">↗</span></p>
    </a>
  );
}
