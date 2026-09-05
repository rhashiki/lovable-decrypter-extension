import { McpClient } from '../core/mcp-client.js';
import { originPermissionPattern } from '../core/mcp-protocol.js';
import {
  listMcpServers,
  getMcpServer,
  setMcpToolPolicy,
  prepareMcpWriteApproval,
  approveMcpWriteApproval
} from '../core/mcp-trust-gateway.js';
import { evaluateAutonomyPolicy } from '../core/guided-autonomy-policy.js';
import { sha256Text } from '../core/patch-engine.js';
import {
  createContinuityTask,
  defineContinuitySteps,
  claimContinuityStep,
  completeContinuityStep,
  failContinuityStep,
  getContinuityTask
} from '../core/continuity-engine.js';
import {
  createChangeTransaction,
  getChangeTransaction,
  patchChangeTransaction
} from '../core/change-transactions.js';
import {
  LOVABLE_DEPLOYMENT_SCHEMA,
  LOVABLE_DEPLOYMENT_BUILD,
  LOVABLE_MCP_ENDPOINT,
  LOVABLE_DEPLOY_TOOL,
  LOVABLE_PROJECT_TOOL,
  LOVABLE_DEPLOYMENT_TICKET_TTL_MS,
  normalizeLovableProjectId,
  selectOfficialLovableMcpServer,
  validateLovableDeployPolicies,
  projectObservationFromMcp,
  deploymentResultFromMcp,
  deploymentOutcomeClassification,
  deploymentFingerprint
} from '../core/lovable-deployment-adapter.js';

const PORT_NAME = 'ld2-lovable-deployment';
const TICKET_PREFIX = 'ld100_lovable_deploy_ticket_v1_';
const MAX_TICKETS = 12;
const client = new McpClient({ clientVersion: '2.6.100', capabilities: { tools: {} } });
const text = (value, max = 1200) => String(value ?? '').trim().slice(0, max);
const nowIso = () => new Date().toISOString();
const ticketKey = id => `${TICKET_PREFIX}${text(id, 180).replace(/[^a-z0-9-]/gi, '')}`;

function cleanCommit(value = '') {
  const sha = text(value, 128).toLowerCase();
  if (!sha) return '';
  if (!/^[0-9a-f]{7,64}$/.test(sha)) {
    const error = new Error('LOVABLE_DEPLOY_EXPECTED_COMMIT_INVALID');
    error.code = 'LOVABLE_DEPLOY_EXPECTED_COMMIT_INVALID';
    throw error;
  }
  return sha;
}

async function officialServer() {
  const server = selectOfficialLovableMcpServer(await listMcpServers());
  if (!server) {
    const error = new Error('LOVABLE_MCP_SERVER_REQUIRED');
    error.code = 'LOVABLE_MCP_SERVER_REQUIRED';
    throw error;
  }
  if (server.trust !== 'approved') {
    const error = new Error('LOVABLE_MCP_SERVER_NOT_TRUSTED');
    error.code = 'LOVABLE_MCP_SERVER_NOT_TRUSTED';
    throw error;
  }
  return getMcpServer(server.id);
}

async function hostPermission(server) {
  const origin = originPermissionPattern(server.endpoint);
  const granted = await chrome.permissions.contains({ origins: [origin] });
  return Object.freeze({ origin, granted });
}

function assertDeployAlwaysAsk() {
  const decision = evaluateAutonomyPolicy({ mode: 'autonomous', capability: 'DEPLOY', action: 'DEPLOY' });
  if (decision.decision !== 'ALWAYS_ASK' || decision.automaticEligible === true || decision.humanRequired !== true) {
    const error = new Error('LOVABLE_DEPLOY_POLICY_FLOOR_INVALID');
    error.code = 'LOVABLE_DEPLOY_POLICY_FLOOR_INVALID';
    throw error;
  }
  return decision;
}

