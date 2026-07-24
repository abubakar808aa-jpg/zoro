// Server-side Firebase ID token verification for API routes.
// Uses Google's public JWKS — no service account / firebase-admin needed.
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { firebaseConfig } from '@jobman/shared/src/firebase/config';

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? firebaseConfig.projectId;

// Module-level so the key set is fetched once and cached per server instance.
const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

/** Verifies "Authorization: Bearer <idToken>" and returns the caller's uid. Throws on failure. */
export async function verifyFirebaseToken(authHeader: string | null): Promise<string> {
  if (!authHeader?.startsWith('Bearer ')) throw new Error('Missing bearer token');
  const token = authHeader.slice('Bearer '.length);

  const { payload } = await jwtVerify(token, JWKS, {
    issuer: `https://securetoken.google.com/${PROJECT_ID}`,
    audience: PROJECT_ID,
  });

  const uid = payload.sub;
  if (!uid) throw new Error('Token has no subject');
  return uid;
}
