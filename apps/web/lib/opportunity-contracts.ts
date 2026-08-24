import type {
  OpportunityCurrency,
  OpportunityExclusionCode,
  OpportunityMatchReasonCode,
} from './opportunity-matcher';
import type {
  OpportunityDecision,
  OpportunityPassReason,
} from './opportunity-policy';

export interface OpportunityCard {
  id: string;
  category: string;
  scopeSummary: string;
  city: string;
  locationPrecision: 'city';
  approximateDistanceMiles: number;
  requestedDate: string;
  timeWindow: 'morning' | 'afternoon' | 'evening' | 'flexible';
  estimatedDurationMinutes: number;
  earnings: {
    currency: OpportunityCurrency;
    grossMinor: number;
    grossBasis: 'customer_budget_minimum';
    knownFeesMinor: number;
    takeHomeMinor: number;
    hourlyTakeHomeMinor: number;
    unknownDeductionsExcluded: true;
  };
  matchReasons: Array<{
    code: OpportunityMatchReasonCode;
    label: string;
  }>;
  response: {
    decision: OpportunityDecision;
    passReason: OpportunityPassReason | null;
    respondedAt: string | null;
  } | null;
}

export interface OpportunityInboxPayload {
  data: OpportunityCard[];
  meta: {
    pageSize: number;
    evaluatedCount: number;
    excludedCount: number;
    refreshedAt: string;
  };
}

export interface OpportunityResponsePayload {
  data: {
    opportunityId: string;
    decision: OpportunityDecision;
    passReason: OpportunityPassReason | null;
    respondedAt: string;
    idempotentReplay: boolean;
  };
}

export interface OpportunityApiError {
  error: {
    code:
      | 'AUTHENTICATION_REQUIRED'
      | 'PROFESSIONAL_REQUIRED'
      | 'GIG_PROFILE_REQUIRED'
      | 'PREFERENCES_REQUIRED'
      | 'ACCOUNT_SUSPENDED'
      | 'VALIDATION_ERROR'
      | 'OPPORTUNITY_NOT_FOUND'
      | 'OPPORTUNITY_NOT_ELIGIBLE'
      | 'RESPONSE_CONFLICT'
      | 'CONFIGURATION_ERROR'
      | 'INTERNAL_ERROR';
    message: string;
    reasonCode?: OpportunityExclusionCode;
    requestId?: string;
  };
}

export const MATCH_REASON_LABELS: Record<OpportunityMatchReasonCode, string> = {
  CATEGORY_MATCH: 'Your service category matches.',
  WITHIN_SERVICE_RADIUS: 'Inside your configured travel radius.',
  LOCATION_APPROXIMATE: 'Distance uses city centres, not a private address.',
  SCHEDULE_COMPATIBLE: 'Compatible with your saved availability.',
  EARNINGS_THRESHOLD_MET: 'Estimated hourly take-home meets your minimum.',
  UNKNOWN_DEDUCTIONS_EXCLUDED: 'Materials, travel costs, tax, and future fees are not included.',
};

export const PASS_REASON_OPTIONS: Array<{ value: OpportunityPassReason; label: string }> = [
  { value: 'SCHEDULE_CONFLICT', label: 'Schedule conflict' },
  { value: 'TOO_FAR', label: 'Too far away' },
  { value: 'EARNINGS_TOO_LOW', label: 'Earnings too low' },
  { value: 'OUTSIDE_PREFERRED_SERVICES', label: 'Outside preferred services' },
  { value: 'NOT_ENOUGH_INFORMATION', label: 'Not enough information' },
  { value: 'OTHER', label: 'Other' },
];
