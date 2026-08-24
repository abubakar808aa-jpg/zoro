import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { connectorGateStatus } from '@/lib/integrations/partner-adapters';
import { verifyFirebaseToken } from '@/lib/verify-token';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const uid = await verifyFirebaseToken(request.headers.get('authorization'));
    if ((await getAdminDb().doc(`users/${uid}`).get()).data()?.isAdmin !== true) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    return NextResponse.json({ integrations: connectorGateStatus(), secretsExposed: false });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
