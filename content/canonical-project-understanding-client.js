(() => {
  'use strict';

  if (window.__LD96_CANONICAL_PROJECT_UNDERSTANDING_CLIENT__) return;
  window.__LD96_CANONICAL_PROJECT_UNDERSTANDING_CLIENT__ = true;

  const PORT = 'ld2-project-understanding';
  const BUILD = 96;
  const SCHEMA = 'ld-project-understanding-map/1';

  function projectId() {
    return String(window.LovableDecrypterV2?.getProjectId?.() || '');
  }

  function request(action, payload = {}, timeoutMs = 180000) {
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
        const error = new Error(`PROJECT_UNDERSTANDING_TIMEOUT:${action}`);
        error.code = 'PROJECT_UNDERSTANDING_TIMEOUT';
        finish(reject, error);
      }, Math.max(5000, timeoutMs));

      port.onMessage.addListener(message => {
        if (message?.id !== id) return;
        if (message.ok) finish(resolve, message.data);
        else {
          const error = new Error(message?.error || 'PROJECT_UNDERSTANDING_FAILED');
          error.code = message?.code || 'PROJECT_UNDERSTANDING_FAILED';
          finish(reject, error);
        }
      });
      port.onDisconnect.addListener(() => {
        if (!settled) finish(reject, new Error(chrome.runtime.lastError?.message || 'PROJECT_UNDERSTANDING_DISCONNECTED'));
      });
      port.postMessage({ id, action, payload: { projectId: projectId(), ...payload } });
    });
  }

  function normalize(map = {}) {
    return Object.freeze({
      schema: String(map.schema || SCHEMA),
      build: Number(map.build || BUILD),
      project: Object.freeze({ ...(map.project || {}) }),
      freshness: Object.freeze({ ...(map.freshness || {}) }),
      limits: Object.freeze({ ...(map.limits || {}) }),
      counts: Object.freeze({ ...(map.counts || {}) }),
      nodes: Object.freeze(Array.isArray(map.nodes) ? map.nodes : []),
      edges: Object.freeze(Array.isArray(map.edges) ? map.edges : []),
      provenance: Object.freeze({ ...(map.provenance || {}) }),
      runtime: Object.freeze({ ...(map.runtime || {}) })
    });
  }

  async function snapshot(options = {}) {
    const target = options?.category ? { category: String(options.category) } : null;
    return normalize(await request('snapshot', target ? { target } : {}));
  }

  async function refreshPath(path) {
    const value = String(path || '').trim();
    if (!value) {
      const error = new Error('Path obrigatório para refresh direcionado.');
      error.code = 'PROJECT_MAP_TARGET_PATH_REQUIRED';
      throw error;
    }
    return normalize(await request('refresh_target', { target: { path: value } }, 90000));
  }

  function nodesByType(map, type) {
    const expected = String(type || '').trim();
    return (map?.nodes || []).filter(item => item?.type === expected);
  }

  function relationsFor(map, nodeId) {
    const id = String(nodeId || '');
    return (map?.edges || []).filter(item => item?.from === id || item?.to === id);
  }

  window.LovableDecrypterCanonicalProjectUnderstandingApi = Object.freeze({
    build: BUILD,
    schema: SCHEMA,
    projectId,
    status: () => request('status'),
    snapshot,
    refreshPath,
    nodesByType,
    relationsFor,
    readOnly: true,
    writeAuthority: false,
    polling: false,
    mutationObserverMount: false,
    targetedRefresh: true,
    rawSourceExposed: false,
    modelInferenceRequired: false
  });
})();
