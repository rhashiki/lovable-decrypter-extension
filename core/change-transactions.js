const KEY = 'ld97_change_transactions_v1';
const SCHEMA = 'ld-change-transaction/1';
const MAX_ITEMS = 160;

let queue = Promise.resolve();
const text = (value, max = 1000) => String(value ?? '').trim().slice(0, max);
const unique = values => [...new Set((Array.isArray(values) ? values : []).map(value => text(value, 1200)).filter(Boolean))];
const nowIso = () => new Date().toISOString();

function safeFiles(files = []) {
  return (Array.isArray(files) ? files : []).slice(0, 80).map(file => Object.freeze({
    path: text(file?.path || file, 1200),
    action: text(file?.action, 40),
    reason: text(file?.reason, 600),
    addedLines: Math.max(0, Number(file?.addedLines || 0) || 0),
    removedLines: Math.max(0, Number(file?.removedLines || 0) || 0),
    destructive: file?.destructive === true || String(file?.action || '').toLowerCase() === 'delete',
    beforeBlobSha: text(file?.beforeBlobSha, 128)
  })).filter(file => file.path);
}

function safePlan(plan = {}) {
  return Object.freeze({
    summary: text(plan?.summary, 6000),
    steps: (Array.isArray(plan?.plan || plan?.steps) ? (plan.plan || plan.steps) : []).map(step => text(step, 1600)).filter(Boolean).slice(0, 40),
    files: safeFiles(plan?.files || [])
  });
}

function safeCapabilityRoute(route = {}) {
  return Object.freeze({
    resolved: route?.resolved === true,
    required: unique(route?.requiredCapabilities || []).map(v => v.toUpperCase()).slice(0, 16),
    candidates: unique(route?.candidateCapabilities || []).map(v => v.toUpperCase()).slice(0, 16),
    primary: text(route?.primaryCapability || route?.primary, 80).toUpperCase()
  });
}

function safeDatabase(database = {}) {
  return Object.freeze({
    ticketId: text(database?.ticketId || database?.ticket?.id, 180),
    sqlHash: text(database?.sqlHash || database?.ticket?.sql_hash || database?.ticket?.sqlHash, 128),
    risk: text(database?.risk || database?.ticket?.risk || database?.classification?.risk, 40).toUpperCase(),
    status: text(database?.status || database?.ticket?.status, 80),
    projectRef: text(database?.projectRef || database?.project?.projectRef, 80),
    projectName: text(database?.projectName || database?.project?.projectName, 240),
    verificationRequired: database?.verificationRequired === true,
    automaticRetry: false
  });
}

function safeRecovery(recovery = {}) {
  return Object.freeze({
    status: text(recovery?.status, 80),
    sourceOperationId: text(recovery?.sourceOperationId, 180),
    reversalOperationId: text(recovery?.reversalOperationId || recovery?.operationId, 180),
    commitSha: text(recovery?.commitSha, 128),
    direction: text(recovery?.direction, 40),
    strategy: text(recovery?.strategy, 80),
    previewId: text(recovery?.previewId, 180)
  });
}

function safeRecord(input = {}) {
  const createdAt = text(input?.createdAt, 80) || nowIso();
  return Object.freeze({
    schema: SCHEMA,
    id: text(input?.id, 180),
    projectId: text(input?.projectId, 180),
    mode: input?.mode === 'plan' ? 'plan' : 'build',
    status: text(input?.status || 'created', 80),
    createdAt,
    updatedAt: text(input?.updatedAt, 80) || createdAt,
    intent: Object.freeze({
      digest: text(input?.intent?.digest || input?.commandDigest, 128),
      label: text(input?.intent?.label, 300),
      rawPromptPersisted: false
    }),
    capabilityRoute: safeCapabilityRoute(input?.capabilityRoute || {}),
    plan: safePlan(input?.plan || {}),
    review: Object.freeze({
      proposalDigest: text(input?.review?.proposalDigest, 128),
      tool: text(input?.review?.tool, 180),
      destructive: input?.review?.destructive === true,
      files: safeFiles(input?.review?.files || [])
    }),
    links: Object.freeze({
      taskId: text(input?.links?.taskId || input?.taskId, 180),
      approvalTransactionIds: Object.freeze(unique(input?.links?.approvalTransactionIds || []).slice(0, 40)),
      operationIds: Object.freeze(unique(input?.links?.operationIds || []).slice(0, 100))
    }),
    database: safeDatabase(input?.database || {}),
    recovery: safeRecovery(input?.recovery || {}),
    lastError: input?.lastError ? Object.freeze({ code: text(input.lastError.code, 180), message: text(input.lastError.message, 900) }) : null,
    privacy: Object.freeze({
      rawPromptPersisted: false,
      rawSqlPersisted: false,
      rawDiffPersisted: false,
      rawFileContentPersisted: false,
      credentialsPersisted: false
    }),
    authority: Object.freeze({
      writer: false,
      approvalAuthority: false,
      operationJournalIsEvidence: true,
      continuityIsRecoveryAuthority: true,
      reversibleOperationsIsRevertAuthority: true
    })
  });
}

