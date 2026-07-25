// A small, dependency-free RSS 2.0 / Atom parser. It extracts only what the
// news card needs — title, link, a short excerpt, and a publish date — never
// the full article body. Tolerant of CDATA, namespaced tags, and either feed
// dialect; anything it can't parse is skipped rather than throwing.

export type ParsedNewsEntry = {
  title: string;
  link: string;
  excerpt: string;
  publishedAt: Date;
};

function firstMatch(block: string, tags: string[]): string | undefined {
  for (const tag of tags) {
    // <tag ...>value</tag> — namespaced variants (e.g. dc:date) allowed.
    const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i');
    const m = block.match(re);
    if (m) return m[1];
  }
  return undefined;
}

// Atom links are attributes: <link href="..." rel="alternate"/>. Prefer the
// alternate (or unspecified) rel over enclosures/self.
function atomLink(block: string): string | undefined {
  const links = Array.from(block.matchAll(/<link\b([^>]*)\/?>/gi));
  let fallback: string | undefined;
  for (const [, attrs] of links) {
    const href = attrs.match(/href\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    const rel = attrs.match(/rel\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!rel || rel === 'alternate') return href;
    fallback ??= href;
  }
  return fallback;
}

function stripCdata(value: string): string {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&nbsp;': ' ',
};

function decodeEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&[a-z]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m);
}

function toText(raw: string | undefined): string {
  if (!raw) return '';
  return decodeEntities(stripCdata(raw).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function excerptFrom(raw: string | undefined, max = 280): string {
  const text = toText(raw);
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function parseDate(raw: string | undefined): Date {
  if (!raw) return new Date();
  const d = new Date(stripCdata(raw));
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

/**
 * Parse a raw RSS/Atom document into entries. Returns [] for unrecognized input.
 */
export function parseFeed(xml: string): ParsedNewsEntry[] {
  // RSS uses <item>, Atom uses <entry>.
  const blocks = [
    ...Array.from(xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)),
    ...Array.from(xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)),
  ].map((m) => m[0]);

  const entries: ParsedNewsEntry[] = [];
  for (const block of blocks) {
    const title = toText(firstMatch(block, ['title']));
    // RSS: <link>url</link>; Atom: <link href="url"/>.
    const rawLink = firstMatch(block, ['link']);
    const link = (rawLink && !/href\s*=/.test(block.slice(block.indexOf('<link'), block.indexOf('<link') + 200))
      ? toText(rawLink)
      : atomLink(block)) || toText(rawLink);
    if (!title || !link || !/^https?:\/\//i.test(link)) continue;

    const excerpt = excerptFrom(firstMatch(block, ['description', 'summary', 'content:encoded', 'content']));
    const publishedAt = parseDate(firstMatch(block, ['pubDate', 'published', 'updated', 'dc:date']));
    entries.push({ title, link, excerpt, publishedAt });
  }
  return entries;
}
