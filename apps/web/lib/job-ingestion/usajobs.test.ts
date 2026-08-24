import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { fetchUsaJobs, normalizeUsaJobsResponse, UsaJobsConnectorError } from './usajobs.ts';

const source = { sourceKey: 'bay-area', companyName: 'U.S. Federal Government', keyword: 'technology', location: 'San Francisco, California' };

test('normalizes USAJOBS records and preserves official source and application links', async () => {
  const payload = JSON.parse(await readFile(new URL('./fixtures/usajobs/valid.json', import.meta.url), 'utf8'));
  const result = normalizeUsaJobsResponse(payload, source);
  assert.equal(result.total, 2);
  assert.equal(result.jobs.length, 2);
  assert.equal(result.jobs[0].sourceProvider, 'usajobs');
  assert.equal(result.jobs[0].postedByName, 'General Services Administration');
  assert.equal(result.jobs[0].applyUrl, 'https://apply.usajobs.gov/Application/Index/1245');
  assert.equal(result.jobs[0].sourceUrl, 'https://www.usajobs.gov/job/1245');
  assert.deepEqual(result.jobs[0].salary, { min: 108245, max: 167336, period: 'annual' });
  assert.equal(result.jobs[0].sourceMetadata?.federal, true);
  assert.equal(result.jobs[1].applyUrl, 'https://www.usajobs.gov/job/1246');
  assert.equal(result.jobs[1].remote, true);
});

test('requires server credentials and does not leak their values in errors', async () => {
  await assert.rejects(
    fetchUsaJobs(source, { apiKey: '', userAgent: '', fetchImpl: async () => new Response('{}') }),
    (error: unknown) => error instanceof UsaJobsConnectorError && error.code === 'MISSING_CONFIGURATION' && !error.message.includes('secret'),
  );
});

test('caps pagination and retries a rate-limited page', async () => {
  const payload = JSON.parse(await readFile(new URL('./fixtures/usajobs/valid.json', import.meta.url), 'utf8'));
  payload.SearchResult.SearchResultCountAll = 900;
  const requestedPages: string[] = [];
  let calls = 0;
  const jobs = await fetchUsaJobs(source, {
    apiKey: 'test-key',
    userAgent: 'test@example.com',
    maxPages: 2,
    fetchImpl: async input => {
      requestedPages.push(String(input));
      calls += 1;
      if (calls === 1) return new Response('slow down', { status: 429, headers: { 'Retry-After': '0' } });
      return Response.json(payload);
    },
    sleep: async () => undefined,
  });
  assert.equal(calls, 3);
  assert.equal(jobs.length, 2);
  assert.equal(requestedPages.filter(url => new URL(url).searchParams.get('Page') === '1').length, 2);
  assert.equal(requestedPages.filter(url => new URL(url).searchParams.get('Page') === '2').length, 1);
});

test('rejects malformed upstream shapes', () => {
  assert.throws(() => normalizeUsaJobsResponse({ SearchResult: { SearchResultItems: 'nope' } }, source), /valid search result/i);
});
