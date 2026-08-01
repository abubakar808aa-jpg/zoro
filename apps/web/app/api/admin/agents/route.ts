import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { verifyFirebaseToken } from '@/lib/verify-token';
import {
  AGENT_TASK_DEFINITIONS,
  AGENT_WORKSTREAMS,
  DEFAULT_AGENT_APPROVALS,
  type AgentApproval,
  type AgentId,
  type AgentTask,
  type AgentTaskKind,
  type ApprovalStatus,
} from '@/lib/agent-dashboard';
import { localTaskRunnerAvailable, runAllowedAgentTask } from '@/lib/agent-task-runner';

export const runtime = 'nodejs';
export const maxDuration = 300;

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'llama3.2:3b';

const specialistPrompts: Record<AgentId, string> = {
  'customer-research': `You are Heisenberg, JobMan's customer-research specialist. Identify target users, urgent problems, alternatives, evidence gaps, interview questions, and validation thresholds. Clearly separate evidence from inference. Never claim you contacted users or performed research you did not perform.`,
  product: `You are Hilbert, JobMan's product specialist. Turn founder instructions into a small testable product plan with user journey, requirements, acceptance criteria, instrumentation, risks, and explicit scope cuts. Prioritize trustworthy job freshness, deduplication, original application links, and connector reliability.`,
  'go-to-market': `You are Nash, JobMan's go-to-market specialist. Produce positioning, ethical acquisition experiments, draft outreach, funnel metrics, and pass/fail thresholds. Never claim you sent, published, scraped, purchased, or contacted anyone.`,
  'critical-review': `You are Descartes, JobMan's critical-review specialist. Red-team assumptions, identify contradictions, missing evidence, operational and legal risks, failure modes, and the smallest reversible next step. Be candid and specific.`,
};

async function ollamaAvailable() {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(1_500) });
    if (!response.ok) return false;
    const data = await response.json() as { models?: Array<{ name?: string }> };
    return data.models?.some(model => model.name === OLLAMA_MODEL || model.name?.startsWith(`${OLLAMA_MODEL}:`)) ?? false;
  } catch {
    return false;
  }
}

async function runLocalAgent(agentId: AgentId, instruction: string, history: string) {
  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(75_000),
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      messages: [
        {
          role: 'system',
          content: `${specialistPrompts[agentId]}\n\nYou are an advisory agent inside an administrator dashboard. You may analyze and draft, but you cannot execute external actions. Anything involving publishing, contacting people, spending money, deployment, deletion, or production changes requires a separate recorded approval. Keep your response concise and useful.`,
        },
        ...(history ? [{ role: 'user', content: `Recent conversation for context:\n${history}` }] : []),
        { role: 'user', content: instruction },
      ],
      options: { temperature: 0.35, num_predict: 700 },
    }),
  });

  if (!response.ok) throw new Error(`Local AI returned HTTP ${response.status}`);
  const data = await response.json() as { message?: { content?: string } };
  const reply = data.message?.content?.trim();
  if (!reply) throw new Error('Local AI returned an empty response');
  return reply.slice(0, 8_000);
}

async function requireAdmin(req: Request) {
  const uid = await verifyFirebaseToken(req.headers.get('authorization'));
  const adminDb = getAdminDb();
  const caller = await adminDb.doc(`users/${uid}`).get();
  if (caller.data()?.isAdmin !== true) throw new Error('ADMIN_REQUIRED');
  return { uid, adminDb };
}

function asIso(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return undefined;
}

function mergeApproval(defaultApproval: AgentApproval, stored?: Record<string, unknown>): AgentApproval {
  if (!stored) return defaultApproval;
  return {
    ...defaultApproval,
    status: (stored.status as ApprovalStatus) ?? defaultApproval.status,
    note: typeof stored.note === 'string' ? stored.note : undefined,
    decidedBy: typeof stored.decidedBy === 'string' ? stored.decidedBy : undefined,
    decidedAt: asIso(stored.decidedAt),
  };
}

