import { FieldValue } from 'firebase-admin/firestore';
import type { JobListing, JobSourceProvider } from '@jobman/shared/src/types';
import { getAdminDb } from '@/lib/firebase-admin';
import type { ImportedJob } from './greenhouse';

export function stripHtml(content = '') {
  return content
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
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

  for (let start = 0; start < jobs.length; start += 400) {
    const batch = db.batch();
    for (const job of jobs.slice(start, start + 400)) {
      const { sourceDocumentId: id, ...jobData } = job;
      const cleanJobData = omitUndefined(jobData) as Record<string, unknown>;
      batch.set(db.collection('jobs').doc(id), { ...cleanJobData, createdAt: now, lastSeenAt: now }, { merge: true });
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
  }, { merge: true });
}
