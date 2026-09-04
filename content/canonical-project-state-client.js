(() => {
  'use strict';

  if (window.__LD85_CANONICAL_PROJECT_STATE_CLIENT__) return;
  window.__LD85_CANONICAL_PROJECT_STATE_CLIENT__ = true;

  const PORT = 'ld2-project-state';

  function projectId() {
    return String(window.LovableDecrypterV2?.getProjectId?.() || '');
  }

  function request(action, payload = {}, timeoutMs = 70000) {
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
        const error = new Error(`PROJECT_STATE_TIMEOUT:${action}`);
        error.code = 'PROJECT_STATE_TIMEOUT';
        finish(reject, error);
      }, Math.max(5000, timeoutMs));

      port.onMessage.addListener(message => {
        if (message?.id !== id) return;
        if (message.ok) finish(resolve, message.data);
        else {
          const error = new Error(message?.error || 'PROJECT_STATE_FAILED');
          error.code = message?.code || 'PROJECT_STATE_FAILED';
          finish(reject, error);
        }
      });
      port.onDisconnect.addListener(() => {
        if (!settled) finish(reject, new Error(chrome.runtime.lastError?.message || 'PROJECT_STATE_DISCONNECTED'));
      });
      port.postMessage({ id, action, payload });
    });
  }

  function normalize(snapshot = {}) {
    return Object.freeze({
      schema: 'ld-canonical-project-state/1',
      collectedAt: String(snapshot.collectedAt || ''),
      project: Object.freeze({
        id: String(snapshot.project?.id || projectId()),
        detected: Boolean(snapshot.project?.detected),
        url: String(snapshot.project?.url || location.href)
      }),
      mappings: Object.freeze({
        github: snapshot.mappings?.github || null,
        supabase: snapshot.mappings?.supabase || null
      }),
      github: Object.freeze({ ...(snapshot.github || {}) }),
      supabase: Object.freeze({ ...(snapshot.supabase || {}) }),
      readiness: Object.freeze({ ...(snapshot.readiness || {}) }),
      ready: Boolean(snapshot.ready)
    });
  }

  async function snapshot() {
    const result = await request('canonical_snapshot', {
      projectId: projectId(),
      url: location.href
    });
    return normalize(result || {});
  }

  window.LovableDecrypterCanonicalProjectStateApi = Object.freeze({
    build: 85,
    schema: 'ld-canonical-project-state/1',
    projectId,
    snapshot,
    inspectSupabase(projectRef) {
      return request('inspect', { project_ref: String(projectRef || '') });
    }
  });
})();
