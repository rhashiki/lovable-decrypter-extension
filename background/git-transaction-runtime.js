import { getSettings } from '../storage/settings-store.js';
import { GitAdapter } from '../github/git-adapter.js';
import { isSensitivePath, isTextPath } from '../core/utils.js';
import { loadRecentUserEdits } from '../core/context-engine-v2.js';
import { buildReversalPlan, reversibleFingerprint } from '../core/reversible-operations.js';
import { getChangeTransaction, listChangeTransactions, patchChangeTransaction } from '../core/change-transactions.js';
import { beginOperation, finishOperation, listOperationJournal } from '../core/operation-journal.js';
import { listCheckpoints } from '../core/checkpoint-manager.js';
import {
  GIT_TRANSACTION_SCHEMA,
  committedTransactionOperations,
  proveTransactionCommitSpan,
  safeCompareProjection,
  gitTransactionFingerprint
} from '../core/git-transaction.js';

const PORT_NAME = 'ld2-git-transactions';
const BUILD = 99;
const TICKET_PREFIX = 'ld99_git_tx_revert_ticket_v1_';
const TICKET_TTL_MS = 10 * 60 * 1000;
const MAX_TRANSACTION_FILES = 80;
const text = (value, max = 1200) => String(value ?? '').trim().slice(0, max);
const unique = values => [...new Set((Array.isArray(values) ? values : []).map(value => text(value, 1200)).filter(Boolean))];
const ticketKey = id => `${TICKET_PREFIX}${text(id, 180).replace(/[^a-z0-9-]/gi, '')}`;

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value || '')));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function activeGithub(settings, projectId = '') {
  const mapping = projectId && settings?.projectMappings?.[projectId] ? settings.projectMappings[projectId] : {};
  return { ...(settings?.github || {}), ...(mapping || {}) };
}

async function headSha(adapter, branch) {
  const ref = await adapter.getRef(branch || adapter.branch || 'main');
  const sha = text(ref?.object?.sha || ref?.sha, 128).toLowerCase();
  if (!sha) throw Object.assign(new Error('GIT_TRANSACTION_HEAD_UNAVAILABLE'), { code: 'GIT_TRANSACTION_HEAD_UNAVAILABLE' });
  return sha;
}

async function treeMap(adapter, ref) {
  const tree = await adapter.getTree(ref, true);
  if (tree?.truncated) throw Object.assign(new Error(`GIT_TRANSACTION_TREE_TRUNCATED:${ref}`), { code: 'GIT_TRANSACTION_TREE_TRUNCATED' });
  const map = new Map();
  for (const entry of Array.isArray(tree?.tree) ? tree.tree : []) {
    if (entry?.type === 'blob' && entry?.path) {
      map.set(String(entry.path), { path: String(entry.path), sha: text(entry.sha, 128), size: Number(entry.size || 0) || 0 });
    }
  }
  return { map, treeSha: text(tree?.sha, 128) };
}

async function fileState(adapter, map, path) {
  const entry = map.get(path);
  if (!entry) return { exists: false, content: '', blobSha: '', size: 0 };
  if (!isTextPath(path)) return { exists: true, content: '', blobSha: entry.sha, size: entry.size, binary: true };
  const content = await adapter.getBlob(entry.sha);
  return { exists: true, content: String(content ?? ''), blobSha: entry.sha, size: entry.size, binary: false };
}

function journalPaths(entry = {}) {
  return unique([
    ...(Array.isArray(entry?.changes) ? entry.changes.map(change => change?.path) : []),
    ...(Array.isArray(entry?.input?.paths) ? entry.input.paths : [])
  ]);
}

function laterHumanEdits(rows, sinceIso, targetPaths) {
  const since = Date.parse(sinceIso || '') || 0;
  const target = new Set(targetPaths);
  return (Array.isArray(rows) ? rows : []).filter(event => {
    if (event?.origin !== 'user') return false;
    const at = Date.parse(event?.observedAt || '') || 0;
    if (at <= since) return false;
    return (Array.isArray(event?.paths) ? event.paths : []).some(path => target.has(path));
  });
}

