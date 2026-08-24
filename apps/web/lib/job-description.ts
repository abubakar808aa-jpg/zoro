const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  hellip: '…',
  ldquo: '“',
  lsquo: '‘',
  lt: '<',
  mdash: '—',
  nbsp: ' ',
  ndash: '–',
  quot: '"',
  rdquo: '”',
  rsquo: '’',
};

function decodeEntity(entity: string) {
  const normalized = entity.toLowerCase();
  if (normalized.startsWith('#x')) {
    const codePoint = Number.parseInt(normalized.slice(2), 16);
    if (Number.isFinite(codePoint)) {
      try { return String.fromCodePoint(codePoint); } catch { return `&${entity};`; }
    }
  }
  if (normalized.startsWith('#')) {
    const codePoint = Number.parseInt(normalized.slice(1), 10);
    if (Number.isFinite(codePoint)) {
      try { return String.fromCodePoint(codePoint); } catch { return `&${entity};`; }
    }
  }
  return NAMED_ENTITIES[normalized] ?? `&${entity};`;
}

export function decodeHtmlEntities(content = '') {
  let decoded = content;
  // Some ATS feeds escape already-escaped HTML. A small bounded loop handles
  // both `&lt;p&gt;` and `&amp;lt;p&amp;gt;` without risking an infinite pass.
  for (let pass = 0; pass < 3; pass += 1) {
    const next = decoded.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (_, entity: string) => decodeEntity(entity));
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
}

export function normalizeJobDescription(content = '') {
  return decodeHtmlEntities(content)
    .replace(/<!--[^]*?-->/g, ' ')
    // Drop non-content elements before stripping tags. Ending at `$` is
    // intentional: malformed ATS HTML sometimes never closes these blocks.
    .replace(/<(script|style|noscript|template|iframe|object|embed|svg)\b[^>]*>[^]*?(?:<\/\1>|$)/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n• ')
    .replace(/<\/li>/gi, '')
    .replace(/<\/(p|div|h[1-6]|section|article|ul|ol)>/gi, '\n\n')
    .replace(/<(p|div|h[1-6]|section|article|ul|ol)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
}
