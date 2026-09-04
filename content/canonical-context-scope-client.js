(() => {
  'use strict';

  if (window.__LD87_CANONICAL_CONTEXT_SCOPE_CLIENT__) return;
  window.__LD87_CANONICAL_CONTEXT_SCOPE_CLIENT__ = true;

  const BUILD = 87;
  const SCHEMA = 'ld-canonical-context-scope/1';
  const SCOPE_PORT = 'ld2-scope-intelligence';

  function projectId() {
    return String(window.LovableDecrypterV2?.getProjectId?.() || '');
  }

  function contextApi() {
    const api = window.LovableDecrypterContext;
    if (!api?.status || !api?.userEdits || !api?.build) throw new Error('Context Engine client não carregado.');
    return api;
  }

  function scopeCall(action, payload = {}, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const port = chrome.runtime.connect({ name: SCOPE_PORT });
      const id = crypto.randomUUID();
      let settled = false;
      const done = (fn, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { port.disconnect(); } catch (_) {}
        fn(value);
      };
      const timer = setTimeout(() => {
        const error = new Error(`Scope Intelligence timeout: ${action}`);
        error.code = 'SCOPE_INTELLIGENCE_TIMEOUT';
        done(reject, error);
      }, Math.max(5000, Math.min(120000, Number(timeoutMs || 30000))));

      port.onMessage.addListener(message => {
        if (message?.id !== id) return;
        if (message?.ok) done(resolve, message.data);
        else {
          const error = new Error(message?.error || 'SCOPE_INTELLIGENCE_FAILED');
          error.code = message?.code || 'SCOPE_INTELLIGENCE_FAILED';
          error.scopeIntelligence = message?.scopeIntelligence || null;
          done(reject, error);
        }
      });
      port.onDisconnect.addListener(() => {
        if (!settled) done(reject, new Error(chrome.runtime.lastError?.message || 'Scope Intelligence desconectado.'));
      });
      port.postMessage({ id, action, payload });
    });
  }

  function compactEdits(result = {}) {
    return (Array.isArray(result?.edits) ? result.edits : []).slice(0, 80).map(edit => Object.freeze({
      id: String(edit?.id || ''),
      origin: String(edit?.origin || ''),
      observedAt: String(edit?.observedAt || ''),
      paths: Array.isArray(edit?.paths) ? edit.paths.map(String).slice(0, 30) : [],
      evidence: Array.isArray(edit?.evidence) ? edit.evidence.map(String).slice(0, 12) : []
    }));
  }

  function compactLocks(result = {}) {
    return (Array.isArray(result?.locks) ? result.locks : []).slice(0, 100).map(lock => Object.freeze({
      path: String(lock?.path || ''),
      level: lock?.level === 'strong' ? 'strong' : 'soft',
      count: Number(lock?.count || 0) || 0,
      lastObservedAt: String(lock?.lastObservedAt || ''),
      policy: String(lock?.policy || '')
    }));
  }

  async function status() {
    const [context, scope, editsResult, locksResult] = await Promise.all([
      contextApi().status(),
      scopeCall('status'),
      contextApi().userEdits(40),
      scopeCall('locks', { projectId: projectId() })
    ]);
    return Object.freeze({
      schema: SCHEMA,
      build: BUILD,
      projectId: projectId(),
      context,
      scope,
      recentUserEdits: compactEdits(editsResult),
      locks: compactLocks(locksResult)
    });
  }

  function selectedPaths(pack = {}) {
    const files = Array.isArray(pack?.files) ? pack.files : [];
    return [...new Set(files.map(file => String(file?.path || '')).filter(Boolean))];
  }

  async function build(task, options = {}) {
    const command = String(task || '').trim();
    if (!command) {
      const error = new Error('Informe uma tarefa para montar o Context Pack.');
      error.code = 'CONTEXT_TASK_REQUIRED';
      throw error;
    }
    const packResult = await contextApi().build(command, {
      projectId: options.projectId || projectId(),
      explicitPaths: Array.isArray(options.explicitPaths) ? options.explicitPaths : [],
      skills: Array.isArray(options.skills) ? options.skills : [],
      projectState: options.projectState && typeof options.projectState === 'object' ? options.projectState : {},
      diagnostics: options.diagnostics && typeof options.diagnostics === 'object' ? options.diagnostics : {},
      includeKnowledge: options.includeKnowledge !== false,
      maxFiles: options.maxFiles,
      maxContextBytes: options.maxContextBytes,
      maxCodeBytes: options.maxCodeBytes,
      timeoutMs: options.timeoutMs || 120000,
      onProgress: options.onProgress
    });
    const pack = packResult?.pack || {};
    const paths = selectedPaths(pack);
    const locksResult = await scopeCall('locks', { projectId: projectId() });
    const locks = compactLocks(locksResult);
    const lockByPath = new Map(locks.map(lock => [lock.path, lock]));
    const overlaps = paths.filter(path => lockByPath.has(path)).map(path => lockByPath.get(path));
    return Object.freeze({
      schema: SCHEMA,
      build: BUILD,
      task: command,
      pack,
      selectedPaths: paths,
      humanIntentLocks: locks,
      preflight: Object.freeze({
        schema: 'ld-context-scope-preflight/1',
        selectedFileCount: paths.length,
        lockOverlapCount: overlaps.length,
        lockOverlaps: overlaps,
        finalDiffValidationRequired: true,
        formalScopeEvaluationPerformed: false,
        note: 'Este preflight mostra sobreposição com edições humanas. A validação formal request→plan→diff ocorre após existir um diff preparado.'
      })
    });
  }

  function evaluate({ command = '', approvedPlan = {}, files = [], humanIntentOverrides = [], decision = 'approve' } = {}) {
    return scopeCall('evaluate', {
      projectId: projectId(),
      command,
      approvedPlan,
      files,
      humanIntentOverrides,
      decision
    }, 60000);
  }

  window.LovableDecrypterCanonicalContextScopeApi = Object.freeze({
    build: BUILD,
    schema: SCHEMA,
    projectId,
    status,
    build,
    evaluate,
    formalWriteAuthority: 'background-scope-intelligence-v2',
    directWriteAuthority: false
  });
})();