async function transactionContext(transactionId = '', projectId = '') {
  const txId = text(transactionId, 180);
  if (!txId) return { transaction: null, parentTaskId: '' };
  const transaction = await getChangeTransaction(txId);
  if (!transaction) {
    const error = new Error('LOVABLE_DEPLOY_CHANGE_TRANSACTION_NOT_FOUND');
    error.code = 'LOVABLE_DEPLOY_CHANGE_TRANSACTION_NOT_FOUND';
    throw error;
  }
  if (transaction.projectId !== projectId) {
    const error = new Error('LOVABLE_DEPLOY_CHANGE_TRANSACTION_PROJECT_MISMATCH');
    error.code = 'LOVABLE_DEPLOY_CHANGE_TRANSACTION_PROJECT_MISMATCH';
    throw error;
  }
  return { transaction, parentTaskId: text(transaction?.links?.taskId, 180) };
}

async function observeProject(server, projectId, taskId = '') {
  const response = await client.callTool(server.id, LOVABLE_PROJECT_TOOL, { project_id: projectId }, {
    origin: 'deployment-preflight',
    taskId,
    timeoutMs: 60000
  });
  const observation = projectObservationFromMcp(response, projectId);
  if (observation.projectMatches !== true) {
    const error = new Error('LOVABLE_DEPLOY_MCP_PROJECT_MISMATCH');
    error.code = 'LOVABLE_DEPLOY_MCP_PROJECT_MISMATCH';
    throw error;
  }
  return { response, observation };
}

async function performPreflight({ projectId, transactionId = '', expectedCommitSha = '', taskId = '' } = {}) {
  const id = normalizeLovableProjectId(projectId);
  const expected = cleanCommit(expectedCommitSha);
  const server = await officialServer();
  const permission = await hostPermission(server);
  const policies = validateLovableDeployPolicies(server, id);
  const policyDecision = assertDeployAlwaysAsk();
  const tx = await transactionContext(transactionId, id);

  if (!permission.granted) {
    const error = new Error('LOVABLE_DEPLOY_MCP_HOST_PERMISSION_REQUIRED');
    error.code = 'LOVABLE_DEPLOY_MCP_HOST_PERMISSION_REQUIRED';
    error.origin = permission.origin;
    throw error;
  }
  if (!policies.ready) {
    const error = new Error('LOVABLE_DEPLOY_MCP_SCOPE_POLICY_REQUIRED');
    error.code = 'LOVABLE_DEPLOY_MCP_SCOPE_POLICY_REQUIRED';
    error.policies = policies;
    throw error;
  }

  const observed = await observeProject(server, id, taskId || tx.parentTaskId);
  if (expected && !observed.observation.latestCommitSha) {
    const error = new Error('LOVABLE_DEPLOY_COMMIT_NOT_OBSERVABLE');
    error.code = 'LOVABLE_DEPLOY_COMMIT_NOT_OBSERVABLE';
    throw error;
  }
  if (expected && observed.observation.latestCommitSha !== expected) {
    const error = new Error('LOVABLE_DEPLOY_COMMIT_NOT_SYNCED');
    error.code = 'LOVABLE_DEPLOY_COMMIT_NOT_SYNCED';
    error.expectedCommitSha = expected;
    error.observedCommitSha = observed.observation.latestCommitSha;
    throw error;
  }

  return Object.freeze({
    schema: LOVABLE_DEPLOYMENT_SCHEMA,
    build: LOVABLE_DEPLOYMENT_BUILD,
    ready: true,
    provider: 'lovable',
    transport: 'mcp',
    endpoint: LOVABLE_MCP_ENDPOINT,
    projectId: id,
    transactionId: text(transactionId, 180),
    parentTaskId: tx.parentTaskId,
    server: Object.freeze({ id: server.id, name: server.name, endpoint: server.endpoint, trust: server.trust }),
    permission,
    policies,
    policyDecision: Object.freeze({ decision: policyDecision.decision, rule: policyDecision.rule, humanRequired: true, automaticEligible: false }),
    expectedCommitSha: expected,
    observedCommitSha: observed.observation.latestCommitSha,
    liveUrl: observed.observation.liveUrl,
    previewUrl: observed.observation.previewUrl,
    securityEnforcedByProvider: true,
    deployTool: LOVABLE_DEPLOY_TOOL,
    automaticDeployAfterMutation: false,
    automaticRetry: false,
    rawMcpResultPersisted: false
  });
}

