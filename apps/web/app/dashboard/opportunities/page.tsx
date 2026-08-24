'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import OpportunityCard from '@/components/OpportunityCard';
import { useAuth } from '@/components/AuthProvider';
import type {
  OpportunityApiError,
  OpportunityCard as OpportunityCardData,
  OpportunityInboxPayload,
  OpportunityResponsePayload,
} from '@/lib/opportunity-contracts';
import type { OpportunityResponseInput } from '@/lib/opportunity-policy';
import { resolveOpportunityInboxView } from '@/lib/opportunity-ui';

type LoadStatus = 'idle' | 'loading' | 'success' | 'error';

export default function OpportunityInboxPage() {
  const { user, accountType, loading: authLoading, error: authError } = useAuth();
  const [status, setStatus] = useState<LoadStatus>('idle');
  const [opportunities, setOpportunities] = useState<OpportunityCardData[]>([]);
  const [apiError, setApiError] = useState<OpportunityApiError['error'] | null>(null);
  const [respondingIds, setRespondingIds] = useState<Set<string>>(new Set());
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});

  const loadOpportunities = useCallback(async () => {
    if (!user || accountType !== 'worker') return;
    setStatus('loading');
    setApiError(null);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/opportunities?pageSize=20', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const body = await response.json() as OpportunityInboxPayload | OpportunityApiError;
      if (!response.ok || !('data' in body)) {
        throw 'error' in body ? body.error : { code: 'INTERNAL_ERROR', message: 'The inbox could not be loaded.' };
      }
      setOpportunities(body.data);
      setStatus('success');
    } catch (error) {
      const normalized = error && typeof error === 'object' && 'code' in error && 'message' in error
        ? error as OpportunityApiError['error']
        : { code: 'INTERNAL_ERROR' as const, message: 'The inbox wandered off. Please try again.' };
      setApiError(normalized);
      setStatus('error');
    }
  }, [accountType, user]);

  useEffect(() => {
    if (authLoading || authError || !user || accountType !== 'worker') return;
    void loadOpportunities();
  }, [accountType, authError, authLoading, loadOpportunities, user]);

  async function respond(opportunityId: string, input: OpportunityResponseInput) {
    if (!user || respondingIds.has(opportunityId)) return;
    setRespondingIds(current => new Set(current).add(opportunityId));
    setActionErrors(current => ({ ...current, [opportunityId]: '' }));
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/opportunities/${encodeURIComponent(opportunityId)}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(input),
      });
      const body = await response.json() as OpportunityResponsePayload | OpportunityApiError;
      if (!response.ok || !('data' in body)) {
        throw new Error('error' in body ? body.error.message : 'Your response could not be saved.');
      }
      setOpportunities(current => current.map(item => item.id === opportunityId ? {
        ...item,
        response: {
          decision: body.data.decision,
          passReason: body.data.passReason,
          respondedAt: body.data.respondedAt,
        },
      } : item));
    } catch (error) {
      setActionErrors(current => ({
        ...current,
        [opportunityId]: error instanceof Error ? error.message : 'Your response could not be saved.',
      }));
    } finally {
      setRespondingIds(current => {
        const next = new Set(current);
        next.delete(opportunityId);
        return next;
      });
    }
  }

  const view = resolveOpportunityInboxView({
    authLoading,
    authError: Boolean(authError),
    hasUser: Boolean(user),
    accountType,
    loadStatus: status,
    apiErrorCode: apiError?.code,
    itemCount: opportunities.length,
  });

  return (
    <div className="min-h-[70vh] bg-[#fcfbff] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 rounded-3xl border-2 border-ink bg-primary-100 p-6 shadow-pop sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-primary-700">Private pro inbox · zero booking shenanigans</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-ink sm:text-5xl">Gigs that pass the vibe check.</h1>
          <p className="mt-3 max-w-3xl leading-relaxed text-slate-700">
            These requests match your category, coarse travel radius, availability, and minimum estimated hourly take-home. Interest starts a conversation later—it is not a booking or price approval.
          </p>
        </header>

        {view === 'loading' && (
          <div aria-busy="true" aria-label="Loading professional opportunities" className="space-y-5">
            {[1, 2, 3].map(item => <div key={item} className="h-64 animate-pulse rounded-3xl border-2 border-ink/15 bg-slate-100 motion-reduce:animate-none" />)}
          </div>
        )}

        {view === 'signed_out' && (
          <StatePanel icon="🔐" title="The gigs are behind the velvet rope." message="Sign in with your worker account to open your private opportunity inbox.">
            <Link href="/sign-in" className="btn-primary">Sign in</Link>
          </StatePanel>
        )}

        {view === 'unauthorized' && (
          <StatePanel
            icon="🧰"
            title="Your pro setup needs one more wrench turn."
            message={apiError?.message ?? 'This inbox is only for worker accounts with a gig profile and private matching preferences.'}
          >
            {accountType === 'worker' ? (
              <Link href="/dashboard/create-gig-profile" className="btn-primary">Finish gig profile</Link>
            ) : (
              <Link href="/gigs" className="btn-secondary">Browse gigs</Link>
            )}
          </StatePanel>
        )}

        {view === 'error' && (
          <StatePanel icon="🫠" title="The inbox tripped over its own toolbox." message={authError ?? apiError?.message ?? 'Something went wrong while loading opportunities.'} role="alert">
            <button type="button" onClick={() => void loadOpportunities()} className="btn-primary">Try again</button>
          </StatePanel>
        )}

        {view === 'empty' && (
          <StatePanel
            icon="🕵️"
            title="No trustworthy matches yet."
            message="That can mean requests are outside your radius, below your earnings floor, missing required details, or simply not your trade. JobMan refuses to make up the math."
          >
            <Link href="/dashboard/create-gig-profile" className="btn-secondary">Review my preferences</Link>
            <button type="button" onClick={() => void loadOpportunities()} className="btn-primary">Refresh the hunt</button>
          </StatePanel>
        )}

        {view === 'ready' && (
          <div className="space-y-7">
            <p role="status" className="text-sm font-semibold text-slate-600">
              {opportunities.length} eligible opportunit{opportunities.length === 1 ? 'y' : 'ies'} · private to your account
            </p>
            {opportunities.map(opportunity => (
              <OpportunityCard
                key={opportunity.id}
                opportunity={opportunity}
                isResponding={respondingIds.has(opportunity.id)}
                actionError={actionErrors[opportunity.id]}
                onRespond={input => respond(opportunity.id, input)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatePanel({
  icon,
  title,
  message,
  children,
  role = 'status',
}: {
  icon: string;
  title: string;
  message: string;
  children: React.ReactNode;
  role?: 'status' | 'alert';
}) {
  return (
    <section role={role} className="rounded-3xl border-2 border-ink bg-white p-7 text-center shadow-pop sm:p-10">
      <div className="text-5xl" aria-hidden="true">{icon}</div>
      <h2 className="mt-4 font-display text-2xl font-bold text-ink sm:text-3xl">{title}</h2>
      <p className="mx-auto mt-3 max-w-2xl leading-relaxed text-slate-600">{message}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">{children}</div>
    </section>
  );
}
