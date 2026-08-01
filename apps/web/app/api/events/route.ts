import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

function safeText(value: unknown, max = 160) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) {
      return NextResponse.json({ error: 'Cross-site events are not accepted' }, { status: 403 });
    }

    const body = await request.json() as Record<string, unknown>;
    const db = getAdminDb();

    if (body.type === 'job_apply_click') {
      const jobId = safeText(body.jobId, 240);
      if (!jobId) return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
      const job = await db.collection('jobs').doc(jobId).get();
      const data = job.data();
      if (!job.exists || data?.isImported !== true || typeof data.applyUrl !== 'string') {
        return NextResponse.json({ error: 'Imported job not found' }, { status: 404 });
      }
      await db.collection('interactionEvents').add({
        type: 'job_apply_click',
        jobId,
        sourceProvider: data.sourceProvider ?? 'unknown',
        sourceKey: data.sourceKey ?? null,
        destinationHost: new URL(data.applyUrl).hostname,
        createdAt: FieldValue.serverTimestamp(),
      });
      return new NextResponse(null, { status: 204 });
    }

    if (body.type === 'news_open') {
      const newsId = safeText(body.newsId, 240);
      const sourceName = safeText(body.sourceName, 120);
      const sourceUrl = safeText(body.sourceUrl, 2_000);
      if (!newsId || !sourceName || !sourceUrl) {
        return NextResponse.json({ error: 'News event details are required' }, { status: 400 });
      }
      let parsed: URL;
      try {
        parsed = new URL(sourceUrl);
      } catch {
        return NextResponse.json({ error: 'News source URL is invalid' }, { status: 400 });
      }
      if (parsed.protocol !== 'https:') return NextResponse.json({ error: 'News source must use HTTPS' }, { status: 400 });
      await db.collection('interactionEvents').add({
        type: 'news_open',
        newsId,
        sourceName,
        destinationHost: parsed.hostname,
        createdAt: FieldValue.serverTimestamp(),
      });
      return new NextResponse(null, { status: 204 });
    }

    return NextResponse.json({ error: 'Unsupported event type' }, { status: 400 });
  } catch (error) {
    console.error('[interaction event]', error);
    return NextResponse.json({ error: 'Unable to record interaction' }, { status: 500 });
  }
}
