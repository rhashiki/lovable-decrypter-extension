import { getSettings } from '../storage/settings-store.js';
import { GitAdapter } from '../github/git-adapter.js';
import { listChangeTransactions } from '../core/change-transactions.js';
import {
  LOVABLE_DEPLOYMENT_SCHEMA,
  LOVABLE_DEPLOYMENT_BUILD,
  LOVABLE_DEPLOYMENT_TRANSPORT,
  LOVABLE_DEPLOYMENT_TICKET_PREFIX,
  LOVABLE_DEPLOYMENT_RECEIPTS_KEY,
  sanitizeDeploymentTransport,
  deploymentPreflightFingerprint,
  publicDeploymentReceipt,
  deploymentSafetyContract
} from '../core/lovable-deployment-adapter.js';

const PORT_NAME = 'ld2-lovable-deployment';
const TICKET_TTL_MS = 8 * 60 * 1000;
const MAX_RECEIPTS = 40;
const TERMINAL_TX = new Set(['completed', 'reverted', 'cancelled', 'stopped']);
const text = (value, max = 1200) => String(value ?? '').trim().slice(0, max);
const projectContextKey = projectId => `ld2_project_runtime_${text(projectId, 80).replace(/[^a-z0-9-]/gi, '')}`;
const ticketKey = id => `${LOVABLE_DEPLOYMENT_TICKET_PREFIX}${text(id, 180).replace(/[^a-z0-9-]/gi, '')}`;

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value || '')));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function transport() {
  const raw = globalThis[LOVABLE_DEPLOYMENT_TRANSPORT];
  return raw && typeof raw === 'object' ? raw : null;
}

async function loadProjectContext(projectId) {
  const data = await chrome.storage.session.get(projectContextKey(projectId));
  return data[projectContextKey(projectId)] || null;
}

function githubConfig(settings, projectId) {
  const mapping = projectId ? settings?.projectMappings?.[projectId] || null : null;
  return { mapping, config: { ...(settings?.github || {}), ...(mapping || {}) } };
}

async function currentGit(settings, projectId) {
  const { mapping, config } = githubConfig(settings, projectId);
  const owner = text(config?.owner, 180);
  const repo = text(config?.repo, 220);
  const branch = text(config?.branch || 'main', 220) || 'main';
  if (!owner || !repo) return { mapped: false, reachable: false, owner, repo, branch, headSha: '', mapping };
  try {
    const adapter = new GitAdapter(config);
    const ref = await adapter.getRef(branch);
    return {
      mapped: Boolean(mapping?.owner && mapping?.repo),
      reachable: Boolean(ref?.object?.sha),
      owner,
      repo,
      branch,
      headSha: text(ref?.object?.sha, 128).toLowerCase(),
      mapping
    };
  } catch (error) {
    return { mapped: Boolean(mapping?.owner && mapping?.repo), reachable: false, owner, repo, branch, headSha: '', mapping, errorCode: 'GITHUB_UNREACHABLE' };
  }
}

async function transactionState(projectId) {
  const rows = await listChangeTransactions({ projectId, limit: 80 });
  const active = rows.filter(row => !TERMINAL_TX.has(text(row?.status, 80).toLowerCase()));
  const ambiguous = active.filter(row => /verification|required|ambiguous/i.test(text(row?.status, 80)));
  return {
    total: rows.length,
    activeCount: active.length,
    ambiguousCount: ambiguous.length,
    active: active.slice(0, 12).map(row => ({ id: text(row?.id, 180), status: text(row?.status, 80), updatedAt: text(row?.updatedAt, 80) }))
  };
}

function gitSyncMatches(context, git) {
  const observed = context?.gitSync || {};
  if (!observed?.connected) return { observable: false, matches: null };
  const expectedFullName = git.owner && git.repo ? `${git.owner}/${git.repo}`.toLowerCase() : '';
  const observedFullName = text(observed.fullName || `${observed.owner || ''}/${observed.repo || ''}`, 420).toLowerCase();
  const expectedBranch = text(git.branch, 220).toLowerCase();
  const observedBranch = text(observed.branch, 220).toLowerCase();
  return {
    observable: true,
    matches: Boolean(expectedFullName && observedFullName === expectedFullName && (!observedBranch || observedBranch === expectedBranch)),
    observedFullName,
    observedBranch
  };
}

