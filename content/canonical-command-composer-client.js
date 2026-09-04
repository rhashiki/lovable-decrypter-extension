(() => {
  'use strict';

  if (window.__LD92_CANONICAL_COMMAND_COMPOSER_CLIENT__) return;
  window.__LD92_CANONICAL_COMMAND_COMPOSER_CLIENT__ = true;

  const BUILD = 92;
  const SCHEMA = 'ld-canonical-command-composer/1';

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

    if (normalized.tool === 'repo.patch_apply') {
      const preview = await tools().invokeRead('repo.patch_preview', normalized.input, { origin: 'user' });
      return Object.freeze({
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
    }

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
    const diff = compactTextDiff(before, after);
    return Object.freeze({
      schema: 'ld-canonical-command-diff/1',
      tool: normalized.tool,
      digest: proposal.digest,
      destructive: action === 'delete',
      files: [Object.freeze({
        path: String(input.path || ''),
        action,
        beforeBlobSha,
        addedLines: diff.addedLines,
        removedLines: diff.removedLines,
        preview: diff.preview
      })]
    });
  }

  async function plan(command, options = {}) {
    const value = ensureCommand(command);
    return agent().start(value, {
      projectId: projectId(),
      mode: 'plan',
      explicitPaths: Array.isArray(options.explicitPaths) ? options.explicitPaths : [],
      skills: Array.isArray(options.skills) ? options.skills : [],
      includeKnowledge: options.includeKnowledge !== false,
      timeoutMs: options.timeoutMs || 600000
    });
  }

  async function build(command, options = {}) {
    const value = ensureCommand(command);
    return agent().start(value, {
      projectId: projectId(),
      mode: 'build',
      explicitPaths: Array.isArray(options.explicitPaths) ? options.explicitPaths : [],
      skills: Array.isArray(options.skills) ? options.skills : [],
      includeKnowledge: options.includeKnowledge !== false,
      timeoutMs: options.timeoutMs || 600000
    });
  }

  async function approveWrite(taskId, proposalDigest, options = {}) {
    if (options.humanDecision !== true) {
      const error = new Error('Aprovação humana explícita é obrigatória.');
      error.code = 'COMPOSER_HUMAN_APPROVAL_REQUIRED';
      throw error;
    }
    return agent().approveWrite(String(taskId || ''), String(proposalDigest || ''), {
      humanIntentOverrides: Array.isArray(options.humanIntentOverrides) ? options.humanIntentOverrides : [],
      timeoutMs: options.timeoutMs || 600000
    });
  }

  window.LovableDecrypterCanonicalCommandComposerApi = Object.freeze({
    build: BUILD,
    schema: SCHEMA,
    projectId,
    plan,
    buildCommand: build,
    previewProposal,
    approveWrite,
    cancelTask: taskId => agent().cancel(String(taskId || '')),
    task: taskId => agent().get(String(taskId || '')),
    localFirst: true,
    paidFallbackAllowed: false,
    remoteFallbackAllowed: false,
    directToolWriteAllowed: false,
    automaticApproval: false,
    attachmentsEnabled: false
  });
})();