async function configureScope(payload = {}) {
  const projectId = normalizeLovableProjectId(payload?.projectId);
  const server = await officialServer();
  await setMcpToolPolicy(server.id, LOVABLE_PROJECT_TOOL, {
    enabled: true,
    mode: 'read',
    allowedArgumentKeys: ['project_id'],
    constraints: { project_id: { equals: projectId } },
    reason: 'Build100 Lovable deploy preflight: read only, locked to the current project.'
  });
  await setMcpToolPolicy(server.id, LOVABLE_DEPLOY_TOOL, {
    enabled: true,
    mode: 'write',
    allowedArgumentKeys: ['project_id'],
    constraints: { project_id: { equals: projectId } },
    reason: 'Build100 Lovable deployment: exact project only; every call still requires one-time human approval.'
  });
  return {
    configured: true,
    projectId,
    serverId: server.id,
    policies: validateLovableDeployPolicies(await getMcpServer(server.id), projectId),
    deployRemainsAlwaysAsk: true,
    callerSuppliedAutoApprovalAccepted: false
  };
}

async function createDeploymentTask({ projectId, parentTaskId = '', expectedCommitSha = '' } = {}) {
  const commandDigest = await sha256Text(JSON.stringify({ capability: 'DEPLOY', provider: 'lovable', projectId, expectedCommitSha }));
  const task = await createContinuityTask({
    projectId,
    repo: `lovable:${projectId}`,
    branch: 'production',
    commandDigest,
    metadata: { mode: 'deploy', source: 'lovable-deployment-v100', parentTaskId }
  });
  await defineContinuitySteps(task.id, [
    { idempotencyKey: 'deploy-preflight', label: 'Lovable deploy preflight', kind: 'verification', mode: 'read', resumable: true, retrySafe: true },
    { idempotencyKey: 'deploy-approval', label: 'Human deploy approval', kind: 'approval', mode: 'read', resumable: false, retrySafe: true },
    { idempotencyKey: 'deploy-write', label: 'Lovable deploy_project', kind: 'tool', mode: 'write', resumable: true, retrySafe: false, maxAttempts: 1 },
    { idempotencyKey: 'deploy-verify', label: 'Verify Lovable deployment', kind: 'verification', mode: 'read', resumable: true, retrySafe: true }
  ]);
  return task;
}

async function completeReadStep(taskId, key, inputDigest = '', operationId = '', outputDigest = '') {
  const lease = await claimContinuityStep({ taskId, idempotencyKey: key, workerId: 'lovable-deployment-v100', leaseMs: 90000, inputDigest });
  if (lease.replay) return lease;
  if (!lease.claimed) {
    const error = new Error('LOVABLE_DEPLOY_CONTINUITY_STEP_BUSY');
    error.code = 'LOVABLE_DEPLOY_CONTINUITY_STEP_BUSY';
    throw error;
  }
  await completeContinuityStep({ taskId, idempotencyKey: key, leaseToken: lease.leaseToken, operationId, outputDigest });
  return lease;
}

