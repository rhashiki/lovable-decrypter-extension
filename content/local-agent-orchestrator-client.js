(() => {
  'use strict';
  if (window.__LD68_LOCAL_AGENT_CLIENT__) return;
  window.__LD68_LOCAL_AGENT_CLIENT__ = true;

  const AGENT_PORT = 'ld2-local-agent-orchestrator';
  const MODEL_PORT = 'ld2-local-model-runtime';

  function request(portName, action, payload = {}, timeoutMs = 600000) {
    return new Promise((resolve, reject) => {
      const port = chrome.runtime.connect({ name: portName });
      const id = crypto.randomUUID();
      let settled = false;
      const cleanup = () => { try { port.disconnect(); } catch (_) {} };
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        const error = new Error(`${action} excedeu o limite desta chamada.`);
        error.code = 'LOCAL_AGENT_CLIENT_TIMEOUT';
        reject(error);
      }, Math.max(5000, Math.min(900000, Number(timeoutMs || 600000))));

      port.onMessage.addListener(message => {
        if (message?.id !== id || settled) return;
        settled = true;
        clearTimeout(timer);
        cleanup();
        if (message.ok) resolve(message.data);
        else {
          const error = new Error(message?.error || 'LOCAL_AGENT_FAILED');
          error.code = message?.code || 'LOCAL_AGENT_FAILED';
          error.details = message?.details || null;
          reject(error);
        }
      });
      port.onDisconnect.addListener(() => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        const error = new Error(chrome.runtime.lastError?.message || 'Local Agent desconectado.');
        error.code = 'LOCAL_AGENT_DISCONNECTED';
        reject(error);
      });
      port.postMessage({ id, action, payload });
    });
  }

  function projectId() {
    return String(window.LovableDecrypterV2?.getProjectId?.() || location.pathname.match(/(?:projects?|project)\/([a-z0-9-]{6,})/i)?.[1] || '');
  }

  window.LovableDecrypterLocalAgent = Object.freeze({
    build: 68,
    schema: 'ld-local-agent/1',
    status() { return request(AGENT_PORT, 'status', {}, 30000); },
    runtimeStatus() { return request(MODEL_PORT, 'status', {}, 30000); },
    requestRuntimePermission() { return request(MODEL_PORT, 'request_permission', {}, 30000); },
    permissionStatus() { return request(MODEL_PORT, 'permission_status', {}, 30000); },
    setRuntimeToken(token) { return request(MODEL_PORT, 'set_token', { token: String(token || '') }, 30000); },
    clearRuntimeToken() { return request(MODEL_PORT, 'clear_token', {}, 30000); },
    health() { return request(MODEL_PORT, 'health', { includeMetrics: true }, 30000); },
    route(command, options = {}) {
      return request(MODEL_PORT, 'route', {
        command: String(command || ''),
        role: options.role || '',
        desiredTier: options.desiredTier || '',
        iteration: options.iteration || 0,
        failures: options.failures || 0,
        diagnosticsFailures: options.diagnosticsFailures || 0,
        contextFileCount: options.contextFileCount || 0
      }, 30000);
    },
    start(command, options = {}) {
      return request(AGENT_PORT, 'start', {
        command: String(command || ''),
        projectId: options.projectId || projectId(),
        mode: options.mode || 'build',
        maxIterations: options.maxIterations,
        explicitPaths: Array.isArray(options.explicitPaths) ? options.explicitPaths : [],
        skills: Array.isArray(options.skills) ? options.skills : [],
        includeKnowledge: options.includeKnowledge !== false,
        forceHumanApproval: options.forceHumanApproval === true
      }, options.timeoutMs || 600000);
    },
    approveWrite(taskId, proposalDigest, options = {}) {
      return request(AGENT_PORT, 'approve_write', {
        taskId,
        proposalDigest,
        humanDecision: true,
        humanIntentOverrides: Array.isArray(options.humanIntentOverrides) ? options.humanIntentOverrides : []
      }, options.timeoutMs || 600000);
    },
    resume(taskId, options = {}) {
      return request(AGENT_PORT, 'resume', {
        taskId,
        command: options.command || '',
        plan: options.plan || null,
        pendingProposal: options.pendingProposal || null,
        proposalDigest: options.proposalDigest || '',
        humanDecision: options.humanDecision === true,
        humanIntentOverrides: Array.isArray(options.humanIntentOverrides) ? options.humanIntentOverrides : [],
        explicitPaths: Array.isArray(options.explicitPaths) ? options.explicitPaths : [],
        skills: Array.isArray(options.skills) ? options.skills : [],
        includeKnowledge: options.includeKnowledge !== false,
        forceHumanApproval: options.forceHumanApproval === true
      }, options.timeoutMs || 600000);
    },
    get(taskId) { return request(AGENT_PORT, 'get', { taskId }, 30000); },
    list(options = {}) { return request(AGENT_PORT, 'list', { projectId: options.projectId || projectId(), limit: options.limit || 30 }, 30000); },
    cancel(taskId) { return request(AGENT_PORT, 'cancel', { taskId }, 30000); }
  });
})();