async function dependentOperations(transactionOperations, paths, projectId, github) {
  const lastAt = Math.max(...transactionOperations.map(entry => Date.parse(entry?.finishedAt || entry?.startedAt || '') || 0), 0);
  const ids = new Set(transactionOperations.map(entry => entry.id));
  const target = new Set(paths);
  const all = await listOperationJournal({ status: 'ok', mode: 'write', limit: 500 });
  return all.filter(entry => {
    if (ids.has(entry?.id)) return false;
    if (entry?.context?.projectId && entry.context.projectId !== projectId) return false;
    if (entry?.context?.owner && entry.context.owner !== github.owner) return false;
    if (entry?.context?.repo && entry.context.repo !== github.repo) return false;
    const at = Date.parse(entry?.finishedAt || entry?.startedAt || '') || 0;
    if (at <= lastAt) return false;
    return journalPaths(entry).some(path => target.has(path));
  }).map(entry => ({
    id: text(entry.id, 180),
    tool: text(entry.tool, 180),
    origin: text(entry.origin, 40),
    finishedAt: text(entry.finishedAt, 80),
    paths: journalPaths(entry).filter(path => target.has(path))
  }));
}

function safeCommitCard(operation, commit, checkpoint) {
  return Object.freeze({
    operationId: text(operation?.id, 180),
    sha: text(operation?.result?.commitSha, 128),
    shortSha: text(operation?.result?.commitSha, 128).slice(0, 10),
    branch: text(operation?.result?.branch || operation?.context?.branch, 240),
    tool: text(operation?.tool, 180),
    origin: text(operation?.origin, 40),
    finishedAt: text(operation?.finishedAt || operation?.startedAt, 80),
    message: text(commit?.message, 800),
    authorName: text(commit?.author?.name, 180),
    authoredAt: text(commit?.author?.date, 80),
    parentSha: text(commit?.parents?.[0]?.sha, 128),
    treeSha: text(commit?.tree?.sha, 128),
    paths: Object.freeze(journalPaths(operation)),
    guardedCheckpoint: checkpoint ? Object.freeze({
      id: text(checkpoint.id, 180),
      status: text(checkpoint.status, 80),
      baseHeadSha: text(checkpoint.baseHeadSha, 128),
      shadowCommitSha: text(checkpoint.shadowCommitSha, 128),
      appliedCommitSha: text(checkpoint.appliedCommitSha, 128),
      publishedAt: text(checkpoint.publishedAt, 80)
    }) : null
  });
}

async function transactionContext(transactionId) {
  const tx = await getChangeTransaction(transactionId);
  if (!tx) throw Object.assign(new Error('GIT_TRANSACTION_CHANGE_TRANSACTION_NOT_FOUND'), { code: 'GIT_TRANSACTION_CHANGE_TRANSACTION_NOT_FOUND' });
  if (!tx?.projectId) throw Object.assign(new Error('GIT_TRANSACTION_PROJECT_REQUIRED'), { code: 'GIT_TRANSACTION_PROJECT_REQUIRED' });
  const taskId = text(tx?.links?.taskId, 180);
  if (!taskId) throw Object.assign(new Error('GIT_TRANSACTION_TASK_REQUIRED'), { code: 'GIT_TRANSACTION_TASK_REQUIRED' });
  const settings = await getSettings();
  const github = activeGithub(settings, tx.projectId);
  if (!github?.owner || !github?.repo) throw Object.assign(new Error('GIT_TRANSACTION_GITHUB_MAPPING_REQUIRED'), { code: 'GIT_TRANSACTION_GITHUB_MAPPING_REQUIRED' });
  const journal = await listOperationJournal({ taskId, status: 'ok', mode: 'write', limit: 240 });
  const operations = committedTransactionOperations(journal);
  return { tx, taskId, github, operations };
}

