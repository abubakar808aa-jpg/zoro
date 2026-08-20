import type { ImportedJob } from './greenhouse';
import { inferCategory, inferRemote, inferType, sourceDocumentId, stripHtml, toDate } from './shared';

// Arbeitnow is a free, no-auth aggregator job board:
//   https://www.arbeitnow.com/api/job-board-api
// One source yields jobs from many employers, so each job carries its own
// employer name (postedByName). `created_at` is a Unix timestamp in seconds.

export type ArbeitnowSource = { companyName: string; sourceKey?: string; careersUrl?: string };

type ArbeitnowJob = {
  slug?: string;
  company_name?: string;
  title?: string;
  description?: string;
  remote?: boolean;
  url?: string;
  tags?: string[];
  job_types?: string[];
  location?: string;
  created_at?: number;
};

type ArbeitnowResponse = { data?: ArbeitnowJob[] };

export function normalizeArbeitnowJob(job: ArbeitnowJob, source: ArbeitnowSource): ImportedJob {
  const title = (job.title || 'Untitled role').trim();
  const company = job.company_name?.trim() || source.companyName;
  const description = stripHtml(job.description || '');
  const location = job.location?.trim() || (job.remote ? 'Remote' : 'Location not listed');
  const commitment = (job.job_types ?? []).join(' ');
  const context = `${title} ${(job.tags ?? []).join(' ')} ${description}`;
  const jobId = job.slug || title;
  return {
    id: jobId,
    sourceDocumentId: sourceDocumentId('arbeitnow', source.sourceKey || 'arbeitnow', jobId),
    title,
    description,
    type: inferType(`${commitment} ${context}`),
    category: inferCategory(context),
    location,
    remote: Boolean(job.remote) || inferRemote(`${location} ${context}`),
    requirements: [],
    skills: (job.tags ?? []).slice(0, 8),
    postedBy: 'jobman-import',
    postedByName: company,
    status: 'open',
    applicantCount: 0,
    sourceProvider: 'arbeitnow',
    sourceJobId: jobId,
    sourceUrl: job.url,
    applyUrl: job.url,
    // created_at is seconds since epoch; toDate/new Date() expect milliseconds.
    sourceUpdatedAt: toDate(typeof job.created_at === 'number' ? job.created_at * 1000 : undefined),
    lastSeenAt: new Date(),
    isImported: true,
  };
}

export async function fetchArbeitnowJobs(source: ArbeitnowSource) {
  const response = await fetch('https://www.arbeitnow.com/api/job-board-api', {
    headers: { Accept: 'application/json' },
    next: { revalidate: 0 },
  });
  if (!response.ok) throw new Error(`Arbeitnow returned ${response.status}.`);
  const data = await response.json() as ArbeitnowResponse;
  if (!Array.isArray(data.data)) throw new Error('Arbeitnow response did not contain a data array.');
  return data.data.map(job => normalizeArbeitnowJob(job, source));
}