function isAgentTaskKind(value: unknown): value is AgentTaskKind {
  return AGENT_TASK_DEFINITIONS.some(item => item.kind === value);
}

function parseAgentTask(id: string, data: Record<string, unknown>): AgentTask | null {
  if (!isAgentTaskKind(data.kind)) return null;
  const requestedAt = asIso(data.requestedAt);
  if (!requestedAt) return null;
  const definition = AGENT_TASK_DEFINITIONS.find(item => item.kind === data.kind)!;
  const validStatuses = ['awaiting_approval', 'running', 'complete', 'failed'];
  const status = validStatuses.includes(String(data.status))
    ? data.status as AgentTask['status']
    : 'awaiting_approval';
  return {
    id,
    kind: data.kind,
    title: typeof data.title === 'string' ? data.title : definition.title,
    description: typeof data.description === 'string' ? data.description : definition.description,
    status,
    requestedAt,
    requestedBy: typeof data.requestedBy === 'string' ? data.requestedBy : undefined,
    startedAt: asIso(data.startedAt),
    approvedBy: typeof data.approvedBy === 'string' ? data.approvedBy : undefined,
    completedAt: asIso(data.completedAt),
    output: typeof data.output === 'string' ? data.output : undefined,
    error: typeof data.error === 'string' ? data.error : undefined,
  };
}

