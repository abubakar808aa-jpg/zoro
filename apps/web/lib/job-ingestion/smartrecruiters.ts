import type { ImportedJob } from './greenhouse';
import { inferCategory, inferRemote, inferType, sourceDocumentId, stripHtml, toDate } from './shared';

export type SmartRecruitersSource = { sourceKey: string; companyName?: string; careersUrl?: string };
type SmartRecruitersJob = {
  id: string;
  uuid?: string;
  name: string;
  postingUrl?: string;
  applyUrl?: string;
  releasedDate?: string;
  location?: { city?: string; region?: string; country?: string; fullLocation?: string; remote?: boolean; hybrid?: boolean };
  company?: { identifier?: string; name?: string };
  function?: { label?: string };
  department?: { label?: string };
  typeOfEmployment?: { label?: string };
  jobAd?: { sections?: { jobDescription?: { text?: string }; qualifications?: { text?: string } } };
};

export function normalizeSmartRecruitersJob(job: SmartRecruitersJob, source: SmartRecruitersSource): ImportedJob {
  const sourceJobId = job.uuid || job.id;
  const description = stripHtml([
    job.jobAd?.sections?.jobDescription?.text,
    job.jobAd?.sections?.qualifications?.text,
  ].filter(Boolean).join('\n\n'));
  const location = job.location?.fullLocation || [job.location?.city, job.location?.region, job.location?.country].filter(Boolean).join(', ') || 'Location not listed';
  const companyName = job.company?.name || source.companyName || 'Employer';
  const companyIdentifier = job.company?.identifier || source.sourceKey;
  const stablePostingUrl = `https://jobs.smartrecruiters.com/${encodeURIComponent(companyIdentifier)}/${encodeURIComponent(job.id)}`;
  const context = `${job.name} ${job.function?.label ?? ''} ${job.department?.label ?? ''} ${description}`;
  return { id: sourceJobId, sourceDocumentId: sourceDocumentId('smartrecruiters', source.sourceKey, sourceJobId), title: job.name.trim(), description,
    type: inferType(`${job.typeOfEmployment?.label ?? ''} ${context}`), category: inferCategory(context), location,
    remote: Boolean(job.location?.remote || job.location?.hybrid) || inferRemote(`${location} ${context}`),
    requirements: [], skills: [], postedBy: 'jobman-import', postedByName: companyName, status: 'open', applicantCount: 0,
    sourceProvider: 'smartrecruiters', sourceJobId, sourceUrl: job.postingUrl || source.careersUrl || stablePostingUrl, applyUrl: job.applyUrl || `${stablePostingUrl}?oga=true`,
    sourceUpdatedAt: toDate(job.releasedDate), lastSeenAt: new Date(), isImported: true };
}

export async function fetchSmartRecruitersJobs(source: SmartRecruitersSource) {
  if (!/^[a-zA-Z0-9_-]+$/.test(source.sourceKey)) throw new Error('SmartRecruiters company identifier contains unsupported characters.');
  const jobs: SmartRecruitersJob[] = [];
  for (let offset = 0; offset < 10_000; offset += 100) {
    const response = await fetch(`https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(source.sourceKey)}/postings?limit=100&offset=${offset}`, {
      headers: { Accept: 'application/json' }, next: { revalidate: 0 },
    });
    if (!response.ok) throw new Error(`SmartRecruiters returned ${response.status} for company ${source.sourceKey}.`);
    const data = await response.json() as { content?: SmartRecruitersJob[]; totalFound?: number | string };
    if (!Array.isArray(data.content)) throw new Error('SmartRecruiters response did not contain a content array.');
    jobs.push(...data.content);
    const totalFound = Number(data.totalFound);
    if (data.content.length < 100 || (Number.isFinite(totalFound) && jobs.length >= totalFound)) break;
  }

  // Listing responses omit descriptions and the canonical apply URL. Fetch
  // details in small parallel groups so the scheduled function stays polite
  // to the public API and does not serialize hundreds of requests.
  const detailed: SmartRecruitersJob[] = [];
  for (let start = 0; start < jobs.length; start += 6) {
    const chunk = jobs.slice(start, start + 6);
    const results = await Promise.all(chunk.map(async job => {
      const response = await fetch(`https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(source.sourceKey)}/postings/${encodeURIComponent(job.id)}`, {
        headers: { Accept: 'application/json' }, next: { revalidate: 0 },
      });
      if (!response.ok) return job;
      return await response.json() as SmartRecruitersJob;
    }));
    detailed.push(...results);
  }
  return detailed.map(job => normalizeSmartRecruitersJob(job, source));
}
