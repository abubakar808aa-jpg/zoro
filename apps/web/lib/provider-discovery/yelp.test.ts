import assert from 'node:assert/strict';
import test from 'node:test';

import { fetchYelpCandidates, normalizeYelpResponse } from './yelp.ts';

test('normalizes only reviewable business metadata and omits phone and street address', () => {
  const candidates = normalizeYelpResponse({ businesses: [{
    id: 'abc-123', name: 'Bay Plumbers', url: 'https://www.yelp.com/biz/bay-plumbers', rating: 4.8, review_count: 91,
    categories: [{ alias: 'plumbing', title: 'Plumbing' }], location: { city: 'Oakland', state: 'CA', address1: '123 Private St' }, phone: '+14155551212',
  }] }, 'plumbing');
  assert.equal(candidates.length, 1);
  assert.deepEqual(candidates[0].location, { city: 'Oakland', state: 'CA' });
  assert.equal('phone' in candidates[0], false);
  assert.equal(JSON.stringify(candidates[0]).includes('123 Private'), false);
  assert.equal(candidates[0].sourceUrl, 'https://www.yelp.com/biz/bay-plumbers');
});

test('rejects off-domain links and malformed upstream data', () => {
  assert.throws(() => normalizeYelpResponse({ businesses: 'nope' }, 'plumbing'), /valid businesses list/i);
  const candidates = normalizeYelpResponse({ businesses: [{ id: 'x', name: 'Bad', url: 'https://evil.example/biz/x' }] }, 'plumbing');
  assert.equal(candidates.length, 0);
});

test('requires a server-only key before making a request', async () => {
  await assert.rejects(fetchYelpCandidates('plumbing', { apiKey: '', fetchImpl: async () => Response.json({}) }), /not configured/i);
});
