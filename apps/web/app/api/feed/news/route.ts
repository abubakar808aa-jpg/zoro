import { NextResponse } from 'next/server';
import type { NewsFeedItem } from '@jobman/shared/src/types';
import { decodeXml, tag } from '@/lib/xml';

export const runtime = 'nodejs';
export const revalidate = 3600;
export const dynamic = 'force-dynamic';

// A news source is either an RSS/Atom feed (the default and the sturdiest path)
// or an HTML page we scrape for article links when the publisher offers no feed.
type RssSource = { name: string; url: string; type?: 'rss' };
type HtmlSource = { name: string; url: string; type: 'html'; linkPattern?: string };
type FeedSource = RssSource | HtmlSource;

const MAX_SOURCES = 8;
const MAX_HTML_ITEMS = 12;

// Free, no-auth career/labor feeds. Government sources are used first because
// they are stable, permissively reusable, and never paywalled.
const DEFAULT_FEEDS: FeedSource[] = [
  { name: 'U.S. Bureau of Labor Statistics', url: 'https://www.bls.gov/feed/bls_latest.rss' },
  { name: 'U.S. Department of Labor', url: 'https://blog.dol.gov/feed' },
  { name: 'BLS Employment Situation', url: 'https://www.bls.gov/feed/empsit.rss' },
  { name: 'BLS Job Openings (JOLTS)', url: 'https://www.bls.gov/feed/jolts.rss' },
  { name: 'Indeed Hiring Lab', url: 'https://www.hiringlab.org/feed/' },
  { name: 'USAGov Jobs & Unemployment', url: 'https://www.usa.gov/rss/updates.xml' },
];

// Optional HTML-scraped sources for publishers without a feed. Empty by default —
// scraping is more fragile than RSS, so operators opt in via NEWS_HTML_SOURCES.
const DEFAULT_HTML_SOURCES: HtmlSource[] = [];

function validSource(item: FeedSource) {
  return Boolean(item?.name?.trim()) && /^https:\/\//i.test(item?.url ?? '');
}

function parseSourceEnv(raw: string | undefined, label: string, asHtml: boolean): FeedSource[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as FeedSource[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(validSource)
      .map(item => (asHtml ? { ...item, type: 'html' as const } : item));
  } catch {
    console.warn(`[news feed] ${label} is not valid JSON; ignoring it.`);
    return [];
  }
}