async function ensureTransaction({ transactionId = '', projectId, taskId, expectedCommitSha, serverId, ticketId = '', mcpApprovalId = '', status = 'prepared' } = {}) {
  let transaction = transactionId ? await getChangeTransaction(transactionId) : null;
  if (!transaction) {
    const digest = await sha256Text(JSON.stringify({ capability: 'DEPLOY', provider: 'lovable', projectId, expectedCommitSha }));
    transaction = await createChangeTransaction({
      projectId,
      mode: 'build',
      status,
      commandDigest: digest,
      intent: { digest, label: 'DEPLOY · Lovable' },
      capabilityRoute: { resolved: true, requiredCapabilities: ['DEPLOY'], primaryCapability: 'DEPLOY' },
      plan: { summary: 'Publicar explicitamente a versão atual no Lovable.', plan: ['Preflight', 'Aprovação humana', 'Deploy', 'Verificação'], files: [] },
      links: { taskId },
      deployment: { provider: 'lovable', transport: 'mcp', serverId, projectId, taskId, ticketId, mcpApprovalId, expectedCommitSha, status, verificationRequired: false }
    });
    return transaction;
  }
  return patchChangeTransaction(transaction.id, {
    deployment: { provider: 'lovable', transport: 'mcp', serverId, projectId, taskId, ticketId, mcpApprovalId, expectedCommitSha, status, verificationRequired: false }
  });
}

async function trimTickets() {
  const all = await chrome.storage.session.get(null);
  const rows = Object.entries(all)
    .filter(([key, value]) => key.startsWith(TICKET_PREFIX) && value?.createdAt)
    .sort((a, b) => Date.parse(b[1].createdAt) - Date.parse(a[1].createdAt));
  const remove = rows.slice(MAX_TICKETS).map(([key]) => key);
  if (remove.length) await chrome.storage.session.remove(remove);
}

async function prepare(payload = {}) {
  const projectId = normalizeLovableProjectId(payload?.projectId);
  const expectedCommitSha = cleanCommit(payload?.expectedCommitSha);
  const initialContext = await transactionContext(payload?.transactionId, projectId);
  const task = await createDeploymentTask({ projectId, parentTaskId: initialContext.parentTaskId, expectedCommitSha });
  try {
    const preflight = await performPreflight({ projectId, transactionId: payload?.transactionId, expectedCommitSha, taskId: task.id });
    await completeReadStep(task.id, 'deploy-preflight', await sha256Text(JSON.stringify({ projectId, expectedCommitSha })), '', await sha256Text(JSON.stringify({ ready: true, observedCommitSha: preflight.observedCommitSha })));
    const args = { project_id: projectId };
    const approval = await prepareMcpWriteApproval({ serverId: preflight.server.id, toolName: LOVABLE_DEPLOY_TOOL, arguments: args });
    const ticketId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + LOVABLE_DEPLOYMENT_TICKET_TTL_MS).toISOString();
    const transaction = await ensureTransaction({ transactionId: payload?.transactionId, projectId, taskId: task.id, expectedCommitSha, serverId: preflight.server.id, ticketId, mcpApprovalId: approval.id, status: 'waiting_deploy_approval' });
    const ticket = {
      schema: 'ld-lovable-deployment-ticket/1',
      id: ticketId,
      transactionId: transaction.id,
      taskId: task.id,
      projectId,
      serverId: preflight.server.id,
      mcpApprovalId: approval.id,
      expectedCommitSha,
      status: 'prepared',
      used: false,
      operationId: '',
      liveUrl: '',
      createdAt: nowIso(),
      expiresAt
    };
    await chrome.storage.session.set({ [ticketKey(ticketId)]: ticket });
    await trimTickets();
    return Object.freeze({
      schema: LOVABLE_DEPLOYMENT_SCHEMA,
      build: LOVABLE_DEPLOYMENT_BUILD,
      ticket: Object.freeze({ id: ticketId, transactionId: transaction.id, taskId: task.id, projectId, expectedCommitSha, status: ticket.status, expiresAt }),
      preflight,
      approval: Object.freeze({ id: approval.id, status: approval.status, expiresAt: approval.expiresAt, toolName: LOVABLE_DEPLOY_TOOL, argumentsPersisted: false }),
      humanApprovalRequired: true,
      automaticDeploy: false,
      automaticRetry: false
    });
  } catch (error) {
    const continuity = await getContinuityTask(task.id).catch(() => null);
    const step = continuity?.steps?.find(item => item.idempotencyKey === 'deploy-preflight');
    if (step && step.status !== 'completed') {
      const lease = await claimContinuityStep({ taskId: task.id, idempotencyKey: 'deploy-preflight', workerId: 'lovable-deployment-v100', leaseMs: 30000 }).catch(() => null);
      if (lease?.claimed) await failContinuityStep({ taskId: task.id, idempotencyKey: 'deploy-preflight', leaseToken: lease.leaseToken, errorCode: error?.code || 'LOVABLE_DEPLOY_PREFLIGHT_FAILED', outcomeUnknown: false }).catch(() => null);
    }
    throw error;
  }
}

