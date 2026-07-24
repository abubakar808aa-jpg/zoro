import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/verify-token';
import { getAdminDb } from '@/lib/firebase-admin';

// All admin mutations run server-side after an isAdmin check against Firestore —
// the client-side guard on /admin pages is UX only, never the security boundary.

type AdminAction =
  | { action: 'banUser'; uid: string; reason?: string }
  | { action: 'unbanUser'; uid: string }
  | { action: 'deleteJob'; jobId: string }
  | { action: 'closeJob'; jobId: string }
  | { action: 'resolveReport'; reportId: string }
  | { action: 'deleteActivity'; activityId: string };

export async function POST(req: Request) {
  let callerUid: string;
  try {
    callerUid = await verifyFirebaseToken(req.headers.get('authorization'));
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminDb = getAdminDb();
  const callerSnap = await adminDb.doc(`users/${callerUid}`).get();
  if (callerSnap.data()?.isAdmin !== true) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = (await req.json()) as AdminAction;

  try {
    switch (body.action) {
      case 'banUser':
        if (body.uid === callerUid) {
          return NextResponse.json({ error: "You can't ban yourself." }, { status: 400 });
        }
        await adminDb.doc(`users/${body.uid}`).update({
          banned: true,
          bannedReason: body.reason ?? '',
        });
        break;
      case 'unbanUser':
        await adminDb.doc(`users/${body.uid}`).update({ banned: false, bannedReason: '' });
        break;
      case 'deleteJob':
        await adminDb.doc(`jobs/${body.jobId}`).delete();
        break;
      case 'closeJob':
        await adminDb.doc(`jobs/${body.jobId}`).update({ status: 'closed' });
        break;
      case 'resolveReport':
        await adminDb.doc(`reports/${body.reportId}`).update({ resolved: true });
        break;
      case 'deleteActivity':
        await adminDb.doc(`activities/${body.activityId}`).delete();
        break;
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[admin route]', err);
    return NextResponse.json({ error: err.message ?? 'Action failed' }, { status: 500 });
  }
}
