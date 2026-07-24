import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/verify-token';
import { makeRateLimiter } from '@/lib/rate-limit';
import { getStripe, BOOST_PRICE_CENTS, BOOST_DURATION_DAYS } from '@/lib/stripe';
import { getAdminDb } from '@/lib/firebase-admin';

const checkRateLimit = makeRateLimiter(5, 60_000);

export async function POST(req: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Payments are not configured yet.' }, { status: 503 });
  }

  let uid: string;
  try {
    uid = await verifyFirebaseToken(req.headers.get('authorization'));
  } catch {
    return NextResponse.json({ error: 'Sign in to boost a job.' }, { status: 401 });
  }
  if (!checkRateLimit(uid)) {
    return NextResponse.json({ error: 'Too many attempts — try again in a minute.' }, { status: 429 });
  }

  const { jobId } = await req.json();
  if (!jobId || typeof jobId !== 'string') {
    return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
  }

  const jobSnap = await getAdminDb().doc(`jobs/${jobId}`).get();
  const job = jobSnap.data();
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  if (job.postedBy !== uid) {
    return NextResponse.json({ error: 'Only the job owner can boost it.' }, { status: 403 });
  }
  if (job.status !== 'open') {
    return NextResponse.json({ error: 'Reopen the job before boosting it.' }, { status: 400 });
  }

  const origin = req.headers.get('origin') ?? 'http://localhost:3000';
  const session = await getStripe().checkout.sessions.create({
    mode: 'payment',
    line_items: [{
      price_data: {
        currency: 'usd',
        unit_amount: BOOST_PRICE_CENTS,
        product_data: {
          name: `⚡ Featured Listing — "${job.title}"`,
          description: `Pin this job to the top of JobMan search for ${BOOST_DURATION_DAYS} days`,
        },
      },
      quantity: 1,
    }],
    metadata: { jobId, uid },
    success_url: `${origin}/dashboard?boosted=1`,
    cancel_url: `${origin}/dashboard`,
  });

  return NextResponse.json({ url: session.url });
}