async function computePreflight(projectId) {
  const pid = text(projectId, 160);
  if (!pid) throw Object.assign(new Error('LOVABLE_DEPLOY_PROJECT_REQUIRED'), { code: 'LOVABLE_DEPLOY_PROJECT_REQUIRED' });
  const settings = await getSettings();
  const [context, git, tx] = await Promise.all([
    loadProjectContext(pid),
    currentGit(settings, pid),
    transactionState(pid)
  ]);
  const rawTransport = transport();
  const transportInfo = sanitizeDeploymentTransport(rawTransport || {});
  const blockers = [];

  if (!context?.detected || text(context?.projectId, 160) !== pid) blockers.push('LOVABLE_PROJECT_CONTEXT_MISMATCH');
  if (!git.mapped) blockers.push('GITHUB_MAPPING_REQUIRED');
  if (!git.reachable || !git.headSha) blockers.push('GITHUB_HEAD_UNAVAILABLE');
  if (tx.activeCount) blockers.push(tx.ambiguousCount ? 'CHANGE_TRANSACTION_VERIFICATION_REQUIRED' : 'CHANGE_TRANSACTION_ACTIVE');

  const sync = gitSyncMatches(context, git);
  if (sync.observable && sync.matches !== true) blockers.push('LOVABLE_GITSYNC_MAPPING_MISMATCH');
  if (!transportInfo.available) blockers.push('LOVABLE_DEPLOY_TRANSPORT_UNAVAILABLE');
  else if (!transportInfo.homologated) blockers.push('LOVABLE_DEPLOY_TRANSPORT_NOT_HOMOLOGATED');
  else if (!transportInfo.capabilities.publish || !transportInfo.capabilities.verify) blockers.push('LOVABLE_DEPLOY_TRANSPORT_INCOMPLETE');

  const fingerprintData = deploymentPreflightFingerprint({
    projectId: pid,
    transportId: transportInfo.id,
    transportHomologated: transportInfo.homologated,
    git,
    lovable: {
      detected: Boolean(context?.detected),
      contextProjectId: context?.projectId,
      gitSyncFullName: context?.gitSync?.fullName,
      gitSyncBranch: context?.gitSync?.branch,
      sessionAvailable: Boolean(context?.auth?.sessionAvailable)
    },
    blockers,
    activeTransactionCount: tx.activeCount
  });

  return Object.freeze({
    schema: LOVABLE_DEPLOYMENT_SCHEMA,
    build: LOVABLE_DEPLOYMENT_BUILD,
    projectId: pid,
    collectedAt: new Date().toISOString(),
    ready: blockers.length === 0,
    blockers: Object.freeze(blockers),
    transport: transportInfo,
    git: Object.freeze({ mapped: git.mapped, reachable: git.reachable, owner: git.owner, repo: git.repo, branch: git.branch, headSha: git.headSha }),
    lovable: Object.freeze({
      detected: Boolean(context?.detected),
      contextProjectId: text(context?.projectId, 160),
      sessionAvailable: Boolean(context?.auth?.sessionAvailable),
      previewAvailable: Boolean(context?.preview?.available),
      previewUrl: text(context?.preview?.url, 1200),
      gitSync: Object.freeze({ observable: sync.observable, matches: sync.matches, fullName: text(context?.gitSync?.fullName, 420), branch: text(context?.gitSync?.branch, 220) })
    }),
    transactions: Object.freeze(tx),
    fingerprintData,
    safety: deploymentSafetyContract()
  });
}

async function loadReceipts() {
  const data = await chrome.storage.local.get(LOVABLE_DEPLOYMENT_RECEIPTS_KEY);
  return Array.isArray(data[LOVABLE_DEPLOYMENT_RECEIPTS_KEY]) ? data[LOVABLE_DEPLOYMENT_RECEIPTS_KEY] : [];
}

async function saveReceipt(raw) {
  const safe = publicDeploymentReceipt(raw);
  const rows = await loadReceipts();
  const index = rows.findIndex(row => row?.id === safe.id);
  if (index >= 0) rows[index] = safe;
  else rows.unshift(safe);
  await chrome.storage.local.set({ [LOVABLE_DEPLOYMENT_RECEIPTS_KEY]: rows.slice(0, MAX_RECEIPTS) });
  return safe;
}

