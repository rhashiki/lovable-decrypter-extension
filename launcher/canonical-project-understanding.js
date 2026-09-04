(() => {
  'use strict';

  if (window.__LD96_CANONICAL_PROJECT_UNDERSTANDING__) return;
  window.__LD96_CANONICAL_PROJECT_UNDERSTANDING__ = true;

  const MODULE_ID = 'project-understanding';
  const HOST_ID = 'lovable-decrypter-launcher';
  const TYPES = ['route','component','file','dependency','api','database_table','database_rpc','migration'];
  const LABELS = {
    route: 'Rotas', component: 'Componentes', file: 'Arquivos', dependency: 'Dependências', api: 'APIs',
    database_table: 'Tabelas', database_rpc: 'RPCs', migration: 'Migrations'
  };
  const state = { busy: false, error: '', map: null, filter: 'all', query: '', expanded: '' };

  const root = () => document.getElementById(HOST_ID)?.shadowRoot || null;
  const detail = () => root()?.getElementById('detail') || null;
  const api = () => window.LovableDecrypterCanonicalProjectUnderstandingApi || null;
  const el = (tag, cls = '', txt = '') => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt !== '') n.textContent = String(txt); return n; };
  const clear = node => { while (node?.firstChild) node.firstChild.remove(); };
  const shortSha = value => String(value || '').slice(0, 10) || '—';

  function ensureStyles() {
    const shadow = root();
    if (!shadow || shadow.querySelector('style[data-ld96-map]')) return;
    const style = document.createElement('style'); style.dataset.ld96Map = 'true';
    style.textContent = `
      #detail .ld96-top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px}
      #detail .ld96-actions{display:flex;gap:6px;flex-wrap:wrap}
      #detail .ld96-btn{border:1px solid rgba(59,210,255,.18);border-radius:9px;background:rgba(59,210,255,.07);color:#dcf7ff;padding:6px 9px;font:800 8.5px Arial;cursor:pointer}
      #detail .ld96-btn:disabled{opacity:.45;cursor:not-allowed}
      #detail .ld96-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:10px}
      #detail .ld96-stat{padding:8px;border:1px solid rgba(255,255,255,.055);border-radius:10px;background:rgba(255,255,255,.015)}
      #detail .ld96-stat b{display:block;color:#e9f6ff;font-size:14px}.ld96-stat span{display:block;color:#77879f;font-size:7.8px;margin-top:2px;text-transform:uppercase}
      #detail .ld96-meta{margin-top:8px;padding:8px;border:1px solid rgba(62,207,142,.1);border-radius:9px;background:rgba(62,207,142,.025);color:#8fa0b6;font-size:8.5px;line-height:1.45}
      #detail .ld96-meta strong{color:#bdebd2}
      #detail .ld96-filters{display:flex;gap:5px;flex-wrap:wrap;margin-top:10px}
      #detail .ld96-chip{border:1px solid rgba(255,255,255,.06);border-radius:999px;background:rgba(255,255,255,.015);color:#91a1b8;padding:4px 7px;font:800 7.8px Arial;cursor:pointer}
      #detail .ld96-chip.active{border-color:rgba(59,210,255,.24);background:rgba(59,210,255,.08);color:#c8f3ff}
      #detail .ld96-search{width:100%;margin-top:8px;border:1px solid rgba(255,255,255,.07);border-radius:9px;background:rgba(4,10,20,.35);color:#edf5ff;padding:8px 9px;font:9px Arial;outline:none}
      #detail .ld96-node{margin-top:7px;padding:8px 9px;border:1px solid rgba(255,255,255,.055);border-radius:10px;background:rgba(255,255,255,.012);cursor:pointer}
      #detail .ld96-node:hover{border-color:rgba(59,210,255,.14)}
      #detail .ld96-node-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}
      #detail .ld96-node b{color:#e6eef9;font-size:9.5px;line-height:1.35;overflow-wrap:anywhere}
      #detail .ld96-type{color:#6f8199;font-size:7.3px;font-weight:900;text-transform:uppercase}
      #detail .ld96-confidence{white-space:nowrap;border-radius:999px;padding:3px 6px;background:rgba(62,207,142,.08);color:#83e6ae;font-size:7.5px;font-weight:900}
      #detail .ld96-confidence.mid{background:rgba(255,187,83,.08);color:#ffd184}
      #detail .ld96-evidence{margin-top:5px;color:#7f90a7;font-size:8.2px;line-height:1.4;overflow-wrap:anywhere}
      #detail .ld96-rel{margin-top:5px;padding-left:7px;border-left:2px solid rgba(59,210,255,.12);color:#96a8bd;font-size:8px;line-height:1.35}
      #detail .ld96-empty{margin-top:12px;color:#7f8da3;font-size:9px;line-height:1.45}
      #detail .ld96-error{margin-top:9px;padding:8px;border:1px solid rgba(255,103,122,.14);border-radius:9px;background:rgba(255,103,122,.035);color:#ffb2bd;font-size:8.8px;line-height:1.4}
    `;
    shadow.appendChild(style);
  }

  function installRailButton() {
    const shadow = root(); const rail = shadow?.getElementById('railButtons');
    if (!rail || rail.querySelector('[data-id="project-understanding"]')) return Boolean(rail);
    const button = el('button', 'rail-btn'); button.type = 'button'; button.dataset.kind = 'direct'; button.dataset.id = MODULE_ID; button.setAttribute('aria-label', 'Project Understanding');
    button.textContent = '◫'; button.appendChild(el('span', 'tip', 'Project Understanding'));
    rail.appendChild(button); return true;
  }

  function show(anchor) {
    const shadow = root(); const target = detail(); const flyout = shadow?.getElementById('flyout');
    if (!target || !anchor) return false;
    for (const n of shadow.querySelectorAll('.rail-btn.active')) n.classList.remove('active');
    anchor.classList.add('active'); if (flyout) flyout.classList.remove('show');
    target.dataset.module = MODULE_ID; target.style.display = ''; target.style.visibility = ''; target.classList.add('show');
    const rect = anchor.getBoundingClientRect(); target.style.left = `${Math.max(8, Math.round(rect.left - 390))}px`; target.style.top = `${Math.max(8, Math.min(Math.round(rect.top), innerHeight - 300))}px`; target.style.width = '380px'; target.style.maxHeight = `${Math.max(320, innerHeight - 16)}px`; target.style.overflowY = 'auto';
    return true;
  }

  function confidenceClass(value) { return Number(value || 0) < .8 ? ' mid' : ''; }
  function matches(node) {
    if (state.filter !== 'all' && node.type !== state.filter) return false;
    const q = state.query.trim().toLowerCase();
    if (!q) return true;
    return `${node.label} ${node.key} ${node.type} ${(node.evidence || []).map(e => `${e.path} ${e.reason} ${e.detail}`).join(' ')}`.toLowerCase().includes(q);
  }

  function renderMeta(target) {
    const freshness = state.map?.freshness || {};
    const runtime = state.map?.runtime || {};
    const meta = el('div', 'ld96-meta');
    const title = el('strong', '', state.map?.project?.github || 'Projeto');
    meta.appendChild(title);
    meta.appendChild(document.createTextNode(` · ${state.map?.project?.branch || 'main'}`));
    meta.appendChild(document.createElement('br'));
    meta.appendChild(document.createTextNode(`HEAD ${shortSha(freshness.headSha)} · ${freshness.stale ? 'STALE' : 'fresh'} · ${runtime.databaseIntrospectionAvailable ? 'Supabase schema ✓' : 'Supabase schema indisponível'}`));
    meta.appendChild(document.createElement('br'));
    meta.appendChild(document.createTextNode('Static analysis · sem write authority · sem polling'));
    target.appendChild(meta);
  }

  function nodeBelongsToPath(node, path) {
    if (!node || !path) return false;
    if (node.type === 'file' && node.key === path) return true;
    if (node.meta?.path === path) return true;
    return (node.evidence || []).some(item => item?.path === path);
  }

  function render() {
    const target = detail(); if (!target || target.dataset.module !== MODULE_ID) return;
    ensureStyles(); clear(target);
    const head = el('div', 'detail-head'); head.append(el('b', '', 'Project Understanding'), el('span', 'state', 'BUILD 96 · READ ONLY')); target.appendChild(head);

    const top = el('div', 'ld96-top');
    top.appendChild(el('div', '', state.busy ? 'Mapeando projeto…' : 'Context Map determinístico'));
    const actions = el('div', 'ld96-actions'); const refresh = el('button', 'ld96-btn', state.map ? 'Atualizar mapa' : 'Gerar mapa'); refresh.type = 'button'; refresh.dataset.ld96Action = 'refresh'; refresh.disabled = state.busy; actions.appendChild(refresh); top.appendChild(actions); target.appendChild(top);
    if (state.error) target.appendChild(el('div', 'ld96-error', state.error));
    if (!state.map) { target.appendChild(el('div', 'ld96-empty', 'Gere o mapa para visualizar rotas, componentes, arquivos, dependências, APIs e relações com o Supabase. O mapa não executa writes nem usa inferência de modelo para inventar relações.')); return; }

    const counts = state.map.counts || {};
    const summary = el('div', 'ld96-summary');
    for (const [label, value] of [['Nós', state.map.nodes.length], ['Relações', state.map.edges.length], ['Arquivos', state.map.limits?.analyzedFiles || 0]]) { const card = el('div', 'ld96-stat'); card.append(el('b', '', value), el('span', '', label)); summary.appendChild(card); }
    target.appendChild(summary);
    renderMeta(target);

    const filters = el('div', 'ld96-filters');
    const options = [['all','Tudo'], ...TYPES.map(type => [type, LABELS[type] || type])];
    for (const [value, label] of options) { const chip = el('button', `ld96-chip${state.filter === value ? ' active' : ''}`, `${label}${value === 'all' ? '' : ` ${counts[value] || 0}`}`); chip.type = 'button'; chip.dataset.ld96Action = 'filter'; chip.dataset.value = value; filters.appendChild(chip); }
    target.appendChild(filters);
    const search = el('input', 'ld96-search'); search.type = 'search'; search.placeholder = 'Buscar rota, componente, arquivo, API ou tabela…'; search.value = state.query; search.dataset.ld96Search = 'true'; target.appendChild(search);

    const visible = state.map.nodes.filter(matches).slice(0, 160);
    if (!visible.length) target.appendChild(el('div', 'ld96-empty', 'Nenhum item corresponde ao filtro atual.'));
    for (const node of visible) {
      const card = el('div', 'ld96-node'); card.dataset.ld96Node = node.id;
      const row = el('div', 'ld96-node-head'); const left = el('div'); left.append(el('div', 'ld96-type', LABELS[node.type] || node.type), el('b', '', node.label)); row.append(left, el('span', `ld96-confidence${confidenceClass(node.confidence)}`, `${Math.round(Number(node.confidence || 0) * 100)}%`)); card.appendChild(row);
      const ev = node.evidence?.[0]; if (ev) card.appendChild(el('div', 'ld96-evidence', `${ev.path ? `${ev.path} · ` : ''}${ev.reason}${ev.detail ? ` · ${ev.detail}` : ''}`));
      if (state.expanded === node.id) {
        const relations = api()?.relationsFor?.(state.map, node.id) || [];
        for (const relation of relations.slice(0, 20)) {
          const otherId = relation.from === node.id ? relation.to : relation.from;
          const other = state.map.nodes.find(item => item.id === otherId);
          card.appendChild(el('div', 'ld96-rel', `${relation.type} → ${other?.label || otherId} · ${Math.round(Number(relation.confidence || 0) * 100)}%`));
        }
        const path = node.type === 'file' ? node.key : node.meta?.path || node.evidence?.find(item => item.path)?.path || '';
        if (path) { const btn = el('button', 'ld96-btn', 'Refresh somente este path'); btn.type = 'button'; btn.dataset.ld96Action = 'refresh-path'; btn.dataset.path = path; btn.disabled = state.busy; card.appendChild(btn); }
      }
      target.appendChild(card);
    }
    target.appendChild(el('div', 'ld96-empty', `Exibindo ${visible.length} de ${state.map.nodes.length} nós · confidence é baseada em evidência estática, não em “certeza” de IA.`));
  }

  async function loadMap() {
    if (state.busy) return; const center = api(); if (!center) return;
    state.busy = true; state.error = ''; render();
    try { state.map = await center.snapshot(); state.expanded = ''; }
    catch (error) { state.error = `${error?.code || 'ERRO'} · ${error?.message || error}`; }
    finally { state.busy = false; render(); }
  }

  async function refreshPath(path) {
    if (state.busy || !path) return; const center = api(); if (!center) return;
    state.busy = true; state.error = ''; render();
    try {
      const partial = await center.refreshPath(path);
      const removedNodeIds = new Set((state.map?.nodes || []).filter(item => nodeBelongsToPath(item, path)).map(item => item.id));
      const nodeMap = new Map((state.map?.nodes || []).filter(item => !removedNodeIds.has(item.id)).map(item => [item.id, item]));
      for (const item of partial.nodes || []) nodeMap.set(item.id, item);
      const edgeMap = new Map((state.map?.edges || []).filter(item => !removedNodeIds.has(item.from) && !removedNodeIds.has(item.to) && !((item.evidence || []).some(ev => ev.path === path))).map(item => [item.id, item]));
      for (const item of partial.edges || []) edgeMap.set(item.id, item);
      const nodes = [...nodeMap.values()]; const counts = {}; for (const item of nodes) counts[item.type] = (counts[item.type] || 0) + 1;
      state.map = Object.freeze({ ...state.map, freshness: partial.freshness, runtime: partial.runtime, nodes: Object.freeze(nodes), edges: Object.freeze([...edgeMap.values()]), counts: Object.freeze(counts) });
      state.expanded = '';
    } catch (error) { state.error = `${error?.code || 'ERRO'} · ${error?.message || error}`; }
    finally { state.busy = false; render(); }
  }

  function bind() {
    const shadow = root(); if (!shadow || shadow.__ld96UnderstandingBound) return false;
    shadow.__ld96UnderstandingBound = true; ensureStyles(); installRailButton();
    shadow.addEventListener('input', event => { const input = event.target.closest?.('[data-ld96-search]'); if (input) { state.query = String(input.value || ''); render(); } }, true);
    shadow.addEventListener('click', event => {
      const rail = event.target.closest?.('.rail-btn[data-id="project-understanding"]'); if (rail) { event.preventDefault(); event.stopImmediatePropagation(); show(rail); render(); return; }
      const action = event.target.closest?.('[data-ld96-action]'); if (action) {
        event.preventDefault(); event.stopImmediatePropagation();
        if (action.dataset.ld96Action === 'refresh') loadMap();
        else if (action.dataset.ld96Action === 'filter') { state.filter = action.dataset.value || 'all'; render(); }
        else if (action.dataset.ld96Action === 'refresh-path') refreshPath(action.dataset.path || '');
        return;
      }
      const node = event.target.closest?.('[data-ld96-node]'); if (node) { state.expanded = state.expanded === node.dataset.ld96Node ? '' : node.dataset.ld96Node; render(); }
    }, true);
    return true;
  }

  window.LovableDecrypterCanonicalProjectUnderstanding = Object.freeze({
    build: 96,
    handles: moduleId => moduleId === MODULE_ID,
    open() { const button = root()?.querySelector('.rail-btn[data-id="project-understanding"]'); if (button) { show(button); render(); } }
  });
  if (!bind()) document.addEventListener('DOMContentLoaded', bind, { once: true });
})();
