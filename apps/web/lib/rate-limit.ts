// Per-key sliding window. In-memory: on serverless this is per-instance and
// resets on cold start, so it's abuse mitigation rather than a hard quota.
export function makeRateLimiter(max: number, windowMs: number) {
  const log = new Map<string, number[]>();
  return function check(key: string): boolean {
    const now = Date.now();
    const recent = (log.get(key) ?? []).filter(t => now - t < windowMs);
    if (recent.length >= max) return false;
    recent.push(now);
    log.set(key, recent);
    return true;
  };
}
