import { createHash, randomUUID } from 'node:crypto';

import { FieldValue, type DocumentData, type DocumentSnapshot, type Firestore } from 'firebase-admin/firestore';

import {
  MATCH_REASON_LABELS,
  type OpportunityApiError,
  type OpportunityCard,
} from './opportunity-contracts';
import {
  calculateOpportunityEligibility,
  resolveBayAreaCityLocation,
  type OpportunityEligibility,
  type OpportunityMatchInput,
} from './opportunity-matcher';
import {
  authorizeProfessionalInbox,
  sanitizeScopeSummary,
  type OpportunityResponse,
} from './opportunity-policy';

export type OpportunityApiErrorCode = OpportunityApiError['error']['code'];
export type MarketplaceEventName =
  | 'opportunity_shown'
  | 'match_excluded'
  | 'interest_expressed'
  | 'opportunity_passed'
  | 'matching_calculation_failure';

export class OpportunityApiException extends Error {
  constructor(
    public readonly status: number,
    public readonly code: OpportunityApiErrorCode,
    message: string,
    public readonly reasonCode?: OpportunityApiError['error']['reasonCode'],
  ) {
    super(message);
  }
}

export interface ProfessionalMatchContext {
  uid: string;
  matchProfessional: OpportunityMatchInput['professional'];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function dollarsToMinor(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  const minor = Math.round(value * 100);
  if (!Number.isSafeInteger(minor) || Math.abs(minor / 100 - value) > 0.000001) return null;
  return minor;
}

export function createRequestId(): string {
  return randomUUID();
}

export function responseDocumentId(workerId: string, opportunityId: string): string {
  return createHash('sha256').update(`${workerId}\0${opportunityId}`).digest('hex');
}

function eventSubjectKey(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 24);
}

export async function recordMarketplaceEvent(
  db: Firestore,
  event: {
    eventName: MarketplaceEventName;
    workerId: string;
    opportunityId?: string;
    reasonCode?: string;
    requestId: string;
  },
): Promise<void> {
  const day = new Date().toISOString().slice(0, 10);
  const actorKey = eventSubjectKey(event.workerId);
  const opportunityKey = event.opportunityId ? eventSubjectKey(event.opportunityId) : undefined;
  const eventId = eventSubjectKey(
    [event.eventName, actorKey, opportunityKey ?? '', event.reasonCode ?? '', day].join('\0'),
  );
  const payload: Record<string, unknown> = {
    eventName: event.eventName,
    actorKey,
    requestId: event.requestId,
    day,
    count: FieldValue.increment(1),
    lastSeenAt: FieldValue.serverTimestamp(),
  };
  if (opportunityKey) payload.opportunityKey = opportunityKey;
  if (event.reasonCode) payload.reasonCode = event.reasonCode;
  await db.collection('marketplaceEvents').doc(eventId).set(payload, { merge: true });
}

export function logOpportunityServerError(requestId: string, code: string): void {
  console.error(JSON.stringify({ event: 'opportunity_api_error', requestId, code }));
}

export function parseProfessionalMatchContext(
  uid: string,
  userValue: unknown,
  profileValue: unknown,
  preferenceValue: unknown,
): ProfessionalMatchContext {
  const user = asRecord(userValue);
  const profile = asRecord(profileValue);
  const preferences = asRecord(preferenceValue);
  if (user.banned === true) {
    throw new OpportunityApiException(403, 'ACCOUNT_SUSPENDED', 'This account cannot access opportunities.');
  }
  const authorization = authorizeProfessionalInbox({
    accountType: asString(user.accountType),
    profileType: asString(profile.type),
    hasPreferences: Object.keys(preferences).length > 0,
  });
  if (!authorization.allowed) {
    const errorMap = {
      SIGNED_OUT: [401, 'AUTHENTICATION_REQUIRED', 'Sign in to view professional opportunities.'],
      PROFESSIONAL_REQUIRED: [403, 'PROFESSIONAL_REQUIRED', 'A gig-worker account is required.'],
      GIG_PROFILE_REQUIRED: [403, 'GIG_PROFILE_REQUIRED', 'Create a gig profile before viewing opportunities.'],
      PREFERENCES_REQUIRED: [403, 'PREFERENCES_REQUIRED', 'Save your service area and earnings preferences first.'],
    } as const;
    const [status, code, message] = errorMap[authorization.code];
    throw new OpportunityApiException(status, code, message);
  }

  const category = asString(profile.category);
  const availability = asString(profile.availability);
  const radius = preferences.serviceRadiusMiles;
  const minimumHourly = dollarsToMinor(preferences.minimumHourlyTakeHome);
  const serviceLocation = resolveBayAreaCityLocation(asString(preferences.serviceArea));
  if (!category || !['full-time', 'part-time', 'weekends'].includes(availability)) {
    throw new OpportunityApiException(
      403,
      'GIG_PROFILE_REQUIRED',
      'Complete your gig category and availability before viewing opportunities.',
    );
  }
  if (
    !serviceLocation
    || typeof radius !== 'number'
    || !Number.isFinite(radius)
    || radius < 1
    || radius > 100
    || minimumHourly === null
    || minimumHourly <= 0
  ) {
    throw new OpportunityApiException(
      403,
      'PREFERENCES_REQUIRED',
      'Use a supported Bay Area city, travel radius, and minimum take-home in your gig preferences.',
    );
  }
  const blackoutDates = Array.isArray(preferences.blackoutDates)
    ? preferences.blackoutDates.filter((date): date is string => typeof date === 'string').slice(0, 366)
    : [];
  return {
    uid,
    matchProfessional: {
      supportedCategories: category ? [category] : [],
      serviceLocation,
      serviceRadiusMiles: radius,
      availability,
      blackoutDates,
      timezone: asString(preferences.timezone) || 'America/Los_Angeles',
      minimumHourlyTakeHomeMinor: minimumHourly,
    },
  };
}