async function buildSnapshot(transactionId) {
  const { tx, taskId, github, operations } = await transactionContext(transactionId);
  const branchSet = [...new Set(operations.map(entry => text(entry?.result?.branch || entry?.context?.branch, 240)).filter(Boolean))];
  const branch = branchSet[0] || github.branch || 'main';
  const adapter = new GitAdapter({ ...github, branch });
  const currentHead = await headSha(adapter, branch);

  if (!operations.length) {
    return Object.freeze({
      schema: GIT_TRANSACTION_SCHEMA,
      build: BUILD,
      transactionId: tx.id,
      projectId: tx.projectId,
      taskId,
      repo: `${github.owner}/${github.repo}`,
      branch,
      currentHead,
      baseSha: '',
      appliedSha: '',
      commitCount: 0,
      commits: Object.freeze([]),
      compare: null,
      span: Object.freeze({ sameBranch: true, exactSpan: false, contiguous: false, commitCount: 0, partialRevertAllowed: false }),
      currentRelation: Object.freeze({ status: 'no-commits', sourceAncestor: false }),
      checkpointCoverage: Object.freeze({ covered: 0, total: 0, complete: false }),
      revertEligibility: Object.freeze({ allowed: false, code: 'GIT_TRANSACTION_NO_COMMITS' }),
      changeTransactionStatus: tx.status,
      rawPatchIncluded: false,
      partialRevertAllowed: false
    });
  }

  if (branchSet.length !== 1) {
    return Object.freeze({
      schema: GIT_TRANSACTION_SCHEMA,
      build: BUILD,
      transactionId: tx.id,
      projectId: tx.projectId,
      taskId,
      repo: `${github.owner}/${github.repo}`,
      branch: '',
      currentHead,
      baseSha: '',
      appliedSha: '',
      commitCount: operations.length,
      commits: Object.freeze([]),
      compare: null,
      span: Object.freeze({ sameBranch: false, exactSpan: false, contiguous: false, commitCount: operations.length, partialRevertAllowed: false }),
      currentRelation: Object.freeze({ status: 'branch-mismatch', sourceAncestor: false }),
      checkpointCoverage: Object.freeze({ covered: 0, total: operations.length, complete: false }),
      revertEligibility: Object.freeze({ allowed: false, code: 'GIT_TRANSACTION_MULTI_BRANCH_BLOCKED' }),
      changeTransactionStatus: tx.status,
      rawPatchIncluded: false,
      partialRevertAllowed: false
    });
  }

  const commitObjects = await Promise.all(operations.map(entry => adapter.getCommit(text(entry?.result?.commitSha, 128))));
  const baseSha = text(commitObjects[0]?.parents?.[0]?.sha, 128).toLowerCase();
  const appliedSha = text(operations[operations.length - 1]?.result?.commitSha, 128).toLowerCase();
  if (!baseSha || !appliedSha) throw Object.assign(new Error('GIT_TRANSACTION_SPAN_BOUNDARY_MISSING'), { code: 'GIT_TRANSACTION_SPAN_BOUNDARY_MISSING' });

  const [spanCompare, checkpoints] = await Promise.all([
    adapter.compareCommits(baseSha, appliedSha),
    listCheckpoints({ owner: github.owner, repo: github.repo, branch })
  ]);
  const span = proveTransactionCommitSpan(operations, spanCompare);
  const checkpointByCommit = new Map((checkpoints || []).filter(row => row?.appliedCommitSha).map(row => [String(row.appliedCommitSha).toLowerCase(), row]));
  const commits = operations.map((entry, index) => safeCommitCard(entry, commitObjects[index], checkpointByCommit.get(text(entry?.result?.commitSha, 128).toLowerCase()) || null));
  const projectedCompare = safeCompareProjection(spanCompare);

  let currentRelation = { status: 'identical', sourceAncestor: appliedSha === currentHead, aheadBy: 0, behindBy: 0 };
  if (appliedSha !== currentHead) {
    const relation = await adapter.compareCommits(appliedSha, currentHead);
    const status = text(relation?.status, 40).toLowerCase();
    currentRelation = {
      status,
      sourceAncestor: ['ahead', 'identical'].includes(status),
      aheadBy: Number(relation?.ahead_by || 0) || 0,
      behindBy: Number(relation?.behind_by || 0) || 0
    };
  }

  const paths = projectedCompare.files.map(file => file.path);
  const sensitive = paths.filter(isSensitivePath);
  const nonText = paths.filter(path => !isTextPath(path));
  const alreadyReverted = tx?.recovery?.status === 'applied' || tx?.status === 'reverted';
  let eligibility = { allowed: true, code: 'OK' };
  if (alreadyReverted) eligibility = { allowed: false, code: 'GIT_TRANSACTION_ALREADY_REVERTED' };
  else if (!span.contiguous) eligibility = { allowed: false, code: 'GIT_TRANSACTION_NON_CONTIGUOUS' };
  else if (!currentRelation.sourceAncestor) eligibility = { allowed: false, code: 'GIT_TRANSACTION_APPLIED_NOT_ANCESTOR' };
  else if (!paths.length || paths.length > MAX_TRANSACTION_FILES) eligibility = { allowed: false, code: 'GIT_TRANSACTION_PATH_COUNT_INVALID' };
  else if (sensitive.length) eligibility = { allowed: false, code: 'GIT_TRANSACTION_SENSITIVE_PATH_BLOCKED' };
  else if (nonText.length) eligibility = { allowed: false, code: 'GIT_TRANSACTION_NON_TEXT_BLOCKED' };

  const covered = commits.filter(commit => commit.guardedCheckpoint).length;
  return Object.freeze({
    schema: GIT_TRANSACTION_SCHEMA,
    build: BUILD,
    transactionId: tx.id,
    projectId: tx.projectId,
    taskId,
    repo: `${github.owner}/${github.repo}`,
    branch,
    currentHead,
    baseSha,
    appliedSha,
    commitCount: commits.length,
    commits: Object.freeze(commits),
    compare: projectedCompare,
    span,
    currentRelation: Object.freeze(currentRelation),
    checkpointCoverage: Object.freeze({ covered, total: commits.length, complete: covered === commits.length && commits.length > 0 }),
    revertEligibility: Object.freeze({ ...eligibility, sensitivePaths: Object.freeze(sensitive), nonTextPaths: Object.freeze(nonText) }),
    changeTransactionStatus: tx.status,
    guardedCommitRequiredByRuntime: true,
    rawPatchIncluded: false,
    partialRevertAllowed: false
  });
}

