import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { firebaseConfig } from '@jobman/shared/src/firebase/config';

// firebaseConfig reads NEXT_PUBLIC_FIREBASE_* from the environment
// (see packages/shared/src/firebase/config.ts and apps/web/.env.example).
//
// Fall back to non-empty placeholders so `getAuth()` — which runs at module
// load and throws `auth/invalid-api-key` on a missing/empty key — cannot crash
// static prerendering during a build that lacks the env vars (e.g. a Dependabot
// preview). Real deployments inline the real NEXT_PUBLIC_* values, so this only
// ever takes effect on a misconfigured build, never in production.
const resolvedConfig = {
  ...firebaseConfig,
  apiKey: firebaseConfig.apiKey || 'missing-firebase-api-key',
  authDomain: firebaseConfig.authDomain || 'missing.firebaseapp.com',
  projectId: firebaseConfig.projectId || 'missing-project',
  appId: firebaseConfig.appId || 'missing-app-id',
};

const app = getApps().length === 0 ? initializeApp(resolvedConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
