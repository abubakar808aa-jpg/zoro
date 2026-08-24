import assert from 'node:assert/strict';
import test from 'node:test';

import {
  authorizeProfessionalInbox,
  decideResponseTransition,
  parseOpportunityResponseBody,
  sanitizeScopeSummary,
  type OpportunityResponse,
} from './opportunity-policy.ts';

test('authorizes only a signed-in worker with a gig profile and preferences', () => {
  assert.deepEqual(authorizeProfessionalInbox(null), { allowed: false, code: 'SIGNED_OUT' });
  assert.deepEqual(authorizeProfessionalInbox({ accountType: 'employer', profileType: 'gig', hasPreferences: true }), {
    allowed: false,
    code: 'PROFESSIONAL_REQUIRED',
  });
  assert.deepEqual(authorizeProfessionalInbox({ accountType: 'worker', profileType: 'professional', hasPreferences: true }), {
    allowed: false,
    code: 'GIG_PROFILE_REQUIRED',
  });
  assert.deepEqual(authorizeProfessionalInbox({ accountType: 'worker', profileType: 'gig', hasPreferences: false }), {
    allowed: false,
    code: 'PREFERENCES_REQUIRED',
  });
  assert.deepEqual(authorizeProfessionalInbox({ accountType: 'worker', profileType: 'gig', hasPreferences: true }), {
    allowed: true,
  });
});

test('redacts exact addresses and contact/access details from customer scope', () => {
  const result = sanitizeScopeSummary(
    'Please come to 123 Main Street, Oakland. Call 415-555-0199 or me@example.com. Gate code 4321.',
  );

  assert.equal(result.includes('123 Main'), false);
  assert.equal(result.includes('415-555'), false);
  assert.equal(result.includes('me@example.com'), false);
  assert.equal(result.includes('4321'), false);
  assert.match(result, /private address removed/);
  assert.match(result, /phone removed/);
  assert.match(result, /email removed/);
  assert.match(result, /access detail removed/);
});

test('creates a response once and treats an identical retry as idempotent', () => {
  const first = decideResponseTransition(null, { decision: 'interested' });
  const existing: OpportunityResponse = {
    decision: 'interested',
    passReason: null,
  };
  const retry = decideResponseTransition(existing, { decision: 'interested' });

  assert.deepEqual(first, { action: 'create', response: existing });
  assert.deepEqual(retry, { action: 'noop', response: existing });
});

test('supports an allowlisted optional pass reason and rejects conflicting changes', () => {
  const pass = decideResponseTransition(null, {
    decision: 'passed',
    passReason: 'SCHEDULE_CONFLICT',
  });
  const conflict = decideResponseTransition(
    { decision: 'passed', passReason: 'SCHEDULE_CONFLICT' },
    { decision: 'interested' },
  );

  assert.deepEqual(pass, {
    action: 'create',
    response: { decision: 'passed', passReason: 'SCHEDULE_CONFLICT' },
  });
  assert.deepEqual(conflict, { action: 'conflict' });
});

test('rejects invalid pass reasons and reasons attached to interest', () => {
  assert.throws(
    () => decideResponseTransition(null, { decision: 'passed', passReason: 'PUNISH_ME' as never }),
    /pass reason/i,
  );
  assert.throws(
    () => decideResponseTransition(null, { decision: 'interested', passReason: 'OTHER' }),
    /interest response/i,
  );
});

test('parses a bounded opportunity response body without relying on content-length', () => {
  assert.deepEqual(parseOpportunityResponseBody('{"decision":"interested"}'), {
    decision: 'interested',
  });
  assert.deepEqual(
    parseOpportunityResponseBody('{"decision":"passed","passReason":"TOO_FAR"}'),
    { decision: 'passed', passReason: 'TOO_FAR' },
  );
});

test('rejects oversized, malformed, and invalid opportunity response bodies', () => {
  assert.throws(() => parseOpportunityResponseBody('x'.repeat(4_097)), /too large/i);
  assert.throws(() => parseOpportunityResponseBody('{nope'), /valid JSON/i);
  assert.throws(
    () => parseOpportunityResponseBody('{"decision":"interested","passReason":"OTHER"}'),
    /interest response/i,
  );
});
