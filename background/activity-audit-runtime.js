import { listOperationJournal } from '../core/operation-journal.js';
import { listContinuityTasks } from '../core/continuity-engine.js';
import { HISTORY_KEY } from '../settings/config.js';

const PORT_NAME = 'ld2-activity-audit';
const LOCAL_AGENT_RUNS_KEY = 'ld68_local_agent_runs_v1';
const BUILD = 91;
const SCHEMA = 'ld-activity-audit/1';

const text = (value, max = 1000) => String(value ?? '').trim().slice(0, max);
const timeMs = value => Date.parse(String(value || '')) || 0;

function safeEvent(input = {}) {
  return Object.freeze({
    id: text(input.id, 180),
    at: text(input.at, 80),
    category: text(input.category, 40),
    kind: text(input.kind, 80),
    status: text(input.status, 80),
    title: text(input.title, 240),
    detail: text(input.detail, 800),
    projectId: text(input.projectId, 180),
    repo: text(input.repo, 300),
    branch: text(input.branch, 240),
    taskId: text(input.taskId, 180),
    operationId: text(input.operationId, 180),
    transactionId: text(input.transactionId, 180),
    commitSha: text(input.commitSha, 128),
    paths: [...new Set((Array.isArray(input.paths) ? input.paths : []).map(path => text(path, 1000)).filter(Boolean))].slice(0, 80),
    fileCount: Math.max(0, Number(input.fileCount || 0) || 0),
    errorCode: text(input.errorCode, 180),
    rawPromptIncluded: false,
    rawModelOutputIncluded: false,
    rawFileContentIncluded: false,
    credentialsIncluded: false
  });
}

function operationEvent(entry = {}) {
  const commitSha = text(entry?.result?.commitSha, 128);
  const reversal = ['undo','redo'].includes(String(entry?.origin || '')) || /^reversible\./.test(String(entry?.tool || ''));
  const category = reversal ? 'recovery' : commitSha ? 'commit' : 'operation';
  const paths = [
    ...(Array.isArray(entry?.changes) ? entry.changes.map(change => change?.path) : []),
    ...(Array.isArray(entry?.input?.paths) ? entry.input.paths : [])
  ];
  return safeEvent({
    id: `op:${text(entry?.id, 160)}`,
    at: entry?.finishedAt || entry?.startedAt,
    category,
    kind: text(entry?.tool, 160) || 'operation',
    status: entry?.status,
    title: reversal ? `${String(entry?.origin || 'recovery').toUpperCase()} · ${text(entry?.tool, 160)}` : commitSha ? `Commit · ${text(entry?.tool, 160)}` : text(entry?.tool, 160),
    detail: `${text(entry?.mode, 40).toUpperCase()} · ${text(entry?.origin, 80)} · ${text(entry?.result?.code, entry?.error?.code || '')}`,
    projectId: entry?.context?.projectId,
    repo: [entry?.context?.owner, entry?.context?.repo].filter(Boolean).join('/'),
    branch: entry?.context?.branch || entry?.result?.branch,
    taskId: entry?.context?.taskId,
    operationId: entry?.id,
    commitSha,
    paths,
    fileCount: entry?.result?.fileCount,
    errorCode: entry?.error?.code
  });
}

function approvalEvent(row = {}) {
  const result = row?.result && typeof row.result === 'object' ? row.result : {};
  return safeEvent({
    id: `approval:${text(row?.id || row?.transactionId, 160)}`,
    at: row?.at,
    category: 'approval',
    kind: text(row?.type, 120) || 'approval',
    status: result?.ok === false ? 'failed' : 'completed',
    title: `Approval · ${text(row?.decision, 'approve')}`,
    detail: `transaction ${text(row?.transactionId, '—')} · raw command omitted`,
    repo: row?.repo,
    transactionId: row?.transactionId,
    commitSha: result?.commitSha,
    branch: result?.branch,
    fileCount: result?.fileCount
  });
}

function continuityEvent(task = {}) {
  const verification = (task?.steps || []).filter(step => step?.status === 'verification_required').length;
  const interrupted = (task?.steps || []).filter(step => step?.status === 'interrupted').length;
  return safeEvent({
    id: `continuity:${text(task?.id, 160)}:${text(task?.status, 80)}:${text(task?.updatedAt, 80)}`,
    at: task?.updatedAt || task?.createdAt,
    category: 'recovery',
    kind: 'continuity-task',
    status: task?.status,
    title: `Continuity · ${text(task?.status, 'unknown')}`,
    detail: `${Number(task?.steps?.length || 0)} step(s) · ${verification} verification_required · ${interrupted} interrupted`,
    projectId: task?.projectId,
    repo: task?.repo,
    branch: task?.branch,
    taskId: task?.id,
    errorCode: task?.lastErrorCode
  });
}

