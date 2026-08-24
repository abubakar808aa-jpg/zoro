export type OpportunityCurrency = 'USD';
export type ProfessionalAvailability = 'full-time' | 'part-time' | 'weekends';
export type OpportunityTimeWindow = 'morning' | 'afternoon' | 'evening' | 'flexible';

export interface CoarseLocation {
  city: string;
  latitudeE6: number;
  longitudeE6: number;
  precision: 'city';
}

export interface OpportunityMatchInput {
  evaluationDate: string;
  professional: {
    supportedCategories: string[];
    serviceLocation: CoarseLocation | null;
    serviceRadiusMiles: number;
    availability: ProfessionalAvailability | string;
    blackoutDates: string[];
    timezone: string;
    minimumHourlyTakeHomeMinor: number;
  };
  opportunity: {
    category: string;
    location: CoarseLocation | null;
    requestedDate: string;
    timeWindow: OpportunityTimeWindow | string;
    estimatedDurationMinutes: number | null;
    estimatedGrossMinor: number | null;
    knownFeesMinor: number | null;
    currency: OpportunityCurrency | string;
  };
}

export type OpportunityExclusionCode =
  | 'SELF_REQUEST'
  | 'REQUEST_EXPIRED'
  | 'UNSUPPORTED_CATEGORY'
  | 'MISSING_LOCATION'
  | 'INVALID_LOCATION'
  | 'OUTSIDE_SERVICE_RADIUS'
  | 'MISSING_SCHEDULE'
  | 'INVALID_SCHEDULE'
  | 'SCHEDULE_CONFLICT'
  | 'BLACKOUT_CONFLICT'
  | 'MISSING_DURATION'
  | 'INVALID_DURATION'
  | 'MISSING_PRICE'
  | 'INVALID_PRICE'
  | 'MISSING_FEE'
  | 'INVALID_FEE'
  | 'MISSING_CURRENCY'
  | 'UNSUPPORTED_CURRENCY'
  | 'INVALID_PREFERENCES'
  | 'EARNINGS_BELOW_MINIMUM'
  | 'CALCULATION_FAILURE';

export type OpportunityMatchReasonCode =
  | 'CATEGORY_MATCH'
  | 'WITHIN_SERVICE_RADIUS'
  | 'LOCATION_APPROXIMATE'
  | 'SCHEDULE_COMPATIBLE'
  | 'EARNINGS_THRESHOLD_MET'
  | 'UNKNOWN_DEDUCTIONS_EXCLUDED';

export interface OpportunityEarnings {
  currency: OpportunityCurrency;
  grossMinor: number;
  knownFeesMinor: number;
  takeHomeMinor: number;
  hourlyTakeHomeMinor: number;
  durationMinutes: number;
}

export type OpportunityEligibility =
  | {
      eligible: true;
      reasonCodes: OpportunityMatchReasonCode[];
      approximateDistanceMiles: number;
      earnings: OpportunityEarnings;
    }
  | { eligible: false; reasonCode: OpportunityExclusionCode };

const METERS_PER_MILE = 1_609.344;
const EARTH_RADIUS_METERS = 6_371_008.8;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const VALID_WINDOWS = new Set<OpportunityTimeWindow>(['morning', 'afternoon', 'evening', 'flexible']);
const VALID_AVAILABILITY = new Set<ProfessionalAvailability>(['full-time', 'part-time', 'weekends']);

