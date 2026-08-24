import type { ImportedJob } from './greenhouse.ts';
import { inferCategory, inferRemote, inferType, sourceDocumentId, stripHtml, toDate } from './shared.ts';

const API_URL = 'https://www.themuse.com/api/public/jobs';
const MAX_PAGES = 5;

export type TheMuseSource = {
  sourceKey: string;
  companyName: string;
  category?: string;
  location?: string;
  level?: string;
};

type Options = { apiKey?: string; maxPages?: number; timeoutMs?: number; fetchImpl?: typeof fetch; sleep?: (milliseconds: number) => Promise<void> };

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function text(value: unknown) { return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : ''; }
function names(value: unknown) { return Array.isArray(value) ? value.map(item => text(record(item)?.name)).filter(Boolean) : []; }

function museUrl(value: unknown) {
  try {
    const url = new URL(text(value));
    return url.protocol === 'https:' && (url.hostname === 'themuse.com' || url.hostname.endsWith('.themuse.com')) ? url.toString() : '';
  } catch { return ''; }
}

export function normalizeTheMuseResponse(value: unknown, source: TheMuseSource) {
  const root = record(value);
  if (!root || !Array.isArray(root.results)) throw new Error('The Muse did not return a valid paginated result.');
  const jobs = root.results.flatMap(raw => {
    const item = record(raw);
    if (!item) return [];
    const sourceJobId = text(item.id);
    const title = text(item.name);
    const landingPage = museUrl(record(item.refs)?.landing_page);
    const companyName = text(record(item.company)?.name) || source.companyName;
    if (!sourceJobId || !title || !landingPage || !companyName) return [];
    const description = stripHtml(text(item.contents));
    const locations = names(item.locations);
    const categories = names(item.categories);
    const levels = names(item.levels);
    const location = locations.join(', ') || 'Location not listed';
    const context = `${title} ${location} ${categories.join(' ')} ${levels.join(' ')} ${description}`;
    const job: ImportedJob = {
      id: sourceJobId,
      sourceDocumentId: sourceDocumentId('themuse', source.sourceKey, sourceJobId),
      title,
      description,
      type: inferType(context),
      category: inferCategory(context),
      location,
      remote: inferRemote(context),
      requirements: levels,
      skills: categories.slice(0, 10),
      postedBy: 'jobman-import',
      postedByName: companyName,
      status: 'open',
      applicantCount: 0,
      sourceProvider: 'themuse',
      sourceJobId,
      sourceUrl: landingPage,
      applyUrl: landingPage,
      sourceUpdatedAt: toDate(text(item.publication_date)),
      lastSeenAt: new Date(),
      rawProviderData: { id: sourceJobId, companyName, locations, categories, levels, publicationDate: text(item.publication_date) },
      sourceMetadata: { applyDestination: 'source' },
      isImported: true,
    };
    return [job];
  });
  return { jobs, pageCount: Math.max(1, Number(root.page_count) || 1) };
}

export async function fetchTheMuseJobs(source: TheMuseSource, options: Options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)));
  const maxPages = Math.min(MAX_PAGES, Math.max(1, options.maxPages ?? 3));
  const apiKey = options.apiKey ?? process.env.THE_MUSE_API_KEY;
  const byId = new Map<string, ImportedJob>();
  let pageCount = 1;
  for (let page = 0; page < Math.min(pageCount, maxPages); page += 1) {
    const url = new URL(API_URL);
    url.searchParams.set('page', String(page));
    if (source.category) url.searchParams.set('category', source.category.slice(0, 100));
    if (source.location) url.searchParams.set('location', source.location.slice(0, 100));
    if (source.level) url.searchParams.set('level', source.level.slice(0, 100));
    if (apiKey) url.searchParams.set('api_key', apiKey);
    let response: Response | undefined;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      response = await fetchImpl(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(options.timeoutMs ?? 10_000) });
      if (response.ok) break;
      if (![403, 429, 500, 502, 503, 504].includes(response.status) || attempt === 3) throw new Error(`The Muse request failed with HTTP ${response.status}.`);
      await sleep(250 * 2 ** (attempt - 1));
    }
    const normalized = normalizeTheMuseResponse(await response!.json(), source);
    pageCount = normalized.pageCount;
    normalized.jobs.forEach(job => byId.set(job.sourceJobId!, job));
  }
  return Array.from(byId.values());
}