async function prepare(projectId) {
  const preflight = await computePreflight(projectId);
  if (!preflight.ready) {
    const error = new Error(`LOVABLE_DEPLOY_PREFLIGHT_BLOCKED:${preflight.blockers.join(',')}`);
    error.code = 'LOVABLE_DEPLOY_PREFLIGHT_BLOCKED';
    error.preflight = preflight;
    throw error;
  }
  const id = crypto.randomUUID();
  const fingerprint = await sha256(JSON.stringify(preflight.fingerprintData));
  const ticket = {
    schema: 'ld-lovable-deployment-ticket/1',
    id,
    projectId: preflight.projectId,
    transportId: preflight.transport.id,
    headSha: preflight.git.headSha,
    fingerprint,
    used: false,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + TICKET_TTL_MS).toISOString()
  };
  await chrome.storage.session.set({ [ticketKey(id)]: ticket });
  return Object.freeze({ ticket: Object.freeze({ id, projectId: ticket.projectId, transportId: ticket.transportId, headSha: ticket.headSha, expiresAt: ticket.expiresAt }), preflight });
}

async function getTicket(ticketId) {
  const key = ticketKey(ticketId);
  const data = await chrome.storage.session.get(key);
  const ticket = data[key];
  if (!ticket || ticket.id !== ticketId) throw Object.assign(new Error('LOVABLE_DEPLOY_TICKET_NOT_FOUND'), { code: 'LOVABLE_DEPLOY_TICKET_NOT_FOUND' });
  if (ticket.used === true) throw Object.assign(new Error('LOVABLE_DEPLOY_TICKET_ALREADY_USED'), { code: 'LOVABLE_DEPLOY_TICKET_ALREADY_USED' });
  if (Date.parse(ticket.expiresAt || '') <= Date.now()) {
    await chrome.storage.session.remove(key);
    throw Object.assign(new Error('LOVABLE_DEPLOY_TICKET_EXPIRED'), { code: 'LOVABLE_DEPLOY_TICKET_EXPIRED' });
  }
  return { key, ticket };
}

function transportForTicket(ticket) {
  const raw = transport();
  const info = sanitizeDeploymentTransport(raw || {});
  if (!raw || !info.available) throw Object.assign(new Error('LOVABLE_DEPLOY_TRANSPORT_UNAVAILABLE'), { code: 'LOVABLE_DEPLOY_TRANSPORT_UNAVAILABLE' });
  if (!info.homologated) throw Object.assign(new Error('LOVABLE_DEPLOY_TRANSPORT_NOT_HOMOLOGATED'), { code: 'LOVABLE_DEPLOY_TRANSPORT_NOT_HOMOLOGATED' });
  if (info.id !== ticket.transportId) throw Object.assign(new Error('LOVABLE_DEPLOY_TRANSPORT_CHANGED'), { code: 'LOVABLE_DEPLOY_TRANSPORT_CHANGED' });
  return { raw, info };
}

async function publish(payload = {}) {
  if (payload?.humanDecision !== true) throw Object.assign(new Error('LOVABLE_DEPLOY_HUMAN_CONFIRMATION_REQUIRED'), { code: 'LOVABLE_DEPLOY_HUMAN_CONFIRMATION_REQUIRED' });
  const ticketId = text(payload?.ticketId, 180);
  const { key, ticket } = await getTicket(ticketId);
  const preflight = await computePreflight(ticket.projectId);
  if (!preflight.ready) throw Object.assign(new Error('LOVABLE_DEPLOY_PREFLIGHT_STALE'), { code: 'LOVABLE_DEPLOY_PREFLIGHT_STALE', preflight });
  if (preflight.git.headSha !== ticket.headSha) throw Object.assign(new Error('LOVABLE_DEPLOY_HEAD_CHANGED'), { code: 'LOVABLE_DEPLOY_HEAD_CHANGED' });
  const fingerprint = await sha256(JSON.stringify(preflight.fingerprintData));
  if (fingerprint !== ticket.fingerprint) throw Object.assign(new Error('LOVABLE_DEPLOY_PREFLIGHT_CHANGED'), { code: 'LOVABLE_DEPLOY_PREFLIGHT_CHANGED' });
  const { raw, info } = transportForTicket(ticket);
  if (typeof raw.publish !== 'function' || typeof raw.verify !== 'function') throw Object.assign(new Error('LOVABLE_DEPLOY_TRANSPORT_INCOMPLETE'), { code: 'LOVABLE_DEPLOY_TRANSPORT_INCOMPLETE' });

  await chrome.storage.session.set({ [key]: { ...ticket, used: true, usedAt: new Date().toISOString() } });
  const receiptId = crypto.randomUUID();
  let receipt = await saveReceipt({
    id: receiptId,
    projectId: ticket.projectId,
    transportId: info.id,
    status: 'publishing',
    sourceHeadSha: ticket.headSha,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    rollbackAvailable: info.capabilities.rollback,
    redeployAvailable: info.capabilities.redeploy,
    verification: { verified: false, observable: false, reason: 'not_verified_yet' }
  });

  let providerResult;
  try {
    providerResult = await raw.publish({ projectId: ticket.projectId, sourceHeadSha: ticket.headSha, humanDecision: true });
  } catch (error) {
    receipt = await saveReceipt({ ...receipt, status: 'verification_required', updatedAt: new Date().toISOString(), verification: { verified: false, observable: false, reason: 'publish_outcome_unknown' } });
    const wrapped = new Error('LOVABLE_DEPLOY_OUTCOME_AMBIGUOUS');
    wrapped.code = 'LOVABLE_DEPLOY_OUTCOME_AMBIGUOUS';
    wrapped.verificationRequired = true;
    wrapped.receipt = receipt;
    throw wrapped;
  }

  receipt = await saveReceipt({
    ...receipt,
    status: 'verifying',
    deploymentId: text(providerResult?.deploymentId || providerResult?.id, 220),
    deploymentUrl: text(providerResult?.deploymentUrl || providerResult?.url, 1200),
    updatedAt: new Date().toISOString()
  });
  return verifyReceipt(receipt.id, { providerResult, allowTransportLookup: true });
}

