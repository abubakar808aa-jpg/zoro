import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { verifyFirebaseToken } from '@/lib/verify-token';
import { fetchYelpCandidates, isYelpServiceCategory } from '@/lib/provider-discovery/yelp';

export const runtime = 'nodejs';

async function requireAdmin(request: Request) {
  const uid = await verifyFirebaseToken(request.headers.get('authorization'));
  const db = getAdminDb();
  if ((await db.doc(`users/${uid}`).get()).data()?.isAdmin !== true) throw new Error('ADMIN_REQUIRED');
  return { uid, db };
}

function errorResponse(cause: unknown) {
  const message = cause instanceof Error ? cause.message : 'Provider discovery failed.';
  if (message === 'ADMIN_REQUIRED') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  if (/token|unauthorized/i.test(message)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (/not configured/i.test(message)) return NextResponse.json({ error: message }, { status: 503 });
  console.error('[provider discovery]', { message });
  return NextResponse.json({ error: 'Provider discovery is temporarily unavailable.' }, { status: 502 });
}

export async function GET(request: Request) {
  try {
    const { db } = await requireAdmin(request);
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    if (category) {
      if (!isYelpServiceCategory(category)) return NextResponse.json({ error: 'Unsupported service category.' }, { status: 400 });
      return NextResponse.json({ candidates: await fetchYelpCandidates(category), attribution: 'Provider discovery data supplied by Yelp.' });
    }
    const snapshot = await db.collection('providerDiscoveryCandidates').orderBy('reviewedAt', 'desc').limit(100).get();
    return NextResponse.json({ candidates: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) });
  } catch (cause) { return errorResponse(cause); }
}

export async function POST(request: Request) {
  try {
    const { uid, db } = await requireAdmin(request);
    const body = await request.json() as { action?: 'queue' | 'approve' | 'reject'; candidate?: Record<string, unknown>; candidateId?: string };
    if (body.action === 'queue') {
      const candidate = body.candidate;
      const id = typeof candidate?.id === 'string' && /^yelp_[a-zA-Z0-9_-]+$/.test(candidate.id) ? candidate.id : '';
      const sourceId = typeof candidate?.sourceId === 'string' ? candidate.sourceId.trim().slice(0, 100) : '';
      const name = typeof candidate?.name === 'string' ? candidate.name.trim().slice(0, 160) : '';
      const searchCategory = candidate?.searchCategory;
      if (!id || !sourceId || !name || !isYelpServiceCategory(searchCategory) || candidate?.source !== 'yelp' || typeof candidate.sourceUrl !== 'string' || !candidate.sourceUrl.startsWith('https://www.yelp.com/')) {
        return NextResponse.json({ error: 'Invalid Yelp candidate.' }, { status: 400 });
      }
      const location = candidate.location && typeof candidate.location === 'object' && !Array.isArray(candidate.location)
        ? candidate.location as Record<string, unknown> : {};
      const categories = Array.isArray(candidate.categories) ? candidate.categories.flatMap(value => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
        const item = value as Record<string, unknown>;
        const alias = String(item.alias || '').slice(0, 60);
        const title = String(item.title || '').slice(0, 100);
        return alias && title ? [{ alias, title }] : [];
      }).slice(0, 10) : [];
      const rating = Number(candidate.rating);
      const safe = {
        source: 'yelp', sourceId, sourceUrl: candidate.sourceUrl.slice(0, 500),
        name, searchCategory,
        categories, rating: Number.isFinite(rating) && rating >= 0 && rating <= 5 ? rating : null,
        reviewCount: Math.max(0, Math.min(1_000_000, Number(candidate.reviewCount) || 0)),
        location: { city: String(location.city || '').slice(0, 80), state: String(location.state || '').slice(0, 3) },
        status: 'pending_review',
        discoveredBy: uid, reviewedAt: FieldValue.serverTimestamp(),
      };
      await db.collection('providerDiscoveryCandidates').doc(id).set(safe, { merge: true });
      return NextResponse.json({ ok: true, status: safe.status });
    }
    if ((body.action === 'approve' || body.action === 'reject') && body.candidateId && /^yelp_[a-zA-Z0-9_-]+$/.test(body.candidateId)) {
      const reference = db.collection('providerDiscoveryCandidates').doc(body.candidateId);
      if (!(await reference.get()).exists) return NextResponse.json({ error: 'Candidate not found.' }, { status: 404 });
      await reference.set({
        status: body.action === 'approve' ? 'approved_for_manual_onboarding' : 'rejected', reviewedBy: uid, reviewedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'Unsupported review action.' }, { status: 400 });
  } catch (cause) { return errorResponse(cause); }
}