async function loadTicket(id, allowedStatuses = []) {
  const key = ticketKey(id);
  const stored = await chrome.storage.session.get(key);
  const ticket = stored[key];
  if (!ticket || ticket.id !== id || ticket.used === true) {
    const error = new Error('LOVABLE_DEPLOY_TICKET_NOT_FOUND');
    error.code = 'LOVABLE_DEPLOY_TICKET_NOT_FOUND';
    throw error;
  }
  if (Date.parse(ticket.expiresAt || '') <= Date.now()) {
    await chrome.storage.session.remove(key);
    const error = new Error('LOVABLE_DEPLOY_TICKET_EXPIRED');
    error.code = 'LOVABLE_DEPLOY_TICKET_EXPIRED';
    throw error;
  }
  if (allowedStatuses.length && !allowedStatuses.includes(ticket.status)) {
    const error = new Error('LOVABLE_DEPLOY_TICKET_STATE_INVALID');
    error.code = 'LOVABLE_DEPLOY_TICKET_STATE_INVALID';
    throw error;
  }
  return { key, ticket };
}

async function approve(payload = {}) {
  if (payload?.humanDecision !== true) {
    const error = new Error('LOVABLE_DEPLOY_HUMAN_APPROVAL_REQUIRED');
    error.code = 'LOVABLE_DEPLOY_HUMAN_APPROVAL_REQUIRED';
    throw error;
  }
  const id = text(payload?.ticketId, 180);
  const { key, ticket } = await loadTicket(id, ['prepared']);
  const preflight = await performPreflight({ projectId: ticket.projectId, transactionId: ticket.transactionId, expectedCommitSha: ticket.expectedCommitSha, taskId: ticket.taskId });
  if (preflight.server.id !== ticket.serverId) {
    const error = new Error('LOVABLE_DEPLOY_SERVER_CHANGED');
    error.code = 'LOVABLE_DEPLOY_SERVER_CHANGED';
    throw error;
  }
  const lease = await claimContinuityStep({ taskId: ticket.taskId, idempotencyKey: 'deploy-approval', workerId: 'human-deploy-approval', leaseMs: 60000, inputDigest: ticket.mcpApprovalId });
  if (!lease.claimed && !lease.replay) {
    const error = new Error('LOVABLE_DEPLOY_APPROVAL_BUSY');
    error.code = 'LOVABLE_DEPLOY_APPROVAL_BUSY';
    throw error;
  }
  if (lease.claimed) await completeContinuityStep({ taskId: ticket.taskId, idempotencyKey: 'deploy-approval', leaseToken: lease.leaseToken, outputDigest: ticket.mcpApprovalId });
  await approveMcpWriteApproval(ticket.mcpApprovalId, { humanDecision: true });
  const next = { ...ticket, status: 'approved', approvedAt: nowIso() };
  await chrome.storage.session.set({ [key]: next });
  await patchChangeTransaction(ticket.transactionId, { status: 'deploy_approved', deployment: { status: 'approved', verificationRequired: false } });
  return Object.freeze({ ticketId: ticket.id, transactionId: ticket.transactionId, taskId: ticket.taskId, status: 'approved', humanDecision: true, automaticDeploy: false });
}

