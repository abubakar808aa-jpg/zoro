export type AgentId = 'customer-research' | 'product' | 'go-to-market' | 'critical-review';

export type AgentWorkStatus = 'complete' | 'awaiting_approval' | 'blocked' | 'in_progress';

export type ApprovalStatus = 'pending' | 'approved' | 'declined';

export type ApprovalRisk = 'low' | 'medium' | 'high';

export type AgentTaskKind = 'typecheck' | 'build' | 'connector-health' | 'ingestion-dry-run';

export type AgentTaskStatus = 'awaiting_approval' | 'running' | 'complete' | 'failed';

export interface AgentTaskDefinition {
  kind: AgentTaskKind;
  title: string;
  description: string;
  permissionBoundary: string;
}

export interface AgentTask {
  id: string;
  kind: AgentTaskKind;
  title: string;
  description: string;
  status: AgentTaskStatus;
  requestedAt: string;
  requestedBy?: string;
  startedAt?: string;
  approvedBy?: string;
  completedAt?: string;
  output?: string;
  error?: string;
}

export interface AgentWorkstream {
  id: AgentId;
  codename: string;
  specialty: string;
  status: AgentWorkStatus;
  progress: number;
  summary: string;
  latestDeliverable: string;
  nextStep: string;
  approvalRequired: boolean;
}

export interface AgentApproval {
  id: string;
  agentId: AgentId;
  title: string;
  description: string;
  permissionBoundary: string;
  risk: ApprovalRisk;
  status: ApprovalStatus;
  requestedAt: string;
  decidedAt?: string;
  decidedBy?: string;
  note?: string;
}

export interface AgentDashboardPayload {
  agents: AgentWorkstream[];
  approvals: AgentApproval[];
  instructions: AgentInstruction[];
  tasks: AgentTask[];
  taskDefinitions: AgentTaskDefinition[];
  runtime: {
    provider: 'ollama';
    model: string;
    available: boolean;
  };
  runner: {
    available: boolean;
    localOnly: true;
  };
  refreshedAt: string;
}

export interface AgentInstruction {
  id: string;
  agentId: AgentId;
  body: string;
  status: 'queued' | 'running' | 'complete' | 'failed';
  createdAt: string;
  createdBy?: string;
  reply?: string;
  completedAt?: string;
  error?: string;
}

export const AGENT_TASK_DEFINITIONS: AgentTaskDefinition[] = [
  {
    kind: 'typecheck',
    title: 'Type-check the website',
    description: 'Check the website code for TypeScript mistakes without changing application data.',
    permissionBoundary: 'Runs only the fixed npm typecheck script inside apps/web on this Mac.',
  },
  {
    kind: 'build',
    title: 'Verify a production build',
    description: 'Create an isolated local production build to catch deployment-breaking errors.',
    permissionBoundary: 'Builds into .next-phase1 on this Mac. It does not deploy or modify the live site.',
  },
  {
    kind: 'connector-health',
    title: 'Check job connectors',
    description: 'Ask each starter connector for live public jobs and report which sources answer.',
    permissionBoundary: 'Read-only public requests. It does not write jobs to Firestore or change source settings.',
  },
  {
    kind: 'ingestion-dry-run',
    title: 'Preview job ingestion',
    description: 'Fetch and normalize sample jobs, then report data quality before anything is saved.',
    permissionBoundary: 'Read-only dry run. It never calls the database upsert path.',
  },
];

export const AGENT_WORKSTREAMS: AgentWorkstream[] = [
  {
    id: 'customer-research',
    codename: 'Heisenberg',
    specialty: 'Customer research',
    status: 'awaiting_approval',
    progress: 100,
    summary: 'Defined the early-adopter hypotheses, ranked job-search pain, and separated evidence from inference.',
    latestDeliverable: 'Customer discovery memo and 5 interview hypotheses',
    nextStep: 'Interview 12 qualified recent graduates without pitching JobMan first.',
    approvalRequired: true,
  },
  {
    id: 'product',
    codename: 'Hilbert',
    specialty: 'Product',
    status: 'awaiting_approval',
    progress: 100,
    summary: 'Audited the repository and reduced the MVP to trustworthy freshness, direct applications, and measurement.',
    latestDeliverable: 'MVP scope, repository gap audit, and success criteria',
    nextStep: 'Implement timestamp integrity and outbound-click tracking locally.',
    approvalRequired: true,
  },
  {
    id: 'go-to-market',
    codename: 'Nash',
    specialty: 'Go-to-market',
    status: 'awaiting_approval',
    progress: 100,
    summary: 'Created narrow positioning and three no/low-cost tests for recent US computer-science graduates.',
    latestDeliverable: 'Positioning, acquisition experiments, and draft outreach',
    nextStep: 'Recruit the concierge cohort through approved, manual outreach.',
    approvalRequired: true,
  },
  {
    id: 'critical-review',
    codename: 'Descartes',
    specialty: 'Critical review',
    status: 'complete',
    progress: 100,
    summary: 'Challenged the segment conflict, evidence quality, trust claims, scope, and decision thresholds.',
    latestDeliverable: 'Pre-mortem, scope cuts, and corrected validation gates',
    nextStep: 'Review new evidence after the seven-day test.',
    approvalRequired: false,
  },
];

export const DEFAULT_AGENT_APPROVALS: AgentApproval[] = [
  {
    id: 'customer-interviews',
    agentId: 'customer-research',
    title: 'Contact and interview 12 testers',
    description: 'Allows Customer Research to recruit and interview recent US computer-science graduates for the pain-validation gate.',
    permissionBoundary: 'Manual, consent-based interviews only. No scraping, automated outreach, incentives, or publication.',
    risk: 'medium',
    status: 'pending',
    requestedAt: '2026-07-31T19:00:00.000Z',
  },
  {
    id: 'local-mvp-build',
    agentId: 'product',
    title: 'Build the measurement MVP locally',
    description: 'Allows Product to implement correct retrieval timestamps and anonymous outbound-click measurement in the repository.',
    permissionBoundary: 'Local implementation and testing only. A separate approval is required before production deployment.',
    risk: 'low',
    status: 'pending',
    requestedAt: '2026-07-31T19:05:00.000Z',
  },
  {
    id: 'production-mvp-deploy',
    agentId: 'product',
    title: 'Deploy the measurement MVP',
    description: 'Allows the approved, tested timestamp and click-measurement changes to be deployed to JobMan production.',
    permissionBoundary: 'Only the reviewed MVP diff. No connector expansion, destructive migration, or unrelated feature release.',
    risk: 'high',
    status: 'pending',
    requestedAt: '2026-07-31T19:10:00.000Z',
  },
  {
    id: 'concierge-outreach',
    agentId: 'go-to-market',
    title: 'Run manual concierge outreach',
    description: 'Allows Go-to-Market to send the approved invitation and recruit a small test cohort.',
    permissionBoundary: 'Manual warm outreach only. No paid media, mass messaging, community posts, or contact-list scraping.',
    risk: 'medium',
    status: 'pending',
    requestedAt: '2026-07-31T19:15:00.000Z',
  },
  {
    id: 'community-publishing',
    agentId: 'go-to-market',
    title: 'Publish community test posts',
    description: 'Allows three useful, moderator-compliant posts that test JobMan messaging with relevant communities.',
    permissionBoundary: 'Organic posts only after moderator/rule review. No ad spend and no automated posting.',
    risk: 'high',
    status: 'pending',
    requestedAt: '2026-07-31T19:20:00.000Z',
  },
];
