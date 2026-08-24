import { NextResponse } from 'next/server';

import { getAdminDb } from '@/lib/firebase-admin';
import type { OpportunityApiError, OpportunityInboxPayload } from '@/lib/opportunity-contracts';
import {
  OpportunityApiException,
  buildOpportunityCard,
  createRequestId,
  loadProfessionalMatchContext,
  logOpportunityServerError,
  recordMarketplaceEvent,
  requestMatchInput,
  responseDocumentId,
} from '@/lib/opportunity-server';
import { calculateOpportunityEligibility } from '@/lib/opportunity-matcher';
import { verifyFirebaseToken } from '@/lib/verify-token';

export const runtime = 'nodejs';

function errorResponse(
  requestId: string,
  error: OpportunityApiException,
): NextResponse<OpportunityApiError> {
  return NextResponse.json({
    error: {
      code: error.code,
      message: error.message,
      ...(error.reasonCode ? { reasonCode: error.reasonCode } : {}),
      requestId,
    },
  }, {
    status: error.status,
    headers: { 'cache-control': 'private, no-store', 'x-request-id': requestId },
  });
}

function pageSizeFromUrl(req: Request): number {
  const value = new URL(req.url).searchParams.get('pageSize');
  if (!value) return 20;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 50) {
    throw new OpportunityApiException(400, 'VALIDATION_ERROR', 'pageSize must be an integer from 1 to 50.');
  }
  return parsed;
}

async function authenticatedUid(req: Request): Promise<string> {
  try {
    return await verifyFirebaseToken(req.headers.get('authorization'));
  } catch {
    throw new OpportunityApiException(401, 'AUTHENTICATION_REQUIRED', 'Sign in to view professional opportunities.');
  }
}

export async function GET(req: Request) {
  const requestId = createRequestId();
  try {
    const uid = await authenticatedUid(req);
    const pageSize = pageSizeFromUrl(req);
    const adminDb = getAdminDb();
    const context = await loadProfessionalMatchContext(adminDb, uid);
    const snapshot = await adminDb.collection('serviceRequests')
      .where('status', '==', 'open')
      .limit(Math.min(pageSize * 5, 250))
      .get();

    const evaluated = snapshot.docs.map(request => {
      const eligibility = request.data().customerId === uid
        ? { eligible: false as const, reasonCode: 'SELF_REQUEST' as const }
        : calculateOpportunityEligibility(requestMatchInput(context.matchProfessional, request.data()));
      return { request, eligibility };
    });
    const eligible = evaluated.filter((item): item is typeof item & {
      eligibility: Extract<typeof item.eligibility, { eligible: true }>;
    } => item.eligibility.eligible).slice(0, pageSize);

    const responseSnapshots = eligible.length
      ? await adminDb.getAll(...eligible.map(item => adminDb.doc(
        `opportunityResponses/${responseDocumentId(uid, item.request.id)}`,
      )))
      : [];
    const cards = eligible.map((item, index) => buildOpportunityCard(
      item.request,
      item.eligibility,
      responseSnapshots[index]?.data(),
    ));

    const eventWrites = evaluated.map(item => {
      const eventName = item.eligibility.eligible
        ? (eligible.some(included => included.request.id === item.request.id) ? 'opportunity_shown' : null)
        : item.eligibility.reasonCode === 'CALCULATION_FAILURE'
          ? 'matching_calculation_failure'
          : 'match_excluded';
      if (!eventName) return Promise.resolve();
      return recordMarketplaceEvent(adminDb, {
        eventName,
        workerId: uid,
        opportunityId: item.request.id,
        ...(!item.eligibility.eligible ? { reasonCode: item.eligibility.reasonCode } : {}),
        requestId,
      });
    });
    await Promise.allSettled(eventWrites);

    const payload: OpportunityInboxPayload = {
      data: cards,
      meta: {
        pageSize,
        evaluatedCount: evaluated.length,
        excludedCount: evaluated.filter(item => !item.eligibility.eligible).length,
        refreshedAt: new Date().toISOString(),
      },
    };
    return NextResponse.json(payload, {
      headers: { 'cache-control': 'private, no-store', 'x-request-id': requestId },
    });
  } catch (error) {
    if (error instanceof OpportunityApiException) return errorResponse(requestId, error);
    if (error instanceof Error && error.message.includes('FIREBASE_SERVICE_ACCOUNT_KEY')) {
      return errorResponse(requestId, new OpportunityApiException(
        503,
        'CONFIGURATION_ERROR',
        'Opportunity matching is not configured on this server.',
      ));
    }
    logOpportunityServerError(requestId, 'INTERNAL_ERROR');
    return errorResponse(requestId, new OpportunityApiException(
      500,
      'INTERNAL_ERROR',
      'The opportunity inbox could not be loaded. Please try again.',
    ));
  }
}
