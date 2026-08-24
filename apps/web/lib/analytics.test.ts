import assert from 'node:assert/strict';
import test from 'node:test';

import { logInteraction } from './analytics.ts';

type MutableGlobal = typeof globalThis & {
  navigator: { sendBeacon?: (url: string, data?: BodyInit | null) => boolean };
};

function installBrowserTransport(options: {
  beacon?: () => boolean;
  fetch?: typeof fetch;
}) {
  const global = globalThis as MutableGlobal;
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const originalFetch = globalThis.fetch;

  Object.defineProperty(global, 'navigator', {
    configurable: true,
    value: options.beacon ? { sendBeacon: options.beacon } : {},
  });
  if (options.fetch) globalThis.fetch = options.fetch;

  return () => {
    if (navigatorDescriptor) Object.defineProperty(global, 'navigator', navigatorDescriptor);
    else delete (global as Partial<MutableGlobal>).navigator;
    globalThis.fetch = originalFetch;
  };
}

test('uses sendBeacon without delaying navigation when the browser queues the event', () => {
  let beaconCalls = 0;
  let fetchCalls = 0;
  const restore = installBrowserTransport({
    beacon: () => { beaconCalls += 1; return true; },
    fetch: async () => { fetchCalls += 1; return new Response(null, { status: 204 }); },
  });

  try {
    const queued = logInteraction({ type: 'job_apply_click', jobId: 'greenhouse_figma_123' });
    assert.equal(queued, true);
    assert.equal(beaconCalls, 1);
    assert.equal(fetchCalls, 0);
  } finally {
    restore();
  }
});
test('falls back to keepalive fetch when sendBeacon declines the event', async () => {
  let request: RequestInit | undefined;
  const restore = installBrowserTransport({
    beacon: () => false,
    fetch: async (_input, init) => {
      request = init;
      return new Response(null, { status: 204 });
    },
  });

  try {
    const queued = logInteraction({ type: 'job_apply_click', jobId: 'greenhouse_figma_123' });
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(queued, true);
    assert.equal(request?.method, 'POST');
    assert.equal(request?.keepalive, true);
  } finally {
    restore();
  }
});

test('reports delivery failure without throwing or blocking the outbound click', async () => {
  let failureCalls = 0;
  const restore = installBrowserTransport({
    beacon: () => false,
    fetch: async () => { throw new Error('offline'); },
  });

  try {
    assert.doesNotThrow(() => {
      logInteraction(
        { type: 'news_open', newsId: 'news_123', sourceName: 'U.S. Department of Labor' },
        () => { failureCalls += 1; },
      );
    });
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(failureCalls, 1);
  } finally {
    restore();
  }
});
