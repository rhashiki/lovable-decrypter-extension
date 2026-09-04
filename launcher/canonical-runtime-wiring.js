(() => {
  'use strict';

  if (window.__LD_CANONICAL_RUNTIME_WIRING__) return;
  window.__LD_CANONICAL_RUNTIME_WIRING__ = true;

  const VERSION = chrome.runtime.getManifest().version;
  const BUILD = Number(String(VERSION).split('.').at(-1)) || 83;
  const HOST_ID = 'lovable-decrypter-launcher';

  const asError = error => ({ ok:false, code:String(error?.code || 'RUNTIME_UNAVAILABLE'), error:String(error?.message || error || 'Runtime indisponível') });
  async function safe(label, fn) { try { return { ok:true, label, data:(await fn()) ?? null }; } catch (error) { return { label, ...asError(error) }; } }
  function projectId() { return String(window.LovableDecrypterV2?.getProjectId?.() || ''); }
  async function serviceWorkerStatus() {
    return safe('service-worker', async () => {
      if (!chrome?.runtime?.id) throw new Error('EXTENSION_RUNTIME_UNAVAILABLE');
      if (typeof window.LovableDecrypterV2?.settings !== 'function') throw new Error('CORE_CLIENT_NOT_LOADED');
      await window.LovableDecrypterV2.settings();
      return { reachable:true, version:chrome.runtime.getManifest().version };
    });
  }
  async function integrationStatus() {
    const gate = window.LovableDecrypterAccountIntegrationGate;
    if (!gate?.status) return { ok:false, code:'CLIENT_NOT_LOADED', error:'Account Integration Gate não carregado.' };
    return safe('integrations', () => gate.status(projectId()));
  }

  const READ_ONLY_MODULES = Object.freeze({
    github: async () => integrationStatus(),
    supabase: async () => integrationStatus(),
    lovable: async () => integrationStatus(),
    gemini: async () => serviceWorkerStatus(),
    'project-state': async () => window.LovableDecrypterCanonicalProjectStateApi?.snapshot ? safe('project-state', () => window.LovableDecrypterCanonicalProjectStateApi.snapshot()) : asError('Canonical Project State client não carregado.'),
    'git-history': async () => serviceWorkerStatus(),
    'context-pack': async () => window.LovableDecrypterCanonicalContextScopeApi?.status ? safe('context-scope', () => window.LovableDecrypterCanonicalContextScopeApi.status()) : asError('Canonical Context + Scope client não carregado.'),
    'local-agent': async () => window.LovableDecrypterCanonicalAgentApi?.snapshot ? safe('agent-center', () => window.LovableDecrypterCanonicalAgentApi.snapshot()) : asError('Canonical Agent Center client não carregado.'),
    'scope-intelligence': async () => window.LovableDecrypterCanonicalContextScopeApi?.status ? safe('context-scope', () => window.LovableDecrypterCanonicalContextScopeApi.status()) : asError('Canonical Context + Scope client não carregado.'),
    continuity: async () => window.LovableDecrypterCanonicalContinuityRecoveryApi?.snapshot ? safe('continuity-recovery', () => window.LovableDecrypterCanonicalContinuityRecoveryApi.snapshot()) : asError('Canonical Continuity + Recovery client não carregado.'),
    'tool-runtime': async () => window.LovableDecrypterCanonicalToolsApi?.snapshot ? safe('tool-runtime', () => window.LovableDecrypterCanonicalToolsApi.snapshot()) : asError('Canonical Tool Runtime client não carregado.'),
    'mcp-runtime': async () => window.LovableDecrypterCanonicalMcpApi?.snapshot ? safe('mcp-center', () => window.LovableDecrypterCanonicalMcpApi.snapshot()) : asError('Canonical MCP Center client não carregado.'),
    'agent-sandbox': async () => window.LovableDecrypterCanonicalAgentApi?.snapshot ? safe('agent-center', () => window.LovableDecrypterCanonicalAgentApi.snapshot()) : asError('Canonical Agent Center client não carregado.'),
    'smart-undo': async () => window.LovableDecrypterCanonicalContinuityRecoveryApi?.snapshot ? safe('continuity-recovery', () => window.LovableDecrypterCanonicalContinuityRecoveryApi.snapshot()) : asError('Canonical Continuity + Recovery client não carregado.'),
    checkpoint: async () => window.LovableDecrypterCanonicalContinuityRecoveryApi?.snapshot ? safe('continuity-recovery', () => window.LovableDecrypterCanonicalContinuityRecoveryApi.snapshot()) : asError('Canonical Continuity + Recovery client não carregado.'),
    'runtime-events': async () => window.LovableDecrypterCanonicalActivityAuditApi?.snapshot ? safe('activity-audit', () => window.LovableDecrypterCanonicalActivityAuditApi.snapshot()) : asError('Canonical Activity + Audit client não carregado.'),
    operations: async () => window.LovableDecrypterCanonicalActivityAuditApi?.snapshot ? safe('activity-audit', () => window.LovableDecrypterCanonicalActivityAuditApi.snapshot()) : asError('Canonical Activity + Audit client não carregado.'),
    'capability-router': async () => window.LovableDecrypterCapabilityRouter?.status ? safe('capability-router', () => window.LovableDecrypterCapabilityRouter.status()) : asError('Capability Router client não carregado.'),
    security: async () => serviceWorkerStatus(),
    updates: async () => serviceWorkerStatus(),
    account: async () => integrationStatus(),
    community: async () => ({ ok:true, label:'community', data:{ runtimeRequired:false } }),
    settings: async () => serviceWorkerStatus()
  });

  async function status(moduleId) {
    const getter = READ_ONLY_MODULES[moduleId];
    if (!getter) return { ok:false, code:'UNKNOWN_MODULE', error:`Módulo desconhecido: ${moduleId}` };
    try { return await getter(); } catch (error) { return asError(error); }
  }

  async function snapshot() {
    const sw = await serviceWorkerStatus();
    const integrations = await integrationStatus();
    return Object.freeze({
      schema:'ld-canonical-runtime/1', build:BUILD, version:VERSION, projectId:projectId(), serviceWorker:sw, integrations,
      clients:Object.freeze({
        core:Boolean(window.LovableDecrypterV2), tools:Boolean(window.LovableDecrypterTools), canonicalTools:Boolean(window.LovableDecrypterCanonicalToolsApi),
        mcp:Boolean(window.LovableDecrypterMCP), canonicalMcp:Boolean(window.LovableDecrypterCanonicalMcpApi),
        context:Boolean(window.LovableDecrypterContext), canonicalContextScope:Boolean(window.LovableDecrypterCanonicalContextScopeApi),
        reversible:Boolean(window.LovableDecrypterReversibleOperations), continuity:Boolean(window.LovableDecrypterContinuity),
        canonicalRecovery:Boolean(window.LovableDecrypterCanonicalContinuityRecoveryApi), canonicalAudit:Boolean(window.LovableDecrypterCanonicalActivityAuditApi),
        localAgent:Boolean(window.LovableDecrypterLocalAgent), canonicalAgent:Boolean(window.LovableDecrypterCanonicalAgentApi),
        canonicalComposer:Boolean(window.LovableDecrypterCanonicalCommandComposerApi), capabilityRouter:Boolean(window.LovableDecrypterCapabilityRouter),
        integrationGate:Boolean(window.LovableDecrypterAccountIntegrationGate), projectState:Boolean(window.LovableDecrypterCanonicalProjectStateApi),
        runtimeRegistry:Boolean(window.LovableDecrypterAgentRuntimeRegistryClient), portableSkills:Boolean(window.LovableDecrypterPortableSkills),
        sandbox:Boolean(window.LovableDecrypterAgentSandbox), nativeSessions:Boolean(window.LovableDecrypterNativeAgentSessions)
      })
    });
  }

  window.LovableDecrypterCanonicalRuntime = Object.freeze({ schema:'ld-canonical-runtime/1', build:BUILD, version:VERSION, projectId, snapshot, status });

  function compact(result) {
    if (!result?.ok) return result?.error || result?.code || 'Indisponível';
    const data = result.data;
    if (data == null) return 'Online';
    if (typeof data === 'string') return data.slice(0,160);
    if (Array.isArray(data)) return `${data.length} item(ns)`;
    if (typeof data === 'object') {
      const keys = Object.keys(data).slice(0,4); if (!keys.length) return 'Online';
      return keys.map(key => `${key}: ${typeof data[key] === 'object' ? 'ok' : String(data[key]).slice(0,36)}`).join(' · ');
    }
    return String(data);
  }

  function findHost() { return document.getElementById(HOST_ID); }
  function delegated(moduleId) {
    return window.LovableDecrypterCanonicalIntegrations?.handles?.(moduleId) === true ||
      window.LovableDecrypterCanonicalProjectState?.handles?.(moduleId) === true ||
      window.LovableDecrypterCanonicalToolRuntime?.handles?.(moduleId) === true ||
      window.LovableDecrypterCanonicalContextScope?.handles?.(moduleId) === true ||
      window.LovableDecrypterCanonicalMcpCenter?.handles?.(moduleId) === true ||
      window.LovableDecrypterCanonicalAgentCenter?.handles?.(moduleId) === true ||
      window.LovableDecrypterCanonicalContinuityRecovery?.handles?.(moduleId) === true ||
      window.LovableDecrypterCanonicalActivityAudit?.handles?.(moduleId) === true ||
      window.LovableDecrypterCanonicalCommandComposer?.handles?.(moduleId) === true ||
      window.LovableDecrypterCanonicalCapabilityRouter?.handles?.(moduleId) === true;
  }

  async function refreshDetail(moduleId) {
    if (delegated(moduleId)) return;
    const host=findHost(), root=host?.shadowRoot, detail=root?.getElementById('detail');
    if (!detail || detail.dataset.module !== moduleId) return;
    const state=detail.querySelector('.state'), rows=[...detail.querySelectorAll('.row')], foot=detail.querySelector('.foot');
    if (state) { state.textContent='VERIFICANDO'; state.dataset.runtime='checking'; }
    const result=await status(moduleId);
    if (!detail.isConnected || detail.dataset.module !== moduleId || delegated(moduleId)) return;
    if (state) { state.textContent=result.ok?'ONLINE':'INDISPONÍVEL'; state.dataset.runtime=result.ok?'online':'offline'; }
    if (rows[0]) { const value=rows[0].querySelector('b'), tail=rows[0].querySelector('small'); if(value)value.textContent=result.ok?'Runtime moderno conectado':'Runtime indisponível'; if(tail)tail.textContent=result.ok?'LIVE':'OFF'; }
    if (rows[1]) { const value=rows[1].querySelector('b'), tail=rows[1].querySelector('small'); if(value)value.textContent='Canonical Runtime Bridge'; if(tail)tail.textContent=`B${BUILD}`; }
    if (rows[2]) { const value=rows[2].querySelector('b'), tail=rows[2].querySelector('small'); if(value)value.textContent=compact(result); if(tail)tail.textContent=result.ok?'READ':'ERRO'; }
    if (foot) foot.textContent=result.ok?`${moduleId} · leitura real do runtime preservado · Build ${BUILD}. Escritas continuam protegidas pelos gates existentes.`:`${moduleId} · ${result.error || result.code || 'runtime indisponível'}`;
  }

  function moduleFromTarget(root,target) {
    const action=target.closest?.('.action'); if(action)return root.getElementById('detail')?.dataset.module || '';
    const item=target.closest?.('.fly-item'); if(item?.dataset?.item)return item.dataset.item;
    const rail=target.closest?.('.rail-btn'); if(!rail)return ''; return rail.dataset.kind==='direct'?rail.dataset.id:'';
  }

  function bindCanonicalUi() {
    const host=findHost(), root=host?.shadowRoot; if(!root || root.__ldCanonicalRuntimeWired)return false; root.__ldCanonicalRuntimeWired=true;
    root.addEventListener('click',event=>{const moduleId=moduleFromTarget(root,event.target);if(!moduleId||delegated(moduleId))return;const action=event.target.closest?.('.action');if(action){event.preventDefault();event.stopImmediatePropagation();}queueMicrotask(()=>refreshDetail(moduleId));},true);
    root.addEventListener('pointerover',event=>{const moduleId=moduleFromTarget(root,event.target);if(moduleId&&!delegated(moduleId))queueMicrotask(()=>refreshDetail(moduleId));},true);
    const fab=root.getElementById('fab');if(fab)fab.title=`Lovable Decrypter v${VERSION}`;
    host.setAttribute('data-ld-runtime-wiring',`canonical-v${BUILD}`);host.setAttribute('data-ld-version',VERSION);
    window.dispatchEvent(new CustomEvent('ld:canonical-runtime-ready',{detail:{build:BUILD,version:VERSION}}));return true;
  }
  if(!bindCanonicalUi())document.addEventListener('DOMContentLoaded',bindCanonicalUi,{once:true});
})();
