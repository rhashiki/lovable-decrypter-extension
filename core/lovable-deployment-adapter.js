import { normalizeMcpEndpoint } from './mcp-protocol.js';

export const LOVABLE_DEPLOYMENT_SCHEMA = 'ld-lovable-deployment/1';
export const LOVABLE_DEPLOYMENT_BUILD = 100;
export const LOVABLE_MCP_ENDPOINT = 'https://mcp.lovable.dev/';
export const LOVABLE_DEPLOY_TOOL = 'deploy_project';
export const LOVABLE_PROJECT_TOOL = 'get_project';
export const LOVABLE_DEPLOYMENT_TICKET_TTL_MS = 5 * 60 * 1000;

const text = (value, max = 1200) => String(value ?? '').trim().slice(0, max);

export function normalizeLovableProjectId(value = '') {
  const id = text(value, 180);
  if (!id || !/^[a-z0-9-]{6,180}$/i.test(id)) {
    const error = new Error('LOVABLE_DEPLOY_PROJECT_ID_INVALID');
    error.code = 'LOVABLE_DEPLOY_PROJECT_ID_INVALID';
    throw error;
  }
  return id;
}

export function isOfficialLovableMcpEndpoint(value = '') {
  try {
    return normalizeMcpEndpoint(value) === LOVABLE_MCP_ENDPOINT;
  } catch (_) {
    return false;
  }
}

export function selectOfficialLovableMcpServer(servers = []) {
  const matches = (Array.isArray(servers) ? servers : []).filter(server => isOfficialLovableMcpEndpoint(server?.endpoint));
  if (!matches.length) return null;
  const approved = matches.find(server => server?.trust === 'approved');
  return structuredClone(approved || matches[0]);
}

export function validateLovableDeployPolicies(server = {}, projectId = '') {
  const id = normalizeLovableProjectId(projectId);
  const read = server?.toolPolicies?.[LOVABLE_PROJECT_TOOL];
  const write = server?.toolPolicies?.[LOVABLE_DEPLOY_TOOL];
  const expectedConstraint = rule => String(rule?.constraints?.project_id?.equals || '') === id;
  const allowedKeysOk = rule => {
    const keys = Array.isArray(rule?.allowedArgumentKeys) ? rule.allowedArgumentKeys : [];
    return keys.length === 1 && keys[0] === 'project_id';
  };
  const readReady = read?.enabled === true && read?.mode === 'read' && allowedKeysOk(read) && expectedConstraint(read);
  const writeReady = write?.enabled === true && write?.mode === 'write' && allowedKeysOk(write) && expectedConstraint(write);
  return Object.freeze({
    readReady,
    writeReady,
    ready: readReady && writeReady,
    fixedProjectScope: readReady && writeReady,
    projectId: id,
    requiredTools: Object.freeze([LOVABLE_PROJECT_TOOL, LOVABLE_DEPLOY_TOOL])
  });
}

function parseJsonText(value = '') {
  const source = String(value || '').trim();
  if (!source || (!source.startsWith('{') && !source.startsWith('['))) return null;
  try { return JSON.parse(source); } catch (_) { return null; }
}

function collectObjects(value, out = [], depth = 0) {
  if (value == null || depth > 8) return out;
  if (Array.isArray(value)) {
    for (const item of value.slice(0, 80)) collectObjects(item, out, depth + 1);
    return out;
  }
  if (typeof value !== 'object') return out;
  out.push(value);
  for (const item of Object.values(value).slice(0, 80)) collectObjects(item, out, depth + 1);
  return out;
}

function toolPayload(result = {}) {
  const raw = result?.result ?? result ?? {};
  if (raw?.structuredContent && typeof raw.structuredContent === 'object') return raw.structuredContent;
  for (const item of Array.isArray(raw?.content) ? raw.content : []) {
    if (item?.type !== 'text' || typeof item?.text !== 'string') continue;
    const parsed = parseJsonText(item.text);
    if (parsed && typeof parsed === 'object') return parsed;
  }
  return raw && typeof raw === 'object' ? raw : {};
}

function findStringByKeys(value, keys = []) {
  const wanted = new Set(keys.map(key => String(key).toLowerCase()));
  for (const object of collectObjects(value)) {
    for (const [key, item] of Object.entries(object)) {
      if (!wanted.has(String(key).toLowerCase()) || typeof item !== 'string') continue;
      const found = text(item, 3000);
      if (found) return found;
    }
  }
  return '';
}

function validCommit(value = '') {
  const sha = text(value, 128).toLowerCase();
  return /^[0-9a-f]{7,64}$/.test(sha) ? sha : '';
}

