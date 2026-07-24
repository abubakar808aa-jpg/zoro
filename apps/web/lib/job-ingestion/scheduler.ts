import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { syncImportedJobs, recordFetchFailure, type SyncCounts } from './shared';
import { fetchGreenhouseJobs } from './greenhouse';
import { fetchLeverJobs } from './lever';
import { fetchAshbyJobs } from './ashby';

const HOUR = 60 * 60 * 1000;
// Priority sources refresh every 2–4h, normal sources every 6–12h (spec §3).
const PRIORITY_MIN = 2 * HOUR, PRIORITY_MAX = 4 * HOUR;
const NORMAL_MIN = 6 * HOUR, NORMAL_MAX = 12 * HOUR;
const BACKOFF_CAP = 24 * HOUR;
const MAX_SOURCES_PER_RUN = 25; // bound runtime within serverless limits

// Providers the scheduler can fetch unattended. SmartRecruiters is excluded on
// purpose: its feed needs an X-SmartToken we never persist, so it stays a manual
// server-to-server call.
type AutoProvider = 'greenhouse' | 'lever' | 'ashby';
const AUTO_PROVIDERS: AutoProvider[] = ['greenhouse', 'lever', 'ashby'];

function jitter(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function baseInterval(priority: boolean) {
  return priority ? jitter(PRIORITY_MIN, PRIORITY_MAX) : jitter(NORMAL_MIN, NORMAL_MAX);
}

function backoffInterval(priority: boolean, consecutiveFailures: number) {
  const base = priority ? PRIORITY_MIN : NORMAL_MIN;
  return Math.min(base * 2 ** consecutiveFailures, BACKOFF_CAP);
}

async function fetchByProvider(provider: AutoProvider, source: any) {
  const base = { boardToken: source.boardToken ?? source.sourceKey, companyName: source.companyName, careersUrl: source.careersUrl ?? undefined };
  if (provider === 'greenhouse') return fetchGreenhouseJobs(base);
  if (provider === 'ashby') return fetchAshbyJobs(base);
  return fetchLeverJobs({ ...base, region: source.region ?? 'global' });
}

export type RunResult = {
  runId: string;
  sourcesChecked: number;
  sourcesSkipped: number;
  sourcesFailed: number;
  jobsFound: number;
  jobsCreated: number;
  jobsUpdated: number;
  jobsClosed: number;
  jobsMerged: number;
  errors: string[];
};

/**
 * Fetch every active source that is due (nextFetchAt in the past or unset),
 * most-overdue first, capped per run. Records one ingestionRuns document and
 * reschedules each source (normal cadence on success, exponential backoff on
 * failure).
 */
export async function runDueSources(trigger: 'schedule' | 'manual'): Promise<RunResult> {
  const db = getAdminDb();
  const startedAt = new Date();
  const runRef = db.collection('ingestionRuns').doc();
  const runId = runRef.id;

  const snap = await db.collection('jobSources').where('active', '==', true).get();
  const now = Date.now();

  const due = snap.docs
    .map(d => ({ id: d.id, data: d.data() }))
    .filter(({ data }) => AUTO_PROVIDERS.includes(data.provider))
    .filter(({ data }) => {
      const next = data.nextFetchAt as Timestamp | undefined;
      return !next || next.toMillis() <= now;
    })
    .sort((a, b) => {
      const an = (a.data.nextFetchAt as Timestamp | undefined)?.toMillis() ?? 0;
      const bn = (b.data.nextFetchAt as Timestamp | undefined)?.toMillis() ?? 0;
      return an - bn;
    })
    .slice(0, MAX_SOURCES_PER_RUN);

  const totals: RunResult = {
    runId, sourcesChecked: 0, sourcesSkipped: snap.size - due.length, sourcesFailed: 0,
    jobsFound: 0, jobsCreated: 0, jobsUpdated: 0, jobsClosed: 0, jobsMerged: 0, errors: [],
  };

  for (const { id, data } of due) {
    const provider = data.provider as AutoProvider;
    const sourceKey: string = data.sourceKey ?? data.boardToken;
    const priority = Boolean(data.priority);
    const requestedAt = new Date();
    const t0 = Date.now();
    totals.sourcesChecked++;

    try {
      const jobs = await fetchByProvider(provider, data);
      const counts: SyncCounts = await syncImportedJobs(
        jobs,
        { provider, sourceKey, companyName: data.companyName, careersUrl: data.careersUrl ?? undefined, priority, region: data.region },
        { runId, requestedAt, durationMs: Date.now() - t0 },
      );
      totals.jobsFound += counts.jobsFound;
      totals.jobsCreated += counts.jobsCreated;
      totals.jobsUpdated += counts.jobsUpdated;
      totals.jobsClosed += counts.jobsClosed;
      totals.jobsMerged += counts.jobsMerged;
      // syncImportedJobs already reset consecutiveFailures; set next due time.
      await db.collection('jobSources').doc(id).update({
        nextFetchAt: Timestamp.fromMillis(now + baseInterval(priority)),
      });
    } catch (err: any) {
      const message = err?.message ?? 'Fetch failed.';
      totals.sourcesFailed++;
      totals.errors.push(`${provider}/${sourceKey}: ${message}`);
      await recordFetchFailure({ provider, sourceKey }, message, { runId, requestedAt, durationMs: Date.now() - t0 });
      const failures = (data.consecutiveFailures ?? 0) + 1;
      await db.collection('jobSources').doc(id).update({
        nextFetchAt: Timestamp.fromMillis(now + backoffInterval(priority, failures)),
      });
    }
  }

  await runRef.set({
    startedAt: Timestamp.fromDate(startedAt),
    finishedAt: FieldValue.serverTimestamp(),
    trigger,
    sourcesChecked: totals.sourcesChecked,
    sourcesSkipped: totals.sourcesSkipped,
    sourcesFailed: totals.sourcesFailed,
    jobsFound: totals.jobsFound,
    jobsCreated: totals.jobsCreated,
    jobsUpdated: totals.jobsUpdated,
    jobsClosed: totals.jobsClosed,
    jobsMerged: totals.jobsMerged,
    errors: totals.errors.slice(0, 50),
  });

  return totals;
}
