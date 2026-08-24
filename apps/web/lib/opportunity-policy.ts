export type InboxAuthorizationInput = {
  accountType?: string;
  profileType?: string;
  hasPreferences: boolean;
};

export type InboxAuthorization =
  | { allowed: true }
  | {
      allowed: false;
      code: 'SIGNED_OUT' | 'PROFESSIONAL_REQUIRED' | 'GIG_PROFILE_REQUIRED' | 'PREFERENCES_REQUIRED';
    };

export type OpportunityDecision = 'interested' | 'passed';
export type OpportunityPassReason =
  | 'SCHEDULE_CONFLICT'
  | 'TOO_FAR'
  | 'EARNINGS_TOO_LOW'
  | 'OUTSIDE_PREFERRED_SERVICES'
  | 'NOT_ENOUGH_INFORMATION'
  | 'OTHER';

export interface OpportunityResponse {
  decision: OpportunityDecision;
  passReason: OpportunityPassReason | null;
}

export type OpportunityResponseInput = {
  decision: OpportunityDecision;
  passReason?: OpportunityPassReason;
};

export type OpportunityResponseTransition =
  | { action: 'create'; response: OpportunityResponse }
  | { action: 'noop'; response: OpportunityResponse }
  | { action: 'conflict' };

const PASS_REASONS = new Set<OpportunityPassReason>([
  'SCHEDULE_CONFLICT',
  'TOO_FAR',
  'EARNINGS_TOO_LOW',
  'OUTSIDE_PREFERRED_SERVICES',
  'NOT_ENOUGH_INFORMATION',
  'OTHER',
]);

export function parseOpportunityResponseBody(
  rawBody: string,
  maxLength = 4_096,
): OpportunityResponseInput {
  if (rawBody.length > maxLength) {
    throw new Error('The opportunity response is too large.');
  }

  let value: unknown;
  try {
    value = JSON.parse(rawBody);
  } catch {
    throw new Error('The opportunity response must be valid JSON.');
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Choose interest or pass.');
  }

  const body = value as Record<string, unknown>;
  if (body.decision !== 'interested' && body.decision !== 'passed') {
    throw new Error('Choose interest or pass.');
  }
  if (body.passReason !== undefined && typeof body.passReason !== 'string') {
    throw new Error('Choose a valid pass reason.');
  }

  const input: OpportunityResponseInput = {
    decision: body.decision,
    ...(body.passReason !== undefined ? { passReason: body.passReason as OpportunityPassReason } : {}),
  };
  normalizeResponse(input);
  return input;
}

export function authorizeProfessionalInbox(input: InboxAuthorizationInput | null): InboxAuthorization {
  if (!input) return { allowed: false, code: 'SIGNED_OUT' };
  if (input.accountType !== 'worker') return { allowed: false, code: 'PROFESSIONAL_REQUIRED' };
  if (input.profileType !== 'gig') return { allowed: false, code: 'GIG_PROFILE_REQUIRED' };
  if (!input.hasPreferences) return { allowed: false, code: 'PREFERENCES_REQUIRED' };
  return { allowed: true };
}

function normalizeResponse(input: OpportunityResponseInput): OpportunityResponse {
  if (input.decision !== 'interested' && input.decision !== 'passed') {
    throw new Error('Invalid opportunity response decision.');
  }
  if (input.decision === 'interested') {
    if (input.passReason !== undefined) throw new Error('An interest response cannot include a pass reason.');
    return { decision: 'interested', passReason: null };
  }
  if (input.passReason !== undefined && !PASS_REASONS.has(input.passReason)) {
    throw new Error('Invalid pass reason.');
  }
  return { decision: 'passed', passReason: input.passReason ?? null };
}

export function decideResponseTransition(
  existing: OpportunityResponse | null,
  input: OpportunityResponseInput,
): OpportunityResponseTransition {
  const next = normalizeResponse(input);
  if (!existing) return { action: 'create', response: next };
  if (existing.decision === next.decision && existing.passReason === next.passReason) {
    return { action: 'noop', response: existing };
  }
  return { action: 'conflict' };
}

export function sanitizeScopeSummary(value: string): string {
  return value
    .slice(0, 2_000)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email removed]')
    .replace(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/g, '[phone removed]')
    .replace(
      /\b\d{1,6}\s+(?:[A-Za-z0-9.'-]+\s+){0,5}(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|court|ct|way)\b[^,.\n]*/gi,
      '[private address removed]',
    )
    .replace(/\b(?:gate|door|access|lockbox)\s*(?:code|pin)?\s*(?:is|:|#)?\s*[A-Za-z0-9-]{3,12}\b/gi, '[access detail removed]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 800);
}
