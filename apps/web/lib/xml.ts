// Tiny, dependency-free helpers for pulling text out of XML/HTML fragments with
// regexes. Shared by the RSS/Atom news parser (app/api/feed/news) and the
// Personio job connector (lib/job-ingestion/personio), both of which read small,
// well-formed feed documents. This is deliberately not a full XML parser — it
// only needs to survive real-world feeds, not arbitrary markup.

// Strip CDATA wrappers and tags, decode the common entities, and collapse
// whitespace to a single clean line of text.
export function decodeXml(value = '') {
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

// Return the decoded text content of the first matching tag from `names`.
export function tag(block: string, names: string[]) {
  for (const name of names) {
    const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'));
    if (match?.[1]) return decodeXml(match[1]);
  }
  return '';
}

// Return every `<tagName>…</tagName>` block (full element, including its tags) as
// a raw string — used to iterate repeating records like <item>, <entry>, or
// <position>.
export function extractBlocks(xml: string, tagName: string): string[] {
  return xml.match(new RegExp(`<${tagName}\\b[\\s\\S]*?<\\/${tagName}>`, 'gi')) ?? [];
}