// Public city-centre coordinates only. These are deliberately coarse and never
// represent a customer's home or a professional's street address.
const BAY_AREA_CITY_CENTRES: Record<string, readonly [number, number]> = {
  alameda: [37.7652, -122.2416],
  antioch: [38.0049, -121.8058],
  berkeley: [37.8715, -122.273],
  burlingame: [37.5779, -122.3481],
  concord: [37.978, -122.0311],
  'daly city': [37.6879, -122.4702],
  emeryville: [37.8313, -122.2852],
  fremont: [37.5485, -121.9886],
  hayward: [37.6688, -122.0808],
  livermore: [37.6819, -121.768],
  'mill valley': [37.906, -122.5449],
  milpitas: [37.4323, -121.8996],
  'mountain view': [37.3861, -122.0839],
  oakland: [37.8044, -122.2712],
  'palo alto': [37.4419, -122.143],
  petaluma: [38.2324, -122.6367],
  pleasanton: [37.6624, -121.8747],
  'redwood city': [37.4852, -122.2364],
  richmond: [37.9358, -122.3477],
  'san francisco': [37.7749, -122.4194],
  'san jose': [37.3382, -121.8863],
  'san leandro': [37.7249, -122.1561],
  'san mateo': [37.563, -122.3255],
  'san rafael': [37.9735, -122.5311],
  'santa clara': [37.3541, -121.9552],
  'santa rosa': [38.4405, -122.7144],
  'south san francisco': [37.6547, -122.4077],
  sunnyvale: [37.3688, -122.0363],
  vallejo: [38.1041, -122.2566],
  'walnut creek': [37.9101, -122.0652],
};

function normalizeCityLookup(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[.,]/g, '')
    .replace(/\s+(?:ca|california)$/i, '')
    .replace(/\s+/g, ' ');
}

export function resolveBayAreaCityLocation(city: string): CoarseLocation | null {
  const coordinates = BAY_AREA_CITY_CENTRES[normalizeCityLookup(city)];
  if (!coordinates) return null;
  return {
    city: city.trim().replace(/\s+/g, ' '),
    latitudeE6: Math.round(coordinates[0] * 1_000_000),
    longitudeE6: Math.round(coordinates[1] * 1_000_000),
    precision: 'city',
  };
}

function isValidLocation(value: CoarseLocation): boolean {
  return value.precision === 'city'
    && value.city.trim().length >= 2
    && Number.isInteger(value.latitudeE6)
    && value.latitudeE6 >= -90_000_000
    && value.latitudeE6 <= 90_000_000
    && Number.isInteger(value.longitudeE6)
    && value.longitudeE6 >= -180_000_000
    && value.longitudeE6 <= 180_000_000;
}

function toRadians(degrees: number): number {
  return degrees * Math.PI / 180;
}

