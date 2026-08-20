import type { ImportedJob } from './greenhouse';
import { inferCategory, inferRemote, inferType, sourceDocumentId, stripHtml, toDate } from './shared';
import { extractBlocks, tag } from '@/lib/xml';

// Personio publishes each customer's open roles as a public, no-auth XML feed:
//   https://{company}.jobs.personio.de/xml
// Positions are <position> elements; the description lives in a <jobDescriptions>
// block of CDATA-wrapped HTML sections. There is no per-job apply URL in the feed,
// so we build the canonical listing URL from the company slug and job id.

export type PersonioSource = { sourceKey: string; companyName: string; careersUrl?: string };
const COMPANY_KEY = /^[a-zA-Z0-9_-]+$/;

function positionDescription(block: string) {
  const [section = ''] = extractBlocks(block, 'jobDescriptions');
  // Unwrap CDATA so the HTML inside becomes visible to stripHtml (which keeps
  // paragraph breaks), then flatten to clean text.
  const unwrapped = section.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  return stripHtml(unwrapped);
}

export function normalizePersonioPosition(block: string, source: PersonioSource): ImportedJob {
  const id = tag(block, ['id']) || '';
  const title = (tag(block, ['name']) || 'Untitled role').trim();
  const office = tag(block, ['office']);
  const department = tag(block, ['department']);
  const schedule = tag(block, ['schedule']);
  const employmentType = tag(block, ['employmentType']);
  const createdAt = tag(block, ['createdAt']);
  const description = positionDescription(block);
  const location = office || (inferRemote(`${title} ${description}`) ? 'Remote' : 'Location not listed');
  const context = `${title} ${department} ${description}`;
  const jobUrl = `${source.careersUrl?.replace(/\/$/, '') || `https://${source.sourceKey}.jobs.personio.com`}/job/${encodeURIComponent(id)}`;
  return {
    id,
    sourceDocumentId: sourceDocumentId('personio', source.sourceKey, id),
    title,
    description,
    type: inferType(`${schedule} ${employmentType} ${context}`),
    category: inferCategory(context),
    location,
    remote: inferRemote(`${location} ${context}`),
    requirements: [],
    skills: [],
    postedBy: 'jobman-import',
    postedByName: source.companyName,
    status: 'open',
    applicantCount: 0,
    sourceProvider: 'personio',
    sourceJobId: id,
    sourceUrl: source.careersUrl || jobUrl,
    applyUrl: jobUrl,
    sourceUpdatedAt: toDate(createdAt),
    lastSeenAt: new Date(),
    isImported: true,
  };
}

export async function fetchPersonioJobs(source: PersonioSource) {
  if (!COMPANY_KEY.test(source.sourceKey)) {
    throw new Error('Personio company key may only contain letters, numbers, underscores, and hyphens.');
  }
  const response = await fetch(`https://${source.sourceKey}.jobs.personio.de/xml`, {
    headers: { Accept: 'application/xml, text/xml' },
    next: { revalidate: 0 },
  });
  if (!response.ok) throw new Error(`Personio returned ${response.status} for company ${source.sourceKey}.`);
  const xml = await response.text();
  const positions = extractBlocks(xml, 'position');
  return positions
    .map(block => normalizePersonioPosition(block, source))
    .filter(job => Boolean(job.id) && Boolean(job.title));
}
