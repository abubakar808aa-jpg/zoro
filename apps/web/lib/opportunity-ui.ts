export type OpportunityInboxView =
  | 'loading'
  | 'signed_out'
  | 'unauthorized'
  | 'empty'
  | 'error'
  | 'ready';

export interface OpportunityInboxViewInput {
  authLoading: boolean;
  authError?: boolean;
  hasUser: boolean;
  accountType: string | null;
  loadStatus: 'idle' | 'loading' | 'success' | 'error';
  apiErrorCode?: string;
  itemCount: number;
}

const SETUP_ERROR_CODES = new Set([
  'PROFESSIONAL_REQUIRED',
  'GIG_PROFILE_REQUIRED',
  'PREFERENCES_REQUIRED',
]);

export function resolveOpportunityInboxView(input: OpportunityInboxViewInput): OpportunityInboxView {
  if (input.authLoading) return 'loading';
  if (input.authError) return 'error';
  if (!input.hasUser) return 'signed_out';
  if (input.accountType !== 'worker') return 'unauthorized';
  if (input.loadStatus === 'loading' || input.loadStatus === 'idle') return 'loading';
  if (input.loadStatus === 'error') {
    return input.apiErrorCode && SETUP_ERROR_CODES.has(input.apiErrorCode) ? 'unauthorized' : 'error';
  }
  return input.itemCount === 0 ? 'empty' : 'ready';
}

export function formatMinorCurrency(minor: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}
