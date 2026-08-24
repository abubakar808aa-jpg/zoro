import { XMLParser, XMLValidator } from 'fast-xml-parser';

import type { ImportedJob } from './greenhouse.ts';
import {
  inferCategory,
  inferRemote,
  inferType,
  sourceDocumentId,
  stripHtml,
  toDate,
} from './shared.ts';

export const PERSONIO_LANGUAGES = ['de', 'en', 'fr', 'es', 'nl', 'it', 'pt'] as const;
const PERSONIO_TENANT = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
const MAX_XML_BYTES = 5_000_000;
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_ATTEMPTS = 3;
const MAX_RETRY_DELAY_MS = 5_000;

export type PersonioLanguage = typeof PERSONIO_LANGUAGES[number];
export type PersonioSource = {
  sourceKey: string;
  companyName: string;
  careersUrl?: string;
  language?: PersonioLanguage;
};

type PersonioJobDescription = {
  name?: unknown;
  value?: unknown;
};

type PersonioPosition = {
  id?: unknown;
  subcompany?: unknown;
  office?: unknown;
  department?: unknown;
  recruitingCategory?: unknown;
  name?: unknown;
  jobDescriptions?: { jobDescription?: PersonioJobDescription | PersonioJobDescription[] } | unknown;
  employmentType?: unknown;
  seniority?: unknown;
  schedule?: unknown;
  yearsOfExperience?: unknown;
  keywords?: unknown;
  occupation?: unknown;
  occupationCategory?: unknown;
  createdAt?: unknown;
};

type ParsedPersonioFeed = {
  'workzag-jobs'?: { position?: PersonioPosition | PersonioPosition[] } | string;
};

export type PersonioConnectorErrorCode =
  | 'INVALID_CONFIGURATION'
  | 'INVALID_XML'
  | 'UNSAFE_XML'
  | 'PAYLOAD_TOO_LARGE'
  | 'UPSTREAM_ERROR'
  | 'REQUEST_FAILED';

export class PersonioConnectorError extends Error {
  readonly code: PersonioConnectorErrorCode;
  readonly status?: number;
  readonly retryable: boolean;

