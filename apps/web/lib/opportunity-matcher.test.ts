import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateOpportunityEligibility,
  resolveBayAreaCityLocation,
  type OpportunityMatchInput,
} from './opportunity-matcher.ts';

function eligibleInput(overrides: Partial<OpportunityMatchInput> = {}): OpportunityMatchInput {
  return {
    evaluationDate: '2026-08-23',
    professional: {
      supportedCategories: ['cleaner'],
      serviceLocation: resolveBayAreaCityLocation('Oakland'),
      serviceRadiusMiles: 15,
      availability: 'full-time',
      blackoutDates: [],
      timezone: 'America/Los_Angeles',
      minimumHourlyTakeHomeMinor: 4_000,
    },
    opportunity: {
      category: 'cleaner',
      location: resolveBayAreaCityLocation('Berkeley'),
      requestedDate: '2026-09-12',
      timeWindow: 'morning',
      estimatedDurationMinutes: 120,
      estimatedGrossMinor: 14_000,
      knownFeesMinor: 0,
      currency: 'USD',
    },
    ...overrides,
  };
}

test('matches a supported category and returns stable explainable reason codes', () => {
  const result = calculateOpportunityEligibility(eligibleInput());

  assert.equal(result.eligible, true);
  if (!result.eligible) return;
  assert.deepEqual(result.reasonCodes, [
    'CATEGORY_MATCH',
    'WITHIN_SERVICE_RADIUS',
    'LOCATION_APPROXIMATE',
    'SCHEDULE_COMPATIBLE',
    'EARNINGS_THRESHOLD_MET',
    'UNKNOWN_DEDUCTIONS_EXCLUDED',
  ]);
});

test('rejects an unsupported category', () => {
  const result = calculateOpportunityEligibility(eligibleInput({
    opportunity: { ...eligibleInput().opportunity, category: 'plumber' },
  }));

  assert.deepEqual(result, { eligible: false, reasonCode: 'UNSUPPORTED_CATEGORY' });
});

test('includes a request exactly at the service-radius boundary and excludes one just outside', () => {
  const atBoundary = calculateOpportunityEligibility(eligibleInput({
    professional: {
      ...eligibleInput().professional,
      serviceLocation: { city: 'Origin', latitudeE6: 0, longitudeE6: 0, precision: 'city' },
      serviceRadiusMiles: 1,
    },
    opportunity: {
      ...eligibleInput().opportunity,
      location: { city: 'Boundary', latitudeE6: 0, longitudeE6: 14_473, precision: 'city' },
    },
  }));
  const outside = calculateOpportunityEligibility(eligibleInput({
    professional: {
      ...eligibleInput().professional,
      serviceLocation: { city: 'Origin', latitudeE6: 0, longitudeE6: 0, precision: 'city' },
      serviceRadiusMiles: 1,
    },
    opportunity: {
      ...eligibleInput().opportunity,
      location: { city: 'Outside', latitudeE6: 0, longitudeE6: 14_474, precision: 'city' },
    },
  }));

  assert.equal(atBoundary.eligible, true);
  assert.deepEqual(outside, { eligible: false, reasonCode: 'OUTSIDE_SERVICE_RADIUS' });
});

test('treats a date-only request in the worker timezone and enforces weekend availability', () => {
  const saturday = calculateOpportunityEligibility(eligibleInput({
    professional: { ...eligibleInput().professional, availability: 'weekends' },
    opportunity: { ...eligibleInput().opportunity, requestedDate: '2026-09-12' },
  }));
  const monday = calculateOpportunityEligibility(eligibleInput({
    professional: { ...eligibleInput().professional, availability: 'weekends' },
    opportunity: { ...eligibleInput().opportunity, requestedDate: '2026-09-14' },
  }));

  assert.equal(saturday.eligible, true);
  assert.deepEqual(monday, { eligible: false, reasonCode: 'SCHEDULE_CONFLICT' });
});

