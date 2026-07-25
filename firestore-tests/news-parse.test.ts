import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFeed } from '../apps/web/lib/news/parse.ts';

const RSS = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <title>Example</title>
  <item>
    <title><![CDATA[Hiring is up 5% &amp; rising]]></title>
    <link>https://example.com/a?utm=1</link>
    <description><![CDATA[<p>Lots of <b>jobs</b> out there.</p>]]></description>
    <pubDate>Wed, 02 Oct 2024 13:00:00 GMT</pubDate>
  </item>
  <item>
    <title>No link here</title>
    <description>should be skipped</description>
  </item>
</channel></rss>`;

const ATOM = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Remote work trends</title>
    <link href="https://news.example/atom-1" rel="alternate"/>
    <link href="https://news.example/comments" rel="replies"/>
    <summary>A short summary &lt;here&gt;.</summary>
    <published>2024-09-01T08:00:00Z</published>
  </entry>
</feed>`;

test('parses RSS items, decoding entities and stripping HTML', () => {
  const entries = parseFeed(RSS);
  assert.equal(entries.length, 1); // the link-less item is skipped
  const [item] = entries;
  assert.equal(item.title, 'Hiring is up 5% & rising');
  assert.equal(item.link, 'https://example.com/a?utm=1');
  assert.equal(item.excerpt, 'Lots of jobs out there.');
  assert.ok(item.publishedAt instanceof Date);
  assert.equal(item.publishedAt.getUTCFullYear(), 2024);
});

test('parses Atom entries and prefers the alternate link', () => {
  const entries = parseFeed(ATOM);
  assert.equal(entries.length, 1);
  const [item] = entries;
  assert.equal(item.title, 'Remote work trends');
  assert.equal(item.link, 'https://news.example/atom-1');
  assert.equal(item.excerpt, 'A short summary <here>.');
});

test('returns [] for unrecognized input', () => {
  assert.deepEqual(parseFeed('<html><body>not a feed</body></html>'), []);
});
