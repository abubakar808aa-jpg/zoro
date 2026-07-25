import { NextRequest, NextResponse } from 'next/server';
import { isIngestionRequestAuthorized } from '@/lib/job-ingestion/auth';
import { runDueSources } from '@/lib/job-ingestion/scheduler';

export const runtime = 'nodejs';
export const maxDuration = 300;

// Orchestrates a scheduled ingestion pass over every due source. Call from a
// scheduler (GitHub Actions cron) with Authorization: Bearer <INGESTION_SECRET>.
export async function POST(request: NextRequest) {
  if (!isIngestionRequestAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await runDueSources('schedule');
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[ingest run]', error);
    return NextResponse.json({ error: error.message ?? 'Ingestion run failed.' }, { status: 500 });
  }
}
