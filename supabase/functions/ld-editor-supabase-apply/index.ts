import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2.112.4';

const SCHEMA = 'ld-editor-supabase-apply/1';
const BUILD = 84;
const CLIENT_PROTOCOL = 'ld-runtime-bus/1';
const API_BASE = 'https://api.supabase.com/v1';
const GITHUB_API = 'https://api.github.com';
const GITHUB_API_VERSION = '2026-03-10';
const PUBLIC_SPKI_B64 = 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE/suDKmZG7B52xCVkCooS5MZfvVu+GjYTIfeOvlfi9tz29TQNN4uea318Nn2xf5uf/cm0bpaCADPwkqWSZV2MIA==';
const MAX_MIGRATIONS = 8;
const MAX_MIGRATION_BYTES = 700_000;
const MAX_TOTAL_BYTES = 1_800_000;
const MIGRATION_PATH = /^supabase\/migrations\/(\d{14})_([a-z0-9][a-z0-9_-]{0,120})\.sql$/;
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type,x-license-key,x-device-id,x-decrypter-trust,x-decrypter-client-version,x-decrypter-client-protocol,authorization',
  'Access-Control-Allow-Methods': 'POST,OPTIONS'
};
const enc = new TextEncoder();
const dec = new TextDecoder();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}
function b64u(value: string) {
  const raw = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(raw), char => char.charCodeAt(0));
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
  const verified = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    await publicKey(),
    b64u(signaturePart),
    enc.encode(payloadPart)
  );
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
  if (signed.nbf && now < Number(signed.nbf)) throw new Error('KEY_NOT_ACTIVE');
  if (signed.exp && now >= Number(signed.exp)) throw new Error('KEY_EXPIRED');
  const { data: license, error } = await sb.from('ld_license_keys')
    .select('id,status,expires_at,credit_balance,credit_debt')
    .eq('id', String(signed.license_id))
    .eq('key_hash', await sha(token))
    .maybeSingle();
  if (error) throw new Error('DB_ERROR');
  if (!license) throw new Error('KEY_NOT_REGISTERED');
  if (license.status !== 'active') throw new Error(`KEY_${String(license.status).toUpperCase()}`);
  const timeActive = Boolean(license.expires_at && Date.parse(license.expires_at) > Date.now());
  const creditActive = !timeActive && Number(license.credit_debt || 0) === 0 && Number(license.credit_balance || 0) > 0;
  if (!timeActive && !creditActive) throw new Error('ENTITLEMENT_EXHAUSTED');
  const deviceHash = await sha(deviceId);
  const { data: device, error: deviceError } = await sb.from('ld_license_devices')
    .select('id,revoked_at')
    .eq('license_id', license.id)
    .eq('device_hash', deviceHash)
    .maybeSingle();
  if (deviceError) throw new Error('DB_ERROR');
  if (!device) throw new Error('DEVICE_NOT_BOUND');
  if (device.revoked_at) throw new Error('DEVICE_REVOKED');
  return { token, deviceId, deviceHash, licenseId: String(license.id) };
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
  const { data: session, error } = await sb.from('ld_trust_sessions')
    .select('id,expires_at,revoked_at,client_version,client_fingerprint,metadata')
    .eq('id', String(payload.sid || ''))
    .maybeSingle();
  if (error) throw new Error('DB_ERROR');
  if (!session || session.revoked_at || Date.parse(session.expires_at) <= Date.now()) throw new Error('TRUST_EXPIRED');
  if (String(session.client_version) !== clientVersion || String(session.client_fingerprint) !== String(payload.client_fingerprint || '')) throw new Error('TRUST_SESSION_MISMATCH');
  const sessionProtocol = String(session?.metadata?.client_protocol || '').trim();
  if (sessionProtocol && sessionProtocol !== protocol) throw new Error('TRUST_SESSION_PROTOCOL_MISMATCH');
  return { clientVersion, protocol };
}
async function getSecret(sb: any, name: string) {
  const { data, error } = await sb.rpc('ld_backend_secret', { p_name: name });
  if (error || !data) throw new Error(`SECRET_MISSING:${name}`);
  return String(data);
}
async function getOAuthConfig(sb: any) {
  const { data, error } = await sb.from('ld_supabase_oauth_config').select('*').eq('singleton', true).maybeSingle();
  if (error) throw new Error('OAUTH_CONFIG_READ_FAILED');
  if (!data) throw new Error('SUPABASE_OAUTH_APP_NOT_CONFIGURED');
  return data;
}
async function connectionRow(sb: any, licenseId: string, deviceHash: string) {
  const { data, error } = await sb.from('ld_supabase_connections').select('*')
    .eq('license_id', licenseId)
    .eq('device_hash', deviceHash)
    .maybeSingle();
  if (error) throw new Error('CONNECTION_READ_FAILED');
  if (!data) throw new Error('SUPABASE_NOT_CONNECTED');
  return data;
}
function basicAuth(clientId: string, secret: string) {
  return `Basic ${btoa(`${clientId}:${secret}`)}`;
}
async function refreshSupabaseAccess(sb: any, auth: any) {
  const config = await getOAuthConfig(sb);
  const connection = await connectionRow(sb, auth.licenseId, auth.deviceHash);
  const refreshToken = await getSecret(sb, String(connection.refresh_secret_name));
  const clientSecret = await getSecret(sb, 'LD_SUPABASE_OAUTH_CLIENT_SECRET');
  const response = await fetch(`${API_BASE}/oauth/token`, {
    method: 'POST',
    headers: {
      Authorization: basicAuth(String(config.client_id), clientSecret),
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json'
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken })
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.access_token) throw new Error(`TOKEN_REFRESH_FAILED:${response.status}:${data?.message || data?.error || 'invalid response'}`);
  return String(data.access_token);
}
async function management(accessToken: string, path: string, options: RequestInit = {}, timeoutMs = 45_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        ...(options.headers || {})
      }
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const error: any = new Error(`SUPABASE_MANAGEMENT_HTTP_${response.status}:${data?.message || data?.error || 'request failed'}`);
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') throw new Error('SUPABASE_MANAGEMENT_TIMEOUT');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
async function githubInstallationToken(auth: any) {
  const backend = Deno.env.get('SUPABASE_URL') || '';
  if (!backend) throw new Error('BACKEND_NOT_CONFIGURED');
  const response = await fetch(`${backend}/functions/v1/ld-github-app`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-license-key': auth.token,
      'x-device-id': auth.deviceId
    },
    body: JSON.stringify({ action: 'token' })
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.ok !== true || !data?.token) throw new Error(String(data?.code || `GITHUB_TOKEN_HTTP_${response.status}`));
  return String(data.token);
}
async function githubGet(token: string, path: string) {
  const response = await fetch(`${GITHUB_API}${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': GITHUB_API_VERSION,
      Authorization: `Bearer ${token}`
    }
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`GITHUB_INSTALLATION_HTTP_${response.status}:${data?.message || 'request failed'}`);
  return data;
}
function parseRepository(value: unknown) {
  const repository = String(value || '').trim();
  const parts = repository.split('/');
  if (parts.length !== 2 || !/^[A-Za-z0-9_.-]+$/.test(parts[0]) || !/^[A-Za-z0-9_.-]+$/.test(parts[1])) throw new Error('REPOSITORY_INVALID');
  return { repository, owner: parts[0], repo: parts[1] };
}
function migrationDescriptor(pathInput: unknown) {
  const path = String(pathInput || '').trim().replace(/\\/g, '/').replace(/^\/+/, '');
  const match = path.match(MIGRATION_PATH);
  if (!match) throw new Error(`MIGRATION_PATH_REJECTED:${path || 'empty'}`);
  const version = match[1];
  const stem = `${version}_${match[2]}`;
  return { path, version, stem };
}
function decodeGithubFile(body: any, path: string) {
  if (body?.type !== 'file' || body?.encoding !== 'base64' || typeof body?.content !== 'string') throw new Error(`GITHUB_MIGRATION_READ_UNSUPPORTED:${path}`);
  const normalized = body.content.replace(/\n/g, '');
  const bytes = Uint8Array.from(atob(normalized), char => char.charCodeAt(0));
  if (bytes.byteLength === 0) throw new Error(`MIGRATION_EMPTY:${path}`);
  if (bytes.byteLength > MAX_MIGRATION_BYTES) throw new Error(`MIGRATION_TOO_LARGE:${path}`);
  return dec.decode(bytes);
}
function cleanExpectedMigrations(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) throw new Error('MIGRATIONS_REQUIRED');
  if (value.length > MAX_MIGRATIONS) throw new Error('MIGRATION_LIMIT');
  const seen = new Set<string>();
  return value.map((item: any) => {
    const descriptor = migrationDescriptor(item?.path);
    if (seen.has(descriptor.path)) throw new Error(`MIGRATION_DUPLICATE:${descriptor.path}`);
    seen.add(descriptor.path);
    const digest = String(item?.digest || '').trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(digest)) throw new Error(`MIGRATION_DIGEST_REQUIRED:${descriptor.path}`);
    return { ...descriptor, expectedDigest: digest };
  }).sort((a, b) => a.path.localeCompare(b.path));
}
async function verifyGitSource(auth: any, body: any) {
  const repo = parseRepository(body.repository);
  const branch = String(body.branch || '').trim();
  const commitSha = String(body.commit_sha || '').trim().toLowerCase();
  if (!branch || branch.length > 180) throw new Error('BRANCH_INVALID');
  if (!/^[0-9a-f]{40}$/.test(commitSha)) throw new Error('COMMIT_SHA_INVALID');
  const expected = cleanExpectedMigrations(body.migrations);
  const token = await githubInstallationToken(auth);
  const branchState = await githubGet(token, `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/branches/${encodeURIComponent(branch)}`);
  const currentHead = String(branchState?.commit?.sha || '').toLowerCase();
  if (currentHead !== commitSha) throw new Error('GITHUB_HEAD_CHANGED_BEFORE_SUPABASE');
  const prepared: any[] = [];
  let totalBytes = 0;
  for (const item of expected) {
    const apiPath = item.path.split('/').map(encodeURIComponent).join('/');
    const file = await githubGet(token, `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/contents/${apiPath}?ref=${encodeURIComponent(commitSha)}`);
    const sql = decodeGithubFile(file, item.path);
    totalBytes += enc.encode(sql).byteLength;
    if (totalBytes > MAX_TOTAL_BYTES) throw new Error('MIGRATIONS_TOTAL_TOO_LARGE');
    const digest = await sha(sql);
    if (digest !== item.expectedDigest) throw new Error(`MIGRATION_DIGEST_MISMATCH:${item.path}`);
    const historyName = `${item.stem}__ld84_${digest.slice(0, 16)}`;
    prepared.push({ ...item, digest, sql, historyName });
  }
  return { repo, branch, commitSha, prepared };
}
function historyRows(data: any) {
  return Array.isArray(data) ? data : Array.isArray(data?.migrations) ? data.migrations : [];
}
function historyDecision(history: any[], migration: any) {
  const exact = history.find(row => String(row?.name || '') === migration.historyName);
  if (exact) return { state: 'already-applied', version: String(exact?.version || '') };
  const ambiguous = history.find(row => {
    const name = String(row?.name || '');
    return name === migration.stem || name.startsWith(`${migration.stem}__ld84_`);
  });
  if (ambiguous) throw new Error(`MIGRATION_HISTORY_CONFLICT:${migration.path}`);
  return { state: 'pending', version: '' };
}
async function applyMigrations(accessToken: string, projectRef: string, prepared: any[]) {
  const history = historyRows(await management(accessToken, `/projects/${encodeURIComponent(projectRef)}/database/migrations`));
  const applied: any[] = [];
  const skipped: any[] = [];
  for (const migration of prepared) {
    const decision = historyDecision(history, migration);
    if (decision.state === 'already-applied') {
      skipped.push({ path: migration.path, digest: migration.digest, historyName: migration.historyName, version: decision.version, reason: 'already-applied' });
      continue;
    }
    try {
      const result = await management(accessToken, `/projects/${encodeURIComponent(projectRef)}/database/migrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: migration.sql, name: migration.historyName })
      }, 180_000);
      applied.push({ path: migration.path, digest: migration.digest, historyName: migration.historyName, result: result || null });
      history.push({ name: migration.historyName, version: result?.version || '' });
    } catch (error) {
      const message = String((error as Error)?.message || error);
      const unavailable = /SUPABASE_MANAGEMENT_HTTP_(402|403|404)/.test(message);
      return {
        ok: false,
        code: unavailable && applied.length === 0 ? 'SUPABASE_MIGRATIONS_API_UNAVAILABLE' : applied.length ? 'SUPABASE_MIGRATION_PARTIAL_FAILURE' : 'SUPABASE_MIGRATION_APPLY_FAILED',
        applied,
        skipped,
        failed: { path: migration.path, digest: migration.digest, historyName: migration.historyName, detail: message.slice(0, 1200) }
      };
    }
  }
  return { ok: true, applied, skipped };
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ ok: false, code: 'METHOD_NOT_ALLOWED' }, 405);
  const sb = admin();
  try {
    const auth = await authorize(req, sb);
    const trust = await verifyTrust(req, sb, auth);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'status').toLowerCase();
    if (action === 'status') {
      return json({
        ok: true,
        schema: SCHEMA,
        build: BUILD,
        protocol: trust.protocol,
        authority: 'server',
        policy: {
          git_commit_required_before_supabase: true,
          git_branch_head_must_equal_commit: true,
          source: 'github-committed-migration-only',
          migration_path: 'supabase/migrations/<14-digit-version>_<name>.sql',
          raw_sql_from_client: false,
          seed_sql_auto_apply: false,
          edge_function_auto_deploy: false,
          migration_history_required: true,
          query_fallback: false,
          max_migrations: MAX_MIGRATIONS,
          max_migration_bytes: MAX_MIGRATION_BYTES
        }
      });
    }
    if (action !== 'apply') return json({ ok: false, code: 'UNKNOWN_ACTION' }, 400);
    if (body?.approval?.explicit !== true || String(body?.approval?.surface || '') !== 'editor-direct-review') throw new Error('EXPLICIT_APPROVAL_REQUIRED');
    const projectRef = String(body.project_ref || '').trim();
    if (!/^[a-z0-9]{8,32}$/i.test(projectRef)) throw new Error('PROJECT_REF_INVALID');
    const source = await verifyGitSource(auth, body);
    const accessToken = await refreshSupabaseAccess(sb, auth);
    const result = await applyMigrations(accessToken, projectRef, source.prepared);
    if (!result.ok) {
      return json({
        ok: false,
        schema: SCHEMA,
        build: BUILD,
        code: result.code,
        project_ref: projectRef,
        repository: source.repo.repository,
        branch: source.branch,
        commit_sha: source.commitSha,
        applied: result.applied,
        skipped: result.skipped,
        failed: result.failed,
        recoverable: true,
        retry_contract: 'same-commit-same-digests'
      }, result.code === 'SUPABASE_MIGRATIONS_API_UNAVAILABLE' ? 409 : 422);
    }
    return json({
      ok: true,
      schema: SCHEMA,
      build: BUILD,
      project_ref: projectRef,
      repository: source.repo.repository,
      branch: source.branch,
      commit_sha: source.commitSha,
      applied: result.applied,
      skipped: result.skipped,
      migration_history: true,
      idempotency: 'history-name+source-digest',
      source_verified_from_git: true
    });
  } catch (error) {
    const code = String((error as Error)?.message || 'INTERNAL_ERROR');
    console.error('ld-editor-supabase-apply', code);
    const authish = /^(KEY_|DEVICE_|ENTITLEMENT_|TRUST_|EXPLICIT_APPROVAL)/.test(code);
    const clientish = /^(REPOSITORY_|BRANCH_|COMMIT_|MIGRATION_|MIGRATIONS_|PROJECT_REF|GITHUB_HEAD_CHANGED)/.test(code);
    return json({ ok: false, schema: SCHEMA, build: BUILD, code }, authish ? 403 : clientish ? 400 : 500);
  }
});
