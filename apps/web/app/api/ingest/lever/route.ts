import { NextRequest, NextResponse } from 'next/server';
import { isIngestionRequestAuthorized } from '@/lib/job-ingestion/auth';
import { fetchLeverJobs } from '@/lib/job-ingestion/lever';
import { upsertImportedJobs } from '@/lib/job-ingestion/shared';

export const runtime = 'nodejs';
export const maxDuration = 60;

type IngestionRequest = {
  boardToken?: string;
  companyName?: string;
  careersUrl?: string;
  region?: 'global' | 'eu';
};

function validateSource(source: IngestionRequest) {
  const boardToken = source.boardToken?.trim();
  const companyName = source.companyName?.trim();
  if (!boardToken || !companyName) throw new Error('boardToken and companyName are required.');
  if (source.region && source.region !== 'global' && source.region !== 'eu') throw new Error('region must be global or eu.');
  return { boardToken, companyName, careersUrl: source.careersUrl?.trim() || undefined, region: source.region };
}

export async function POST(request: NextRequest) {
  if (!isIngestionRequestAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const source = validateSource(await request.json() as IngestionRequest);
    const jobs = await fetchLeverJobs(source);
    await upsertImportedJobs(jobs, { provider: 'lever', sourceKey: source.boardToken, companyName: source.companyName, careersUrl: source.careersUrl });
    return NextResponse.json({ provider: 'lever', boardToken: source.boardToken, imported: jobs.length });
  } catch (error: any) {
    console.error('[lever ingestion]', error);
    return NextResponse.json({ error: error.message ?? 'Lever ingestion failed.' }, { status: 500 });
  }
}
