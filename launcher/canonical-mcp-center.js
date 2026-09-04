(() => {
  'use strict';

  if (window.__LD88_CANONICAL_MCP_CENTER__) return;
  window.__LD88_CANONICAL_MCP_CENTER__ = true;

  const BUILD = 88;
  const VERSION = '2.6.88';
  const HOST_ID = 'lovable-decrypter-launcher';
  const MODULE_ID = 'mcp-runtime';
  const discovered = new Map();

  const text = (value, fallback = '—') => {
    const out = String(value ?? '').trim();
    return out || fallback;
  };

  function root() { return document.getElementById(HOST_ID)?.shadowRoot || null; }
  function detail() { return root()?.getElementById('detail') || null; }
  function api() { return window.LovableDecrypterCanonicalMcpApi || null; }
  function el(tag, className = '', value = '') {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== '') node.textContent = String(value);
    return node;
  }
  function clear(node) { while (node?.firstChild) node.firstChild.remove(); }

  function ensureStyles() {
    const shadow = root();
    if (!shadow || shadow.querySelector('style[data-ld88-mcp]')) return;
    const style = document.createElement('style');
    style.dataset.ld88Mcp = 'true';
    style.textContent = `
      #detail .ld88-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px}
      #detail .ld88-summary div{padding:9px 10px;border:1px solid rgba(255,255,255,.055);border-radius:11px;background:rgba(255,255,255,.016)}
      #detail .ld88-summary small{display:block;color:#7e8ca3;font-size:8px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;margin-bottom:4px}
      #detail .ld88-summary b{display:block;color:#eaf2ff;font-size:10px;overflow-wrap:anywhere}
      #detail .ld88-section{margin-top:13px}
      #detail .ld88-title{display:flex;justify-content:space-between;align-items:center;margin-bottom:7px;color:#8a99b2;font-size:9px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}
      #detail .ld88-list{display:grid;gap:8px}
      #detail .ld88-card{padding:10px 11px;border:1px solid rgba(255,255,255,.06);border-radius:12px;background:rgba(255,255,255,.017)}
      #detail .ld88-card-head{display:flex;gap:9px;justify-content:space-between;align-items:flex-start}
      #detail .ld88-card-head b{display:block;color:#eef5ff;font-size:10.5px;line-height:1.35;overflow-wrap:anywhere}
      #detail .ld88-card-head small{display:block;color:#8190a8;font-size:8.7px;line-height:1.4;margin-top:3px;overflow-wrap:anywhere}
      #detail .ld88-badges{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}
      #detail .ld88-badge{padding:4px 7px;border-radius:999px;background:rgba(66,210,255,.08);color:#91e3ff;font-size:8px;font-weight:800;white-space:nowrap}
      #detail .ld88-badge.ok{background:rgba(62,207,142,.1);color:#7ceab0}
      #detail .ld88-badge.warn{background:rgba(255,187,83,.1);color:#ffd183}
      #detail .ld88-badge.bad{background:rgba(255,103,122,.1);color:#ff9fac}
      #detail .ld88-badge.write{background:rgba(255,126,94,.11);color:#ffb094}
      #detail .ld88-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}
      #detail .ld88-btn{min-height:31px;border:1px solid rgba(99,222,255,.2);border-radius:9px;background:rgba(99,222,255,.075);color:#e8f8ff;padding:6px 9px;font:700 9px Arial,sans-serif;cursor:pointer}
      #detail .ld88-btn.secondary{background:rgba(255,255,255,.02);border-color:rgba(255,255,255,.075);color:#dce7f8}
      #detail .ld88-btn.danger{border-color:rgba(255,103,122,.18);background:rgba(255,103,122,.05);color:#ffabb6}
      #detail .ld88-btn:disabled{opacity:.43;cursor:not-allowed}
      #detail .ld88-tools{display:grid;gap:6px;margin-top:9px;padding-top:9px;border-top:1px solid rgba(255,255,255,.05)}
      #detail .ld88-tool{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:start;padding:7px 8px;border-radius:9px;background:rgba(255,255,255,.015)}
      #detail .ld88-tool b{display:block;color:#e8f1ff;font-size:9.5px;overflow-wrap:anywhere}
      #detail .ld88-tool small{display:block;color:#77869e;font-size:8.4px;line-height:1.35;margin-top:2px}
      #detail .ld88-note{margin-top:10px;color:#8392aa;font-size:9.3px;line-height:1.45;overflow-wrap:anywhere}
      #detail .ld88-status{margin-top:9px;padding:8px 9px;border:1px solid rgba(99,222,255,.09);border-radius:9px;background:rgba(99,222,255,.03);color:#9eb0c8;font-size:9px;line-height:1.4;overflow-wrap:anywhere}
    `;
    shadow.appendChild(style);
  }

  function badge(label, tone = '') { return el('span', `ld88-badge${tone ? ` ${tone}` : ''}`, label); }
  function summaryCard(label, value) {
    const card = el('div');
    card.append(el('small', '', label), el('b', '', text(value)));
    return card;
  }
  function section(title, count) {
    const wrap = el('section', 'ld88-section');
    const head = el('div', 'ld88-title');
    head.append(el('span', '', title), el('span', '', String(count)));
    const list = el('div', 'ld88-list');
    wrap.append(head, list);
    return { wrap, list };
  }
  function button(label, action, data = {}, tone = 'secondary', disabled = false) {
    const node = el('button', `ld88-btn ${tone}`, label);
    node.type = 'button';
    node.dataset.ld88Action = action;
    for (const [key, value] of Object.entries(data)) node.dataset[key] = String(value);
    node.disabled = disabled;
    return node;
  }

  function statusLine(target, value) {
    let node = target.querySelector('.ld88-status');
    if (!node) { node = el('div', 'ld88-status'); target.appendChild(node); }
    node.textContent = String(value || '');
    return node;
  }

  function buildHead(target) {
    const icon = target.querySelector('.detail-head svg')?.cloneNode(true) || null;
    clear(target);
    const head = el('div', 'detail-head');
    if (icon) head.appendChild(icon);
    head.appendChild(el('b', '', 'MCP Center'));
    const state = el('span', 'state', 'TRUST GATEWAY');
    state.dataset.runtime = 'online';
    head.appendChild(state);
    target.appendChild(head);
  }

  function renderServer(server) {
    const card = el('article', 'ld88-card');
    const head = el('div', 'ld88-card-head');
    const copy = el('div');
    copy.append(el('b', '', text(server.name, 'Servidor MCP')), el('small', '', text(server.endpoint)));
    head.append(copy, badge(server.trust.toUpperCase(), server.trust === 'approved' ? 'ok' : server.trust === 'blocked' ? 'bad' : 'warn'));
    card.appendChild(head);

    const badges = el('div', 'ld88-badges');
    badges.append(
      badge(server.permission?.granted ? 'HOST PERMISSION OK' : 'HOST PERMISSION REQUIRED', server.permission?.granted ? 'ok' : 'warn'),
      badge(`AUTH ${text(server.auth?.mode, 'none').toUpperCase()}`),
      badge(`${server.allowedMethods?.length || 0} METHOD(S)`),
      badge(`${server.toolPolicies?.length || 0} POLICY(S)`)
    );
    if (server.writePolicies?.some(policy => policy.enabled)) badges.appendChild(badge('WRITE POLICY ENABLED', 'write'));
    else badges.appendChild(badge('WRITE DEFAULT DENY', 'ok'));
    card.appendChild(badges);

    if (server.marketplace) {
      const provenance = el('div', 'ld88-note', `Publisher: ${text(server.marketplace.publisher)} · domínio verificado: ${text(server.marketplace.verifiedDomain)} · provenance: ${text(server.marketplace.provenance)}`);
      card.appendChild(provenance);
    } else {
      card.appendChild(el('div', 'ld88-note', 'Servidor registrado fora do catálogo curado. Revise endpoint, trust e permissões antes de descobrir ferramentas.'));
    }

    const actions = el('div', 'ld88-actions');
    if (server.trust !== 'approved') actions.appendChild(button('Aprovar trust', 'trust-approve', { serverId: server.id }, ''));
    if (server.trust !== 'blocked') actions.appendChild(button('Bloquear', 'trust-block', { serverId: server.id }, 'danger'));
    if (!server.permission?.granted) actions.appendChild(button('Permitir host', 'host-permission', { serverId: server.id }, ''));
    actions.appendChild(button('Descobrir tools', 'discover', { serverId: server.id }, '', server.trust !== 'approved' || !server.permission?.granted));
    card.appendChild(actions);

    const discovery = discovered.get(server.id);
    if (discovery) {
      const tools = el('div', 'ld88-tools');
      for (const tool of discovery.tools || []) {
        const item = el('div', 'ld88-tool');
        const toolCopy = el('div');
        toolCopy.append(el('b', '', text(tool.title || tool.name)), el('small', '', text(tool.description, 'Sem descrição.')));
        const policy = tool.localPolicy || {};
        const right = el('div');
        right.appendChild(badge(policy.enabled ? `${text(policy.mode).toUpperCase()} ENABLED` : 'DEFAULT DENY', policy.enabled ? (policy.mode === 'write' ? 'write' : 'ok') : 'warn'));
        item.append(toolCopy, right);
        const toolActions = el('div', 'ld88-actions');
        if (!policy.enabled) toolActions.appendChild(button('Habilitar READ', 'enable-read', { serverId: server.id, toolName: tool.name }, ''));
        else toolActions.appendChild(button('Desabilitar', 'disable-tool', { serverId: server.id, toolName: tool.name }, 'danger'));
        if (policy.mode === 'write') toolActions.appendChild(el('span', 'ld88-note', 'WRITE continua exigindo aprovação humana one-time no Trust Gateway.'));
        toolCopy.appendChild(toolActions);
        tools.appendChild(item);
      }
      if (!discovery.tools?.length) tools.appendChild(el('div', 'ld88-note', 'Nenhuma ferramenta retornada pelo servidor.'));
      card.appendChild(tools);
    }
    return card;
  }

  function renderCatalogItem(item, installs) {
    const card = el('article', 'ld88-card');
    const head = el('div', 'ld88-card-head');
    const copy = el('div');
    copy.append(el('b', '', text(item.title)), el('small', '', `${text(item.publisher)} · ${text(item.description, '')}`));
    head.append(copy, badge(text(item.risk, 'unknown').toUpperCase(), item.risk === 'low' ? 'ok' : 'warn'));
    card.appendChild(head);
    const badges = el('div', 'ld88-badges');
    badges.append(
      badge(text(item.trustLevel).toUpperCase()),
      badge(text(item.transport).toUpperCase()),
      badge(text(item.availability).toUpperCase(), item.availability === 'direct' ? 'ok' : 'warn')
    );
    card.appendChild(badges);
    const provenance = item.provenance || {};
    card.appendChild(el('div', 'ld88-note', `Provenance: ${text(provenance.sourceKind)} · ${text(provenance.verifiedDomain)} · revisado em ${text(provenance.reviewedAt)} · ${text(provenance.sourceUrl)}`));
    const installed = installs?.[item.id]?.status === 'installed';
    const actions = el('div', 'ld88-actions');
    if (installed) actions.appendChild(button('Revogar', 'revoke', { itemId: item.id }, 'danger'));
    else actions.appendChild(button(item.availability === 'direct' ? 'Instalar curado' : item.availability === 'bridge-required' ? 'Bridge necessário' : 'Configuração necessária', 'install', { itemId: item.id }, '', item.availability !== 'direct'));
    card.appendChild(actions);
    return card;
  }

  async function render() {
    const target = detail();
    if (!target || target.dataset.module !== MODULE_ID) return false;
    ensureStyles();
    const center = api();
    if (!center?.snapshot) throw new Error('Canonical MCP Center client não carregado.');
    const prior = target.querySelector('.state');
    if (prior) { prior.textContent = 'VERIFICANDO'; prior.dataset.runtime = 'checking'; }
    const snapshot = await center.snapshot();
    if (!target.isConnected || target.dataset.module !== MODULE_ID) return false;
    buildHead(target);

    const summary = el('div', 'ld88-summary');
    summary.append(
      summaryCard('Protocolo', snapshot.runtime?.protocolVersion || '—'),
      summaryCard('Servidores', String(snapshot.servers?.length || 0)),
      summaryCard('Catálogo curado', String(snapshot.catalog?.length || 0)),
      summaryCard('Write policy', snapshot.runtime?.writePolicy || '—')
    );
    target.appendChild(summary);

    const servers = section('Servidores MCP', snapshot.servers?.length || 0);
    for (const server of snapshot.servers || []) servers.list.appendChild(renderServer(server));
    if (!snapshot.servers?.length) servers.list.appendChild(el('div', 'ld88-note', 'Nenhum servidor MCP registrado. Instale um item curado abaixo.'));
    target.appendChild(servers.wrap);

    const catalog = section('Marketplace curado', snapshot.catalog?.length || 0);
    for (const item of snapshot.catalog || []) catalog.list.appendChild(renderCatalogItem(item, snapshot.installs));
    target.appendChild(catalog.wrap);

    const actions = el('div', 'ld88-actions');
    actions.append(button('Reconciliar', 'reconcile'), button('Atualizar', 'refresh'));
    target.appendChild(actions);
    target.appendChild(el('div', 'ld88-note', 'Anotações MCP remotas nunca decidem segurança. Ferramentas desconhecidas começam em DEFAULT DENY. Esta UI não executa tools MCP diretamente e não aprova writes.'));
    target.dataset.ld88Canonical = 'true';
    return true;
  }

  async function act(action, node) {
    const center = api();
    const target = detail();
    if (!center || !target) return;
    const serverId = node.dataset.serverId || '';
    const itemId = node.dataset.itemId || '';
    const toolName = node.dataset.toolName || '';
    if (action === 'refresh') { await render(); return; }
    if (action === 'reconcile') { await center.reconcile(); await render(); return; }
    if (action === 'trust-approve') { await center.setTrust(serverId, 'approved'); await render(); return; }
    if (action === 'trust-block') { await center.setTrust(serverId, 'blocked'); discovered.delete(serverId); await render(); return; }
    if (action === 'host-permission') { await center.requestHostPermission(serverId); await render(); return; }
    if (action === 'install') { await center.installCurated(itemId); await render(); return; }
    if (action === 'revoke') { await center.revokeCurated(itemId); await render(); return; }
    if (action === 'discover') {
      statusLine(target, 'Consultando tools/list…');
      discovered.set(serverId, await center.discoverTools(serverId));
      await render();
      const current = detail();
      if (current?.dataset?.module === MODULE_ID) statusLine(current, `${discovered.get(serverId)?.tools?.length || 0} ferramenta(s) descoberta(s). Classificação remota não altera a política local.`);
      return;
    }
    if (action === 'enable-read') {
      await center.enableReadTool(serverId, toolName);
      discovered.set(serverId, await center.discoverTools(serverId));
      await render();
      return;
    }
    if (action === 'disable-tool') {
      await center.disableTool(serverId, toolName);
      discovered.set(serverId, await center.discoverTools(serverId));
      await render();
      return;
    }
    throw new Error(`Ação MCP desconhecida: ${action}`);
  }

  function bind() {
    const shadow = root();
    if (!shadow || shadow.__ld88McpBound) return false;
    shadow.__ld88McpBound = true;
    ensureStyles();
    shadow.addEventListener('pointerover', event => {
      const item = event.target.closest?.('.fly-item');
      if (item?.dataset?.item === MODULE_ID) queueMicrotask(() => render().catch(() => {}));
    });
    shadow.addEventListener('click', event => {
      const actionNode = event.target.closest?.('[data-ld88-action]');
      if (actionNode) {
        event.preventDefault();
        event.stopPropagation();
        actionNode.disabled = true;
        act(actionNode.dataset.ld88Action || '', actionNode).catch(error => {
          const target = detail();
          if (target?.dataset?.module === MODULE_ID) statusLine(target, error?.message || String(error));
        }).finally(() => { if (actionNode.isConnected) actionNode.disabled = false; });
        return;
      }
      const item = event.target.closest?.('.fly-item');
      if (item?.dataset?.item === MODULE_ID) queueMicrotask(() => render().catch(() => {}));
    });
    window.LovableDecrypterCanonicalMcpCenter = Object.freeze({
      build: BUILD,
      version: VERSION,
      handles: id => String(id || '') === MODULE_ID,
      render
    });
    document.getElementById(HOST_ID)?.setAttribute('data-ld-mcp-center', 'canonical-v88');
    return true;
  }

  if (!bind()) document.addEventListener('DOMContentLoaded', bind, { once: true });
})();
