import Stripe from 'stripe';

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
  return new Stripe(key);
}

export const BOOST_PRICE_CENTS = 500;      // $5
export const BOOST_DURATION_DAYS = 7;
