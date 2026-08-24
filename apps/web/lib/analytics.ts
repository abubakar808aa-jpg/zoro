import type { InteractionEvent } from './analytics-contract';

export type { InteractionEvent } from './analytics-contract';

export type InteractionFailureHandler = () => void;

export function logInteraction(event: InteractionEvent, onFailure?: InteractionFailureHandler) {
  const body = JSON.stringify(event);
  let failed = false;
  const reportFailure = () => {
    if (failed) return;
    failed = true;
    onFailure?.();
  };

  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    try {
      const queued = navigator.sendBeacon('/api/events', new Blob([body], { type: 'application/json' }));
      if (queued) return true;
    } catch {
      // Keepalive fetch is the safe fallback if beacon is unavailable.
    }
  }

  if (typeof fetch !== 'function') {
    reportFailure();
    return false;
  }

  void fetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).then(response => {
    if (!response.ok) reportFailure();
  }).catch(reportFailure);
  return true;
}