async function computeTransactionRevert(transactionId) {
  const snapshot = await buildSnapshot(transactionId);
  if (!snapshot.revertEligibility.allowed) {
    const error = new Error(snapshot.revertEligibility.code);
    error.code = snapshot.revertEligibility.code;
    error.snapshot = snapshot;
    throw error;
  }

  const { tx, taskId, github, operations } = await transactionContext(transactionId);
  const adapter = new GitAdapter({ ...github, branch: snapshot.branch });
  const paths = snapshot.compare.files.map(file => file.path);
  const [baseTree, appliedTree, currentTree, userRows, dependent] = await Promise.all([
    treeMap(adapter, snapshot.baseSha),
    treeMap(adapter, snapshot.appliedSha),
    treeMap(adapter, snapshot.currentHead),
    loadRecentUserEdits(tx.projectId, 80),
    dependentOperations(operations, paths, tx.projectId, github)
  ]);

  const frames = [];
  for (const path of paths) {
    frames.push({
      path,
      base: await fileState(adapter, baseTree.map, path),
      applied: await fileState(adapter, appliedTree.map, path),
      current: await fileState(adapter, currentTree.map, path)
    });
  }

  const firstAt = operations[0]?.finishedAt || operations[0]?.startedAt || tx.createdAt || '';
  const human = laterHumanEdits(userRows, firstAt, paths);
  const syntheticOperation = {
    id: `git-tx:${tx.id}`,
    result: { commitSha: snapshot.appliedSha },
    finishedAt: operations[operations.length - 1]?.finishedAt || ''
  };
  const plan = await buildReversalPlan({
    operation: syntheticOperation,
    frames,
    direction: 'undo',
    strategy: 'preserve',
    laterHumanEdits: human,
    dependentOperations: dependent
  });
  return { tx, taskId, github, operations, adapter, snapshot, plan };
}