async function verifyReceipt(receiptId, options = {}) {
  const rows = await loadReceipts();
  const receipt = rows.find(row => row?.id === receiptId);
  if (!receipt) throw Object.assign(new Error('LOVABLE_DEPLOY_RECEIPT_NOT_FOUND'), { code: 'LOVABLE_DEPLOY_RECEIPT_NOT_FOUND' });
  const raw = transport();
  const info = sanitizeDeploymentTransport(raw || {});
  if (!raw || !info.available || info.id !== receipt.transportId || typeof raw.verify !== 'function') {
    return saveReceipt({ ...receipt, status: 'verification_required', updatedAt: new Date().toISOString(), verification: { verified: false, observable: false, reason: 'verification_transport_unavailable' } });
  }
  let verification;
  try {
    verification = await raw.verify({
      projectId: receipt.projectId,
      deploymentId: receipt.deploymentId,
      deploymentUrl: receipt.deploymentUrl,
      sourceHeadSha: receipt.sourceHeadSha,
      providerResult: options?.providerResult || null
    });
  } catch (_) {
    verification = { verified: false, observable: false, reason: 'verification_failed' };
  }
  return saveReceipt({
    ...receipt,
    status: verification?.verified === true ? 'published_verified' : 'verification_required',
    updatedAt: new Date().toISOString(),
    verifiedAt: verification?.verified === true ? new Date().toISOString() : '',
    verification: {
      verified: verification?.verified === true,
      observable: verification?.observable === true,
      reason: text(verification?.reason || (verification?.verified ? 'verified' : 'not_verified'), 180)
    }
  });
}

async function rollback(payload = {}) {
  if (payload?.humanDecision !== true) throw Object.assign(new Error('LOVABLE_DEPLOY_ROLLBACK_HUMAN_CONFIRMATION_REQUIRED'), { code: 'LOVABLE_DEPLOY_ROLLBACK_HUMAN_CONFIRMATION_REQUIRED' });
  const receiptId = text(payload?.receiptId, 180);
  const rows = await loadReceipts();
  const receipt = rows.find(row => row?.id === receiptId);
  if (!receipt) throw Object.assign(new Error('LOVABLE_DEPLOY_RECEIPT_NOT_FOUND'), { code: 'LOVABLE_DEPLOY_RECEIPT_NOT_FOUND' });
  const raw = transport();
  const info = sanitizeDeploymentTransport(raw || {});
  if (!raw || !info.homologated || info.id !== receipt.transportId || typeof raw.rollback !== 'function') {
    throw Object.assign(new Error('LOVABLE_DEPLOY_ROLLBACK_UNAVAILABLE'), { code: 'LOVABLE_DEPLOY_ROLLBACK_UNAVAILABLE' });
  }
  const result = await raw.rollback({ projectId: receipt.projectId, deploymentId: receipt.deploymentId, humanDecision: true });
  return saveReceipt({ ...receipt, status: 'rolled_back', updatedAt: new Date().toISOString(), verification: { verified: false, observable: false, reason: 'rolled_back' }, deploymentId: text(result?.deploymentId || receipt.deploymentId, 220), deploymentUrl: text(result?.deploymentUrl || result?.url || receipt.deploymentUrl, 1200) });
}

