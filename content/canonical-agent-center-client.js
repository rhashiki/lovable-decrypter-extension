(() => {
  'use strict';

  if (window.__LD89_CANONICAL_AGENT_CENTER_CLIENT__) return;
  window.__LD89_CANONICAL_AGENT_CENTER_CLIENT__ = true;

  const BUILD = 89;
  const SCHEMA = 'ld-canonical-agent-center/1';

  function localAgent() {
    const api = window.LovableDecrypterLocalAgent;
    if (!api?.status || !api?.list) throw new Error('Local Agent client não carregado.');
    return api;
  }
  function registry() {
    const api = window.LovableDecrypterAgentRuntimeRegistryClient;
    if (!api?.status || !api?.probe) throw new Error('Agent Runtime Registry client não carregado.');
    return api;
  }
  function skills() {
    const api = window.LovableDecrypterPortableSkills;
    if (!api?.status || !api?.list) throw new Error('Portable Skills client não carregado.');
    return api;
  }
  function sandbox() {
    const api = window.LovableDecrypterAgentSandbox;
    if (!api?.status) throw new Error('Agent Sandbox client não carregado.');
    return api;
  }
  function sessions() {
    const api = window.LovableDecrypterNativeAgentSessions;
    if (!api?.status || !api?.list) throw new Error('Native Agent Sessions client não carregado.');
    return api;
  }

  function projectId() {
    return String(window.LovableDecrypterV2?.getProjectId?.() || '');
  }

  async function snapshot() {
    const [agentStatus, modelStatus, runs, registryStatus, skillsStatus, skillList, sandboxStatus, sessionStatus, sessionList] = await Promise.all([
      localAgent().status(),
      localAgent().runtimeStatus(),
      localAgent().list({ projectId: projectId(), limit: 30 }),
      registry().status(),
      skills().status(),
      skills().list(false),
      sandbox().status(),
      sessions().status(),
      sessions().list()
    ]);

    const runtimes = Array.isArray(registryStatus?.runtimes) ? registryStatus.runtimes.map(runtime => Object.freeze({
      id: String(runtime?.id || ''),
      label: String(runtime?.label || runtime?.name || runtime?.id || ''),
      kind: String(runtime?.kind || ''),
      transports: Array.isArray(runtime?.transports) ? runtime.transports : [],
      defaultEndpoint: String(runtime?.defaultEndpoint || ''),
      sessionEndpoint: String(runtime?.sessionEndpoint || runtime?.defaultEndpoint || ''),
      sessionAuthConfigured: runtime?.sessionAuthConfigured === true,
      writeAuthority: false
    })) : [];

    const allSkills = Array.isArray(skillList?.all) ? skillList.all.map(skill => Object.freeze({
      slug: String(skill?.slug || ''),
      displayName: String(skill?.display_name || skill?.displayName || skill?.slug || ''),
      description: String(skill?.description || ''),
      official: skill?.official === true,
      custom: skill?.custom === true,
      enabled: skill?.enabled !== false,
      pinned: skill?.pinned === true,
      autoActivation: skill?.auto_activation !== false,
      trust: String(skill?.trust || ''),
      writeAuthority: false
    })) : [];

    return Object.freeze({
      schema: SCHEMA,
      build: BUILD,
      projectId: projectId(),
      localAgent: agentStatus,
      localModel: modelStatus,
      runs: Array.isArray(runs?.runs) ? runs.runs : [],
      registry: Object.freeze({
        schema: String(registryStatus?.schema || 'ld-agent-runtime-registry/1'),
        runtimeCount: Number(registryStatus?.runtimeCount || runtimes.length) || 0,
        registryAuthority: String(registryStatus?.registryAuthority || 'decrypter'),
        externalWriteAuthority: registryStatus?.externalWriteAuthority === true,
        credentialsDurable: registryStatus?.credentialsDurable === true,
        promptCredentialsAllowed: registryStatus?.promptCredentialsAllowed === true,
        runtimes
      }),
      skills: Object.freeze({ status: skillsStatus, revision: Number(skillList?.revision || 0) || 0, all: allSkills }),
      sandbox: sandboxStatus,
      sessions: Object.freeze({ status: sessionStatus, all: Array.isArray(sessionList?.sessions) ? sessionList.sessions : [] }),
      commandExecutionFromAgentCenter: false,
      writeApprovalFromAgentCenter: false,
      externalRuntimeWriteAuthority: false
    });
  }

  window.LovableDecrypterCanonicalAgentApi = Object.freeze({
    build: BUILD,
    schema: SCHEMA,
    projectId,
    snapshot,
    probeRuntime: runtimeId => registry().probe(runtimeId),
    requestRuntimePermission: (runtimeId, endpoint = '') => registry().requestPermission(runtimeId, endpoint),
    setSkillEnabled: (slug, enabled) => skills().setPreference(slug, { enabled: enabled === true }),
    setSkillPinned: (slug, pinned) => skills().setPreference(slug, { pinned: pinned === true }),
    cancelLocalTask: taskId => localAgent().cancel(taskId),
    closeSession: sessionId => sessions().close(sessionId),
    startCommand: undefined,
    approveWrite: undefined,
    resumeCommand: undefined,
    switchRuntime: undefined,
    externalRuntimeWriteAuthority: false
  });
})();
