(() => {
  'use strict';
  if (window.__LD84_UX_POLISH__) return;
  window.__LD84_UX_POLISH__ = true;

  const HOST_ID = 'lovable-decrypter-launcher';
  const MONITOR_KEY = 'ld84_monitor_enabled';
  const MODAL_MODULES = new Set(['github', 'supabase', 'lovable', 'project-state', 'security']);
  const MODULE_TITLES = Object.freeze({
    github: 'GitHub',
    supabase: 'Supabase',
    lovable: 'Lovable',
    'project-state': 'Estado do projeto',
    security: 'Segurança'
  });

  function svg(paths) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    node.setAttribute('viewBox', '0 0 24 24');
    node.setAttribute('width', '18');
    node.setAttribute('height', '18');
    node.setAttribute('fill', 'none');
    node.setAttribute('aria-hidden', 'true');
    for (const d of paths) {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', '1.75');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      node.appendChild(path);
    }
    return node;
  }

  function parityButton(id, label, paths) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'rail-btn ld84-parity-btn';
    button.dataset.ldParity = id;
    button.setAttribute('aria-label', label);
    button.appendChild(svg(paths));
    const tip = document.createElement('span');
    tip.className = 'tip';
    tip.textContent = label;
    button.appendChild(tip);
    return button;
  }

  function runtimeCommand(moduleId, action = 'status') {
    return new Promise(resolve => {
      try {
        chrome.runtime.sendMessage({ type: 'ld84.runtime.command', module: moduleId, action }, response => {
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

  function removeModuleModal(shadow) {
    shadow?.getElementById?.('ld84-module-modal')?.remove();
  }

  function makeOverlay(shadow, moduleId, subtitle) {
    removeModuleModal(shadow);
    const overlay = document.createElement('div');
    overlay.id = 'ld84-module-modal';
    overlay.className = 'ld84-ux-info';

    const card = document.createElement('section');
    card.className = 'ld84-ux-info-card';
    const head = document.createElement('div');
    head.className = 'ld84-ux-info-head';
    const heading = document.createElement('div');
    const title = document.createElement('b');
    title.textContent = MODULE_TITLES[moduleId] || 'Lovable Decrypter';
    const sub = document.createElement('span');
    sub.textContent = subtitle || '';
    heading.append(title, sub);
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = '×';
    close.setAttribute('aria-label', 'Fechar');
    head.append(heading, close);
    const body = document.createElement('div');
    body.className = 'ld84-ux-info-body';
    card.append(head, body);
    overlay.appendChild(card);
    close.addEventListener('click', () => overlay.remove(), { once: true });
    overlay.addEventListener('click', event => { if (event.target === overlay) overlay.remove(); });
    shadow.appendChild(overlay);
    return { overlay, body };
  }

  function showLoadingModal(shadow, moduleId, actionLabel) {
    const modal = makeOverlay(shadow, moduleId, actionLabel || 'Carregando');
    const loading = document.createElement('div');
    loading.className = 'ld84-ux-loading-line';
    loading.textContent = `${actionLabel || 'Carregando'}…`;
    modal.body.appendChild(loading);
    return modal;
  }

  function addRow(parent, key, value) {
    const row = document.createElement('div');
    row.className = 'ld84-ux-info-row';
    const label = document.createElement('span');
    label.textContent = key;
    const content = document.createElement('b');
    content.textContent = value == null || value === '' ? '—' : String(value);
    row.append(label, content);
    parent.appendChild(row);
  }

  function addList(parent, title, values) {
    const items = Array.isArray(values) ? values.filter(Boolean) : [];
    if (!items.length) return;
    const label = document.createElement('div');
    label.className = 'ld84-ux-list-title';
    label.textContent = title;
    const list = document.createElement('div');
    list.className = 'ld84-ux-list';
    for (const value of items) {
      const item = document.createElement('div');
      item.textContent = String(value);
      list.appendChild(item);
    }
    parent.append(label, list);
  }

  function renderStatus(shadow, moduleId, result) {
    const modal = makeOverlay(shadow, moduleId, 'Estado atual');
    const data = result?.data || {};
    if (!result?.ok) {
      addRow(modal.body, 'Estado', result?.message || result?.code || 'Falha ao consultar');
      return;
    }

    if (moduleId === 'github') {
      const repos = Array.isArray(data.repositories) ? data.repositories : [];
      addRow(modal.body, 'Conectado', data.connected === true ? 'Sim' : 'Não');
      addRow(modal.body, 'Conta', data?.installation?.account_login || '—');
      addRow(modal.body, 'Repositórios autorizados', repos.length);
      return;
    }
    if (moduleId === 'supabase') {
      const projects = Array.isArray(data.projects) ? data.projects : [];
      addRow(modal.body, 'Conectado', data.connected === true ? 'Sim' : 'Não');
      addRow(modal.body, 'Projetos autorizados', projects.length);
      addRow(modal.body, 'Reautorização necessária', data.reauthorize_required === true ? 'Sim' : 'Não');
      return;
    }
    if (moduleId === 'lovable' || moduleId === 'project-state') {
      addRow(modal.body, 'Projeto detectado', data.detected === true ? 'Sim' : 'Não');
      addRow(modal.body, 'Project ID', data.projectId || '—');
      addRow(modal.body, 'Título', data.title || '—');
      return;
    }
    if (moduleId === 'security') {
      addRow(modal.body, 'Proteção', result?.summary || 'Ativa');
      addRow(modal.body, 'Trust', data.trust?.valid === true ? 'Válido' : (data.trust?.valid === false ? 'Inválido' : 'Sob demanda'));
      return;
    }
    addRow(modal.body, 'Estado', result?.summary || 'Disponível');
  }

  function renderDetails(shadow, moduleId, result) {
    const modal = makeOverlay(shadow, moduleId, 'Detalhes');
    const data = result?.data || {};
    if (!result?.ok) {
      addRow(modal.body, 'Estado', result?.message || result?.code || 'Falha ao consultar');
      return;
    }

    if (moduleId === 'github') {
      const repos = Array.isArray(data.repositories) ? data.repositories : [];
      addRow(modal.body, 'Conectado', data.connected === true ? 'Sim' : 'Não');
      addRow(modal.body, 'Backend', data.app_configured === false ? 'Não configurado' : 'Configurado');
      addRow(modal.body, 'Conta', data?.installation?.account_login || '—');
      addRow(modal.body, 'Seleção', data?.installation?.repository_selection || '—');
      addRow(modal.body, 'Installation ID', data?.installation?.id || data?.installation_id || '—');
      addList(modal.body, 'Repositórios autorizados', repos.slice(0, 30).map(repo => repo?.full_name || repo?.name));
      return;
    }
    if (moduleId === 'supabase') {
      const projects = Array.isArray(data.projects) ? data.projects : [];
      const organizations = Array.isArray(data.organizations) ? data.organizations : [];
      addRow(modal.body, 'Conectado', data.connected === true ? 'Sim' : 'Não');
      addRow(modal.body, 'Backend', data.app_configured === false ? 'Não configurado' : 'Configurado');
      addRow(modal.body, 'Escopos', data.scope || '—');
      addRow(modal.body, 'Reautorizar', data.reauthorize_required === true ? 'Sim' : 'Não');
      addRow(modal.body, 'Organizações', organizations.length);
      addList(modal.body, 'Projetos autorizados', projects.slice(0, 30).map(project => `${project?.name || project?.ref || 'Projeto'}${project?.ref ? ` · ${project.ref}` : ''}`));
      return;
    }
    if (moduleId === 'lovable' || moduleId === 'project-state') {
      addRow(modal.body, 'Detectado', data.detected === true ? 'Sim' : 'Não');
      addRow(modal.body, 'Project ID', data.projectId || '—');
      addRow(modal.body, 'Workspace ID', data.workspaceId || '—');
      addRow(modal.body, 'Título', data.title || '—');
      addRow(modal.body, 'URL', data.url || '—');
      addRow(modal.body, 'Caminho', data.pathname || '—');
      addRow(modal.body, 'Coletado em', data.collectedAt || '—');
      return;
    }
    if (moduleId === 'security') {
      addRow(modal.body, 'Resumo', result?.summary || '—');
      addRow(modal.body, 'Trust válido', data.trust?.valid === true ? 'Sim' : (data.trust?.valid === false ? 'Não' : 'Sob demanda'));
      addRow(modal.body, 'Protocolo', data.trust?.protocol || data.protocol || 'ld-runtime-bus/1');
      return;
    }
    addRow(modal.body, 'Resumo', result?.summary || 'Disponível');
  }

  async function showStatusOrDetails(shadow, moduleId, mode) {
    showLoadingModal(shadow, moduleId, mode === 'status' ? 'Atualizando estado' : 'Carregando detalhes');
    const result = await runtimeCommand(moduleId, 'status');
    if (mode === 'status') renderStatus(shadow, moduleId, result);
    else renderDetails(shadow, moduleId, result);
  }

  function showEditorDirectModal(shadow) {
    shadow.getElementById('ld84-editor-direct-modal')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'ld84-editor-direct-modal';
    const card = document.createElement('section');
    card.className = 'ld84-parity-card';
    const head = document.createElement('div');
    head.className = 'ld84-parity-head';
    const title = document.createElement('b');
    title.textContent = 'Editor Direto';
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = '×';
    close.setAttribute('aria-label', 'Fechar');
    head.append(title, close);
    const status = document.createElement('div');
    status.className = 'ld84-parity-status';
    status.textContent = 'Controle restaurado. O motor de edição direta será reativado e validado como checkpoint funcional separado.';
    const copy = document.createElement('p');
    copy.textContent = 'Neste candidato o botão não envia nem aplica comandos, preservando o diagnóstico de estabilidade do Lovable e da RAM.';
    card.append(head, status, copy);
    overlay.appendChild(card);
    close.addEventListener('click', () => overlay.remove(), { once: true });
    overlay.addEventListener('click', event => { if (event.target === overlay) overlay.remove(); });
    shadow.appendChild(overlay);
  }

  async function readMonitorEnabled() {
    try {
      const state = await chrome.storage.local.get(MONITOR_KEY);
      return state[MONITOR_KEY] !== false;
    } catch (_) {
      return true;
    }
  }

  function paintMonitor(host, button, enabled) {
    host.dataset.ldMonitor = enabled ? 'on' : 'off';
    button.dataset.monitor = enabled ? 'on' : 'off';
    button.setAttribute('aria-pressed', String(enabled));
    button.setAttribute('aria-label', enabled ? 'Monitor ON' : 'Monitor OFF');
    const tip = button.querySelector('.tip');
    if (tip) tip.textContent = enabled ? 'Monitor ON' : 'Monitor OFF';
  }

  async function setMonitor(host, button, enabled) {
    try { await chrome.storage.local.set({ [MONITOR_KEY]: enabled }); } catch (_) {}
    paintMonitor(host, button, enabled);
    try {
      window.dispatchEvent(new CustomEvent('ld84:monitor-changed', { detail: { enabled } }));
    } catch (_) {}
  }

  async function installParityControls(host, shadow) {
    const railButtons = shadow.getElementById('railButtons');
    if (!railButtons) return;

    let monitor = railButtons.querySelector('[data-ld-parity="monitor"]');
    let editor = railButtons.querySelector('[data-ld-parity="editor-direct"]');
    const separator = railButtons.querySelector('.separator');

    if (!monitor) {
      monitor = parityButton('monitor', 'Monitor ON', ['M4 12h3l2-5 4 10 2-5h5', 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z']);
      if (separator) railButtons.insertBefore(monitor, separator.nextSibling);
      else railButtons.appendChild(monitor);
    }
    if (!editor) {
      editor = parityButton('editor-direct', 'Editor Direto', ['m8 9-3 3 3 3', 'm16 9 3 3-3 3', 'm14 5-4 14']);
      railButtons.insertBefore(editor, monitor.nextSibling);
    }

    paintMonitor(host, monitor, await readMonitorEnabled());
  }

  function bind() {
    const host = document.getElementById(HOST_ID);
    const shadow = host?.shadowRoot;
    if (!shadow) return false;
    if (shadow.__ld84UxPolishBound) return true;
    Object.defineProperty(shadow, '__ld84UxPolishBound', { value: true, configurable: false });

    const style = document.createElement('style');
    style.id = 'ld84-ux-polish-style';
    style.textContent = `
      #detail .foot,
      #detail .state,
      #detail > .label,
      #detail > .row,
      #ld84-module-modal .ld84-note{display:none!important}

      #fab{
        right:22px!important;
        bottom:22px!important;
        width:58px!important;
        height:58px!important;
        box-shadow:0 18px 44px rgba(7,8,20,.40),inset 0 1px 0 rgba(255,255,255,.06),0 0 28px rgba(59,210,255,.07)!important;
      }
      #fab:hover{box-shadow:0 20px 48px rgba(7,8,20,.44),inset 0 1px 0 rgba(255,255,255,.08),0 0 32px rgba(59,210,255,.11)!important}
      #fab > svg{width:30px!important;height:30px!important}
      #fab .badge{right:5px!important;bottom:5px!important;width:10px!important;height:10px!important;border-width:2px!important}
      :host([data-ld-monitor="off"]) #fab .badge{background:#ff637d!important;box-shadow:0 0 15px rgba(255,99,125,.75)!important}

      #railMask{
        right:25px!important;
        bottom:94px!important;
        width:52px!important;
        height:min(650px,calc(100vh - 112px))!important;
        min-height:0!important;
      }
      #rail{padding:10px 7px!important;border-radius:20px!important;overflow:hidden!important}
      .rail-logo{width:36px!important;height:36px!important;flex:0 0 36px!important;border-radius:14px!important;z-index:2!important}
      .rail-logo > svg{width:22px!important;height:22px!important}
      #railButtons{
        margin-top:9px!important;
        justify-content:flex-start!important;
        gap:4px!important;
        overflow-y:auto!important;
        overflow-x:hidden!important;
        padding:1px 0 6px!important;
        scrollbar-width:none!important;
        overscroll-behavior:contain!important;
      }
      #railButtons::-webkit-scrollbar{display:none!important}
      .rail-btn{width:34px!important;height:34px!important;flex:0 0 34px!important;border-radius:13px!important}
      .rail-btn > svg{width:18px!important;height:18px!important}
      .rail-btn:hover{transform:scale(1.08)!important}
      .rail-btn.active::after{left:-7px!important;width:5px!important;height:5px!important}
      .separator{width:22px!important;margin:1px 0!important}
      .tip{transform:translate(-10px,-50%)!important;padding:7px 9px!important;border-radius:9px!important}
      .rail-btn:hover .tip{transform:translate(-12px,-50%)!important}
      .rail-btn[data-ld-parity="monitor"][data-monitor="on"]{color:#65e6a4!important}
      .rail-btn[data-ld-parity="monitor"][data-monitor="off"]{color:#ff7b91!important}
      .rail-btn[data-ld-parity="editor-direct"]{color:#b8c7e4!important}

      #detail{width:286px!important;padding:14px!important}
      #detail .detail-head{padding-bottom:10px!important}
      #detail .actions{margin-top:10px!important;gap:2px!important}

      #ld84-module-modal.ld84-ux-info,
      #ld84-editor-direct-modal{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:24px;background:rgba(3,7,16,.52);backdrop-filter:blur(10px);pointer-events:auto;font-family:Arial,sans-serif;color:#f3f7ff}
      .ld84-ux-info-card,.ld84-parity-card{width:min(500px,calc(100vw - 32px));max-height:min(700px,calc(100vh - 32px));overflow:auto;border:1px solid rgba(255,255,255,.10);border-radius:22px;background:linear-gradient(180deg,rgba(20,31,54,.98),rgba(9,16,30,.99));box-shadow:0 28px 90px rgba(0,0,0,.45);padding:20px}
      .ld84-ux-info-head,.ld84-parity-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:16px}.ld84-ux-info-head>div{display:grid;gap:4px}.ld84-ux-info-head b,.ld84-parity-head b{font-size:18px}.ld84-ux-info-head span{font-size:11px;color:#8fa0bb}.ld84-ux-info-head button,.ld84-parity-head button{width:34px;height:34px;border:1px solid rgba(255,255,255,.10);border-radius:11px;background:rgba(255,255,255,.05);color:#dce7fb;cursor:pointer;font-size:20px}
      .ld84-ux-info-body{display:grid;gap:7px}.ld84-ux-loading-line{padding:12px 13px;border-radius:13px;background:rgba(59,210,255,.07);border:1px solid rgba(59,210,255,.16);font-size:12px;color:#dcecff}.ld84-ux-info-row{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:9px 10px;border-radius:11px;background:rgba(255,255,255,.025);font-size:11px}.ld84-ux-info-row span{color:#8495ae}.ld84-ux-info-row b{color:#e5eefb;text-align:right;overflow-wrap:anywhere}.ld84-ux-list-title{margin-top:8px;color:#8fa0bb;font-size:10px;font-weight:700}.ld84-ux-list{display:grid;gap:5px}.ld84-ux-list>div{padding:8px 10px;border-radius:10px;background:rgba(255,255,255,.035);color:#d6e2f5;font-size:11px;overflow-wrap:anywhere}
      .ld84-parity-status{margin-top:16px;padding:12px 13px;border:1px solid rgba(59,210,255,.16);border-radius:13px;background:rgba(59,210,255,.07);color:#dcecff;font-size:12px;line-height:1.5}.ld84-parity-card p{margin:12px 0 0;color:#9aa7bf;font-size:11px;line-height:1.5}

      @media(max-width:820px){
        #fab{right:16px!important;bottom:16px!important;width:54px!important;height:54px!important}
        #railMask{right:17px!important;bottom:82px!important;width:52px!important;height:min(620px,calc(100vh - 98px))!important}
      }
    `;
    shadow.appendChild(style);

    installParityControls(host, shadow).catch(() => {});

    shadow.addEventListener('click', event => {
      const parity = event.target?.closest?.('[data-ld-parity]');
      if (parity) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const id = parity.dataset.ldParity;
        if (id === 'monitor') {
          const enabled = parity.dataset.monitor !== 'on';
          setMonitor(host, parity, enabled).catch(() => {});
        } else if (id === 'editor-direct') {
          showEditorDirectModal(shadow);
        }
        return;
      }

      const action = event.target?.closest?.('.action');
      if (action) {
        const detail = shadow.getElementById('detail');
        const moduleId = detail?.dataset?.module || '';
        const label = String(action.querySelector('span')?.textContent || action.textContent || '').trim();
        if (MODAL_MODULES.has(moduleId)) {
          if (label === 'Abrir módulo') {
            showLoadingModal(shadow, moduleId, 'Carregando módulo');
            return;
          }
          if (label === 'Ver estado' || label === 'Detalhes') {
            event.preventDefault();
            event.stopImmediatePropagation();
            showStatusOrDetails(shadow, moduleId, label === 'Ver estado' ? 'status' : 'details').catch(() => {});
            return;
          }
        }
      }

      const button = event.target?.closest?.('.rail-btn');
      if (!button) return;

      const rail = shadow.getElementById('rail');
      const flyout = shadow.getElementById('flyout');
      const detail = shadow.getElementById('detail');
      const panelVisible = flyout?.classList.contains('show') || detail?.classList.contains('show');

      if (!rail?.classList.contains('open') || !button.classList.contains('active') || !panelVisible) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      flyout?.classList.remove('show');
      detail?.classList.remove('show');
      for (const node of shadow.querySelectorAll('.rail-btn.active,.fly-item.active')) node.classList.remove('active');
    }, true);

    return true;
  }

  const bound = bind();
  if (!bound && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { bind(); }, { once: true });
  }
})();