async function issueRevertPreview(payload = {}) {
  const transactionId = text(payload?.transactionId, 180);
  const computed = await computeTransactionRevert(transactionId);
  const id = crypto.randomUUID();
  const fingerprintPayload = gitTransactionFingerprint({
    transactionId,
    projectId: computed.tx.projectId,
    branch: computed.snapshot.branch,
    baseSha: computed.snapshot.baseSha,
    appliedSha: computed.snapshot.appliedSha,
    currentHead: computed.snapshot.currentHead,
    commitShas: computed.snapshot.span.transactionShas,
    changes: computed.plan.changes,
    conflicts: computed.plan.conflicts
  });
  const fingerprint = await sha256(JSON.stringify({ git: fingerprintPayload, reversal: reversibleFingerprint(computed.plan) }));
  const expiresAt = new Date(Date.now() + TICKET_TTL_MS).toISOString();
  await chrome.storage.session.set({
    [ticketKey(id)]: {
      schema: 'ld-git-transaction-revert-ticket/1',
      id,
      transactionId,
      projectId: computed.tx.projectId,
      taskId: computed.taskId,
      headSha: computed.snapshot.currentHead,
      fingerprint,
      used: false,
      createdAt: new Date().toISOString(),
      expiresAt
    }
  });
  return Object.freeze({
    previewId: id,
    expiresAt,
    transactionId,
    headSha: computed.snapshot.currentHead,
    span: Object.freeze({
      baseSha: computed.snapshot.baseSha,
      appliedSha: computed.snapshot.appliedSha,
      commitShas: computed.snapshot.span.transactionShas
    }),
    plan: Object.freeze({
      schema: 'ld-git-transaction-revert-preview/1',
      allowed: computed.plan.allowed,
      strategy: 'preserve',
      destructive: computed.plan.destructive,
      changes: computed.plan.changes,
      conflicts: computed.plan.conflicts,
      dependentOperations: computed.plan.dependentOperations,
      files: Object.freeze((computed.plan.files || []).map(file => Object.freeze({
        path: file.path,
        status: file.status,
        action: file.action,
        destructive: file.destructive,
        conflict: file.conflict,
        laterHumanEdits: file.laterHumanEdits,
        beforeHash: file.beforeHash,
        afterHash: file.afterHash,
        preview: file.preview
      }))),
      humanIntentPreservedByDefault: true,
      partialRevertAllowed: false
    })
  });
}

async function loadTicket(previewId) {
  const key = ticketKey(previewId);
  const stored = await chrome.storage.session.get(key);
  const ticket = stored[key];
  if (!ticket || ticket.id !== previewId) throw Object.assign(new Error('GIT_TRANSACTION_REVERT_PREVIEW_NOT_FOUND'), { code: 'GIT_TRANSACTION_REVERT_PREVIEW_NOT_FOUND' });
  if (ticket.used === true) throw Object.assign(new Error('GIT_TRANSACTION_REVERT_PREVIEW_ALREADY_USED'), { code: 'GIT_TRANSACTION_REVERT_PREVIEW_ALREADY_USED' });
  if (Date.parse(ticket.expiresAt || '') <= Date.now()) {
    await chrome.storage.session.remove(key);
    throw Object.assign(new Error('GIT_TRANSACTION_REVERT_PREVIEW_EXPIRED'), { code: 'GIT_TRANSACTION_REVERT_PREVIEW_EXPIRED' });
  }
  return { key, ticket };
}

