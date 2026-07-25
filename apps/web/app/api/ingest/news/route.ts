import { NextRequest, NextResponse } from 'next/server';
import { isIngestionRequestAuthorized } from '@/lib/job-ingestion/auth';
import { ingestNews } from '@/lib/news/ingest';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Fetches the curated RSS/Atom feeds and upserts headline/excerpt/source/link
// into the `news` collection. Auth mirrors the job-ingestion routes
// (Bearer INGESTION_SECRET); writes go through the Admin SDK.
export async function POST(request: NextRequest) {
  if (!isIngestionRequestAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await ingestNews();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[news ingestion]', error);
    return NextResponse.json({ error: error?.message ?? 'News ingestion failed.' }, { status: 500 });
  }
}
