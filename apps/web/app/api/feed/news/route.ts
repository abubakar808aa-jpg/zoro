import { NextResponse } from 'next/server';
import type { NewsFeedItem } from '@jobman/shared/src/types';

export const runtime = 'nodejs';
export const revalidate = 3600;
export const dynamic = 'force-dynamic';

type FeedSource = { name: string; url: string };

const DEFAULT_FEEDS: FeedSource[] = [
  { name: 'U.S. Bureau of Labor Statistics', url: 'https://www.bls.gov/feed/bls_latest.rss' },
  { name: 'U.S. Department of Labor', url: 'https://blog.dol.gov/feed' },
];

function configuredFeeds(): FeedSource[] {
  const raw = process.env.NEWS_RSS_FEEDS;
  if (!raw) return DEFAULT_FEEDS;
  try {
    const parsed = JSON.parse(raw) as FeedSource[];
    const valid = parsed.filter(item => item.name?.trim() && /^https:\/\//i.test(item.url));
    return valid.length ? valid.slice(0, 8) : DEFAULT_FEEDS;
  } catch {
    console.warn('[news feed] NEWS_RSS_FEEDS is not valid JSON; using defaults.');
    return DEFAULT_FEEDS;
  }
}

function decodeXml(value = '') {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, ' ')
    .trim();
}

function tag(block: string, names: string[]) {
  for (const name of names) {
    const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'));
    if (match?.[1]) return decodeXml(match[1]);
  }
  return '';
}

function itemLink(block: string) {
  const rssLink = tag(block, ['link']);
  if (/^https?:\/\//i.test(rssLink)) return rssLink;
  const atomLink = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i)?.[1] || '';
  return /^https?:\/\//i.test(atomLink) ? atomLink : '';
}

function stableId(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  return `news_${Math.abs(hash)}`;
}

function parseFeed(xml: string, source: FeedSource): NewsFeedItem[] {
  const blocks = xml.match(/<(item|entry)\b[\s\S]*?<\/\1>/gi) || [];
  return blocks.flatMap(block => {
    const headline = tag(block, ['title']);
    const sourceUrl = itemLink(block);
    if (!headline || !sourceUrl) return [];

    const rawPublishedAt = tag(block, ['pubDate', 'published', 'updated']);
    const parsedDate = rawPublishedAt ? new Date(rawPublishedAt) : new Date(0);
    const publishedAt = Number.isNaN(parsedDate.getTime()) ? new Date(0).toISOString() : parsedDate.toISOString();
    const rawExcerpt = tag(block, ['description', 'summary', 'content:encoded', 'content']);
    const excerpt = rawExcerpt.length > 240 ? `${rawExcerpt.slice(0, 237).trim()}…` : rawExcerpt;

    return [{
      id: stableId(`${source.name}:${sourceUrl}`),
      kind: 'news' as const,
      headline,
      excerpt,
      sourceName: source.name,
      sourceUrl,
      publishedAt,
    }];
  });
}

async function fetchSource(source: FeedSource) {
  try {
    const response = await fetch(source.url, {
      headers: {
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml',
        'User-Agent': 'JobMan/1.0 (+https://jobman.app)',
      },
      next: { revalidate: 3600 },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return parseFeed(await response.text(), source);
  } catch (error) {
    console.error(`[news feed] ${source.name} failed`, error);
    return [];
  }
}

export async function GET() {
  const results = await Promise.all(configuredFeeds().map(fetchSource));
  const news = results.flat()
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .slice(0, 18);
  return NextResponse.json({ news, fetchedAt: new Date().toISOString() });
}
