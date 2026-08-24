import { XMLParser, XMLValidator } from 'fast-xml-parser';
import type { NewsFeedItem } from '@jobman/shared/src/types';
import { normalizeJobDescription } from '../job-description.ts';

const MAX_FEED_BYTES = 2_000_000;
const MAX_ITEMS_PER_SOURCE = 30;
const STALE_AFTER_MS = 14 * 24 * 60 * 60 * 1_000;

export type NewsSource = {
  id: 'bls' | 'federal_reserve' | 'census' | 'dol';
  name: string;
  url: string;
  allowedHosts: string[];
};

export type NewsSourceHealth = {
  id: NewsSource['id'];
  name: string;
  status: 'healthy' | 'empty' | 'failed';
  itemsFound: number;
  checkedAt: string;
  durationMs: number;
  error?: string;
};

export const OFFICIAL_NEWS_SOURCES: NewsSource[] = [
  { id: 'bls', name: 'U.S. Bureau of Labor Statistics', url: 'https://www.bls.gov/feed/bls_latest.rss', allowedHosts: ['bls.gov'] },
  { id: 'federal_reserve', name: 'Federal Reserve Board', url: 'https://www.federalreserve.gov/feeds/press_all.xml', allowedHosts: ['federalreserve.gov'] },
  { id: 'census', name: 'U.S. Census Bureau', url: 'https://www.census.gov/economic-indicators/indicator.xml', allowedHosts: ['census.gov'] },
  { id: 'dol', name: 'U.S. Department of Labor', url: 'https://www.dol.gov/rss/releases.xml', allowedHosts: ['dol.gov'] },
];

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function asArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function text(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  const item = asRecord(value);
  return item ? text(item['#text'] ?? item.__cdata) : '';
}

