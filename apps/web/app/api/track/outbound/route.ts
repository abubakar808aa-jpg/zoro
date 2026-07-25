import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { makeRateLimiter } from '@/lib/rate-limit';

export const runtime = 'nodejs';

// Outbound-click analytics only: increments jobs/{id}.outboundClicks. No PII,
// no auth (it's a public counter) — rate-limited per IP to blunt inflation.
const limit = makeRateLimiter(60, 60_000);

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anon';
  if (!limit(ip)) return NextResponse.json({ ok: false }, { status: 429 });

  let jobId: unknown;
  try {
    ({ jobId } = await request.json());
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!jobId || typeof jobId !== 'string') return NextResponse.json({ ok: false }, { status: 400 });

  try {
    await getAdminDb().collection('jobs').doc(jobId).set(
      { outboundClicks: FieldValue.increment(1) },
      { merge: true },
    );
  } catch {
    // Counter is best-effort; never surface an error to the navigating user.
  }
  return NextResponse.json({ ok: true });
}
