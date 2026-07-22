import { initializeApp, getApps, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Server-side Firestore with full privileges — used only where security rules
// must not apply: Stripe webhook (set boosted) and /api/admin mutations.
// FIREBASE_SERVICE_ACCOUNT_KEY holds the service-account JSON (one line) on Vercel;
// applicationDefault() covers local dev with `gcloud auth application-default login`.
const app = getApps()[0] ?? initializeApp({
  credential: process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    ? cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY))
    : applicationDefault(),
});

export const adminDb = getFirestore(app);
