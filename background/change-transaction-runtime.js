import {
  CHANGE_TRANSACTION_SCHEMA,
  createChangeTransaction,
  patchChangeTransaction,
  getChangeTransaction,
  listChangeTransactions
} from '../core/change-transactions.js';
import { listOperationJournal } from '../core/operation-journal.js';
import { getContinuityTask } from '../core/continuity-engine.js';

const PORT_NAME = 'ld2-change-transactions';
const BUILD = 97;
const text = (value, max = 1200) => String(value ?? '').trim().slice(0, max);
const unique = values => [...new Set((Array.isArray(values) ? values : []).map(value => text(value, 1200)).filter(Boolean))];

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value || '')));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function routeLabel(route = {}, mode = 'build') {
  const required = unique(route?.requiredCapabilities || route?.required || []).map(v => v.toUpperCase());
  const primary = text(route?.primaryCapability || route?.primary, 80).toUpperCase();
  const capability = required.join(' + ') || primary || 'UNRESOLVED';
  return `${capability} · ${mode === 'plan' ? 'PLAN' : 'BUILD'}`;
}

function safeDiff(diff = {}) {
  return {
    proposalDigest: text(diff?.digest || diff?.proposalDigest, 128),
    tool: text(diff?.tool, 180),
    destructive: diff?.destructive === true,
    files: (Array.isArray(diff?.files) ? diff.files : []).slice(0, 80).map(file => ({
      path: text(file?.path, 1200),
      action: text(file?.action, 40),
      addedLines: Math.max(0, Number(file?.addedLines || 0) || 0),
      removedLines: Math.max(0, Number(file?.removedLines || 0) || 0),
      destructive: file?.destructive === true || String(file?.action || '').toLowerCase() === 'delete',
      beforeBlobSha: text(file?.beforeBlobSha, 128)
    })).filter(file => file.path)
  };
}

function safeOperation(entry = {}) {
  return Object.freeze({
    id: text(entry?.id, 180),
    tool: text(entry?.tool, 180),
    mode: entry?.mode === 'write' ? 'write' : 'read',
    origin: text(entry?.origin, 80),
    status: text(entry?.status, 80),
    startedAt: text(entry?.startedAt, 80),
    finishedAt: text(entry?.finishedAt, 80),
    paths: unique([
      ...(Array.isArray(entry?.changes) ? entry.changes.map(change => change?.path) : []),
      ...(Array.isArray(entry?.input?.paths) ? entry.input.paths : [])
    ]).slice(0, 80),
    commitSha: text(entry?.result?.commitSha, 128),
    branch: text(entry?.result?.branch || entry?.context?.branch, 240),
    errorCode: text(entry?.error?.code, 180),
    rawContentIncluded: false
  });
}

function continuityProjection(task = {}) {
  if (!task?.id) return null;
  const steps = (Array.isArray(task.steps) ? task.steps : []).slice(0, 120).map(step => Object.freeze({
    id: text(step?.id, 240),
    kind: text(step?.kind, 80),
    label: text(step?.label, 240),
    mode: step?.mode === 'write' ? 'write' : 'read',
    status: text(step?.status, 80),
    retrySafe: step?.retrySafe === true,
    verificationRequired: step?.status === 'verification_required',
    operationId: text(step?.resultRef?.operationId || step?.operationId, 180),
    commitSha: text(step?.resultRef?.commitSha || step?.commitSha, 128)
  }));
  return Object.freeze({
    taskId: text(task.id, 180),
    status: text(task.status, 80),
    createdAt: text(task.createdAt, 80),
    updatedAt: text(task.updatedAt, 80),
    steps: Object.freeze(steps),
    verificationRequired: steps.some(step => step.verificationRequired),
    ambiguousWriteRetryAllowed: false
  });
}

function deriveStatus(tx, operations, continuity) {
  if (tx?.recovery?.status === 'applied') return 'reverted';
  if (tx?.database?.verificationRequired) return 'verification_required';
  if (tx?.database?.status === 'applied') return 'completed';
  if (tx?.database?.status === 'approved') return 'approved';
  if (tx?.database?.ticketId && tx?.status === 'waiting_database_approval') return 'waiting_approval';
  if (continuity?.verificationRequired) return 'verification_required';
  if (operations.some(op => op.status === 'failed')) return 'failed';
  if (operations.some(op => op.mode === 'write' && op.status === 'ok' && op.commitSha)) return continuity?.status === 'completed' ? 'completed' : (tx?.status || 'applied');
  return text(tx?.status || continuity?.status || 'created', 80);
}

