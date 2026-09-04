'use strict';

const BUILD = 84;
const VERSION = '2.6.84';
const SCHEMA = 'ld-runtime-bus/1';
const CLIENT_PROTOCOL = 'ld-runtime-bus/1';
const BACKEND_BASE = 'https://kkzxxnfxgrouhkzyszxs.supabase.co/functions/v1';
const LICENSE_ENDPOINT = `${BACKEND_BASE}/ld-license-validate`;
const TRUST_ENDPOINT = `${BACKEND_BASE}/ld-trust-attest`;
const ACCOUNT_KEY = 'ld84_account';
const DEVICE_KEY = 'ld84_device_id';
const TRUST_KEY = 'ld84_trust';
const PROJECT_KEY = 'ld84_project_snapshot';

const MODULES = Object.freeze({
  github: { capability: 'integration.github', phase: '84.5', state: 'reattached' },
  supabase: { capability: 'integration.supabase', phase: '84.5', state: 'reattached' },
  lovable: { capability: 'project.state', phase: '84.5', state: 'reattached' },
  gemini: { capability: 'ai.gateway', phase: '84.9', state: 'preserved-source' },
  'project-state': { capability: 'project.state', phase: '84.5', state: 'reattached' },
  'git-history': { capability: 'project.history', phase: '84.5', state: 'preserved-source' },
  'context-pack': { capability: 'context.pack', phase: '84.6', state: 'preserved-source' },
  'local-agent': { capability: 'agent.local', phase: '84.9', state: 'preserved-source' },
  'scope-intelligence': { capability: 'scope.intelligence', phase: '84.6', state: 'preserved-source' },
  continuity: { capability: 'continuity.engine', phase: '84.8', state: 'preserved-source' },
  'tool-runtime': { capability: 'tools.read', phase: '84.7', state: 'preserved-source' },
  'mcp-runtime': { capability: 'mcp.core', phase: '84.7', state: 'preserved-source' },
  'agent-sandbox': { capability: 'agent.sandbox', phase: '84.9', state: 'preserved-source' },
  'smart-undo': { capability: 'recovery.undo-redo', phase: '84.8', state: 'preserved-source' },
  checkpoint: { capability: 'recovery.checkpoints', phase: '84.8', state: 'preserved-source' },
  'runtime-events': { capability: 'activity.runtime-events', phase: '84.5', state: 'preserved-source' },
  operations: { capability: 'activity.operations', phase: '84.5', state: 'preserved-source' },
  security: { capability: 'security.fail-closed', phase: '84.2', state: 'reattached' },
  updates: { capability: 'updates.center', phase: '84.5', state: 'preserved-source' },
  account: { capability: 'license.activation', phase: '84.3', state: 'reattached' },
  community: { capability: 'messaging.backend', phase: '84.5', state: 'preserved-source' },
  settings: { capability: 'account.details', phase: '84.3', state: 'reattached' }
});

const PRIVILEGED_CAPABILITIES = Object.freeze([
  'license.activation',
  'trust.attestation',
  'integration.github',
  'integration.supabase',
  'project.state'
]);

function senderAllowed(sender) {
  const url = String(sender?.url || sender?.tab?.url || '');
  if (!url) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'chrome-extension:' || parsed.hostname === 'lovable.dev' || parsed.hostname.endsWith('.lovable.dev');
  } catch {
    return false;
  }
}

function storageGet(keys) {
  return new Promise(resolve => chrome.storage.local.get(keys, value => resolve(value || {})));
}

function storageSet(value) {
  return new Promise(resolve => chrome.storage.local.set(value, () => resolve()));
}

function storageRemove(keys) {
  return new Promise(resolve => chrome.storage.local.remove(keys, () => resolve()));
}

async function deviceId() {
  const stored = await storageGet([DEVICE_KEY]);
  let value = String(stored[DEVICE_KEY] || '').trim();
  if (!value) {
    value = crypto.randomUUID();
    await storageSet({ [DEVICE_KEY]: value });
  }
  return value;
}

function safeAccount(stored) {
  const account = stored && typeof stored === 'object' ? stored : {};
  return {
    active: account.active === true,
    validatedAt: account.validatedAt || null,
    deviceBound: account.deviceBound === true,
    license: account.license || null
  };
}

