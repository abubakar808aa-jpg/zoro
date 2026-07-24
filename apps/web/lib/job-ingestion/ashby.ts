import type { JobSource } from '@jobman/shared/src/types';
import type { ImportedJob } from './greenhouse';
import { inferCategory, inferRemote, inferRemoteType, inferType, sourceDocumentId, stripHtml, toDate } from './shared';

export type AshbySource = Pick<JobSource, 'boardToken' | 'companyName' | 'careersUrl'>;
type AshbyJob = { id?: string; title: string; location?: string; department?: string; team?: string; isListed?: boolean; isRemote?: boolean; workplaceType?: string; descriptionPlain?: string; descriptionHtml?: string; publishedAt?: string; employmentType?: string; jobUrl?: string; applyUrl?: string; compensation?: { summaryComponents?: Array<{ compensationType?: string; interval?: string; currencyCode?: string; minValue?: number; maxValue?: number }> } };

function salary(job: AshbyJob) {
  const component = job.compensation?.summaryComponents?.find(item => item.compensationType === 'Salary' && typeof item.minValue === 'number' && typeof item.maxValue === 'number');
  if (!component) return undefined;
  const period: 'hourly' | 'annual' = /hour/i.test(component.interval ?? '') ? 'hourly' : 'annual';
  return { min: component.minValue!, max: component.maxValue!, period, ...(component.currencyCode ? { currency: component.currencyCode } : {}) };
}

export function normalizeAshbyJob(job: AshbyJob, source: AshbySource): ImportedJob {
  const sourceJobId = job.id || job.jobUrl || job.applyUrl;
  if (!sourceJobId) throw new Error(`Ashby job ${job.title} has no stable identifier.`);
  const description = stripHtml(job.descriptionPlain || job.descriptionHtml || '');
  const context = `${job.title} ${job.department ?? ''} ${job.team ?? ''} ${description}`;
  const location = job.location || (job.isRemote || job.workplaceType === 'Remote' ? 'Remote' : 'Location not listed');
  return { id: sourceJobId, sourceDocumentId: sourceDocumentId('ashby', source.boardToken, sourceJobId), title: job.title.trim(), description,
    type: inferType(`${job.employmentType ?? ''} ${context}`), category: inferCategory(context), location,
    remote: Boolean(job.isRemote) || /remote|hybrid/i.test(job.workplaceType ?? '') || inferRemote(`${location} ${context}`), salary: salary(job),
    remoteType: job.isRemote || job.workplaceType === 'Remote' ? 'remote'
      : /hybrid/i.test(job.workplaceType ?? '') ? 'hybrid'
      : inferRemoteType(`${location} ${context}`),
    department: job.department || job.team || undefined,
    requirements: [], skills: [], postedBy: 'jobman-import', postedByName: source.companyName, companyName: source.companyName,
    status: 'open', applicantCount: 0,
    sourceProvider: 'ashby', sourceJobId, sourceUrl: source.careersUrl || job.jobUrl || job.applyUrl, applyUrl: job.applyUrl || job.jobUrl,
    postedAt: toDate(job.publishedAt),
    sourceUpdatedAt: toDate(job.publishedAt), lastSeenAt: new Date(), isImported: true, raw: job };
}

export async function fetchAshbyJobs(source: AshbySource) {
  if (!/^[a-zA-Z0-9_-]+$/.test(source.boardToken)) throw new Error('Ashby boardToken contains unsupported characters.');
  const response = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(source.boardToken)}?includeCompensation=true`, { headers: { Accept: 'application/json' }, next: { revalidate: 0 } });
  if (!response.ok) throw new Error(`Ashby returned ${response.status} for board ${source.boardToken}.`);
  const data = await response.json() as { jobs?: AshbyJob[] };
  if (!Array.isArray(data.jobs)) throw new Error('Ashby response did not contain a jobs array.');
  return data.jobs.filter(job => job.isListed !== false).map(job => normalizeAshbyJob(job, source));
}