function deterministicExplanation(tx, view) {
  const caps = tx?.capabilityRoute?.required?.join(' + ') || tx?.capabilityRoute?.primary || 'UNRESOLVED';
  const parts = [`${caps} ${String(tx?.mode || 'build').toUpperCase()}`];
  if (tx?.plan?.summary) parts.push(text(tx.plan.summary, 400));
  if (tx?.review?.files?.length) parts.push(`${tx.review.files.length} arquivo(s) na revisão`);
  if (tx?.database?.ticketId) parts.push(`database ${tx.database.risk || 'risk unknown'} · ${tx.database.status || 'prepared'}`);
  if (view?.commit?.sha) parts.push(`commit ${view.commit.sha.slice(0, 10)}`);
  if (view?.continuity?.verificationRequired) parts.push('write ambíguo exige verificação');
  if (tx?.recovery?.status) parts.push(`recovery ${tx.recovery.status}`);
  return parts.join(' · ').slice(0, 1600);
}

async function reviewTransaction(txId) {
  const tx = await getChangeTransaction(txId);
  if (!tx) throw Object.assign(new Error('CHANGE_TRANSACTION_NOT_FOUND'), { code: 'CHANGE_TRANSACTION_NOT_FOUND' });
  const taskId = text(tx?.links?.taskId, 180);
  const [journal, task] = await Promise.all([
    taskId ? listOperationJournal({ taskId, limit: 200 }).catch(() => []) : Promise.resolve([]),
    taskId ? getContinuityTask(taskId).catch(() => null) : Promise.resolve(null)
  ]);
  const operations = journal.map(safeOperation);
  const continuity = continuityProjection(task);
  const commitOperation = operations.find(op => op.mode === 'write' && op.status === 'ok' && op.commitSha) || null;
  const tests = operations.filter(op => /diagnostics|test|lint|typecheck|lsp/i.test(op.tool)).map(op => Object.freeze({
    operationId: op.id,
    tool: op.tool,
    status: op.status,
    errorCode: op.errorCode,
    finishedAt: op.finishedAt
  }));
  const approvals = continuity?.steps?.filter(step => step.kind === 'approval').map(step => Object.freeze({
    id: step.id,
    status: step.status,
    verificationRequired: step.verificationRequired
  })) || [];
  const reversibleOperationId = commitOperation?.id || text(tx?.recovery?.sourceOperationId, 180);
  const status = deriveStatus(tx, operations, continuity);
  const view = Object.freeze({
    schema: 'ld-change-transaction-review/1',
    transaction: tx,
    status,
    operations: Object.freeze(operations),
    continuity,
    approvals: Object.freeze(approvals),
    tests: Object.freeze(tests),
    commit: commitOperation ? Object.freeze({ operationId: commitOperation.id, sha: commitOperation.commitSha, branch: commitOperation.branch, paths: commitOperation.paths }) : null,
    recovery: tx.recovery,
    reversibleOperationId,
    explain: '',
    authority: Object.freeze({ operationJournal: 'evidence', continuity: 'recovery', reversibleOperations: 'revert', changeTransaction: 'projection-only' })
  });
  return Object.freeze({ ...view, explain: deterministicExplanation(tx, view) });
}

