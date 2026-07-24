import { NextRequest, NextResponse } from 'next/server';
import { fetchGreenhouseJobs } from '@/lib/job-ingestion/greenhouse';
import { upsertImportedJobs } from '@/lib/job-ingestion/shared';
import { isIngestionRequestAuthorized } from '@/lib/job-ingestion/auth';

export const runtime = 'nodejs';
export const maxDuration = 60;

type IngestionRequest = {
  boardToken?: string;
  companyName?: string;
  careersUrl?: string;
};

function validateSource(source: IngestionRequest) {
  const boardToken = source.boardToken?.trim();
  const companyName = source.companyName?.trim();
  if (!boardToken || !companyName) {
    throw new Error('boardToken and companyName are required.');
  }
  return { boardToken, companyName, careersUrl: source.careersUrl?.trim() || undefined };
}

export async function POST(request: NextRequest) {
  if (!isIngestionRequestAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const source = validateSource(await request.json() as IngestionRequest);
    const jobs = await fetchGreenhouseJobs(source);
    await upsertImportedJobs(jobs, { provider: 'greenhouse', sourceKey: source.boardToken, companyName: source.companyName, careersUrl: source.careersUrl });
    return NextResponse.json({ provider: 'greenhouse', boardToken: source.boardToken, imported: jobs.length });
  } catch (error: any) {
    console.error('[greenhouse ingestion]', error);
    return NextResponse.json({ error: error.message ?? 'Greenhouse ingestion failed.' }, { status: 500 });
  }
}
