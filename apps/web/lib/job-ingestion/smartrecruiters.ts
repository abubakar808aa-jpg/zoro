import type { ImportedJob } from './greenhouse';
import { inferCategory, inferRemote, inferRemoteType, inferType, sourceDocumentId, stripHtml, toDate } from './shared';

export type SmartRecruitersSource = { sourceKey: string; companyName?: string; careersUrl?: string; smartToken: string };
type SmartRecruitersJob = { id: string; uuid?: string; name: string; jobAdUrl?: string; applyUrl?: string; postedDate?: string; location?: { city?: string; region?: string; country?: string }; company?: { name?: string }; function?: { label?: string }; typeOfEmployment?: { label?: string }; jobAd?: { jobDescription?: string; qualifications?: string } };

export function normalizeSmartRecruitersJob(job: SmartRecruitersJob, source: SmartRecruitersSource): ImportedJob {
  const sourceJobId = job.uuid || job.id;
  const description = stripHtml([job.jobAd?.jobDescription, job.jobAd?.qualifications].filter(Boolean).join('\n\n'));
  const location = [job.location?.city, job.location?.region, job.location?.country].filter(Boolean).join(', ') || 'Location not listed';
  const companyName = job.company?.name || source.companyName || 'Employer';
  const context = `${job.name} ${job.function?.label ?? ''} ${description}`;
  return { id: sourceJobId, sourceDocumentId: sourceDocumentId('smartrecruiters', source.sourceKey, sourceJobId), title: job.name.trim(), description,
    type: inferType(`${job.typeOfEmployment?.label ?? ''} ${context}`), category: inferCategory(context), location, remote: inferRemote(`${location} ${context}`),
    remoteType: inferRemoteType(`${location} ${context}`),
    department: job.function?.label || undefined,
    requirements: [], skills: [], postedBy: 'jobman-import', postedByName: companyName, companyName, status: 'open', applicantCount: 0,
    sourceProvider: 'smartrecruiters', sourceJobId, sourceUrl: source.careersUrl || job.jobAdUrl || job.applyUrl, applyUrl: job.applyUrl || job.jobAdUrl,
    postedAt: toDate(job.postedDate),
    sourceUpdatedAt: toDate(job.postedDate), lastSeenAt: new Date(), isImported: true, raw: job };
}

export async function fetchSmartRecruitersJobs(source: SmartRecruitersSource) {
  if (!source.smartToken) throw new Error('smartToken is required for SmartRecruiters ingestion.');
  const jobs: SmartRecruitersJob[] = [];
  for (let offset = 0; offset < 10_000; offset += 100) {
    const response = await fetch(`https://api.smartrecruiters.com/feed/publications?limit=100&offset=${offset}`, {
      headers: { Accept: 'application/json', 'X-SmartToken': source.smartToken }, next: { revalidate: 0 },
    });
    if (!response.ok) throw new Error(`SmartRecruiters returned ${response.status}.`);
    const data = await response.json() as { jobs?: SmartRecruitersJob[]; totalFound?: number | string };
    if (!Array.isArray(data.jobs)) throw new Error('SmartRecruiters response did not contain a jobs array.');
    jobs.push(...data.jobs);
    const totalFound = Number(data.totalFound);
    if (data.jobs.length < 100 || (Number.isFinite(totalFound) && jobs.length >= totalFound)) break;
  }
  return jobs.map(job => normalizeSmartRecruitersJob(job, source));
}
