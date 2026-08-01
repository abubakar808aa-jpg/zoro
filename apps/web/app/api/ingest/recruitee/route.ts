import { NextRequest, NextResponse } from 'next/server';
import { isIngestionRequestAuthorized } from '@/lib/job-ingestion/auth';
import { fetchRecruiteeJobs } from '@/lib/job-ingestion/recruitee';
import { upsertImportedJobs } from '@/lib/job-ingestion/shared';

export const runtime = 'nodejs';
export const maxDuration = 60;

type IngestionRequest = { sourceKey?: string; companyName?: string; careersUrl?: string };

function validateSource(source: IngestionRequest) {
  const sourceKey = source.sourceKey?.trim();
  const companyName = source.companyName?.trim();
  if (!sourceKey || !companyName) throw new Error('sourceKey and companyName are required.');
  return { sourceKey, companyName, careersUrl: source.careersUrl?.trim() || undefined };
}

export async function POST(request: NextRequest) {
  if (!isIngestionRequestAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const source = validateSource(await request.json() as IngestionRequest);
    const jobs = await fetchRecruiteeJobs(source);
    await upsertImportedJobs(jobs, { provider: 'recruitee', sourceKey: source.sourceKey, companyName: source.companyName, careersUrl: source.careersUrl });
    return NextResponse.json({ provider: 'recruitee', sourceKey: source.sourceKey, imported: jobs.length });
  } catch (error: any) {
    console.error('[recruitee ingestion]', error);
    return NextResponse.json({ error: error.message ?? 'Recruitee ingestion failed.' }, { status: 500 });
  }
}
