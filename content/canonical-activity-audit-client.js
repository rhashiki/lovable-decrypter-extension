(() => {
  'use strict';

  if (window.__LD91_CANONICAL_ACTIVITY_AUDIT_CLIENT__) return;
  window.__LD91_CANONICAL_ACTIVITY_AUDIT_CLIENT__ = true;

  const PORT = 'ld2-activity-audit';
  const BUILD = 91;
  const SCHEMA = 'ld-activity-audit/1';

  function request(action, payload = {}, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const port = chrome.runtime.connect({ name: PORT });
      const id = crypto.randomUUID();
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        try { port.disconnect(); } catch (_) {}
        reject(Object.assign(new Error(`ACTIVITY_AUDIT_TIMEOUT:${action}`), { code: 'ACTIVITY_AUDIT_TIMEOUT' }));
      }, Math.max(5000, Math.min(60000, Number(timeoutMs || 30000))));
      port.onMessage.addListener(message => {
        if (message?.id !== id || settled) return;
        settled = true;
        clearTimeout(timer);
        try { port.disconnect(); } catch (_) {}
        if (message?.ok) resolve(message.data);
        else reject(Object.assign(new Error(message?.error || 'ACTIVITY_AUDIT_FAILED'), { code: message?.code || 'ACTIVITY_AUDIT_FAILED' }));
      });
      port.onDisconnect.addListener(() => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(Object.assign(new Error(chrome.runtime.lastError?.message || 'ACTIVITY_AUDIT_DISCONNECTED'), { code: 'ACTIVITY_AUDIT_DISCONNECTED' }));
      });
      port.postMessage({ id, action, payload });
    });
  }

  function projectId() { return String(window.LovableDecrypterV2?.getProjectId?.() || ''); }

  window.LovableDecrypterCanonicalActivityAuditApi = Object.freeze({
    build: BUILD,
    schema: SCHEMA,
    projectId,
    status: () => request('status'),
    snapshot: (limit = 120) => request('snapshot', { projectId: projectId(), limit }),
    readOnly: true,
    rawPromptIncluded: false,
    rawModelOutputIncluded: false,
    rawFileContentIncluded: false,
    credentialsIncluded: false
  });
})();