async function applyRevert(payload = {}) {
  if (payload?.humanDecision !== true) {
    throw Object.assign(new Error('GIT_TRANSACTION_REVERT_HUMAN_CONFIRMATION_REQUIRED'), { code: 'GIT_TRANSACTION_REVERT_HUMAN_CONFIRMATION_REQUIRED' });
  }
  const previewId = text(payload?.previewId, 180);
  const { key, ticket } = await loadTicket(previewId);
  const computed = await computeTransactionRevert(ticket.transactionId);
  if (computed.taskId !== ticket.taskId) throw Object.assign(new Error('GIT_TRANSACTION_REVERT_TASK_CHANGED'), { code: 'GIT_TRANSACTION_REVERT_TASK_CHANGED' });
  if (computed.snapshot.currentHead !== ticket.headSha) throw Object.assign(new Error('GIT_TRANSACTION_REVERT_HEAD_CHANGED'), { code: 'GIT_TRANSACTION_REVERT_HEAD_CHANGED' });

  const fingerprintPayload = gitTransactionFingerprint({
    transactionId: ticket.transactionId,
    projectId: computed.tx.projectId,
    branch: computed.snapshot.branch,
    baseSha: computed.snapshot.baseSha,
    appliedSha: computed.snapshot.appliedSha,
    currentHead: computed.snapshot.currentHead,
    commitShas: computed.snapshot.span.transactionShas,
    changes: computed.plan.changes,
    conflicts: computed.plan.conflicts
  });
  const currentFingerprint = await sha256(JSON.stringify({ git: fingerprintPayload, reversal: reversibleFingerprint(computed.plan) }));
  if (currentFingerprint !== ticket.fingerprint) throw Object.assign(new Error('GIT_TRANSACTION_REVERT_PREVIEW_STALE'), { code: 'GIT_TRANSACTION_REVERT_PREVIEW_STALE' });
  if (!computed.plan.allowed) {
    const error = new Error('GIT_TRANSACTION_REVERT_CONFLICT');
    error.code = 'GIT_TRANSACTION_REVERT_CONFLICT';
    error.plan = computed.plan;
    throw error;
  }

  await chrome.storage.session.set({ [key]: { ...ticket, used: true, usedAt: new Date().toISOString() } });
  const journal = await beginOperation({
    tool: 'git_transaction.revert',
    mode: 'write',
    origin: 'undo',
    input: { action: 'transaction-revert', paths: computed.plan.changes.map(change => change.path) },
    context: {
      projectId: computed.tx.projectId,
      owner: computed.github.owner,
      repo: computed.github.repo,
      branch: computed.snapshot.branch,
      taskId: computed.taskId,
      parentOperationId: `git-tx:${computed.tx.id}`
    }
  });

  try {
    const files = computed.plan.files
      .filter(file => file.status === 'ready' && file.action !== 'none')
      .map(file => ({ path: file.path, action: file.action, content: file.action === 'delete' ? '' : file.proposedContent }));
    if (!files.length) throw Object.assign(new Error('GIT_TRANSACTION_REVERT_NO_CHANGES'), { code: 'GIT_TRANSACTION_REVERT_NO_CHANGES' });

    const result = await computed.adapter.atomicCommit({
      files,
      message: `revert: change transaction ${computed.tx.id.slice(0, 8)}`,
      baseBranch: computed.snapshot.branch,
      createBranch: false,
      createPr: false,
      projectId: computed.tx.projectId
    });
    const afterTree = await treeMap(computed.adapter, result.commitSha);
    const changes = [];
    for (const change of computed.plan.changes) {
      const planned = computed.plan.files.find(file => file.path === change.path);
      changes.push({
        path: change.path,
        action: change.action,
        origin: 'undo',
        beforeHash: planned?.beforeHash || '',
        afterHash: planned?.afterHash || '',
        beforeBlobSha: planned?.currentBlobSha || '',
        afterBlobSha: afterTree.map.get(change.path)?.sha || ''
      });
    }
    await finishOperation(journal, {
      status: 'ok',
      changes,
      result: {
        code: 'OK',
        branch: result.branch,
        commitSha: result.commitSha,
        fileCount: changes.length,
        reversalOf: `git-tx:${computed.tx.id}`,
        direction: 'undo',
        strategy: 'preserve',
        previewId
      }
    });
    await patchChangeTransaction(computed.tx.id, {
      status: 'reverted',
      recovery: {
        status: 'applied',
        sourceOperationId: `git-tx:${computed.tx.id}`,
        reversalOperationId: journal.id,
        commitSha: result.commitSha,
        direction: 'undo',
        strategy: 'preserve',
        previewId
      }
    });
    return Object.freeze({
      schema: 'ld-git-transaction-revert-result/1',
      transactionId: computed.tx.id,
      taskId: computed.taskId,
      journalOperationId: journal.id,
      result,
      review: await buildSnapshot(computed.tx.id),
      humanIntentPreserved: true,
      partialRevertPerformed: false
    });
  } catch (error) {
    await finishOperation(journal, { status: 'failed', error }).catch(() => null);
    throw error;
  }
}

