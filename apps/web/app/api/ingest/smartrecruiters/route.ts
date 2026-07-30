import { NextRequest, NextResponse } from 'next/server';
import { isIngestionRequestAuthorized } from '@/lib/job-ingestion/auth';
import { fetchSmartRecruitersJobs } from '@/lib/job-ingestion/smartrecruiters';
import { upsertImportedJobs } from '@/lib/job-ingestion/shared';

export const runtime = 'nodejs';
export const maxDuration = 60;

type IngestionRequest = { sourceKey?: string; companyName?: string; careersUrl?: string };

function validateSource(source: IngestionRequest) {
  const sourceKey = source.sourceKey?.trim();
  if (!sourceKey) throw new Error('sourceKey is required.');
  return { sourceKey, companyName: source.companyName?.trim() || undefined, careersUrl: source.careersUrl?.trim() || undefined };
}

export async function POST(request: NextRequest) {
  if (!isIngestionRequestAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const source = validateSource(await request.json() as IngestionRequest);
    const jobs = await fetchSmartRecruitersJobs(source);
    await upsertImportedJobs(jobs, { provider: 'smartrecruiters', sourceKey: source.sourceKey, companyName: source.companyName || 'SmartRecruiters feed', careersUrl: source.careersUrl });
    return NextResponse.json({ provider: 'smartrecruiters', sourceKey: source.sourceKey, imported: jobs.length });
  } catch (error: any) {
    console.error('[smartrecruiters ingestion]', error);
    return NextResponse.json({ error: error.message ?? 'SmartRecruiters ingestion failed.' }, { status: 500 });
  }
}
