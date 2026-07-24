import { NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getStripe, BOOST_DURATION_DAYS } from '@/lib/stripe';
import { getAdminDb } from '@/lib/firebase-admin';

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });

  const signature = req.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'Missing signature' }, { status: 400 });

  // Signature is computed over the raw body — read as text, never as JSON.
  const body = await req.text();
  let event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, secret);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const jobId = session.metadata?.jobId;
    if (jobId) {
      const boostedUntil = Timestamp.fromMillis(
        Date.now() + BOOST_DURATION_DAYS * 24 * 60 * 60 * 1000
      );
      await getAdminDb().doc(`jobs/${jobId}`).update({ boosted: true, boostedUntil });
    }
  }

  return NextResponse.json({ received: true });
}
