(() => {
  'use strict';
  if (window.__LD98_CANONICAL_AUTONOMY_POLICY_CLIENT__) return;
  window.__LD98_CANONICAL_AUTONOMY_POLICY_CLIENT__ = true;

  const PORT = 'ld2-autonomy-policy';
  const BUILD = 98;

  function request(action, payload = {}, timeoutMs = 60000) {
    return new Promise((resolve, reject) => {
      const port = chrome.runtime.connect({ name: PORT });
      const id = crypto.randomUUID();
      let settled = false;
      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { port.disconnect(); } catch (_) {}
        fn(value);
      };
      const timer = setTimeout(() => {
        const error = new Error(`AUTONOMY_POLICY_TIMEOUT:${action}`);
        error.code = 'AUTONOMY_POLICY_TIMEOUT';
        finish(reject, error);
      }, Math.max(5000, timeoutMs));
      port.onMessage.addListener(message => {
        if (message?.id !== id) return;
        if (message.ok) finish(resolve, message.data);
        else {
          const error = new Error(message?.error || 'AUTONOMY_POLICY_FAILED');
          error.code = message?.code || 'AUTONOMY_POLICY_FAILED';
          finish(reject, error);
        }
      });
      port.onDisconnect.addListener(() => {
        if (!settled) finish(reject, new Error(chrome.runtime.lastError?.message || 'AUTONOMY_POLICY_DISCONNECTED'));
      });
      port.postMessage({ id, action, payload });
    });
  }

  window.LovableDecrypterCanonicalAutonomyPolicyApi = Object.freeze({
    build: BUILD,
    schema: 'ld-guided-autonomy-policy/1',
    status: () => request('status'),
    get: async () => (await request('get')).settings,
    setMode: async mode => (await request('set_mode', { mode })).settings,
    evaluate: async payload => (await request('evaluate', payload || {})).decision,
    modes: Object.freeze(['manual','guided','autonomous']),
    writer: false,
    approvalAuthority: false,
    callerSuppliedDecisionTrusted: false,
    safetyFloorMutable: false
  });
})();