function runtimeEvent(run = {}) {
  return safeEvent({
    id: `runtime:${text(run?.taskId, 160)}:${text(run?.updatedAt, 80)}`,
    at: run?.updatedAt || run?.createdAt,
    category: 'runtime',
    kind: 'local-agent',
    status: run?.status,
    title: `Local Agent · ${text(run?.lastAction, run?.status)}`,
    detail: `iteration ${Number(run?.iteration || 0)}/${Number(run?.maxIterations || 0)} · raw prompt/model output omitted`,
    projectId: run?.projectId,
    repo: run?.repo,
    branch: run?.branch,
    taskId: run?.taskId,
    errorCode: run?.lastErrorCode
  });
}

async function snapshot(payload = {}) {
  const projectId = text(payload?.projectId, 180);
  const limit = Math.max(10, Math.min(300, Number(payload?.limit || 120)));
  const [operations, continuityTasks, storage] = await Promise.all([
    listOperationJournal({ projectId, limit: 300 }).catch(() => []),
    listContinuityTasks({ projectId, limit: 120 }).catch(() => []),
    chrome.storage.local.get([HISTORY_KEY, LOCAL_AGENT_RUNS_KEY])
  ]);
  const approvals = Array.isArray(storage?.[HISTORY_KEY]) ? storage[HISTORY_KEY] : [];
  const runs = Array.isArray(storage?.[LOCAL_AGENT_RUNS_KEY]) ? storage[LOCAL_AGENT_RUNS_KEY] : [];
  const events = [
    ...operations.map(operationEvent),
    ...approvals.filter(row => row?.type === 'approval-auto-repair').map(approvalEvent),
    ...continuityTasks.map(continuityEvent),
    ...runs.filter(run => !projectId || run?.projectId === projectId).map(runtimeEvent)
  ].filter(event => !projectId || !event.projectId || event.projectId === projectId)
    .sort((a, b) => timeMs(b.at) - timeMs(a.at))
    .slice(0, limit);
  const counts = events.reduce((acc, event) => { acc[event.category] = (acc[event.category] || 0) + 1; return acc; }, {});
  return Object.freeze({
    schema: SCHEMA,
    build: BUILD,
    projectId,
    generatedAt: new Date().toISOString(),
    events,
    counts,
    sources: ['operation-journal','approval-history','continuity-engine','local-agent-runs'],
    redaction: {
      rawPrompt: true,
      rawModelOutput: true,
      rawFileContent: true,
      credentials: true
    }
  });
}

async function handle(action, payload = {}) {
  const op = text(action || 'snapshot', 80).toLowerCase();
  if (op === 'status') return { schema: SCHEMA, build: BUILD, chronological: true, rawPromptPersistence: false, rawModelOutputPersistence: false, rawFileContentPersistence: false, credentialsIncluded: false };
  if (op === 'snapshot') return snapshot(payload);
  throw Object.assign(new Error('ACTIVITY_AUDIT_ACTION_INVALID'), { code: 'ACTIVITY_AUDIT_ACTION_INVALID' });
}

export function installActivityAuditRuntime() {
  if (globalThis.__LD91_ACTIVITY_AUDIT_RUNTIME__) return;
  globalThis.__LD91_ACTIVITY_AUDIT_RUNTIME__ = true;
  chrome.runtime.onConnect.addListener(port => {
    if (port.name !== PORT_NAME) return;
    const listener = async message => {
      const id = text(message?.id, 160);
      try { port.postMessage({ id, ok: true, data: await handle(message?.action, message?.payload || {}) }); }
      catch (error) { try { port.postMessage({ id, ok: false, error: error?.message || String(error), code: error?.code || 'ACTIVITY_AUDIT_FAILED' }); } catch (_) {} }
    };
    port.onMessage.addListener(listener);
  });
  globalThis.LovableDecrypterActivityAuditRuntime = Object.freeze({ build: BUILD, schema: SCHEMA, port: PORT_NAME, readOnly: true, redacted: true });
}