function canonicalUrl(value: unknown, allowedHosts: string[]) {
  try {
    const url = new URL(text(value));
    const allowed = allowedHosts.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`));
    if (!allowed || !['http:', 'https:'].includes(url.protocol)) return '';
    // Some official government RSS feeds still emit http links even though
    // their public pages support HTTPS. Upgrade only after the host allowlist.
    url.protocol = 'https:';
    url.hash = '';
    for (const key of Array.from(url.searchParams.keys())) {
      if (/^(utm_|fbclid|gclid)/i.test(key)) url.searchParams.delete(key);
    }
    return url.toString();
  } catch {
    return '';
  }
}

function linkFrom(item: Record<string, unknown>, source: NewsSource) {
  const direct = canonicalUrl(item.link, source.allowedHosts);
  if (direct) return direct;
  for (const candidate of asArray(item.link)) {
    const record = asRecord(candidate);
    const url = canonicalUrl(record?.['@_href'], source.allowedHosts);
    if (url && (!record?.['@_rel'] || record['@_rel'] === 'alternate')) return url;
  }
  return canonicalUrl(item.guid, source.allowedHosts);
}

function stableId(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return `news_${(hash >>> 0).toString(36)}`;
}

export function classifyNews(value: string): NewsFeedItem['category'] {
  const textValue = value.toLowerCase();
  if (/california|san francisco|bay area/.test(textValue)) return 'california_bay_area';
  if (/payroll|employment|unemployment|jobless|jobs?\b|labor market/.test(textValue)) return 'employment';
  if (/wage|earnings|compensation|pay\b/.test(textValue)) return 'wages';
  if (/inflation|consumer price|producer price|cpi\b|ppi\b/.test(textValue)) return 'inflation';
  if (/interest rate|federal funds|monetary policy|fomc/.test(textValue)) return 'interest_rates';
  if (/housing|home sales|residential/.test(textValue)) return 'housing';
  if (/construction|building permit/.test(textValue)) return 'construction';
  if (/small business|entrepreneur/.test(textValue)) return 'small_business';
  return 'economy';
}

export function parseNewsFeed(xml: string, source: NewsSource, checkedAt = new Date()): NewsFeedItem[] {
  if (new TextEncoder().encode(xml).byteLength > MAX_FEED_BYTES) throw new Error('News feed exceeded the 2 MB safety limit.');
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('News feed contained a forbidden document or entity declaration.');
  if (XMLValidator.validate(xml) !== true) throw new Error('News feed returned malformed XML.');
  const parsed = new XMLParser({ ignoreAttributes: false, parseTagValue: false, trimValues: true, processEntities: false }).parse(xml) as Record<string, unknown>;
  const rssChannel = asRecord(asRecord(parsed.rss)?.channel);
  const atomFeed = asRecord(parsed.feed);
  const rawItems = rssChannel ? asArray(rssChannel.item) : atomFeed ? asArray(atomFeed.entry) : [];
  return rawItems.slice(0, MAX_ITEMS_PER_SOURCE).flatMap(raw => {
    const item = asRecord(raw);
    if (!item) return [];
    const headline = normalizeJobDescription(text(item.title)).slice(0, 300);
    const sourceUrl = linkFrom(item, source);
    if (!headline || !sourceUrl) return [];
    const rawDate = text(item.pubDate ?? item.published ?? item.updated ?? item['dc:date']);
    const date = new Date(rawDate);
    if (Number.isNaN(date.getTime())) return [];
    const rawExcerpt = text(item.description ?? item.summary ?? item['content:encoded'] ?? item.content);
    const cleanExcerpt = normalizeJobDescription(rawExcerpt);
    const excerpt = cleanExcerpt.length > 280 ? `${cleanExcerpt.slice(0, 277).trim()}…` : cleanExcerpt;
    return [{
      id: stableId(`${source.id}:${sourceUrl}`),
      kind: 'news' as const,
      headline,
      excerpt,
      sourceName: source.name,
      sourceUrl,
      publishedAt: date.toISOString(),
      category: classifyNews(`${headline} ${excerpt}`),
      checkedAt: checkedAt.toISOString(),
      stale: checkedAt.getTime() - date.getTime() > STALE_AFTER_MS,
    }];
  });
}

function normalizedHeadline(value: string) {
  return value.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function deduplicateNews(items: NewsFeedItem[]) {
  const urls = new Set<string>();
  const headlines = new Set<string>();
  return items.filter(item => {
    const url = canonicalUrl(item.sourceUrl, [new URL(item.sourceUrl).hostname]);
    const day = item.publishedAt.slice(0, 10);
    const headlineDate = `${normalizedHeadline(item.headline)}:${day}`;
    if (urls.has(url) || headlines.has(headlineDate)) return false;
    urls.add(url);
    headlines.add(headlineDate);
    return true;
  });
}

async function fetchOne(source: NewsSource, fetchImpl: typeof fetch, timeoutMs: number) {
  const started = Date.now();
  const checkedAt = new Date();
  try {
    let response: Response | undefined;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      response = await fetchImpl(source.url, {
        headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml', 'User-Agent': 'JobMan/1.0 (+https://jobman.app)' },
        signal: AbortSignal.timeout(timeoutMs),
        next: { revalidate: 3600 },
      });
      if (response.ok) break;
      if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 3) throw new Error(`HTTP ${response.status}`);
      await new Promise(resolve => setTimeout(resolve, 200 * 2 ** (attempt - 1)));
    }
    const items = parseNewsFeed(await response!.text(), source, checkedAt);
    return { items, health: { id: source.id, name: source.name, status: items.length ? 'healthy' : 'empty', itemsFound: items.length, checkedAt: checkedAt.toISOString(), durationMs: Date.now() - started } satisfies NewsSourceHealth };
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : 'Unknown feed error';
    console.error(JSON.stringify({ event: 'news_source_failed', source: source.id, error }));
    return { items: [], health: { id: source.id, name: source.name, status: 'failed', itemsFound: 0, checkedAt: checkedAt.toISOString(), durationMs: Date.now() - started, error } satisfies NewsSourceHealth };
  }
}

export async function fetchOfficialNews(options: { fetchImpl?: typeof fetch; timeoutMs?: number; sources?: NewsSource[] } = {}) {
  const results = await Promise.all((options.sources ?? OFFICIAL_NEWS_SOURCES).map(source => fetchOne(source, options.fetchImpl ?? fetch, options.timeoutMs ?? 10_000)));
  const news = deduplicateNews(results.flatMap(result => result.items))
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .slice(0, 40);
  return { news, sources: results.map(result => result.health), fetchedAt: new Date().toISOString() };
}