export async function loadProfessionalMatchContext(
  db: Firestore,
  uid: string,
): Promise<ProfessionalMatchContext> {
  const [user, profile, preferences] = await db.getAll(
    db.doc(`users/${uid}`),
    db.doc(`profiles/${uid}`),
    db.doc(`workerGigPreferences/${uid}`),
  );
  return parseProfessionalMatchContext(uid, user.data(), profile.data(), preferences.data());
}

export function requestMatchInput(
  professional: OpportunityMatchInput['professional'],
  requestValue: unknown,
): OpportunityMatchInput {
  const request = asRecord(requestValue);
  return {
    evaluationDate: todayInTimezone(professional.timezone),
    professional,
    opportunity: {
      category: asString(request.category),
      location: resolveBayAreaCityLocation(asString(request.city)),
      requestedDate: asString(request.preferredDate),
      timeWindow: asString(request.timeWindow),
      estimatedDurationMinutes:
        typeof request.estimatedDurationMinutes === 'number' ? request.estimatedDurationMinutes : null,
      estimatedGrossMinor: dollarsToMinor(request.budgetMin),
      // No transaction or platform fee exists in this discovery-only release.
      // Zero is a known current fee, not a prediction of future fees.
      knownFeesMinor: 0,
      currency: asString(request.currency),
    },
  };
}

function todayInTimezone(timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  } catch {
    return '';
  }
}

function timestampToIso(value: unknown): string | null {
  if (value && typeof value === 'object' && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return typeof value === 'string' ? value : null;
}

export function parseStoredResponse(value: unknown): (OpportunityResponse & { respondedAt: string | null }) | null {
  const response = asRecord(value);
  if (response.decision !== 'interested' && response.decision !== 'passed') return null;
  const passReason = typeof response.passReason === 'string' ? response.passReason : null;
  return {
    decision: response.decision,
    passReason: passReason as OpportunityResponse['passReason'],
    respondedAt: timestampToIso(response.createdAt),
  };
}

export function buildOpportunityCard(
  request: DocumentSnapshot<DocumentData>,
  eligibility: Extract<OpportunityEligibility, { eligible: true }>,
  storedResponse: unknown,
): OpportunityCard {
  const data = asRecord(request.data());
  const timeWindow = asString(data.timeWindow) as OpportunityCard['timeWindow'];
  const scopeSummary = sanitizeScopeSummary(asString(data.description)) || 'Scope details withheld for privacy.';
  return {
    id: request.id,
    category: asString(data.category),
    scopeSummary,
    city: asString(data.city),
    locationPrecision: 'city',
    approximateDistanceMiles: eligibility.approximateDistanceMiles,
    requestedDate: asString(data.preferredDate),
    timeWindow,
    estimatedDurationMinutes: eligibility.earnings.durationMinutes,
    earnings: {
      currency: eligibility.earnings.currency,
      grossMinor: eligibility.earnings.grossMinor,
      grossBasis: 'customer_budget_minimum',
      knownFeesMinor: eligibility.earnings.knownFeesMinor,
      takeHomeMinor: eligibility.earnings.takeHomeMinor,
      hourlyTakeHomeMinor: eligibility.earnings.hourlyTakeHomeMinor,
      unknownDeductionsExcluded: true,
    },
    matchReasons: eligibility.reasonCodes.map(code => ({ code, label: MATCH_REASON_LABELS[code] })),
    response: parseStoredResponse(storedResponse),
  };
}
