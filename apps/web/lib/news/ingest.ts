import { createHash } from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { NEWS_FEEDS, MAX_ITEMS_PER_FEED, type NewsFeed } from './feeds';
import { parseFeed } from './parse';

// Deterministic doc id from the canonical URL — dedupes an article that appears
// in more than one feed or across repeated fetches.
function newsId(url: string): string {
  return createHash('sha256').update(url).digest('hex').slice(0, 24);
}

export type NewsIngestResult = {
  feedsChecked: number;
  feedsFailed: number;
  itemsFound: number;
  itemsWritten: number;
  errors: string[];
};

async function fetchFeed(feed: NewsFeed): Promise<string> {
  const res = await fetch(feed.url, {
    headers: { 'user-agent': 'JobManNewsBot/1.0 (+https://jobman.app)', accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' },
    // Never hang the whole run on one slow feed.
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`${feed.name}: HTTP ${res.status}`);
  return res.text();
}

/**
 * Fetch every curated feed, parse the entries, and upsert them into the `news`
 * collection (server-only write). Only headline/excerpt/source/link are stored.
 * A failing feed is logged and skipped — it never aborts the run.
 */
export async function ingestNews(feeds: NewsFeed[] = NEWS_FEEDS): Promise<NewsIngestResult> {
  const db = getAdminDb();
  const now = FieldValue.serverTimestamp();
  const result: NewsIngestResult = { feedsChecked: 0, feedsFailed: 0, itemsFound: 0, itemsWritten: 0, errors: [] };

  // Dedupe within this run so two feeds carrying the same article write once.
  const seen = new Set<string>();
  const writes: { id: string; data: Record<string, unknown> }[] = [];

  for (const feed of feeds) {
    result.feedsChecked++;
    try {
      const entries = parseFeed(await fetchFeed(feed)).slice(0, MAX_ITEMS_PER_FEED);
      result.itemsFound += entries.length;
      for (const entry of entries) {
        const id = newsId(entry.link);
        if (seen.has(id)) continue;
        seen.add(id);
        writes.push({
          id,
          data: {
            title: entry.title,
            excerpt: entry.excerpt,
            source: feed.name,
            sourceUrl: feed.sourceUrl ?? null,
            url: entry.link,
            category: feed.category ?? null,
            publishedAt: Timestamp.fromDate(entry.publishedAt),
            fetchedAt: now,
          },
        });
      }
    } catch (error: any) {
      result.feedsFailed++;
      result.errors.push(error?.message ?? `${feed.name}: fetch failed`);
    }
  }

  // Batch upsert (Firestore batch limit is 500).
  for (let i = 0; i < writes.length; i += 400) {
    const batch = db.batch();
    for (const w of writes.slice(i, i + 400)) {
      batch.set(db.collection('news').doc(w.id), w.data, { merge: true });
    }
    await batch.commit();
    result.itemsWritten += Math.min(400, writes.length - i);
  }

  return result;
}
