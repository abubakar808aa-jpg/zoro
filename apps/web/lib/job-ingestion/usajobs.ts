import type { ImportedJob } from './greenhouse.ts';
import { inferCategory, inferRemote, inferType, sourceDocumentId, stripHtml, toDate } from './shared.ts';

const USAJOBS_SEARCH_API = 'https://data.usajobs.gov/api/Search';
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_PAGES = 3;
const MAX_PAGES = 5;
const RESULTS_PER_PAGE = 100;

export type UsaJobsSource = {
  sourceKey: string;
  companyName: string;
  keyword?: string;
  location?: string;
};

type UsaJobsDescriptor = Record<string, unknown>;
type FetchOptions = {
  apiKey?: string;
  userAgent?: string;
  fetchImpl?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
  maxPages?: number;
  timeoutMs?: number;
};

export class UsaJobsConnectorError extends Error {
  readonly code: 'MISSING_CONFIGURATION' | 'INVALID_RESPONSE' | 'UPSTREAM_ERROR';
  readonly status?: number;

  constructor(code: 'MISSING_CONFIGURATION' | 'INVALID_RESPONSE' | 'UPSTREAM_ERROR', message: string, status?: number) {
    super(message);
    this.name = 'UsaJobsConnectorError';
    this.code = code;
    this.status = status;
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function text(value: unknown) {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

function records(value: unknown) {
  return Array.isArray(value) ? value.map(record).filter(Boolean) as Record<string, unknown>[] : [];
}

function names(value: unknown) {
  return records(value).map(item => text(item.Name)).filter(Boolean);
}

function safeExternalUrl(value: unknown, allowedHosts: string[]) {
  try {
    const url = new URL(text(value));
    return url.protocol === 'https:' && allowedHosts.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`)) ? url.toString() : '';
  } catch {
    return '';
  }
}

function salary(value: unknown): ImportedJob['salary'] {
  const item = records(value)[0];
  if (!item) return undefined;
  const min = Number(item.MinimumRange);
  const max = Number(item.MaximumRange);
  const interval = text(item.RateIntervalCode).toLowerCase();
  if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < min) return undefined;
  if (/year|annual/.test(interval)) return { min, max, period: 'annual' };
  if (/hour/.test(interval)) return { min, max, period: 'hourly' };
  return undefined;
}

function normalizeDescriptor(descriptor: UsaJobsDescriptor, source: UsaJobsSource): ImportedJob | null {
  const sourceJobId = text(descriptor.PositionID);
  const title = text(descriptor.PositionTitle);
  const sourceUrl = safeExternalUrl(descriptor.PositionURI, ['usajobs.gov']);
  if (!sourceJobId || !title || !sourceUrl) return null;
  const details = record(record(descriptor.UserArea)?.Details);
  const duties = Array.isArray(details?.MajorDuties) ? details.MajorDuties.map(text).filter(Boolean) : [];
  const qualification = text(descriptor.QualificationSummary);
  const description = stripHtml([qualification, ...duties].filter(Boolean).join('\n\n'));
  const location = text(descriptor.PositionLocationDisplay) || 'Location not listed';
  const agency = text(descriptor.OrganizationName) || text(descriptor.DepartmentName) || source.companyName;
  const schedules = names(descriptor.PositionSchedule);
  const offeringTypes = names(descriptor.PositionOfferingType);
  const context = `${title} ${location} ${schedules.join(' ')} ${offeringTypes.join(' ')} ${description}`;
  const applyCandidates = Array.isArray(descriptor.ApplyURI) ? descriptor.ApplyURI : [];
  const applyUrl = applyCandidates.map(item => safeExternalUrl(item, ['usajobs.gov'])).find(Boolean) || sourceUrl;

  return {
    id: sourceJobId,
    sourceDocumentId: sourceDocumentId('usajobs', source.sourceKey, sourceJobId),
    title,
    description,
    type: inferType(context),
    category: inferCategory(context),
    location,
    remote: details?.RemoteIndicator === true || inferRemote(context),
    salary: salary(descriptor.PositionRemuneration),
    requirements: qualification ? [qualification] : [],
    skills: [],
    postedBy: 'jobman-import',
    postedByName: agency,
    status: 'open',
    applicantCount: 0,
    sourceProvider: 'usajobs',
    sourceJobId,
    sourceUrl,
    applyUrl,
    sourceUpdatedAt: toDate(text(descriptor.PublicationStartDate)),
    lastSeenAt: new Date(),
    rawProviderData: {
      positionId: sourceJobId,
      departmentName: text(descriptor.DepartmentName),
      organizationName: agency,
      publicationStartDate: text(descriptor.PublicationStartDate),
      applicationCloseDate: text(descriptor.ApplicationCloseDate),
      schedules,
      offeringTypes,
    },
    sourceMetadata: { federal: true },
    isImported: true,
  };
}

export function normalizeUsaJobsResponse(value: unknown, source: UsaJobsSource) {
  const result = record(record(value)?.SearchResult);
  if (!result || !Array.isArray(result.SearchResultItems)) {
    throw new UsaJobsConnectorError('INVALID_RESPONSE', 'USAJOBS did not return a valid search result.');
  }
  const jobs = result.SearchResultItems.flatMap(item => {
    const descriptor = record(record(item)?.MatchedObjectDescriptor);
    const job = descriptor ? normalizeDescriptor(descriptor, source) : null;
    return job ? [job] : [];
  });
  return { jobs, total: Math.max(0, Number(result.SearchResultCountAll) || jobs.length) };
}

async function fetchPage(url: URL, headers: HeadersInit, options: Required<Pick<FetchOptions, 'fetchImpl' | 'sleep' | 'timeoutMs'>>) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await options.fetchImpl(url, { headers, signal: AbortSignal.timeout(options.timeoutMs) });
    if (response.ok) return response.json();
    if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 3) {
      throw new UsaJobsConnectorError('UPSTREAM_ERROR', `USAJOBS request failed with HTTP ${response.status}.`, response.status);
    }
    const retryAfter = Number(response.headers.get('Retry-After'));
    await options.sleep(Number.isFinite(retryAfter) ? retryAfter * 1_000 : 250 * 2 ** (attempt - 1));
  }
  throw new UsaJobsConnectorError('UPSTREAM_ERROR', 'USAJOBS request failed.');
}

export async function fetchUsaJobs(source: UsaJobsSource, options: FetchOptions = {}) {
  const apiKey = options.apiKey ?? process.env.USAJOBS_API_KEY ?? '';
  const userAgent = options.userAgent ?? process.env.USAJOBS_USER_AGENT ?? '';
  if (!apiKey || !userAgent) {
    throw new UsaJobsConnectorError('MISSING_CONFIGURATION', 'USAJOBS server credentials are not configured.');
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)));
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxPages = Math.min(MAX_PAGES, Math.max(1, options.maxPages ?? DEFAULT_MAX_PAGES));
  const headers = { Accept: 'application/json', Host: 'data.usajobs.gov', 'User-Agent': userAgent, 'Authorization-Key': apiKey };
  const byId = new Map<string, ImportedJob>();
  let total = 0;
  for (let page = 1; page <= maxPages; page += 1) {
    const url = new URL(USAJOBS_SEARCH_API);
    if (source.keyword) url.searchParams.set('Keyword', source.keyword.slice(0, 100));
    if (source.location) url.searchParams.set('LocationName', source.location.slice(0, 100));
    url.searchParams.set('Page', String(page));
    url.searchParams.set('ResultsPerPage', String(RESULTS_PER_PAGE));
    const normalized = normalizeUsaJobsResponse(await fetchPage(url, headers, { fetchImpl, sleep, timeoutMs }), source);
    total = normalized.total;
    normalized.jobs.forEach(job => byId.set(job.sourceJobId!, job));
    if (page * RESULTS_PER_PAGE >= total || normalized.jobs.length === 0) break;
  }
  return Array.from(byId.values());
}
