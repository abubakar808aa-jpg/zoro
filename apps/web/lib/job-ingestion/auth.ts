import type { NextRequest } from 'next/server';

export function isIngestionRequestAuthorized(request: NextRequest) {
  const secret = process.env.INGESTION_SECRET;
  return Boolean(secret) && request.headers.get('authorization') === `Bearer ${secret}`;
}
