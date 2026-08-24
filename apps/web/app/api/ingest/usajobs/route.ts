import { NextRequest, NextResponse } from 'next/server';

import { isIngestionRequestAuthorized } from '@/lib/job-ingestion/auth';
import { upsertImportedJobs } from '@/lib/job-ingestion/shared';
import { fetchUsaJobs, UsaJobsConnectorError } from '@/lib/job-ingestion/usajobs';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Input = { sourceKey?: string; keyword?: string; location?: string; maxPages?: number };

export async function POST(request: NextRequest) {
  if (!isIngestionRequestAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const input = await request.json() as Input;
    const sourceKey = input.sourceKey?.trim();
    if (!sourceKey || !/^[a-zA-Z0-9_-]{1,80}$/.test(sourceKey)) {
      return NextResponse.json({ error: 'A simple sourceKey is required.' }, { status: 400 });
    }
    const source = {
      sourceKey,
      companyName: 'U.S. Federal Government',
      keyword: input.keyword?.trim().slice(0, 100),
      location: input.location?.trim().slice(0, 100),
    };
    const jobs = await fetchUsaJobs(source, { maxPages: input.maxPages });
    const stats = await upsertImportedJobs(jobs, { provider: 'usajobs', sourceKey, companyName: source.companyName });
    return NextResponse.json({ provider: 'usajobs', sourceKey, ...stats });
  } catch (cause) {
    const error = cause instanceof Error ? cause : new Error('USAJOBS ingestion failed.');
    console.error('[usajobs ingestion]', { name: error.name, message: error.message });
    const status = error instanceof UsaJobsConnectorError
      ? error.code === 'MISSING_CONFIGURATION' ? 503 : error.status === 429 ? 429 : 502
      : error instanceof SyntaxError ? 400 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