export async function GET(req: Request) {
  try {
    const { adminDb } = await requireAdmin(req);
    const [stored, instructionSnapshot, taskSnapshot, runtimeAvailable] = await Promise.all([
      adminDb.collection('agentApprovals').get(),
      adminDb.collection('agentInstructions').orderBy('createdAt', 'desc').limit(40).get(),
      adminDb.collection('agentTasks').orderBy('requestedAt', 'desc').limit(20).get(),
      ollamaAvailable(),
    ]);
    const storedById = new Map(stored.docs.map(doc => [doc.id, doc.data()]));
    const approvals = DEFAULT_AGENT_APPROVALS.map(item => mergeApproval(item, storedById.get(item.id)));
    const instructions = instructionSnapshot.docs.flatMap(doc => {
      const data = doc.data();
      const createdAt = asIso(data.createdAt);
      const validAgent = AGENT_WORKSTREAMS.some(agent => agent.id === data.agentId);
      if (!validAgent || typeof data.body !== 'string' || !createdAt) return [];
      const validStatuses = ['queued', 'running', 'complete', 'failed'];
      const status = validStatuses.includes(data.status) ? data.status as 'queued' | 'running' | 'complete' | 'failed' : 'queued';
      return [{
        id: doc.id,
        agentId: data.agentId as AgentId,
        body: data.body,
        status,
        createdAt,
        createdBy: typeof data.createdBy === 'string' ? data.createdBy : undefined,
        reply: typeof data.reply === 'string' ? data.reply : undefined,
        completedAt: asIso(data.completedAt),
        error: typeof data.error === 'string' ? data.error : undefined,
      }];
    });
    const tasks = taskSnapshot.docs.flatMap(doc => {
      const task = parseAgentTask(doc.id, doc.data());
      return task ? [task] : [];
    });

    return NextResponse.json({
      agents: AGENT_WORKSTREAMS,
      approvals,
      instructions,
      tasks,
      taskDefinitions: AGENT_TASK_DEFINITIONS,
      runtime: { provider: 'ollama', model: OLLAMA_MODEL, available: runtimeAvailable },
      runner: { available: localTaskRunnerAvailable(), localOnly: true },
      refreshedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'ADMIN_REQUIRED') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    if (error instanceof Error && error.message.includes('FIREBASE_SERVICE_ACCOUNT_KEY')) {
      return NextResponse.json({ error: 'The local admin API is missing its Firebase service-account configuration.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const { uid, adminDb } = await requireAdmin(req);
    const body = await req.json() as {
      action?: 'instruction' | 'create-task' | 'execute-task';
      agentId?: AgentId;
      body?: string;
      taskKind?: AgentTaskKind;
      taskId?: string;
      approvalId?: string;
      decision?: ApprovalStatus;
      note?: string;
    };

    if (body.action === 'create-task') {
      if (!localTaskRunnerAvailable()) {
        return NextResponse.json({ error: 'Task execution is available only from the local development dashboard.' }, { status: 409 });
      }
      const definition = AGENT_TASK_DEFINITIONS.find(item => item.kind === body.taskKind);
      if (!definition) return NextResponse.json({ error: 'Unknown or unsupported task' }, { status: 400 });

      const taskRef = adminDb.collection('agentTasks').doc();
      const eventRef = adminDb.collection('agentTaskEvents').doc();
      const requestedAt = new Date().toISOString();
      const record = {
        kind: definition.kind,
        title: definition.title,
        description: definition.description,
        permissionBoundary: definition.permissionBoundary,
        status: 'awaiting_approval',
        requestedBy: uid,
        requestedAt: FieldValue.serverTimestamp(),
      };
      const batch = adminDb.batch();
      batch.set(taskRef, record);
      batch.set(eventRef, { taskId: taskRef.id, action: 'requested', actor: uid, at: FieldValue.serverTimestamp() });
      await batch.commit();
      return NextResponse.json({
        task: { ...record, id: taskRef.id, requestedAt, status: 'awaiting_approval' },
      });
    }

    if (body.action === 'execute-task') {
      if (!localTaskRunnerAvailable()) {
        return NextResponse.json({ error: 'Task execution is available only from the local development dashboard.' }, { status: 409 });
      }
      const taskId = typeof body.taskId === 'string' ? body.taskId.trim() : '';
      if (!taskId) return NextResponse.json({ error: 'Choose a task to approve and run' }, { status: 400 });

      const taskRef = adminDb.collection('agentTasks').doc(taskId);
      const eventRef = adminDb.collection('agentTaskEvents').doc();
      const startedAt = new Date().toISOString();
      const task = await adminDb.runTransaction(async transaction => {
        const snapshot = await transaction.get(taskRef);
        if (!snapshot.exists) throw new Error('TASK_NOT_FOUND');
        const parsed = parseAgentTask(snapshot.id, snapshot.data() ?? {});
        if (!parsed) throw new Error('TASK_INVALID');
        if (parsed.status !== 'awaiting_approval') throw new Error('TASK_ALREADY_HANDLED');
        transaction.update(taskRef, {
          status: 'running',
          approvedBy: uid,
          startedAt: FieldValue.serverTimestamp(),
          error: FieldValue.delete(),
        });
        transaction.set(eventRef, {
          taskId,
          kind: parsed.kind,
          action: 'approved-and-started',
          actor: uid,
          at: FieldValue.serverTimestamp(),
        });
        return parsed;
      });

      try {
        const output = await runAllowedAgentTask(task.kind);
        const completedAt = new Date().toISOString();
        const completionEvent = adminDb.collection('agentTaskEvents').doc();
        const batch = adminDb.batch();
        batch.update(taskRef, { status: 'complete', output, completedAt: FieldValue.serverTimestamp() });
        batch.set(completionEvent, { taskId, kind: task.kind, action: 'completed', actor: uid, at: FieldValue.serverTimestamp() });
        await batch.commit();
        return NextResponse.json({
          task: { ...task, status: 'complete', approvedBy: uid, startedAt, completedAt, output },
        });
      } catch (taskError) {
        const message = taskError instanceof Error ? taskError.message : 'Local task failed.';
        const completedAt = new Date().toISOString();
        const failureEvent = adminDb.collection('agentTaskEvents').doc();
        const batch = adminDb.batch();
        batch.update(taskRef, { status: 'failed', error: message.slice(0, 30_000), completedAt: FieldValue.serverTimestamp() });
        batch.set(failureEvent, { taskId, kind: task.kind, action: 'failed', actor: uid, error: message.slice(0, 1_000), at: FieldValue.serverTimestamp() });
        await batch.commit();
        return NextResponse.json({
          task: { ...task, status: 'failed', approvedBy: uid, startedAt, completedAt, error: message },
        });
      }
    }

    if (body.action === 'instruction') {
      const agent = AGENT_WORKSTREAMS.find(item => item.id === body.agentId);
      if (!agent) return NextResponse.json({ error: 'Unknown agent' }, { status: 404 });

      const instructionBody = typeof body.body === 'string' ? body.body.trim().slice(0, 1000) : '';
      if (!instructionBody) {
        return NextResponse.json({ error: 'Write an instruction before sending it' }, { status: 400 });
      }

      const instructionRef = adminDb.collection('agentInstructions').doc();
      const createdAt = new Date().toISOString();
      await instructionRef.set({
        agentId: agent.id,
        body: instructionBody,
        status: 'running',
        createdBy: uid,
        createdAt: FieldValue.serverTimestamp(),
        grantsApproval: false,
      });

      try {
        const recentSnapshot = await adminDb.collection('agentInstructions').orderBy('createdAt', 'desc').limit(24).get();
        const history = recentSnapshot.docs
          .filter(doc => doc.id !== instructionRef.id && doc.data().agentId === agent.id)
          .slice(0, 4)
          .reverse()
          .map(doc => {
            const data = doc.data();
            return `Founder: ${data.body}${typeof data.reply === 'string' ? `\n${agent.codename}: ${data.reply}` : ''}`;
          })
          .join('\n\n');
        const reply = await runLocalAgent(agent.id, instructionBody, history);
        await instructionRef.update({
          status: 'complete',
          reply,
          completedAt: FieldValue.serverTimestamp(),
          runtime: 'ollama',
          model: OLLAMA_MODEL,
        });

        return NextResponse.json({
          instruction: {
            id: instructionRef.id,
            agentId: agent.id,
            body: instructionBody,
            status: 'complete',
            createdBy: uid,
            createdAt,
            reply,
            completedAt: new Date().toISOString(),
          },
        });
      } catch (agentError) {
        const message = agentError instanceof Error ? agentError.message : 'Local agent failed';
        await instructionRef.update({
          status: 'failed',
          error: message.slice(0, 500),
          completedAt: FieldValue.serverTimestamp(),
        });
        return NextResponse.json({
          instruction: {
            id: instructionRef.id,
            agentId: agent.id,
            body: instructionBody,
            status: 'failed',
            createdBy: uid,
            createdAt,
            error: message,
            completedAt: new Date().toISOString(),
          },
        });
      }
    }

    const approval = DEFAULT_AGENT_APPROVALS.find(item => item.id === body.approvalId);

    if (!approval) return NextResponse.json({ error: 'Unknown approval request' }, { status: 404 });
    if (body.decision !== 'approved' && body.decision !== 'declined') {
      return NextResponse.json({ error: 'Decision must be approved or declined' }, { status: 400 });
    }

    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : '';
    const decision = body.decision;
    const batch = adminDb.batch();
    const approvalRef = adminDb.doc(`agentApprovals/${approval.id}`);
    const eventRef = adminDb.collection('agentApprovalEvents').doc();
    const decisionRecord = {
      agentId: approval.agentId,
      title: approval.title,
      status: decision,
      note,
      decidedBy: uid,
      decidedAt: FieldValue.serverTimestamp(),
    };

    batch.set(approvalRef, decisionRecord, { merge: true });
    batch.set(eventRef, { ...decisionRecord, approvalId: approval.id });
    await batch.commit();

    return NextResponse.json({
      approval: {
        ...approval,
        status: decision,
        note: note || undefined,
        decidedBy: uid,
        decidedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'TASK_NOT_FOUND') {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    if (error instanceof Error && (error.message === 'TASK_INVALID' || error.message === 'TASK_ALREADY_HANDLED')) {
      return NextResponse.json({ error: 'This task is invalid or has already been handled.' }, { status: 409 });
    }
    if (error instanceof Error && error.message === 'ADMIN_REQUIRED') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    if (error instanceof Error && error.message.includes('FIREBASE_SERVICE_ACCOUNT_KEY')) {
      return NextResponse.json({ error: 'The local admin API is missing its Firebase service-account configuration.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
