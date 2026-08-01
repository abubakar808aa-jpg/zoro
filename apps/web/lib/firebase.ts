import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Keep these direct references in the Next.js app. Next replaces
// NEXT_PUBLIC_* values at build time, while references imported from the
// shared workspace package can be left undefined in the browser bundle.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const missingFirebaseKeys = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

// Firebase Auth throws during module evaluation when apiKey is missing. That
// happens before React can render an error boundary or a useful setup message.
// Use inert local placeholders to keep rendering alive, then let AuthProvider
// surface the real configuration problem without making any Firebase request.
export const firebaseConfigurationError = missingFirebaseKeys.length
  ? `Local Firebase configuration is missing: ${missingFirebaseKeys.join(', ')}. Add the NEXT_PUBLIC_FIREBASE_* values to apps/web/.env.local and restart the development server.`
  : null;

const safeFirebaseConfig = {
  apiKey: firebaseConfig.apiKey ?? 'jobman-local-config-missing',
  authDomain: firebaseConfig.authDomain ?? 'jobman-local.invalid',
  projectId: firebaseConfig.projectId ?? 'jobman-local-config-missing',
  storageBucket: firebaseConfig.storageBucket ?? 'jobman-local.invalid',
  messagingSenderId: firebaseConfig.messagingSenderId ?? '0',
  appId: firebaseConfig.appId ?? 'jobman-local-config-missing',
};

const app = getApps().length === 0 ? initializeApp(safeFirebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
