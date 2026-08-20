import { NextRequest, NextResponse } from 'next/server';
import { fetchArbeitnowJobs } from '@/lib/job-ingestion/arbeitnow';
import { upsertImportedJobs } from '@/lib/job-ingestion/shared';
import { isIngestionRequestAuthorized } from '@/lib/job-ingestion/auth';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Arbeitnow is a multi-company aggregator: one source, many employers. The
// request body is optional — sourceKey defaults to 'arbeitnow' and companyName
// is only a display label for the source registry (each job keeps its own
// employer name).
type IngestionRequest = {
  sourceKey?: string;
  companyName?: string;
  careersUrl?: string;
};

export async function POST(request: NextRequest) {
  if (!isIngestionRequestAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({})) as IngestionRequest;
    const sourceKey = body.sourceKey?.trim() || 'arbeitnow';
    const companyName = body.companyName?.trim() || 'Arbeitnow';
    const careersUrl = body.careersUrl?.trim() || 'https://www.arbeitnow.com/';
    const jobs = await fetchArbeitnowJobs({ companyName, sourceKey, careersUrl });
    await upsertImportedJobs(jobs, { provider: 'arbeitnow', sourceKey, companyName, careersUrl });
    return NextResponse.json({ provider: 'arbeitnow', sourceKey, imported: jobs.length });
  } catch (error: any) {
    console.error('[arbeitnow ingestion]', error);
    return NextResponse.json({ error: error.message ?? 'Arbeitnow ingestion failed.' }, { status: 500 });
  }
}
