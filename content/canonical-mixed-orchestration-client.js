(() => {
  'use strict';
  if (window.__LD101_CANONICAL_MIXED_ORCHESTRATION_CLIENT__) return;
  window.__LD101_CANONICAL_MIXED_ORCHESTRATION_CLIENT__ = true;

  const BUILD = 101;
  const SCHEMA = 'ld-mixed-code-database/1';
  const sessions = new Map();
  const text = (value, max = 60000) => String(value ?? '').trim().slice(0, max);

  function projectId() { return String(window.LovableDecrypterV2?.getProjectId?.() || ''); }
  function agent() {
    const api = window.LovableDecrypterLocalAgent;
    if (!api?.start || !api?.approveWrite || !api?.get) throw Object.assign(new Error('MIXED_LOCAL_AGENT_REQUIRED'), { code:'MIXED_LOCAL_AGENT_REQUIRED' });
    return api;
  }
  function database() {
    const api = window.LovableDecrypterCanonicalDatabaseRuntimeApi;
    if (!api?.introspect || !api?.prepare || !api?.ticket || !api?.approve || !api?.run || !api?.verify) throw Object.assign(new Error('MIXED_DATABASE_RUNTIME_REQUIRED'), { code:'MIXED_DATABASE_RUNTIME_REQUIRED' });
    return api;
  }
  function transactions() {
    const api = window.LovableDecrypterCanonicalChangeTransactionsApi;
    if (!api?.create || !api?.get || !api?.codeResult || !api?.databaseResult || !api?.markError) throw Object.assign(new Error('MIXED_CHANGE_TRANSACTION_REQUIRED'), { code:'MIXED_CHANGE_TRANSACTION_REQUIRED' });
    return api;
  }

  function requiredCapabilities(route = {}) {
    return (Array.isArray(route?.requiredCapabilities) ? route.requiredCapabilities : []).map(value => String(value || '').toUpperCase()).filter(Boolean);
  }
  function assertMixedRoute(route = {}) {
    const required = requiredCapabilities(route);
    if (route?.resolved !== true || !required.includes('CODE') || !required.includes('DATABASE')) {
      const error = new Error('MIXED_CODE_DATABASE_ROUTE_REQUIRED');
      error.code = 'MIXED_CODE_DATABASE_ROUTE_REQUIRED';
      error.capabilityRoute = route;
      throw error;
    }
    const unsupported = required.filter(value => !['CODE','DATABASE','CONTEXT','TEST'].includes(value));
    if (unsupported.length) {
      const error = new Error(`MIXED_UNSUPPORTED_CAPABILITIES:${unsupported.join(',')}`);
      error.code = 'MIXED_UNSUPPORTED_CAPABILITIES';
      error.capabilities = unsupported;
      throw error;
    }
    return route;
  }

  function extractExplicitSql(command) {
    const value = text(command);
    const fenced = value.match(/```sql\s*([\s\S]*?)```/i);
    if (fenced?.[1]?.trim()) return fenced[1].trim();
    const labeled = value.match(/(?:^|\n)\s*SQL\s*:\s*([\s\S]+)$/i);
    if (labeled?.[1]?.trim()) return labeled[1].trim();
    return '';
  }
  function requireExplicitSql(command) {
    const sql = extractExplicitSql(command);
    if (sql) return sql;
    const error = new Error('MIXED_DATABASE_SQL_REQUIRED');
    error.code = 'MIXED_DATABASE_SQL_REQUIRED';
    throw error;
  }
  function codeLegCommand(command) {
    const source = text(command);
    const redacted = source
      .replace(/```sql\s*[\s\S]*?```/ig, '[DATABASE LEG: SQL prepared separately; do not execute database operations]')
      .replace(/(?:^|\n)\s*SQL\s*:\s*[\s\S]+$/i, '\n[DATABASE LEG: SQL prepared separately; do not execute database operations]')
      .trim();
    return `${redacted || 'Implement the code portion of the requested change.'}\n\n[MIXED BUILD 101] Operate CODE/CONTEXT/TEST only. Database execution is a separate human-gated leg. Do not attempt database writes or deployment.`;
  }

  async function sha256(value) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value || '')));
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }

  function databaseProposalFrom(prepared, inspection, sql) {
    return Object.freeze({
      ticket: prepared?.ticket || null,
      classification: prepared?.classification || null,
      project: prepared?.mappedProject || inspection?.mappedProject || null,
      sql,
      schema: inspection?.schema || [],
      writesPerformed: false,
      approvalRequired: true,
      automaticRetry: false,
      lockedUntilCodeComplete: true
    });
  }

  function combinedPlan(codePlan = {}, dbProposal = {}) {
    return Object.freeze({
      summary: 'Executar CODE e DATABASE sob uma Change Transaction pai, preservando autorizações e recovery separados.',
      plan: Object.freeze([
        'Preparar e revisar o ticket DATABASE sem executar SQL.',
        ...(Array.isArray(codePlan?.plan || codePlan?.steps) ? (codePlan.plan || codePlan.steps).slice(0, 24) : []),
        'Executar a etapa CODE somente com aprovação humana da sessão MIXED.',
        'Somente após CODE concluir, liberar a aprovação humana DATABASE.',
        'Se DATABASE falhar ou ficar ambíguo após commit de código, parar e oferecer recovery da Change Transaction; nunca repetir SQL automaticamente.'
      ]),
      files: Object.freeze(Array.isArray(codePlan?.files) ? codePlan.files.slice(0, 40) : []),
      databaseRisk: String(dbProposal?.ticket?.risk || dbProposal?.classification?.risk || '').toUpperCase()
    });
  }

  function codeDone(result = {}) { return String(result?.status || '').toLowerCase() === 'completed'; }
  function sessionResponse(session, codeResult = session.codeResult, extra = {}) {
    const completed = codeDone(codeResult);
    const codePending = codeResult?.status === 'waiting_approval' && Boolean(codeResult?.proposal);
    let status = codePending ? 'waiting_mixed_code_approval' : completed ? 'waiting_mixed_database_approval' : String(codeResult?.status || 'mixed_code_pending');
    if (session.databaseDone) status = 'completed';
    return Object.freeze({
      schema: SCHEMA,
      build: BUILD,
      status,
      capabilityRoute: session.capabilityRoute,
      changeTransactionId: session.changeTransactionId,
      run: codeResult?.run || null,
      plan: session.plan,
      proposal: codePending ? codeResult.proposal : null,
      policy: codeResult?.policy || null,
      databaseProposal: Object.freeze({ ...session.databaseProposal, lockedUntilCodeComplete: !completed }),
      mixed: Object.freeze({
        phase: session.databaseDone ? 'completed' : codePending ? 'code_approval' : completed ? 'database_approval' : 'code',
        codeComplete: completed,
        databaseComplete: session.databaseDone === true,
        codeAuthorization: 'human-only',
        databaseAuthorization: 'human-only',
        crossProviderAtomicity: false,
        rawSqlDurablePersistence: false,
        recoveryWhenDatabaseFailsAfterCode: 'git-transaction-revert',
        automaticDatabaseRetry: false
      }),
      ...extra
    });
  }

  async function updateParentStatus(session, codeResult) {
    const completed = codeDone(codeResult);
    const status = codeResult?.status === 'waiting_approval'
      ? 'waiting_mixed_code_approval'
      : completed ? 'waiting_mixed_database_approval' : String(codeResult?.status || 'mixed_code_pending');
    await transactions().codeResult(session.changeTransactionId, codeResult).catch(() => null);
    await transactions().databaseResult(session.changeTransactionId, {
      ticket: session.databaseProposal.ticket,
      classification: session.databaseProposal.classification,
      project: session.databaseProposal.project,
      status: session.databaseProposal?.ticket?.status || 'prepared'
    }, { status }).catch(() => null);
    return status;
  }

  async function build(command, capabilityRoute, options = {}) {
    assertMixedRoute(capabilityRoute);
    const sql = requireExplicitSql(command);
    const inspection = await database().introspect();
    const preparedDb = await database().prepare(sql);
    const dbProposal = databaseProposalFrom(preparedDb, inspection, sql);
    const codeCommand = codeLegCommand(command);

    const codePlanResult = await agent().start(codeCommand, {
      projectId: projectId(), mode:'plan',
      explicitPaths: Array.isArray(options.explicitPaths) ? options.explicitPaths : [],
      skills: Array.isArray(options.skills) ? options.skills : [],
      includeKnowledge: options.includeKnowledge !== false,
      timeoutMs: options.timeoutMs || 600000
    });
    const plan = combinedPlan(codePlanResult?.plan || {}, dbProposal);
    const tx = await transactions().create({
      command,
      mode:'build',
      status:'preparing_mixed_code',
      capabilityRoute,
      plan,
      database:{ ticket:dbProposal.ticket, classification:dbProposal.classification, project:dbProposal.project, status:dbProposal?.ticket?.status || 'prepared' }
    });

    const session = {
      changeTransactionId: tx.id,
      capabilityRoute,
      sql,
      sqlHash: await sha256(sql),
      databaseProposal: dbProposal,
      plan,
      codeCommand,
      codeResult: null,
      databaseDone: false
    };
    sessions.set(tx.id, session);

    try {
      const result = await agent().start(codeCommand, {
        projectId: projectId(), mode:'build', forceHumanApproval:true,
        explicitPaths: Array.isArray(options.explicitPaths) ? options.explicitPaths : [],
        skills: Array.isArray(options.skills) ? options.skills : [],
        includeKnowledge: options.includeKnowledge !== false,
        timeoutMs: options.timeoutMs || 600000
      });
      session.codeResult = result;
      await updateParentStatus(session, result);
      return sessionResponse(session, result);
    } catch (error) {
      await transactions().markError(tx.id, error);
      error.changeTransactionId = tx.id;
      throw error;
    }
  }

  async function approveCode(changeTransactionId, taskId, proposalDigest, options = {}) {
    if (options.humanDecision !== true) throw Object.assign(new Error('MIXED_CODE_HUMAN_APPROVAL_REQUIRED'), { code:'MIXED_CODE_HUMAN_APPROVAL_REQUIRED' });
    const session = sessions.get(String(changeTransactionId || ''));
    if (!session) throw Object.assign(new Error('MIXED_REHYDRATION_REQUIRED'), { code:'MIXED_REHYDRATION_REQUIRED' });
    if (String(session.codeResult?.run?.taskId || '') !== String(taskId || '')) throw Object.assign(new Error('MIXED_CODE_TASK_MISMATCH'), { code:'MIXED_CODE_TASK_MISMATCH' });
    try {
      const result = await agent().approveWrite(String(taskId || ''), String(proposalDigest || ''), {
        humanIntentOverrides: Array.isArray(options.humanIntentOverrides) ? options.humanIntentOverrides : [],
        timeoutMs: options.timeoutMs || 600000
      });
      session.codeResult = result;
      await updateParentStatus(session, result);
      return sessionResponse(session, result);
    } catch (error) {
      await transactions().markError(session.changeTransactionId, error);
      error.changeTransactionId = session.changeTransactionId;
      error.recoverySuggested = 'git-transaction-revert';
      throw error;
    }
  }

  async function approveDatabase(changeTransactionId, options = {}) {
    if (options.humanDecision !== true) throw Object.assign(new Error('MIXED_DATABASE_HUMAN_APPROVAL_REQUIRED'), { code:'MIXED_DATABASE_HUMAN_APPROVAL_REQUIRED' });
    const session = sessions.get(String(changeTransactionId || ''));
    if (!session) throw Object.assign(new Error('MIXED_REHYDRATION_REQUIRED'), { code:'MIXED_REHYDRATION_REQUIRED' });
    if (!codeDone(session.codeResult)) throw Object.assign(new Error('MIXED_CODE_MUST_COMPLETE_FIRST'), { code:'MIXED_CODE_MUST_COMPLETE_FIRST' });
    const ticketId = String(session.databaseProposal?.ticket?.id || '');
    if (!ticketId) throw Object.assign(new Error('MIXED_DATABASE_TICKET_REQUIRED'), { code:'MIXED_DATABASE_TICKET_REQUIRED' });

    try {
      const approved = await database().approve(ticketId, {
        humanDecision:true,
        destructiveConfirmation: options.destructiveConfirmation === true,
        recoveryEvidence: options.recoveryEvidence || ''
      });
      await transactions().databaseResult(session.changeTransactionId, { ticket:approved.ticket || session.databaseProposal.ticket, status:approved?.ticket?.status || 'approved' }, { status:'mixed_database_running' }).catch(() => null);
      const executed = await database().run(ticketId, session.sql);
      session.databaseDone = true;
      await transactions().databaseResult(session.changeTransactionId, { ticket:executed.ticket || approved.ticket || null, status:executed?.ticket?.status || 'applied' }, { status:'completed' }).catch(() => null);
      return sessionResponse(session, session.codeResult, { databaseExecution:Object.freeze({ ...executed, approvedTicket:approved.ticket || null }) });
    } catch (error) {
      if (error?.verificationRequired === true || error?.code === 'DATABASE_WRITE_OUTCOME_AMBIGUOUS') {
        await transactions().databaseResult(session.changeTransactionId, { ticketId, status:'verification_required', verificationRequired:true }, { status:'verification_required', verificationRequired:true }).catch(() => null);
      } else {
        await transactions().markError(session.changeTransactionId, error);
      }
      error.changeTransactionId = session.changeTransactionId;
      error.recoverySuggested = 'git-transaction-revert';
      error.automaticRetry = false;
      throw error;
    }
  }

  async function verifyDatabase(changeTransactionId) {
    const session = sessions.get(String(changeTransactionId || ''));
    if (!session) throw Object.assign(new Error('MIXED_REHYDRATION_REQUIRED'), { code:'MIXED_REHYDRATION_REQUIRED' });
    const ticketId = String(session.databaseProposal?.ticket?.id || '');
    const verification = await database().verify(ticketId);
    await transactions().databaseResult(session.changeTransactionId, { ticketId, status:'verification_review', verificationRequired:true }, { status:'mixed_verification_review', verificationRequired:true }).catch(() => null);
    return Object.freeze({ verification, status:'mixed_verification_review', automaticRetry:false, recoverySuggested:'git-transaction-revert' });
  }

  async function rehydrate(changeTransactionId, command) {
    const id = String(changeTransactionId || '');
    const tx = await transactions().get(id);
    if (!tx) throw Object.assign(new Error('MIXED_CHANGE_TRANSACTION_NOT_FOUND'), { code:'MIXED_CHANGE_TRANSACTION_NOT_FOUND' });
    const sql = requireExplicitSql(command);
    const sqlHash = await sha256(sql);
    const ticketId = String(tx?.database?.ticketId || '');
    if (!ticketId) throw Object.assign(new Error('MIXED_DATABASE_TICKET_REQUIRED'), { code:'MIXED_DATABASE_TICKET_REQUIRED' });
    const ticketResult = await database().ticket(ticketId);
    const ticket = ticketResult?.ticket || ticketResult || {};
    const expectedHash = String(ticket?.sql_hash || ticket?.sqlHash || tx?.database?.sqlHash || '').toLowerCase();
    if (expectedHash && expectedHash !== sqlHash) throw Object.assign(new Error('MIXED_SQL_REHYDRATION_HASH_MISMATCH'), { code:'MIXED_SQL_REHYDRATION_HASH_MISMATCH' });
    const taskId = String(tx?.links?.taskId || '');
    const agentState = taskId ? await agent().get(taskId) : null;
    const codeResult = agentState?.run ? { status:agentState.run.status, run:agentState.run, proposal:agentState.proposal || null, plan:agentState.plan || tx.plan } : { status:'completed', run:null, proposal:null, plan:tx.plan };
    const session = {
      changeTransactionId:id,
      capabilityRoute:{ resolved:tx?.capabilityRoute?.resolved === true, requiredCapabilities:tx?.capabilityRoute?.required || [], candidateCapabilities:tx?.capabilityRoute?.candidates || [], primaryCapability:tx?.capabilityRoute?.primary || 'CODE' },
      sql, sqlHash,
      databaseProposal:{ ticket:{ id:ticketId, risk:tx?.database?.risk, status:tx?.database?.status, sql_hash:tx?.database?.sqlHash }, classification:{ risk:tx?.database?.risk }, project:{ projectRef:tx?.database?.projectRef, projectName:tx?.database?.projectName }, sql, schema:[], writesPerformed:false, approvalRequired:true, automaticRetry:false, lockedUntilCodeComplete:!codeDone(codeResult) },
      plan:tx.plan,
      codeCommand:codeLegCommand(command),
      codeResult,
      databaseDone:tx?.status === 'completed' && tx?.database?.status === 'applied'
    };
    sessions.set(id, session);
    return sessionResponse(session, codeResult, { rehydrated:true });
  }

  function drop(changeTransactionId) { return sessions.delete(String(changeTransactionId || '')); }

  window.LovableDecrypterCanonicalMixedOrchestrationApi = Object.freeze({
    build:BUILD,
    schema:SCHEMA,
    projectId,
    build,
    approveCode,
    approveDatabase,
    verifyDatabase,
    rehydrate,
    drop,
    rawSqlDurablePersistence:false,
    rawSqlBrowserStorageAllowed:false,
    codeAuthorization:'human-only',
    databaseAuthorization:'human-only',
    codeMustCompleteBeforeDatabase:true,
    crossProviderAtomicity:false,
    automaticDatabaseRetry:false,
    recoveryUsesGitTransaction:true,
    directToolWrite:false,
    directDatabaseWrite:false
  });
})();
