export type InteractionEvent =
  | { type: 'job_apply_click'; jobId: string }
  | { type: 'news_open'; newsId: string; sourceName: string; sourceUrl: string };

export function logInteraction(event: InteractionEvent) {
  const body = JSON.stringify(event);
  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    navigator.sendBeacon('/api/events', new Blob([body], { type: 'application/json' }));
    return;
  }
  void fetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {});
}
