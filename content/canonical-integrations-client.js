(() => {
  'use strict';

  if (window.__LD84_CANONICAL_INTEGRATIONS_CLIENT__) return;
  window.__LD84_CANONICAL_INTEGRATIONS_CLIENT__ = true;

  const PORTS = Object.freeze({
    github: 'ld2-github-app',
    supabase: 'ld2-supabase-oauth'
  });

  function projectId() {
    return String(window.LovableDecrypterV2?.getProjectId?.() || '');
  }

  function runtime(message) {
    if (!window.LovableDecrypterV2?.runtime) return Promise.reject(new Error('Decrypter Runtime indisponível.'));
    return window.LovableDecrypterV2.runtime(message);
  }

  function portCall(name, action, payload = {}, timeoutMs = 55000) {
    return new Promise((resolve, reject) => {
      const port = chrome.runtime.connect({ name });
      const id = crypto.randomUUID();
      let settled = false;
      const done = (fn, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { port.disconnect(); } catch (_) {}
        fn(value);
      };
      const timer = setTimeout(() => done(reject, new Error(`INTEGRATION_TIMEOUT:${action}`)), Math.max(5000, timeoutMs));
      port.onMessage.addListener(message => {
        if (message?.id !== id) return;
        if (message.ok) done(resolve, message.data);
        else {
          const error = new Error(message.error || 'Falha na integração.');
          error.code = message.code || 'INTEGRATION_FAILED';
          error.details = message.details || null;
          done(reject, error);
        }
      });
      port.onDisconnect.addListener(() => {
        if (!settled && chrome.runtime.lastError) done(reject, new Error(chrome.runtime.lastError.message));
      });
      port.postMessage({ id, action, payload });
    });
  }

  const githubCall = (action, payload = {}) => portCall(PORTS.github, action, payload, 35000);
  const supabaseCall = (action, payload = {}) => portCall(PORTS.supabase, action, payload, 55000);

  function trustedAuthUrl(value, provider) {
    try {
      const url = new URL(String(value || ''));
      if (url.protocol !== 'https:') return false;
      const backend = url.hostname === 'kkzxxnfxgrouhkzyszxs.supabase.co';
      if (provider === 'github') return backend || url.hostname === 'github.com';
      return backend || url.hostname === 'api.supabase.com' || url.hostname === 'supabase.com' || url.hostname.endsWith('.supabase.com');
    } catch (_) {
      return false;
    }
  }

  async function openAuthorization(provider, action) {
    // The popup is created synchronously from the explicit user action so it is
    // not silently blocked after the backend round trip.
    const popup = window.open('about:blank', '_blank');
    try {
      const flow = provider === 'github'
        ? await githubCall(action)
        : await supabaseCall(action);
      if (!trustedAuthUrl(flow?.url, provider)) throw new Error('O backend retornou uma URL de autorização não confiável.');
      if (!popup) throw new Error('O navegador bloqueou a aba de autorização.');
      popup.location.replace(flow.url);
      return { opened: true, provider, action };
    } catch (error) {
      try { popup?.close(); } catch (_) {}
      throw error;
    }
  }

  async function settings() {
    return runtime({ type: 'LD2_SETTINGS_GET' });
  }

  async function patchSettings(patch) {
    return runtime({ type: 'LD2_SETTINGS_PATCH', patch });
  }

  async function selectGithubRepository(fullName) {
    const status = await githubCall('status');
    const repo = (status?.repositories || []).find(item => item.full_name === fullName);
    if (!repo || !status?.installation?.id) throw new Error('Selecione um repositório autorizado pelo GitHub App.');
    const current = await settings();
    const github = {
      ...(current.github || {}),
      authMode: 'github_app',
      installationId: Number(status.installation.id),
      accountLogin: String(status.installation.account_login || ''),
      appSlug: String(status.app?.slug || ''),
      token: '',
      owner: String(repo.owner || repo.full_name?.split('/')[0] || ''),
      repo: String(repo.name || repo.full_name?.split('/')[1] || ''),
      branch: String(repo.default_branch || 'main'),
      createBranch: false,
      createPr: false
    };
    const patch = { github };
    if (projectId()) patch.projectMappings = { [projectId()]: { owner: github.owner, repo: github.repo, branch: github.branch } };
    await patchSettings(patch);
    window.dispatchEvent(new CustomEvent('ld84:github-mapped', { detail: { fullName: repo.full_name, projectId: projectId() } }));
    return { fullName: repo.full_name, branch: github.branch, projectId: projectId() };
  }

  async function selectSupabaseProject(ref) {
    const status = await supabaseCall('manager_status');
    const project = (status?.projects || []).find(item => item.ref === ref);
    if (!project) throw new Error('Selecione um projeto Supabase autorizado por OAuth.');
    await supabaseCall('project_test', { project_ref: project.ref });
    const current = await settings();
    const selected = {
      projectRef: String(project.ref),
      projectName: String(project.name || project.ref),
      organizationSlug: String(project.organization_slug || ''),
      url: String(project.url || `https://${project.ref}.supabase.co`)
    };
    const patch = {
      supabase: {
        ...(current.supabase || {}),
        authMode: 'oauth',
        ...selected,
        anonKey: '',
        managementToken: ''
      }
    };
    if (projectId()) patch.supabaseMappings = { [projectId()]: selected };
    await patchSettings(patch);
    window.dispatchEvent(new CustomEvent('ld84:supabase-mapped', { detail: { ...selected, projectId: projectId() } }));
    return { ...selected, projectId: projectId() };
  }

  async function lovableStatus() {
    const current = await settings();
    const id = projectId();
    const github = id ? current.projectMappings?.[id] || null : null;
    const supabase = id ? current.supabaseMappings?.[id] || null : null;
    return {
      detected: Boolean(id),
      projectId: id,
      url: location.href,
      github: github ? { owner: github.owner || '', repo: github.repo || '', branch: github.branch || 'main' } : null,
      supabase: supabase ? { projectRef: supabase.projectRef || '', projectName: supabase.projectName || '' } : null
    };
  }

  async function geminiStatus() {
    const current = await settings();
    const gemini = current.gemini || {};
    return {
      configured: Boolean(String(gemini.apiKey || '').trim()),
      model: String(gemini.model || ''),
      advancedModel: String(gemini.advancedModel || ''),
      billingMode: String(gemini.billingMode || 'free'),
      zeroCost: gemini.zeroCost !== false
    };
  }

  async function geminiTest() {
    const current = await settings();
    return runtime({ type: 'LD2_GEMINI_TEST', config: current.gemini || {} });
  }

  async function geminiModels() {
    const current = await settings();
    const result = await runtime({ type: 'LD2_GEMINI_MODELS', config: current.gemini || {} });
    return {
      models: (result?.models || []).filter(item => item?.compatible !== false && item?.freeTierVerified === true).map(item => ({
        id: String(item.id || ''),
        displayName: String(item.displayName || item.id || '')
      }))
    };
  }

  window.LovableDecrypterCanonicalIntegrationsApi = Object.freeze({
    build: 84,
    schema: 'ld-canonical-integrations/1',
    projectId,
    github: Object.freeze({
      status: () => githubCall('status'),
      connect: () => openAuthorization('github', 'connect'),
      disconnect: () => githubCall('disconnect'),
      selectRepository: selectGithubRepository
    }),
    supabase: Object.freeze({
      status: () => supabaseCall('manager_status'),
      connect: () => openAuthorization('supabase', 'connect'),
      bootstrap: () => openAuthorization('supabase', 'bootstrap_start'),
      disconnect: () => supabaseCall('disconnect'),
      selectProject: selectSupabaseProject
    }),
    lovable: Object.freeze({ status: lovableStatus }),
    gemini: Object.freeze({ status: geminiStatus, test: geminiTest, models: geminiModels })
  });
})();
