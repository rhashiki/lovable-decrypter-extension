import { createClient } from "jsr:@supabase/supabase-js@2.112.4";

const PUBLIC_SPKI_B64 = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE/suDKmZG7B52xCVkCooS5MZfvVu+GjYTIfeOvlfi9tz29TQNN4uea318Nn2xf5uf/cm0bpaCADPwkqWSZV2MIA==";
const API_BASE = "https://api.supabase.com/v1";
const TICKET_TTL_MS = 10 * 60 * 1000;
const MAX_SQL_CHARS = 150000;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type,x-license-key,x-device-id,authorization",
  "Access-Control-Allow-Methods": "POST,OPTIONS"
};
const enc = new TextEncoder();
const dec = new TextDecoder();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}
function b64urlDecode(value: string) {
  const s = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}
async function shaHex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(value));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}
function serviceKey() {
  const current = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (current) {
    try {
      const parsed = JSON.parse(current);
      if (parsed?.default) return String(parsed.default);
      const first = Object.values(parsed || {})[0];
      if (first) return String(first);
    } catch (_) {}
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}
function adminClient() {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = serviceKey();
  if (!url || !key) throw new Error("BACKEND_NOT_CONFIGURED");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
async function publicKey() {
  const der = Uint8Array.from(atob(PUBLIC_SPKI_B64), c => c.charCodeAt(0));
  return crypto.subtle.importKey("spki", der, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
}
async function verifyLicenseToken(token: string) {
  const [prefix, payloadPart, sigPart] = token.trim().split(".");
  if (prefix !== "LD2" || !payloadPart || !sigPart) throw new Error("KEY_INVALID_FORMAT");
  const ok = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    await publicKey(),
    b64urlDecode(sigPart),
    enc.encode(payloadPart)
  );
  if (!ok) throw new Error("KEY_INVALID_SIGNATURE");
  const payload = JSON.parse(dec.decode(b64urlDecode(payloadPart)));
  if (payload?.aud !== "lovable-decrypter" || Number(payload?.v) !== 1 || !payload?.license_id) throw new Error("KEY_INVALID_PAYLOAD");
  return payload;
}
async function authorize(req: Request, sb: any) {
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const token = String(req.headers.get("x-license-key") || bearer || "").trim();
  const deviceId = String(req.headers.get("x-device-id") || "").trim();
  if (!token) throw new Error("KEY_REQUIRED");
  if (!deviceId) throw new Error("DEVICE_REQUIRED");
  const signed = await verifyLicenseToken(token);
  const { data: license, error } = await sb.from("ld_license_keys")
    .select("id,status,expires_at,credit_balance,credit_debt")
    .eq("id", String(signed.license_id))
    .eq("key_hash", await shaHex(token))
    .maybeSingle();
  if (error) throw new Error("DB_ERROR");
  if (!license) throw new Error("KEY_NOT_REGISTERED");
  if (license.status !== "active") throw new Error(`KEY_${String(license.status).toUpperCase()}`);
  const timeActive = Boolean(license.expires_at && Date.parse(license.expires_at) > Date.now());
  const creditActive = !timeActive && Number(license.credit_debt || 0) === 0 && Number(license.credit_balance || 0) > 0;
  if (!timeActive && !creditActive) throw new Error("ENTITLEMENT_EXHAUSTED");
  const deviceHash = await shaHex(deviceId);
  const { data: device, error: deviceError } = await sb.from("ld_license_devices")
    .select("id,revoked_at")
    .eq("license_id", license.id)
    .eq("device_hash", deviceHash)
    .maybeSingle();
  if (deviceError) throw new Error("DB_ERROR");
  if (!device) throw new Error("DEVICE_NOT_BOUND");
  if (device.revoked_at) throw new Error("DEVICE_REVOKED");
  return { licenseId: String(license.id), deviceHash };
}
async function backendSecret(sb: any, name: string) {
  const { data, error } = await sb.rpc("ld_backend_secret", { p_name: name });
  if (error || !data) throw new Error(`SECRET_MISSING:${name}`);
  return String(data);
}
async function storeSecret(sb: any, name: string, value: string, description: string) {
  const { error } = await sb.rpc("ld_backend_secret_set", { p_name: name, p_value: value, p_description: description });
  if (error) throw new Error(`SECRET_STORE_FAILED:${name}`);
}
async function oauthConfig(sb: any) {
  const { data, error } = await sb.from("ld_supabase_oauth_config").select("client_id").eq("singleton", true).maybeSingle();
  if (error) throw new Error("OAUTH_CONFIG_READ_FAILED");
  if (!data?.client_id) throw new Error("SUPABASE_OAUTH_APP_NOT_CONFIGURED");
  return data;
}
async function connection(sb: any, licenseId: string, deviceHash: string) {
  const { data, error } = await sb.from("ld_supabase_connections").select("refresh_secret_name,granted_scope")
    .eq("license_id", licenseId).eq("device_hash", deviceHash).maybeSingle();
  if (error) throw new Error("CONNECTION_READ_FAILED");
  if (!data) throw new Error("SUPABASE_NOT_CONNECTED");
  return data;
}
function basicAuth(clientId: string, secret: string) { return `Basic ${btoa(`${clientId}:${secret}`)}`; }
async function accessSession(sb: any, licenseId: string, deviceHash: string) {
  const config = await oauthConfig(sb);
  const row = await connection(sb, licenseId, deviceHash);
  const refresh = await backendSecret(sb, String(row.refresh_secret_name));
  const clientSecret = await backendSecret(sb, "LD_SUPABASE_OAUTH_CLIENT_SECRET");
  const response = await fetch(`${API_BASE}/oauth/token`, {
    method: "POST",
    headers: { Authorization: basicAuth(String(config.client_id), clientSecret), "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refresh })
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.access_token) throw new Error(`TOKEN_REFRESH_FAILED:${response.status}`);
  if (data.refresh_token && String(data.refresh_token) !== refresh) {
    await storeSecret(sb, String(row.refresh_secret_name), String(data.refresh_token), "Lovable Decrypter Supabase OAuth refresh token");
  }
  return { accessToken: String(data.access_token), scope: String(data.scope || row.granted_scope || "") };
}
function scopes(value: string) { return new Set(String(value || "").split(/[\s,]+/).map(x => x.trim()).filter(Boolean)); }
function requireScope(value: string, scope: string) {
  if (!scopes(value).has(scope)) throw new Error(`SUPABASE_SCOPE_REQUIRED:${scope}`);
}
async function managementRequest(accessToken: string, path: string, options: RequestInit = {}, timeoutMs = 60000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(5000, Math.min(120000, timeoutMs)));
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      signal: controller.signal,
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json", ...(options.headers || {}) },
      cache: "no-store",
      redirect: "error"
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(`SUPABASE_MANAGEMENT_HTTP_${response.status}:${data?.message || data?.error || "request failed"}`);
    return data;
  } catch (error) {
    if ((error as Error)?.name === "AbortError") throw new Error("SUPABASE_MANAGEMENT_TIMEOUT");
    throw error;
  } finally { clearTimeout(timer); }
}
async function authorizedProject(accessToken: string, ref: string) {
  if (!/^[a-z0-9]{8,32}$/i.test(ref)) throw new Error("PROJECT_REF_INVALID");
  const data = await managementRequest(accessToken, "/projects");
  const projects = Array.isArray(data) ? data : [];
  const project = projects.find((item: any) => String(item?.ref || item?.id || "") === ref);
  if (!project) throw new Error("PROJECT_NOT_AUTHORIZED");
  return { ref, name: String(project.name || ref), status: String(project.status || "") };
}
function canonicalSql(value: unknown) {
  const sql = String(value || "").replace(/\u0000/g, "").trim();
  if (!sql) throw new Error("DATABASE_SQL_REQUIRED");
  if (sql.length > MAX_SQL_CHARS) throw new Error("DATABASE_SQL_TOO_LARGE");
  return sql;
}
function scrubComments(sql: string) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\r\n]*/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}
function classifySql(sql: string) {
  const clean = scrubComments(sql);
  const blockedPatterns: [RegExp,string][] = [
    [/\balter\s+system\b/i,"alter-system"],
    [/\bcopy\b[\s\S]*\bprogram\b/i,"copy-program"],
    [/\b(pg_read_file|pg_write_file|pg_ls_dir|lo_import|lo_export)\s*\(/i,"server-file-access"],
    [/\b(create|alter|drop)\s+(role|user)\b/i,"role-administration"],
    [/\bset\s+(role|session\s+authorization)\b/i,"role-switch"],
    [/\bcreate\s+(subscription|event\s+trigger)\b/i,"server-level-object"]
  ];
  const blocked = blockedPatterns.filter(([rx]) => rx.test(clean)).map(([,tag]) => tag);
  const destructivePatterns: [RegExp,string][] = [
    [/\bdrop\s+(table|schema|view|materialized\s+view|function|type|extension|policy)\b/i,"drop-object"],
    [/\btruncate\b/i,"truncate"],
    [/\balter\s+table[\s\S]*\bdrop\s+(column|constraint)\b/i,"alter-drop"],
    [/\bdisable\s+row\s+level\s+security\b/i,"disable-rls"],
    [/\brevoke\b/i,"revoke"],
    [/\bgrant\s+all\b/i,"grant-all"],
    [/\bdo\s+\$[^$]*\$/i,"dynamic-do"],
    [/\bsecurity\s+definer\b/i,"security-definer"]
  ];
  const destructive = destructivePatterns.filter(([rx]) => rx.test(clean)).map(([,tag]) => tag);
  if (/\bdelete\s+from\b/i.test(clean) && !/\bwhere\b/i.test(clean)) destructive.push("delete-without-where");
  if (/\bupdate\s+[a-z0-9_".]+\s+set\b/i.test(clean) && !/\bwhere\b/i.test(clean)) destructive.push("update-without-where");
  const cautionPatterns: [RegExp,string][] = [
    [/\bcreate\s+table\b/i,"create-table"], [/\balter\s+table\b/i,"alter-table"],
    [/\bcreate\s+(unique\s+)?index\b/i,"create-index"], [/\bcreate\s+(or\s+replace\s+)?(view|function)\b/i,"create-programmable-object"],
    [/\bcreate\s+(policy|type|extension)\b/i,"create-db-object"], [/\b(enable|force)\s+row\s+level\s+security\b/i,"rls-change"],
    [/\bgrant\b/i,"grant"], [/\binsert\s+into\b/i,"insert"], [/\bupdate\s+[a-z0-9_".]+\s+set\b/i,"update"], [/\bdelete\s+from\b/i,"delete"]
  ];
  const caution = cautionPatterns.filter(([rx]) => rx.test(clean)).map(([,tag]) => tag);
  const readOnly = /^\s*(select|with\b[\s\S]*\bselect\b|explain|show)\b/i.test(clean) && !/\b(insert|update|delete|create|alter|drop|truncate|grant|revoke)\b/i.test(clean);
  let risk = blocked.length ? "BLOCKED" : destructive.length ? "DESTRUCTIVE" : caution.length ? "CAUTION" : readOnly ? "SAFE" : "DESTRUCTIVE";
  const notes: string[] = [];
  if (/\bcreate\s+table\b/i.test(clean) && !/\benable\s+row\s+level\s+security\b/i.test(clean)) notes.push("CREATE TABLE sem ENABLE ROW LEVEL SECURITY no mesmo plano; revisar RLS explicitamente.");
  if (/\bcreate\s+table\b/i.test(clean) && !/\bgrant\b/i.test(clean)) notes.push("CREATE TABLE sem GRANT explícito; revisar exposição necessária na Data API separadamente do RLS.");
  if (!readOnly && !blocked.length && !caution.length && !destructive.length) notes.push("SQL não reconhecido pelo classificador; tratado como DESTRUCTIVE por segurança.");
  return { risk, blocked, destructive, caution, readOnly, notes };
}
const INTROSPECTION_SQL = `
with tables as (
  select n.nspname as schema_name, c.relname as table_name, c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where c.relkind in ('r','p') and n.nspname not in ('pg_catalog','information_schema','pg_toast')
), cols as (
  select table_schema as schema_name, table_name,
    jsonb_agg(jsonb_build_object('name',column_name,'type',data_type,'nullable',is_nullable='YES','default',column_default) order by ordinal_position) as columns
  from information_schema.columns
  where table_schema not in ('pg_catalog','information_schema') group by table_schema,table_name
), policies as (
  select schemaname as schema_name, tablename as table_name,
    jsonb_agg(jsonb_build_object('name',policyname,'roles',roles,'cmd',cmd,'qual',qual,'with_check',with_check) order by policyname) as policies
  from pg_policies group by schemaname,tablename
), grants as (
  select table_schema as schema_name, table_name,
    jsonb_agg(distinct jsonb_build_object('grantee',grantee,'privilege',privilege_type)) as grants
  from information_schema.role_table_grants
  where grantee in ('anon','authenticated','service_role') group by table_schema,table_name
)
select t.schema_name,t.table_name,t.rls_enabled,t.rls_forced,
  coalesce(c.columns,'[]'::jsonb) as columns,
  coalesce(p.policies,'[]'::jsonb) as policies,
  coalesce(g.grants,'[]'::jsonb) as grants
from tables t left join cols c using(schema_name,table_name) left join policies p using(schema_name,table_name) left join grants g using(schema_name,table_name)
order by t.schema_name,t.table_name limit 300`;
async function queryProject(accessToken: string, ref: string, query: string, timeoutMs = 60000) {
  return managementRequest(accessToken, `/projects/${encodeURIComponent(ref)}/database/query`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query })
  }, timeoutMs);
}
async function readTicket(sb: any, auth: any, ticketId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(ticketId)) throw new Error("DATABASE_TICKET_INVALID");
  const { data, error } = await sb.from("ld_database_write_tickets").select("*")
    .eq("id", ticketId).eq("license_id", auth.licenseId).eq("device_hash", auth.deviceHash).maybeSingle();
  if (error) throw new Error("DATABASE_TICKET_READ_FAILED");
  if (!data) throw new Error("DATABASE_TICKET_NOT_FOUND");
  if (Date.parse(String(data.expires_at || "")) <= Date.now() && !["applied","verification_required"].includes(String(data.status))) {
    await sb.from("ld_database_write_tickets").update({ status: "expired", updated_at: new Date().toISOString() }).eq("id", ticketId).eq("status", data.status);
    throw new Error("DATABASE_TICKET_EXPIRED");
  }
  return data;
}
function publicTicket(ticket: any) {
  return {
    id: String(ticket.id || ""), project_ref: String(ticket.project_ref || ""), sql_hash: String(ticket.sql_hash || ""),
    risk: String(ticket.risk || ""), status: String(ticket.status || ""), statement_summary: ticket.statement_summary || {},
    recovery_evidence_required: String(ticket.risk) === "DESTRUCTIVE", approved_at: ticket.approved_at || null,
    started_at: ticket.started_at || null, completed_at: ticket.completed_at || null, expires_at: ticket.expires_at || null,
    result_summary: ticket.result_summary || null, error_code: ticket.error_code || null, raw_sql_persisted: false
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ ok: false, code: "METHOD_NOT_ALLOWED" }, 405);
  const sb = adminClient();
  try {
    const auth = await authorize(req, sb);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "status");
    const session = await accessSession(sb, auth.licenseId, auth.deviceHash);

    if (action === "status") return json({ ok: true, schema: "ld-database-runtime/1", build: 95, connected: true, write_tickets: true, raw_sql_persistence: false, auto_retry_write: false });

    if (action === "introspect") {
      requireScope(session.scope, "database:read");
      const ref = String(body.project_ref || "").trim();
      const project = await authorizedProject(session.accessToken, ref);
      const rows = await queryProject(session.accessToken, ref, INTROSPECTION_SQL, 60000);
      return json({ ok: true, project, schema: Array.isArray(rows) ? rows.slice(0, 300) : rows, query_kind: "fixed-introspection", write: false });
    }

    if (action === "prepare") {
      requireScope(session.scope, "database:write");
      const ref = String(body.project_ref || "").trim();
      const project = await authorizedProject(session.accessToken, ref);
      const sql = canonicalSql(body.sql);
      const classification = classifySql(sql);
      if (classification.risk === "BLOCKED") return json({ ok: false, code: "DATABASE_SQL_BLOCKED", classification, project }, 403);
      const sqlHash = await shaHex(sql);
      const expiresAt = new Date(Date.now() + TICKET_TTL_MS).toISOString();
      const { data: ticket, error } = await sb.from("ld_database_write_tickets").insert({
        license_id: auth.licenseId,
        device_hash: auth.deviceHash,
        project_ref: ref,
        sql_hash: sqlHash,
        risk: classification.risk,
        statement_summary: classification,
        status: "prepared",
        expires_at: expiresAt
      }).select("*").single();
      if (error) throw new Error("DATABASE_TICKET_CREATE_FAILED");
      return json({ ok: true, project, ticket: publicTicket(ticket), classification });
    }

    if (action === "ticket") {
      const ticket = await readTicket(sb, auth, String(body.ticket_id || ""));
      return json({ ok: true, ticket: publicTicket(ticket) });
    }

    if (action === "approve") {
      if (body.human_decision !== true) return json({ ok: false, code: "DATABASE_HUMAN_APPROVAL_REQUIRED" }, 403);
      const ticket = await readTicket(sb, auth, String(body.ticket_id || ""));
      if (ticket.status !== "prepared") return json({ ok: false, code: "DATABASE_TICKET_STATUS_INVALID", ticket: publicTicket(ticket) }, 409);
      const evidence = String(body.recovery_evidence || "").trim().slice(0, 1200);
      if (ticket.risk === "DESTRUCTIVE" && (body.destructive_confirmation !== true || evidence.length < 8)) {
        return json({ ok: false, code: "DATABASE_DESTRUCTIVE_RECOVERY_REQUIRED" }, 403);
      }
      const { data: approved, error } = await sb.from("ld_database_write_tickets").update({
        status: "approved", recovery_evidence: evidence || null, approved_at: new Date().toISOString(), updated_at: new Date().toISOString()
      }).eq("id", ticket.id).eq("status", "prepared").select("*").maybeSingle();
      if (error || !approved) throw new Error("DATABASE_TICKET_APPROVAL_RACE");
      return json({ ok: true, ticket: publicTicket(approved) });
    }

    if (action === "run") {
      requireScope(session.scope, "database:write");
      const sql = canonicalSql(body.sql);
      const ticket = await readTicket(sb, auth, String(body.ticket_id || ""));
      if (ticket.status !== "approved") return json({ ok: false, code: "DATABASE_TICKET_NOT_APPROVED", ticket: publicTicket(ticket) }, 409);
      if (await shaHex(sql) !== String(ticket.sql_hash)) return json({ ok: false, code: "DATABASE_TICKET_SQL_MISMATCH" }, 409);
      await authorizedProject(session.accessToken, String(ticket.project_ref));
      const { data: running, error: lockError } = await sb.from("ld_database_write_tickets").update({
        status: "running", started_at: new Date().toISOString(), updated_at: new Date().toISOString()
      }).eq("id", ticket.id).eq("status", "approved").select("id").maybeSingle();
      if (lockError || !running) throw new Error("DATABASE_TICKET_CONSUME_RACE");
      try {
        const result = await queryProject(session.accessToken, String(ticket.project_ref), sql, 90000);
        const summary = { row_count: Array.isArray(result) ? result.length : null, response_kind: Array.isArray(result) ? "rows" : typeof result };
        const { data: applied } = await sb.from("ld_database_write_tickets").update({
          status: "applied", completed_at: new Date().toISOString(), result_summary: summary, updated_at: new Date().toISOString()
        }).eq("id", ticket.id).eq("status", "running").select("*").maybeSingle();
        return json({ ok: true, ticket: publicTicket(applied || { ...ticket, status: "applied", result_summary: summary }), result: summary, raw_result_persisted: false });
      } catch (error) {
        const code = String((error as Error)?.message || "DATABASE_RUN_FAILED").slice(0, 500);
        await sb.from("ld_database_write_tickets").update({
          status: "verification_required", completed_at: new Date().toISOString(), error_code: code, updated_at: new Date().toISOString()
        }).eq("id", ticket.id).eq("status", "running");
        return json({ ok: false, code: "DATABASE_WRITE_OUTCOME_AMBIGUOUS", verification_required: true, ticket_id: ticket.id }, 409);
      }
    }

    if (action === "verify") {
      requireScope(session.scope, "database:read");
      const ticket = await readTicket(sb, auth, String(body.ticket_id || ""));
      await authorizedProject(session.accessToken, String(ticket.project_ref));
      const rows = await queryProject(session.accessToken, String(ticket.project_ref), INTROSPECTION_SQL, 60000);
      return json({ ok: true, ticket: publicTicket(ticket), schema: Array.isArray(rows) ? rows.slice(0, 300) : rows, verification_only: true, automatic_retry: false });
    }

    return json({ ok: false, code: "UNKNOWN_ACTION" }, 400);
  } catch (error) {
    console.error("ld-database-runtime", error);
    const code = String((error as Error)?.message || "INTERNAL_ERROR");
    const status = /KEY_|DEVICE_|ENTITLEMENT|NOT_AUTHORIZED|SCOPE_REQUIRED/.test(code) ? 403 : /REQUIRED|INVALID|TOO_LARGE/.test(code) ? 400 : 500;
    return json({ ok: false, code }, status);
  }
});
