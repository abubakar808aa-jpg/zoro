import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  PersonioConnectorError,
  fetchPersonioJobs,
  parsePersonioXml,
  personioFeedUrl,
  type PersonioSource,
} from './personio.ts';

const source: PersonioSource = {
  sourceKey: 'acme',
  companyName: 'Acme',
  careersUrl: 'https://acme.example/careers',
  language: 'en',
};

function fixture(name: string) {
  return readFile(new URL(`./fixtures/personio/${name}.xml`, import.meta.url), 'utf8');
}

test('normalizes the official Personio XML contract and canonical external links', async () => {
  const jobs = parsePersonioXml(await fixture('valid'), source);

  assert.equal(jobs.length, 2);
  assert.deepEqual(
    {
      id: jobs[0].id,
      documentId: jobs[0].sourceDocumentId,
      title: jobs[0].title,
      location: jobs[0].location,
      type: jobs[0].type,
      provider: jobs[0].sourceProvider,
      sourceUrl: jobs[0].sourceUrl,
      applyUrl: jobs[0].applyUrl,
    },
    {
      id: '4103',
      documentId: 'personio_acme_4103',
      title: 'Platform Engineer',
      location: 'San Francisco',
      type: 'fulltime',
      provider: 'personio',
      sourceUrl: 'https://acme.jobs.personio.de/job/4103',
      applyUrl: 'https://acme.jobs.personio.de/job/4103',
    },
  );
  assert.match(jobs[0].description, /What you will do/);
  assert.match(jobs[0].description, /• Ship safely/);
  assert.equal(jobs[0].description.includes('<'), false);
  assert.equal(jobs[0].rawProviderData?.id, '4103');
  assert.equal(jobs[1].type, 'parttime');
  assert.equal(jobs[1].remote, true);
});

test('returns an empty list for a valid empty feed', async () => {
  assert.deepEqual(parsePersonioXml(await fixture('empty'), source), []);
});

test('represents an expired posting as absent so the shared lifecycle can count a successful miss', async () => {
  assert.deepEqual(parsePersonioXml(await fixture('expired'), source), []);
});

test('rejects malformed XML and active entity declarations', async () => {
  const malformedXml = await fixture('malformed');
  assert.throws(
    () => parsePersonioXml(malformedXml, source),
    (error: unknown) => error instanceof PersonioConnectorError && error.code === 'INVALID_XML',
  );
  assert.throws(
    () => parsePersonioXml('<!DOCTYPE jobs [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><workzag-jobs/>', source),
    (error: unknown) => error instanceof PersonioConnectorError && error.code === 'UNSAFE_XML',
  );
  assert.throws(
    () => parsePersonioXml('<html><body>Not a Personio feed</body></html>', source),
    (error: unknown) => error instanceof PersonioConnectorError && error.code === 'INVALID_XML',
  );
});

test('deduplicates repeated source IDs within the complete, non-paginated feed', async () => {
  const jobs = parsePersonioXml(await fixture('duplicate'), source);

  assert.equal(jobs.length, 1);
  assert.match(jobs[0].description, /Updated copy/);
});

test('validates tenant and language before constructing the official feed URL', () => {
  assert.equal(personioFeedUrl(source), 'https://acme.jobs.personio.de/xml?language=en');
  assert.throws(() => personioFeedUrl({ ...source, sourceKey: 'evil.example.com' }), /unsupported characters/i);
  assert.throws(() => personioFeedUrl({ ...source, language: 'xx' as 'en' }), /unsupported language/i);
});

test('retries a rate-limited response once and does not paginate the full XML feed', async () => {
  const xml = await fixture('valid');
  const requests: string[] = [];
  const responses = [
    new Response('slow down', { status: 429, headers: { 'Retry-After': '0' } }),
    new Response(xml, { status: 200, headers: { 'Content-Type': 'application/xml' } }),
  ];

  const jobs = await fetchPersonioJobs(source, {
    fetchImpl: async input => {
      requests.push(String(input));
      return responses.shift()!;
    },
    sleep: async () => undefined,
  });

  assert.equal(jobs.length, 2);
  assert.equal(requests.length, 2);
  assert.equal(new Set(requests).size, 1);
});

test('reports exhausted transient failures with structured status details', async () => {
  await assert.rejects(
    fetchPersonioJobs(source, {
      fetchImpl: async () => new Response('upstream down', { status: 503 }),
      sleep: async () => undefined,
      maxAttempts: 2,
    }),
    (error: unknown) => error instanceof PersonioConnectorError
      && error.code === 'UPSTREAM_ERROR'
      && error.status === 503
      && error.retryable,
  );
});
