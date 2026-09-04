import { createClient } from "jsr:@supabase/supabase-js@2.112.4";

const PUBLIC_SPKI_B64 = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE/suDKmZG7B52xCVkCooS5MZfvVu+GjYTIfeOvlfi9tz29TQNN4uea318Nn2xf5uf/cm0bpaCADPwkqWSZV2MIA==";
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
function b64urlDecode(value: string) {
  const raw = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(raw), c => c.charCodeAt(0));
}
async function sha(value: string) {
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
async function verifyLicenseToken(token: string) {
  const [prefix, payloadPart, sigPart] = token.trim().split(".");
  if (prefix !== "LD2" || !payloadPart || !sigPart) throw new Error("KEY_INVALID_FORMAT");
  const ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, await publicKey(), b64urlDecode(sigPart), enc.encode(payloadPart));
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
  const { data: license, error } = await sb.from("ld_license_keys").select("id,status,expires_at,credit_balance,credit_debt").eq("id", String(signed.license_id)).eq("key_hash", await sha(token)).maybeSingle();
  if (error) throw new Error("DB_ERROR");
  if (!license) throw new Error("KEY_NOT_REGISTERED");
  if (license.status !== "active") throw new Error(`KEY_${String(license.status).toUpperCase()}`);
  const timeActive = Boolean(license.expires_at && Date.parse(license.expires_at) > Date.now());
  const creditActive = !timeActive && Number(license.credit_debt || 0) === 0 && Number(license.credit_balance || 0) > 0;
  if (!timeActive && !creditActive) throw new Error("ENTITLEMENT_EXHAUSTED");
  const deviceHash = await sha(deviceId);
  const { data: device, error: deviceError } = await sb.from("ld_license_devices").select("id,revoked_at").eq("license_id", license.id).eq("device_hash", deviceHash).maybeSingle();
  if (deviceError) throw new Error("DB_ERROR");
  if (!device) throw new Error("DEVICE_NOT_BOUND");
  if (device.revoked_at) throw new Error("DEVICE_REVOKED");
  return { licenseId: String(license.id), deviceHash };
}
function normalizeGithub(values: unknown) {
  if (!Array.isArray(values)) throw new Error("SELECTION_INVALID");
  const out = [...new Set(values.map(v => String(v || "").trim()).filter(v => /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(v)))];
  if (out.length !== values.length || out.length > 500) throw new Error("SELECTION_INVALID");
  return out;
}
function normalizeSupabase(values: unknown) {
  if (!Array.isArray(values)) throw new Error("SELECTION_INVALID");
  const out = [...new Set(values.map(v => String(v || "").trim()).filter(v => /^[a-z0-9]{8,32}$/i.test(v)))];
  if (out.length !== values.length || out.length > 500) throw new Error("SELECTION_INVALID");
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ ok: false, code: "METHOD_NOT_ALLOWED" }, 405);
  const sb = admin();
  try {
    const auth = await authorize(req, sb);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "get");
    const integration = String(body.integration || "");
    if (!["github", "supabase"].includes(integration)) return json({ ok: false, code: "INTEGRATION_INVALID" }, 400);

    if (integration === "github") {
      const { data: row, error } = await sb.from("ld_github_installations").select("installation_id,selected_repositories").eq("license_id", auth.licenseId).maybeSingle();
      if (error) throw new Error("INSTALLATION_READ_FAILED");
      if (!row) return json({ ok: false, code: "GITHUB_NOT_CONNECTED" }, 409);
      if (action === "get") return json({ ok: true, integration, mode: row.selected_repositories === null ? "all" : "selected", selected: row.selected_repositories === null ? null : normalizeGithub(row.selected_repositories) });
      if (action === "set") {
        const selected = body.mode === "all" ? null : normalizeGithub(body.selected);
        const { error: updateError } = await sb.from("ld_github_installations").update({ selected_repositories: selected, updated_at: new Date().toISOString() }).eq("license_id", auth.licenseId);
        if (updateError) throw new Error("SELECTION_STORE_FAILED");
        return json({ ok: true, integration, mode: selected === null ? "all" : "selected", selected });
      }
    } else {
      const { data: row, error } = await sb.from("ld_supabase_connections").select("selected_projects").eq("license_id", auth.licenseId).eq("device_hash", auth.deviceHash).maybeSingle();
      if (error) throw new Error("CONNECTION_READ_FAILED");
      if (!row) return json({ ok: false, code: "SUPABASE_NOT_CONNECTED" }, 409);
      if (action === "get") return json({ ok: true, integration, mode: row.selected_projects === null ? "all" : "selected", selected: row.selected_projects === null ? null : normalizeSupabase(row.selected_projects) });
      if (action === "set") {
        const selected = body.mode === "all" ? null : normalizeSupabase(body.selected);
        const { error: updateError } = await sb.from("ld_supabase_connections").update({ selected_projects: selected, updated_at: new Date().toISOString() }).eq("license_id", auth.licenseId).eq("device_hash", auth.deviceHash);
        if (updateError) throw new Error("SELECTION_STORE_FAILED");
        return json({ ok: true, integration, mode: selected === null ? "all" : "selected", selected });
      }
    }
    return json({ ok: false, code: "UNKNOWN_ACTION" }, 400);
  } catch (error) {
    console.error("ld-integration-selection", error);
    const code = String((error as Error)?.message || "INTERNAL_ERROR");
    const status = /KEY_|DEVICE_|ENTITLEMENT/.test(code) ? 403 : /NOT_CONNECTED/.test(code) ? 409 : /INVALID/.test(code) ? 400 : 500;
    return json({ ok: false, code }, status);
  }
});