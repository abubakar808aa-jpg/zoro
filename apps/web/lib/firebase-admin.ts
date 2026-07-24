import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Server-side Firestore with full privileges — used where security rules must
// not apply: job-board ingestion (/api/ingest/*), the Stripe webhook (set
// boosted), and /api/admin mutations. Lazy init so importing this module never
// throws at build/prerender time; it only requires the key when actually used.
// FIREBASE_SERVICE_ACCOUNT_KEY holds the service-account JSON on one line.
let adminApp: App | undefined;

function getAdminApp() {
  if (adminApp) return adminApp;
  if (getApps().length) {
    adminApp = getApps()[0];
    return adminApp;
  }

  const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!rawKey) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is required for server-side Firestore access.');
  }

  let serviceAccount: Record<string, string>;
  try {
    serviceAccount = JSON.parse(rawKey);
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY must be valid one-line JSON.');
  }

  adminApp = initializeApp({ credential: cert(serviceAccount) });
  return adminApp;
}

export function getAdminDb() {
  return getFirestore(getAdminApp());
}
