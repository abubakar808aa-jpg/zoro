'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { useAuth } from '@/components/AuthProvider';
import PostComposer from '@/components/PostComposer';
import PostCard from '@/components/PostCard';
import NewsCard from '@/components/NewsCard';
import { Reveal } from '@/components/motion/Reveal';
import {
  getConnectionUids, getFollowing, getFeedPosts, getPublicPosts, getNewsItems, hasLiked,
} from '@/lib/firestore';
import type { Post, NewsItem } from '@jobman/shared/src/types';

type Cursor = QueryDocumentSnapshot<DocumentData> | null;
type TimelineItem = { kind: 'post'; post: Post } | { kind: 'news'; item: NewsItem };

function seconds(ts: unknown): number {
  return (ts as { seconds?: number } | null)?.seconds ?? 0;
}

export default function FeedPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [posts, setPosts] = useState<Post[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const [mode, setMode] = useState<'audience' | 'public'>('public');
  const [postsCursor, setPostsCursor] = useState<Cursor>(null);
  const [newsCursor, setNewsCursor] = useState<Cursor>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/sign-in'); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // Audience: people you're connected to or follow. Fall back to the
        // public stream when you're not connected to anyone yet.
        const [connUids, following] = await Promise.all([
          getConnectionUids(user.uid).catch(() => [] as string[]),
          getFollowing(user.uid).catch(() => []),
        ]);
        const audience = Array.from(new Set([user.uid, ...connUids, ...following.map((f) => f.followedId)]));

        let loadedPosts: Post[];
        let pCursor: Cursor = null;
        if (audience.length > 1) {
          setMode('audience');
          loadedPosts = await getFeedPosts(audience);
        } else {
          setMode('public');
          const page = await getPublicPosts();
          loadedPosts = page.posts;
          pCursor = page.lastDoc;
        }

        const newsPage = await getNewsItems();
        if (cancelled) return;
        setPosts(loadedPosts);
        setPostsCursor(pCursor);
        setNews(newsPage.items);
        setNewsCursor(newsPage.lastDoc);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, authLoading, router]);

  // Resolve which loaded posts the viewer has liked.
  useEffect(() => {
    if (!user || posts.length === 0) return;
    let cancelled = false;
    (async () => {
      const missing = posts.filter((p) => likedMap[p.id] === undefined);
      if (missing.length === 0) return;
      const entries = await Promise.all(missing.map(async (p) => [p.id, await hasLiked(p.id, user.uid).catch(() => false)] as const));
      if (!cancelled) setLikedMap((m) => ({ ...m, ...Object.fromEntries(entries) }));
    })();
    return () => { cancelled = true; };
  }, [user, posts, likedMap]);

  const timeline = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [
      ...posts.map((post) => ({ kind: 'post' as const, post })),
      ...news.map((item) => ({ kind: 'news' as const, item })),
    ];
    items.sort((a, b) => {
      const ta = a.kind === 'post' ? seconds(a.post.createdAt) : seconds(a.item.publishedAt);
      const tb = b.kind === 'post' ? seconds(b.post.createdAt) : seconds(b.item.publishedAt);
      return tb - ta;
    });
    return items;
  }, [posts, news]);

  const hasMore = Boolean(postsCursor || newsCursor);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      if (mode === 'public' && postsCursor) {
        const page = await getPublicPosts(postsCursor);
        setPosts((prev) => [...prev, ...page.posts]);
        setPostsCursor(page.lastDoc);
      }
      if (newsCursor) {
        const page = await getNewsItems(newsCursor);
        setNews((prev) => [...prev, ...page.items]);
        setNewsCursor(page.lastDoc);
      }
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, mode, postsCursor, newsCursor]);

  // Infinite scroll: load the next page when the sentinel enters view.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) loadMore();
    }, { rootMargin: '400px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  if (authLoading || loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-10">
        {[1, 2, 3].map((i) => <div key={i} className="card h-28 animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">The Feed</h1>
        <p className="mt-1 text-slate-500">
          Posts from your network and curated career news, freshest first.
        </p>
      </div>

      <div className="mb-6">
        <PostComposer onPosted={(p) => setPosts((prev) => [p, ...prev])} />
      </div>

      {timeline.length === 0 ? (
        <div className="py-16 text-center text-slate-400">
          <div className="mb-4 text-5xl">📡</div>
          <p className="text-lg font-medium">Your feed is quiet.</p>
          <p className="mt-1 text-sm">Post an update, connect with people, or check back for news.</p>
          <div className="mt-5 flex justify-center gap-2">
            <Link href="/discover" className="btn-secondary text-sm">Find people</Link>
            <Link href="/jobs" className="btn-primary text-sm">Browse jobs</Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {timeline.map((entry, i) => (
            <Reveal key={entry.kind === 'post' ? `p_${entry.post.id}` : `n_${entry.item.id}`} delay={(i % 4) * 0.04}>
              {entry.kind === 'post' ? (
                <PostCard
                  post={entry.post}
                  initialLiked={likedMap[entry.post.id] ?? false}
                  onDeleted={(pid) => setPosts((prev) => prev.filter((x) => x.id !== pid))}
                />
              ) : (
                <NewsCard item={entry.item} />
              )}
            </Reveal>
          ))}

          {hasMore && (
            <div ref={sentinelRef} className="pt-2 text-center">
              <button onClick={loadMore} disabled={loadingMore} className="btn-secondary text-sm disabled:opacity-60">
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
