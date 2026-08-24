export type PartnerAdapterId = 'taskrabbit' | 'upwork' | 'adzuna';
type Environment = Record<string, string | undefined>;

export type ConnectorGate = {
  id: PartnerAdapterId;
  name: string;
  enabled: false;
  configured: boolean;
  reason: 'partner_access_required' | 'terms_confirmation_required' | 'credentials_required' | 'implementation_review_required';
  nextStep: string;
  makesNetworkRequests: false;
};

export function connectorGateStatus(environment: Environment = process.env): ConnectorGate[] {
  const adzunaTermsApproved = Boolean(environment.ADZUNA_TERMS_APPROVED_AT?.trim());
  const adzunaCredentials = Boolean(environment.ADZUNA_APP_ID?.trim() && environment.ADZUNA_APP_KEY?.trim());
  return [
    {
      id: 'taskrabbit', name: 'Taskrabbit', enabled: false, configured: Boolean(environment.TASKRABBIT_PARTNER_TOKEN?.trim()),
      reason: 'partner_access_required', nextStep: 'Obtain written partner/API access and approved documentation before implementation.', makesNetworkRequests: false,
    },
    {
      id: 'upwork', name: 'Upwork', enabled: false, configured: Boolean(environment.UPWORK_CLIENT_ID?.trim() && environment.UPWORK_CLIENT_SECRET?.trim()),
      reason: 'partner_access_required', nextStep: 'Obtain approved API access for the intended job-listing use case before implementation.', makesNetworkRequests: false,
    },
    {
      id: 'adzuna', name: 'Adzuna', enabled: false, configured: adzunaCredentials,
      reason: !adzunaTermsApproved ? 'terms_confirmation_required' : !adzunaCredentials ? 'credentials_required' : 'implementation_review_required',
      nextStep: !adzunaTermsApproved
        ? 'Confirm written commercial permission/licensing and required “Jobs by Adzuna” attribution before adding credentials.'
        : !adzunaCredentials ? 'Add server-only app_id/app_key after approval.' : 'Run a final attribution, removal, quota, and data-lifecycle review before writing the connector.',
      makesNetworkRequests: false,
    },
  ];
}

export async function executePartnerAdapter(_id: PartnerAdapterId, _request: () => Promise<unknown>): Promise<never> {
  // Deliberately never invokes `_request`. This fail-closed function prevents a
  // credential alone from silently activating a partner-restricted connector.
  throw new Error('This partner adapter is disabled pending explicit access and implementation approval.');
}
