import type { JobListing, JobSource } from '@jobman/shared/src/types';
import { inferCategory, inferRemote, inferRemoteType, inferType, sourceDocumentId, stripHtml, toDate } from './shared';

const GREENHOUSE_API = 'https://boards-api.greenhouse.io/v1/boards';
const BOARD_TOKEN = /^[a-zA-Z0-9_-]+$/;

export type GreenhouseSource = Pick<JobSource, 'boardToken' | 'companyName' | 'careersUrl'>;

interface GreenhouseJob {
  id: number;
  title: string;
  content?: string;
  updated_at?: string;
  absolute_url: string;
  location?: { name?: string };
  departments?: Array<{ name?: string }>;
  offices?: Array<{ name?: string }>;
  metadata?: Array<{ name?: string; value?: string }>;
}

interface GreenhouseResponse { jobs: GreenhouseJob[]; }

export interface ImportedJob extends Omit<JobListing, 'id' | 'createdAt'> {
  id: string;
  sourceDocumentId: string;
  // Raw provider payload — persisted server-only to jobRaw/{docId} for
  // debugging; never written to the public jobs document.
  raw?: unknown;
}

export function greenhouseDocumentId(boardToken: string, jobId: number | string) {
  return sourceDocumentId('greenhouse', boardToken, jobId);
}

export function normalizeGreenhouseJob(job: GreenhouseJob, source: GreenhouseSource): ImportedJob {
  const description = stripHtml(job.content);
  const location = job.location?.name?.trim() || (inferRemote(`${job.title} ${description}`) ? 'Remote' : 'Location not listed');
  const department = job.departments?.map(d => d.name).filter(Boolean).join(', ') || '';
  const sourceDocumentId = greenhouseDocumentId(source.boardToken, job.id);

  return {
    id: String(job.id),
    sourceDocumentId,
    title: job.title.trim(),
    description,
    type: inferType(`${job.title} ${description}`),
    category: inferCategory(`${job.title} ${department} ${description}`),
    location,
    remote: inferRemote(`${job.title} ${location} ${description}`),
    remoteType: inferRemoteType(`${job.title} ${location} ${description}`),
    department: department || undefined,
    requirements: [],
    skills: [],
    postedBy: 'jobman-import',
    postedByName: source.companyName,
    companyName: source.companyName,
    status: 'open',
    applicantCount: 0,
    sourceProvider: 'greenhouse',
    sourceJobId: String(job.id),
    sourceUrl: source.careersUrl || job.absolute_url,
    applyUrl: job.absolute_url,
    postedAt: toDate(job.updated_at),
    sourceUpdatedAt: toDate(job.updated_at),
    lastSeenAt: new Date(),
    isImported: true,
    raw: job,
  };
}

export async function fetchGreenhouseJobs(source: GreenhouseSource) {
  if (!BOARD_TOKEN.test(source.boardToken)) {
    throw new Error('Greenhouse boardToken may only contain letters, numbers, underscores, and hyphens.');
  }

  const response = await fetch(`${GREENHOUSE_API}/${encodeURIComponent(source.boardToken)}/jobs?content=true`, {
    headers: { Accept: 'application/json' },
    next: { revalidate: 0 },
  });
  if (!response.ok) {
    throw new Error(`Greenhouse returned ${response.status} for board ${source.boardToken}.`);
  }

  const data = await response.json() as GreenhouseResponse;
  if (!Array.isArray(data.jobs)) throw new Error('Greenhouse response did not contain a jobs array.');
  return data.jobs.map(job => normalizeGreenhouseJob(job, source));
}
