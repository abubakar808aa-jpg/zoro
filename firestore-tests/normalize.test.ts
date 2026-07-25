// Unit tests for the pure ingestion helpers. Run with:
//   node --test --experimental-strip-types firestore-tests/normalize.test.ts
// (see the root `test:unit` script). No emulator required.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeFingerprint,
  descriptionSimilarity,
  slugifyCompany,
  inferRemoteType,
  inferType,
} from '../apps/web/lib/job-ingestion/normalize.ts';

test('slugifyCompany strips legal suffixes and punctuation', () => {
  assert.equal(slugifyCompany('Acme, Inc.'), 'acme');
  assert.equal(slugifyCompany('Acme Corporation'), 'acme');
  assert.equal(slugifyCompany('Big Data LLC'), 'big-data');
});

test('fingerprint is stable across legal-suffix and location-detail noise', () => {
  const a = computeFingerprint({ companyName: 'Acme Inc.', title: 'Senior Engineer', location: 'Austin, TX, USA', type: 'fulltime' });
  const b = computeFingerprint({ companyName: 'Acme', title: 'Senior Engineer', location: 'Austin', type: 'fulltime' });
  assert.equal(a, b);
});

test('fingerprint differs for different roles at the same company', () => {
  const eng = computeFingerprint({ companyName: 'Acme', title: 'Engineer', location: 'Austin', type: 'fulltime' });
  const design = computeFingerprint({ companyName: 'Acme', title: 'Designer', location: 'Austin', type: 'fulltime' });
  assert.notEqual(eng, design);
});

test('fingerprint separates remote from on-site variants of a role', () => {
  const remote = computeFingerprint({ companyName: 'Acme', title: 'Engineer', location: 'Remote', type: 'fulltime' });
  const austin = computeFingerprint({ companyName: 'Acme', title: 'Engineer', location: 'Austin', type: 'fulltime' });
  assert.notEqual(remote, austin);
});

test('descriptionSimilarity ranks identical high and disjoint low', () => {
  const a = 'Build reliable payment systems with typescript and postgres';
  assert.equal(descriptionSimilarity(a, a), 1);
  assert.equal(descriptionSimilarity('payments typescript postgres', 'gardening flowers outdoors'), 0);
  const partial = descriptionSimilarity('payments typescript postgres backend', 'payments typescript react frontend');
  assert.ok(partial > 0 && partial < 1);
});

test('inferRemoteType and inferType classify from free text', () => {
  assert.equal(inferRemoteType('Fully remote role'), 'remote');
  assert.equal(inferRemoteType('Hybrid — 3 days in office'), 'hybrid');
  assert.equal(inferRemoteType('On-site in Austin'), 'onsite');
  assert.equal(inferType('Part-time barista'), 'parttime');
  assert.equal(inferType('Contract data engineer'), 'contract');
  assert.equal(inferType('Software Engineer'), 'fulltime');
});
