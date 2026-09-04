(() => {
  'use strict';

  if (window.__LD88_CANONICAL_MCP_CENTER_CLIENT__) return;
  window.__LD88_CANONICAL_MCP_CENTER_CLIENT__ = true;

  const BUILD = 88;
  const SCHEMA = 'ld-canonical-mcp-center/1';

  function mcp() {
    const api = window.LovableDecrypterMCP;
    if (!api?.status || !api?.servers || !api?.listTools) throw new Error('MCP Runtime client não carregado.');
    return api;
  }

  function marketplace() {
    const api = window.LovableDecrypterMCPMarketplace;
    if (!api?.catalog || !api?.installs) throw new Error('MCP Marketplace client não carregado.');
    return api;
  }

  async function settings() {
    return window.LovableDecrypterV2?.settings?.() || {};
  }

  async function serverView(server) {
    let permission = null;
    try { permission = await mcp().permissionStatus(server.id); } catch (_) {}
    const policies = Object.entries(server?.toolPolicies || {}).map(([name, policy]) => Object.freeze({
      name,
      enabled: policy?.enabled === true,
      mode: policy?.mode === 'write' ? 'write' : 'read',
      allowedArgumentKeys: Array.isArray(policy?.allowedArgumentKeys) ? policy.allowedArgumentKeys.map(String) : [],
      reason: String(policy?.reason || '')
    }));
    return Object.freeze({
      id: String(server?.id || ''),
      name: String(server?.name || ''),
      endpoint: String(server?.endpoint || ''),
      permissionOrigin: String(server?.permissionOrigin || permission?.origin || ''),
      protocolVersion: String(server?.protocolVersion || ''),
      trust: ['pending','approved','blocked'].includes(server?.trust) ? server.trust : 'pending',
      auth: Object.freeze({
        mode: String(server?.auth?.mode || 'none'),
        issuer: String(server?.auth?.issuer || ''),
        clientIdConfigured: Boolean(server?.auth?.clientId)
      }),
      allowedMethods: Array.isArray(server?.allowedMethods) ? server.allowedMethods.map(String) : [],
      toolPolicies: policies,
      writePolicies: policies.filter(policy => policy.mode === 'write'),
      permission: Object.freeze({
        origin: String(permission?.origin || server?.permissionOrigin || ''),
        granted: permission?.granted === true
      }),
      marketplace: server?.marketplace ? Object.freeze({
        itemId: String(server.marketplace.itemId || ''),
        publisher: String(server.marketplace.publisher || ''),
        provenance: String(server.marketplace.provenance || ''),
        verifiedDomain: String(server.marketplace.verifiedDomain || ''),
        installedAt: String(server.marketplace.installedAt || ''),
        revokedAt: String(server.marketplace.revokedAt || '')
      }) : null
    });
  }

  async function snapshot() {
    const [runtime, rawServers, catalogState, installState] = await Promise.all([
      mcp().status(),
      mcp().servers(),
      marketplace().catalog(),
      marketplace().installs()
    ]);
    const servers = await Promise.all((rawServers?.servers || []).map(serverView));
    return Object.freeze({
      schema: SCHEMA,
      build: BUILD,
      runtime,
      servers,
      catalog: Array.isArray(catalogState?.catalog) ? catalogState.catalog : [],
      catalogStatus: Object.freeze({
        schema: String(catalogState?.schema || 'ld-mcp-marketplace/1'),
        catalogVersion: Number(catalogState?.catalogVersion || catalogState?.catalog_version || 0) || 0,
        reviewedAt: String(catalogState?.reviewedAt || catalogState?.reviewed_at || '')
      }),
      installs: installState?.installs && typeof installState.installs === 'object' ? installState.installs : {},
      directToolCallsFromCanonicalUi: false,
      writeApprovalAuthority: 'mcp-trust-gateway-one-time-human-approval'
    });
  }

  async function installCurated(itemId) {
    const catalog = await marketplace().catalog();
    const item = (catalog?.catalog || []).find(entry => entry.id === itemId);
    if (!item) throw new Error('MCP curado não encontrado.');
    if (item.availability !== 'direct') {
      const error = new Error(item.availability === 'bridge-required'
        ? 'Este MCP exige bridge/local host e não pode ser iniciado diretamente pelo navegador.'
        : 'Este MCP exige configuração de endpoint antes da instalação.');
      error.code = item.availability === 'bridge-required' ? 'MCP_MARKETPLACE_BRIDGE_REQUIRED' : 'MCP_MARKETPLACE_CONFIGURATION_REQUIRED';
      throw error;
    }
    const configuration = {};
    if (item.id === 'supabase-official-remote') {
      const current = await settings();
      const projectId = String(window.LovableDecrypterV2?.getProjectId?.() || '');
      const mapping = projectId ? current.supabaseMappings?.[projectId] : null;
      const projectRef = String(mapping?.projectRef || current.supabase?.projectRef || '');
      if (projectRef) configuration.project_ref = projectRef;
      configuration.read_only = true;
      configuration.features = ['docs', 'database', 'debugging'];
    }
    return marketplace().install(itemId, configuration);
  }

  async function discoverTools(serverId) {
    const response = await mcp().listTools(serverId, { origin: 'user' });
    const snapshotState = await mcp().servers();
    const server = (snapshotState?.servers || []).find(item => item.id === serverId) || {};
    const policies = server.toolPolicies || {};
    return Object.freeze({
      serverId,
      operationId: String(response?.operationId || ''),
      tools: (response?.result?.tools || []).map(tool => Object.freeze({
        name: String(tool?.name || ''),
        title: String(tool?.title || tool?.name || ''),
        description: String(tool?.description || ''),
        securityAuthority: 'local-trust-gateway',
        remoteAnnotationsTrustedForSecurity: false,
        localPolicy: policies?.[tool?.name] ? Object.freeze({
          enabled: policies[tool.name]?.enabled === true,
          mode: policies[tool.name]?.mode === 'write' ? 'write' : 'read',
          reason: String(policies[tool.name]?.reason || '')
        }) : Object.freeze({ enabled: false, mode: 'unclassified', reason: 'Unknown tools default deny.' })
      }))
    });
  }

  async function enableReadTool(serverId, toolName) {
    return mcp().setToolPolicy(serverId, toolName, {
      enabled: true,
      mode: 'read',
      allowedArgumentKeys: [],
      constraints: {},
      reason: 'Enabled explicitly from Canonical MCP Center as read-only.'
    });
  }

  async function disableTool(serverId, toolName) {
    return mcp().setToolPolicy(serverId, toolName, {
      enabled: false,
      mode: 'read',
      allowedArgumentKeys: [],
      constraints: {},
      reason: 'Disabled explicitly from Canonical MCP Center.'
    });
  }

  window.LovableDecrypterCanonicalMcpApi = Object.freeze({
    build: BUILD,
    schema: SCHEMA,
    snapshot,
    installCurated,
    revokeCurated: (itemId) => marketplace().revoke(itemId, 'user_revoked_from_canonical_center'),
    reconcile: () => marketplace().reconcile(),
    setTrust: (serverId, trust) => mcp().setTrust(serverId, trust),
    requestHostPermission: (serverId) => mcp().requestHostPermission(serverId),
    discoverTools,
    enableReadTool,
    disableTool,
    directCallTool: undefined,
    directPrepareWrite: undefined,
    directApproveWrite: undefined,
    writeApprovalAuthority: 'mcp-trust-gateway-one-time-human-approval'
  });
})();
