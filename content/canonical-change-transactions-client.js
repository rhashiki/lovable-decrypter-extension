(() => {
  'use strict';

  if (window.__LD97_CANONICAL_CHANGE_TRANSACTIONS_CLIENT__) return;
  window.__LD97_CANONICAL_CHANGE_TRANSACTIONS_CLIENT__ = true;

  const PORT = 'ld2-change-transactions';
  const BUILD = 97;

  function projectId() {
    return String(window.LovableDecrypterV2?.getProjectId?.() || '');
  }

  function request(action, payload = {}, timeoutMs = 120000) {
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
        const error = new Error(`CHANGE_TRANSACTION_TIMEOUT:${action}`);
        error.code = 'CHANGE_TRANSACTION_TIMEOUT';
        finish(reject, error);
      }, Math.max(5000, timeoutMs));

      port.onMessage.addListener(message => {
        if (message?.id !== id) return;
        if (message.ok) finish(resolve, message.data);
        else {
          const error = new Error(message?.error || 'CHANGE_TRANSACTION_FAILED');
          error.code = message?.code || 'CHANGE_TRANSACTION_FAILED';
          finish(reject, error);
        }
      });
      port.onDisconnect.addListener(() => {
        if (!settled) finish(reject, new Error(chrome.runtime.lastError?.message || 'CHANGE_TRANSACTION_DISCONNECTED'));
      });
      port.postMessage({ id, action, payload });
    });
  }

  function reversible() {
    const api = window.LovableDecrypterReversibleOperations;
    if (!api?.preview || !api?.apply) {
      const error = new Error('Reversible Operations não carregado.');
      error.code = 'CHANGE_TRANSACTION_REVERSIBLE_RUNTIME_REQUIRED';
      throw error;
    }
    return api;
  }

  async function create(payload = {}) {
    const result = await request('create', { ...payload, projectId: projectId() });
    return result.transaction;
  }

  async function codeReview(transactionId, diff) {
    return (await request('code_review', { transactionId, diff })).transaction;
  }

  async function codeResult(transactionId, result = {}) {
    return request('code_result', {
      transactionId,
      status: result?.status || '',
      taskId: result?.run?.taskId || result?.taskId || ''
    });
  }

  async function databaseResult(transactionId, database = {}, options = {}) {
    return request('database_result', {
      transactionId,
      status: options.status || database?.status || database?.ticket?.status || '',
      verificationRequired: options.verificationRequired === true,
      database
    });
  }

  async function markError(transactionId, error) {
    if (!transactionId) return null;
    return request('error', {
      transactionId,
      code: error?.code || '',
      message: error?.message || String(error || ''),
      verificationRequired: error?.verificationRequired === true
    }).catch(() => null);
  }

  async function review(transactionId) {
    return (await request('review', { transactionId })).review;
  }

  async function list(limit = 60) {
    return (await request('list', { projectId: projectId(), limit }, 60000)).transactions || [];
  }

  async function get(transactionId) {
    return (await request('get', { transactionId })).transaction;
  }

  async function revertPreview(transactionId, options = {}) {
    const current = await review(transactionId);
    const committedWrites = (Array.isArray(current?.operations) ? current.operations : [])
      .filter(operation => operation?.mode === 'write' && operation?.status === 'ok' && operation?.commitSha);
    if (committedWrites.length > 1) {
      const error = new Error('Esta Change Transaction contém múltiplos commits. A Build 97 bloqueia reversão parcial; a orquestração transacional de múltiplos commits pertence à Build 99.');
      error.code = 'CHANGE_TRANSACTION_MULTI_COMMIT_REVERT_BLOCKED';
      error.commitCount = committedWrites.length;
      throw error;
    }
    if (!current?.reversibleOperationId || committedWrites.length !== 1) {
      const error = new Error('Esta transação ainda não possui exatamente um commit reversível no Operation Journal.');
      error.code = 'CHANGE_TRANSACTION_NOT_REVERSIBLE';
      throw error;
    }
    const preview = await reversible().preview(current.reversibleOperationId, {
      projectId: projectId(),
      direction: options.direction || 'undo',
      strategy: options.strategy || 'preserve'
    });
    return Object.freeze({ transactionId, sourceOperationId: current.reversibleOperationId, preview });
  }

  async function applyRevert(transactionId, sourceOperationId, preview, options = {}) {
    if (options.humanDecision !== true) {
      const error = new Error('Confirmação humana explícita é obrigatória para aplicar a reversão.');
      error.code = 'CHANGE_TRANSACTION_REVERT_HUMAN_DECISION_REQUIRED';
      throw error;
    }
    const previewId = String(preview?.previewId || preview?.ticket?.id || preview?.id || '');
    if (!previewId) {
      const error = new Error('Preview de reversão inválido ou expirado.');
      error.code = 'CHANGE_TRANSACTION_REVERT_PREVIEW_REQUIRED';
      throw error;
    }
    const applied = await reversible().apply(previewId, { confirmDestructive: options.confirmDestructive === true });
    const operationId = applied?.operationId || applied?.result?.operationId || '';
    const commitSha = applied?.commitSha || applied?.result?.commitSha || applied?.data?.commitSha || '';
    await request('recovery_result', {
      transactionId,
      status: 'completed',
      sourceOperationId,
      operationId,
      commitSha,
      direction: preview?.plan?.direction || 'undo',
      strategy: preview?.plan?.strategy || 'preserve',
      previewId
    });
    return Object.freeze({ applied, review: await review(transactionId) });
  }

  window.LovableDecrypterCanonicalChangeTransactionsApi = Object.freeze({
    build: BUILD,
    schema: 'ld-change-transaction/1',
    projectId,
    status: () => request('status', {}, 30000),
    create,
    codeReview,
    codeResult,
    databaseResult,
    markError,
    review,
    list,
    get,
    revertPreview,
    applyRevert,
    projectionOnly: true,
    writeAuthority: false,
    approvalAuthority: false,
    revertUsesReversibleOperations: true,
    multiCommitRevertFailsClosed: true,
    rawPromptPersistence: false,
    rawSqlPersistence: false,
    rawDiffPersistence: false
  });
})();
