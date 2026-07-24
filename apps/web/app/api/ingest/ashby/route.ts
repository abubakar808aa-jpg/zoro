import { NextRequest, NextResponse } from 'next/server';
import { isIngestionRequestAuthorized } from '@/lib/job-ingestion/auth';
import { fetchAshbyJobs } from '@/lib/job-ingestion/ashby';
import { upsertImportedJobs } from '@/lib/job-ingestion/shared';

export const runtime = 'nodejs';
export const maxDuration = 60;

type IngestionRequest = { boardToken?: string; companyName?: string; careersUrl?: string };

function validateSource(source: IngestionRequest) {
  const boardToken = source.boardToken?.trim();
  const companyName = source.companyName?.trim();
  if (!boardToken || !companyName) throw new Error('boardToken and companyName are required.');
  return { boardToken, companyName, careersUrl: source.careersUrl?.trim() || undefined };
}

export async function POST(request: NextRequest) {
  if (!isIngestionRequestAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const source = validateSource(await request.json() as IngestionRequest);
    const jobs = await fetchAshbyJobs(source);
    await upsertImportedJobs(jobs, { provider: 'ashby', sourceKey: source.boardToken, companyName: source.companyName, careersUrl: source.careersUrl });
    return NextResponse.json({ provider: 'ashby', boardToken: source.boardToken, imported: jobs.length });
  } catch (error: any) {
    console.error('[ashby ingestion]', error);
    return NextResponse.json({ error: error.message ?? 'Ashby ingestion failed.' }, { status: 500 });
  }
}
