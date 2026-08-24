import assert from 'node:assert/strict';
import test from 'node:test';

import { deduplicateNews, parseNewsFeed, type NewsSource } from './news.ts';

const source: NewsSource = {
  id: 'bls',
  name: 'U.S. Bureau of Labor Statistics',
  url: 'https://www.bls.gov/feed/bls_latest.rss',
  allowedHosts: ['bls.gov'],
};

test('parses RSS headlines, short text, canonical links and economic categories', () => {
  const items = parseNewsFeed(`<?xml version="1.0"?><rss><channel><item>
    <title>Employment and wages rise</title>
    <link>https://www.bls.gov/news.release/test.htm?utm_source=rss#top</link>
    <description><![CDATA[<p>Payroll employment changed while wages increased.</p><script>alert(1)</script>]]></description>
    <pubDate>Fri, 21 Aug 2026 12:00:00 GMT</pubDate>
  </item></channel></rss>`, source, new Date('2026-08-21T13:00:00Z'));
  assert.equal(items.length, 1);
  assert.equal(items[0].sourceUrl, 'https://www.bls.gov/news.release/test.htm');
  assert.equal(items[0].excerpt.includes('<'), false);
  assert.equal(items[0].excerpt.includes('alert'), false);
  assert.equal(items[0].category, 'employment');
  assert.equal(items[0].stale, false);
});

test('supports Atom links and rejects non-HTTPS or off-domain destinations', () => {
  const atom = `<?xml version="1.0"?><feed><entry><title>Rates update</title><link href="https://www.bls.gov/rates"/><summary>Interest rate facts.</summary><updated>2026-08-20T12:00:00Z</updated></entry><entry><title>Bad</title><link href="http://localhost/private"/></entry></feed>`;
  const items = parseNewsFeed(atom, source);
  assert.equal(items.length, 1);
  assert.equal(items[0].sourceUrl, 'https://www.bls.gov/rates');
  assert.equal(items[0].category, 'interest_rates');
});

test('upgrades legacy HTTP links only for the allowlisted official host', () => {
  const items = parseNewsFeed('<rss><channel><item><title>Wage recovery</title><link>http://www.bls.gov/release</link><description>Workers received back pay.</description><pubDate>Fri, 21 Aug 2026 12:00:00 GMT</pubDate></item></channel></rss>', source);
  assert.equal(items[0].sourceUrl, 'https://www.bls.gov/release');
});

test('rejects active entities and malformed XML', () => {
  assert.throws(() => parseNewsFeed('<!DOCTYPE rss [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><rss/>', source), /forbidden/i);
  assert.throws(() => parseNewsFeed('<rss><channel><item></rss>', source), /malformed/i);
});

test('deduplicates by canonical URL and by normalized headline plus date', () => {
  const base = {
    id: 'one', kind: 'news' as const, headline: 'Jobs report: August', excerpt: 'A', sourceName: 'BLS', sourceUrl: 'https://www.bls.gov/a', publishedAt: '2026-08-20T00:00:00.000Z', category: 'employment' as const,
  };
  const unique = deduplicateNews([
    base,
    { ...base, id: 'two', sourceUrl: 'https://www.bls.gov/a?utm_source=x' },
    { ...base, id: 'three', sourceUrl: 'https://www.bls.gov/b', headline: ' Jobs report — August ' },
    { ...base, id: 'four', sourceUrl: 'https://www.bls.gov/c', publishedAt: '2026-08-21T00:00:00.000Z' },
  ]);
  assert.equal(unique.length, 2);
});
