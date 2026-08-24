import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { validateInteractionEvent } from '@/lib/analytics-contract';

export const runtime = 'nodejs';
const MAX_EVENT_BYTES = 4_096;

function jsonError(error: string, status: number) {
  return NextResponse.json(
    { error },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();

  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) {
      return jsonError('Cross-site events are not accepted', 403);
    }

    const declaredLength = Number(request.headers.get('content-length') || 0);
    if (declaredLength > MAX_EVENT_BYTES) return jsonError('Event payload is too large', 413);

    const rawBody = await request.text();
    if (!rawBody || new TextEncoder().encode(rawBody).byteLength > MAX_EVENT_BYTES) {
      return jsonError('Event payload is invalid', 400);
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return jsonError('Event payload is invalid', 400);
    }

    const validation = validateInteractionEvent(body);
    if (!validation.ok) return jsonError(validation.error, 400);

    const event = validation.event;
    const db = getAdminDb();

    if (event.type === 'job_apply_click') {
      const job = await db.collection('jobs').doc(event.jobId).get();
      const data = job.data();
      if (!job.exists || data?.isImported !== true || typeof data.applyUrl !== 'string') {
        return jsonError('Imported job not found', 404);
      }

      let destination: URL;
      try {
        destination = new URL(data.applyUrl);
      } catch {
        return jsonError('Imported job destination is invalid', 422);
      }
      if (!['http:', 'https:'].includes(destination.protocol)) {
        return jsonError('Imported job destination is invalid', 422);
      }

      await db.collection('interactionEvents').add({
        type: 'job_apply_click',
        jobId: event.jobId,
        sourceProvider: data.sourceProvider ?? 'unknown',
        sourceKey: data.sourceKey ?? null,
        destinationHost: destination.hostname,
        createdAt: FieldValue.serverTimestamp(),
      });
      return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
    }

    if (event.type === 'news_open') {
      await db.collection('interactionEvents').add({
        type: 'news_open',
        newsId: event.newsId,
        sourceName: event.sourceName,
        createdAt: FieldValue.serverTimestamp(),
      });
      return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
    }

    return jsonError('Unsupported event type', 400);
  } catch (error) {
    console.error(JSON.stringify({
      event: 'interaction_event_failed',
      requestId,
      error: error instanceof Error ? error.message : 'unknown',
    }));
    return jsonError('Unable to record interaction', 500);
  }
}
