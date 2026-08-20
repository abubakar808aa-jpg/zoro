import { NextRequest, NextResponse } from 'next/server';
import { fetchPersonioJobs } from '@/lib/job-ingestion/personio';
import { upsertImportedJobs } from '@/lib/job-ingestion/shared';
import { isIngestionRequestAuthorized } from '@/lib/job-ingestion/auth';

export const runtime = 'nodejs';
export const maxDuration = 60;

type IngestionRequest = {
  sourceKey?: string;
  companyName?: string;
  careersUrl?: string;
};

function validateSource(source: IngestionRequest) {
  const sourceKey = source.sourceKey?.trim();
  const companyName = source.companyName?.trim();
  if (!sourceKey || !companyName) {
    throw new Error('sourceKey and companyName are required.');
  }
  return { sourceKey, companyName, careersUrl: source.careersUrl?.trim() || undefined };
}

export async function POST(request: NextRequest) {
  if (!isIngestionRequestAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const source = validateSource(await request.json() as IngestionRequest);
    const jobs = await fetchPersonioJobs(source);
    await upsertImportedJobs(jobs, { provider: 'personio', sourceKey: source.sourceKey, companyName: source.companyName, careersUrl: source.careersUrl });
    return NextResponse.json({ provider: 'personio', sourceKey: source.sourceKey, imported: jobs.length });
  } catch (error: any) {
    console.error('[personio ingestion]', error);
    return NextResponse.json({ error: error.message ?? 'Personio ingestion failed.' }, { status: 500 });
  }
}