export function distanceMetersBetween(a: CoarseLocation, b: CoarseLocation): number {
  const latitudeA = toRadians(a.latitudeE6 / 1_000_000);
  const latitudeB = toRadians(b.latitudeE6 / 1_000_000);
  const latitudeDelta = latitudeB - latitudeA;
  const longitudeDelta = toRadians((b.longitudeE6 - a.longitudeE6) / 1_000_000);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

function parseDateParts(value: string): { year: number; month: number; day: number } | null {
  if (!DATE_PATTERN.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return null;
  return { year, month, day };
}

function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

function dayOfWeekForLocalDate(value: string): number | null {
  const parts = parseDateParts(value);
  if (!parts) return null;
  // A service request stores a local calendar date, not an instant. Calculating
  // from the calendar parts avoids UTC conversion shifting the worker's day.
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
}

function exclude(reasonCode: OpportunityExclusionCode): OpportunityEligibility {
  return { eligible: false, reasonCode };
}

function isSafeMinorUnit(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

export function calculateOpportunityEligibility(input: OpportunityMatchInput): OpportunityEligibility {
  try {
    const { professional, opportunity } = input;
    const supported = new Set(professional.supportedCategories.map(category => category.trim().toLowerCase()));
    if (!opportunity.category.trim() || !supported.has(opportunity.category.trim().toLowerCase())) {
      return exclude('UNSUPPORTED_CATEGORY');
    }

    if (!professional.serviceLocation || !opportunity.location) return exclude('MISSING_LOCATION');
    if (!isValidLocation(professional.serviceLocation) || !isValidLocation(opportunity.location)) {
      return exclude('INVALID_LOCATION');
    }
    if (!Number.isFinite(professional.serviceRadiusMiles) || professional.serviceRadiusMiles <= 0) {
      return exclude('INVALID_PREFERENCES');
    }
    const distanceMeters = distanceMetersBetween(professional.serviceLocation, opportunity.location);
    if (distanceMeters > professional.serviceRadiusMiles * METERS_PER_MILE) {
      return exclude('OUTSIDE_SERVICE_RADIUS');
    }

    if (!opportunity.requestedDate) return exclude('MISSING_SCHEDULE');
    const dayOfWeek = dayOfWeekForLocalDate(opportunity.requestedDate);
    if (!parseDateParts(input.evaluationDate)) return exclude('CALCULATION_FAILURE');
    if (
      dayOfWeek === null
      || !VALID_WINDOWS.has(opportunity.timeWindow as OpportunityTimeWindow)
      || !VALID_AVAILABILITY.has(professional.availability as ProfessionalAvailability)
      || !isValidTimezone(professional.timezone)
    ) return exclude('INVALID_SCHEDULE');
    if (opportunity.requestedDate < input.evaluationDate) return exclude('REQUEST_EXPIRED');
    if (professional.blackoutDates.includes(opportunity.requestedDate)) return exclude('BLACKOUT_CONFLICT');
    if (professional.availability === 'weekends' && dayOfWeek !== 0 && dayOfWeek !== 6) {
      return exclude('SCHEDULE_CONFLICT');
    }

    if (opportunity.estimatedDurationMinutes === null) return exclude('MISSING_DURATION');
    if (!Number.isSafeInteger(opportunity.estimatedDurationMinutes) || opportunity.estimatedDurationMinutes <= 0) {
      return exclude('INVALID_DURATION');
    }
    if (opportunity.estimatedGrossMinor === null) return exclude('MISSING_PRICE');
    if (!isSafeMinorUnit(opportunity.estimatedGrossMinor)) return exclude('INVALID_PRICE');
    if (opportunity.knownFeesMinor === null) return exclude('MISSING_FEE');
    if (
      !isSafeMinorUnit(opportunity.knownFeesMinor)
      || opportunity.knownFeesMinor > opportunity.estimatedGrossMinor
    ) return exclude('INVALID_FEE');
    if (!opportunity.currency) return exclude('MISSING_CURRENCY');
    if (opportunity.currency !== 'USD') return exclude('UNSUPPORTED_CURRENCY');
    if (!isSafeMinorUnit(professional.minimumHourlyTakeHomeMinor)) {
      return exclude('INVALID_PREFERENCES');
    }

    const takeHomeMinor = opportunity.estimatedGrossMinor - opportunity.knownFeesMinor;
    const hourlyTakeHomeMinor = Math.floor(
      takeHomeMinor * 60 / opportunity.estimatedDurationMinutes,
    );
    if (!Number.isSafeInteger(hourlyTakeHomeMinor)) return exclude('CALCULATION_FAILURE');
    if (hourlyTakeHomeMinor < professional.minimumHourlyTakeHomeMinor) {
      return exclude('EARNINGS_BELOW_MINIMUM');
    }

    return {
      eligible: true,
      reasonCodes: [
        'CATEGORY_MATCH',
        'WITHIN_SERVICE_RADIUS',
        'LOCATION_APPROXIMATE',
        'SCHEDULE_COMPATIBLE',
        'EARNINGS_THRESHOLD_MET',
        'UNKNOWN_DEDUCTIONS_EXCLUDED',
      ],
      approximateDistanceMiles: Math.round(distanceMeters / METERS_PER_MILE * 10) / 10,
      earnings: {
        currency: 'USD',
        grossMinor: opportunity.estimatedGrossMinor,
        knownFeesMinor: opportunity.knownFeesMinor,
        takeHomeMinor,
        hourlyTakeHomeMinor,
        durationMinutes: opportunity.estimatedDurationMinutes,
      },
    };
  } catch {
    return exclude('CALCULATION_FAILURE');
  }
}
