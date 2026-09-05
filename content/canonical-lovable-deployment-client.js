(() => {
  'use strict';
  if (window.__LD100_CANONICAL_LOVABLE_DEPLOYMENT_CLIENT__) return;
  window.__LD100_CANONICAL_LOVABLE_DEPLOYMENT_CLIENT__ = true;

  const PORT = 'ld2-lovable-deployment';
  const BUILD = 100;

  function projectId() {
    return String(window.LovableDecrypterV2?.getProjectId?.() || '');
  }

  function request(action, payload = {}, timeoutMs = 200000) {
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
        const error = new Error(`LOVABLE_DEPLOY_CLIENT_TIMEOUT:${action}`);
        error.code = action === 'run' ? 'LOVABLE_DEPLOY_OUTCOME_AMBIGUOUS' : 'LOVABLE_DEPLOY_CLIENT_TIMEOUT';
        error.verificationRequired = action === 'run';
        error.automaticRetry = false;
        finish(reject, error);
      }, Math.max(5000, timeoutMs));

      port.onMessage.addListener(message => {
        if (message?.id !== id) return;
        if (message.ok) finish(resolve, message.data);
        else {
          const error = new Error(message?.error || 'LOVABLE_DEPLOY_FAILED');
          error.code = message?.code || 'LOVABLE_DEPLOY_FAILED';
          error.verificationRequired = message?.verificationRequired === true;
          error.automaticRetry = false;
          error.origin = message?.origin || '';
          finish(reject, error);
        }
      });
      port.onDisconnect.addListener(() => {
        if (settled) return;
        const error = new Error(chrome.runtime.lastError?.message || 'LOVABLE_DEPLOY_RUNTIME_DISCONNECTED');
        error.code = action === 'run' ? 'LOVABLE_DEPLOY_OUTCOME_AMBIGUOUS' : 'LOVABLE_DEPLOY_RUNTIME_DISCONNECTED';
        error.verificationRequired = action === 'run';
        error.automaticRetry = false;
        finish(reject, error);
      });
      port.postMessage({ id, action, payload });
    });
  }

  function projectStateApi() {
    const api = window.LovableDecrypterCanonicalProjectStateApi;
    if (!api?.snapshot) {
      const error = new Error('Canonical Project State não carregado.');
      error.code = 'LOVABLE_DEPLOY_PROJECT_STATE_REQUIRED';
      throw error;
    }
    return api;
  }

  async function target() {
    const state = await projectStateApi().snapshot();
    const pid = String(state?.project?.id || projectId());
    if (!pid) {
      const error = new Error('Projeto Lovable não detectado.');
      error.code = 'LOVABLE_DEPLOY_PROJECT_REQUIRED';
      throw error;
    }
    const expectedCommitSha = String(state?.github?.headSha || '').trim().toLowerCase();
    if (!state?.github?.reachable || !expectedCommitSha) {
      const error = new Error('HEAD Git atual indisponível. Atualize o Project State antes de publicar.');
      error.code = 'LOVABLE_DEPLOY_GIT_HEAD_REQUIRED';
      throw error;
    }
    return Object.freeze({
      projectId: pid,
      expectedCommitSha,
      github: Object.freeze({
        fullName: String(state?.github?.fullName || ''),
        branch: String(state?.github?.branch || ''),
        reachable: state?.github?.reachable === true
      }),
      collectedAt: String(state?.collectedAt || '')
    });
  }

  async function status() {
    const resolved = await target().catch(error => ({ error }));
    const pid = resolved?.error ? projectId() : resolved.projectId;
    const runtime = await request('status', { projectId: pid }, 30000);
    return Object.freeze({
      ...runtime,
      target: resolved?.error ? null : resolved,
      targetError: resolved?.error ? { code: resolved.error.code || '', message: resolved.error.message || String(resolved.error) } : null
    });
  }

  async function configureScope() {
    const resolved = await target();
    return request('configure_scope', { projectId: resolved.projectId }, 30000);
  }

  async function preflight(options = {}) {
    const resolved = await target();
    return request('preflight', {
      projectId: resolved.projectId,
      expectedCommitSha: resolved.expectedCommitSha,
      transactionId: String(options.transactionId || '')
    }, 90000);
  }

  async function prepare(options = {}) {
    const resolved = await target();
    return request('prepare', {
      projectId: resolved.projectId,
      expectedCommitSha: resolved.expectedCommitSha,
      transactionId: String(options.transactionId || '')
    }, 120000);
  }

  async function approve(ticketId, options = {}) {
    if (options.humanDecision !== true) {
      const error = new Error('Aprovação humana explícita é obrigatória para publicar.');
      error.code = 'LOVABLE_DEPLOY_HUMAN_APPROVAL_REQUIRED';
      throw error;
    }
    return request('approve', { ticketId: String(ticketId || ''), humanDecision: true }, 90000);
  }

  async function run(ticketId) {
    return request('run', { ticketId: String(ticketId || '') }, 190000);
  }

  async function approveAndRun(ticketId, options = {}) {
    if (options.humanDecision !== true) {
      const error = new Error('Aprovação humana explícita é obrigatória para publicar.');
      error.code = 'LOVABLE_DEPLOY_HUMAN_APPROVAL_REQUIRED';
      throw error;
    }
    await approve(ticketId, { humanDecision: true });
    return run(ticketId);
  }

  async function verify(ticketId) {
    return request('verify', { ticketId: String(ticketId || '') }, 90000);
  }

  window.LovableDecrypterCanonicalLovableDeploymentApi = Object.freeze({
    build: BUILD,
    schema: 'ld-lovable-deployment/1',
    projectId,
    target,
    status,
    configureScope,
    preflight,
    prepare,
    approve,
    run,
    approveAndRun,
    verify,
    provider: 'lovable',
    transport: 'mcp',
    deployTool: 'deploy_project',
    deployAlwaysAsk: true,
    automaticDeployAfterMutation: false,
    automaticRetry: false,
    directPrivateRestPublishEndpointUsed: false,
    rawMcpResultPersistence: false,
    rollbackSupported: false
  });
})();
