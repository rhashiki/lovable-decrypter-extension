import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2.112.4';

const SCHEMA = 'ld-editor-model-gateway/1';
const CLIENT_PROTOCOL = 'ld-runtime-bus/1';
const PUBLIC_SPKI_B64 = 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE/suDKmZG7B52xCVkCooS5MZfvVu+GjYTIfeOvlfi9tz29TQNN4uea318Nn2xf5uf/cm0bpaCADPwkqWSZV2MIA==';
const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta';
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
const DEFAULT_MODEL = 'gemini-3.6-flash';
const MAX_MESSAGES = 8;
const MAX_MESSAGE_CHARS = 2_700_000;
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type,x-license-key,x-device-id,x-decrypter-trust,x-decrypter-client-version,x-decrypter-client-protocol,x-gemini-key,authorization',
  'Access-Control-Allow-Methods': 'POST,OPTIONS'
};
const enc = new TextEncoder();
const dec = new TextDecoder();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
function serviceKey() {
  const current = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (current) {
    try {
      const parsed = JSON.parse(current);
      if (parsed?.default) return String(parsed.default);
      const first = Object.values(parsed || {})[0];
      if (first) return String(first);
    } catch (_) {}
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
}
function admin() {
  const url = Deno.env.get('SUPABASE_URL') || '';
  const key = serviceKey();
  if (!url || !key) throw new Error('BACKEND_NOT_CONFIGURED');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
function b64u(value: string) {
  const raw = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(raw), char => char.charCodeAt(0));
}
async function sha(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
async function publicKey() {
  const der = Uint8Array.from(atob(PUBLIC_SPKI_B64), char => char.charCodeAt(0));
  return crypto.subtle.importKey('spki', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
}
async function verifySigned(prefix: string, audience: string, token: string) {
  const [actualPrefix, payloadPart, signaturePart] = token.trim().split('.');
  if (actualPrefix !== prefix || !payloadPart || !signaturePart) throw new Error(prefix === 'LD2' ? 'KEY_INVALID_FORMAT' : 'TRUST_INVALID_FORMAT');
  const verified = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, await publicKey(), b64u(signaturePart), enc.encode(payloadPart));
  if (!verified) throw new Error(prefix === 'LD2' ? 'KEY_INVALID_SIGNATURE' : 'TRUST_INVALID_SIGNATURE');
  const payload = JSON.parse(dec.decode(b64u(payloadPart)));
  if (payload?.aud !== audience || Number(payload?.v) !== 1) throw new Error(prefix === 'LD2' ? 'KEY_INVALID_PAYLOAD' : 'TRUST_INVALID_PAYLOAD');
  return payload;
}
async function authorize(req: Request, sb: any) {
  const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  const token = String(req.headers.get('x-license-key') || bearer || '').trim();
  const deviceId = String(req.headers.get('x-device-id') || '').trim();
  if (!token) throw new Error('KEY_REQUIRED');
  if (!deviceId) throw new Error('DEVICE_REQUIRED');
  const signed = await verifySigned('LD2', 'lovable-decrypter', token);
  const now = Math.floor(Date.now() / 1000);
  if (!signed?.license_id) throw new Error('KEY_INVALID_PAYLOAD');
  if (signed.nbf && now < Number(signed.nbf)) throw new Error('KEY_NOT_ACTIVE');
  if (signed.exp && now >= Number(signed.exp)) throw new Error('KEY_EXPIRED');
  const { data: license, error } = await sb.from('ld_license_keys').select('id,status,expires_at,credit_balance,credit_debt').eq('id', String(signed.license_id)).eq('key_hash', await sha(token)).maybeSingle();
  if (error) throw new Error('DB_ERROR');
  if (!license) throw new Error('KEY_NOT_REGISTERED');
  if (license.status !== 'active') throw new Error(`KEY_${String(license.status).toUpperCase()}`);
  const timeActive = Boolean(license.expires_at && Date.parse(license.expires_at) > Date.now());
  const creditActive = !timeActive && Number(license.credit_debt || 0) === 0 && Number(license.credit_balance || 0) > 0;
  if (!timeActive && !creditActive) throw new Error('ENTITLEMENT_EXHAUSTED');
  const deviceHash = await sha(deviceId);
  const { data: device, error: deviceError } = await sb.from('ld_license_devices').select('id,revoked_at').eq('license_id', license.id).eq('device_hash', deviceHash).maybeSingle();
  if (deviceError) throw new Error('DB_ERROR');
  if (!device) throw new Error('DEVICE_NOT_BOUND');
  if (device.revoked_at) throw new Error('DEVICE_REVOKED');
  return { licenseId: String(license.id), deviceHash };
}
async function verifyTrust(req: Request, sb: any, auth: any) {
  const token = String(req.headers.get('x-decrypter-trust') || '').trim();
  const clientVersion = String(req.headers.get('x-decrypter-client-version') || '').trim();
  const protocol = String(req.headers.get('x-decrypter-client-protocol') || '').trim();
  if (!token) throw new Error('TRUST_REQUIRED');
  if (!clientVersion) throw new Error('TRUST_CLIENT_VERSION_REQUIRED');
  if (protocol !== CLIENT_PROTOCOL) throw new Error('TRUST_CLIENT_PROTOCOL_UNSUPPORTED');
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(clientVersion)) throw new Error('TRUST_CLIENT_VERSION_INVALID');
  const payload = await verifySigned('LDT1', 'lovable-decrypter-trust', token);
  if (Number(payload.exp || 0) <= Math.floor(Date.now() / 1000)) throw new Error('TRUST_EXPIRED');
  if (String(payload.license_id) !== auth.licenseId || String(payload.device_hash) !== auth.deviceHash) throw new Error('TRUST_BINDING_MISMATCH');
  if (String(payload.client_version) !== clientVersion) throw new Error('TRUST_VERSION_MISMATCH');
  const payloadProtocol = String(payload.client_protocol || '').trim();
  if (payloadProtocol && payloadProtocol !== protocol) throw new Error('TRUST_PROTOCOL_MISMATCH');
  const { data: session, error } = await sb.from('ld_trust_sessions').select('id,expires_at,revoked_at,client_version,client_fingerprint,metadata').eq('id', String(payload.sid || '')).maybeSingle();
  if (error) throw new Error('DB_ERROR');
  if (!session || session.revoked_at || Date.parse(session.expires_at) <= Date.now()) throw new Error('TRUST_EXPIRED');
  if (String(session.client_version) !== clientVersion || String(session.client_fingerprint) !== String(payload.client_fingerprint || '')) throw new Error('TRUST_SESSION_MISMATCH');
  const sessionProtocol = String(session?.metadata?.client_protocol || '').trim();
  if (sessionProtocol && sessionProtocol !== protocol) throw new Error('TRUST_SESSION_PROTOCOL_MISMATCH');
  await sb.from('ld_trust_sessions').update({ last_seen_at: new Date().toISOString() }).eq('id', session.id);
  return { clientVersion, protocol };
}
function modelId(value: unknown) {
  return String(value || '').trim().replace(/^models\//, '');
}
function allowedModel(value: unknown) {
  const model = modelId(value);
  return FREE_MODELS.has(model) || [...FREE_MODELS].some(base => model === `${base}-latest` || model === `${base}-001`);
}
function normalizeMessages(value: unknown) {
  const source = Array.isArray(value) ? value.slice(0, MAX_MESSAGES) : [];
  let total = 0;
  const messages = source.map((item: any) => {
    const role = ['system', 'user', 'assistant'].includes(String(item?.role || '')) ? String(item.role) : 'user';
    const remaining = Math.max(0, MAX_MESSAGE_CHARS - total);
    const content = String(item?.content || '').slice(0, remaining);
    total += content.length;
    return { role, content };
  }).filter(item => item.content);
  if (!messages.length) throw new Error('EDITOR_AI_MESSAGES_REQUIRED');
  return messages;
}
function extractGemini(data: any) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  const chunks: string[] = [];
  for (const step of Array.isArray(data?.steps) ? data.steps : []) {
    if (step?.type !== 'model_output' || !Array.isArray(step.content)) continue;
    for (const part of step.content) if (part?.type === 'text' && typeof part.text === 'string') chunks.push(part.text);
  }
  return chunks.join('').trim();
}
function parseJson(value: string) {
  const raw = String(value || '').trim();
  const fenced = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1]?.trim();
  const candidate = fenced || raw;
  try { return JSON.parse(candidate); } catch (_) {}
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start >= 0 && end > start) return JSON.parse(candidate.slice(start, end + 1));
  throw new Error('EDITOR_AI_JSON_INVALID');
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ ok: false, code: 'METHOD_NOT_ALLOWED' }, 405);
  try {
    const sb = admin();
    const auth = await authorize(req, sb);
    const trust = await verifyTrust(req, sb, auth);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'execute');
    if (action === 'status') {
      return json({ ok: true, schema: SCHEMA, active: true, authority: 'server', client_protocol: trust.protocol, providers: { local_direct: 'extension-health-gated', gemini: 'byok-server-executor' }, policy: { provider_selected_before_execution: true, cross_provider_retry: false, prompt_persistence: false, paid_mode_allowed: false } });
    }
    if (action !== 'execute') return json({ ok: false, code: 'UNKNOWN_ACTION' }, 400);
    const apiKey = String(req.headers.get('x-gemini-key') || '').trim();
    if (!apiKey) return json({ ok: false, code: 'GEMINI_KEY_REQUIRED' }, 400);
    const model = modelId(body.model || DEFAULT_MODEL) || DEFAULT_MODEL;
    if (!allowedModel(model)) return json({ ok: false, code: 'ZERO_COST_MODEL_BLOCKED', model }, 400);
    const messages = normalizeMessages(body.messages);
    const system = messages.filter(item => item.role === 'system').map(item => item.content).join('\n\n');
    const inputText = messages.filter(item => item.role !== 'system').map(item => `${item.role.toUpperCase()}:\n${item.content}`).join('\n\n');
    const maxOutputTokens = Math.max(1024, Math.min(32768, Number(body.max_output_tokens || 12000)));
    const started = Date.now();
    const response = await fetch(`${GEMINI_API}/interactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        model,
        input: [{ type: 'text', text: inputText }],
        system_instruction: system || 'Return only valid JSON.',
        response_format: { type: 'text', mime_type: 'application/json' },
        store: false,
        generation_config: { max_output_tokens: maxOutputTokens, temperature: 0.1 }
      })
    });
    const raw = await response.json().catch(() => ({}));
    if (!response.ok) return json({ ok: false, code: `GEMINI_HTTP_${response.status}`, message: String(raw?.error?.message || 'Gemini request failed') }, response.status >= 500 ? 502 : 400);
    if (raw?.status && raw.status !== 'completed') return json({ ok: false, code: 'GEMINI_INCOMPLETE', gemini_status: raw.status }, 422);
    const result = parseJson(extractGemini(raw));
    const usage = raw?.usage || null;
    return json({
      ok: true,
      schema: SCHEMA,
      result,
      model,
      usage,
      gateway: {
        authoritative: true,
        provider: 'gemini',
        executor: 'gemini-interactions',
        reason: 'editor84:local-unavailable-or-not-configured:gemini-byok',
        zero_cost_policy: true,
        paid_mode_allowed: false,
        cross_provider_retry: false,
        prompt_persistence: false,
        client_version: trust.clientVersion,
        client_protocol: trust.protocol,
        resolved_at: new Date().toISOString()
      },
      duration_ms: Date.now() - started
    });
  } catch (error) {
    const code = String((error as Error)?.message || 'INTERNAL_ERROR');
    const authish = /^(KEY_|DEVICE_|ENTITLEMENT_|TRUST_)/.test(code);
    console.error('ld-editor-model-gateway', code);
    return json({ ok: false, code }, authish ? 403 : 500);
  }
});
