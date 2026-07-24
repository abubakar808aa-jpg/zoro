import type { JobSource } from '@jobman/shared/src/types';
import type { ImportedJob } from './greenhouse';
import { inferCategory, inferRemote, inferType, sourceDocumentId, stripHtml, toDate } from './shared';

export type LeverSource = Pick<JobSource, 'boardToken' | 'companyName' | 'careersUrl'> & { region?: 'global' | 'eu' };

type LeverJob = {
  id: string;
  text: string;
  descriptionPlain?: string;
  description?: string;
  categories?: { location?: string; commitment?: string; department?: string; team?: string };
  hostedUrl?: string;
  applyUrl?: string;
  workplaceType?: string;
  salaryRange?: { min?: number; max?: number; interval?: string; currency?: string };
  createdAt?: number;
};

function salary(job: LeverJob) {
  const range = job.salaryRange;
  if (!range || typeof range.min !== 'number' || typeof range.max !== 'number') return undefined;
  const period = /hour/i.test(range.interval ?? '') ? 'hourly' : 'annual';
  return { min: range.min, max: range.max, period } as const;
}

export function normalizeLeverJob(job: LeverJob, source: LeverSource): ImportedJob {
  const description = stripHtml(job.descriptionPlain || job.description || '');
  const location = job.categories?.location || (job.workplaceType === 'remote' ? 'Remote' : 'Location not listed');
  const context = `${job.text} ${job.categories?.department ?? ''} ${job.categories?.team ?? ''} ${description}`;
  return {
    id: job.id,
    sourceDocumentId: sourceDocumentId('lever', source.boardToken, job.id),
    title: job.text.trim(), description, type: inferType(`${job.categories?.commitment ?? ''} ${context}`),
    category: inferCategory(context), location,
    remote: job.workplaceType === 'remote' || job.workplaceType === 'hybrid' || inferRemote(`${location} ${context}`),
    salary: salary(job), requirements: [], skills: [], postedBy: 'jobman-import', postedByName: source.companyName,
    status: 'open', applicantCount: 0, sourceProvider: 'lever', sourceJobId: job.id,
    sourceUrl: source.careersUrl || job.hostedUrl || job.applyUrl,
    applyUrl: job.applyUrl || job.hostedUrl,
    sourceUpdatedAt: toDate(job.createdAt), lastSeenAt: new Date(), isImported: true,
  };
}

export async function fetchLeverJobs(source: LeverSource) {
  if (!/^[a-zA-Z0-9_-]+$/.test(source.boardToken)) throw new Error('Lever boardToken contains unsupported characters.');
  const base = source.region === 'eu' ? 'https://api.eu.lever.co' : 'https://api.lever.co';
  const jobs: LeverJob[] = [];
  for (let skip = 0; skip < 10_000; skip += 100) {
    const response = await fetch(`${base}/v0/postings/${encodeURIComponent(source.boardToken)}?mode=json&limit=100&skip=${skip}`, {
      headers: { Accept: 'application/json' }, next: { revalidate: 0 },
    });
    if (!response.ok) throw new Error(`Lever returned ${response.status} for board ${source.boardToken}.`);
    const page = await response.json() as LeverJob[];
    if (!Array.isArray(page)) throw new Error('Lever response did not contain a jobs array.');
    jobs.push(...page);
    if (page.length < 100) break;
  }
  return jobs.map(job => normalizeLeverJob(job, source));
}
