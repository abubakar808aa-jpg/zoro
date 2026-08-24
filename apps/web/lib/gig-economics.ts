export type GigEconomicsInput = {
  quotedPrice: number;
  estimatedHours: number;
  materialsCost?: number;
  travelMiles?: number;
  mileageCostPerMile: number;
  platformFeeRate: number;
  minimumHourlyTakeHome?: number;
};

export type GigEconomics = {
  platformFee: number;
  travelCost: number;
  estimatedTakeHome: number;
  estimatedHourlyTakeHome: number;
  clearsWorkerMinimum: boolean;
};

function requireNonNegative(name: string, value: number) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative number`);
  }
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateGigEconomics(input: GigEconomicsInput): GigEconomics {
  const materialsCost = input.materialsCost ?? 0;
  const travelMiles = input.travelMiles ?? 0;
  const mileageCostPerMile = input.mileageCostPerMile;
  const platformFeeRate = input.platformFeeRate;
  const minimumHourlyTakeHome = input.minimumHourlyTakeHome ?? 0;

  requireNonNegative('quotedPrice', input.quotedPrice);
  if (!Number.isFinite(input.estimatedHours) || input.estimatedHours <= 0) {
    throw new Error('estimatedHours must be greater than zero');
  }
  requireNonNegative('materialsCost', materialsCost);
  requireNonNegative('travelMiles', travelMiles);
  requireNonNegative('mileageCostPerMile', mileageCostPerMile);
  requireNonNegative('minimumHourlyTakeHome', minimumHourlyTakeHome);
  if (!Number.isFinite(platformFeeRate) || platformFeeRate < 0 || platformFeeRate > 0.5) {
    throw new Error('platformFeeRate must be between 0 and 0.5');
  }

  const platformFee = roundMoney(input.quotedPrice * platformFeeRate);
  const travelCost = roundMoney(travelMiles * mileageCostPerMile);
  const estimatedTakeHome = roundMoney(input.quotedPrice - platformFee - materialsCost - travelCost);
  const estimatedHourlyTakeHome = roundMoney(estimatedTakeHome / input.estimatedHours);

  return {
    platformFee,
    travelCost,
    estimatedTakeHome,
    estimatedHourlyTakeHome,
    clearsWorkerMinimum: estimatedHourlyTakeHome >= minimumHourlyTakeHome,
  };
}
