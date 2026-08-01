import type { ImportedJob } from './greenhouse';
import { inferCategory, inferRemote, inferType, sourceDocumentId, stripHtml, toDate } from './shared';

export type RecruiteeSource = { sourceKey: string; companyName: string; careersUrl?: string };

type RecruiteeJob = {
  id: number | string;
  slug: string;
  title: string;
  description?: string;
  requirements?: string;
  location?: string;
  remote?: boolean;
  hybrid?: boolean;
  on_site?: boolean;
  department?: string;
  employment_type_code?: string;
  careers_url?: string;
  careers_apply_url?: string;
  published_at?: string;
  updated_at?: string;
  status?: string;
  salary?: { min?: string | number; max?: string | number; period?: string; currency?: string };
};

function recruiteeSalary(job: RecruiteeJob) {
  const min = Number(job.salary?.min);
  const max = Number(job.salary?.max);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return undefined;
  const period = /hour/i.test(job.salary?.period ?? '') ? 'hourly' : 'annual';
  return { min, max, period } as const;
}

export function normalizeRecruiteeJob(job: RecruiteeJob, source: RecruiteeSource): ImportedJob {
  const sourceJobId = String(job.id || job.slug);
  const description = stripHtml([job.description, job.requirements].filter(Boolean).join('\n\n'));
  const location = job.location?.trim() || (job.remote ? 'Remote' : 'Location not listed');
  const context = `${job.title} ${job.department ?? ''} ${job.employment_type_code ?? ''} ${description}`;
  const sourceUrl = job.careers_url || `${source.careersUrl || `https://${source.sourceKey}.recruitee.com`}/o/${encodeURIComponent(job.slug)}`;

  return {
    id: sourceJobId,
    sourceDocumentId: sourceDocumentId('recruitee', source.sourceKey, sourceJobId),
    title: job.title.trim(),
    description,
    type: inferType(context),
    category: inferCategory(context),
    location,
    remote: Boolean(job.remote || job.hybrid) || inferRemote(`${location} ${context}`),
    salary: recruiteeSalary(job),
    requirements: [],
    skills: [],
    postedBy: 'jobman-import',
    postedByName: source.companyName,
    status: 'open',
    applicantCount: 0,
    sourceProvider: 'recruitee',
    sourceJobId,
    sourceUrl,
    applyUrl: job.careers_apply_url || sourceUrl,
    sourceUpdatedAt: toDate(job.updated_at || job.published_at),
    lastSeenAt: new Date(),
    isImported: true,
  };
}

export async function fetchRecruiteeJobs(source: RecruiteeSource) {
  if (!/^[a-zA-Z0-9_-]+$/.test(source.sourceKey)) throw new Error('Recruitee careers subdomain contains unsupported characters.');
  const response = await fetch(`https://${encodeURIComponent(source.sourceKey)}.recruitee.com/api/offers/`, {
    headers: { Accept: 'application/json' },
    next: { revalidate: 0 },
  });
  if (!response.ok) throw new Error(`Recruitee returned ${response.status} for careers site ${source.sourceKey}.`);
  const data = await response.json() as { offers?: RecruiteeJob[] };
  if (!Array.isArray(data.offers)) throw new Error('Recruitee response did not contain an offers array.');
  return data.offers
    .filter(job => !job.status || job.status === 'published')
    .map(job => normalizeRecruiteeJob(job, source));
}
