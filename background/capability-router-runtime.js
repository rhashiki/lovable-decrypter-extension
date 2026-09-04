import { CAPABILITY_ROUTER_SCHEMA, CAPABILITIES, routeIntentCapabilities } from '../core/capability-router.js';

const PORT_NAME = 'ld2-capability-router';
const BUILD = 94;
const text = (value, max = 60000) => String(value ?? '').trim().slice(0, max);

async function handle(action, payload = {}) {
  const op = text(action, 80).toLowerCase();
  if (op === 'status') return {
    schema: CAPABILITY_ROUTER_SCHEMA,
    build: BUILD,
    capabilities: [...CAPABILITIES],
    routes: [...CAPABILITIES, 'MIXED', 'UNRESOLVED'],
    authority: 'classification-only',
    scopeExpansionAllowed: false,
    candidateRequiresConfirmation: true,
    automaticExecutionAllowed: false,
    automaticApprovalAllowed: false
  };
  if (op === 'route') return routeIntentCapabilities(payload?.command || '', {
    attachments: Array.isArray(payload?.attachments) ? payload.attachments : []
  });
  throw Object.assign(new Error('CAPABILITY_ROUTER_ACTION_INVALID'), { code: 'CAPABILITY_ROUTER_ACTION_INVALID' });
}

export function installCapabilityRouterRuntime() {
  if (globalThis.__LD94_CAPABILITY_ROUTER_RUNTIME__) return;
  globalThis.__LD94_CAPABILITY_ROUTER_RUNTIME__ = true;
  chrome.runtime.onConnect.addListener(port => {
    if (port.name !== PORT_NAME) return;
    const listener = async message => {
      const id = text(message?.id, 160);
      try { port.postMessage({ id, ok: true, data: await handle(message?.action || 'status', message?.payload || {}) }); }
      catch (error) {
        try { port.postMessage({ id, ok: false, error: error?.message || String(error), code: error?.code || 'CAPABILITY_ROUTER_FAILED' }); } catch (_) {}
      }
    };
    port.onMessage.addListener(listener);
  });
  globalThis.LovableDecrypterCapabilityRouterRuntime = Object.freeze({
    build: BUILD,
    schema: CAPABILITY_ROUTER_SCHEMA,
    port: PORT_NAME,
    authority: 'classification-only',
    scopeExpansionAllowed: false,
    writeAuthority: false
  });
}
