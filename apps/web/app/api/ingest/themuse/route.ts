import { NextRequest, NextResponse } from 'next/server';
import { isIngestionRequestAuthorized } from '@/lib/job-ingestion/auth';
import { upsertImportedJobs } from '@/lib/job-ingestion/shared';
import { fetchTheMuseJobs } from '@/lib/job-ingestion/themuse';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  if (!isIngestionRequestAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const input = await request.json() as { sourceKey?: string; category?: string; location?: string; level?: string; maxPages?: number };
    const sourceKey = input.sourceKey?.trim();
    if (!sourceKey || !/^[a-zA-Z0-9_-]{1,80}$/.test(sourceKey)) return NextResponse.json({ error: 'A simple sourceKey is required.' }, { status: 400 });
    const source = { sourceKey, companyName: 'The Muse marketplace', category: input.category?.trim(), location: input.location?.trim(), level: input.level?.trim() };
    const jobs = await fetchTheMuseJobs(source, { maxPages: input.maxPages });
    const stats = await upsertImportedJobs(jobs, { provider: 'themuse', sourceKey, companyName: source.companyName });
    return NextResponse.json({ provider: 'themuse', sourceKey, ...stats });
  } catch (cause) {
    const error = cause instanceof Error ? cause : new Error('The Muse ingestion failed.');
    console.error('[themuse ingestion]', { name: error.name, message: error.message });
    return NextResponse.json({ error: error.message }, { status: error instanceof SyntaxError ? 400 : 502 });
  }
}
