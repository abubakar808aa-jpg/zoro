// Firebase web config comes from environment variables, not source.
//
// The web apiKey is NOT a real secret (it's a public project identifier,
// guarded by Firestore/Storage security rules and optional API-key
// restrictions) — but we still keep it out of the repo so each environment
// supplies its own project, and so nobody learns the "paste keys into
// source" habit.
//
// Two front-ends, two bundlers, two public-var prefixes:
//   • Web (Next.js) inlines  process.env.NEXT_PUBLIC_*
//   • Mobile (Expo)  inlines  process.env.EXPO_PUBLIC_*
// Each bundler statically replaces its own prefix and compiles the other's
// references to `undefined`, so the `??` chain resolves to whichever set is
// present. See SETUP.md for the .env files that supply these.

const NEXT = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  googleWebClientId: process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID,
};

const EXPO = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
};

export const firebaseConfig = {
  apiKey: NEXT.apiKey ?? EXPO.apiKey,
  authDomain: NEXT.authDomain ?? EXPO.authDomain,
  projectId: NEXT.projectId ?? EXPO.projectId,
  storageBucket: NEXT.storageBucket ?? EXPO.storageBucket,
  messagingSenderId: NEXT.messagingSenderId ?? EXPO.messagingSenderId,
  appId: NEXT.appId ?? EXPO.appId,
};

// Google OAuth Web Client ID (Google Cloud Console → Credentials).
export const GOOGLE_WEB_CLIENT_ID = NEXT.googleWebClientId ?? EXPO.googleWebClientId ?? '';
