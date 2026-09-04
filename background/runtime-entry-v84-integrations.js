'use strict';

importScripts('runtime-entry-v84.js');

const LD84_RESOURCE_BACKEND = 'https://kkzxxnfxgrouhkzyszxs.supabase.co/functions/v1';
const LD84_RESOURCE_ACCOUNT_KEY = 'ld84_account';
const LD84_RESOURCE_DEVICE_KEY = 'ld84_device_id';
const LD84_GEMINI_CONFIG_KEY = 'ld84_gemini_config';
const LD84_GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const LD84_GEMINI_DEFAULT_MODEL = 'gemini-3.7-flash';
const LD84_GEMINI_DEFAULT_ADVANCED_MODEL = 'gemini-2.5-pro';
const LD84_GEMINI_FREE_MODELS = Object.freeze([
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite'
]);

function ld84ResourceStorage(keys) {
  return new Promise(resolve => chrome.storage.local.get(keys, value => resolve(value || {})));
}

function ld84ResourceStorageSet(value) {
  return new Promise(resolve => chrome.storage.local.set(value, () => resolve()));
}

function ld84ResourceStorageRemove(keys) {
  return new Promise(resolve => chrome.storage.local.remove(keys, () => resolve()));
}

async function ld84ResourceCredentials() {
  const stored = await ld84ResourceStorage([LD84_RESOURCE_ACCOUNT_KEY, LD84_RESOURCE_DEVICE_KEY]);
  const account = stored[LD84_RESOURCE_ACCOUNT_KEY] && typeof stored[LD84_RESOURCE_ACCOUNT_KEY] === 'object' ? stored[LD84_RESOURCE_ACCOUNT_KEY] : {};
  const licenseKey = String(account.licenseKey || '').trim();
  const deviceId = String(stored[LD84_RESOURCE_DEVICE_KEY] || '').trim();
  if (account.active !== true || !licenseKey) throw new Error('ACCOUNT_NOT_ACTIVE');
  if (!deviceId) throw new Error('DEVICE_REQUIRED');
  return { licenseKey, deviceId };
}