async function load() {
  const stored = await chrome.storage.local.get(KEY);
  return Array.isArray(stored?.[KEY]) ? stored[KEY] : [];
}

async function save(rows) {
  await chrome.storage.local.set({ [KEY]: (Array.isArray(rows) ? rows : []).slice(0, MAX_ITEMS) });
}

function mutate(fn) {
  const run = async () => {
    const rows = await load();
    const result = await fn(rows);
    await save(result.rows || rows);
    return result.value;
  };
  const pending = queue.then(run, run);
  queue = pending.then(() => undefined, () => undefined);
  return pending;
}

export async function createChangeTransaction(input = {}) {
  const record = safeRecord({ ...input, id: input.id || crypto.randomUUID(), createdAt: nowIso(), updatedAt: nowIso() });
  if (!record.projectId) throw Object.assign(new Error('CHANGE_TRANSACTION_PROJECT_REQUIRED'), { code: 'CHANGE_TRANSACTION_PROJECT_REQUIRED' });
  if (!record.intent.digest) throw Object.assign(new Error('CHANGE_TRANSACTION_INTENT_DIGEST_REQUIRED'), { code: 'CHANGE_TRANSACTION_INTENT_DIGEST_REQUIRED' });
  return mutate(rows => ({ rows: [record, ...rows.filter(row => row?.id !== record.id)], value: record }));
}

export async function patchChangeTransaction(id, patch = {}) {
  const txId = text(id, 180);
  if (!txId) throw Object.assign(new Error('CHANGE_TRANSACTION_ID_REQUIRED'), { code: 'CHANGE_TRANSACTION_ID_REQUIRED' });
  return mutate(rows => {
    const index = rows.findIndex(row => row?.id === txId);
    if (index < 0) throw Object.assign(new Error('CHANGE_TRANSACTION_NOT_FOUND'), { code: 'CHANGE_TRANSACTION_NOT_FOUND' });
    const current = rows[index];
    const merged = safeRecord({
      ...current,
      ...patch,
      id: current.id,
      projectId: current.projectId,
      createdAt: current.createdAt,
      updatedAt: nowIso(),
      intent: { ...current.intent, ...(patch.intent || {}) },
      capabilityRoute: { ...current.capabilityRoute, ...(patch.capabilityRoute || {}) },
      plan: patch.plan ? patch.plan : current.plan,
      review: { ...current.review, ...(patch.review || {}) },
      links: {
        ...current.links,
        ...(patch.links || {}),
        approvalTransactionIds: unique([...(current.links?.approvalTransactionIds || []), ...(patch.links?.approvalTransactionIds || [])]),
        operationIds: unique([...(current.links?.operationIds || []), ...(patch.links?.operationIds || [])])
      },
      database: { ...current.database, ...(patch.database || {}) },
      recovery: { ...current.recovery, ...(patch.recovery || {}) }
    });
    rows[index] = merged;
    rows.sort((a, b) => Date.parse(b.updatedAt || '') - Date.parse(a.updatedAt || ''));
    return { rows, value: merged };
  });
}

export async function getChangeTransaction(id) {
  const txId = text(id, 180);
  const rows = await load();
  return rows.find(row => row?.id === txId) || null;
}

export async function listChangeTransactions({ projectId = '', limit = 60 } = {}) {
  const safeLimit = Math.max(1, Math.min(MAX_ITEMS, Number(limit || 60)));
  const rows = await load();
  return rows.filter(row => !projectId || row?.projectId === projectId).slice(0, safeLimit).map(row => safeRecord(row));
}

export { KEY as CHANGE_TRANSACTIONS_KEY, SCHEMA as CHANGE_TRANSACTION_SCHEMA, MAX_ITEMS as MAX_CHANGE_TRANSACTIONS };
