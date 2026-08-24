import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateGigEconomics } from './gig-economics.ts';

test('calculates take-home pay after fees, materials, and travel', () => {
  const result = calculateGigEconomics({
    quotedPrice: 220,
    estimatedHours: 3,
    materialsCost: 30,
    travelMiles: 20,
    mileageCostPerMile: 0.7,
    platformFeeRate: 0.1,
    minimumHourlyTakeHome: 45,
  });

  assert.deepEqual(result, {
    platformFee: 22,
    travelCost: 14,
    estimatedTakeHome: 154,
    estimatedHourlyTakeHome: 51.33,
    clearsWorkerMinimum: true,
  });
});

test('marks a gig as below the worker minimum without hiding the estimate', () => {
  const result = calculateGigEconomics({
    quotedPrice: 90,
    estimatedHours: 2,
    materialsCost: 20,
    travelMiles: 10,
    mileageCostPerMile: 0.7,
    platformFeeRate: 0.1,
    minimumHourlyTakeHome: 40,
  });

  assert.equal(result.clearsWorkerMinimum, false);
  assert.equal(result.estimatedTakeHome, 54);
  assert.equal(result.estimatedHourlyTakeHome, 27);
});

test('rejects impossible or unsafe inputs', () => {
  assert.throws(
    () => calculateGigEconomics({ quotedPrice: -1, estimatedHours: 2, mileageCostPerMile: 0.7, platformFeeRate: 0.1 }),
    /quotedPrice/,
  );
  assert.throws(
    () => calculateGigEconomics({ quotedPrice: 100, estimatedHours: 0, mileageCostPerMile: 0.7, platformFeeRate: 0.1 }),
    /estimatedHours/,
  );
  assert.throws(
    () => calculateGigEconomics({ quotedPrice: 100, estimatedHours: 2, mileageCostPerMile: 0.7, platformFeeRate: 1.2 }),
    /platformFeeRate/,
  );
});
