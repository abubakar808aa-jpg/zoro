import type { ImportedJob } from './greenhouse';
import { inferCategory, inferRemote, inferType, sourceDocumentId, stripHtml, toDate } from './shared';

// Remotive is a free, no-auth aggregator of remote jobs across many employers:
//   https://remotive.com/api/remote-jobs   (optional ?category=&limit=)
// Unlike the per-company ATS connectors, one source yields jobs from many
// companies, so each job carries its own employer name (postedByName).

export type RemotiveSource = { companyName: string; sourceKey?: string; careersUrl?: string; category?: string };

type RemotiveJob = {
  id: number | string;
  url?: string;
  title?: string;
  company_name?: string;
  category?: string;
  tags?: string[];
  job_type?: string;
  publication_date?: string;
  candidate_required_location?: string;
  salary?: string;
  description?: string;
};

type RemotiveResponse = { jobs?: RemotiveJob[] };

// "$100,000 - $120,000" / "$50 - $70 per hour" → a structured range when parseable.
function parseSalary(raw?: string): ImportedJob['salary'] {
  if (!raw) return undefined;
  const numbers = raw.replace(/,/g, '').match(/\d+(?:\.\d+)?/g);
  if (!numbers || numbers.length < 2) return undefined;
  const min = Number(numbers[0]);
  const max = Number(numbers[1]);
  if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) return undefined;
  const period = /hour|hr|\/h/i.test(raw) ? 'hourly' : 'annual';
  return { min, max, period };
}

export function normalizeRemotiveJob(job: RemotiveJob, source: RemotiveSource): ImportedJob {
  const title = (job.title || 'Untitled role').trim();
  const company = job.company_name?.trim() || source.companyName;
  const description = stripHtml(job.description || '');
  const location = job.candidate_required_location?.trim() || 'Remote';
  const commitment = (job.job_type || '').replace(/_/g, ' ');
  const context = `${title} ${job.category ?? ''} ${(job.tags ?? []).join(' ')} ${description}`;
  return {
    id: String(job.id),
    sourceDocumentId: sourceDocumentId('remotive', source.sourceKey || 'remotive', job.id),
    title,
    description,
    type: inferType(`${commitment} ${context}`),
    category: inferCategory(context),
    location,
    remote: true,
    salary: parseSalary(job.salary),
    requirements: [],
    skills: (job.tags ?? []).slice(0, 8),
    postedBy: 'jobman-import',
    postedByName: company,
    status: 'open',
    applicantCount: 0,
    sourceProvider: 'remotive',
    sourceJobId: String(job.id),
    sourceUrl: job.url,
    applyUrl: job.url,
    sourceUpdatedAt: toDate(job.publication_date),
    lastSeenAt: new Date(),
    isImported: true,
  };
}

export async function fetchRemotiveJobs(source: RemotiveSource) {
  const params = new URLSearchParams();
  if (source.category) params.set('category', source.category);
  const query = params.toString();
  const response = await fetch(`https://remotive.com/api/remote-jobs${query ? `?${query}` : ''}`, {
    headers: { Accept: 'application/json' },
    next: { revalidate: 0 },
  });
  if (!response.ok) throw new Error(`Remotive returned ${response.status}.`);
  const data = await response.json() as RemotiveResponse;
  if (!Array.isArray(data.jobs)) throw new Error('Remotive response did not contain a jobs array.');
  return data.jobs.map(job => normalizeRemotiveJob(job, source));
}