async function accountStatus() {
  const stored = await storageGet([ACCOUNT_KEY]);
  return { ok: true, schema: 'ld-account-runtime/1', account: safeAccount(stored[ACCOUNT_KEY]) };
}

async function accountCredentials() {
  const stored = await storageGet([ACCOUNT_KEY, DEVICE_KEY]);
  const account = stored[ACCOUNT_KEY] && typeof stored[ACCOUNT_KEY] === 'object' ? stored[ACCOUNT_KEY] : {};
  const licenseKey = String(account.licenseKey || '').trim();
  const currentDeviceId = String(stored[DEVICE_KEY] || '').trim();
  if (account.active !== true || !licenseKey) throw new Error('ACCOUNT_NOT_ACTIVE');
  if (!currentDeviceId) throw new Error('DEVICE_REQUIRED');
  return { licenseKey, deviceId: currentDeviceId };
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(String(value || ''));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function randomNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let raw = '';
  for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function ensureTrust(force = false) {
  const stored = await storageGet([TRUST_KEY]);
  const cached = stored[TRUST_KEY] && typeof stored[TRUST_KEY] === 'object' ? stored[TRUST_KEY] : null;
  if (!force && cached?.expiresAt && Date.parse(cached.expiresAt) > Date.now() + 30000) {
    return { ok: true, cached: true, protocol: cached.protocol || CLIENT_PROTOCOL, expiresAt: cached.expiresAt };
  }

  const credentials = await accountCredentials();
  const fingerprint = await sha256Hex(`${VERSION}|${SCHEMA}|background/runtime-entry-v84.js`);
  const { response, body } = await fetchJson(TRUST_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-license-key': credentials.licenseKey,
      'x-device-id': credentials.deviceId
    },
    body: JSON.stringify({
      client_version: VERSION,
      client_protocol: CLIENT_PROTOCOL,
      client_fingerprint: fingerprint,
      nonce: randomNonce(),
      capabilities: PRIVILEGED_CAPABILITIES,
      integrity: {
        kind: 'runtime-contract',
        authority: 'background/runtime-entry-v84.js',
        critical_assets: 4
      }
    })
  });

  if (!response.ok || body?.ok !== true || !body?.trust_token || !body?.expires_at) {
    const error = new Error(String(body?.code || `TRUST_HTTP_${response.status}`));
    error.code = String(body?.code || `TRUST_HTTP_${response.status}`);
    throw error;
  }

  const trust = {
    token: String(body.trust_token),
    expiresAt: String(body.expires_at),
    protocol: String(body.client_protocol || CLIENT_PROTOCOL),
    attestedAt: new Date().toISOString()
  };
  await storageSet({ [TRUST_KEY]: trust });
  return { ok: true, cached: false, protocol: trust.protocol, expiresAt: trust.expiresAt };
}

async function accountActivate(message) {
  const licenseKey = String(message?.licenseKey || '').trim();
  const deviceLabel = String(message?.deviceLabel || 'Chrome · Lovable Decrypter').slice(0, 120);
  if (!licenseKey) return { ok: false, code: 'KEY_REQUIRED' };
  if (!licenseKey.startsWith('LD2.')) return { ok: false, code: 'KEY_INVALID_FORMAT' };

  const id = await deviceId();
  let response;
  try {
    response = await fetch(LICENSE_ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-license-key': licenseKey,
        'x-device-id': id,
        'x-device-label': deviceLabel
      },
      body: JSON.stringify({ device_id: id, device_label: deviceLabel })
    });
  } catch (error) {
    return { ok: false, code: 'LICENSE_BACKEND_UNREACHABLE', message: error?.message || String(error) };
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.valid !== true) {
    return { ok: false, code: String(body?.code || `LICENSE_HTTP_${response.status}`), message: body?.message || null };
  }

  const storedAccount = {
    active: true,
    licenseKey,
    deviceBound: body.device_bound === true,
    validatedAt: new Date().toISOString(),
    license: body.license || null
  };
  await storageSet({ [ACCOUNT_KEY]: storedAccount });
  await storageRemove([TRUST_KEY]);

  let trust = null;
  try { trust = await ensureTrust(true); } catch (error) {
    trust = { ok: false, code: error?.code || error?.message || 'TRUST_ATTEST_FAILED' };
  }

  return { ok: true, schema: 'ld-account-runtime/1', account: safeAccount(storedAccount), trust };
}