async function verifySuccessfulDeployment(ticket, deploymentResult, operationId = '') {
  const server = await getMcpServer(ticket.serverId);
  const observed = await observeProject(server, ticket.projectId, ticket.taskId);
  const liveUrl = deploymentResult.liveUrl || observed.observation.liveUrl;
  const commitMatches = !ticket.expectedCommitSha || observed.observation.latestCommitSha === ticket.expectedCommitSha;
  const verified = Boolean(liveUrl) && commitMatches;
  const lease = await claimContinuityStep({ taskId: ticket.taskId, idempotencyKey: 'deploy-verify', workerId: 'lovable-deployment-v100', leaseMs: 90000, inputDigest: operationId });
  if (lease.claimed) {
    await completeContinuityStep({ taskId: ticket.taskId, idempotencyKey: 'deploy-verify', leaseToken: lease.leaseToken, operationId, outputDigest: await sha256Text(JSON.stringify({ verified, liveUrl, observedCommitSha: observed.observation.latestCommitSha })) });
  }
  return Object.freeze({
    verified,
    liveUrl,
    observedCommitSha: observed.observation.latestCommitSha,
    expectedCommitSha: ticket.expectedCommitSha,
    projectMatches: observed.observation.projectMatches,
    verificationSource: 'mcp:get_project',
    automaticRetry: false
  });
}

