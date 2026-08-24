import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { fetchTheMuseJobs, normalizeTheMuseResponse } from './themuse.ts';

const source = { sourceKey: 'bay-area-services', companyName: 'The Muse marketplace', category: 'Installation, Maintenance, and Repairs', location: 'San Francisco, CA' };

test('normalizes The Muse public API and labels its landing page as an external source', async () => {
  const payload = JSON.parse(await readFile(new URL('./fixtures/themuse/valid.json', import.meta.url), 'utf8'));
  const result = normalizeTheMuseResponse(payload, source);
  assert.equal(result.pageCount, 2);
  assert.equal(result.jobs[0].postedByName, 'Fixit Co');
  assert.equal(result.jobs[0].sourceProvider, 'themuse');
  assert.equal(result.jobs[0].sourceUrl, 'https://www.themuse.com/jobs/fixit/field-service-technician');
  assert.equal(result.jobs[0].applyUrl, 'https://www.themuse.com/jobs/fixit/field-service-technician');
  assert.equal(result.jobs[0].sourceMetadata?.applyDestination, 'source');
  assert.match(result.jobs[0].description, /• Install equipment/);
  assert.equal(result.jobs[0].description.includes('<'), false);
});

test('caps pages, deduplicates IDs and includes an optional server API key', async () => {
  const payload = JSON.parse(await readFile(new URL('./fixtures/themuse/valid.json', import.meta.url), 'utf8'));
  payload.page_count = 99;
  const urls: URL[] = [];
  const jobs = await fetchTheMuseJobs(source, {
    apiKey: 'server-key',
    maxPages: 2,
    fetchImpl: async input => { urls.push(new URL(String(input))); return Response.json(payload); },
  });
  assert.equal(urls.length, 2);
  assert.equal(jobs.length, 1);
  assert.equal(urls[0].searchParams.get('api_key'), 'server-key');
  assert.equal(urls[1].searchParams.get('page'), '1');
});

test('rejects malformed responses and unsafe landing URLs', async () => {
  assert.throws(() => normalizeTheMuseResponse({ results: 'nope' }, source), /valid paginated result/i);
  const payload = JSON.parse(await readFile(new URL('./fixtures/themuse/valid.json', import.meta.url), 'utf8'));
  payload.results[0].refs.landing_page = 'http://localhost/admin';
  assert.equal(normalizeTheMuseResponse(payload, source).jobs.length, 0);
});
