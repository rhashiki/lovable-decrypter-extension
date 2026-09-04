(() => {
  'use strict';

  if (window.__LD95_CANONICAL_DATABASE_RUNTIME_CLIENT__) return;
  window.__LD95_CANONICAL_DATABASE_RUNTIME_CLIENT__ = true;

  const BUILD = 95;
  const SCHEMA = 'ld-canonical-database-runtime/1';
  const PORT = 'ld2-database-runtime';
  const MAX_SQL_CHARS = 150000;

  function projectId() {
    return String(window.LovableDecrypterV2?.getProjectId?.() || '');
  }

  function projectStateApi() {
    const api = window.LovableDecrypterCanonicalProjectStateApi;
    if (!api?.snapshot) {
      const error = new Error('Canonical Project State não carregado.');
      error.code = 'DATABASE_PROJECT_STATE_REQUIRED';
      throw error;
    }
    return api;
  }

  function canonicalSql(value) {
    const sql = String(value ?? '').replace(/\0/g, '').trim();
    if (!sql) {
      const error = new Error('SQL obrigatório para preparar a revisão.');
      error.code = 'DATABASE_SQL_REQUIRED';
      throw error;
    }
    if (sql.length > MAX_SQL_CHARS) {
      const error = new Error('SQL excede o limite seguro da Build 95.');
      error.code = 'DATABASE_SQL_TOO_LARGE';
      throw error;
    }
    return sql;
  }

  function request(action, payload = {}, timeoutMs = 130000) {
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
        const error = new Error(`DATABASE_CLIENT_TIMEOUT:${action}`);
        error.code = action === 'run' ? 'DATABASE_WRITE_OUTCOME_AMBIGUOUS' : 'DATABASE_CLIENT_TIMEOUT';
        error.verificationRequired = action === 'run';
        finish(reject, error);
      }, Math.max(5000, timeoutMs));

      port.onMessage.addListener(message => {
        if (message?.id !== id) return;
        if (message.ok) finish(resolve, message.data);
        else {
          const error = new Error(message?.error || 'DATABASE_RUNTIME_FAILED');
          error.code = message?.code || 'DATABASE_RUNTIME_FAILED';
          error.details = message?.details || null;
          error.verificationRequired = message?.verificationRequired === true || message?.details?.verification_required === true;
          finish(reject, error);
        }
      });
      port.onDisconnect.addListener(() => {
        if (!settled) {
          const error = new Error(chrome.runtime.lastError?.message || 'DATABASE_RUNTIME_DISCONNECTED');
          error.code = action === 'run' ? 'DATABASE_WRITE_OUTCOME_AMBIGUOUS' : 'DATABASE_RUNTIME_DISCONNECTED';
          error.verificationRequired = action === 'run';
          finish(reject, error);
        }
      });
      port.postMessage({ id, action, payload });
    });
  }

  async function mappedProject() {
    const snapshot = await projectStateApi().snapshot();
    const ref = String(snapshot?.mappings?.supabase?.projectRef || snapshot?.supabase?.projectRef || '').trim();
    if (!/^[a-z0-9]{8,32}$/i.test(ref)) {
      const error = new Error('Este projeto ainda não possui um projeto Supabase OAuth mapeado.');
      error.code = 'DATABASE_PROJECT_MAPPING_REQUIRED';
      error.projectState = snapshot;
      throw error;
    }
    return Object.freeze({
      projectId: projectId(),
      projectRef: ref,
      projectName: String(snapshot?.mappings?.supabase?.projectName || snapshot?.supabase?.projectName || ''),
      reachable: snapshot?.supabase?.reachable === true,
      snapshot
    });
  }

  async function status() {
    const [runtime, project] = await Promise.all([
      request('status'),
      mappedProject().catch(error => ({ error }))
    ]);
    return Object.freeze({
      ...runtime,
      mapped: !project?.error,
      project: project?.error ? null : project,
      mappingError: project?.error ? { code: project.error.code || '', message: project.error.message || String(project.error) } : null
    });
  }

  async function introspect() {
    const project = await mappedProject();
    const result = await request('introspect', { project_ref: project.projectRef });
    return Object.freeze({ ...result, mappedProject: project });
  }

  async function prepare(sql) {
    const project = await mappedProject();
    const exactSql = canonicalSql(sql);
    const result = await request('prepare', { project_ref: project.projectRef, sql: exactSql });
    return Object.freeze({ ...result, mappedProject: project, sql: exactSql });
  }

  async function ticket(ticketId) {
    const id = String(ticketId || '').trim();
    if (!id) throw new Error('DATABASE_TICKET_REQUIRED');
    return request('ticket', { ticket_id: id });
  }

  async function approve(ticketId, options = {}) {
    if (options.humanDecision !== true) {
      const error = new Error('Aprovação humana explícita é obrigatória para banco.');
      error.code = 'DATABASE_HUMAN_APPROVAL_REQUIRED';
      throw error;
    }
    const id = String(ticketId || '').trim();
    if (!id) throw new Error('DATABASE_TICKET_REQUIRED');
    return request('approve', {
      ticket_id: id,
      human_decision: true,
      destructive_confirmation: options.destructiveConfirmation === true,
      recovery_evidence: String(options.recoveryEvidence || '').trim().slice(0, 1200)
    });
  }

  async function run(ticketId, sql) {
    const id = String(ticketId || '').trim();
    if (!id) throw new Error('DATABASE_TICKET_REQUIRED');
    const exactSql = canonicalSql(sql);
    return request('run', { ticket_id: id, sql: exactSql }, 135000);
  }

  async function verify(ticketId) {
    const id = String(ticketId || '').trim();
    if (!id) throw new Error('DATABASE_TICKET_REQUIRED');
    return request('verify', { ticket_id: id }, 90000);
  }

  window.LovableDecrypterCanonicalDatabaseRuntimeApi = Object.freeze({
    build: BUILD,
    schema: SCHEMA,
    projectId,
    mappedProject,
    status,
    introspect,
    prepare,
    ticket,
    approve,
    run,
    verify,
    maxSqlChars: MAX_SQL_CHARS,
    sqlPersistence: false,
    browserStorageSqlAllowed: false,
    automaticApproval: false,
    automaticWriteRetry: false,
    runRequiresApprovedTicket: true,
    projectRefFromCanonicalMapping: true,
    destructiveRequiresRecoveryEvidence: true
  });
})();
