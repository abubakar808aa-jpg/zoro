import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { fetchDataSfDemand } from '@/lib/market-intelligence/datasf';
import { verifyFirebaseToken } from '@/lib/verify-token';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const uid = await verifyFirebaseToken(request.headers.get('authorization'));
    if ((await getAdminDb().doc(`users/${uid}`).get()).data()?.isAdmin !== true) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    return NextResponse.json(await fetchDataSfDemand(), { headers: { 'Cache-Control': 'private, max-age=0, s-maxage=3600' } });
  } catch (cause) {
    console.error('[market demand]', { message: cause instanceof Error ? cause.message : 'unknown' });
    return NextResponse.json({ error: 'Unable to load aggregate demand data.' }, { status: 401 });
  }
}
