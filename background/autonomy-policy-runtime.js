import {
  AUTONOMY_POLICY_SCHEMA,
  AUTONOMY_POLICY_STORAGE_KEY,
  normalizeAutonomyMode,
  evaluateAutonomyPolicy,
  publicPolicySettings
} from '../core/guided-autonomy-policy.js';

const PORT_NAME = 'ld2-autonomy-policy';
const BUILD = 98;
const nowIso = () => new Date().toISOString();
const text = (value, max = 1200) => String(value ?? '').trim().slice(0, max);

export async function getAutonomyPolicySettings() {
  const stored = await chrome.storage.local.get(AUTONOMY_POLICY_STORAGE_KEY);
  const raw = stored?.[AUTONOMY_POLICY_STORAGE_KEY] || {};
  return publicPolicySettings({
    mode: normalizeAutonomyMode(raw?.mode || 'manual'),
    updatedAt: raw?.updatedAt || '',
    userSelected: raw?.userSelected === true
  });
}

async function setAutonomyPolicyMode(mode = 'manual') {
  const requested = String(mode || '').trim().toLowerCase();
  const normalized = normalizeAutonomyMode(requested);
  if (requested && requested !== normalized) {
    throw Object.assign(new Error('AUTONOMY_POLICY_MODE_INVALID'), { code: 'AUTONOMY_POLICY_MODE_INVALID' });
  }
  const record = { mode: normalized, updatedAt: nowIso(), userSelected: true };
  await chrome.storage.local.set({ [AUTONOMY_POLICY_STORAGE_KEY]: record });
  return publicPolicySettings(record);
}

async function handle(action, payload = {}) {
  const op = text(action || 'status', 80).toLowerCase();
  if (op === 'status') {
    return {
      schema: AUTONOMY_POLICY_SCHEMA,
      build: BUILD,
      settings: await getAutonomyPolicySettings(),
      deterministic: true,
      writer: false,
      approvalAuthority: false,
      callerSuppliedDecisionTrusted: false,
      safetyFloorMutable: false,
      databaseAutoApproval: false,
      deployAutoApproval: false,
      gitPushAutoApproval: false,
      destructiveAutoApproval: false
    };
  }
  if (op === 'get') return { settings: await getAutonomyPolicySettings() };
  if (op === 'set_mode') return { settings: await setAutonomyPolicyMode(payload?.mode) };
  if (op === 'evaluate') {
    const settings = await getAutonomyPolicySettings();
    return { decision: evaluateAutonomyPolicy({
      mode: settings.mode,
      capability: payload?.capability,
      tool: payload?.tool,
      input: payload?.input || {},
      action: payload?.action,
      riskSignals: payload?.riskSignals || {}
    }) };
  }
  throw Object.assign(new Error('AUTONOMY_POLICY_ACTION_INVALID'), { code: 'AUTONOMY_POLICY_ACTION_INVALID' });
}

export function installAutonomyPolicyRuntime() {
  if (globalThis.__LD98_AUTONOMY_POLICY_RUNTIME__) return;
  globalThis.__LD98_AUTONOMY_POLICY_RUNTIME__ = true;
  chrome.runtime.onConnect.addListener(port => {
    if (port.name !== PORT_NAME) return;
    const listener = async message => {
      const id = text(message?.id, 180);
      try { port.postMessage({ id, ok: true, data: await handle(message?.action, message?.payload || {}) }); }
      catch (error) {
        try { port.postMessage({ id, ok: false, error: error?.message || String(error), code: error?.code || 'AUTONOMY_POLICY_FAILED' }); } catch (_) {}
      }
    };
    port.onMessage.addListener(listener);
  });
  globalThis.LovableDecrypterAutonomyPolicyRuntime = Object.freeze({
    build: BUILD,
    schema: AUTONOMY_POLICY_SCHEMA,
    port: PORT_NAME,
    deterministic: true,
    writer: false,
    approvalAuthority: false
  });
}
