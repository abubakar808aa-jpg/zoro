// Pure normalization helpers for job ingestion. Deliberately dependency-free
// (only node:crypto) so they can be unit-tested directly with Node's test
// runner via --experimental-strip-types (see firestore-tests/normalize.test.mjs).
import { createHash } from 'node:crypto';

type EmploymentType = 'gig' | 'fulltime' | 'parttime' | 'contract';
type RemoteType = 'remote' | 'hybrid' | 'onsite';

export function stripHtml(content = '') {
  return content
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function toDate(value?: string | number) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export function sourceDocumentId(provider: string, sourceKey: string, jobId: string | number) {
  return `${provider}_${sourceKey}_${jobId}`.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function inferType(value = ''): EmploymentType {
  const text = value.toLowerCase();
  if (/\b(part[ -]?time|part time)\b/.test(text)) return 'parttime';
  if (/\b(contract|contractor|freelance)\b/.test(text)) return 'contract';
  if (/\b(gig|temporary|seasonal|intern)\b/.test(text)) return 'gig';
  return 'fulltime';
}

export function inferRemote(value = '') {
  return /\b(remote|distributed|work from home|anywhere|hybrid)\b/i.test(value);
}

export function inferRemoteType(value = ''): RemoteType {
  if (/\bhybrid\b/i.test(value)) return 'hybrid';
  if (/\b(remote|distributed|work from home|anywhere)\b/i.test(value)) return 'remote';
  return 'onsite';
}

export function inferCategory(value = '') {
  const text = value.toLowerCase();
  if (/engineer|developer|software|data |security|devops|product manager/.test(text)) return 'technology';
  if (/design|ux|ui|creative/.test(text)) return 'design';
  if (/marketing|sales|growth|account executive/.test(text)) return 'marketing';
  if (/finance|accounting|payroll/.test(text)) return 'finance';
  if (/legal|counsel|attorney/.test(text)) return 'legal';
  if (/nurs|health|clinical|medical/.test(text)) return 'healthcare';
  if (/human resources|recruit|people operations/.test(text)) return 'hr';
  return 'other_pro';
}

// Company slug used as companyId and in the dedupe fingerprint. Strips legal
// suffixes so "Acme Inc." and "Acme" collapse to the same company.
export function slugifyCompany(name = '') {
  return name
    .toLowerCase()
    .replace(/[,.]/g, ' ')
    .replace(/\b(inc|incorporated|llc|ltd|limited|corp|corporation|co|gmbh|plc)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeToken(value = '') {
  return value
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')          // drop parentheticals like "(Remote)"
    .replace(/\b(sr|senior|jr|junior|lead|staff|principal)\b/g, m => m) // keep seniority — different roles
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeLocation(value = '') {
  const text = normalizeToken(value);
  if (/\b(remote|anywhere|distributed)\b/.test(text)) return 'remote';
  // First locality only: "Austin, TX, United States" → "austin"
  return text.split(' ')[0] ?? '';
}

// Dedupe fingerprint: normalized company + title + location + employment type.
// Description similarity is used only as a tie-breaker (see descriptionSimilarity).
export function computeFingerprint(input: {
  companyName?: string;
  title?: string;
  location?: string;
  type?: string;
}) {
  const material = [
    slugifyCompany(input.companyName ?? ''),
    normalizeToken(input.title ?? ''),
    normalizeLocation(input.location ?? ''),
    (input.type ?? '').toLowerCase(),
  ].join('|');
  return createHash('sha256').update(material).digest('hex').slice(0, 32);
}

// Jaccard similarity over word shingles — cheap tie-breaker when multiple
// listings share a fingerprint. 1 = identical token sets, 0 = disjoint.
export function descriptionSimilarity(a = '', b = '') {
  const tokens = (s: string) => new Set(normalizeToken(s).split(' ').filter(w => w.length > 3));
  const setA = tokens(a);
  const setB = tokens(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  setA.forEach(t => { if (setB.has(t)) intersection++; });
  return intersection / (setA.size + setB.size - intersection);
}