  constructor(
    message: string,
    code: PersonioConnectorErrorCode,
    status?: number,
    retryable = false,
  ) {
    super(message);
    this.name = 'PersonioConnectorError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

type PersonioFetchOptions = {
  fetchImpl?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
  maxAttempts?: number;
  timeoutMs?: number;
};

function stringValue(value: unknown) {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asArray<T>(value: T | T[] | undefined) {
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

export function isPersonioLanguage(value: unknown): value is PersonioLanguage {
  return typeof value === 'string' && PERSONIO_LANGUAGES.includes(value as PersonioLanguage);
}

function rawPositionData(position: PersonioPosition) {
  return {
    id: stringValue(position.id),
    subcompany: stringValue(position.subcompany),
    office: stringValue(position.office),
    department: stringValue(position.department),
    recruitingCategory: stringValue(position.recruitingCategory),
    name: stringValue(position.name),
    jobDescriptions: position.jobDescriptions,
    employmentType: stringValue(position.employmentType),
    seniority: stringValue(position.seniority),
    schedule: stringValue(position.schedule),
    yearsOfExperience: stringValue(position.yearsOfExperience),
    keywords: stringValue(position.keywords),
    occupation: stringValue(position.occupation),
    occupationCategory: stringValue(position.occupationCategory),
    createdAt: stringValue(position.createdAt),
  };
}

function descriptionText(position: PersonioPosition) {
  const descriptions = recordValue(position.jobDescriptions)?.jobDescription as PersonioJobDescription | PersonioJobDescription[] | undefined;
  return asArray(descriptions)
    .map(item => {
      const record = recordValue(item);
      if (!record) return '';
      const heading = stringValue(record.name);
      const body = stringValue(record.value);
      return [heading, body].filter(Boolean).join('\n');
    })
    .filter(Boolean)
    .join('\n\n');
}

export function personioFeedUrl(source: PersonioSource) {
  if (!PERSONIO_TENANT.test(source.sourceKey)) {
    throw new PersonioConnectorError(
      'Personio tenant contains unsupported characters.',
      'INVALID_CONFIGURATION',
    );
  }
  const language = source.language ?? 'en';
  if (!isPersonioLanguage(language)) {
    throw new PersonioConnectorError(
      'Personio source uses an unsupported language.',
      'INVALID_CONFIGURATION',
    );
  }
  return `https://${source.sourceKey}.jobs.personio.de/xml?language=${language}`;
}

export function normalizePersonioPosition(position: PersonioPosition, source: PersonioSource): ImportedJob | null {
  const sourceJobId = stringValue(position.id);
  const title = stringValue(position.name);
  if (!sourceJobId || !title) return null;

  const rawDescription = descriptionText(position);
  const description = stripHtml(rawDescription);
  const location = stringValue(position.office) || (inferRemote(`${title} ${description}`) ? 'Remote' : 'Location not listed');
  const employmentType = stringValue(position.employmentType);
  const schedule = stringValue(position.schedule);
  const department = stringValue(position.department);
  const category = stringValue(position.recruitingCategory);
  const keywords = stringValue(position.keywords);
  const context = `${title} ${department} ${category} ${employmentType} ${schedule} ${keywords} ${description}`;
  // Personio's official integration guide defines this as the public job-detail URL.
  // Source: https://developer.personio.de/docs/integration-of-open-positions
  const detailUrl = `https://${source.sourceKey}.jobs.personio.de/job/${encodeURIComponent(sourceJobId)}`;

  return {
    id: sourceJobId,
    sourceDocumentId: sourceDocumentId('personio', source.sourceKey, sourceJobId),
    title,
    description,
    type: inferType(`${schedule} ${employmentType} ${context}`),
    category: inferCategory(context),
    location,
    remote: inferRemote(`${location} ${context}`),
    requirements: [],
    skills: keywords.split(',').map(item => item.trim()).filter(Boolean).slice(0, 20),
    postedBy: 'jobman-import',
    postedByName: source.companyName,
    status: 'open',
    applicantCount: 0,
    sourceProvider: 'personio',
    sourceJobId,
    sourceUrl: detailUrl,
    applyUrl: detailUrl,
    sourceUpdatedAt: toDate(stringValue(position.createdAt)),
    lastSeenAt: new Date(),
    rawProviderData: rawPositionData(position),
    isImported: true,
  };
}

export function parsePersonioXml(xml: string, source: PersonioSource) {
  personioFeedUrl(source);
  if (new TextEncoder().encode(xml).byteLength > MAX_XML_BYTES) {
    throw new PersonioConnectorError('Personio XML feed exceeded the 5 MB safety limit.', 'PAYLOAD_TOO_LARGE');
  }
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) {
    throw new PersonioConnectorError('Personio XML feed contained a forbidden document or entity declaration.', 'UNSAFE_XML');
  }

  const validation = XMLValidator.validate(xml);
  if (validation !== true) {
    throw new PersonioConnectorError('Personio returned malformed XML.', 'INVALID_XML');
  }

  let parsed: ParsedPersonioFeed;
  try {
    parsed = new XMLParser({
      ignoreAttributes: true,
      parseTagValue: false,
      trimValues: true,
      processEntities: true,
      isArray: (tagName, jPath) => jPath === 'workzag-jobs.position'
        || jPath === 'workzag-jobs.position.jobDescriptions.jobDescription',
    }).parse(xml) as ParsedPersonioFeed;
  } catch {
    throw new PersonioConnectorError('Personio XML could not be parsed.', 'INVALID_XML');
  }

  const root = parsed['workzag-jobs'];
  if (root === '') return [];
  if (root === undefined) {
    throw new PersonioConnectorError('Personio XML did not contain a workzag-jobs root.', 'INVALID_XML');
  }
  const rootRecord = recordValue(root);
  if (!rootRecord) {
    throw new PersonioConnectorError('Personio XML did not contain a valid workzag-jobs root.', 'INVALID_XML');
  }

  const normalized = asArray(rootRecord.position as PersonioPosition | PersonioPosition[] | undefined)
    .map(position => normalizePersonioPosition(position, source))
    .filter((job): job is ImportedJob => job !== null);
  const bySourceId = new Map(normalized.map(job => [job.sourceJobId, job]));
  return Array.from(bySourceId.values());
}

function retryDelay(response: Response, attempt: number) {
  const retryAfter = Number(response.headers.get('retry-after'));
  if (Number.isFinite(retryAfter) && retryAfter >= 0) {
    return Math.min(retryAfter * 1_000, MAX_RETRY_DELAY_MS);
  }
  return Math.min(250 * (2 ** (attempt - 1)), MAX_RETRY_DELAY_MS);
}

function wait(milliseconds: number) {
  return new Promise<void>(resolve => setTimeout(resolve, milliseconds));
}

export async function fetchPersonioJobs(source: PersonioSource, options: PersonioFetchOptions = {}) {
  const url = personioFeedUrl(source);
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? wait;
  const maxAttempts = Math.max(1, Math.min(options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS, 5));
  const timeoutMs = Math.max(100, Math.min(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, 30_000));

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, {
        headers: { Accept: 'application/xml, text/xml;q=0.9' },
        cache: 'no-store',
        signal: controller.signal,
      });
      const contentLength = Number(response.headers.get('content-length'));
      if (Number.isFinite(contentLength) && contentLength > MAX_XML_BYTES) {
        await response.body?.cancel();
        throw new PersonioConnectorError('Personio XML feed exceeded the 5 MB safety limit.', 'PAYLOAD_TOO_LARGE', response.status);
      }
      if (response.ok) return parsePersonioXml(await response.text(), source);

      const retryable = response.status === 429 || response.status >= 500;
      await response.body?.cancel();
      const error = new PersonioConnectorError(
        `Personio returned ${response.status} for tenant ${source.sourceKey}.`,
        'UPSTREAM_ERROR',
        response.status,
        retryable,
      );
      if (!retryable || attempt === maxAttempts) throw error;
      await sleep(retryDelay(response, attempt));
    } catch (cause) {
      if (cause instanceof PersonioConnectorError) throw cause;
      const error = new PersonioConnectorError(
        controller.signal.aborted
          ? `Personio request timed out for tenant ${source.sourceKey}.`
          : `Personio request failed for tenant ${source.sourceKey}.`,
        'REQUEST_FAILED',
        undefined,
        true,
      );
      if (attempt === maxAttempts) throw error;
      await sleep(Math.min(250 * (2 ** (attempt - 1)), MAX_RETRY_DELAY_MS));
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new PersonioConnectorError('Personio request exhausted its retry budget.', 'REQUEST_FAILED', undefined, true);
}
