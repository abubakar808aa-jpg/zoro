import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let adminApp: App | undefined;

function getAdminApp() {
  if (adminApp) return adminApp;
  if (getApps().length) {
    adminApp = getApps()[0];
    return adminApp;
  }

  const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!rawKey) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is required for job ingestion.');
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
