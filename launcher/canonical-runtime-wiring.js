(() => {
  'use strict';

  if (window.__LD_CANONICAL_RUNTIME_WIRING__) return;
  window.__LD_CANONICAL_RUNTIME_WIRING__ = true;

  const VERSION = chrome.runtime.getManifest().version;
  const BUILD = Number(String(VERSION).split('.').at(-1)) || 83;
  const HOST_ID = 'lovable-decrypter-launcher';

  const asError = error => ({
    ok: false,
    code: String(error?.code || 'RUNTIME_UNAVAILABLE'),
    error: String(error?.message || error || 'Runtime indisponível')
  });

  async function safe(label, fn) {
    try {
      const data = await fn();
      return { ok: true, label, data: data ?? null };
    } catch (error) {
      return { label, ...asError(error) };
    }
  }

  function projectId() {
    return String(window.LovableDecrypterV2?.getProjectId?.() || '');
  }

  async function serviceWorkerStatus() {
    return safe('service-worker', async () => {
      if (!chrome?.runtime?.id) throw new Error('EXTENSION_RUNTIME_UNAVAILABLE');
      if (typeof window.LovableDecrypterV2?.settings !== 'function') throw new Error('CORE_CLIENT_NOT_LOADED');
      await window.LovableDecrypterV2.settings();
      return { reachable: true, version: chrome.runtime.getManifest().version };
    });
  }

  async function integrationStatus() {
    const gate = window.LovableDecrypterAccountIntegrationGate;
    if (!gate?.status) return { ok: false, code: 'CLIENT_NOT_LOADED', error: 'Account Integration Gate não carregado.' };
    return safe('integrations', () => gate.status(projectId()));
  }

  const READ_ONLY_MODULES = Object.freeze({
    github: async () => integrationStatus(),
    supabase: async () => integrationStatus(),
    lovable: async () => integrationStatus(),
    gemini: async () => serviceWorkerStatus(),
    'project-state': async () => window.LovableDecrypterCanonicalProjectStateApi?.snapshot
      ? safe('project-state', () => window.LovableDecrypterCanonicalProjectStateApi.snapshot())
      : asError('Canonical Project State client não carregado.'),
    'git-history': async () => serviceWorkerStatus(),
    'context-pack': async () => window.LovableDecrypterCanonicalContextScopeApi?.status
      ? safe('context-scope', () => window.LovableDecrypterCanonicalContextScopeApi.status())
      : asError('Canonical Context + Scope client não carregado.'),
    'local-agent': async () => {
      const agent = window.LovableDecrypterLocalAgent;
      if (!agent?.status) return asError('Local Agent client não carregado.');
      const [agentStatus, modelStatus] = await Promise.all([
        safe('local-agent', () => agent.status()),
        agent.runtimeStatus ? safe('local-model', () => agent.runtimeStatus()) : Promise.resolve(asError('Local Model client não carregado.'))
      ]);
      return { ok: agentStatus.ok, label: 'local-agent', data: { agent: agentStatus, model: modelStatus } };
    },
    'scope-intelligence': async () => window.LovableDecrypterCanonicalContextScopeApi?.status
      ? safe('context-scope', () => window.LovableDecrypterCanonicalContextScopeApi.status())
      : asError('Canonical Context + Scope client não carregado.'),
    continuity: async () => window.LovableDecrypterContinuity?.status
      ? safe('continuity', () => window.LovableDecrypterContinuity.status())
      : asError('Continuity client não carregado.'),
    'tool-runtime': async () => window.LovableDecrypterCanonicalToolsApi?.snapshot
      ? safe('tool-runtime', () => window.LovableDecrypterCanonicalToolsApi.snapshot())
      : asError('Canonical Tool Runtime client não carregado.'),
    'mcp-runtime': async () => window.LovableDecrypterMCP?.status
      ? safe('mcp-runtime', () => window.LovableDecrypterMCP.status())
      : asError('MCP Runtime client não carregado.'),
    'agent-sandbox': async () => serviceWorkerStatus(),
    'smart-undo': async () => window.LovableDecrypterReversibleOperations?.status
      ? safe('reversible-operations', () => window.LovableDecrypterReversibleOperations.status())
      : asError('Reversible Operations client não carregado.'),
    checkpoint: async () => window.LovableDecrypterContinuity?.status
      ? safe('checkpoints', () => window.LovableDecrypterContinuity.status())
      : asError('Continuity client não carregado.'),
    'runtime-events': async () => serviceWorkerStatus(),
    operations: async () => window.LovableDecrypterTools?.journal
      ? safe('operation-journal', () => window.LovableDecrypterTools.journal({ projectId: projectId(), limit: 20 }))
      : asError('Operation Journal client não carregado.'),
    security: async () => serviceWorkerStatus(),
    updates: async () => serviceWorkerStatus(),
    account: async () => integrationStatus(),
    community: async () => ({ ok: true, label: 'community', data: { runtimeRequired: false } }),
    settings: async () => serviceWorkerStatus()
  });

  async function status(moduleId) {
    const getter = READ_ONLY_MODULES[moduleId];
    if (!getter) return { ok: false, code: 'UNKNOWN_MODULE', error: `Módulo desconhecido: ${moduleId}` };
    try { return await getter(); }
    catch (error) { return asError(error); }
  }

  async function snapshot() {
    const sw = await serviceWorkerStatus();
    const integrations = await integrationStatus();
    return Object.freeze({
      schema: 'ld-canonical-runtime/1',
      build: BUILD,
      version: VERSION,
      projectId: projectId(),
      serviceWorker: sw,
      integrations,
      clients: Object.freeze({
        core: Boolean(window.LovableDecrypterV2),
        tools: Boolean(window.LovableDecrypterTools),
        canonicalTools: Boolean(window.LovableDecrypterCanonicalToolsApi),
        mcp: Boolean(window.LovableDecrypterMCP),
        context: Boolean(window.LovableDecrypterContext),
        canonicalContextScope: Boolean(window.LovableDecrypterCanonicalContextScopeApi),
        reversible: Boolean(window.LovableDecrypterReversibleOperations),
        continuity: Boolean(window.LovableDecrypterContinuity),
        localAgent: Boolean(window.LovableDecrypterLocalAgent),
        integrationGate: Boolean(window.LovableDecrypterAccountIntegrationGate),
        projectState: Boolean(window.LovableDecrypterCanonicalProjectStateApi),
        runtimeRegistry: Boolean(window.LovableDecrypterAgentRuntimeRegistry),
        portableSkills: Boolean(window.LovableDecrypterPortableSkills),
        sandbox: Boolean(window.LovableDecrypterAgentSandbox),
        nativeSessions: Boolean(window.LovableDecrypterNativeAgentSessions)
      })
    });
  }

  window.LovableDecrypterCanonicalRuntime = Object.freeze({
    schema: 'ld-canonical-runtime/1',
    build: BUILD,
    version: VERSION,
    projectId,
    snapshot,
    status
  });

  function compact(result) {
    if (!result?.ok) return result?.error || result?.code || 'Indisponível';
    const data = result.data;
    if (data == null) return 'Online';
    if (typeof data === 'string') return data.slice(0, 160);
    if (Array.isArray(data)) return `${data.length} item(ns)`;
    if (typeof data === 'object') {
      const keys = Object.keys(data).slice(0, 4);
      if (!keys.length) return 'Online';
      return keys.map(key => `${key}: ${typeof data[key] === 'object' ? 'ok' : String(data[key]).slice(0, 36)}`).join(' · ');
    }
    return String(data);
  }

  function findHost() {
    return document.getElementById(HOST_ID);
  }

  function delegated(moduleId) {
    return window.LovableDecrypterCanonicalIntegrations?.handles?.(moduleId) === true ||
      window.LovableDecrypterCanonicalProjectState?.handles?.(moduleId) === true ||
      window.LovableDecrypterCanonicalToolRuntime?.handles?.(moduleId) === true ||
      window.LovableDecrypterCanonicalContextScope?.handles?.(moduleId) === true;
  }

  async function refreshDetail(moduleId) {
    if (delegated(moduleId)) return;
    const host = findHost();
    const root = host?.shadowRoot;
    const detail = root?.getElementById('detail');
    if (!detail || detail.dataset.module !== moduleId) return;

    const state = detail.querySelector('.state');
    const rows = [...detail.querySelectorAll('.row')];
    const foot = detail.querySelector('.foot');
    if (state) {
      state.textContent = 'VERIFICANDO';
      state.dataset.runtime = 'checking';
    }

    const result = await status(moduleId);
    if (!detail.isConnected || detail.dataset.module !== moduleId || delegated(moduleId)) return;

    if (state) {
      state.textContent = result.ok ? 'ONLINE' : 'INDISPONÍVEL';
      state.dataset.runtime = result.ok ? 'online' : 'offline';
    }
    if (rows[0]) {
      const value = rows[0].querySelector('b');
      const tail = rows[0].querySelector('small');
      if (value) value.textContent = result.ok ? 'Runtime moderno conectado' : 'Runtime indisponível';
      if (tail) tail.textContent = result.ok ? 'LIVE' : 'OFF';
    }
    if (rows[1]) {
      const value = rows[1].querySelector('b');
      const tail = rows[1].querySelector('small');
      if (value) value.textContent = 'Canonical Runtime Bridge';
      if (tail) tail.textContent = `B${BUILD}`;
    }
    if (rows[2]) {
      const value = rows[2].querySelector('b');
      const tail = rows[2].querySelector('small');
      if (value) value.textContent = compact(result);
      if (tail) tail.textContent = result.ok ? 'READ' : 'ERRO';
    }
    if (foot) {
      foot.textContent = result.ok
        ? `${moduleId} · leitura real do runtime preservado · Build ${BUILD}. Escritas continuam protegidas pelos gates existentes.`
        : `${moduleId} · ${result.error || result.code || 'runtime indisponível'}`;
    }
  }

  function moduleFromTarget(root, target) {
    const action = target.closest?.('.action');
    if (action) return root.getElementById('detail')?.dataset.module || '';
    const item = target.closest?.('.fly-item');
    if (item?.dataset?.item) return item.dataset.item;
    const rail = target.closest?.('.rail-btn');
    if (!rail) return '';
    return rail.dataset.kind === 'direct' ? rail.dataset.id : '';
  }

  function bindCanonicalUi() {
    const host = findHost();
    const root = host?.shadowRoot;
    if (!root || root.__ldCanonicalRuntimeWired) return false;
    root.__ldCanonicalRuntimeWired = true;

    root.addEventListener('click', event => {
      const moduleId = moduleFromTarget(root, event.target);
      if (!moduleId || delegated(moduleId)) return;
      const action = event.target.closest?.('.action');
      if (action) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      queueMicrotask(() => refreshDetail(moduleId));
    }, true);

    root.addEventListener('pointerover', event => {
      const moduleId = moduleFromTarget(root, event.target);
      if (moduleId && !delegated(moduleId)) queueMicrotask(() => refreshDetail(moduleId));
    }, true);

    const fab = root.getElementById('fab');
    if (fab) fab.title = `Lovable Decrypter v${VERSION}`;
    host.setAttribute('data-ld-runtime-wiring', `canonical-v${BUILD}`);
    host.setAttribute('data-ld-version', VERSION);
    window.dispatchEvent(new CustomEvent('ld:canonical-runtime-ready', { detail: { build: BUILD, version: VERSION } }));
    return true;
  }

  if (!bindCanonicalUi()) document.addEventListener('DOMContentLoaded', bindCanonicalUi, { once: true });
})();