async function handle(action, payload = {}) {
  const op = text(action || 'status', 80).toLowerCase();
  if (op === 'status') return {
    schema: CHANGE_TRANSACTION_SCHEMA,
    build: BUILD,
    durableProjection: true,
    writer: false,
    approvalAuthority: false,
    rawPromptPersistence: false,
    rawSqlPersistence: false,
    rawDiffPersistence: false,
    operationJournalAuthoritative: true,
    continuityAuthoritativeForRecovery: true,
    reversibleOperationsAuthoritativeForRevert: true
  };
  if (op === 'create') {
    const command = text(payload?.command, 60000);
    if (!command) throw Object.assign(new Error('CHANGE_TRANSACTION_COMMAND_REQUIRED'), { code: 'CHANGE_TRANSACTION_COMMAND_REQUIRED' });
    const mode = payload?.mode === 'plan' ? 'plan' : 'build';
    const route = payload?.capabilityRoute || {};
    return { transaction: await createChangeTransaction({
      projectId: text(payload?.projectId, 180),
      mode,
      status: text(payload?.status || 'created', 80),
      commandDigest: await sha256(command),
      intent: { label: routeLabel(route, mode) },
      capabilityRoute: route,
      plan: payload?.plan || {},
      links: { taskId: text(payload?.taskId, 180) },
      database: payload?.database || {}
    }) };
  }
  if (op === 'code_review') {
    const tx = await patchChangeTransaction(payload?.transactionId, {
      status: 'waiting_approval',
      review: safeDiff(payload?.diff || {})
    });
    return { transaction: tx };
  }
  if (op === 'code_result') {
    const tx = await patchChangeTransaction(payload?.transactionId, {
      status: text(payload?.status || 'running', 80),
      links: { taskId: text(payload?.taskId, 180), approvalTransactionIds: unique(payload?.approvalTransactionIds || []) }
    });
    return { transaction: tx, review: await reviewTransaction(tx.id) };
  }
  if (op === 'database_result') {
    const database = payload?.database || {};
    const tx = await patchChangeTransaction(payload?.transactionId, {
      status: text(payload?.status || database?.status || 'running', 80),
      database: {
        ...database,
        verificationRequired: payload?.verificationRequired === true || database?.verificationRequired === true
      }
    });
    return { transaction: tx, review: await reviewTransaction(tx.id) };
  }
  if (op === 'error') {
    const tx = await patchChangeTransaction(payload?.transactionId, {
      status: payload?.verificationRequired === true ? 'verification_required' : 'failed',
      lastError: { code: text(payload?.code, 180), message: text(payload?.message, 900) },
      database: payload?.verificationRequired === true ? { verificationRequired: true } : {}
    });
    return { transaction: tx };
  }
  if (op === 'recovery_result') {
    const tx = await patchChangeTransaction(payload?.transactionId, {
      status: text(payload?.status || 'reverted', 80),
      recovery: {
        status: text(payload?.status === 'completed' ? 'applied' : payload?.status, 80),
        sourceOperationId: text(payload?.sourceOperationId, 180),
        reversalOperationId: text(payload?.operationId, 180),
        commitSha: text(payload?.commitSha, 128),
        direction: text(payload?.direction || 'undo', 40),
        strategy: text(payload?.strategy || 'preserve', 80),
        previewId: text(payload?.previewId, 180)
      }
    });
    return { transaction: tx, review: await reviewTransaction(tx.id) };
  }
  if (op === 'get') {
    const tx = await getChangeTransaction(payload?.transactionId);
    if (!tx) throw Object.assign(new Error('CHANGE_TRANSACTION_NOT_FOUND'), { code: 'CHANGE_TRANSACTION_NOT_FOUND' });
    return { transaction: tx };
  }
  if (op === 'review') return { review: await reviewTransaction(payload?.transactionId) };
  if (op === 'list') return { transactions: await listChangeTransactions({ projectId: text(payload?.projectId, 180), limit: payload?.limit }) };
  throw Object.assign(new Error('CHANGE_TRANSACTION_ACTION_INVALID'), { code: 'CHANGE_TRANSACTION_ACTION_INVALID' });
}

export function installChangeTransactionRuntime() {
  if (globalThis.__LD97_CHANGE_TRANSACTION_RUNTIME__) return;
  globalThis.__LD97_CHANGE_TRANSACTION_RUNTIME__ = true;
  chrome.runtime.onConnect.addListener(port => {
    if (port.name !== PORT_NAME) return;
    const listener = async message => {
      const id = text(message?.id, 180);
      try { port.postMessage({ id, ok: true, data: await handle(message?.action, message?.payload || {}) }); }
      catch (error) {
        try { port.postMessage({ id, ok: false, error: error?.message || String(error), code: error?.code || 'CHANGE_TRANSACTION_FAILED' }); } catch (_) {}
      }
    };
    port.onMessage.addListener(listener);
  });
  globalThis.LovableDecrypterChangeTransactionRuntime = Object.freeze({
    build: BUILD,
    schema: CHANGE_TRANSACTION_SCHEMA,
    port: PORT_NAME,
    projectionOnly: true,
    writeAuthority: false,
    approvalAuthority: false
  });
}