async function accountClear() {
  await storageRemove([ACCOUNT_KEY, TRUST_KEY, PROJECT_KEY]);
  return { ok: true, schema: 'ld-account-runtime/1', account: { active: false, validatedAt: null, deviceBound: false, license: null } };
}

async function authorizedBackend(endpoint, action, payload = {}) {
  await ensureTrust(false);
  const credentials = await accountCredentials();
  const { response, body } = await fetchJson(`${BACKEND_BASE}/${endpoint}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-license-key': credentials.licenseKey,
      'x-device-id': credentials.deviceId
    },
    body: JSON.stringify({ action, ...payload })
  });
  if (!response.ok || body?.ok !== true) {
    const error = new Error(String(body?.code || `${endpoint.toUpperCase().replace(/-/g, '_')}_HTTP_${response.status}`));
    error.code = String(body?.code || `HTTP_${response.status}`);
    error.details = body;
    throw error;
  }
  return body;
}

function integrationSummary(kind, data) {
  if (kind === 'github') {
    if (!data?.app_configured) return 'GitHub App ainda não está configurado no backend.';
    if (!data?.connected) return 'GitHub App disponível, mas ainda não conectado.';
    const account = data?.installation?.account_login || 'GitHub';
    const repos = Array.isArray(data?.repositories) ? data.repositories.length : 0;
    return `GitHub conectado em ${account} · ${repos} repositório(s) autorizado(s).`;
  }
  if (!data?.app_configured) return 'Supabase OAuth ainda não está configurado no backend.';
  if (!data?.connected) return 'Supabase OAuth disponível, mas ainda não conectado.';
  const projects = Array.isArray(data?.projects) ? data.projects.length : 0;
  const reauth = data?.reauthorize_required ? ' · reautorização necessária' : '';
  return `Supabase conectado · ${projects} projeto(s) autorizado(s)${reauth}.`;
}

async function integrationCommand(kind, action) {
  const endpoint = kind === 'github' ? 'ld-github-app' : 'ld-supabase-oauth';
  const capability = kind === 'github' ? 'integration.github' : 'integration.supabase';
  const status = await authorizedBackend(endpoint, 'status');

  if (action === 'open' && status?.connected !== true) {
    const connect = await authorizedBackend(endpoint, 'connect');
    return {
      ok: true,
      schema: SCHEMA,
      build: BUILD,
      module: kind,
      action,
      capability,
      state: 'reattached',
      targetPhase: '84.5',
      functionalInvocation: true,
      openUrl: String(connect?.url || ''),
      summary: `${integrationSummary(kind, status)} Fluxo de conexão aberto.`
    };
  }

  return {
    ok: true,
    schema: SCHEMA,
    build: BUILD,
    module: kind,
    action,
    capability,
    state: 'reattached',
    targetPhase: '84.5',
    functionalInvocation: true,
    summary: integrationSummary(kind, status),
    data: status
  };
}

function sanitizeProjectSnapshot(raw) {
  const value = raw && typeof raw === 'object' ? raw : {};
  const clean = (input, max = 500) => String(input ?? '').slice(0, max);
  return {
    detected: value.detected === true,
    projectId: clean(value.projectId, 120),
    workspaceId: clean(value.workspaceId, 120),
    url: clean(value.url, 1200),
    title: clean(value.title, 300),
    pathname: clean(value.pathname, 800),
    collectedAt: clean(value.collectedAt, 80) || new Date().toISOString()
  };
}

async function projectCommand(action, rawContext) {
  if (rawContext && typeof rawContext === 'object') {
    const snapshot = sanitizeProjectSnapshot(rawContext);
    await storageSet({ [PROJECT_KEY]: snapshot });
  }
  const stored = await storageGet([PROJECT_KEY]);
  const snapshot = stored[PROJECT_KEY] ? sanitizeProjectSnapshot(stored[PROJECT_KEY]) : null;
  return {
    ok: true,
    schema: SCHEMA,
    build: BUILD,
    module: 'project-state',
    action,
    capability: 'project.state',
    state: 'reattached',
    targetPhase: '84.5',
    functionalInvocation: true,
    summary: snapshot?.detected
      ? `Projeto Lovable detectado${snapshot.projectId ? ` · ${snapshot.projectId}` : ''}. Snapshot coletado somente sob demanda.`
      : 'Página Lovable detectada, mas o identificador do projeto não foi inferido desta URL.',
    data: snapshot
  };
}

async function securityCommand(action) {
  const trust = await ensureTrust(action === 'open');
  return {
    ok: true,
    schema: SCHEMA,
    build: BUILD,
    module: 'security',
    action,
    capability: 'security.fail-closed',
    state: 'reattached',
    targetPhase: '84.2',
    functionalInvocation: true,
    summary: `Trust attestation válida · protocolo ${trust.protocol} · expira em ${trust.expiresAt}.`,
    data: trust
  };
}

async function disconnectIntegration(kind) {
  const endpoint = kind === 'github' ? 'ld-github-app' : kind === 'supabase' ? 'ld-supabase-oauth' : '';
  if (!endpoint) return { ok: false, code: 'INTEGRATION_NOT_REGISTERED' };
  const result = await authorizedBackend(endpoint, 'disconnect');
  return { ok: true, schema: SCHEMA, integration: kind, disconnected: result?.disconnected === true };
}

async function responseFor(message) {
  const type = String(message?.type || '');
  if (type === 'ld84.runtime.health') {
    return {
      ok: true,
      schema: SCHEMA,
      build: BUILD,
      version: VERSION,
      authority: 'background/runtime-entry-v84.js',
      mode: 'event-driven',
      clientProtocol: CLIENT_PROTOCOL,
      activeHeavyRuntimes: 0,
      polling: false,
      globalObservers: false,
      legacyBoot: false,
      accountRuntime: true,
      trustRuntime: true,
      integrationsRuntime: true,
      projectSnapshotMode: 'on-demand'
    };
  }

  if (type === 'ld84.runtime.catalog') return { ok: true, schema: SCHEMA, build: BUILD, modules: MODULES };
  if (type === 'ld84.account.status') return accountStatus();
  if (type === 'ld84.account.activate') return accountActivate(message);
  if (type === 'ld84.account.clear') return accountClear();
  if (type === 'ld84.security.attest') return securityCommand('open');
  if (type === 'ld84.integration.disconnect') return disconnectIntegration(String(message?.integration || ''));
  if (type === 'ld84.project.snapshot') return projectCommand('status', message?.context);

  if (type === 'ld84.runtime.command') {
    const id = String(message?.module || '');
    const action = String(message?.action || 'details');
    const module = MODULES[id];
    if (!module) return { ok: false, code: 'MODULE_NOT_REGISTERED', module: id };

    try {
      if (id === 'github') return integrationCommand('github', action);
      if (id === 'supabase') return integrationCommand('supabase', action);
      if (id === 'lovable' || id === 'project-state') return projectCommand(action, message?.context);
      if (id === 'security') return securityCommand(action);
    } catch (error) {
      return {
        ok: false,
        code: error?.code || error?.message || 'FUNCTIONAL_RUNTIME_ERROR',
        message: error?.message || String(error),
        module: id
      };
    }

    const functionalInvocation = id === 'account' || id === 'settings';
    return {
      ok: true,
      schema: SCHEMA,
      build: BUILD,
      module: id,
      action,
      capability: module.capability,
      state: module.state,
      targetPhase: module.phase,
      functionalInvocation,
      message: functionalInvocation
        ? 'Conta & Licença reattached through clean Build84 account runtime.'
        : `Capacidade ${module.capability} preservada e registrada para reattachment na fase ${module.phase}.`
    };
  }

  return null;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!senderAllowed(sender)) {
    sendResponse({ ok: false, code: 'SENDER_NOT_ALLOWED' });
    return false;
  }
  Promise.resolve(responseFor(message)).then(response => {
    if (response) sendResponse(response);
  }).catch(error => sendResponse({ ok: false, code: 'RUNTIME_INTERNAL_ERROR', message: error?.message || String(error) }));
  return true;
});

Object.defineProperty(globalThis, 'LovableDecrypterRuntimeV84', {
  value: Object.freeze({ build: BUILD, version: VERSION, schema: SCHEMA, clientProtocol: CLIENT_PROTOCOL, modules: MODULES }),
  configurable: false,
  enumerable: false,
  writable: false
});
