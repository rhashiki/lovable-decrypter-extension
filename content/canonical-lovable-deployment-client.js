(() => {
  'use strict';
  if (window.__LD100_CANONICAL_LOVABLE_DEPLOYMENT_CLIENT__) return;
  window.__LD100_CANONICAL_LOVABLE_DEPLOYMENT_CLIENT__ = true;

  const PORT = 'ld2-lovable-deployment';
  const BUILD = 100;
  function projectId() { return String(window.LovableDecrypterV2?.getProjectId?.() || ''); }

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
        const error = new Error(`LOVABLE_DEPLOY_TIMEOUT:${action}`);
        error.code = action === 'publish' ? 'LOVABLE_DEPLOY_OUTCOME_AMBIGUOUS' : 'LOVABLE_DEPLOY_TIMEOUT';
        error.verificationRequired = action === 'publish';
        finish(reject, error);
      }, Math.max(5000, timeoutMs));
      port.onMessage.addListener(message => {
        if (message?.id !== id) return;
        if (message.ok) finish(resolve, message.data);
        else {
          const error = new Error(message?.error || 'LOVABLE_DEPLOY_FAILED');
          error.code = message?.code || 'LOVABLE_DEPLOY_FAILED';
          error.verificationRequired = message?.verificationRequired === true;
          error.preflight = message?.preflight || null;
          error.receipt = message?.receipt || null;
          finish(reject, error);
        }
      });
      port.onDisconnect.addListener(() => {
        if (!settled) {
          const error = new Error(chrome.runtime.lastError?.message || 'LOVABLE_DEPLOY_DISCONNECTED');
          error.code = action === 'publish' ? 'LOVABLE_DEPLOY_OUTCOME_AMBIGUOUS' : 'LOVABLE_DEPLOY_DISCONNECTED';
          error.verificationRequired = action === 'publish';
          finish(reject, error);
        }
      });
      port.postMessage({ id, action, payload });
    });
  }

  async function status() { return request('status', { projectId: projectId() }, 30000); }
  async function preflight() { return request('preflight', { projectId: projectId() }, 90000); }
  async function prepare() { return request('prepare', { projectId: projectId() }, 90000); }
  async function publish(ticketId, options = {}) {
    if (options.humanDecision !== true) {
      const error = new Error('Confirmação humana explícita é obrigatória para publicar.');
      error.code = 'LOVABLE_DEPLOY_HUMAN_CONFIRMATION_REQUIRED';
      throw error;
    }
    return request('publish', { ticketId: String(ticketId || ''), humanDecision: true }, 240000);
  }
  async function verify(receiptId) { return request('verify', { receiptId: String(receiptId || '') }, 120000); }
  async function rollback(receiptId, options = {}) {
    if (options.humanDecision !== true) {
      const error = new Error('Confirmação humana explícita é obrigatória para rollback de deploy.');
      error.code = 'LOVABLE_DEPLOY_ROLLBACK_HUMAN_CONFIRMATION_REQUIRED';
      throw error;
    }
    return request('rollback', { receiptId: String(receiptId || ''), humanDecision: true }, 180000);
  }
  async function redeploy(receiptId, options = {}) {
    if (options.humanDecision !== true) {
      const error = new Error('Confirmação humana explícita é obrigatória para redeploy.');
      error.code = 'LOVABLE_REDEPLOY_HUMAN_CONFIRMATION_REQUIRED';
      throw error;
    }
    return request('redeploy', { receiptId: String(receiptId || ''), humanDecision: true }, 240000);
  }

  window.LovableDecrypterCanonicalLovableDeploymentApi = Object.freeze({
    build: BUILD,
    schema: 'ld-lovable-deployment/1',
    projectId,
    status,
    preflight,
    prepare,
    publish,
    verify,
    rollback,
    redeploy,
    directProviderFetch: false,
    undocumentedEndpointAllowed: false,
    automaticPublish: false,
    publishAfterCommit: false,
    humanConfirmationRequired: true,
    ambiguousPublishRetryAllowed: false
  });
})();