test('rejects a known blackout date', () => {
  const result = calculateOpportunityEligibility(eligibleInput({
    professional: { ...eligibleInput().professional, blackoutDates: ['2026-09-12'] },
  }));

  assert.deepEqual(result, { eligible: false, reasonCode: 'BLACKOUT_CONFLICT' });
});

test('rejects an open request whose requested local date has already passed', () => {
  const result = calculateOpportunityEligibility(eligibleInput({
    opportunity: { ...eligibleInput().opportunity, requestedDate: '2026-08-22' },
  }));

  assert.deepEqual(result, { eligible: false, reasonCode: 'REQUEST_EXPIRED' });
});

test('compares integer hourly take-home immediately below, equal to, and above the threshold', () => {
  const make = (grossMinor: number) => calculateOpportunityEligibility(eligibleInput({
    opportunity: { ...eligibleInput().opportunity, estimatedGrossMinor: grossMinor, estimatedDurationMinutes: 60 },
  }));

  assert.deepEqual(make(3_999), { eligible: false, reasonCode: 'EARNINGS_BELOW_MINIMUM' });
  assert.equal(make(4_000).eligible, true);
  assert.equal(make(4_001).eligible, true);
});

test('rejects zero and invalid duration without dividing', () => {
  const zero = calculateOpportunityEligibility(eligibleInput({
    opportunity: { ...eligibleInput().opportunity, estimatedDurationMinutes: 0 },
  }));
  const fractional = calculateOpportunityEligibility(eligibleInput({
    opportunity: { ...eligibleInput().opportunity, estimatedDurationMinutes: 30.5 },
  }));

  assert.deepEqual(zero, { eligible: false, reasonCode: 'INVALID_DURATION' });
  assert.deepEqual(fractional, { eligible: false, reasonCode: 'INVALID_DURATION' });
});

test('safely excludes missing price, fee, schedule, and location inputs', () => {
  const base = eligibleInput();
  const cases: Array<[Partial<OpportunityMatchInput['opportunity']>, string]> = [
    [{ estimatedGrossMinor: null }, 'MISSING_PRICE'],
    [{ knownFeesMinor: null }, 'MISSING_FEE'],
    [{ requestedDate: '' }, 'MISSING_SCHEDULE'],
    [{ location: null }, 'MISSING_LOCATION'],
    [{ currency: '' }, 'MISSING_CURRENCY'],
  ];

  for (const [opportunityOverride, expected] of cases) {
    const result = calculateOpportunityEligibility({
      ...base,
      opportunity: { ...base.opportunity, ...opportunityOverride },
    });
    assert.equal(result.eligible, false);
    if (!result.eligible) assert.equal(result.reasonCode, expected);
  }
});

test('uses integer minor units and floors fractional hourly take-home', () => {
  const result = calculateOpportunityEligibility(eligibleInput({
    professional: { ...eligibleInput().professional, minimumHourlyTakeHomeMinor: 0 },
    opportunity: {
      ...eligibleInput().opportunity,
      estimatedGrossMinor: 10_001,
      knownFeesMinor: 1,
      estimatedDurationMinutes: 90,
    },
  }));

  assert.equal(result.eligible, true);
  if (!result.eligible) return;
  assert.deepEqual(result.earnings, {
    currency: 'USD',
    grossMinor: 10_001,
    knownFeesMinor: 1,
    takeHomeMinor: 10_000,
    hourlyTakeHomeMinor: 6_666,
    durationMinutes: 90,
  });
});

test('rejects unsupported currencies and unknown Bay Area cities', () => {
  const currency = calculateOpportunityEligibility(eligibleInput({
    opportunity: { ...eligibleInput().opportunity, currency: 'CAD' },
  }));

  assert.deepEqual(currency, { eligible: false, reasonCode: 'UNSUPPORTED_CURRENCY' });
  assert.equal(resolveBayAreaCityLocation('Oakland, CA')?.city, 'Oakland, CA');
  assert.equal(resolveBayAreaCityLocation('Definitely Not A City'), null);
});
