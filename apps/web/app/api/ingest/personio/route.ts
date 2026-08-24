import { NextRequest, NextResponse } from 'next/server';

import { isIngestionRequestAuthorized } from '@/lib/job-ingestion/auth';
import {
  fetchPersonioJobs,
  PersonioConnectorError,
  personioFeedUrl,
  type PersonioLanguage,
} from '@/lib/job-ingestion/personio';
import { upsertImportedJobs } from '@/lib/job-ingestion/shared';

export const runtime = 'nodejs';
export const maxDuration = 60;

type IngestionRequest = {
  sourceKey?: string;
  companyName?: string;
  careersUrl?: string;
  language?: PersonioLanguage;
};

function validateSource(input: IngestionRequest) {
  const sourceKey = input.sourceKey?.trim();
  const companyName = input.companyName?.trim();
  if (!sourceKey || !companyName) {
    throw new PersonioConnectorError('sourceKey and companyName are required.', 'INVALID_CONFIGURATION');
  }
  const source = {
    sourceKey,
    companyName,
    careersUrl: input.careersUrl?.trim() || undefined,
    language: input.language,
  };
  personioFeedUrl(source);
  return source;
}

export async function POST(request: NextRequest) {
  if (!isIngestionRequestAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const source = validateSource(await request.json() as IngestionRequest);
    const jobs = await fetchPersonioJobs(source);
    const stats = await upsertImportedJobs(jobs, {
      provider: 'personio',
      sourceKey: source.sourceKey,
      companyName: source.companyName,
      careersUrl: source.careersUrl,
    });
    return NextResponse.json({ provider: 'personio', sourceKey: source.sourceKey, imported: jobs.length, ...stats });
  } catch (cause) {
    const error = cause instanceof Error ? cause : new Error('Personio ingestion failed.');
    console.error('[personio ingestion]', {
      name: error.name,
      message: error.message,
      ...(error instanceof PersonioConnectorError ? { code: error.code, status: error.status } : {}),
    });
    const status = error instanceof PersonioConnectorError
      ? error.code === 'INVALID_CONFIGURATION' ? 400 : error.status === 429 ? 429 : 502
      : error instanceof SyntaxError ? 400 : 500;
    return NextResponse.json(
      { error: error.message, ...(error instanceof PersonioConnectorError ? { code: error.code } : {}) },
      { status },
    );
  }
}
