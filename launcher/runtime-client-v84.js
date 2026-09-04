(() => {
  'use strict';
  if (window.__LD84_RUNTIME_CLIENT__) return;
  window.__LD84_RUNTIME_CLIENT__ = true;

  const HOST_ID = 'lovable-decrypter-launcher';
  const ACTIONS = Object.freeze({
    'Abrir módulo': 'open',
    'Ver estado': 'status',
    'Detalhes': 'details'
  });
  const MODAL_MODULES = new Set(['github', 'supabase', 'lovable', 'project-state', 'security']);

  function send(message) {
    return new Promise(resolve => {
      try {
        chrome.runtime.sendMessage(message, response => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false, code: 'RUNTIME_MESSAGE_FAILED', message: chrome.runtime.lastError.message });
            return;
          }
          resolve(response || { ok: false, code: 'EMPTY_RUNTIME_RESPONSE' });
        });
      } catch (error) {
        resolve({ ok: false, code: 'RUNTIME_MESSAGE_FAILED', message: error?.message || String(error) });
      }
    });
  }

  function setFoot(shadow, moduleId, text) {
    const detail = shadow?.getElementById?.('detail');
    if (!detail || detail.dataset.module !== moduleId) return;
    const foot = detail.querySelector('.foot');
    if (foot) foot.textContent = text;
  }

  function syncRuntimeCopy(shadow) {
    const detail = shadow?.getElementById?.('detail');
    if (!detail) return;
    const rows = [...detail.querySelectorAll('.row')];
    const execution = rows.find(row => row.previousElementSibling?.classList?.contains('label') && row.previousElementSibling.textContent === 'Execução');
    if (!execution) return;
    const value = execution.querySelector('b');
    const tail = execution.querySelector('small');
    if (value) value.textContent = 'Runtime Bus limpo · módulos sob demanda';
    if (tail) tail.textContent = 'ON DEMAND';
  }

  function projectSnapshot() {
    let parsed;
    try { parsed = new URL(location.href); } catch { return null; }
    const segments = parsed.pathname.split('/').filter(Boolean);
    let projectId = '';
    let workspaceId = '';

    for (const marker of ['projects', 'project']) {
      const index = segments.indexOf(marker);
      if (index >= 0 && segments[index + 1]) {
        projectId = segments[index + 1];
        break;
      }
    }
    for (const marker of ['workspaces', 'workspace']) {
      const index = segments.indexOf(marker);
      if (index >= 0 && segments[index + 1]) {
        workspaceId = segments[index + 1];
        break;
      }
    }

    if (!projectId) {
      const projectLink = document.querySelector('a[href*="/projects/"],a[href*="/project/"]');
      if (projectLink?.href) {
        try {
          const link = new URL(projectLink.href, location.href);
          const parts = link.pathname.split('/').filter(Boolean);
          const projectIndex = parts.indexOf('projects');
          const singularIndex = parts.indexOf('project');
          const index = projectIndex >= 0 ? projectIndex : singularIndex;
          if (index >= 0 && parts[index + 1]) projectId = parts[index + 1];
        } catch (_) {}
      }
    }

    return {
      detected: parsed.hostname === 'lovable.dev' || parsed.hostname.endsWith('.lovable.dev'),
      projectId: String(projectId || '').slice(0, 120),
      workspaceId: String(workspaceId || '').slice(0, 120),
      url: parsed.href,
      title: String(document.title || '').slice(0, 300),
      pathname: parsed.pathname,
      collectedAt: new Date().toISOString()
    };
  }

  function callbackHint() {
    try {
      const url = new URL(location.href);
      const integration = url.searchParams.get('ld2_integration_callback') || '';
      const status = url.searchParams.get('status') || '';
      if (!integration || !status) return null;
      return { integration, status, code: url.searchParams.get('code') || '' };
    } catch {
      return null;
    }
  }

  function removeModuleModal(shadow) {
    shadow?.getElementById?.('ld84-module-modal')?.remove();
  }

  function modalStyles() {
    return `
      #ld84-module-modal{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:24px;background:rgba(3,7,16,.52);backdrop-filter:blur(10px);pointer-events:auto;font-family:Arial,sans-serif;color:#f3f7ff}
      #ld84-module-modal .ld84-card{width:min(560px,calc(100vw - 32px));max-height:min(720px,calc(100vh - 32px));overflow:auto;border:1px solid rgba(255,255,255,.10);border-radius:24px;background:linear-gradient(180deg,rgba(20,31,54,.98),rgba(9,16,30,.99));box-shadow:0 28px 90px rgba(0,0,0,.45);padding:22px}
      #ld84-module-modal .ld84-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:18px}
      #ld84-module-modal h2{font:700 20px/1.25 Arial,sans-serif;margin:0;color:#fff}
      #ld84-module-modal .ld84-sub{margin-top:5px;color:#9aa7bf;font:13px/1.45 Arial,sans-serif}
      #ld84-module-modal .ld84-close{width:36px;height:36px;border-radius:12px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.05);color:#dce7fb;cursor:pointer;font:22px/1 Arial,sans-serif}
      #ld84-module-modal .ld84-status{padding:13px 14px;border-radius:14px;background:rgba(59,210,255,.07);border:1px solid rgba(59,210,255,.16);color:#dcecff;font:13px/1.5 Arial,sans-serif;margin-bottom:14px}
      #ld84-module-modal .ld84-grid{display:grid;grid-template-columns:130px 1fr;gap:8px 12px;padding:4px 0 10px}
      #ld84-module-modal .ld84-key{color:#8291ad;font:12px/1.4 Arial,sans-serif}
      #ld84-module-modal .ld84-value{color:#f1f6ff;font:12px/1.4 Arial,sans-serif;overflow-wrap:anywhere}
      #ld84-module-modal .ld84-list{margin:10px 0 0;padding:0;list-style:none;display:grid;gap:7px}
      #ld84-module-modal .ld84-list li{padding:9px 11px;border-radius:11px;background:rgba(255,255,255,.04);color:#cbd7eb;font:12px/1.4 Arial,sans-serif;overflow-wrap:anywhere}
      #ld84-module-modal .ld84-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:18px}
      #ld84-module-modal .ld84-btn{min-height:38px;padding:0 14px;border-radius:12px;border:1px solid rgba(59,210,255,.20);background:rgba(59,210,255,.10);color:#e9f8ff;cursor:pointer;font:600 12px Arial,sans-serif}
      #ld84-module-modal .ld84-btn.secondary{border-color:rgba(255,255,255,.10);background:rgba(255,255,255,.05);color:#cbd7eb}
      #ld84-module-modal .ld84-btn.danger{border-color:rgba(255,112,112,.20);background:rgba(255,112,112,.08);color:#ffd5d5}
      #ld84-module-modal .ld84-btn:disabled{opacity:.55;cursor:default}
      #ld84-module-modal .ld84-note{margin-top:14px;color:#8391aa;font:11px/1.45 Arial,sans-serif}
    `;
  }

  function field(grid, key, value) {
    const k = document.createElement('div');
    k.className = 'ld84-key';
    k.textContent = key;
    const v = document.createElement('div');
    v.className = 'ld84-value';
    v.textContent = value == null || value === '' ? '—' : String(value);
    grid.append(k, v);
  }

  function baseModal(shadow, title, subtitle, summary) {
    removeModuleModal(shadow);
    const overlay = document.createElement('div');
    overlay.id = 'ld84-module-modal';
    const style = document.createElement('style');
    style.textContent = modalStyles();
    const card = document.createElement('section');
    card.className = 'ld84-card';
    const head = document.createElement('div');
    head.className = 'ld84-head';
    const heading = document.createElement('div');
    const h2 = document.createElement('h2');
    h2.textContent = title;
    const sub = document.createElement('div');
    sub.className = 'ld84-sub';
    sub.textContent = subtitle;
    heading.append(h2, sub);
    const close = document.createElement('button');
    close.className = 'ld84-close';
    close.type = 'button';
    close.setAttribute('aria-label', 'Fechar');
    close.textContent = '×';
    close.addEventListener('click', () => overlay.remove(), { once: true });
    head.append(heading, close);
    const status = document.createElement('div');
    status.className = 'ld84-status';
    status.textContent = summary || 'Estado carregado pelo Runtime Bus.';
    const body = document.createElement('div');
    const actions = document.createElement('div');
    actions.className = 'ld84-actions';
    const note = document.createElement('div');
    note.className = 'ld84-note';
    note.textContent = 'Build 84 · superfície renderizada dentro da única UI da extensão · nenhuma alteração no DOM do Lovable.';
    card.append(head, status, body, actions, note);
    overlay.append(style, card);
    shadow.appendChild(overlay);
    return { overlay, card, status, body, actions };
  }

  async function connectIntegration(shadow, moduleId, modal) {
    const popup = (() => {
      try {
        const value = window.open('about:blank', '_blank');
        if (value) {
          try { value.document.title = 'Lovable Decrypter · Conectando'; } catch (_) {}
        }
        return value;
      } catch { return null; }
    })();

    modal.status.textContent = `Solicitando fluxo de conexão ${moduleId === 'github' ? 'GitHub' : 'Supabase'}…`;
    const result = await send({ type: 'ld84.runtime.command', module: moduleId, action: 'open' });
    if (!result?.ok || !result?.openUrl) {
      try { if (popup && !popup.closed) popup.close(); } catch (_) {}
      modal.status.textContent = result?.summary || result?.message || result?.code || 'Não foi possível iniciar a conexão.';
      return;
    }
    if (popup && !popup.closed) {
      try { popup.location.replace(String(result.openUrl)); return; } catch (_) {}
    }
    modal.status.textContent = 'O navegador bloqueou a janela de conexão. Clique novamente em Conectar.';
  }

  function integrationModal(shadow, moduleId, result) {
    const data = result?.data || {};
    const title = moduleId === 'github' ? 'GitHub' : 'Supabase';
    const modal = baseModal(shadow, title, 'Integração autorizada pelo backend', result?.summary || 'Estado da integração carregado.');
    const grid = document.createElement('div');
    grid.className = 'ld84-grid';
    field(grid, 'Conectado', data.connected === true ? 'Sim' : 'Não');
    field(grid, 'Backend', data.app_configured === false ? 'Não configurado' : 'Configurado');

    if (moduleId === 'github') {
      field(grid, 'Conta', data?.installation?.account_login || '—');
      field(grid, 'Seleção', data?.installation?.repository_selection || '—');
      const repos = Array.isArray(data.repositories) ? data.repositories : [];
      field(grid, 'Repositórios', repos.length);
      if (repos.length) {
        const list = document.createElement('ul');
        list.className = 'ld84-list';
        for (const repo of repos.slice(0, 20)) {
          const li = document.createElement('li');
          li.textContent = repo?.full_name || repo?.name || 'Repositório';
          list.appendChild(li);
        }
        modal.body.append(grid, list);
      } else modal.body.appendChild(grid);
    } else {
      const projects = Array.isArray(data.projects) ? data.projects : [];
      field(grid, 'Projetos', projects.length);
      field(grid, 'Reautorizar', data.reauthorize_required === true ? 'Sim' : 'Não');
      if (data.scope) field(grid, 'Escopos', data.scope);
      if (projects.length) {
        const list = document.createElement('ul');
        list.className = 'ld84-list';
        for (const project of projects.slice(0, 20)) {
          const li = document.createElement('li');
          li.textContent = `${project?.name || project?.ref || 'Projeto'}${project?.ref ? ` · ${project.ref}` : ''}`;
          list.appendChild(li);
        }
        modal.body.append(grid, list);
      } else modal.body.appendChild(grid);
    }

    const refresh = document.createElement('button');
    refresh.className = 'ld84-btn secondary';
    refresh.type = 'button';
    refresh.textContent = 'Atualizar estado';
    refresh.addEventListener('click', async () => {
      refresh.disabled = true;
      const fresh = await send({ type: 'ld84.runtime.command', module: moduleId, action: 'status' });
      refresh.disabled = false;
      if (fresh?.ok) integrationModal(shadow, moduleId, fresh);
      else modal.status.textContent = fresh?.message || fresh?.code || 'Falha ao atualizar.';
    });
    modal.actions.appendChild(refresh);

    if (data.connected === true) {
      const manageResources = document.createElement('button');
      manageResources.className = 'ld84-btn';
      manageResources.type = 'button';
      manageResources.dataset.ldResourceManage = moduleId;
      manageResources.textContent = moduleId === 'github' ? 'Gerenciar repositórios' : 'Gerenciar projetos';
      modal.actions.appendChild(manageResources);

      const disconnect = document.createElement('button');
      disconnect.className = 'ld84-btn danger';
      disconnect.type = 'button';
      disconnect.textContent = 'Desconectar';
      disconnect.addEventListener('click', async () => {
        disconnect.disabled = true;
        const done = await send({ type: 'ld84.integration.disconnect', integration: moduleId });
        if (done?.ok) {
          const fresh = await send({ type: 'ld84.runtime.command', module: moduleId, action: 'status' });
          integrationModal(shadow, moduleId, fresh);
        } else {
          disconnect.disabled = false;
          modal.status.textContent = done?.message || done?.code || 'Falha ao desconectar.';
        }
      });
      modal.actions.appendChild(disconnect);
    } else if (data.app_configured !== false) {
      const connect = document.createElement('button');
      connect.className = 'ld84-btn';
      connect.type = 'button';
      connect.textContent = 'Conectar';
      connect.addEventListener('click', () => { connectIntegration(shadow, moduleId, modal).catch(() => {}); });
      modal.actions.appendChild(connect);
    }
    return modal;
  }

  function projectModal(shadow, result) {
    const data = result?.data || {};
    const modal = baseModal(shadow, 'Estado do projeto', 'Snapshot Lovable coletado somente sob demanda', result?.summary || 'Snapshot carregado.');
    const grid = document.createElement('div');
    grid.className = 'ld84-grid';
    field(grid, 'Detectado', data.detected === true ? 'Sim' : 'Não');
    field(grid, 'Project ID', data.projectId || '—');
    field(grid, 'Workspace ID', data.workspaceId || '—');
    field(grid, 'Título', data.title || '—');
    field(grid, 'URL', data.url || '—');
    field(grid, 'Coletado em', data.collectedAt || '—');
    modal.body.appendChild(grid);

    const refresh = document.createElement('button');
    refresh.className = 'ld84-btn';
    refresh.type = 'button';
    refresh.textContent = 'Atualizar snapshot';
    refresh.addEventListener('click', async () => {
      refresh.disabled = true;
      const fresh = await send({ type: 'ld84.runtime.command', module: 'project-state', action: 'status', context: projectSnapshot() });
      refresh.disabled = false;
      if (fresh?.ok) projectModal(shadow, fresh);
      else modal.status.textContent = fresh?.message || fresh?.code || 'Falha ao atualizar o snapshot.';
    });
    modal.actions.appendChild(refresh);
    return modal;
  }

  function securityModal(shadow, result) {
    const data = result?.data || {};
    const modal = baseModal(shadow, 'Segurança', 'Trust Gateway / política fail-closed', result?.summary || 'Trust carregado.');
    const grid = document.createElement('div');
    grid.className = 'ld84-grid';
    field(grid, 'Protocolo', data.protocol || 'ld-runtime-bus/1');
    field(grid, 'Cache', data.cached === true ? 'Reutilizado' : 'Nova attestation');
    field(grid, 'Expira em', data.expiresAt || '—');
    field(grid, 'Autoridade', 'background/runtime-entry-v84.js');
    modal.body.appendChild(grid);
    const refresh = document.createElement('button');
    refresh.className = 'ld84-btn';
    refresh.type = 'button';
    refresh.textContent = 'Revalidar Trust';
    refresh.addEventListener('click', async () => {
      refresh.disabled = true;
      const fresh = await send({ type: 'ld84.security.attest' });
      refresh.disabled = false;
      if (fresh?.ok) securityModal(shadow, fresh);
      else modal.status.textContent = fresh?.message || fresh?.code || 'Falha na attestation.';
    });
    modal.actions.appendChild(refresh);
    return modal;
  }

  function showFunctionalModal(shadow, moduleId, result) {
    if (moduleId === 'github' || moduleId === 'supabase') return integrationModal(shadow, moduleId, result);
    if (moduleId === 'lovable' || moduleId === 'project-state') return projectModal(shadow, result);
    if (moduleId === 'security') return securityModal(shadow, result);
    return null;
  }

  async function handleAction(shadow, button) {
    const detail = shadow.getElementById('detail');
    const moduleId = String(detail?.dataset?.module || '');
    const label = String(button.querySelector('span')?.textContent || '').trim();
    const action = ACTIONS[label];
    if (!moduleId || !action) return;

    window.dispatchEvent(new CustomEvent('ld84:module-action', { detail: { module: moduleId, action, label } }));
    setFoot(shadow, moduleId, `Build 84 · ${label} · consultando Runtime Bus…`);

    const runtimeAction = MODAL_MODULES.has(moduleId) && action === 'open' && ['github', 'supabase'].includes(moduleId) ? 'status' : action;
    const message = { type: 'ld84.runtime.command', module: moduleId, action: runtimeAction };
    if (moduleId === 'lovable' || moduleId === 'project-state') message.context = projectSnapshot();

    const result = await send(message);
    if (!result?.ok) {
      setFoot(shadow, moduleId, `Build 84 · ${label} · ${result?.code || 'RUNTIME_ERROR'}${result?.message ? ` · ${result.message}` : ''}`);
      return;
    }

    if (result.summary) {
      setFoot(shadow, moduleId, `Build 84 · ${result.capability || moduleId} · FUNCIONAL · ${result.summary}`);
      if (MODAL_MODULES.has(moduleId) && (action === 'open' || action === 'details')) showFunctionalModal(shadow, moduleId, result);
      return;
    }

    const state = result.functionalInvocation === true ? 'FUNCIONAL' : 'PRESERVADO / AGUARDANDO REATTACHMENT';
    setFoot(shadow, moduleId, `Build 84 · ${result.capability} · ${state} · fase ${result.targetPhase}`);
  }

  async function bind() {
    const host = document.getElementById(HOST_ID);
    const shadow = host?.shadowRoot;
    if (!shadow) return false;
    if (shadow.__ld84RuntimeBound) return true;
    Object.defineProperty(shadow, '__ld84RuntimeBound', { value: true, configurable: false });

    shadow.addEventListener('click', event => {
      queueMicrotask(() => syncRuntimeCopy(shadow));
      const button = event.target?.closest?.('button.action');
      if (!button) return;
      handleAction(shadow, button).catch(() => {});
    });
    syncRuntimeCopy(shadow);

    const health = await send({ type: 'ld84.runtime.health' });
    if (health?.ok) {
      host.dataset.ldRuntime = '84';
      host.dataset.ldRuntimeMode = health.mode || 'event-driven';
      host.dataset.ldClientProtocol = health.clientProtocol || '';
    }

    const callback = callbackHint();
    if (callback) {
      host.dataset.ldIntegrationCallback = callback.integration;
      host.dataset.ldIntegrationStatus = callback.status;
    }
    return true;
  }

  bind().then(bound => {
    if (bound || document.readyState !== 'loading') return;
    document.addEventListener('DOMContentLoaded', () => { bind().catch(() => {}); }, { once: true });
  }).catch(() => {});
})();
