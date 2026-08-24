import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeJobDescription } from './job-description.ts';

test('turns common HTML blocks and encoded entities into readable text', () => {
  assert.equal(
    normalizeJobDescription('<div><p>Hello &amp; welcome.</p><p>Build useful things&nbsp;today.</p></div>'),
    'Hello & welcome.\n\nBuild useful things today.',
  );
  assert.equal(
    normalizeJobDescription('&lt;p&gt;Double encoded &amp;amp; still readable.&lt;/p&gt;'),
    'Double encoded & still readable.',
  );
});

test('preserves link labels but removes markup, URLs, and attributes', () => {
  const result = normalizeJobDescription(
    '<p>Read our <a href="https://example.com/jobs?token=secret" onclick="steal()">benefits guide</a>.</p>',
  );

  assert.equal(result, 'Read our benefits guide.');
  assert.equal(result.includes('example.com'), false);
  assert.equal(result.includes('onclick'), false);
});

test('renders lists as readable bullets', () => {
  assert.equal(
    normalizeJobDescription('<h3>What you will do</h3><ul><li>Ship safely</li><li>Help customers</li></ul>'),
    'What you will do\n\n• Ship safely\n• Help customers',
  );
});

test('removes scripts and styles, including malformed or unclosed blocks', () => {
  const result = normalizeJobDescription(
    '<p>Safe introduction</p><style>.secret{display:none}</style><script>alert(1)',
  );

  assert.equal(result, 'Safe introduction');
  assert.equal(result.includes('alert'), false);
  assert.equal(result.includes('secret'), false);
});

test('handles malformed HTML without leaking tags', () => {
  const result = normalizeJobDescription('<div>First paragraph<p>Second <strong>paragraph</div>');

  assert.equal(result.includes('<'), false);
  assert.equal(result.includes('>'), false);
  assert.match(result, /First paragraph/);
  assert.match(result, /Second paragraph/);
});

test('leaves plain text readable and normalizes excessive whitespace', () => {
  assert.equal(
    normalizeJobDescription('Plain text role.\n\n\n  No HTML here.  '),
    'Plain text role.\n\nNo HTML here.',
  );
});
