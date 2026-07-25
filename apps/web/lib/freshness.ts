import type { JobListing } from '@jobman/shared/src/types';

// Firestore timestamps arrive on the client as { seconds, nanoseconds }; dates
// may also be plain Date or ISO strings. Normalize to millis.
export function toMillis(value: unknown): number | null {
  if (!value) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const t = Date.parse(value);
    return Number.isNaN(t) ? null : t;
  }
  const secs = (value as any).seconds ?? (value as any)._seconds;
  return typeof secs === 'number' ? secs * 1000 : null;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export type Freshness = {
  label: string;
  tone: 'new' | 'live' | 'checked' | 'stale' | 'closed';
};

// Freshness label for an imported listing (spec §4). "May be stale" is shown
// only when justified: the listing is still open but hasn't been re-confirmed
// by a successful source fetch in over a day.
export function jobFreshness(job: Pick<JobListing, 'isImported' | 'status' | 'firstSeenAt' | 'lastSeenAt' | 'createdAt'>): Freshness | null {
  if (!job.isImported) return null;
  if (job.status === 'closed') return { label: 'No longer listed', tone: 'closed' };

  const now = Date.now();
  const firstSeen = toMillis(job.firstSeenAt) ?? toMillis(job.createdAt);
  if (firstSeen && now - firstSeen < DAY) return { label: 'New today', tone: 'new' };

  const lastSeen = toMillis(job.lastSeenAt);
  if (lastSeen == null) return { label: 'Still live', tone: 'live' };

  const age = now - lastSeen;
  if (age < 3 * HOUR) return { label: 'Still live', tone: 'live' };
  if (age < DAY) {
    const hrs = Math.max(1, Math.round(age / HOUR));
    return { label: `Checked ${hrs}h ago`, tone: 'checked' };
  }
  return { label: 'May be stale', tone: 'stale' };
}

export const SOURCE_LABELS: Record<string, string> = {
  greenhouse: 'Greenhouse',
  lever: 'Lever',
  ashby: 'Ashby',
  smartrecruiters: 'SmartRecruiters',
  manual: 'JobMan',
};
