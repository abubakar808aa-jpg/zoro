import assert from 'node:assert/strict';
import test from 'node:test';

import { connectorGateStatus, executePartnerAdapter } from './partner-adapters.ts';

test('keeps Taskrabbit and Upwork disabled even when placeholder credentials exist', () => {
  const statuses = connectorGateStatus({ TASKRABBIT_PARTNER_TOKEN: 'x', UPWORK_CLIENT_SECRET: 'x' });
  assert.equal(statuses.find(item => item.id === 'taskrabbit')?.enabled, false);
  assert.equal(statuses.find(item => item.id === 'upwork')?.enabled, false);
  assert.equal(statuses.find(item => item.id === 'taskrabbit')?.reason, 'partner_access_required');
});

test('requires explicit Adzuna commercial approval before credentials matter', () => {
  assert.equal(connectorGateStatus({ ADZUNA_APP_ID: 'x', ADZUNA_APP_KEY: 'y' }).find(item => item.id === 'adzuna')?.reason, 'terms_confirmation_required');
  assert.equal(connectorGateStatus({ ADZUNA_TERMS_APPROVED_AT: '2026-08-24', ADZUNA_APP_ID: 'x', ADZUNA_APP_KEY: 'y' }).find(item => item.id === 'adzuna')?.reason, 'implementation_review_required');
});

test('disabled adapters cannot make a network call', async () => {
  let called = false;
  await assert.rejects(executePartnerAdapter('upwork', async () => { called = true; }), /disabled/i);
  assert.equal(called, false);
});
