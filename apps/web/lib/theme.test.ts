import assert from 'node:assert/strict';
import test from 'node:test';

import { nextColorMode, resolveColorMode } from './theme.ts';

test('uses an explicitly saved color mode instead of the device preference', () => {
  assert.equal(resolveColorMode('dark', false), 'dark');
  assert.equal(resolveColorMode('light', true), 'light');
});

test('falls back to the device preference when no valid choice was saved', () => {
  assert.equal(resolveColorMode(null, true), 'dark');
  assert.equal(resolveColorMode(null, false), 'light');
  assert.equal(resolveColorMode('sepia', true), 'dark');
});

test('toggles between light and dark mode', () => {
  assert.equal(nextColorMode('light'), 'dark');
  assert.equal(nextColorMode('dark'), 'light');
});
