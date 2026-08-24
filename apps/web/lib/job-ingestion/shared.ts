import { FieldValue } from 'firebase-admin/firestore';
import type { JobListing, JobSourceProvider } from '@jobman/shared/src/types';
import { getAdminDb } from '@/lib/firebase-admin';
import type { ImportedJob } from './greenhouse';
import { normalizeJobDescription } from '@/lib/job-description';

export function stripHtml(content = '') {
  return normalizeJobDescription(content);
}

export function toDate(value?: string | number) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export function sourceDocumentId(provider: JobSourceProvider, sourceKey: string, jobId: string | number) {
  return `${provider}_${sourceKey}_${jobId}`.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function inferType(value = ''): JobListing['type'] {
  const text = value.toLowerCase();
  if (/\b(part[ -]?time|part time)\b/.test(text)) return 'parttime';
  if (/\b(contract|contractor|freelance)\b/.test(text)) return 'contract';
  if (/\b(gig|temporary|seasonal|intern)\b/.test(text)) return 'gig';
  return 'fulltime';
}

export function inferRemote(value = '') {
  return /\b(remote|distributed|work from home|anywhere|hybrid)\b/i.test(value);
}

export function inferCategory(value = '') {
  const text = value.toLowerCase();
  if (/engineer|developer|software|data |security|devops|product manager/.test(text)) return 'technology';
  if (/design|ux|ui|creative/.test(text)) return 'design';
  if (/marketing|sales|growth|account executive/.test(text)) return 'marketing';
  if (/finance|accounting|payroll/.test(text)) return 'finance';
  if (/legal|counsel|attorney/.test(text)) return 'legal';
  if (/nurs|health|clinical|medical/.test(text)) return 'healthcare';
  if (/human resources|recruit|people operations/.test(text)) return 'hr';
  return 'other_pro';
}

type SourceRecord = {
  provider: Exclude<JobSourceProvider, 'manual'>;
  sourceKey: string;
  companyName: string;
  careersUrl?: string;
};

export type ImportedJobUpsertStats = {
  jobsFound: number;
  jobsCreated: number;
  jobsUpdated: number;
  jobsDeduplicated: number;
  jobsClosed: number;
};

function fingerprintPart(value = '') {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function importedJobFingerprint(job: Pick<JobListing, 'title' | 'location' | 'type'>, companyName: string) {
  return [companyName, job.title, job.location, job.type].map(fingerprintPart).join('|');
}

function omitUndefined(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(omitUndefined);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, omitUndefined(item)]),
    );
  }
  return value;
}

export async function upsertImportedJobs(jobs: ImportedJob[], source: SourceRecord) {
  const db = getAdminDb();
  const now = FieldValue.serverTimestamp();
  const [openSnapshot, providerSnapshot] = await Promise.all([
    db.collection('jobs').where('status', '==', 'open').get(),
    db.collection('jobs').where('sourceProvider', '==', source.provider).get(),
  ]);
  const existingById = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
  for (const document of [...openSnapshot.docs, ...providerSnapshot.docs]) existingById.set(document.id, document);

  const canonicalByFingerprint = new Map<string, string>();
  for (const document of openSnapshot.docs) {
    const data = document.data() as Partial<JobListing>;
    if (data.duplicateOf || !data.title || !data.location || !data.type) continue;
    const fingerprint = data.fingerprint || importedJobFingerprint(data as Pick<JobListing, 'title' | 'location' | 'type'>, data.postedByName || '');
    if (!canonicalByFingerprint.has(fingerprint)) canonicalByFingerprint.set(fingerprint, document.id);
  }

  const stats: ImportedJobUpsertStats = {
    jobsFound: jobs.length,
    jobsCreated: 0,
    jobsUpdated: 0,
    jobsDeduplicated: 0,
    jobsClosed: 0,
  };
  const incomingIds = new Set(jobs.map(job => job.sourceDocumentId));
  const canonicalSources = new Map<string, Set<string>>();

  for (let start = 0; start < jobs.length; start += 400) {
    const batch = db.batch();
    for (const job of jobs.slice(start, start + 400)) {
      const { sourceDocumentId: id, id: _providerJobId, ...jobData } = job;
      const cleanJobData = omitUndefined(jobData) as Record<string, unknown>;
      const existing = existingById.get(id);
      const existingData = existing?.data() ?? {};
      const fingerprint = importedJobFingerprint(job, source.companyName);
      const canonicalId = canonicalByFingerprint.get(fingerprint);
      const duplicateOf = canonicalId && canonicalId !== id ? canonicalId : undefined;
      const firstSeenAt = existingData.firstSeenAt || existingData.createdAt || now;

      batch.set(db.collection('jobs').doc(id), {
        ...cleanJobData,
        sourceKey: source.sourceKey,
        fingerprint,
        firstSeenAt,
        lastSeenAt: now,
        missingChecks: 0,
        ...(existing ? {} : { createdAt: now }),
        ...(duplicateOf
          ? { status: 'closed', duplicateOf }
          : { status: 'open', duplicateOf: FieldValue.delete(), closedAt: FieldValue.delete() }),
      }, { merge: true });

      if (existing) stats.jobsUpdated += 1;
      else stats.jobsCreated += 1;
      if (duplicateOf) {
        stats.jobsDeduplicated += 1;
        const labels = canonicalSources.get(duplicateOf) ?? new Set<string>();
        labels.add(`${source.provider}:${source.sourceKey}`);
        canonicalSources.set(duplicateOf, labels);
      } else {
        canonicalByFingerprint.set(fingerprint, id);
      }
    }
    await batch.commit();
  }

  const canonicalEntries = Array.from(canonicalSources.entries());
  for (let start = 0; start < canonicalEntries.length; start += 400) {
    const batch = db.batch();
    for (const [canonicalId, labels] of canonicalEntries.slice(start, start + 400)) {
      batch.set(db.collection('jobs').doc(canonicalId), {
        alsoFoundOn: FieldValue.arrayUnion(...Array.from(labels)),
        lastSeenAt: now,
      }, { merge: true });
    }
    await batch.commit();
  }

  const sourcePrefix = `${source.provider}_${source.sourceKey}_`;
  const missingDocuments = providerSnapshot.docs.filter(document => {
    const data = document.data();
    const belongsToSource = data.sourceKey === source.sourceKey || document.id.startsWith(sourcePrefix);
    return belongsToSource && data.status === 'open' && !incomingIds.has(document.id);
  });
  for (let start = 0; start < missingDocuments.length; start += 400) {
    const batch = db.batch();
    for (const document of missingDocuments.slice(start, start + 400)) {
      const missingChecks = Number(document.data().missingChecks || 0) + 1;
      const shouldClose = missingChecks >= 3;
      batch.set(document.ref, {
        missingChecks,
        ...(shouldClose ? { status: 'closed', closedAt: now } : {}),
      }, { merge: true });
      if (shouldClose) stats.jobsClosed += 1;
    }
    await batch.commit();
  }

  await db.collection('jobSources').doc(`${source.provider}_${source.sourceKey}`).set({
    provider: source.provider,
    sourceKey: source.sourceKey,
    companyName: source.companyName,
    careersUrl: source.careersUrl ?? null,
    active: true,
    lastFetchedAt: now,
    lastSuccessAt: now,
    lastError: FieldValue.delete(),
    lastJobsFound: stats.jobsFound,
    lastJobsCreated: stats.jobsCreated,
    lastJobsUpdated: stats.jobsUpdated,
    lastJobsDeduplicated: stats.jobsDeduplicated,
    lastJobsClosed: stats.jobsClosed,
  }, { merge: true });
  return stats;
}