export function safeLiveUrl(value = '') {
  const source = text(value, 3000);
  if (!source) return '';
  try {
    const url = new URL(source);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:') return '';
    if (host !== 'lovable.app' && !host.endsWith('.lovable.app')) return '';
    url.username = '';
    url.password = '';
    url.hash = '';
    return url.toString();
  } catch (_) {
    return '';
  }
}

export function projectObservationFromMcp(result = {}, expectedProjectId = '') {
  const payload = toolPayload(result);
  const projectId = text(findStringByKeys(payload, ['project_id', 'projectId', 'id']), 180);
  const liveUrl = safeLiveUrl(findStringByKeys(payload, ['live_url', 'liveUrl', 'published_url', 'publishedUrl', 'deployment_url', 'deploymentUrl', 'url']));
  const previewUrl = text(findStringByKeys(payload, ['preview_url', 'previewUrl']), 3000);
  const latestCommitSha = validCommit(findStringByKeys(payload, ['latest_commit_sha', 'latestCommitSha', 'commit_sha', 'commitSha', 'head_sha', 'headSha']));
  const expected = expectedProjectId ? normalizeLovableProjectId(expectedProjectId) : '';
  return Object.freeze({
    projectId,
    projectMatches: !expected || !projectId || projectId === expected,
    latestCommitSha,
    liveUrl,
    previewUrl: /^https:\/\//i.test(previewUrl) ? previewUrl : '',
    rawResultPersisted: false
  });
}

export function deploymentResultFromMcp(result = {}, expectedProjectId = '') {
  const observation = projectObservationFromMcp(result, expectedProjectId);
  const payload = toolPayload(result);
  const directLive = safeLiveUrl(findStringByKeys(payload, ['live_url', 'liveUrl', 'url', 'published_url', 'publishedUrl', 'deployment_url', 'deploymentUrl']));
  return Object.freeze({
    ...observation,
    liveUrl: directLive || observation.liveUrl,
    providerStatus: text(findStringByKeys(payload, ['status', 'deployment_status', 'deploymentStatus']), 80),
    rawResultPersisted: false
  });
}

export function deploymentOutcomeClassification(error = null) {
  if (!error) return Object.freeze({ definitive: true, verificationRequired: false, code: 'OK' });
  const code = text(error?.code, 180) || 'LOVABLE_DEPLOY_FAILED';
  const remote = `${code} ${text(error?.message, 1200)} ${JSON.stringify(error?.remoteData || {})}`.toLowerCase();
  if (remote.includes('security_critical_findings')) {
    return Object.freeze({ definitive: true, verificationRequired: false, code: 'LOVABLE_DEPLOY_SECURITY_BLOCKED' });
  }
  const beforeNetwork = new Set([
    'MCP_SERVER_NOT_FOUND','MCP_SERVER_BLOCKED','MCP_SERVER_NOT_TRUSTED','MCP_TOOL_NOT_ALLOWLISTED',
    'MCP_SCOPE_LOCK_ARGUMENT_REJECTED','MCP_SCOPE_LOCK_VALUE_REJECTED','MCP_SCOPE_LOCK_PREFIX_REJECTED',
    'MCP_WRITE_APPROVAL_REQUIRED','MCP_APPROVAL_EXPIRED','MCP_APPROVAL_BINDING_MISMATCH','MCP_AUTH_REQUIRED',
    'MCP_AUTH_ISSUER_MISMATCH','MCP_HOST_PERMISSION_REQUIRED'
  ]);
  if (beforeNetwork.has(code)) return Object.freeze({ definitive: true, verificationRequired: false, code });
  return Object.freeze({ definitive: false, verificationRequired: true, code: 'LOVABLE_DEPLOY_OUTCOME_AMBIGUOUS' });
}

export function deploymentFingerprint(value = {}) {
  return Object.freeze({
    schema: LOVABLE_DEPLOYMENT_SCHEMA,
    provider: 'lovable',
    transport: 'mcp',
    endpoint: LOVABLE_MCP_ENDPOINT,
    tool: LOVABLE_DEPLOY_TOOL,
    projectId: normalizeLovableProjectId(value?.projectId),
    transactionId: text(value?.transactionId, 180),
    taskId: text(value?.taskId, 180),
    serverId: text(value?.serverId, 180),
    expectedCommitSha: validCommit(value?.expectedCommitSha),
    liveUrl: safeLiveUrl(value?.liveUrl),
    status: text(value?.status, 80),
    verificationRequired: value?.verificationRequired === true,
    automaticRetry: false
  });
}