async function run(payload = {}) {
  const id = text(payload?.ticketId, 180);
  const { key, ticket } = await loadTicket(id, ['approved']);
  const inputDigest = await sha256Text(JSON.stringify({ project_id: ticket.projectId, expectedCommitSha: ticket.expectedCommitSha }));
  const lease = await claimContinuityStep({ taskId: ticket.taskId, idempotencyKey: 'deploy-write', workerId: 'lovable-deployment-v100', leaseMs: 180000, inputDigest });
  if (!lease.claimed) {
    const error = new Error(lease.replay ? 'LOVABLE_DEPLOY_WRITE_ALREADY_COMPLETED' : 'LOVABLE_DEPLOY_WRITE_BUSY');
    error.code = lease.replay ? 'LOVABLE_DEPLOY_WRITE_ALREADY_COMPLETED' : 'LOVABLE_DEPLOY_WRITE_BUSY';
    throw error;
  }

  try {
    const response = await client.callTool(ticket.serverId, LOVABLE_DEPLOY_TOOL, { project_id: ticket.projectId }, {
      writeApprovalId: ticket.mcpApprovalId,
      origin: 'deployment',
      taskId: ticket.taskId,
      timeoutMs: 150000
    });
    const deploymentResult = deploymentResultFromMcp(response, ticket.projectId);
    if (deploymentResult.projectMatches !== true) {
      const error = new Error('LOVABLE_DEPLOY_RESULT_PROJECT_MISMATCH');
      error.code = 'LOVABLE_DEPLOY_RESULT_PROJECT_MISMATCH';
      throw error;
    }
    await completeContinuityStep({ taskId: ticket.taskId, idempotencyKey: 'deploy-write', leaseToken: lease.leaseToken, operationId: response.operationId, outputDigest: await sha256Text(JSON.stringify(deploymentFingerprint({ ...ticket, status: 'deployed', liveUrl: deploymentResult.liveUrl }))) });
    const verification = await verifySuccessfulDeployment(ticket, deploymentResult, response.operationId);
    const next = { ...ticket, status: verification.verified ? 'verified' : 'deployed_unverified', used: true, operationId: response.operationId, liveUrl: verification.liveUrl || deploymentResult.liveUrl, usedAt: nowIso() };
    await chrome.storage.session.set({ [key]: next });
    await patchChangeTransaction(ticket.transactionId, {
      status: verification.verified ? 'completed' : 'verification_required',
      links: { operationIds: [response.operationId] },
      deployment: {
        provider: 'lovable', transport: 'mcp', serverId: ticket.serverId, projectId: ticket.projectId, taskId: ticket.taskId,
        ticketId: ticket.id, mcpApprovalId: ticket.mcpApprovalId, expectedCommitSha: ticket.expectedCommitSha, operationId: response.operationId,
        status: verification.verified ? 'verified' : 'deployed_unverified', liveUrl: verification.liveUrl || deploymentResult.liveUrl,
        verified: verification.verified, verificationRequired: !verification.verified
      }
    });
    return Object.freeze({
      schema: LOVABLE_DEPLOYMENT_SCHEMA,
      build: LOVABLE_DEPLOYMENT_BUILD,
      transactionId: ticket.transactionId,
      taskId: ticket.taskId,
      operationId: response.operationId,
      status: verification.verified ? 'verified' : 'deployed_unverified',
      liveUrl: verification.liveUrl || deploymentResult.liveUrl,
      providerStatus: deploymentResult.providerStatus,
      verification,
      automaticRetry: false,
      rawMcpResultPersisted: false
    });
  } catch (error) {
    const classification = deploymentOutcomeClassification(error);
    await failContinuityStep({
      taskId: ticket.taskId,
      idempotencyKey: 'deploy-write',
      leaseToken: lease.leaseToken,
      errorCode: classification.code,
      outcomeUnknown: classification.verificationRequired
    }).catch(() => null);
    const next = { ...ticket, status: classification.verificationRequired ? 'verification_required' : 'failed', operationId: text(error?.operationId, 180), used: classification.verificationRequired !== true, lastErrorCode: classification.code };
    await chrome.storage.session.set({ [key]: next });
    await patchChangeTransaction(ticket.transactionId, {
      status: classification.verificationRequired ? 'verification_required' : 'failed',
      links: error?.operationId ? { operationIds: [text(error.operationId, 180)] } : {},
      deployment: { status: next.status, operationId: next.operationId, verificationRequired: classification.verificationRequired, verified: false },
      lastError: { code: classification.code }
    }).catch(() => null);
    error.code = classification.code;
    error.verificationRequired = classification.verificationRequired;
    error.automaticRetry = false;
    throw error;
  }
}

async function verify(payload = {}) {
  const id = text(payload?.ticketId, 180);
  const { ticket } = await loadTicket(id, ['verification_required', 'deployed_unverified']);
  const server = await getMcpServer(ticket.serverId);
  const observed = await observeProject(server, ticket.projectId, ticket.taskId);
  const commitMatches = !ticket.expectedCommitSha || observed.observation.latestCommitSha === ticket.expectedCommitSha;
  const liveObserved = Boolean(observed.observation.liveUrl);
  const attributable = false;
  await patchChangeTransaction(ticket.transactionId, {
    status: 'verification_required',
    deployment: { status: 'verification_required', liveUrl: observed.observation.liveUrl, verified: false, verificationRequired: true }
  }).catch(() => null);
  return Object.freeze({
    transactionId: ticket.transactionId,
    ticketId: ticket.id,
    taskId: ticket.taskId,
    verified: false,
    attributable,
    liveObserved,
    liveUrl: observed.observation.liveUrl,
    expectedCommitSha: ticket.expectedCommitSha,
    observedCommitSha: observed.observation.latestCommitSha,
    commitMatches,
    reason: 'MCP get_project does not expose a deployment-version identifier sufficient to attribute an ambiguous deploy safely.',
    automaticRetryAllowed: false,
    manualProviderInspectionRequired: true
  });
}