async function redeploy(payload = {}) {
  if (payload?.humanDecision !== true) throw Object.assign(new Error('LOVABLE_REDEPLOY_HUMAN_CONFIRMATION_REQUIRED'), { code: 'LOVABLE_REDEPLOY_HUMAN_CONFIRMATION_REQUIRED' });
  const receiptId = text(payload?.receiptId, 180);
  const rows = await loadReceipts();
  const receipt = rows.find(row => row?.id === receiptId);
  if (!receipt) throw Object.assign(new Error('LOVABLE_DEPLOY_RECEIPT_NOT_FOUND'), { code: 'LOVABLE_DEPLOY_RECEIPT_NOT_FOUND' });
  const raw = transport();
  const info = sanitizeDeploymentTransport(raw || {});
  if (!raw || !info.homologated || info.id !== receipt.transportId || typeof raw.redeploy !== 'function') {
    throw Object.assign(new Error('LOVABLE_REDEPLOY_UNAVAILABLE'), { code: 'LOVABLE_REDEPLOY_UNAVAILABLE' });
  }
  const preflight = await computePreflight(receipt.projectId);
  if (!preflight.ready) throw Object.assign(new Error('LOVABLE_REDEPLOY_PREFLIGHT_BLOCKED'), { code: 'LOVABLE_REDEPLOY_PREFLIGHT_BLOCKED', preflight });
  const result = await raw.redeploy({ projectId: receipt.projectId, deploymentId: receipt.deploymentId, sourceHeadSha: preflight.git.headSha, humanDecision: true });
  const next = await saveReceipt({
    id: crypto.randomUUID(),
    projectId: receipt.projectId,
    transportId: info.id,
    status: 'verifying',
    sourceHeadSha: preflight.git.headSha,
    deploymentId: text(result?.deploymentId || result?.id, 220),
    deploymentUrl: text(result?.deploymentUrl || result?.url, 1200),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    rollbackAvailable: info.capabilities.rollback,
    redeployAvailable: info.capabilities.redeploy,
    verification: { verified: false, observable: false, reason: 'not_verified_yet' }
  });
  return verifyReceipt(next.id, { providerResult: result, allowTransportLookup: true });
}

async function status(projectId = '') {
  const info = sanitizeDeploymentTransport(transport() || {});
  const receipts = (await loadReceipts()).filter(row => !projectId || row?.projectId === projectId).slice(0, 20).map(publicDeploymentReceipt);
  return Object.freeze({
    schema: LOVABLE_DEPLOYMENT_SCHEMA,
    build: LOVABLE_DEPLOYMENT_BUILD,
    transport: info,
    safety: deploymentSafetyContract(),
    receipts: Object.freeze(receipts),
    transportRegistrationRequired: !info.available,
    currentPackageCanPublish: info.available && info.homologated && info.capabilities.publish && info.capabilities.verify
  });
}

async function handle(action, payload = {}) {
  const op = text(action, 80).toLowerCase();
  if (op === 'status') return status(text(payload?.projectId, 160));
  if (op === 'preflight') return computePreflight(text(payload?.projectId, 160));
  if (op === 'prepare') return prepare(text(payload?.projectId, 160));
  if (op === 'publish') return publish(payload);
  if (op === 'verify') return verifyReceipt(text(payload?.receiptId, 180));
  if (op === 'rollback') return rollback(payload);
  if (op === 'redeploy') return redeploy(payload);
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
        port.postMessage({ id, ok: true, data: await handle(message?.action, message?.payload || {}) });
      } catch (error) {
        try {
          port.postMessage({
            id,
            ok: false,
            error: error?.message || String(error),
            code: error?.code || 'LOVABLE_DEPLOY_FAILED',
            verificationRequired: error?.verificationRequired === true,
            preflight: error?.preflight || null,
            receipt: error?.receipt || null
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
    transportRegistry: 'explicit-only',
    undocumentedEndpointAllowed: false,
    automaticPublish: false,
    publishAfterCommit: false,
    humanConfirmationRequired: true,
    failClosed: true
  });
}
