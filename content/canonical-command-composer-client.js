(() => {
  'use strict';

  if (window.__LD95_CANONICAL_COMMAND_COMPOSER_CLIENT__) return;
  window.__LD95_CANONICAL_COMMAND_COMPOSER_CLIENT__ = true;

  const BUILD = 95;
  const SCHEMA = 'ld-canonical-command-composer/1';
  const AGENT_BUILD_CAPABILITIES = Object.freeze(['CODE','CONTEXT','TEST']);
  const BUILD_EXECUTABLE_CAPABILITIES = Object.freeze(['CODE','CONTEXT','TEST','DATABASE']);

  function projectId() {
    return String(window.LovableDecrypterV2?.getProjectId?.() || '');
  }

  function agent() {
    const api = window.LovableDecrypterLocalAgent;
    if (!api?.start || !api?.approveWrite || !api?.cancel || !api?.get) throw new Error('Local Agent client não carregado.');
    return api;
  }

  function tools() {
    const api = window.LovableDecrypterCanonicalToolsApi;
    if (!api?.invokeRead) throw new Error('Canonical Tool Runtime client não carregado.');
    return api;
  }

  function database() {
    const api = window.LovableDecrypterCanonicalDatabaseRuntimeApi;
    if (!api?.prepare || !api?.approve || !api?.run || !api?.verify || !api?.introspect) {
      const error = new Error('Canonical Database Runtime client não carregado.');
      error.code = 'DATABASE_RUNTIME_CLIENT_REQUIRED';
      throw error;
    }
    return api;
  }

  function changeTransactions() {
    const api = window.LovableDecrypterCanonicalChangeTransactionsApi;
    if (!api?.create || !api?.codeReview || !api?.codeResult || !api?.databaseResult || !api?.markError) {
      const error = new Error('Change Transactions client não carregado.');
      error.code = 'CHANGE_TRANSACTION_CLIENT_REQUIRED';
      throw error;
    }
    return api;
  }

  function attachmentApi() {
    return window.LovableDecrypterCanonicalAttachmentsVoiceApi || null;
  }

  function capabilityRouter() {
    const api = window.LovableDecrypterCapabilityRouter;
    if (!api?.route) {
      const error = new Error('Capability Router client não carregado.');
      error.code = 'CAPABILITY_ROUTER_CLIENT_REQUIRED';
      throw error;
    }
    return api;
  }

  function ensureCommand(command) {
    const value = String(command || '').trim();
    if (!value) {
      const error = new Error('Digite um comando antes de executar.');
      error.code = 'COMPOSER_COMMAND_REQUIRED';
      throw error;
    }
    if (value.length > 60000) {
      const error = new Error('Comando excede o limite seguro.');
      error.code = 'COMPOSER_COMMAND_TOO_LARGE';
      throw error;
    }
    if (!projectId()) {
      const error = new Error('Projeto Lovable não detectado.');
      error.code = 'COMPOSER_PROJECT_REQUIRED';
      throw error;
    }
    return value;
  }

  function attachmentManifest() {
    const snap = attachmentApi()?.snapshot?.();
    return Array.isArray(snap?.attachments) ? snap.attachments : [];
  }

  async function routeCommand(command) {
    const value = ensureCommand(command);
    return capabilityRouter().route(value, { attachments: attachmentManifest() });
  }

  function requiredCapabilities(report = {}) {
    return (Array.isArray(report?.requiredCapabilities) ? report.requiredCapabilities : [])
      .map(id => String(id || '').toUpperCase())
      .filter(Boolean);
  }

  function assertResolved(report = {}) {
    if (!report?.resolved) {
      const error = new Error('O pedido não possui capacidade explícita suficiente para BUILD. Revise o pedido ou use PLAN para explorar sem escrita.');
      error.code = 'CAPABILITY_ROUTE_UNRESOLVED';
      error.capabilityRoute = report;
      throw error;
    }
    return report;
  }

  function assertAgentBuildCapabilities(report = {}) {
    assertResolved(report);
    const allowed = new Set(AGENT_BUILD_CAPABILITIES);
    const unsupported = requiredCapabilities(report).filter(id => !allowed.has(id));
    if (unsupported.length) {
      const error = new Error(`BUILD do agente não possui execução canônica para: ${unsupported.join(', ')}.`);
      error.code = 'CAPABILITY_EXECUTION_NOT_AVAILABLE';
      error.capabilities = unsupported;
      error.capabilityRoute = report;
      throw error;
    }
    return report;
  }

  function databaseOnly(report = {}) {
    const required = requiredCapabilities(report);
    return required.length === 1 && required[0] === 'DATABASE';
  }

  function containsDatabase(report = {}) {
    return requiredCapabilities(report).includes('DATABASE');
  }

  function extractExplicitSql(command) {
    const value = ensureCommand(command);
    const fenced = value.match(/```sql\s*([\s\S]*?)```/i);
    if (fenced?.[1]?.trim()) return fenced[1].trim();
    const labeled = value.match(/^\s*SQL\s*:\s*([\s\S]+)$/i);
    if (labeled?.[1]?.trim()) return labeled[1].trim();
    if (/^\s*(?:with\b[\s\S]*\b(?:select|insert|update|delete)\b|select\b|insert\b|update\b|delete\b|create\b|alter\b|drop\b|truncate\b|grant\b|revoke\b|comment\b|do\b|explain\b|show\b)/i.test(value)) return value;
    return '';
  }

  function requireExplicitSql(command) {
    const sql = extractExplicitSql(command);
    if (sql) return sql;
    const error = new Error('DATABASE exige SQL explícito nesta build. Inclua um bloco ```sql ... ``` ou use o prefixo SQL:. PLAN continua disponível para explorar o pedido sem escrita.');
    error.code = 'DATABASE_SQL_PLAN_REQUIRED';
    throw error;
  }

  async function prepareCommand(command) {
    const value = ensureCommand(command);
    const attachments = attachmentApi();
    if (!attachments?.augmentCommand) return Object.freeze({ command: value, attachmentManifest: [], attachmentCount: 0 });
    const prepared = await attachments.augmentCommand(value);
    return Object.freeze({ ...prepared, command: ensureCommand(prepared.command || value) });
  }

  function compactTextDiff(before = '', after = '', maxLines = 70) {
    const left = String(before ?? '').split('\n');
    const right = String(after ?? '').split('\n');
    let prefix = 0;
    while (prefix < left.length && prefix < right.length && left[prefix] === right[prefix]) prefix += 1;
    let suffix = 0;
    while (suffix < left.length - prefix && suffix < right.length - prefix && left[left.length - 1 - suffix] === right[right.length - 1 - suffix]) suffix += 1;
    const leftEnd = Math.max(prefix, left.length - suffix);
    const rightEnd = Math.max(prefix, right.length - suffix);
    const removed = left.slice(prefix, leftEnd);
    const added = right.slice(prefix, rightEnd);
    const lines = [
      ...removed.slice(0, maxLines).map(line => `- ${line}`),
      ...added.slice(0, Math.max(0, maxLines - Math.min(maxLines, removed.length))).map(line => `+ ${line}`)
    ];
    const hidden = Math.max(0, removed.length + added.length - lines.length);
    if (hidden) lines.push(`… ${hidden} linha(s) adicional(is) omitida(s) do preview visual`);
    return Object.freeze({
      removedLines: removed.length,
      addedLines: added.length,
      commonPrefixLines: prefix,
      commonSuffixLines: suffix,
      preview: lines.join('\n') || '(sem alteração textual detectada)'
    });
  }

  async function previewProposal(result = {}) {
    const proposal = result?.proposal;
    const normalized = proposal?.normalized;
    if (!proposal?.digest || !normalized?.tool || !normalized?.input) {
      const error = new Error('Proposta de escrita não está disponível para revisão.');
      error.code = 'COMPOSER_PROPOSAL_REQUIRED';
      throw error;
    }

    let diff;
    if (normalized.tool === 'repo.patch_apply') {
      const preview = await tools().invokeRead('repo.patch_preview', normalized.input, { origin: 'user' });
      diff = Object.freeze({
        schema: 'ld-canonical-command-diff/1',
        tool: normalized.tool,
        digest: proposal.digest,
        destructive: false,
        files: (preview?.data?.files || []).map(file => Object.freeze({
          path: String(file?.path || ''),
          action: 'update',
          beforeBlobSha: String(file?.beforeBlobSha || ''),
          addedLines: Number(file?.lineDelta?.added || file?.lineDelta?.addedLines || 0),
          removedLines: Number(file?.lineDelta?.removed || file?.lineDelta?.removedLines || 0),
          preview: String(file?.preview || '').slice(0, 30000)
        }))
      });
    } else {
      if (normalized.tool !== 'repo.write_file') {
        const error = new Error(`Ferramenta de escrita não suportada pelo preview canônico: ${normalized.tool}`);
        error.code = 'COMPOSER_WRITE_TOOL_UNSUPPORTED';
        throw error;
      }
      const input = normalized.input;
      const action = String(input.action || 'update');
      let before = '';
      let beforeBlobSha = '';
      if (action !== 'create') {
        const current = await tools().invokeRead('repo.read_file', { path: input.path, branch: input.branch, maxBytes: 2000000 }, { origin: 'user' });
        before = String(current?.data?.content || '');
        beforeBlobSha = String(current?.data?.blobSha || '');
        if (input.expectedBlobSha && beforeBlobSha && input.expectedBlobSha !== beforeBlobSha) {
          const error = new Error(`A proposta ficou desatualizada antes da aprovação: ${input.path}`);
          error.code = 'COMPOSER_PROPOSAL_STALE';
          throw error;
        }
      }
      const after = action === 'delete' ? '' : String(input.content || '');
      const computed = compactTextDiff(before, after);
      diff = Object.freeze({
        schema: 'ld-canonical-command-diff/1',
        tool: normalized.tool,
        digest: proposal.digest,
        destructive: action === 'delete',
        files: [Object.freeze({
          path: String(input.path || ''),
          action,
          beforeBlobSha,
          addedLines: computed.addedLines,
          removedLines: computed.removedLines,
          preview: computed.preview
        })]
      });
    }

    if (result?.changeTransactionId) {
      await changeTransactions().codeReview(result.changeTransactionId, diff).catch(() => null);
    }
    return diff;
  }

  async function databasePlan(command, capabilityRoute) {
    const sql = extractExplicitSql(command);
    const inspection = await database().introspect();
    const tableCount = Array.isArray(inspection?.schema) ? inspection.schema.length : 0;
    const base = Object.freeze({
      schema: SCHEMA,
      status: 'completed',
      capabilityRoute,
      plan: Object.freeze({
        summary: sql ? 'Revisar SQL explícito contra o schema Supabase antes de qualquer escrita.' : 'Inspecionar o schema Supabase e produzir SQL explícito antes de qualquer escrita.',
        plan: Object.freeze([
          `Projeto Supabase mapeado: ${inspection?.mappedProject?.projectName || inspection?.mappedProject?.projectRef || 'projeto atual'}`,
          `Schema inspecionado por consulta fixa: ${tableCount} registro(s) de metadados`,
          sql ? 'SQL explícito detectado; BUILD poderá preparar um ticket sem executar.' : 'Nenhum SQL explícito detectado; BUILD permanecerá bloqueado.',
          'Classificar risco no backend e revisar RLS/grants/Data API.',
          'Aprovar humanamente o ticket exato; operações destrutivas também exigem evidência de recuperação.',
          'Executar uma única vez e verificar o estado; nunca repetir automaticamente um write ambíguo.'
        ]),
        files: Object.freeze([])
      }),
      database: Object.freeze({
        projectRef: String(inspection?.mappedProject?.projectRef || ''),
        projectName: String(inspection?.mappedProject?.projectName || ''),
        schema: inspection?.schema || [],
        explicitSql: sql,
        explicitSqlRequiredForBuild: !sql,
        writesPerformed: false
      })
    });
    const tx = await changeTransactions().create({
      command,
      mode: 'plan',
      status: 'completed',
      capabilityRoute,
      plan: base.plan,
      database: { projectRef: base.database.projectRef, projectName: base.database.projectName, status: 'inspected' }
    });
    return Object.freeze({ ...base, changeTransactionId: tx.id });
  }

  async function databaseBuild(command, capabilityRoute) {
    const sql = requireExplicitSql(command);
    const inspection = await database().introspect();
    const prepared = await database().prepare(sql);
    const tx = await changeTransactions().create({
      command,
      mode: 'build',
      status: 'waiting_database_approval',
      capabilityRoute,
      plan: {
        summary: 'Executar SQL explícito somente após revisão e aprovação humana.',
        plan: ['Schema introspection', 'Risk classification', 'Human approval', 'Single execution', 'Verification when required'],
        files: []
      },
      database: {
        ticket: prepared.ticket,
        classification: prepared.classification,
        project: prepared.mappedProject || inspection.mappedProject || null,
        status: prepared?.ticket?.status || 'prepared'
      }
    });
    return Object.freeze({
      schema: SCHEMA,
      status: 'waiting_database_approval',
      capabilityRoute,
      changeTransactionId: tx.id,
      databaseProposal: Object.freeze({
        ticket: prepared.ticket,
        classification: prepared.classification,
        project: prepared.mappedProject || inspection.mappedProject || null,
        sql,
        schema: inspection?.schema || [],
        writesPerformed: false,
        approvalRequired: true,
        automaticRetry: false
      })
    });
  }

  async function plan(command, options = {}) {
    const capabilityRoute = await routeCommand(command);
    if (databaseOnly(capabilityRoute)) return databasePlan(command, capabilityRoute);

    const prepared = await prepareCommand(command);
    const result = await agent().start(prepared.command, {
      projectId: projectId(),
      mode: 'plan',
      explicitPaths: Array.isArray(options.explicitPaths) ? options.explicitPaths : [],
      skills: Array.isArray(options.skills) ? options.skills : [],
      includeKnowledge: options.includeKnowledge !== false,
      timeoutMs: options.timeoutMs || 600000
    });
    const tx = await changeTransactions().create({
      command,
      mode: 'plan',
      status: result?.status || 'completed',
      capabilityRoute,
      plan: result?.plan || {},
      taskId: result?.run?.taskId || ''
    });
    return Object.freeze({ ...result, capabilityRoute, attachments: prepared.attachmentManifest || [], changeTransactionId: tx.id });
  }

  async function build(command, options = {}) {
    const capabilityRoute = assertResolved(await routeCommand(command));
    if (containsDatabase(capabilityRoute)) {
      if (!databaseOnly(capabilityRoute)) {
        const error = new Error('Build 95 não executa CODE + DATABASE como se fossem uma transação atômica. Separe as mudanças ou use PLAN.');
        error.code = 'DATABASE_MIXED_TRANSACTION_NOT_AVAILABLE';
        error.capabilityRoute = capabilityRoute;
        throw error;
      }
      return databaseBuild(command, capabilityRoute);
    }

    assertAgentBuildCapabilities(capabilityRoute);
    const prepared = await prepareCommand(command);
    const result = await agent().start(prepared.command, {
      projectId: projectId(),
      mode: 'build',
      explicitPaths: Array.isArray(options.explicitPaths) ? options.explicitPaths : [],
      skills: Array.isArray(options.skills) ? options.skills : [],
      includeKnowledge: options.includeKnowledge !== false,
      timeoutMs: options.timeoutMs || 600000
    });
    const tx = await changeTransactions().create({
      command,
      mode: 'build',
      status: result?.status || 'running',
      capabilityRoute,
      plan: result?.plan || {},
      taskId: result?.run?.taskId || ''
    });
    return Object.freeze({ ...result, capabilityRoute, attachments: prepared.attachmentManifest || [], changeTransactionId: tx.id });
  }

  async function approveWrite(taskId, proposalDigest, options = {}) {
    if (options.humanDecision !== true) {
      const error = new Error('Aprovação humana explícita é obrigatória.');
      error.code = 'COMPOSER_HUMAN_APPROVAL_REQUIRED';
      throw error;
    }
    try {
      const result = await agent().approveWrite(String(taskId || ''), String(proposalDigest || ''), {
        humanIntentOverrides: Array.isArray(options.humanIntentOverrides) ? options.humanIntentOverrides : [],
        timeoutMs: options.timeoutMs || 600000
      });
      if (options.changeTransactionId) await changeTransactions().codeResult(options.changeTransactionId, result).catch(() => null);
      return result;
    } catch (error) {
      if (options.changeTransactionId) await changeTransactions().markError(options.changeTransactionId, error);
      throw error;
    }
  }

  async function approveDatabase(ticketId, sql, options = {}) {
    if (options.humanDecision !== true) {
      const error = new Error('Aprovação humana explícita é obrigatória para banco.');
      error.code = 'DATABASE_HUMAN_APPROVAL_REQUIRED';
      throw error;
    }
    try {
      const approved = await database().approve(ticketId, {
        humanDecision: true,
        destructiveConfirmation: options.destructiveConfirmation === true,
        recoveryEvidence: options.recoveryEvidence || ''
      });
      if (options.changeTransactionId) {
        await changeTransactions().databaseResult(options.changeTransactionId, { ticket: approved.ticket || null, status: approved?.ticket?.status || 'approved' }).catch(() => null);
      }
      const executed = await database().run(ticketId, sql);
      if (options.changeTransactionId) {
        await changeTransactions().databaseResult(options.changeTransactionId, { ticket: executed.ticket || approved.ticket || null, status: executed?.ticket?.status || 'applied' }, { status: executed?.ticket?.status || 'completed' }).catch(() => null);
      }
      return Object.freeze({ ...executed, approvedTicket: approved.ticket || null });
    } catch (error) {
      if (options.changeTransactionId) await changeTransactions().markError(options.changeTransactionId, error);
      throw error;
    }
  }

  async function verifyDatabase(ticketId, options = {}) {
    const result = await database().verify(ticketId);
    if (options.changeTransactionId) {
      await changeTransactions().databaseResult(options.changeTransactionId, { ticketId, status: 'verified', verificationRequired: false }, { status: 'verified' }).catch(() => null);
    }
    return result;
  }

  window.LovableDecrypterCanonicalCommandComposerApi = Object.freeze({
    build: BUILD,
    schema: SCHEMA,
    projectId,
    plan,
    buildCommand: build,
    routeCommand,
    previewProposal,
    approveWrite,
    approveDatabase,
    verifyDatabase,
    databaseIntrospect: () => database().introspect(),
    cancelTask: taskId => agent().cancel(String(taskId || '')),
    task: taskId => agent().get(String(taskId || '')),
    attachmentSnapshot: () => attachmentApi()?.snapshot?.() || null,
    clearAttachments: () => attachmentApi()?.clear?.() || null,
    buildExecutableCapabilities: BUILD_EXECUTABLE_CAPABILITIES,
    agentBuildCapabilities: AGENT_BUILD_CAPABILITIES,
    databaseRequiresExplicitSql: true,
    databaseMixedAtomicExecution: false,
    databaseTicketedWrites: true,
    databaseAutomaticRetry: false,
    capabilityCandidatesAutoActivated: false,
    capabilityRouteRequiredBeforeBuild: true,
    changeTransactionsEnabled: true,
    changeTransactionProjectionOnly: true,
    localFirst: true,
    paidFallbackAllowed: false,
    remoteFallbackAllowed: false,
    directToolWriteAllowed: false,
    automaticApproval: false,
    attachmentsEnabled: true,
    attachmentBinaryPromptInjection: false,
    voiceAutomaticExecution: false
  });
})();