async function ld84ResourceBackend(endpoint, action, payload = {}) {
  const credentials = await ld84ResourceCredentials();
  const response = await fetch(`${LD84_RESOURCE_BACKEND}/${endpoint}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-license-key': credentials.licenseKey,
      'x-device-id': credentials.deviceId
    },
    body: JSON.stringify({ action, ...payload })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok !== true) {
    const error = new Error(String(body?.code || `HTTP_${response.status}`));
    error.code = String(body?.code || `HTTP_${response.status}`);
    throw error;
  }
  return body;
}

function ld84NormalizeAvailable(integration, status) {
  if (integration === 'github') {
    const repositories = Array.isArray(status?.repositories) ? status.repositories : [];
    return repositories
      .map(repo => ({
        id: String(repo?.full_name || ''),
        label: String(repo?.full_name || repo?.name || ''),
        meta: String(repo?.default_branch || 'main'),
        private: repo?.private === true
      }))
      .filter(item => item.id);
  }
  const projects = Array.isArray(status?.projects) ? status.projects : [];
  return projects
    .map(project => ({
      id: String(project?.ref || ''),
      label: String(project?.name || project?.ref || ''),
      meta: [project?.ref, project?.region, project?.status].filter(Boolean).join(' · ')
    }))
    .filter(item => item.id);
}

async function ld84ResourceStatus(integration) {
  const endpoint = integration === 'github' ? 'ld-github-app' : integration === 'supabase' ? 'ld-supabase-oauth' : '';
  if (!endpoint) throw new Error('INTEGRATION_INVALID');
  const [status, selection] = await Promise.all([
    ld84ResourceBackend(endpoint, 'status'),
    ld84ResourceBackend('ld-integration-selection', 'get', { integration })
  ]);
  const available = ld84NormalizeAvailable(integration, status);
  const availableIds = new Set(available.map(item => item.id));
  const rawSelected = selection?.mode === 'all' || selection?.selected === null
    ? available.map(item => item.id)
    : (Array.isArray(selection?.selected) ? selection.selected.map(String) : []);
  const selected = rawSelected.filter(id => availableIds.has(id));
  return {
    ok: true,
    integration,
    available,
    selected,
    mode: selection?.mode === 'all' || selection?.selected === null ? 'all' : 'selected',
    manageUrl: integration === 'github' ? String(status?.installation?.manage_url || '') : '',
    connected: status?.connected === true
  };
}

async function ld84ResourceSave(integration, selectedInput) {
  const current = await ld84ResourceStatus(integration);
  const availableIds = new Set(current.available.map(item => item.id));
  const selected = [...new Set((Array.isArray(selectedInput) ? selectedInput : []).map(String))];
  if (selected.some(id => !availableIds.has(id))) throw new Error('RESOURCE_NOT_AUTHORIZED');
  const mode = selected.length === current.available.length ? 'all' : 'selected';
  const saved = await ld84ResourceBackend('ld-integration-selection', 'set', { integration, mode, selected });
  return {
    ok: true,
    integration,
    mode: saved?.mode || mode,
    selected: saved?.mode === 'all' ? current.available.map(item => item.id) : selected,
    available: current.available,
    manageUrl: current.manageUrl
  };
}

function ld84B64Url(bytes) {
  let raw = '';
  for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function ld84FromB64Url(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(String(value || '').length / 4) * 4, '=');
  const raw = atob(normalized);
  return Uint8Array.from(raw, char => char.charCodeAt(0));
}

async function ld84GeminiCryptoKey() {
  const credentials = await ld84ResourceCredentials();
  const material = new TextEncoder().encode(`ld84-gemini|${credentials.licenseKey}|${credentials.deviceId}`);
  const digest = await crypto.subtle.digest('SHA-256', material);
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function ld84GeminiEncrypt(secret) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await ld84GeminiCryptoKey();
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(String(secret || ''))));
  return { v: 1, alg: 'AES-256-GCM', iv: ld84B64Url(iv), data: ld84B64Url(encrypted) };
}

async function ld84GeminiDecrypt(blob) {
  if (!blob || Number(blob.v) !== 1 || !blob.iv || !blob.data) return '';
  const key = await ld84GeminiCryptoKey();
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ld84FromB64Url(blob.iv) }, key, ld84FromB64Url(blob.data));
  return new TextDecoder().decode(decrypted);
}

function ld84GeminiModelId(value) {
  return String(value || '').trim().replace(/^models\//, '');
}

function ld84GeminiModelAllowed(value) {
  return LD84_GEMINI_FREE_MODELS.includes(ld84GeminiModelId(value));
}

function ld84GeminiModelSafe(value, fallback) {
  const id = ld84GeminiModelId(value);
  return ld84GeminiModelAllowed(id) ? id : fallback;
}

function ld84GeminiKeyHint(value) {
  const key = String(value || '');
  if (!key) return '';
  if (key.length <= 8) return '••••';
  return `••••${key.slice(-4)}`;
}

async function ld84GeminiRead(includeSecret = false) {
  await ld84ResourceCredentials();
  const stored = await ld84ResourceStorage([LD84_GEMINI_CONFIG_KEY]);
  const raw = stored[LD84_GEMINI_CONFIG_KEY] && typeof stored[LD84_GEMINI_CONFIG_KEY] === 'object' ? stored[LD84_GEMINI_CONFIG_KEY] : {};
  let apiKey = '';
  if (raw.secret) {
    try { apiKey = await ld84GeminiDecrypt(raw.secret); } catch (_) { apiKey = ''; }
  }
  return {
    model: ld84GeminiModelSafe(raw.model, LD84_GEMINI_DEFAULT_MODEL),
    advancedModel: ld84GeminiModelSafe(raw.advancedModel, LD84_GEMINI_DEFAULT_ADVANCED_MODEL),
    maxOutputTokens: Math.max(1024, Math.min(65536, Number(raw.maxOutputTokens || 32768))),
    billingMode: 'free',
    zeroCost: true,
    dynamicModels: true,
    keyPresent: Boolean(apiKey),
    keyHint: ld84GeminiKeyHint(apiKey),
    verifiedAt: raw.verifiedAt || null,
    updatedAt: raw.updatedAt || null,
    ...(includeSecret ? { apiKey } : {})
  };
}

async function ld84GeminiSave(input = {}) {
  const current = await ld84GeminiRead(true);
  const incomingKey = String(input.apiKey || '').trim();
  const apiKey = incomingKey || current.apiKey;
  if (!apiKey) throw new Error('GEMINI_KEY_REQUIRED');
  const model = ld84GeminiModelSafe(input.model || current.model, LD84_GEMINI_DEFAULT_MODEL);
  const advancedModel = ld84GeminiModelSafe(input.advancedModel || current.advancedModel, LD84_GEMINI_DEFAULT_ADVANCED_MODEL);
  const stored = {
    v: 1,
    secret: incomingKey ? await ld84GeminiEncrypt(apiKey) : (await ld84ResourceStorage([LD84_GEMINI_CONFIG_KEY]))[LD84_GEMINI_CONFIG_KEY]?.secret,
    model,
    advancedModel,
    maxOutputTokens: Math.max(1024, Math.min(65536, Number(input.maxOutputTokens || current.maxOutputTokens || 32768))),
    billingMode: 'free',
    zeroCost: true,
    dynamicModels: true,
    verifiedAt: current.verifiedAt || null,
    updatedAt: new Date().toISOString()
  };
  await ld84ResourceStorageSet({ [LD84_GEMINI_CONFIG_KEY]: stored });
  return ld84GeminiStatus();
}

async function ld84GeminiClear() {
  await ld84ResourceCredentials();
  await ld84ResourceStorageRemove([LD84_GEMINI_CONFIG_KEY]);
  return ld84GeminiStatus();
}

async function ld84GeminiResolveKey(input = {}) {
  const supplied = String(input.apiKey || '').trim();
  if (supplied) return supplied;
  const current = await ld84GeminiRead(true);
  if (!current.apiKey) throw new Error('GEMINI_KEY_REQUIRED');
  return current.apiKey;
}

function ld84GeminiSupported(raw) {
  const id = ld84GeminiModelId(raw?.name || raw?.baseModelId || '');
  if (!id || !ld84GeminiModelAllowed(id)) return false;
  const methods = Array.isArray(raw?.supportedGenerationMethods) ? raw.supportedGenerationMethods : [];
  return methods.length === 0 || methods.includes('generateContent');
}

async function ld84GeminiModels(input = {}) {
  await ld84ResourceCredentials();
  const apiKey = await ld84GeminiResolveKey(input);
  const models = [];
  let pageToken = '';
  let pages = 0;
  do {
    const query = new URLSearchParams({ pageSize: '1000' });
    if (pageToken) query.set('pageToken', pageToken);
    const response = await fetch(`${LD84_GEMINI_API_BASE}/models?${query}`, {
      method: 'GET',
      headers: { 'x-goog-api-key': apiKey }
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(String(body?.error?.message || body?.error?.status || `GEMINI_HTTP_${response.status}`));
      error.code = String(body?.error?.status || `GEMINI_HTTP_${response.status}`);
      throw error;
    }
    for (const raw of Array.isArray(body?.models) ? body.models : []) {
      if (!ld84GeminiSupported(raw)) continue;
      const id = ld84GeminiModelId(raw.name || raw.baseModelId || '');
      models.push({
        id,
        displayName: String(raw.displayName || id),
        inputTokenLimit: Number(raw.inputTokenLimit || 0) || null,
        outputTokenLimit: Number(raw.outputTokenLimit || 0) || null,
        freeTierVerified: true,
        compatible: true
      });
    }
    pageToken = String(body?.nextPageToken || '');
    pages += 1;
  } while (pageToken && pages < 10);

  const unique = [...new Map(models.map(item => [item.id, item])).values()]
    .sort((a, b) => LD84_GEMINI_FREE_MODELS.indexOf(a.id) - LD84_GEMINI_FREE_MODELS.indexOf(b.id));
  if (!unique.length) throw new Error('GEMINI_NO_FREE_MODELS_AVAILABLE');

  const currentRaw = await ld84ResourceStorage([LD84_GEMINI_CONFIG_KEY]);
  const current = currentRaw[LD84_GEMINI_CONFIG_KEY] && typeof currentRaw[LD84_GEMINI_CONFIG_KEY] === 'object' ? currentRaw[LD84_GEMINI_CONFIG_KEY] : {};
  if (current.secret) {
    await ld84ResourceStorageSet({
      [LD84_GEMINI_CONFIG_KEY]: {
        ...current,
        verifiedAt: new Date().toISOString()
      }
    });
  }

  return {
    ok: true,
    schema: 'ld-gemini-integration/1',
    models: unique,
    count: unique.length,
    validationMode: 'models-list-no-generation',
    zeroCostPolicy: true
  };
}

async function ld84GeminiStatus() {
  const current = await ld84GeminiRead(false);
  return {
    ok: true,
    schema: 'ld-gemini-integration/1',
    build: 84,
    module: 'gemini',
    capability: 'integration.gemini',
    state: 'reattached',
    targetPhase: '84.5',
    functionalInvocation: true,
    summary: current.keyPresent
      ? `Gemini configurado · ${current.model} · integração opcional sob demanda.`
      : 'Gemini disponível para configuração · nenhuma chave salva.',
    data: {
      configured: current.keyPresent,
      keyPresent: current.keyPresent,
      keyHint: current.keyHint,
      model: current.model,
      advancedModel: current.advancedModel,
      maxOutputTokens: current.maxOutputTokens,
      billingMode: 'free',
      zeroCost: true,
      dynamicModels: true,
      verifiedAt: current.verifiedAt,
      updatedAt: current.updatedAt,
      providerRole: 'optional',
      automaticExecution: false,
      bootActivation: false,
      centralOrchestrator: 'local-ai',
      validationMode: 'models-list-no-generation',
      apiBase: LD84_GEMINI_API_BASE,
      allowedModels: [...LD84_GEMINI_FREE_MODELS]
    }
  };
}

async function ld84GeminiCommand(action, message = {}) {
  const normalized = String(action || 'status');
  if (normalized === 'open' || normalized === 'status' || normalized === 'details') return ld84GeminiStatus();
  if (normalized === 'save') return ld84GeminiSave(message?.config || message);
  if (normalized === 'models' || normalized === 'test') return ld84GeminiModels(message?.config || message);
  if (normalized === 'clear') return ld84GeminiClear();
  throw new Error('GEMINI_ACTION_INVALID');
}

Object.defineProperty(globalThis, 'LovableDecrypterGeminiRuntimeV84', {
  value: Object.freeze({ command: ld84GeminiCommand, status: ld84GeminiStatus }),
  configurable: false,
  enumerable: false,
  writable: false
});

function ld84AllowedSender(sender) {
  const senderUrl = String(sender?.url || sender?.tab?.url || '');
  if (!senderUrl) return true;
  try {
    const parsed = new URL(senderUrl);
    return parsed.protocol === 'chrome-extension:' || parsed.hostname === 'lovable.dev' || parsed.hostname.endsWith('.lovable.dev');
  } catch (_) {
    return false;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const type = String(message?.type || '');
  const resourceTypes = ['ld84.integration.resources.status', 'ld84.integration.resources.save'];
  const geminiTypes = ['ld84.gemini.status', 'ld84.gemini.save', 'ld84.gemini.models', 'ld84.gemini.test', 'ld84.gemini.clear'];
  if (!resourceTypes.includes(type) && !geminiTypes.includes(type)) return;

  if (!ld84AllowedSender(sender)) {
    sendResponse({ ok: false, code: 'SENDER_NOT_ALLOWED' });
    return false;
  }

  let task;
  if (resourceTypes.includes(type)) {
    const integration = String(message?.integration || '');
    task = type === 'ld84.integration.resources.status'
      ? ld84ResourceStatus(integration)
      : ld84ResourceSave(integration, message?.selected);
  } else if (type === 'ld84.gemini.status') {
    task = ld84GeminiStatus();
  } else if (type === 'ld84.gemini.save') {
    task = ld84GeminiSave(message?.config || {});
  } else if (type === 'ld84.gemini.models' || type === 'ld84.gemini.test') {
    task = ld84GeminiModels(message?.config || {});
  } else {
    task = ld84GeminiClear();
  }

  task.then(sendResponse).catch(error => sendResponse({
    ok: false,
    code: String(error?.code || error?.message || (geminiTypes.includes(type) ? 'GEMINI_INTEGRATION_FAILED' : 'RESOURCE_MANAGEMENT_FAILED')),
    message: String(error?.message || error?.code || '')
  }));
  return true;
});