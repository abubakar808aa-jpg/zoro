import assert from 'node:assert/strict';
import test from 'node:test';

import { validateInteractionEvent } from './analytics-contract.ts';

test('accepts only the minimal job click payload', () => {
  assert.deepEqual(
    validateInteractionEvent({ type: 'job_apply_click', jobId: 'greenhouse_figma_6113161004' }),
    { ok: true, event: { type: 'job_apply_click', jobId: 'greenhouse_figma_6113161004' } },
  );
  assert.equal(validateInteractionEvent({ type: 'job_apply_click', jobId: '' }).ok, false);
  assert.equal(validateInteractionEvent({ type: 'job_apply_click', jobId: 'job', token: 'secret' }).ok, false);
});

test('accepts a minimal news click without a full source URL', () => {
  assert.deepEqual(
    validateInteractionEvent({ type: 'news_open', newsId: 'news_123456', sourceName: 'U.S. Department of Labor' }),
    {
      ok: true,
      event: { type: 'news_open', newsId: 'news_123456', sourceName: 'U.S. Department of Labor' },
    },
  );
});

test('rejects malformed, oversized, and privacy-heavy news payloads', () => {
  assert.equal(validateInteractionEvent({ type: 'news_open', newsId: 'bad id', sourceName: 'BLS' }).ok, false);
  assert.equal(validateInteractionEvent({ type: 'news_open', newsId: 'news_1', sourceName: 'x'.repeat(121) }).ok, false);
  assert.equal(validateInteractionEvent({
    type: 'news_open',
    newsId: 'news_1',
    sourceName: 'BLS',
    sourceUrl: 'https://example.com/article?token=secret',
  }).ok, false);
});

test('rejects arrays, null, and unsupported event types', () => {
  assert.equal(validateInteractionEvent(null).ok, false);
  assert.equal(validateInteractionEvent([]).ok, false);
  assert.equal(validateInteractionEvent({ type: 'profile_open', profileId: 'abc' }).ok, false);
});
