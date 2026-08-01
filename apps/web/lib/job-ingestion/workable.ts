import type { ImportedJob } from './greenhouse';
import { inferCategory, inferRemote, inferType, sourceDocumentId, stripHtml, toDate } from './shared';

export type WorkableSource = { sourceKey: string; companyName: string; careersUrl?: string };

type WorkableJob = {
  title: string;
  shortcode: string;
  employment_type?: string;
  telecommuting?: boolean;
  department?: string;
  url?: string;
  shortlink?: string;
  application_url?: string;
  published_on?: string;
  created_at?: string;
  country?: string;
  city?: string;
  state?: string;
  description?: string;
  locations?: Array<{ country?: string; countryCode?: string; city?: string; region?: string }>;
  salary?: { salary_from?: number; salary_to?: number; salary_currency?: string };
};

function workableLocation(job: WorkableJob) {
  const locations = job.locations
    ?.map(item => [item.city, item.region, item.country].filter(Boolean).join(', '))
    .filter(Boolean);
  if (locations?.length) return Array.from(new Set(locations)).join(' · ');
  return [job.city, job.state, job.country].filter(Boolean).join(', ') || (job.telecommuting ? 'Remote' : 'Location not listed');
}

function workableSalary(job: WorkableJob) {
  const min = job.salary?.salary_from;
  const max = job.salary?.salary_to;
  if (typeof min !== 'number' || typeof max !== 'number') return undefined;
  return { min, max, period: 'annual' as const };
}

export function normalizeWorkableJob(job: WorkableJob, source: WorkableSource): ImportedJob {
  const description = stripHtml(job.description);
  const location = workableLocation(job);
  const context = `${job.title} ${job.department ?? ''} ${job.employment_type ?? ''} ${description}`;
  const sourceUrl = job.url || job.shortlink || `https://apply.workable.com/j/${encodeURIComponent(job.shortcode)}`;

  return {
    id: job.shortcode,
    sourceDocumentId: sourceDocumentId('workable', source.sourceKey, job.shortcode),
    title: job.title.trim(),
    description,
    type: inferType(context),
    category: inferCategory(context),
    location,
    remote: Boolean(job.telecommuting) || inferRemote(`${location} ${context}`),
    salary: workableSalary(job),
    requirements: [],
    skills: [],
    postedBy: 'jobman-import',
    postedByName: source.companyName,
    status: 'open',
    applicantCount: 0,
    sourceProvider: 'workable',
    sourceJobId: job.shortcode,
    sourceUrl,
    applyUrl: job.application_url || sourceUrl,
    sourceUpdatedAt: toDate(job.published_on || job.created_at),
    lastSeenAt: new Date(),
    isImported: true,
  };
}

export async function fetchWorkableJobs(source: WorkableSource) {
  if (!/^[a-zA-Z0-9_-]+$/.test(source.sourceKey)) throw new Error('Workable account subdomain contains unsupported characters.');
  const response = await fetch(`https://www.workable.com/api/accounts/${encodeURIComponent(source.sourceKey)}?details=true`, {
    headers: { Accept: 'application/json' },
    next: { revalidate: 0 },
  });
  if (!response.ok) throw new Error(`Workable returned ${response.status} for account ${source.sourceKey}.`);
  const data = await response.json() as { jobs?: WorkableJob[] };
  if (!Array.isArray(data.jobs)) throw new Error('Workable response did not contain a jobs array.');
  return data.jobs.map(job => normalizeWorkableJob(job, source));
}
