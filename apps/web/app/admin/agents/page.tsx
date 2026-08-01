'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  createAgentTask,
  decideAgentApproval,
  executeAgentTask,
  getAgentDashboard,
  sendAgentInstruction,
} from '@/lib/agent-admin';
import type {
  AgentApproval,
  AgentDashboardPayload,
  AgentId,
  AgentInstruction,
  AgentTask,
  AgentTaskDefinition,
  AgentTaskKind,
  AgentWorkstream,
  AgentWorkStatus,
  ApprovalRisk,
} from '@/lib/agent-dashboard';

const statusStyle: Record<AgentWorkStatus, string> = {
  complete: 'bg-emerald-100 text-emerald-800',
  awaiting_approval: 'bg-amber-100 text-amber-800',
  blocked: 'bg-rose-100 text-rose-700',
  in_progress: 'bg-primary-100 text-primary-700',
};

const riskStyle: Record<ApprovalRisk, string> = {
  low: 'bg-emerald-100 text-emerald-800',
  medium: 'bg-amber-100 text-amber-800',
  high: 'bg-rose-100 text-rose-700',
};

const taskStatusStyle: Record<AgentTask['status'], string> = {
  awaiting_approval: 'bg-amber-100 text-amber-800',
  running: 'bg-primary-100 text-primary-700',
  complete: 'bg-emerald-100 text-emerald-800',
  failed: 'bg-rose-100 text-rose-700',
};

const agentMark: Record<string, string> = {
  'customer-research': 'CR',
  product: 'PX',
  'go-to-market': 'GT',
  'critical-review': 'QA',
};

function readableStatus(status: AgentWorkStatus) {
  return status.replace('_', ' ');
}

