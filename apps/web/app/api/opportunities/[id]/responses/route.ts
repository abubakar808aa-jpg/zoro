import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';

import { getAdminDb } from '@/lib/firebase-admin';
import type { OpportunityApiError, OpportunityResponsePayload } from '@/lib/opportunity-contracts';
import { calculateOpportunityEligibility } from '@/lib/opportunity-matcher';
import {
  decideResponseTransition,
  parseOpportunityResponseBody,
} from '@/lib/opportunity-policy';
import {
  OpportunityApiException,
  createRequestId,
  logOpportunityServerError,
  parseProfessionalMatchContext,
  parseStoredResponse,
  recordMarketplaceEvent,
  requestMatchInput,
  responseDocumentId,
} from '@/lib/opportunity-server';
import { verifyFirebaseToken } from '@/lib/verify-token';

export const runtime = 'nodejs';

function errorResponse(
  requestId: string,
  error: OpportunityApiException,
): NextResponse<OpportunityApiError> {
  return NextResponse.json({
    error: { code: error.code, message: error.message, requestId },
  }, {
    status: error.status,
    headers: { 'cache-control': 'private, no-store', 'x-request-id': requestId },
  });
}

async function authenticatedUid(req: Request): Promise<string> {
  try {
    return await verifyFirebaseToken(req.headers.get('authorization'));
  } catch {
    throw new OpportunityApiException(401, 'AUTHENTICATION_REQUIRED', 'Sign in to respond to opportunities.');
  }
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = createRequestId();
  try {
    const uid = await authenticatedUid(req);
    const contentLength = Number(req.headers.get('content-length') ?? 0);
    if (!Number.isFinite(contentLength) || contentLength > 4_096) {
      throw new OpportunityApiException(400, 'VALIDATION_ERROR', 'The response is too large.');
    }
    const { id: opportunityId } = await context.params;
    if (!/^[A-Za-z0-9_-]{1,200}$/.test(opportunityId)) {
      throw new OpportunityApiException(400, 'VALIDATION_ERROR', 'Invalid opportunity ID.');
    }
    let input;
    try {
      input = parseOpportunityResponseBody(await req.text());
    } catch {
      throw new OpportunityApiException(400, 'VALIDATION_ERROR', 'Choose a valid response and pass reason.');
    }
    const adminDb = getAdminDb();
    const responseRef = adminDb.doc(`opportunityResponses/${responseDocumentId(uid, opportunityId)}`);
    const respondedAt = new Date().toISOString();

    const result = await adminDb.runTransaction(async transaction => {
      const userRef = adminDb.doc(`users/${uid}`);
      const profileRef = adminDb.doc(`profiles/${uid}`);
      const preferenceRef = adminDb.doc(`workerGigPreferences/${uid}`);
      const opportunityRef = adminDb.doc(`serviceRequests/${opportunityId}`);
      const [user, profile, preferences, opportunity, stored] = await transaction.getAll(
        userRef,
        profileRef,
        preferenceRef,
        opportunityRef,
        responseRef,
      );
      const professional = parseProfessionalMatchContext(
        uid,
        user.data(),
        profile.data(),
        preferences.data(),
      );
      if (
        !opportunity.exists
        || opportunity.data()?.status !== 'open'
        || opportunity.data()?.customerId === uid
      ) {
        throw new OpportunityApiException(404, 'OPPORTUNITY_NOT_FOUND', 'This opportunity is not available.');
      }
      const eligibility = calculateOpportunityEligibility(
        requestMatchInput(professional.matchProfessional, opportunity.data()),
      );
      if (!eligibility.eligible) {
        throw new OpportunityApiException(404, 'OPPORTUNITY_NOT_FOUND', 'This opportunity is not available.');
      }

      const existing = parseStoredResponse(stored.data());
      const transition = decideResponseTransition(existing, input);
      if (transition.action === 'conflict') {
        throw new OpportunityApiException(
          409,
          'RESPONSE_CONFLICT',
          'You already responded differently. Contact support if that was a mistake.',
        );
      }
      if (transition.action === 'create') {
        transaction.create(responseRef, {
          opportunityId,
          professionalId: uid,
          decision: transition.response.decision,
          passReason: transition.response.passReason,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      return {
        response: transition.response,
        idempotentReplay: transition.action === 'noop',
        originalRespondedAt: existing?.respondedAt,
      };
    });

    await recordMarketplaceEvent(adminDb, {
      eventName: result.response.decision === 'interested' ? 'interest_expressed' : 'opportunity_passed',
      workerId: uid,
      opportunityId,
      ...(result.response.passReason ? { reasonCode: result.response.passReason } : {}),
      requestId,
    }).catch(() => {});

    const payload: OpportunityResponsePayload = {
      data: {
        opportunityId,
        decision: result.response.decision,
        passReason: result.response.passReason,
        respondedAt: result.originalRespondedAt ?? respondedAt,
        idempotentReplay: result.idempotentReplay,
      },
    };
    return NextResponse.json(payload, {
      status: result.idempotentReplay ? 200 : 201,
      headers: { 'cache-control': 'private, no-store', 'x-request-id': requestId },
    });
  } catch (error) {
    if (error instanceof OpportunityApiException) return errorResponse(requestId, error);
    if (error instanceof Error && error.message.includes('FIREBASE_SERVICE_ACCOUNT_KEY')) {
      return errorResponse(requestId, new OpportunityApiException(
        503,
        'CONFIGURATION_ERROR',
        'Opportunity responses are not configured on this server.',
      ));
    }
    logOpportunityServerError(requestId, 'INTERNAL_ERROR');
    return errorResponse(requestId, new OpportunityApiException(
      500,
      'INTERNAL_ERROR',
      'Your response could not be saved. Please try again.',
    ));
  }
}