function configuredFeeds(): FeedSource[] {
  const rss = parseSourceEnv(process.env.NEWS_RSS_FEEDS, 'NEWS_RSS_FEEDS', false);
  const html = parseSourceEnv(process.env.NEWS_HTML_SOURCES, 'NEWS_HTML_SOURCES', true);
  // NEWS_RSS_FEEDS replaces the built-in RSS list (unchanged behavior); HTML
  // sources are additive on top of whichever RSS list is in play.
  const configuredHtml = [...DEFAULT_HTML_SOURCES, ...html].slice(0, MAX_SOURCES);
  // Explicitly configured HTML sources keep their slots: trim the RSS list first
  // so they are never silently dropped by the overall cap.
  const feedList = rss.length ? rss : DEFAULT_FEEDS;
  const rssBudget = Math.max(0, MAX_SOURCES - configuredHtml.length);
  return [...feedList.slice(0, rssBudget), ...configuredHtml];
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

function toIsoDate(raw: string) {
  const parsed = raw ? new Date(raw) : new Date(0);
  return Number.isNaN(parsed.getTime()) ? new Date(0).toISOString() : parsed.toISOString();
}

function trimExcerpt(raw: string) {
  return raw.length > 240 ? `${raw.slice(0, 237).trim()}…` : raw;
}

function newsItem(source: FeedSource, sourceUrl: string, headline: string, excerpt: string, publishedAt: string): NewsFeedItem {
  return {
    id: stableId(`${source.name}:${sourceUrl}`),
    kind: 'news',
    headline,
    excerpt,
    sourceName: source.name,
    sourceUrl,
    publishedAt,
  };
}

function parseFeed(xml: string, source: FeedSource): NewsFeedItem[] {
  const blocks = xml.match(/<(item|entry)\b[\s\S]*?<\/\1>/gi) || [];
  return blocks.flatMap(block => {
    const headline = tag(block, ['title']);
    const sourceUrl = itemLink(block);
    if (!headline || !sourceUrl) return [];

    const publishedAt = toIsoDate(tag(block, ['pubDate', 'published', 'updated']));
    const excerpt = trimExcerpt(tag(block, ['description', 'summary', 'content:encoded', 'content']));
    return [newsItem(source, sourceUrl, headline, excerpt, publishedAt)];
  });
}

// ── HTML scraping ─────────────────────────────────────────────────────────
// Two strategies, best-first. JSON-LD is preferred because most modern news and
// government pages publish structured Article/ItemList metadata, which gives us
// real headlines and dates. The anchor fallback handles plainer pages, but needs
// an operator-supplied linkPattern so we only pick up real article links.

type JsonLdNode = Record<string, unknown>;

const ARTICLE_TYPES = new Set(['NewsArticle', 'Article', 'BlogPosting', 'Report', 'TechArticle']);

function nodeType(node: JsonLdNode): string[] {
  const raw = node['@type'];
  if (typeof raw === 'string') return [raw];
  if (Array.isArray(raw)) return raw.filter((item): item is string => typeof item === 'string');
  return [];
}

// Walk arbitrary JSON-LD (graphs, item lists, nested arrays) collecting article nodes.
function collectArticles(value: unknown, found: JsonLdNode[], depth = 0) {
  if (found.length >= MAX_HTML_ITEMS || depth > 6) return;
  if (Array.isArray(value)) {
    for (const entry of value) collectArticles(entry, found, depth + 1);
    return;
  }
  if (!value || typeof value !== 'object') return;
  const node = value as JsonLdNode;
  if (nodeType(node).some(type => ARTICLE_TYPES.has(type))) found.push(node);
  for (const key of ['@graph', 'itemListElement', 'item', 'mainEntity', 'hasPart']) {
    if (key in node) collectArticles(node[key], found, depth + 1);
  }
}

function asText(value: unknown): string {
  return typeof value === 'string' ? decodeXml(value) : '';
}

function articleUrl(node: JsonLdNode, pageUrl: string): string {
  const raw = node.url ?? node['@id'] ?? (node.mainEntityOfPage as JsonLdNode | undefined)?.['@id'];
  if (typeof raw !== 'string' || !raw) return '';
  try {
    const resolved = new URL(raw, pageUrl);
    return resolved.protocol === 'https:' || resolved.protocol === 'http:' ? resolved.toString() : '';
  } catch {
    return '';
  }
}

function parseJsonLd(html: string, source: FeedSource): NewsFeedItem[] {
  const scripts = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  const articles: JsonLdNode[] = [];
  for (const script of scripts) {
    const body = script.replace(/^[\s\S]*?>/, '').replace(/<\/script>$/i, '').trim();
    if (!body) continue;
    try {
      collectArticles(JSON.parse(body), articles);
    } catch {
      // A single malformed block should not discard the rest of the page.
    }
  }

  const seen = new Set<string>();
  return articles.flatMap(node => {
    const headline = asText(node.headline || node.name);
    const sourceUrl = articleUrl(node, source.url);
    if (!headline || !sourceUrl || seen.has(sourceUrl)) return [];
    seen.add(sourceUrl);
    const publishedAt = toIsoDate(asText(node.datePublished || node.dateModified || node.dateCreated));
    return [newsItem(source, sourceUrl, headline, trimExcerpt(asText(node.description || node.abstract)), publishedAt)];
  }).slice(0, MAX_HTML_ITEMS);
}

function parseAnchors(html: string, source: HtmlSource): NewsFeedItem[] {
  if (!source.linkPattern) return [];
  let pattern: RegExp;
  try {
    pattern = new RegExp(source.linkPattern, 'i');
  } catch {
    console.warn(`[news feed] ${source.name} has an invalid linkPattern; skipping anchor scrape.`);
    return [];
  }

  const anchors = html.match(/<a\b[^>]*href=["'][^"']+["'][^>]*>[\s\S]*?<\/a>/gi) || [];
  const seen = new Set<string>();
  const items: NewsFeedItem[] = [];
  for (const anchor of anchors) {
    if (items.length >= MAX_HTML_ITEMS) break;
    const href = anchor.match(/href=["']([^"']+)["']/i)?.[1];
    if (!href || !pattern.test(href)) continue;
    let sourceUrl: string;
    try {
      const resolved = new URL(href, source.url);
      if (resolved.protocol !== 'https:' && resolved.protocol !== 'http:') continue;
      sourceUrl = resolved.toString();
    } catch {
      continue;
    }
    if (seen.has(sourceUrl)) continue;
    const headline = decodeXml(anchor.replace(/^<a\b[^>]*>/i, '').replace(/<\/a>$/i, ''));
    // Skip nav/chrome links that carry no real headline text.
    if (headline.length < 15) continue;
    seen.add(sourceUrl);
    items.push(newsItem(source, sourceUrl, headline, '', new Date(0).toISOString()));
  }
  return items;
}

function parseHtml(html: string, source: HtmlSource): NewsFeedItem[] {
  const structured = parseJsonLd(html, source);
  return structured.length ? structured : parseAnchors(html, source);
}

async function fetchSource(source: FeedSource) {
  const isHtml = source.type === 'html';
  try {
    const response = await fetch(source.url, {
      headers: {
        Accept: isHtml
          ? 'text/html, application/xhtml+xml'
          : 'application/rss+xml, application/atom+xml, application/xml, text/xml',
        'User-Agent': 'JobMan/1.0 (+https://jobman.app)',
      },
      next: { revalidate: 3600 },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.text();
    return isHtml ? parseHtml(body, source) : parseFeed(body, source);
  } catch (error) {
    console.error(`[news feed] ${source.name} failed`, error);
    return [];
  }
}

export async function GET() {
  const results = await Promise.all(configuredFeeds().map(fetchSource));
  // Drop cross-source duplicates of the same article before sorting.
  const seen = new Set<string>();
  const news = results.flat()
    .filter(item => {
      if (seen.has(item.sourceUrl)) return false;
      seen.add(item.sourceUrl);
      return true;
    })
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .slice(0, 18);
  return NextResponse.json({ news, fetchedAt: new Date().toISOString() });
}
