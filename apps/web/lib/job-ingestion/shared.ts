import { FieldPath, FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import type { JobSourceProvider, AlternateSource } from '@jobman/shared/src/types';
import { getAdminDb } from '@/lib/firebase-admin';
import type { ImportedJob } from './greenhouse';
import { computeFingerprint, descriptionSimilarity, slugifyCompany } from './normalize';

// Re-export the pure helpers so connectors keep importing from './shared'.
export {
  stripHtml, toDate, sourceDocumentId, inferType, inferRemote, inferRemoteType,
  inferCategory, slugifyCompany, computeFingerprint, descriptionSimilarity,
} from './normalize';

// A job is auto-closed after this many consecutive successful source fetches
// that no longer include it.
export const MISSED_CHECKS_TO_CLOSE = 3;

type SourceRecord = {
  provider: Exclude<JobSourceProvider, 'manual'>;
  sourceKey: string;
  companyName: string;
  careersUrl?: string;
  priority?: boolean;
  region?: 'global' | 'eu';
};

export type SyncCounts = {
  jobsFound: number;
  jobsCreated: number;
  jobsUpdated: number;
  jobsClosed: number;
  jobsMerged: number;
};

const BATCH = 200;   // Firestore batch limit is 500 writes; jobs+raw = 2 per item
const IN_LIMIT = 30; // Firestore 'in' filter limit

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function idPrefixFor(source: { provider: string; sourceKey: string }) {
  return `${source.provider}_${source.sourceKey}_`.replace(/[^a-zA-Z0-9_-]/g, '_');
}

// Existing docs previously ingested for this source. Doc ids embed
// `${provider}_${sourceKey}_`, so a documentId range query finds them all —
// including docs created before sourceKey was stored as a field.
async function loadExistingSourceJobs(db: Firestore, source: SourceRecord) {
  const prefix = idPrefixFor(source);
  const snap = await db.collection('jobs')
    .where(FieldPath.documentId(), '>=', prefix)
    .where(FieldPath.documentId(), '<', `${prefix}`)
    .get();
  const map = new Map<string, FirebaseFirestore.DocumentData>();
  snap.docs.forEach(d => map.set(d.id, d.data()));
  return map;
}

// Find an open imported listing elsewhere in the index that shares a
// fingerprint — the same role published on more than one board. Description
// similarity picks the best candidate when several match.
async function findCrossSourceDuplicate(
  db: Firestore,
  job: ImportedJob,
  fingerprint: string,
  ownIdPrefix: string,
): Promise<{ id: string; data: FirebaseFirestore.DocumentData } | null> {
  const snap = await db.collection('jobs')
    .where('fingerprint', '==', fingerprint)
    .where('isImported', '==', true)
    .where('status', '==', 'open')
    .limit(10)
    .get();

  const candidates = snap.docs.filter(d => !d.id.startsWith(ownIdPrefix));
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return { id: candidates[0].id, data: candidates[0].data() };

  let best = candidates[0];
  let bestScore = -1;
  for (const c of candidates) {
    const score = descriptionSimilarity(job.description, c.data().description ?? '');
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return { id: best.id, data: best.data() };
}

/**
 * Full sync of one source's fetched jobs into Firestore:
 *  - creates new listings (firstSeenAt/createdAt set once, never overwritten)
 *  - updates existing listings and refreshes lastSeenAt
 *  - folds cross-source duplicates into the existing listing (alternateSources)
 *  - increments missedChecks on jobs the source no longer returns and closes
 *    them after MISSED_CHECKS_TO_CLOSE consecutive misses
 *  - stores raw provider payloads server-only in jobRaw/{docId}
 *  - writes a sourceFetchLogs entry and refreshes the jobSources record
 */
export async function syncImportedJobs(
  jobs: ImportedJob[],
  source: SourceRecord,
  opts?: { runId?: string; requestedAt?: Date; durationMs?: number },
): Promise<SyncCounts> {
  const db = getAdminDb();
  const now = FieldValue.serverTimestamp();
  const ownIdPrefix = idPrefixFor(source);

  const existing = await loadExistingSourceJobs(db, source);
  const incomingIds = new Set(jobs.map(j => j.sourceDocumentId));
  const counts: SyncCounts = { jobsFound: jobs.length, jobsCreated: 0, jobsUpdated: 0, jobsClosed: 0, jobsMerged: 0 };

  type Write = { id: string; data: Record<string, unknown>; raw?: unknown };
  const writes: Write[] = [];
  const mergedInto = new Map<string, AlternateSource[]>();

  for (const job of jobs) {
    const { sourceDocumentId: docId, raw, ...jobData } = job;
    const companyName = job.companyName ?? job.postedByName;
    const fingerprint = computeFingerprint({
      companyName,
      title: job.title,
      location: job.location,
      type: job.type,
    });
    const base: Record<string, unknown> = {
      ...jobData,
      companyName,
      companyId: slugifyCompany(companyName),
      sourceKey: source.sourceKey,
      fingerprint,
      status: 'open',
      missedChecks: 0,
      lastSeenAt: now,
    };
    delete base.raw;

    const prior = existing.get(docId);
    if (prior) {
      // Never overwrite first-seen/created timestamps or engagement counters.
      delete base.createdAt;
      delete base.applicantCount;
      writes.push({ id: docId, data: base, raw });
      counts.jobsUpdated++;
      continue;
    }

    // New to this source — check whether another board already lists this role.
    const dupe = await findCrossSourceDuplicate(db, job, fingerprint, ownIdPrefix);
    if (dupe) {
      counts.jobsMerged++;
      const alternates = mergedInto.get(dupe.id) ?? [];
      alternates.push({
        provider: source.provider,
        sourceKey: source.sourceKey,
        sourceJobId: job.sourceJobId ?? job.id,
        ...(job.sourceUrl ? { sourceUrl: job.sourceUrl } : {}),
        ...(job.applyUrl ? { applyUrl: job.applyUrl } : {}),
      });
      mergedInto.set(dupe.id, alternates);
      continue;
    }

    base.createdAt = now;
    base.firstSeenAt = now;
    base.postedAt = job.postedAt ?? job.sourceUpdatedAt ?? new Date();
    base.applicantCount = 0;
    writes.push({ id: docId, data: base, raw });
    counts.jobsCreated++;
  }

  // Upserts + server-only raw payloads (2 writes per job).
  for (const group of chunk(writes, BATCH)) {
    const batch = db.batch();
    for (const w of group) {
      batch.set(db.collection('jobs').doc(w.id), w.data, { merge: true });
      if (w.raw !== undefined) {
        batch.set(db.collection('jobRaw').doc(w.id), {
          provider: source.provider,
          sourceKey: source.sourceKey,
          fetchedAt: now,
          raw: JSON.parse(JSON.stringify(w.raw)),
        });
      }
    }
    await batch.commit();
  }

  // Duplicate merges: record alternates on the primary listing. The primary
  // keeps its own official applyUrl — alternates are metadata, not overrides.
  for (const [primaryId, alternates] of Array.from(mergedInto)) {
    const ref = db.collection('jobs').doc(primaryId);
    await ref.set({
      lastSeenAt: now,
      alternateSources: FieldValue.arrayUnion(...alternates),
    }, { merge: true });
    const snap = await ref.get();
    const all = (snap.data()?.alternateSources ?? []) as AlternateSource[];
    await ref.update({ sourceCount: 1 + all.length });
  }

  // Reconcile: this fetch succeeded, so anything previously ingested from this
  // source that wasn't returned is one step closer to closed.
  const missing = Array.from(existing.entries()).filter(([id, data]) =>
    !incomingIds.has(id) && data.status === 'open');
  for (const group of chunk(missing, BATCH)) {
    const batch = db.batch();
    for (const [id, data] of group) {
      const missed = (data.missedChecks ?? 0) + 1;
      if (missed >= MISSED_CHECKS_TO_CLOSE) {
        batch.update(db.collection('jobs').doc(id), {
          missedChecks: missed, status: 'closed', closedReason: 'source_removed', closedAt: now,
        });
        counts.jobsClosed++;
      } else {
        batch.update(db.collection('jobs').doc(id), { missedChecks: missed });
      }
    }
    await batch.commit();
  }

  // Fetch log + source record.
  const requestedAt = opts?.requestedAt ?? new Date();
  await db.collection('sourceFetchLogs').add({
    provider: source.provider,
    sourceKey: source.sourceKey,
    requestedAt: Timestamp.fromDate(requestedAt),
    durationMs: opts?.durationMs ?? Date.now() - requestedAt.getTime(),
    responseStatus: 'ok',
    ...counts,
    ...(opts?.runId ? { runId: opts.runId } : {}),
  });

  await db.collection('jobSources').doc(`${source.provider}_${source.sourceKey}`).set({
    provider: source.provider,
    sourceKey: source.sourceKey,
    boardToken: source.sourceKey,
    companyName: source.companyName,
    careersUrl: source.careersUrl ?? null,
    ...(source.region ? { region: source.region } : {}),
    ...(source.priority !== undefined ? { priority: source.priority } : {}),
    active: true,
    consecutiveFailures: 0,
    lastFetchedAt: now,
    lastSuccessAt: now,
    lastError: FieldValue.delete(),
  }, { merge: true });

  return counts;
}

// Record a failed fetch: log entry + backoff state on the source record.
export async function recordFetchFailure(
  source: { provider: JobSourceProvider; sourceKey: string },
  error: string,
  opts?: { runId?: string; requestedAt?: Date; durationMs?: number },
) {
  const db = getAdminDb();
  const requestedAt = opts?.requestedAt ?? new Date();
  await db.collection('sourceFetchLogs').add({
    provider: source.provider,
    sourceKey: source.sourceKey,
    requestedAt: Timestamp.fromDate(requestedAt),
    durationMs: opts?.durationMs ?? Date.now() - requestedAt.getTime(),
    responseStatus: 'error',
    jobsFound: 0, jobsCreated: 0, jobsUpdated: 0, jobsClosed: 0, jobsMerged: 0,
    error: error.slice(0, 1000),
    ...(opts?.runId ? { runId: opts.runId } : {}),
  });
  await db.collection('jobSources').doc(`${source.provider}_${source.sourceKey}`).set({
    lastFetchedAt: FieldValue.serverTimestamp(),
    lastError: error.slice(0, 1000),
    consecutiveFailures: FieldValue.increment(1),
  }, { merge: true });
}

// Back-compat alias — the per-provider ingest routes call upsertImportedJobs.
export async function upsertImportedJobs(jobs: ImportedJob[], source: SourceRecord) {
  return syncImportedJobs(jobs, source);
}
