import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDataSfQueries, fetchDataSfDemand, normalizeDataSfRows } from './datasf.ts';

test('builds aggregate-only queries without address, coordinates or request IDs', () => {
  const queries = buildDataSfQueries(new Date('2026-08-24T12:00:00Z'));
  for (const query of queries) {
    const decoded = decodeURIComponent(query.url);
    assert.match(decoded, /count\(\*\)/i);
    assert.ok(new URL(query.url).searchParams.get('$group'));
    assert.doesNotMatch(decoded, /address|latitude|longitude|service_request_id/i);
    assert.equal(new URL(query.url).hostname, 'data.sfgov.org');
  }
});

test('normalizes only aggregate categories, broad neighborhoods and counts', () => {
  const rows = normalizeDataSfRows([
    { category: 'Street and Sidewalk Cleaning', neighborhood: 'Mission', demand_count: '42' },
    { category: '', neighborhood: 'Tenderloin', demand_count: '9' },
    { category: 'Plumbing', neighborhood: 'x'.repeat(200), demand_count: '-3', address: 'secret' },
  ], '311');
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { dataset: '311', category: 'Street and Sidewalk Cleaning', neighborhood: 'Mission', count: 42 });
  assert.equal(rows[1].count, 0);
  assert.equal(JSON.stringify(rows).includes('secret'), false);
  assert.equal(rows[1].neighborhood.length, 80);
});

test('reports partial dataset health rather than hiding a failed source', async () => {
  let call = 0;
  const result = await fetchDataSfDemand({
    now: new Date('2026-08-24T12:00:00Z'),
    fetchImpl: async () => {
      call += 1;
      return call === 1 ? Response.json([{ category: 'Graffiti', neighborhood: 'Mission', demand_count: '5' }]) : new Response('down', { status: 503 });
    },
    sleep: async () => undefined,
  });
  assert.equal(result.insights.length, 1);
  assert.equal(result.sources[0].status, 'healthy');
  assert.equal(result.sources[1].status, 'failed');
});
