import { auth } from './firebase';
import type { AgentDashboardPayload, AgentId, AgentTaskKind, ApprovalStatus } from './agent-dashboard';

async function adminAgentRequest(path: string, init?: RequestInit) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Sign in with an admin account to continue.');

  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Agent dashboard request failed');
  return data;
}

export async function getAgentDashboard(): Promise<AgentDashboardPayload> {
  return adminAgentRequest('/api/admin/agents');
}

export async function decideAgentApproval(input: {
  approvalId: string;
  decision: Exclude<ApprovalStatus, 'pending'>;
  note?: string;
}): Promise<{ approval: AgentDashboardPayload['approvals'][number] }> {
  return adminAgentRequest('/api/admin/agents', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function sendAgentInstruction(input: {
  agentId: AgentId;
  body: string;
}): Promise<{ instruction: AgentDashboardPayload['instructions'][number] }> {
  return adminAgentRequest('/api/admin/agents', {
    method: 'POST',
    body: JSON.stringify({ action: 'instruction', ...input }),
  });
}

export async function createAgentTask(taskKind: AgentTaskKind): Promise<{ task: AgentDashboardPayload['tasks'][number] }> {
  return adminAgentRequest('/api/admin/agents', {
    method: 'POST',
    body: JSON.stringify({ action: 'create-task', taskKind }),
  });
}

export async function executeAgentTask(taskId: string): Promise<{ task: AgentDashboardPayload['tasks'][number] }> {
  return adminAgentRequest('/api/admin/agents', {
    method: 'POST',
    body: JSON.stringify({ action: 'execute-task', taskId }),
  });
}
