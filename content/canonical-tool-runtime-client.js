(() => {
  'use strict';

  if (window.__LD86_CANONICAL_TOOL_RUNTIME_CLIENT__) return;
  window.__LD86_CANONICAL_TOOL_RUNTIME_CLIENT__ = true;

  const SCHEMA = 'ld-canonical-tool-runtime/1';
  const BUILD = 86;

  function projectId() {
    return String(window.LovableDecrypterV2?.getProjectId?.() || '');
  }

  function toolsApi() {
    const api = window.LovableDecrypterTools;
    if (!api?.list || !api?.invoke || !api?.journal) throw new Error('Tool Runtime client não carregado.');
    return api;
  }

  async function registry() {
    const state = await toolsApi().list(projectId());
    const tools = Array.isArray(state?.tools) ? state.tools.map(tool => Object.freeze({
      name: String(tool?.name || ''),
      mode: tool?.mode === 'write' ? 'write' : 'read',
      capability: String(tool?.capability || ''),
      description: String(tool?.description || '')
    })) : [];
    return Object.freeze({
      schema: SCHEMA,
      build: BUILD,
      projectId: projectId(),
      repo: String(state?.repo || ''),
      branch: String(state?.branch || ''),
      tools,
      readTools: tools.filter(tool => tool.mode === 'read'),
      writeTools: tools.filter(tool => tool.mode === 'write'),
      scopeLayer: state?.scopeLayer || null,
      writePolicy: String(state?.writePolicy || ''),
      continuityAware: state?.continuityAware === true,
      localOrchestratorAware: state?.localOrchestratorAware === true,
      localAgentProposalDigestBinding: state?.localAgentProposalDigestBinding === true,
      preWriteHeadCheckpoint: state?.preWriteHeadCheckpoint === true,
      ambiguousWriteRetry: String(state?.ambiguousWriteRetry || ''),
      fakeDiagnostics: state?.fakeDiagnostics === true,
      fakeLsp: state?.fakeLsp === true
    });
  }

  async function invokeRead(tool, input = {}, options = {}) {
    const state = await registry();
    const definition = state.tools.find(item => item.name === String(tool || ''));
    if (!definition) {
      const error = new Error(`Ferramenta não registrada: ${tool}`);
      error.code = 'TOOL_NOT_FOUND';
      throw error;
    }
    if (definition.mode !== 'read') {
      const error = new Error('A UI canônica não executa ferramentas de escrita diretamente. Use uma Change Transaction aprovada.');
      error.code = 'CANONICAL_DIRECT_WRITE_BLOCKED';
      throw error;
    }
    return toolsApi().invoke(definition.name, input || {}, {
      projectId: projectId(),
      origin: options.origin || 'user',
      parentOperationId: options.parentOperationId || '',
      timeoutMs: options.timeoutMs || 120000
    });
  }

  async function journal(limit = 30) {
    const result = await toolsApi().journal({ projectId: projectId(), limit: Math.max(1, Math.min(100, Number(limit || 30))) });
    const entries = Array.isArray(result?.entries) ? result.entries : [];
    return Object.freeze({
      schema: 'ld-operation-journal/1',
      projectId: projectId(),
      entries
    });
  }

  async function snapshot() {
    const [runtime, operations] = await Promise.all([registry(), journal(30)]);
    return Object.freeze({
      schema: SCHEMA,
      build: BUILD,
      runtime,
      operations,
      directWriteAllowed: false,
      writeAuthority: 'validated-change-transaction-only'
    });
  }

  window.LovableDecrypterCanonicalToolsApi = Object.freeze({
    build: BUILD,
    schema: SCHEMA,
    projectId,
    registry,
    journal,
    snapshot,
    invokeRead,
    safeSmokeTest() {
      return invokeRead('repo.list_files', { glob: '**', limit: 25 }, { origin: 'user' });
    }
  });
})();
