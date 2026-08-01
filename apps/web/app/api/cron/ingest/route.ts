import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import {
  runScheduledSource,
  validateScheduledSource,
  type ScheduledJobSource,
} from '@/lib/job-ingestion/run-source';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const STARTER_SOURCES: ScheduledJobSource[] = [
  {
    provider: 'greenhouse',
    sourceKey: 'figma',
    companyName: 'Figma',
    careersUrl: 'https://www.figma.com/careers/',
  },
  {
    provider: 'lever',
    sourceKey: 'palantir',
    companyName: 'Palantir',
    careersUrl: 'https://www.palantir.com/careers/',
  },
  {
    provider: 'ashby',
    sourceKey: 'ramp',
    companyName: 'Ramp',
    careersUrl: 'https://ramp.com/careers',
  },
  {
    provider: 'smartrecruiters',
    sourceKey: 'smartrecruiters',
    companyName: 'SmartRecruiters',
    careersUrl: 'https://careers.smartrecruiters.com/SmartRecruiters',
  },
  {
    provider: 'workable',
    sourceKey: 'commonapp',
    companyName: 'Common App',
    careersUrl: 'https://apply.workable.com/commonapp/',
  },
  {
    provider: 'recruitee',
    sourceKey: 'resourcefultalentgroup',
    companyName: 'Resourceful Talent Group',
    careersUrl: 'https://resourcefultalentgroup.recruitee.com/',
  },
];

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get('authorization') === `Bearer ${secret}`);
}

function environmentSources() {
  const raw = process.env.CONNECTOR_SOURCES_JSON;
  if (!raw) return [];
  try {
    const values = JSON.parse(raw) as unknown[];
    return Array.isArray(values) ? values.map(validateScheduledSource).filter(Boolean) as ScheduledJobSource[] : [];
  } catch {
    throw new Error('CONNECTOR_SOURCES_JSON must be a valid JSON array.');
  }
}

async function firestoreSources() {
  const snapshot = await getAdminDb().collection('jobSources').where('active', '==', true).get();
  return snapshot.docs
    .map(item => validateScheduledSource(item.data()))
    .filter(Boolean) as ScheduledJobSource[];
}

function uniqueSources(sources: ScheduledJobSource[]) {
  const seen = new Set<string>();
  return sources.filter(source => {
    const key = `${source.provider}:${source.sourceKey}`;
    if (seen.has(key) || source.active === false) return false;
    seen.add(key);
    return true;
  });
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getAdminDb();
  const runRef = db.collection('ingestionRuns').doc();
  await runRef.set({
    trigger: 'vercel-cron',
    status: 'running',
    startedAt: FieldValue.serverTimestamp(),
  });

  try {
    const includeStarters = process.env.ENABLE_STARTER_SOURCES !== 'false';
    const sources = uniqueSources([
      ...environmentSources(),
      ...await firestoreSources(),
      ...(includeStarters ? STARTER_SOURCES : []),
    ]).slice(0, 12);

    const results: Array<{ provider: string; sourceKey: string; status: 'success' | 'failed'; jobsFound: number; error?: string }> = [];

    // Run two feeds at a time so a slow employer cannot block every connector,
    // while keeping outbound traffic and Firestore writes controlled.
    for (let index = 0; index < sources.length; index += 2) {
      const chunk = sources.slice(index, index + 2);
      const settled = await Promise.all(chunk.map(async source => {
        const logRef = db.collection('sourceFetchLogs').doc();
        await logRef.set({
          runId: runRef.id,
          source: `${source.provider}:${source.sourceKey}`,
          provider: source.provider,
          sourceKey: source.sourceKey,
          requestedAt: FieldValue.serverTimestamp(),
          status: 'running',
        });
        try {
          const jobsFound = await runScheduledSource(source);
          await logRef.set({
            status: 'success',
            responseStatus: 200,
            jobsFound,
            jobsCreated: null,
            jobsUpdated: null,
            jobsClosed: 0,
            completedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
          return { provider: source.provider, sourceKey: source.sourceKey, status: 'success' as const, jobsFound };
        } catch (cause) {
          const error = cause instanceof Error ? cause.message : 'Unknown connector error.';
          await Promise.all([
            logRef.set({ status: 'failed', error, completedAt: FieldValue.serverTimestamp() }, { merge: true }),
            db.collection('jobSources').doc(`${source.provider}_${source.sourceKey}`).set({
              provider: source.provider,
              sourceKey: source.sourceKey,
              companyName: source.companyName,
              active: true,
              lastFetchedAt: FieldValue.serverTimestamp(),
              lastError: error,
            }, { merge: true }),
          ]);
          return { provider: source.provider, sourceKey: source.sourceKey, status: 'failed' as const, jobsFound: 0, error };
        }
      }));
      results.push(...settled);
    }

    const failures = results.filter(item => item.status === 'failed').length;
    const jobsFound = results.reduce((sum, item) => sum + item.jobsFound, 0);
    await runRef.set({
      status: failures ? 'partial' : 'success',
      sourcesAttempted: results.length,
      sourcesFailed: failures,
      jobsFound,
      completedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return NextResponse.json({ runId: runRef.id, sourcesAttempted: results.length, failures, jobsFound, results }, { status: failures === results.length && results.length ? 502 : 200 });
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : 'Scheduled ingestion failed.';
    await runRef.set({ status: 'failed', error, completedAt: FieldValue.serverTimestamp() }, { merge: true });
    console.error('[scheduled ingestion]', cause);
    return NextResponse.json({ runId: runRef.id, error }, { status: 500 });
  }
}
