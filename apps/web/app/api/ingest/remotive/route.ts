import { NextRequest, NextResponse } from 'next/server';
import { fetchRemotiveJobs } from '@/lib/job-ingestion/remotive';
import { upsertImportedJobs } from '@/lib/job-ingestion/shared';
import { isIngestionRequestAuthorized } from '@/lib/job-ingestion/auth';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Remotive is a multi-company aggregator: one source, many employers. The
// request body is optional — sourceKey defaults to 'remotive' and companyName
// is only a display label for the source registry (each job keeps its own
// employer name).
type IngestionRequest = {
  sourceKey?: string;
  companyName?: string;
  careersUrl?: string;
  category?: string;
};

export async function POST(request: NextRequest) {
  if (!isIngestionRequestAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({})) as IngestionRequest;
    const sourceKey = body.sourceKey?.trim() || 'remotive';
    const companyName = body.companyName?.trim() || 'Remotive';
    const careersUrl = body.careersUrl?.trim() || 'https://remotive.com/';
    const jobs = await fetchRemotiveJobs({ companyName, sourceKey, careersUrl, category: body.category?.trim() || undefined });
    await upsertImportedJobs(jobs, { provider: 'remotive', sourceKey, companyName, careersUrl });
    return NextResponse.json({ provider: 'remotive', sourceKey, imported: jobs.length });
  } catch (error: any) {
    console.error('[remotive ingestion]', error);
    return NextResponse.json({ error: error.message ?? 'Remotive ingestion failed.' }, { status: 500 });
  }
}
