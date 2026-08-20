import type { JobSource } from '@jobman/shared/src/types';
import type { ImportedJob } from './greenhouse';
import { inferCategory, inferRemote, inferType, sourceDocumentId, stripHtml, toDate } from './shared';

// BambooHR exposes each customer's careers page as a public, no-auth JSON API:
//   https://{subdomain}.bamboohr.com/careers/list          → job summaries
//   https://{subdomain}.bamboohr.com/careers/{id}/detail    → full description
// The list endpoint omits the description, so we fetch details in small parallel
// batches (same approach as the SmartRecruiters connector).

export type BambooHrSource = Pick<JobSource, 'boardToken' | 'companyName' | 'careersUrl'>;
const SUBDOMAIN = /^[a-zA-Z0-9_-]+$/;

type BambooLocation = {
  city?: string;
  state?: string;
  addressCountry?: string;
  addressRegion?: string;
  location?: string;
};

type BambooJob = {
  id: number | string;
  jobOpeningName?: string;
  departmentLabel?: string;
  employmentStatusLabel?: string;
  locationLabel?: string;
  location?: BambooLocation;
  atsLocation?: BambooLocation;
  isRemote?: boolean | string;
  compensation?: string;
  postedDate?: string;
  jobDescription?: string;
  description?: string;
};

type BambooListResponse = { result?: BambooJob[] };
type BambooDetailResponse = { result?: BambooJob & { jobOpening?: BambooJob } };

function isRemote(value: BambooJob['isRemote']) {
  return value === true || String(value ?? '').toLowerCase() === 'yes' || String(value ?? '').toLowerCase() === 'true';
}

function locationLabel(job: BambooJob) {
  const loc = job.atsLocation || job.location;
  const parts = [loc?.city, loc?.state || loc?.addressRegion, loc?.addressCountry].filter(Boolean);
  return job.locationLabel?.trim() || loc?.location?.trim() || parts.join(', ') || (isRemote(job.isRemote) ? 'Remote' : 'Location not listed');
}

export function normalizeBambooHrJob(job: BambooJob, source: BambooHrSource): ImportedJob {
  const title = (job.jobOpeningName || 'Untitled role').trim();
  const description = stripHtml(job.jobDescription || job.description || '');
  const location = locationLabel(job);
  const context = `${title} ${job.departmentLabel ?? ''} ${description}`;
  const jobUrl = `${source.careersUrl?.replace(/\/$/, '') || `https://${source.boardToken}.bamboohr.com/careers`}/${encodeURIComponent(String(job.id))}`;
  return {
    id: String(job.id),
    sourceDocumentId: sourceDocumentId('bamboohr', source.boardToken, job.id),
    title,
    description,
    type: inferType(`${job.employmentStatusLabel ?? ''} ${context}`),
    category: inferCategory(context),
    location,
    remote: isRemote(job.isRemote) || inferRemote(`${location} ${context}`),
    requirements: [],
    skills: [],
    postedBy: 'jobman-import',
    postedByName: source.companyName,
    status: 'open',
    applicantCount: 0,
    sourceProvider: 'bamboohr',
    sourceJobId: String(job.id),
    sourceUrl: source.careersUrl || jobUrl,
    applyUrl: jobUrl,
    sourceUpdatedAt: toDate(job.postedDate),
    lastSeenAt: new Date(),
    isImported: true,
  };
}

export async function fetchBambooHrJobs(source: BambooHrSource) {
  if (!SUBDOMAIN.test(source.boardToken)) {
    throw new Error('BambooHR subdomain may only contain letters, numbers, underscores, and hyphens.');
  }
  const base = `https://${source.boardToken}.bamboohr.com/careers`;
  const listResponse = await fetch(`${base}/list`, {
    headers: { Accept: 'application/json' },
    next: { revalidate: 0 },
  });
  if (!listResponse.ok) throw new Error(`BambooHR returned ${listResponse.status} for subdomain ${source.boardToken}.`);
  const list = await listResponse.json() as BambooListResponse;
  if (!Array.isArray(list.result)) throw new Error('BambooHR response did not contain a result array.');

  // Enrich each summary with its full description, a few at a time so the
  // scheduled function stays polite to the public endpoint.
  const detailed: BambooJob[] = [];
  for (let start = 0; start < list.result.length; start += 6) {
    const chunk = list.result.slice(start, start + 6);
    const results = await Promise.all(chunk.map(async summary => {
      try {
        const response = await fetch(`${base}/${encodeURIComponent(String(summary.id))}/detail`, {
          headers: { Accept: 'application/json' },
          next: { revalidate: 0 },
        });
        if (!response.ok) return summary;
        const detail = await response.json() as BambooDetailResponse;
        const full = (detail.result ?? {}) as Partial<BambooJob> & { jobOpening?: Partial<BambooJob> };
        const merged: BambooJob = { ...summary, ...full.jobOpening, ...full, id: summary.id };
        return merged;
      } catch {
        return summary;
      }
    }));
    detailed.push(...results);
  }
  return detailed.map(job => normalizeBambooHrJob(job, source));
}
