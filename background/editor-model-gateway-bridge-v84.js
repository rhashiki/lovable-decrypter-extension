'use strict';

(() => {
  const SCHEMA = 'ld-editor-model-gateway-bridge/1';
  const BACKEND = 'https://kkzxxnfxgrouhkzyszxs.supabase.co/functions/v1';
  const CLIENT_VERSION = '2.6.84';
  const CLIENT_PROTOCOL = 'ld-runtime-bus/1';
  const ACCOUNT_KEY = 'ld84_account';
  const DEVICE_KEY = 'ld84_device_id';
  const TRUST_KEY = 'ld84_trust';
  const GEMINI_KEY = 'ld84_gemini_config';
  const DEFAULT_MODEL = 'gemini-3.6-flash';
  const FREE_MODELS = new Set([
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite'
  ]);

  if (typeof ld84EditorLocalChat !== 'function' || typeof ld84EditorHealth !== 'function' || typeof ld84EditorLocalSettings !== 'function') {
    throw new Error('EDITOR_DIRECT_AI_RUNTIME_REQUIRED');
  }

  const localChatBase84 = ld84EditorLocalChat;

  function storageGet(keys) {
    return new Promise(resolve => chrome.storage.local.get(keys, value => resolve(value || {})));
  }
  function unb64(value) {
    const raw = String(value || '').replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(String(value || '').length / 4) * 4, '=');
    const decoded = atob(raw);
    return Uint8Array.from(decoded, char => char.charCodeAt(0));
  }
  async function credentials() {
    const stored = await storageGet([ACCOUNT_KEY, DEVICE_KEY]);
    const account = stored[ACCOUNT_KEY] && typeof stored[ACCOUNT_KEY] === 'object' ? stored[ACCOUNT_KEY] : {};
    const licenseKey = String(account.licenseKey || '').trim();
    const deviceId = String(stored[DEVICE_KEY] || '').trim();
    if (account.active !== true || !licenseKey) throw new Error('ACCOUNT_NOT_ACTIVE');
    if (!deviceId) throw new Error('DEVICE_REQUIRED');
    return { licenseKey, deviceId };
  }
  async function decryptGeminiConfig() {
    const stored = await storageGet([ACCOUNT_KEY, DEVICE_KEY, GEMINI_KEY]);
    const account = stored[ACCOUNT_KEY] && typeof stored[ACCOUNT_KEY] === 'object' ? stored[ACCOUNT_KEY] : {};
    const licenseKey = String(account.licenseKey || '').trim();
    const deviceId = String(stored[DEVICE_KEY] || '').trim();
    const config = stored[GEMINI_KEY] && typeof stored[GEMINI_KEY] === 'object' ? stored[GEMINI_KEY] : {};
    let apiKey = '';
    if (licenseKey && deviceId && config?.secret?.iv && config?.secret?.data) {
      try {
        const material = new TextEncoder().encode(`ld84-gemini|${licenseKey}|${deviceId}`);
        const digest = await crypto.subtle.digest('SHA-256', material);
        const key = await crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['decrypt']);
        const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(config.secret.iv) }, key, unb64(config.secret.data));
        apiKey = new TextDecoder().decode(plain).trim();
      } catch (_) {}
    }
    const requested = String(config.model || DEFAULT_MODEL).replace(/^models\//, '').trim();
    const model = FREE_MODELS.has(requested) ? requested : DEFAULT_MODEL;
    return {
      apiKey,
      model,
      configured: Boolean(apiKey),
      maxOutputTokens: Math.max(1024, Math.min(32768, Number(config.maxOutputTokens || 32768)))
    };
  }
  async function validTrust() {
    if (typeof ensureTrust === 'function') await ensureTrust(false);
    const stored = await storageGet([TRUST_KEY]);
    const trust = stored[TRUST_KEY] && typeof stored[TRUST_KEY] === 'object' ? stored[TRUST_KEY] : null;
    if (!trust?.token || !trust?.expiresAt || Date.parse(trust.expiresAt) <= Date.now() + 15000) throw new Error('EDITOR_TRUST_REQUIRED');
    return trust;
  }
  async function remoteChat(messages, options = {}) {
    const [auth, trust, gemini] = await Promise.all([credentials(), validTrust(), decryptGeminiConfig()]);
    if (!gemini.configured) {
      const error = new Error('GEMINI_KEY_REQUIRED');
      error.code = 'GEMINI_KEY_REQUIRED';
      error.details = { remediation: 'Configure Integrations > Gemini with your own API key.' };
      throw error;
    }
    const response = await fetch(`${BACKEND}/ld-editor-model-gateway`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-license-key': auth.licenseKey,
        'x-device-id': auth.deviceId,
        'x-decrypter-trust': String(trust.token),
        'x-decrypter-client-version': CLIENT_VERSION,
        'x-decrypter-client-protocol': String(trust.protocol || CLIENT_PROTOCOL),
        'x-gemini-key': gemini.apiKey
      },
      body: JSON.stringify({
        action: 'execute',
        messages: (Array.isArray(messages) ? messages : []).map(item => ({ role: String(item?.role || 'user'), content: String(item?.content || '') })),
        model: gemini.model,
        max_output_tokens: Math.max(1024, Math.min(gemini.maxOutputTokens, Number(options.maxTokens || 12000)))
      })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.ok !== true || !body?.result || typeof body.result !== 'object') {
      const code = String(body?.code || `EDITOR_AI_GATEWAY_HTTP_${response.status}`);
      const error = new Error(code);
      error.code = code;
      error.details = body;
      throw error;
    }
    return { json: body.result, model: String(body.model || gemini.model), usage: body.usage || null, gateway: body.gateway || null };
  }

  async function routedEditorChat(messages, options = {}) {
    const settings = await ld84EditorLocalSettings();
    const health = await ld84EditorHealth(settings);
    const localEligible = health?.ok === true && Boolean(settings?.token);
    if (localEligible) {
      // Provider is selected before inference. If local inference starts and fails,
      // the error is propagated; there is deliberately no cross-provider retry.
      return localChatBase84(messages, options);
    }
    return remoteChat(messages, options);
  }

  ld84EditorLocalChat = routedEditorChat;

  Object.defineProperty(globalThis, 'LovableDecrypterEditorModelGatewayBridgeV84', {
    value: Object.freeze({
      schema: SCHEMA,
      build: 84,
      providerSelectionBeforeExecution: true,
      localHealthGated: true,
      geminiByokFallback: true,
      crossProviderRetry: false,
      promptPersistence: false,
      paidModeAllowed: false
    }),
    configurable: false,
    enumerable: false,
    writable: false
  });
})();