function ApprovalCard({
  approval,
  agentName,
  note,
  busy,
  onNote,
  onDecision,
}: {
  approval: AgentApproval;
  agentName: string;
  note: string;
  busy: boolean;
  onNote: (value: string) => void;
  onDecision: (decision: 'approved' | 'declined') => void;
}) {
  const decided = approval.status !== 'pending';

  return (
    <article className="rounded-3xl border-2 border-ink/10 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="badge bg-primary-100 text-primary-700">{agentName}</span>
            <span className={`badge ${riskStyle[approval.risk]}`}>{approval.risk} risk</span>
            {decided && (
              <span className={`badge ${approval.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                {approval.status}
              </span>
            )}
          </div>
          <h3 className="text-lg font-bold text-ink">{approval.title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{approval.description}</p>
        </div>
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-ink text-sm font-bold text-white">
          {agentMark[approval.agentId]}
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-slate-50 p-4">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Permission boundary</p>
        <p className="mt-1 text-sm leading-5 text-slate-600">{approval.permissionBoundary}</p>
      </div>

      {decided ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="font-semibold text-slate-700">
            Decision recorded {approval.decidedAt ? new Date(approval.decidedAt).toLocaleString() : ''}
          </p>
          {approval.note && <p className="text-slate-500">“{approval.note}”</p>}
        </div>
      ) : (
        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
          <label className="block text-sm font-semibold text-slate-700">
            Decision note <span className="font-normal text-slate-400">(optional)</span>
            <textarea
              value={note}
              onChange={event => onNote(event.target.value)}
              maxLength={500}
              rows={2}
              className="input mt-2 resize-none text-sm"
              placeholder="Add a condition, limit, or reason…"
            />
          </label>
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => onDecision('declined')} className="btn-secondary text-sm">
              Decline
            </button>
            <button type="button" disabled={busy} onClick={() => onDecision('approved')} className="btn-primary text-sm">
              {busy ? 'Saving…' : 'Approve'}
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

function AgentDesk({
  agent,
  instructions,
  draft,
  busy,
  runtimeAvailable,
  runtimeModel,
  onDraft,
  onSend,
}: {
  agent: AgentWorkstream;
  instructions: AgentInstruction[];
  draft: string;
  busy: boolean;
  runtimeAvailable: boolean;
  runtimeModel: string;
  onDraft: (value: string) => void;
  onSend: () => void;
}) {
  return (
    <article className="overflow-hidden rounded-3xl border-2 border-ink/10 bg-white shadow-sm">
      <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(20rem,0.85fr)]">
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-600 to-accent-500 font-bold text-white shadow-pop-sm">
                {agentMark[agent.id]}
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-lg font-bold text-ink">{agent.specialty}</h3>
                <p className="text-sm text-slate-400">{agent.codename}</p>
              </div>
            </div>
            <span className={`badge whitespace-nowrap ${statusStyle[agent.status]}`}>{readableStatus(agent.status)}</span>
          </div>

          <p className="mt-4 text-sm leading-6 text-slate-600">{agent.summary}</p>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100" aria-label={`${agent.progress}% complete`}>
            <div className="h-full rounded-full bg-gradient-to-r from-primary-600 to-accent-500" style={{ width: `${agent.progress}%` }} />
          </div>

          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="font-bold text-slate-400">Latest deliverable</dt>
              <dd className="mt-1 text-slate-700">{agent.latestDeliverable}</dd>
            </div>
            <div>
              <dt className="font-bold text-slate-400">Next move</dt>
              <dd className="mt-1 text-slate-700">{agent.nextStep}</dd>
            </div>
          </dl>
        </div>

        <div className="border-t-2 border-ink/10 bg-slate-50 p-5 md:border-l-2 md:border-t-0 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary-600">Live specialist chat</p>
              <h4 className="mt-1 font-bold text-ink">Ask {agent.codename}</h4>
            </div>
            <span className={`badge ${runtimeAvailable ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700'}`}>
              {runtimeAvailable ? '● local AI live' : '● local AI offline'}
            </span>
          </div>

          <div className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1" aria-live="polite">
            <div className="mr-8 rounded-2xl rounded-tl-md bg-white px-4 py-3 text-sm leading-5 text-slate-600 shadow-sm">
              <p className="text-xs font-bold text-slate-400">{agent.codename}</p>
              <p className="mt-1">I’m running locally on your Mac. Give me a focused outcome, constraints, and the evidence you want back.</p>
            </div>
            {instructions.slice(0, 5).reverse().map(instruction => (
              <div key={instruction.id} className="space-y-3">
                <div className="ml-8 rounded-2xl rounded-tr-md bg-ink px-4 py-3 text-sm leading-5 text-white shadow-sm">
                  <div className="flex items-center justify-between gap-2 text-[11px] font-bold text-white/60">
                    <span>You</span>
                    <time dateTime={instruction.createdAt}>{new Date(instruction.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap break-words">{instruction.body}</p>
                </div>
                {instruction.reply && (
                  <div className="mr-8 rounded-2xl rounded-tl-md border border-primary-100 bg-white px-4 py-3 text-sm leading-6 text-slate-700 shadow-sm">
                    <p className="text-xs font-bold text-primary-600">{agent.codename} · local AI</p>
                    <p className="mt-1 whitespace-pre-wrap break-words">{instruction.reply}</p>
                  </div>
                )}
                {instruction.status === 'failed' && (
                  <div className="mr-8 rounded-2xl bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
                    {instruction.error ?? 'The local agent could not answer. Check that Ollama is running.'}
                  </div>
                )}
                {(instruction.status === 'queued' || instruction.status === 'running') && !instruction.reply && (
                  <div className="mr-8 rounded-2xl bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-700">
                    {instruction.status === 'running' ? `${agent.codename} is thinking locally…` : 'Saved before the local AI connection was enabled.'}
                  </div>
                )}
              </div>
            ))}
          </div>

          <label className="mt-4 block text-sm font-bold text-slate-700">
            New instruction
            <textarea
              value={draft}
              onChange={event => onDraft(event.target.value)}
              maxLength={1000}
              rows={3}
              className="input mt-2 resize-none bg-white text-sm"
              placeholder={`Tell ${agent.codename} what to investigate, produce, or challenge…`}
            />
          </label>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-xs text-xs leading-5 text-slate-400">{runtimeModel} runs on this Mac. Advice never grants approval or performs external actions.</p>
            <button type="button" onClick={onSend} disabled={busy || !draft.trim() || !runtimeAvailable} className="btn-primary text-sm">
              {busy ? `${agent.codename} is thinking…` : runtimeAvailable ? 'Ask agent ↗' : 'Agent offline'}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function TaskRunner({
  definitions,
  tasks,
  available,
  busyKind,
  busyTaskId,
  onRequest,
  onExecute,
}: {
  definitions: AgentTaskDefinition[];
  tasks: AgentTask[];
  available: boolean;
  busyKind: AgentTaskKind | '';
  busyTaskId: string;
  onRequest: (kind: AgentTaskKind) => void;
  onExecute: (taskId: string) => void;
}) {
  return (
    <section aria-labelledby="task-runner-title" className="rounded-[2rem] border-2 border-ink/10 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent-600">Phase 1 · local execution</p>
          <h2 id="task-runner-title" className="mt-1 text-2xl font-bold text-ink">Safe task runner</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Pick a predefined check, create an approval request, then approve it separately. Custom terminal commands are never accepted.
          </p>
        </div>
        <span className={`badge ${available ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
          {available ? '● ready on this Mac' : '● local runner unavailable'}
        </span>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {definitions.map(definition => {
          const latest = tasks.find(task => task.kind === definition.kind);
          const awaitingApproval = latest?.status === 'awaiting_approval';
          const running = latest?.status === 'running' || busyTaskId === latest?.id;
          return (
            <article key={definition.kind} className="rounded-3xl border-2 border-slate-100 bg-slate-50 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-ink">{definition.title}</h3>
                  <p className="mt-1 text-sm leading-5 text-slate-500">{definition.description}</p>
                </div>
                {latest && <span className={`badge whitespace-nowrap ${taskStatusStyle[latest.status]}`}>{latest.status.replace('_', ' ')}</span>}
              </div>
              <div className="mt-4 rounded-2xl bg-white p-3 text-xs leading-5 text-slate-500">
                <span className="font-bold text-slate-700">Safety boundary:</span> {definition.permissionBoundary}
              </div>
              <div className="mt-4 flex justify-end">
                {awaitingApproval ? (
                  <button type="button" className="btn-primary text-sm" disabled={!available || running} onClick={() => onExecute(latest.id)}>
                    {running ? 'Running locally…' : 'Approve & run locally'}
                  </button>
                ) : (
                  <button type="button" className="btn-secondary text-sm" disabled={!available || busyKind === definition.kind || running} onClick={() => onRequest(definition.kind)}>
                    {busyKind === definition.kind ? 'Requesting…' : running ? 'Running locally…' : 'Request approval'}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-6 border-t-2 border-slate-100 pt-5">
        <h3 className="font-bold text-ink">Recent task log</h3>
        <div className="mt-3 space-y-3" aria-live="polite">
          {tasks.slice(0, 8).map(task => (
            <details key={task.id} className="rounded-2xl border border-slate-200 bg-white p-4" open={task.status === 'running'}>
              <summary className="cursor-pointer list-none">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-ink">{task.title}</p>
                    <p className="mt-1 text-xs text-slate-400">Requested {new Date(task.requestedAt).toLocaleString()}</p>
                  </div>
                  <span className={`badge ${taskStatusStyle[task.status]}`}>{task.status.replace('_', ' ')}</span>
                </div>
              </summary>
              <div className="mt-4 rounded-2xl bg-slate-950 p-4 text-xs leading-5 text-slate-200">
                <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words font-mono">
                  {task.output ?? task.error ?? (task.status === 'awaiting_approval' ? 'Waiting for an administrator to approve this exact task.' : 'Task is running on this Mac…')}
                </pre>
              </div>
            </details>
          ))}
          {tasks.length === 0 && (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
              No tasks yet. Request one above; nothing runs until you approve it.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default function AgentDashboardPage() {
  const [dashboard, setDashboard] = useState<AgentDashboardPayload | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<'all' | 'pending' | 'decided'>('all');
  const [busyId, setBusyId] = useState('');
  const [busyAgentId, setBusyAgentId] = useState<AgentId | ''>('');
  const [drafts, setDrafts] = useState<Partial<Record<AgentId, string>>>({});
  const [instructionNotice, setInstructionNotice] = useState('');
  const [busyTaskKind, setBusyTaskKind] = useState<AgentTaskKind | ''>('');
  const [busyTaskId, setBusyTaskId] = useState('');
  const [error, setError] = useState('');

  function loadDashboard() {
    setError('');
    setDashboard(null);
    getAgentDashboard()
      .then(setDashboard)
      .catch(err => setError(err.message));
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const pendingCount = dashboard?.approvals.filter(item => item.status === 'pending').length ?? 0;
  const approvedCount = dashboard?.approvals.filter(item => item.status === 'approved').length ?? 0;

  const filteredApprovals = useMemo(() => {
    if (!dashboard) return [];
    if (filter === 'pending') return dashboard.approvals.filter(item => item.status === 'pending');
    if (filter === 'decided') return dashboard.approvals.filter(item => item.status !== 'pending');
    return dashboard.approvals;
  }, [dashboard, filter]);

  async function handleDecision(approvalId: string, decision: 'approved' | 'declined') {
    setBusyId(approvalId);
    setError('');
    try {
      const { approval } = await decideAgentApproval({ approvalId, decision, note: notes[approvalId] });
      setDashboard(current => current ? {
        ...current,
        approvals: current.approvals.map(item => item.id === approval.id ? approval : item),
      } : current);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyId('');
    }
  }

  async function handleInstruction(agentId: AgentId) {
    const body = drafts[agentId]?.trim();
    if (!body) return;

    setBusyAgentId(agentId);
    setError('');
    setInstructionNotice('');
    try {
      const { instruction } = await sendAgentInstruction({ agentId, body });
      setDashboard(current => current ? {
        ...current,
        instructions: [instruction, ...current.instructions],
      } : current);
      setDrafts(current => ({ ...current, [agentId]: '' }));
      const agentName = dashboard?.agents.find(agent => agent.id === agentId)?.codename ?? agentId;
      if (instruction.status === 'complete') {
        setInstructionNotice(`${agentName} replied using the local AI on your Mac.`);
      } else {
        setError(`${agentName} could not reply: ${instruction.error ?? 'Local AI failed.'}`);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyAgentId('');
    }
  }

  async function handleTaskRequest(kind: AgentTaskKind) {
    setBusyTaskKind(kind);
    setError('');
    try {
      const { task } = await createAgentTask(kind);
      setDashboard(current => current ? { ...current, tasks: [task, ...current.tasks] } : current);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyTaskKind('');
    }
  }

  async function handleTaskExecute(taskId: string) {
    setBusyTaskId(taskId);
    setError('');
    setDashboard(current => current ? {
      ...current,
      tasks: current.tasks.map(task => task.id === taskId ? { ...task, status: 'running' } : task),
    } : current);
    try {
      const { task } = await executeAgentTask(taskId);
      setDashboard(current => current ? {
        ...current,
        tasks: current.tasks.map(item => item.id === task.id ? task : item),
      } : current);
      if (task.status === 'failed') setError(`${task.title} failed. Open its task log for details.`);
    } catch (err: any) {
      setError(err.message);
      loadDashboard();
    } finally {
      setBusyTaskId('');
    }
  }

  if (!dashboard) {
    if (!error) return (
      <div className="rounded-3xl border-2 border-ink bg-white p-8 shadow-pop" role="status">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary-600">Loading agent data</p>
        <h2 className="mt-2 text-2xl font-bold text-ink">Waking the specialist roster…</h2>
        <p className="mt-2 text-sm text-slate-500">Fetching work summaries and protected approval requests.</p>
      </div>
    );

    return (
      <div className="rounded-3xl border-2 border-rose-300 bg-rose-50 p-8 shadow-pop" role="alert">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-rose-600">Dashboard unavailable</p>
        <h2 className="mt-2 text-2xl font-bold text-ink">Agent data could not be loaded.</h2>
        <p className="mt-3 text-sm leading-6 text-slate-700">{error}</p>
        <button type="button" onClick={loadDashboard} className="btn-secondary mt-5 text-sm">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[2rem] bg-ink px-6 py-7 text-white shadow-pop sm:px-8">
        <div className="absolute -right-12 -top-16 h-48 w-48 rounded-full bg-primary-500/30 blur-3xl" />
        <div className="absolute -bottom-20 left-1/3 h-40 w-40 rounded-full bg-acid-300/20 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-acid-300">Agent command center</p>
            <h2 className="mt-2 text-3xl font-bold">Four brains. One founder-sized cockpit.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">
              Review each specialist’s latest work, see what is blocked, and grant only the permission the next step needs.
            </p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm backdrop-blur">
            <span className="font-bold text-acid-300">{dashboard.runtime.available ? 'Local AI is live:' : 'Local AI is offline:'}</span>{' '}
            {dashboard.runtime.available ? `${dashboard.runtime.model} is running privately on this Mac.` : 'Start Ollama to wake the specialists.'}
            <br /><span className="text-white/70">Safety lock: advice cannot bypass approvals.</span>
          </div>
        </div>
      </section>

      {error && <div role="alert" className="rounded-2xl border-2 border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div>}
      {instructionNotice && <div role="status" className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{instructionNotice}</div>}

      <section aria-labelledby="agent-roster-title">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary-600">Live roster</p>
            <h2 id="agent-roster-title" className="mt-1 text-2xl font-bold text-ink">Specialist workstreams</h2>
          </div>
          <p className="text-xs text-slate-400">Session snapshot · refreshes when this page loads</p>
        </div>

        <div className="space-y-4">
          {dashboard.agents.map(agent => (
            <AgentDesk
              key={agent.id}
              agent={agent}
              instructions={dashboard.instructions.filter(instruction => instruction.agentId === agent.id)}
              draft={drafts[agent.id] ?? ''}
              busy={busyAgentId === agent.id}
              runtimeAvailable={dashboard.runtime.available}
              runtimeModel={dashboard.runtime.model}
              onDraft={value => setDrafts(current => ({ ...current, [agent.id]: value }))}
              onSend={() => handleInstruction(agent.id)}
            />
          ))}
          {dashboard.agents.length === 0 && (
            <div className="rounded-3xl border-2 border-dashed border-slate-200 p-8 text-center text-slate-500">
              No agent workstreams have been added yet.
            </div>
          )}
        </div>
      </section>

      <TaskRunner
        definitions={dashboard.taskDefinitions}
        tasks={dashboard.tasks}
        available={dashboard.runner.available}
        busyKind={busyTaskKind}
        busyTaskId={busyTaskId}
        onRequest={handleTaskRequest}
        onExecute={handleTaskExecute}
      />

      <section aria-labelledby="approval-inbox-title">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent-600">Founder queue</p>
            <h2 id="approval-inbox-title" className="mt-1 text-2xl font-bold text-ink">Essential approvals</h2>
            <p className="mt-1 text-sm text-slate-500">{pendingCount} pending · {approvedCount} approved</p>
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Filter approvals">
            {(['all', 'pending', 'decided'] as const).map(option => (
              <button
                key={option}
                type="button"
                onClick={() => setFilter(option)}
                aria-pressed={filter === option}
                className={`rounded-full border-2 border-ink px-4 py-2 text-sm font-bold transition ${filter === option ? 'bg-ink text-white' : 'bg-white text-ink hover:bg-acid-200'}`}
              >
                {option[0].toUpperCase() + option.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {filteredApprovals.map(approval => (
            <ApprovalCard
              key={approval.id}
              approval={approval}
              agentName={dashboard.agents.find(agent => agent.id === approval.agentId)?.specialty ?? approval.agentId}
              note={notes[approval.id] ?? ''}
              busy={busyId === approval.id}
              onNote={value => setNotes(current => ({ ...current, [approval.id]: value }))}
              onDecision={decision => handleDecision(approval.id, decision)}
            />
          ))}
          {filteredApprovals.length === 0 && (
            <div className="rounded-3xl border-2 border-dashed border-slate-200 py-12 text-center text-slate-400">Nothing in this lane. Inbox zero-ish.</div>
          )}
        </div>
      </section>
    </div>
  );
}
