import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

const bridgePath = 'background/editor-model-gateway-bridge-v84.js';
const brokerPath = 'supabase/functions/ld-editor-model-gateway/index.ts';
const workerPath = 'background/build84-service-worker.js';
const pkgPath = 'release/runtime-package.json';
const bridge = fs.readFileSync(bridgePath, 'utf8');
const broker = fs.readFileSync(brokerPath, 'utf8');
const worker = fs.readFileSync(workerPath, 'utf8');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

function assert(value, message) { if (!value) throw new Error(message); }

assert(bridge.includes("ld84EditorLocalChat = routedEditorChat"), 'bridge must replace only Editor AI call authority');
assert(bridge.includes("health?.ok === true && Boolean(settings?.token)"), 'local route must be health + token gated');
assert(bridge.includes('return localChatBase84(messages, options)'), 'healthy local runtime must preserve existing local executor');
assert(!/catch\s*\([^)]*\)\s*\{[^}]*remoteChat/s.test(bridge), 'local inference failure must not cross-provider retry');
assert(bridge.includes('/ld-editor-model-gateway'), 'Gemini fallback must use authenticated Editor broker');
assert(bridge.includes("'x-decrypter-client-protocol'"), 'modern Trust protocol header required');
assert(bridge.includes('GEMINI_KEY_REQUIRED'), 'missing Gemini BYOK must fail explicitly');
assert(broker.includes("const CLIENT_PROTOCOL = 'ld-runtime-bus/1'"), 'broker must accept runtime bus protocol');
assert(broker.includes("prompt_persistence: false"), 'broker must declare no prompt persistence');
assert(broker.includes("cross_provider_retry: false"), 'broker must forbid cross-provider retry');
assert(broker.includes("paid_mode_allowed: false"), 'broker must forbid paid mode in 84.6');
assert(!broker.includes('insert({') && !broker.includes('.insert('), 'broker must not persist prompts/results');
assert(worker.indexOf("'editor-model-gateway-bridge-v84.js'") > worker.indexOf("'gemini-provider-runtime-v84.js'"), 'bridge must load after Gemini provider');
assert(worker.indexOf("'editor-model-gateway-bridge-v84.js'") < worker.indexOf("'context-intelligence-runtime-v84.js'"), 'bridge must load before Context/Scope wrappers');
assert(pkg.paths.includes(bridgePath), 'runtime package must ship the Editor gateway bridge');
assert(pkg.forbidden_roots.includes('runtime'), 'local Docker/Ollama runtime must remain outside extension package');

function b64(bytes) {
  let raw = '';
  for (const byte of bytes) raw += String.fromCharCode(byte);
  return Buffer.from(raw, 'binary').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
async function encryptedGemini(licenseKey, deviceId, apiKey) {
  const material = new TextEncoder().encode(`ld84-gemini|${licenseKey}|${deviceId}`);
  const digest = await webcrypto.subtle.digest('SHA-256', material);
  const key = await webcrypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt']);
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const data = new Uint8Array(await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(apiKey)));
  return { v: 2, secret: { v: 1, alg: 'AES-256-GCM', iv: b64(iv), data: b64(data) }, model: 'gemini-3.6-flash', maxOutputTokens: 12000 };
}

async function scenario({ localHealthy, localToken, geminiKey }) {
  const licenseKey = 'LD2.test.license';
  const deviceId = 'device-test';
  const trust = { token: 'LDT1.test.trust', expiresAt: new Date(Date.now() + 600000).toISOString(), protocol: 'ld-runtime-bus/1' };
  const config = geminiKey ? await encryptedGemini(licenseKey, deviceId, geminiKey) : {};
  let localCalls = 0;
  let remoteCalls = 0;
  const storage = { ld84_account: { active: true, licenseKey }, ld84_device_id: deviceId, ld84_trust: trust, ld84_gemini_config: config };
  const context = {
    console,
    TextEncoder,
    TextDecoder,
    URL,
    AbortSignal,
    crypto: webcrypto,
    atob: value => Buffer.from(value, 'base64').toString('binary'),
    btoa: value => Buffer.from(value, 'binary').toString('base64'),
    chrome: { storage: { local: { get(keys, cb) { const out = {}; for (const key of keys) out[key] = storage[key]; cb(out); } } } },
    ensureTrust: async () => ({ ok: true }),
    ld84EditorLocalSettings: async () => ({ endpoint: 'http://127.0.0.1:8000', token: localToken ? 'local-token' : '', model: 'decrypter-local' }),
    ld84EditorHealth: async () => ({ ok: localHealthy }),
    ld84EditorLocalChat: async () => { localCalls += 1; return { json: { local: true }, model: 'decrypter-local' }; },
    fetch: async (_url, options) => {
      remoteCalls += 1;
      assert(options.headers['x-decrypter-client-version'] === '2.6.84', 'remote bridge must send 2.6.84');
      assert(options.headers['x-decrypter-client-protocol'] === 'ld-runtime-bus/1', 'remote bridge must send runtime bus protocol');
      assert(options.headers['x-gemini-key'] === geminiKey, 'decrypted Gemini key must only travel service-worker -> broker');
      return { ok: true, status: 200, json: async () => ({ ok: true, result: { remote: true }, model: 'gemini-3.6-flash', gateway: { provider: 'gemini' } }) };
    }
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(bridge, context, { filename: bridgePath });
  let value = null;
  let error = null;
  try { value = await context.ld84EditorLocalChat([{ role: 'user', content: 'test' }], { maxTokens: 2000 }); }
  catch (err) { error = err; }
  return { value, error, localCalls, remoteCalls };
}

const local = await scenario({ localHealthy: true, localToken: true, geminiKey: 'AIza-test-key' });
assert(!local.error && local.value?.json?.local === true, 'healthy configured local runtime must execute locally');
assert(local.localCalls === 1 && local.remoteCalls === 0, 'local execution must not contact Gemini broker');

const remote = await scenario({ localHealthy: false, localToken: false, geminiKey: 'AIza-test-key' });
assert(!remote.error && remote.value?.json?.remote === true, 'unavailable local runtime must route to Gemini BYOK');
assert(remote.localCalls === 0 && remote.remoteCalls === 1, 'remote fallback must occur before any local inference');

const missing = await scenario({ localHealthy: false, localToken: false, geminiKey: '' });
assert(missing.error?.message === 'GEMINI_KEY_REQUIRED', 'fresh client without local or Gemini must receive GEMINI_KEY_REQUIRED');
assert(missing.localCalls === 0 && missing.remoteCalls === 0, 'missing provider credentials must perform zero inference');

console.log('Build84.6 Editor model gateway: PASS');