async function listSummaries(payload = {}) {
  const projectId = text(payload?.projectId, 180);
  const limit = Math.max(1, Math.min(80, Number(payload?.limit || 40)));
  const [transactions, journal] = await Promise.all([
    listChangeTransactions({ projectId, limit }),
    listOperationJournal({ projectId, status: 'ok', mode: 'write', limit: 500 })
  ]);
  const byTask = new Map();
  for (const entry of committedTransactionOperations(journal)) {
    const taskId = text(entry?.context?.taskId, 180);
    if (!taskId) continue;
    if (!byTask.has(taskId)) byTask.set(taskId, []);
    byTask.get(taskId).push(entry);
  }
  return transactions.map(tx => {
    const rows = byTask.get(text(tx?.links?.taskId, 180)) || [];
    const latest = rows[rows.length - 1] || null;
    return Object.freeze({
      transactionId: tx.id,
      label: text(tx?.intent?.label, 300),
      status: text(tx?.status, 80),
      updatedAt: text(tx?.updatedAt, 80),
      taskId: text(tx?.links?.taskId, 180),
      commitCount: rows.length,
      latestCommitSha: text(latest?.result?.commitSha, 128),
      branch: text(latest?.result?.branch || latest?.context?.branch, 240),
      reverted: tx?.recovery?.status === 'applied' || tx?.status === 'reverted'
    });
  });
}

async function handle(action, payload = {}) {
  const op = text(action || 'status', 80).toLowerCase();
  if (op === 'status') return {
    schema: GIT_TRANSACTION_SCHEMA,
    build: BUILD,
    changeTransactionIntegrated: true,
    commitCards: true,
    branchHeadAwareness: true,
    compare: true,
    checkpointEvidence: true,
    guardedCommitWriter: true,
    revert: 'combined-net-diff-3way-preserve',
    partialRevertAllowed: false,
    previewRequired: true,
    humanConfirmationRequired: true,
    headLock: true,
    taskLock: true,
    rawPatchDurablePersistence: false
  };
  if (op === 'list') return { transactions: await listSummaries(payload) };
  if (op === 'snapshot') return { snapshot: await buildSnapshot(payload?.transactionId) };
  if (op === 'revert_preview') return issueRevertPreview(payload);
  if (op === 'revert_apply') return applyRevert(payload);
  throw Object.assign(new Error('GIT_TRANSACTION_ACTION_INVALID'), { code: 'GIT_TRANSACTION_ACTION_INVALID' });
}

export function installGitTransactionRuntime() {
  if (globalThis.__LD99_GIT_TRANSACTION_RUNTIME__) return;
  globalThis.__LD99_GIT_TRANSACTION_RUNTIME__ = true;
  chrome.runtime.onConnect.addListener(port => {
    if (port.name !== PORT_NAME) return;
    const listener = async message => {
      const id = text(message?.id, 180);
      try {
        port.postMessage({ id, ok: true, data: await handle(message?.action, message?.payload || {}) });
      } catch (error) {
        try {
          port.postMessage({
            id,
            ok: false,
            error: error?.message || String(error),
            code: error?.code || 'GIT_TRANSACTION_FAILED',
            plan: error?.plan || null,
            snapshot: error?.snapshot || null
          });
        } catch (_) {}
      }
    };
    port.onMessage.addListener(listener);
  });
  globalThis.LovableDecrypterGitTransactionRuntime = Object.freeze({
    build: BUILD,
    schema: GIT_TRANSACTION_SCHEMA,
    port: PORT_NAME,
    changeTransactionIntegrated: true,
    guardedCommit: true,
    partialRevertAllowed: false,
    previewRequired: true,
    humanConfirmationRequired: true,
    taskLock: true
  });
}
