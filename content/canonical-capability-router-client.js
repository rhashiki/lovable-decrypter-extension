(() => {
  'use strict';

  if (window.__LD94_CANONICAL_CAPABILITY_ROUTER_CLIENT__) return;
  window.__LD94_CANONICAL_CAPABILITY_ROUTER_CLIENT__ = true;

  const BUILD = 94;
  const SCHEMA = 'ld-capability-router/1';
  const PORT_NAME = 'ld2-capability-router';

  function request(action, payload = {}, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const port = chrome.runtime.connect({ name: PORT_NAME });
      const id = crypto.randomUUID();
      let settled = false;
      const cleanup = () => { try { port.disconnect(); } catch (_) {} };
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        const error = new Error(`Capability Router timeout: ${action}`);
        error.code = 'CAPABILITY_ROUTER_TIMEOUT';
        reject(error);
      }, Math.max(3000, Math.min(60000, Number(timeoutMs || 30000))));

      port.onMessage.addListener(message => {
        if (message?.id !== id || settled) return;
        settled = true;
        clearTimeout(timer);
        cleanup();
        if (message?.ok) resolve(message.data);
        else {
          const error = new Error(message?.error || 'CAPABILITY_ROUTER_FAILED');
          error.code = message?.code || 'CAPABILITY_ROUTER_FAILED';
          reject(error);
        }
      });
      port.onDisconnect.addListener(() => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        const error = new Error(chrome.runtime.lastError?.message || 'Capability Router desconectado.');
        error.code = 'CAPABILITY_ROUTER_DISCONNECTED';
        reject(error);
      });
      port.postMessage({ id, action, payload });
    });
  }

  function attachmentManifest() {
    const snap = window.LovableDecrypterCanonicalAttachmentsVoiceApi?.snapshot?.();
    return Array.isArray(snap?.attachments) ? snap.attachments : [];
  }

  window.LovableDecrypterCapabilityRouter = Object.freeze({
    build: BUILD,
    schema: SCHEMA,
    status: () => request('status'),
    route(command, options = {}) {
      return request('route', {
        command: String(command || ''),
        attachments: Array.isArray(options.attachments) ? options.attachments : attachmentManifest()
      });
    },
    attachmentManifest,
    authority: 'classification-only',
    scopeExpansionAllowed: false,
    automaticExecutionAllowed: false,
    automaticApprovalAllowed: false,
    writeAuthority: false
  });
})();