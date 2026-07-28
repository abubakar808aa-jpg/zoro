'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import FeedCard from '@/components/FeedCard';
import Reveal from '@/components/Reveal';
import { getFollowing, getFeed, createActivity, reportContent } from '@/lib/firestore';
import type { FeedEvent, NewsFeedItem } from '@jobman/shared/src/types';

const TIP_MAX = 280;

function eventTime(value: unknown) {
  if (value && typeof value === 'object' && 'toMillis' in value) {
    return Number((value as { toMillis: () => number }).toMillis());
  }
  if (value && typeof value === 'object' && 'seconds' in value) {
    return Number((value as { seconds: number }).seconds) * 1_000;
  }
  const parsed = Date.parse(String(value || ''));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function NewsCard({ item }: { item: NewsFeedItem }) {
  return (
    <article className="relative overflow-hidden rounded-3xl border-2 border-ink bg-[#f4edff] p-5 shadow-pop-sm transition duration-300 hover:-translate-y-1 hover:shadow-pop">
      <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-acid-300/60 blur-2xl" />
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <span className="sticker bg-acid-300 text-ink">News, no doomscroll</span>
          <span className="text-xs font-bold uppercase tracking-wider text-primary-700">{item.sourceName}</span>
        </div>
        <h2 className="mt-5 font-display text-xl font-bold leading-snug text-ink">{item.headline}</h2>
        {item.excerpt && <p className="mt-3 text-sm leading-6 text-slate-600">{item.excerpt}</p>}
        <div className="mt-5 border-t border-ink/10 pt-4 text-right">
          <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-display text-sm font-bold text-ink hover:text-primary-700">
            Read at the original source ↗
          </a>
        </div>
      </div>
    </article>
  );
}

export default function FeedPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [news, setNews] = useState<NewsFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingCount, setFollowingCount] = useState(0);
  const [tip, setTip] = useState('');
  const [posting, setPosting] = useState(false);
  const [notice, setNotice] = useState('');
  const [visibleCount, setVisibleCount] = useState(10);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/sign-in'); return; }
    loadFeed();
  }, [user, authLoading]);

  async function loadFeed() {
    if (!user) return;
    setLoading(true);
    try {
      const following = await getFollowing(user.uid);
      setFollowingCount(following.length);
      const [feedEvents, newsResponse] = await Promise.all([
        getFeed(following.map(f => f.followedId), user.uid),
        fetch('/api/feed/news').then(response => response.ok ? response.json() : { news: [] }),
      ]);
      setEvents(feedEvents);
      setNews(newsResponse.news || []);
    } finally {
      setLoading(false);
    }
  }

  async function handlePostTip() {
    if (!user || !tip.trim() || posting) return;
    setPosting(true);
    try {
      await createActivity({
        actorId: user.uid,
        actorName: user.displayName ?? 'Someone',
        actorPhoto: user.photoURL ?? '',
        type: 'tip',
        payload: { text: tip.trim().slice(0, TIP_MAX) },
      });
      setTip('');
      setNotice('Tip posted! 🎉');
      setTimeout(() => setNotice(''), 3000);
      await loadFeed();
    } finally {
      setPosting(false);
    }
  }

  async function handleReport(event: FeedEvent) {
    if (!user) return;
    const reason = window.prompt('Why are you reporting this post?');
    if (!reason?.trim()) return;
    await reportContent({
      targetType: 'activity',
      targetId: event.id,
      reporterId: user.uid,
      reason: reason.trim(),
    });
    setNotice('Report submitted — our team will take a look.');
    setTimeout(() => setNotice(''), 3000);
  }

  if (authLoading || loading) return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-4">
      {[1, 2, 3].map(i => <div key={i} className="card animate-pulse h-28" />)}
    </div>
  );

  const stream = [
    ...events.map(item => ({ kind: 'activity' as const, item, time: eventTime(item.createdAt) })),
    ...news.map(item => ({ kind: 'news' as const, item, time: eventTime(item.publishedAt) })),
  ].sort((a, b) => b.time - a.time);

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">Career tea. Zero corporate fog.</h1>
        <p className="text-slate-500 mt-1">
          Updates from {followingCount} {followingCount === 1 ? 'person' : 'people'} you follow, plus useful career news from the original publishers
        </p>
      </div>

      {notice && (
        <div className="sticker bg-acid-300 mb-5">{notice}</div>
      )}

      {/* Share a tip */}
      <div className="card !p-5 mb-6">
        <p className="font-display font-bold text-ink text-sm mb-2">💡 Share a career tip</p>
        <textarea
          value={tip}
          onChange={e => setTip(e.target.value.slice(0, TIP_MAX))}
          rows={2}
          className="input resize-none"
          placeholder="Salary negotiation tricks, interview wins, side hustle ideas…"
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-slate-400">{tip.length}/{TIP_MAX}</span>
          <button type="button" onClick={handlePostTip} disabled={posting || !tip.trim()} className="btn-primary text-sm">
            {posting ? 'Posting…' : 'Post it'}
          </button>
        </div>
      </div>

      {stream.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <div className="text-5xl mb-4">📡</div>
          <p className="text-lg font-medium">Your feed is quiet.</p>
          <p className="text-sm mt-1">Follow workers and employers to see their activity here.</p>
          <div className="flex justify-center gap-2 mt-5">
            <Link href="/gigs" className="btn-secondary text-sm">Browse Gig Workers</Link>
            <Link href="/professionals" className="btn-primary text-sm">Browse Professionals</Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {stream.slice(0, visibleCount).map((entry, index) => (
            <Reveal key={`${entry.kind}-${entry.item.id}`} delay={(index % 4) * 45}>
              {entry.kind === 'activity'
                ? <FeedCard event={entry.item} onReport={handleReport} />
                : <NewsCard item={entry.item} />}
            </Reveal>
          ))}
          {visibleCount < stream.length && (
            <button onClick={() => setVisibleCount(count => count + 10)} className="motion-cta motion-cta-outline w-full rounded-2xl px-5 py-3 font-display font-bold text-ink">
              Load more useful stuff <span className="cta-arrow">↓</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
