(() => {
  'use strict';

  if (window.__LD86_CANONICAL_TOOL_RUNTIME__) return;
  window.__LD86_CANONICAL_TOOL_RUNTIME__ = true;

  const BUILD = 86;
  const VERSION = '2.6.86';
  const HOST_ID = 'lovable-decrypter-launcher';
  const MODULE_ID = 'tool-runtime';

  const text = (value, fallback = '—') => {
    const out = String(value ?? '').trim();
    return out || fallback;
  };

  function shadow() {
    return document.getElementById(HOST_ID)?.shadowRoot || null;
  }

  function detail() {
    return shadow()?.getElementById('detail') || null;
  }

  function api() {
    return window.LovableDecrypterCanonicalToolsApi || null;
  }

  function el(tag, className = '', value = '') {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== '') node.textContent = String(value);
    return node;
  }

  function clear(node) {
    while (node?.firstChild) node.firstChild.remove();
  }

  function ensureStyles() {
    const root = shadow();
    if (!root || root.querySelector('style[data-ld86-tools]')) return;
    const style = document.createElement('style');
    style.dataset.ld86Tools = 'true';
    style.textContent = `
      #detail .ld86-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px}
      #detail .ld86-summary div{padding:9px 10px;border:1px solid rgba(255,255,255,.055);border-radius:11px;background:rgba(255,255,255,.016)}
      #detail .ld86-summary small{display:block;color:#7e8ca3;font-size:8px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;margin-bottom:4px}
      #detail .ld86-summary b{display:block;color:#eaf2ff;font-size:10px;overflow-wrap:anywhere}
      #detail .ld86-section{margin-top:13px}
      #detail .ld86-title{display:flex;justify-content:space-between;align-items:center;margin-bottom:7px;color:#8a99b2;font-size:9px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}
      #detail .ld86-list{display:grid;gap:7px}
      #detail .ld86-tool,#detail .ld86-op{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:start;padding:9px 10px;border:1px solid rgba(255,255,255,.055);border-radius:11px;background:rgba(255,255,255,.016)}
      #detail .ld86-tool b,#detail .ld86-op b{display:block;color:#edf4ff;font-size:10px;line-height:1.35;overflow-wrap:anywhere}
      #detail .ld86-tool small,#detail .ld86-op small{display:block;color:#8190a8;font-size:8.8px;line-height:1.4;margin-top:3px;overflow-wrap:anywhere}
      #detail .ld86-badge{padding:4px 7px;border-radius:999px;background:rgba(66,210,255,.08);color:#91e3ff;font-size:8px;font-weight:800;white-space:nowrap}
      #detail .ld86-badge.write{background:rgba(255,187,83,.1);color:#ffd183}
      #detail .ld86-badge.ok{background:rgba(62,207,142,.1);color:#7ceab0}
      #detail .ld86-badge.failed{background:rgba(255,103,122,.1);color:#ff9fac}
      #detail .ld86-actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}
      #detail .ld86-btn{min-height:34px;border:1px solid rgba(99,222,255,.22);border-radius:10px;background:rgba(99,222,255,.08);color:#e8f8ff;padding:7px 11px;font:700 10px Arial,sans-serif;cursor:pointer}
      #detail .ld86-btn.secondary{background:rgba(255,255,255,.025);border-color:rgba(255,255,255,.08);color:#dce7f8}
      #detail .ld86-btn:disabled{opacity:.45;cursor:not-allowed}
      #detail .ld86-note{margin-top:10px;color:#8392aa;font-size:9.5px;line-height:1.45;overflow-wrap:anywhere}
      #detail .ld86-output{margin-top:9px;padding:9px 10px;border:1px solid rgba(99,222,255,.1);border-radius:10px;background:rgba(99,222,255,.03);color:#9eb0c8;font:9px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre-wrap;max-height:150px;overflow:auto}
    `;
    root.appendChild(style);
  }

  function badge(label, className = '') {
    return el('span', `ld86-badge${className ? ` ${className}` : ''}`, label);
  }

  function buildHead(target, online) {
    const icon = target.querySelector('.detail-head svg')?.cloneNode(true) || null;
    clear(target);
    const head = el('div', 'detail-head');
    if (icon) head.appendChild(icon);
    head.appendChild(el('b', '', 'Tool Runtime'));
    const state = el('span', 'state', online ? 'ONLINE' : 'INDISPONÍVEL');
    state.dataset.runtime = online ? 'online' : 'offline';
    head.appendChild(state);
    target.appendChild(head);
  }

  function summaryCard(label, value) {
    const card = el('div');
    card.append(el('small', '', label), el('b', '', text(value)));
    return card;
  }

  function toolRow(tool) {
    const row = el('div', 'ld86-tool');
    const copy = el('div');
    copy.append(el('b', '', tool.name), el('small', '', tool.description || tool.capability || 'Sem descrição'));
    row.append(copy, badge(tool.mode === 'write' ? 'WRITE · TX REQUIRED' : 'READ', tool.mode === 'write' ? 'write' : ''));
    return row;
  }

  function operationRow(entry) {
    const row = el('div', 'ld86-op');
    const copy = el('div');
    const when = entry?.startedAt ? new Date(entry.startedAt).toLocaleString('pt-BR') : '';
    const info = [entry?.mode, entry?.origin, when].filter(Boolean).join(' · ');
    copy.append(el('b', '', text(entry?.tool, 'operação')), el('small', '', info));
    row.append(copy, badge(text(entry?.status, 'unknown').toUpperCase(), entry?.status === 'ok' ? 'ok' : entry?.status === 'failed' ? 'failed' : ''));
    return row;
  }

  function section(title, count) {
    const wrap = el('section', 'ld86-section');
    const head = el('div', 'ld86-title');
    head.append(el('span', '', title), el('span', '', String(count)));
    const list = el('div', 'ld86-list');
    wrap.append(head, list);
    return { wrap, list };
  }

  function output(target, value) {
    let box = target.querySelector('.ld86-output');
    if (!box) {
      box = el('pre', 'ld86-output');
      target.appendChild(box);
    }
    box.textContent = String(value || '');
    return box;
  }

  async function render() {
    const target = detail();
    if (!target || target.dataset.module !== MODULE_ID) return false;
    ensureStyles();
    const tools = api();
    if (!tools?.snapshot) throw new Error('Canonical Tool Runtime client não carregado.');

    const prior = target.querySelector('.state');
    if (prior) {
      prior.textContent = 'VERIFICANDO';
      prior.dataset.runtime = 'checking';
    }

    const snapshot = await tools.snapshot();
    if (!target.isConnected || target.dataset.module !== MODULE_ID) return false;
    const runtime = snapshot.runtime || {};
    const entries = snapshot.operations?.entries || [];
    buildHead(target, true);

    const summary = el('div', 'ld86-summary');
    summary.append(
      summaryCard('Repositório', runtime.repo || '—'),
      summaryCard('Branch', runtime.branch || '—'),
      summaryCard('Read tools', String(runtime.readTools?.length || 0)),
      summaryCard('Write tools', String(runtime.writeTools?.length || 0))
    );
    target.appendChild(summary);

    const reads = section('Ferramentas de leitura', runtime.readTools?.length || 0);
    for (const tool of runtime.readTools || []) reads.list.appendChild(toolRow(tool));
    target.appendChild(reads.wrap);

    const writes = section('Ferramentas de escrita', runtime.writeTools?.length || 0);
    for (const tool of runtime.writeTools || []) writes.list.appendChild(toolRow(tool));
    target.appendChild(writes.wrap);

    const ops = section('Operation Journal', entries.length);
    for (const entry of entries.slice(0, 10)) ops.list.appendChild(operationRow(entry));
    if (!entries.length) ops.list.appendChild(el('div', 'ld86-note', 'Nenhuma operação registrada para este projeto.'));
    target.appendChild(ops.wrap);

    const actions = el('div', 'ld86-actions');
    const smoke = el('button', 'ld86-btn', 'Testar leitura segura');
    smoke.type = 'button';
    smoke.dataset.ld86Action = 'smoke';
    const refresh = el('button', 'ld86-btn secondary', 'Atualizar');
    refresh.type = 'button';
    refresh.dataset.ld86Action = 'refresh';
    actions.append(smoke, refresh);
    target.appendChild(actions);

    target.appendChild(el('div', 'ld86-note', `Write policy: ${text(runtime.writePolicy)}. A UI canônica não chama ferramentas WRITE diretamente; mutações exigem Change Transaction validada, Scope Intelligence e os gates já existentes.`));
    target.dataset.ld86Canonical = 'true';
    return true;
  }

  async function act(action) {
    const target = detail();
    if (!target || target.dataset.module !== MODULE_ID) return;
    if (action === 'refresh') {
      await render();
      return;
    }
    if (action === 'smoke') {
      const result = await api().safeSmokeTest();
      const files = result?.data?.files || [];
      output(target, `Tool: ${result?.tool || 'repo.list_files'}\nOperation: ${result?.operationId || '—'}\nArquivos: ${files.length}\n${files.slice(0, 15).map(file => file.path).join('\n')}`);
      await render();
      const current = detail();
      if (current?.dataset?.module === MODULE_ID) output(current, `Leitura segura concluída. ${files.length} arquivo(s) retornados. Operation ID: ${result?.operationId || '—'}`);
      return;
    }
    throw new Error(`Ação desconhecida: ${action}`);
  }

  function bind() {
    const root = shadow();
    if (!root || root.__ld86ToolsBound) return false;
    root.__ld86ToolsBound = true;
    ensureStyles();

    root.addEventListener('pointerover', event => {
      const item = event.target.closest?.('.fly-item');
      if (item?.dataset?.item === MODULE_ID) queueMicrotask(() => render().catch(() => {}));
    });

    root.addEventListener('click', event => {
      const actionNode = event.target.closest?.('[data-ld86-action]');
      if (actionNode) {
        event.preventDefault();
        event.stopPropagation();
        const action = actionNode.dataset.ld86Action || '';
        actionNode.disabled = true;
        act(action).catch(error => {
          const target = detail();
          if (target?.dataset?.module === MODULE_ID) output(target, error?.message || String(error));
        }).finally(() => { if (actionNode.isConnected) actionNode.disabled = false; });
        return;
      }
      const item = event.target.closest?.('.fly-item');
      if (item?.dataset?.item === MODULE_ID) queueMicrotask(() => render().catch(() => {}));
    });

    window.LovableDecrypterCanonicalToolRuntime = Object.freeze({
      build: BUILD,
      version: VERSION,
      handles: id => String(id || '') === MODULE_ID,
      render
    });

    document.getElementById(HOST_ID)?.setAttribute('data-ld-tool-runtime', 'canonical-v86');
    return true;
  }

  if (!bind()) document.addEventListener('DOMContentLoaded', bind, { once: true });
})();
