import { createClient } from "jsr:@supabase/supabase-js@2.112.4";

const PUBLIC_SPKI_B64 = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE/suDKmZG7B52xCVkCooS5MZfvVu+GjYTIfeOvlfi9tz29TQNN4uea318Nn2xf5uf/cm0bpaCADPwkqWSZV2MIA==";
const API_BASE = "https://api.supabase.com/v1";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type,x-license-key,x-device-id,authorization",
  "Access-Control-Allow-Methods": "POST,OPTIONS"
};
const enc = new TextEncoder();
const dec = new TextDecoder();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
}
function unb64url(value: string) {
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
function admin() {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = serviceKey();
  if (!url || !key) throw new Error("BACKEND_NOT_CONFIGURED");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
async function publicKey() {
  const der = Uint8Array.from(atob(PUBLIC_SPKI_B64), c => c.charCodeAt(0));
  return crypto.subtle.importKey("spki", der, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
}
async function verifyToken(token: string) {
  const [prefix, payloadPart, sigPart] = token.trim().split(".");
  if (prefix !== "LD2" || !payloadPart || !sigPart) throw new Error("KEY_INVALID_FORMAT");
  const ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, await publicKey(), unb64url(sigPart), enc.encode(payloadPart));
  if (!ok) throw new Error("KEY_INVALID_SIGNATURE");
  const payload = JSON.parse(dec.decode(unb64url(payloadPart)));
  if (payload?.aud !== "lovable-decrypter" || Number(payload?.v) !== 1 || !payload?.license_id) throw new Error("KEY_INVALID_PAYLOAD");
  return payload;
}
async function authorize(req: Request, sb: any) {
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const token = String(req.headers.get("x-license-key") || bearer).trim();
  const deviceId = String(req.headers.get("x-device-id") || "").trim();
  if (!token) throw new Error("KEY_REQUIRED");
  if (!deviceId) throw new Error("DEVICE_REQUIRED");
  const signed = await verifyToken(token);
  const { data: license, error } = await sb.from("ld_license_keys").select("id,status,expires_at,credit_balance,credit_debt").eq("id", String(signed.license_id)).eq("key_hash", await shaHex(token)).maybeSingle();
  if (error) throw new Error("DB_ERROR");
  if (!license) throw new Error("KEY_NOT_REGISTERED");
  if (license.status !== "active") throw new Error(`KEY_${String(license.status).toUpperCase()}`);
  const timeActive = Boolean(license.expires_at && Date.parse(license.expires_at) > Date.now());
  const creditActive = !timeActive && Number(license.credit_debt || 0) === 0 && Number(license.credit_balance || 0) > 0;
  if (!timeActive && !creditActive) throw new Error("ENTITLEMENT_EXHAUSTED");
  const deviceHash = await shaHex(deviceId);
  const { data: device, error: deviceError } = await sb.from("ld_license_devices").select("id,revoked_at").eq("license_id", license.id).eq("device_hash", deviceHash).maybeSingle();
  if (deviceError) throw new Error("DB_ERROR");
  if (!device) throw new Error("DEVICE_NOT_BOUND");
  if (device.revoked_at) throw new Error("DEVICE_REVOKED");
  return { licenseId: license.id, deviceHash };
}
async function secret(sb: any, name: string) {
  const { data, error } = await sb.rpc("ld_backend_secret", { p_name: name });
  if (error || !data) throw new Error(`SECRET_MISSING:${name}`);
  return String(data);
}
async function storeSecret(sb: any, name: string, value: string) {
  const { error } = await sb.rpc("ld_backend_secret_set", { p_name: name, p_value: value, p_description: "Lovable Decrypter Supabase OAuth refresh token" });
  if (error) throw new Error(`SECRET_STORE_FAILED:${name}`);
}
async function session(sb: any, licenseId: string, deviceHash: string) {
  const { data: config, error: configError } = await sb.from("ld_supabase_oauth_config").select("client_id").eq("singleton", true).maybeSingle();
  if (configError || !config?.client_id) throw new Error("SUPABASE_OAUTH_APP_NOT_CONFIGURED");
  const { data: connection, error } = await sb.from("ld_supabase_connections").select("*").eq("license_id", licenseId).eq("device_hash", deviceHash).maybeSingle();
  if (error) throw new Error("CONNECTION_READ_FAILED");
  if (!connection) throw new Error("SUPABASE_NOT_CONNECTED");
  const refresh = await secret(sb, String(connection.refresh_secret_name));
  const clientSecret = await secret(sb, "LD_SUPABASE_OAUTH_CLIENT_SECRET");
  const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: refresh });
  const response = await fetch(`${API_BASE}/oauth/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${btoa(`${config.client_id}:${clientSecret}`)}`, "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body
  });
  const token = await response.json().catch(() => null);
  if (!response.ok || !token?.access_token) throw new Error(`TOKEN_REFRESH_FAILED:${response.status}`);
  if (token.refresh_token && String(token.refresh_token) !== refresh) await storeSecret(sb, String(connection.refresh_secret_name), String(token.refresh_token));
  return String(token.access_token);
}
async function management(accessToken: string, path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json", ...(options.headers || {}) } });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`SUPABASE_MANAGEMENT_HTTP_${response.status}:${data?.message || data?.error || "request failed"}`);
  return data;
}
function normalize(project: any) {
  return {
    ref: String(project?.ref || project?.id || ""),
    id: String(project?.id || project?.ref || ""),
    name: String(project?.name || project?.ref || ""),
    organization_id: String(project?.organization_id || ""),
    organization_slug: String(project?.organization_slug || ""),
    region: String(project?.region || ""),
    status: String(project?.status || ""),
    created_at: String(project?.created_at || ""),
    url: project?.ref ? `https://${project.ref}.supabase.co` : ""
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ ok: false, code: "METHOD_NOT_ALLOWED" }, 405);
  const sb = admin();
  try {
    const auth = await authorize(req, sb);
    const body = await req.json().catch(() => ({}));
    if (String(body.action || "") !== "rename_project") return json({ ok: false, code: "UNKNOWN_ACTION" }, 400);
    const ref = String(body.project_ref || "").trim();
    const name = String(body.name || "").trim();
    if (!/^[a-z0-9]{8,32}$/i.test(ref)) return json({ ok: false, code: "PROJECT_REF_INVALID" }, 400);
    if (name.length < 2 || name.length > 80) return json({ ok: false, code: "PROJECT_NAME_INVALID" }, 400);
    const accessToken = await session(sb, auth.licenseId, auth.deviceHash);
    const projects = await management(accessToken, "/projects");
    if (!Array.isArray(projects) || !projects.some((p: any) => String(p.ref || p.id || "") === ref)) return json({ ok: false, code: "PROJECT_NOT_AUTHORIZED" }, 403);
    const updated = await management(accessToken, `/projects/${encodeURIComponent(ref)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    return json({ ok: true, project: normalize(updated), renamed: true });
  } catch (error) {
    console.error("ld-supabase-project-rename", error);
    const code = String((error as Error)?.message || "INTERNAL_ERROR");
    const status = /KEY_|DEVICE_|ENTITLEMENT|NOT_AUTHORIZED/.test(code) ? 403 : 500;
    return json({ ok: false, code }, status);
  }
});