async function status(payload = {}) {
  const projectId = payload?.projectId ? normalizeLovableProjectId(payload.projectId) : '';
  const selected = selectOfficialLovableMcpServer(await listMcpServers());
  const server = selected ? await getMcpServer(selected.id) : null;
  const permission = server ? await hostPermission(server) : { origin: 'https://mcp.lovable.dev/*', granted: false };
  const policies = server && projectId ? validateLovableDeployPolicies(server, projectId) : null;
  return Object.freeze({
    schema: LOVABLE_DEPLOYMENT_SCHEMA,
    build: LOVABLE_DEPLOYMENT_BUILD,
    provider: 'lovable',
    transport: 'mcp',
    endpoint: LOVABLE_MCP_ENDPOINT,
    officialMcpServerConfigured: Boolean(server),
    server: server ? Object.freeze({ id: server.id, name: server.name, trust: server.trust, authMode: server.auth?.mode || 'none' }) : null,
    hostPermission: permission,
    projectScope: policies,
    deployTool: LOVABLE_DEPLOY_TOOL,
    projectReadTool: LOVABLE_PROJECT_TOOL,
    deployPolicy: 'ALWAYS_ASK',
    automaticDeployAfterMutation: false,
    automaticRetry: false,
    rollbackSupported: false,
    rollbackReason: 'Official Lovable MCP currently exposes deploy_project but no rollback/unpublish tool in the Build100 provider contract.',
    redeployRequiresNewPrepareAndHumanApproval: true,
    oauthCredentialsPersisted: false,
    directPrivateRestPublishEndpointUsed: false
  });
}

async function handle(action, payload = {}) {
  const op = text(action, 80).toLowerCase();
  if (op === 'status') return status(payload);
  if (op === 'configure_scope') return configureScope(payload);
  if (op === 'preflight') return performPreflight(payload);
  if (op === 'prepare') return prepare(payload);
  if (op === 'approve') return approve(payload);
  if (op === 'run') return run(payload);
  if (op === 'verify') return verify(payload);
  if (op === 'rollback') {
    const error = new Error('LOVABLE_DEPLOY_ROLLBACK_UNAVAILABLE');
    error.code = 'LOVABLE_DEPLOY_ROLLBACK_UNAVAILABLE';
    throw error;
  }
  throw Object.assign(new Error('LOVABLE_DEPLOY_ACTION_INVALID'), { code: 'LOVABLE_DEPLOY_ACTION_INVALID' });
}

export function installLovableDeploymentRuntime() {
  if (globalThis.__LD100_LOVABLE_DEPLOYMENT_RUNTIME__) return;
  globalThis.__LD100_LOVABLE_DEPLOYMENT_RUNTIME__ = true;
  chrome.runtime.onConnect.addListener(port => {
    if (port.name !== PORT_NAME) return;
    const listener = async message => {
      const id = text(message?.id, 180);
      try {
        const data = await handle(message?.action || 'status', message?.payload || {});
        port.postMessage({ id, ok: true, data });
      } catch (error) {
        try {
          port.postMessage({
            id,
            ok: false,
            error: error?.message || String(error),
            code: error?.code || 'LOVABLE_DEPLOY_FAILED',
            verificationRequired: error?.verificationRequired === true,
            automaticRetry: false,
            origin: error?.origin || ''
          });
        } catch (_) {}
      }
    };
    port.onMessage.addListener(listener);
  });
  globalThis.LovableDecrypterLovableDeploymentRuntime = Object.freeze({
    build: LOVABLE_DEPLOYMENT_BUILD,
    schema: LOVABLE_DEPLOYMENT_SCHEMA,
    port: PORT_NAME,
    provider: 'lovable',
    transport: 'mcp',
    officialEndpoint: LOVABLE_MCP_ENDPOINT,
    deployTool: LOVABLE_DEPLOY_TOOL,
    deployAlwaysAsk: true,
    automaticDeployAfterMutation: false,
    automaticRetry: false,
    privateRestPublishEndpointUsed: false,
    rollbackSupported: false
  });
}
