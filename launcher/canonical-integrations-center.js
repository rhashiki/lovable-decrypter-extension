(() => {
  'use strict';

  if (window.__LD84_CANONICAL_INTEGRATIONS_CENTER__) return;
  window.__LD84_CANONICAL_INTEGRATIONS_CENTER__ = true;

  const BUILD = 84;
  const VERSION = '2.6.84';
  const HOST_ID = 'lovable-decrypter-launcher';
  const HANDLED = new Set(['github', 'supabase', 'lovable', 'gemini']);

  const text = (value, fallback = '—') => {
    const out = String(value ?? '').trim();
    return out || fallback;
  };

  function hostRoot() {
    return document.getElementById(HOST_ID)?.shadowRoot || null;
  }

  function api() {
    return window.LovableDecrypterCanonicalIntegrationsApi || null;
  }

  function iconFromDetail(detail) {
    return detail.querySelector('.detail-head svg')?.cloneNode(true) || null;
  }

  function clear(node) {
    while (node?.firstChild) node.firstChild.remove();
  }

  function el(tag, className = '', value = '') {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== '') node.textContent = String(value);
    return node;
  }

  function setState(detail, label, tone = 'neutral') {
    const state = detail.querySelector('.state');
    if (!state) return;
    state.textContent = label;
    state.dataset.runtime = tone;
  }

  function ensureStyles(root) {
    if (root.querySelector('style[data-ld84-integrations]')) return;
    const style = document.createElement('style');
    style.dataset.ld84Integrations = 'true';
    style.textContent = `
      #detail .ld84-stack{display:grid;gap:10px;margin-top:14px}
      #detail .ld84-row{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;padding:10px 11px;border:1px solid rgba(255,255,255,.065);border-radius:13px;background:rgba(255,255,255,.018)}
      #detail .ld84-row small{display:block;color:#8d9ab3;font-size:9px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;margin-bottom:4px}
      #detail .ld84-row b{display:block;color:#edf4ff;font-size:11px;line-height:1.35;overflow-wrap:anywhere}
      #detail .ld84-tag{padding:5px 8px;border-radius:999px;background:rgba(59,210,255,.08);color:#8edfff;font-size:9px;font-weight:800;white-space:nowrap}
      #detail .ld84-tag.ok{background:rgba(67,216,142,.11);color:#7be8ad}
      #detail .ld84-tag.warn{background:rgba(255,194,92,.11);color:#ffd184}
      #detail .ld84-tag.bad{background:rgba(255,104,122,.11);color:#ff9baa}
      #detail .ld84-field{display:grid;gap:6px;margin-top:12px}
      #detail .ld84-field span{color:#8d9ab3;font-size:9px;font-weight:800;letter-spacing:.05em;text-transform:uppercase}
      #detail .ld84-field select{width:100%;min-height:36px;border:1px solid rgba(255,255,255,.09);border-radius:10px;background:#0c1728;color:#eef5ff;padding:0 10px;outline:none;font:11px Arial,sans-serif}
      #detail .ld84-actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}
      #detail .ld84-btn{min-height:34px;border:1px solid rgba(255,255,255,.08);border-radius:10px;background:rgba(255,255,255,.035);color:#dde8f8;padding:7px 10px;font:700 10px Arial,sans-serif;cursor:pointer}
      #detail .ld84-btn:hover{background:rgba(59,210,255,.09);border-color:rgba(59,210,255,.22)}
      #detail .ld84-btn.primary{background:linear-gradient(180deg,rgba(59,210,255,.22),rgba(59,210,255,.11));border-color:rgba(59,210,255,.3);color:#f8fdff}
      #detail .ld84-btn.danger{color:#ffadb7;border-color:rgba(255,104,122,.18)}
      #detail .ld84-btn:disabled{opacity:.45;cursor:not-allowed}
      #detail .ld84-note{margin-top:12px;padding:9px 10px;border-radius:11px;background:rgba(59,210,255,.045);color:#8291aa;font-size:9.5px;line-height:1.45}
      #detail .ld84-status{margin-top:9px;color:#93a2ba;font-size:9.5px;line-height:1.45;overflow-wrap:anywhere}
    `;
    root.appendChild(style);
  }

  function buildHead(detail, title, statusLabel, statusTone) {
    const savedIcon = iconFromDetail(detail);
    clear(detail);
    const head = el('div', 'detail-head');
    if (savedIcon) head.appendChild(savedIcon);
    head.appendChild(el('b', '', title));
    const state = el('span', 'state', statusLabel);
    state.dataset.runtime = statusTone;
    head.appendChild(state);
    detail.appendChild(head);
  }

  function row(label, value, tag, tone = '') {
    const node = el('div', 'ld84-row');
    const copy = el('div');
    copy.append(el('small', '', label), el('b', '', text(value)));
    const badge = el('span', `ld84-tag${tone ? ` ${tone}` : ''}`, tag);
    node.append(copy, badge);
    return node;
  }

  function button(label, action, { tone = '', disabled = false } = {}) {
    const node = el('button', `ld84-btn${tone ? ` ${tone}` : ''}`, label);
    node.type = 'button';
    node.dataset.ld84Action = action;
    node.disabled = disabled;
    return node;
  }

  function selectField(label, action, items, selectedValue = '') {
    const wrap = el('label', 'ld84-field');
    wrap.appendChild(el('span', '', label));
    const select = document.createElement('select');
    select.dataset.ld84Select = action;
    for (const item of items) {
      const option = document.createElement('option');
      option.value = String(item.value || '');
      option.textContent = String(item.label || item.value || '');
      if (option.value === selectedValue) option.selected = true;
      select.appendChild(option);
    }
    wrap.appendChild(select);
    return wrap;
  }

  function statusLine(detail, value, tone = '') {
    let node = detail.querySelector('.ld84-status');
    if (!node) {
      node = el('div', 'ld84-status');
      detail.appendChild(node);
    }
    node.textContent = String(value || '');
    node.dataset.tone = tone;
    return node;
  }

  async function currentSettings() {
    return window.LovableDecrypterV2?.settings?.() || {};
  }

  async function renderGithub(detail) {
    const integration = api()?.github;
    if (!integration) throw new Error('Canonical GitHub client não carregado.');
    buildHead(detail, 'GitHub', 'VERIFICANDO', 'checking');
    const stack = el('div', 'ld84-stack');
    detail.appendChild(stack);

    const status = await integration.status();
    const connected = Boolean(status?.connected);
    const configured = Boolean(status?.app_configured);
    const repos = Array.isArray(status?.repositories) ? status.repositories : [];
    const settings = await currentSettings();
    const mapped = settings.github?.owner && settings.github?.repo ? `${settings.github.owner}/${settings.github.repo}` : '';

    setState(detail, connected ? 'CONECTADO' : configured ? 'AUTORIZAÇÃO' : 'CONFIGURAÇÃO', connected ? 'online' : 'offline');
    stack.append(
      row('Conta', status?.installation?.account_login || 'Não conectada', connected ? 'OK' : 'OFF', connected ? 'ok' : 'warn'),
      row('GitHub App', configured ? 'Configurado' : 'Pendente', configured ? 'APP' : 'PENDENTE', configured ? 'ok' : 'warn'),
      row('Repositórios autorizados', String(repos.length), `${repos.length}`, repos.length ? 'ok' : 'warn'),
      row('Repositório deste projeto', mapped || 'Não selecionado', mapped ? 'MAPEADO' : 'PENDENTE', mapped ? 'ok' : 'warn')
    );

    if (connected && repos.length) {
      stack.appendChild(selectField('Repositório autorizado', 'github-repo', repos.map(repo => ({
        value: repo.full_name,
        label: `${repo.full_name}${repo.private ? ' · privado' : ''}`
      })), mapped));
    }

    const actions = el('div', 'ld84-actions');
    if (!connected) actions.appendChild(button(configured ? 'Autorizar GitHub' : 'Configurar GitHub App', 'github-connect', { tone: 'primary' }));
    else {
      actions.appendChild(button('Usar repositório', 'github-map', { tone: 'primary', disabled: !repos.length }));
      actions.appendChild(button('Alterar autorização', 'github-connect'));
      actions.appendChild(button('Desconectar', 'github-disconnect', { tone: 'danger' }));
    }
    actions.appendChild(button('Atualizar', 'github-refresh'));
    detail.appendChild(actions);
    detail.appendChild(el('div', 'ld84-note', 'GitHub App + repositórios explicitamente autorizados. O launcher canônico não solicita nem armazena PAT para este fluxo.'));
  }

  async function renderSupabase(detail) {
    const integration = api()?.supabase;
    if (!integration) throw new Error('Canonical Supabase client não carregado.');
    buildHead(detail, 'Supabase', 'VERIFICANDO', 'checking');
    const stack = el('div', 'ld84-stack');
    detail.appendChild(stack);

    const status = await integration.status();
    const connected = Boolean(status?.connected);
    const configured = Boolean(status?.app_configured);
    const reauth = Boolean(status?.reauthorize_required);
    const projects = Array.isArray(status?.projects) ? status.projects : [];
    const settings = await currentSettings();
    const id = api()?.projectId?.() || '';
    const mapped = id && settings.supabaseMappings?.[id] ? settings.supabaseMappings[id] : settings.supabase || {};

    setState(detail, connected && !reauth ? 'CONECTADO' : reauth ? 'REAUTORIZAR' : configured ? 'AUTORIZAÇÃO' : 'CONFIGURAÇÃO', connected && !reauth ? 'online' : 'offline');
    stack.append(
      row('OAuth App', configured ? 'Configurado' : 'Pendente', configured ? 'OAUTH' : 'PENDENTE', configured ? 'ok' : 'warn'),
      row('Conta', connected ? 'Autorizada' : 'Não conectada', connected ? 'OK' : 'OFF', connected ? 'ok' : 'warn'),
      row('Projetos autorizados', String(projects.length), `${projects.length}`, projects.length ? 'ok' : 'warn'),
      row('Projeto deste Lovable', mapped.projectName || mapped.projectRef || 'Não selecionado', mapped.projectRef ? 'MAPEADO' : 'PENDENTE', mapped.projectRef ? 'ok' : 'warn')
    );

    if (connected && projects.length) {
      stack.appendChild(selectField('Projeto Supabase autorizado', 'supabase-project', projects.map(project => ({
        value: project.ref,
        label: `${project.name || project.ref} · ${project.ref}`
      })), mapped.projectRef || ''));
    }

    const actions = el('div', 'ld84-actions');
    if (!configured && status?.can_bootstrap) actions.appendChild(button('Configurar OAuth App', 'supabase-bootstrap', { tone: 'primary' }));
    else if (!connected || reauth) actions.appendChild(button(reauth ? 'Reautorizar Supabase' : 'Autorizar Supabase', 'supabase-connect', { tone: 'primary' }));
    else {
      actions.appendChild(button('Usar projeto', 'supabase-map', { tone: 'primary', disabled: !projects.length }));
      actions.appendChild(button('Reautorizar', 'supabase-connect'));
      actions.appendChild(button('Desconectar', 'supabase-disconnect', { tone: 'danger' }));
    }
    actions.appendChild(button('Atualizar', 'supabase-refresh'));
    detail.appendChild(actions);
    detail.appendChild(el('div', 'ld84-note', 'OAuth oficial. Nenhuma service_role, senha do banco ou management token é exibido pela UI canônica.'));
  }

  async function renderLovable(detail) {
    const integration = api()?.lovable;
    if (!integration) throw new Error('Canonical Lovable client não carregado.');
    buildHead(detail, 'Lovable', 'VERIFICANDO', 'checking');
    const status = await integration.status();
    const detected = Boolean(status?.detected);
    setState(detail, detected ? 'PROJETO ATIVO' : 'SEM PROJETO', detected ? 'online' : 'offline');
    const stack = el('div', 'ld84-stack');
    stack.append(
      row('Projeto Lovable', status?.projectId || 'Não identificado', detected ? 'ATIVO' : 'OFF', detected ? 'ok' : 'warn'),
      row('GitHub mapeado', status?.github ? `${status.github.owner}/${status.github.repo}` : 'Não mapeado', status?.github ? 'OK' : 'PENDENTE', status?.github ? 'ok' : 'warn'),
      row('Branch', status?.github?.branch || '—', status?.github?.branch ? 'GIT' : '—'),
      row('Supabase mapeado', status?.supabase?.projectName || status?.supabase?.projectRef || 'Não mapeado', status?.supabase ? 'OK' : 'PENDENTE', status?.supabase ? 'ok' : 'warn')
    );
    detail.appendChild(stack);
    const actions = el('div', 'ld84-actions');
    actions.append(button('Atualizar estado', 'lovable-refresh'));
    detail.appendChild(actions);
    detail.appendChild(el('div', 'ld84-note', 'Esta build usa a identidade atual do projeto e os mapeamentos seguros já existentes. Não reativa o antigo polling do Project Runtime.'));
  }

  async function renderGemini(detail) {
    const integration = api()?.gemini;
    if (!integration) throw new Error('Canonical Gemini client não carregado.');
    buildHead(detail, 'Gemini', 'VERIFICANDO', 'checking');
    const status = await integration.status();
    setState(detail, status?.configured ? 'CONFIGURADO' : 'SEM CHAVE', status?.configured ? 'online' : 'offline');
    const stack = el('div', 'ld84-stack');
    stack.append(
      row('Configuração', status?.configured ? 'API key salva no fluxo de configurações' : 'API key não configurada', status?.configured ? 'OK' : 'PENDENTE', status?.configured ? 'ok' : 'warn'),
      row('Modelo principal', status?.model || '—', status?.zeroCost ? 'FREE' : 'CHECK', status?.zeroCost ? 'ok' : 'warn'),
      row('Modelo avançado', status?.advancedModel || '—', status?.zeroCost ? 'FREE' : 'CHECK', status?.zeroCost ? 'ok' : 'warn'),
      row('Política', status?.zeroCost ? 'Zero Cost / sem fallback pago automático' : text(status?.billingMode), status?.zeroCost ? 'SAFE' : 'WARN', status?.zeroCost ? 'ok' : 'warn')
    );
    detail.appendChild(stack);
    const actions = el('div', 'ld84-actions');
    actions.append(
      button('Testar conexão', 'gemini-test', { tone: 'primary', disabled: !status?.configured }),
      button('Consultar modelos Free', 'gemini-models', { disabled: !status?.configured }),
      button('Atualizar', 'gemini-refresh')
    );
    detail.appendChild(actions);
    detail.appendChild(el('div', 'ld84-note', 'A chave não é renderizada nesta tela. Testes e descoberta de modelos usam a configuração já armazenada pelo runtime.'));
  }

  const RENDERERS = Object.freeze({
    github: renderGithub,
    supabase: renderSupabase,
    lovable: renderLovable,
    gemini: renderGemini
  });

  async function render(moduleId) {
    if (!HANDLED.has(moduleId)) return false;
    const root = hostRoot();
    const detail = root?.getElementById('detail');
    if (!root || !detail || detail.dataset.module !== moduleId) return false;
    ensureStyles(root);
    try {
      await RENDERERS[moduleId](detail);
      detail.dataset.module = moduleId;
      detail.dataset.ld84Canonical = 'true';
    } catch (error) {
      if (!detail.isConnected || detail.dataset.module !== moduleId) return false;
      setState(detail, 'ERRO', 'offline');
      statusLine(detail, error?.message || String(error), 'error');
    }
    return true;
  }

  async function act(moduleId, action, target) {
    const integration = api();
    if (!integration) throw new Error('Canonical Integrations API indisponível.');
    const root = hostRoot();
    const detail = root?.getElementById('detail');
    if (!detail || detail.dataset.module !== moduleId) return;
    statusLine(detail, 'Executando…');

    switch (action) {
      case 'github-connect':
        await integration.github.connect();
        statusLine(detail, 'Autorização aberta em nova aba. Ao concluir, clique em Atualizar.');
        return;
      case 'github-disconnect':
        await integration.github.disconnect();
        await render('github');
        return;
      case 'github-map': {
        const selected = detail.querySelector('[data-ld84-select="github-repo"]')?.value || '';
        if (!selected) throw new Error('Selecione um repositório.');
        await integration.github.selectRepository(selected);
        await render('github');
        return;
      }
      case 'github-refresh':
        await render('github');
        return;
      case 'supabase-bootstrap':
        await integration.supabase.bootstrap();
        statusLine(detail, 'Configuração OAuth aberta em nova aba. Ao concluir, clique em Atualizar.');
        return;
      case 'supabase-connect':
        await integration.supabase.connect();
        statusLine(detail, 'Autorização aberta em nova aba. Ao concluir, clique em Atualizar.');
        return;
      case 'supabase-disconnect':
        await integration.supabase.disconnect();
        await render('supabase');
        return;
      case 'supabase-map': {
        const selected = detail.querySelector('[data-ld84-select="supabase-project"]')?.value || '';
        if (!selected) throw new Error('Selecione um projeto Supabase.');
        await integration.supabase.selectProject(selected);
        await render('supabase');
        return;
      }
      case 'supabase-refresh':
        await render('supabase');
        return;
      case 'lovable-refresh':
        await render('lovable');
        return;
      case 'gemini-test': {
        const result = await integration.gemini.test();
        statusLine(detail, `Conexão concluída${result?.text ? ` · ${String(result.text).slice(0, 140)}` : ' · OK'}`, 'ok');
        return;
      }
      case 'gemini-models': {
        const result = await integration.gemini.models();
        const models = result?.models || [];
        statusLine(detail, `${models.length} modelo(s) Free Tier compatível(is): ${models.slice(0, 6).map(item => item.displayName || item.id).join(', ') || 'nenhum'}`);
        return;
      }
      case 'gemini-refresh':
        await render('gemini');
        return;
      default:
        throw new Error(`Ação de integração desconhecida: ${action}`);
    }
  }

  function moduleFromTarget(target) {
    const item = target.closest?.('.fly-item');
    if (item?.dataset?.item && HANDLED.has(item.dataset.item)) return item.dataset.item;
    const detail = hostRoot()?.getElementById('detail');
    return HANDLED.has(detail?.dataset?.module) ? detail.dataset.module : '';
  }

  function bind() {
    const root = hostRoot();
    if (!root || root.__ld84IntegrationsBound) return false;
    root.__ld84IntegrationsBound = true;
    ensureStyles(root);

    root.addEventListener('pointerover', event => {
      const item = event.target.closest?.('.fly-item');
      const moduleId = item?.dataset?.item || '';
      if (HANDLED.has(moduleId)) queueMicrotask(() => render(moduleId));
    });

    root.addEventListener('click', event => {
      const actionNode = event.target.closest?.('[data-ld84-action]');
      if (actionNode) {
        const moduleId = moduleFromTarget(actionNode);
        if (!moduleId) return;
        event.preventDefault();
        event.stopPropagation();
        const action = actionNode.dataset.ld84Action || '';
        actionNode.disabled = true;
        act(moduleId, action, actionNode)
          .catch(error => {
            const detail = root.getElementById('detail');
            if (detail?.dataset?.module === moduleId) statusLine(detail, error?.message || String(error), 'error');
          })
          .finally(() => { if (actionNode.isConnected) actionNode.disabled = false; });
        return;
      }

      const item = event.target.closest?.('.fly-item');
      const moduleId = item?.dataset?.item || '';
      if (HANDLED.has(moduleId)) queueMicrotask(() => render(moduleId));
    });

    window.addEventListener('ld2:integration-callback', event => {
      const provider = String(event?.detail?.provider || '');
      if (HANDLED.has(provider)) queueMicrotask(() => render(provider));
    });
    window.addEventListener('ld84:github-mapped', () => queueMicrotask(() => render('github')));
    window.addEventListener('ld84:supabase-mapped', () => queueMicrotask(() => render('supabase')));

    window.LovableDecrypterCanonicalIntegrations = Object.freeze({
      build: BUILD,
      version: VERSION,
      handles: id => HANDLED.has(String(id || '')),
      render
    });

    document.getElementById(HOST_ID)?.setAttribute('data-ld-integrations-center', 'canonical-v84');
    return true;
  }

  if (!bind()) document.addEventListener('DOMContentLoaded', bind, { once: true });
})();
