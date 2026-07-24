'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import FeedCard from '@/components/FeedCard';
import { getFollowing, getFeed, createActivity, reportContent } from '@/lib/firestore';
import type { FeedEvent } from '@jobman/shared/src/types';

const TIP_MAX = 280;

export default function FeedPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingCount, setFollowingCount] = useState(0);
  const [tip, setTip] = useState('');
  const [posting, setPosting] = useState(false);
  const [notice, setNotice] = useState('');

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
      setEvents(await getFeed(following.map(f => f.followedId), user.uid));
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

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">The Feed</h1>
        <p className="text-slate-500 mt-1">
          What&apos;s happening with the {followingCount} {followingCount === 1 ? 'person' : 'people'} you follow
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

      {events.length === 0 ? (
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
          {events.map(e => <FeedCard key={e.id} event={e} onReport={handleReport} />)}
        </div>
      )}
    </div>
  );
}
