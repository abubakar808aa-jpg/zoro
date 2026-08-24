import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveOpportunityInboxView } from './opportunity-ui.ts';

test('resolves loading, signed-out, unauthorized, empty, error, and ready inbox states', () => {
  assert.equal(resolveOpportunityInboxView({ authLoading: true, hasUser: false, accountType: null, loadStatus: 'idle', itemCount: 0 }), 'loading');
  assert.equal(resolveOpportunityInboxView({ authLoading: false, hasUser: false, accountType: null, loadStatus: 'idle', itemCount: 0 }), 'signed_out');
  assert.equal(resolveOpportunityInboxView({ authLoading: false, hasUser: true, accountType: 'employer', loadStatus: 'idle', itemCount: 0 }), 'unauthorized');
  assert.equal(resolveOpportunityInboxView({ authLoading: false, hasUser: true, accountType: 'worker', loadStatus: 'loading', itemCount: 0 }), 'loading');
  assert.equal(resolveOpportunityInboxView({ authLoading: false, hasUser: true, accountType: 'worker', loadStatus: 'error', itemCount: 0 }), 'error');
  assert.equal(resolveOpportunityInboxView({ authLoading: false, hasUser: true, accountType: 'worker', loadStatus: 'success', itemCount: 0 }), 'empty');
  assert.equal(resolveOpportunityInboxView({ authLoading: false, hasUser: true, accountType: 'worker', loadStatus: 'success', itemCount: 2 }), 'ready');
  assert.equal(resolveOpportunityInboxView({ authLoading: false, authError: true, hasUser: false, accountType: null, loadStatus: 'idle', itemCount: 0 }), 'error');
});

test('treats setup-related API errors as unauthorized instead of a silent empty state', () => {
  for (const apiErrorCode of ['GIG_PROFILE_REQUIRED', 'PREFERENCES_REQUIRED', 'PROFESSIONAL_REQUIRED']) {
    assert.equal(resolveOpportunityInboxView({
      authLoading: false,
      hasUser: true,
      accountType: 'worker',
      loadStatus: 'error',
      apiErrorCode,
      itemCount: 0,
    }), 'unauthorized');
  }
});
