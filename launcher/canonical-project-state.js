(() => {
  'use strict';

  if (window.__LD85_CANONICAL_PROJECT_STATE__) return;
  window.__LD85_CANONICAL_PROJECT_STATE__ = true;

  const BUILD = 85;
  const VERSION = '2.6.85';
  const HOST_ID = 'lovable-decrypter-launcher';
  const MODULE_ID = 'project-state';

  const text = (value, fallback = '—') => {
    const out = String(value ?? '').trim();
    return out || fallback;
  };

  function root() {
    return document.getElementById(HOST_ID)?.shadowRoot || null;
  }

  function detail() {
    return root()?.getElementById('detail') || null;
  }

  function api() {
    return window.LovableDecrypterCanonicalProjectStateApi || null;
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
    const shadow = root();
    if (!shadow || shadow.querySelector('style[data-ld85-project-state]')) return;
    const style = document.createElement('style');
    style.dataset.ld85ProjectState = 'true';
    style.textContent = `
      #detail .ld85-grid{display:grid;gap:9px;margin-top:13px}
      #detail .ld85-node{position:relative;padding:11px 12px;border:1px solid rgba(255,255,255,.065);border-radius:13px;background:rgba(255,255,255,.018)}
      #detail .ld85-node:before{content:"";position:absolute;left:-1px;top:11px;bottom:11px;width:2px;border-radius:3px;background:rgba(99,222,255,.42)}
      #detail .ld85-node.github:before{background:rgba(201,210,226,.48)}
      #detail .ld85-node.supabase:before{background:rgba(62,207,142,.62)}
      #detail .ld85-node small{display:block;color:#8090aa;font-size:9px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;margin-bottom:5px}
      #detail .ld85-node b{display:block;color:#eef5ff;font-size:11px;line-height:1.35;overflow-wrap:anywhere}
      #detail .ld85-meta{display:flex;flex-wrap:wrap;gap:6px;margin-top:7px}
      #detail .ld85-pill{padding:4px 7px;border-radius:999px;background:rgba(59,210,255,.07);color:#91dfff;font-size:8.5px;font-weight:800}
      #detail .ld85-pill.ok{background:rgba(62,207,142,.1);color:#7ae9ae}
      #detail .ld85-pill.warn{background:rgba(255,190,82,.1);color:#ffd080}
      #detail .ld85-pill.bad{background:rgba(255,103,122,.1);color:#ff9dac}
      #detail .ld85-link{height:11px;width:1px;background:linear-gradient(rgba(99,222,255,.35),rgba(99,222,255,.06));margin:0 0 -9px 22px}
      #detail .ld85-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px}
      #detail .ld85-summary div{padding:9px 10px;border:1px solid rgba(255,255,255,.055);border-radius:11px;background:rgba(255,255,255,.016)}
      #detail .ld85-summary small{display:block;color:#7e8ca3;font-size:8px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;margin-bottom:4px}
      #detail .ld85-summary b{display:block;color:#eaf2ff;font-size:10px;overflow-wrap:anywhere}
      #detail .ld85-actions{display:flex;gap:7px;margin-top:12px}
      #detail .ld85-btn{min-height:34px;border:1px solid rgba(99,222,255,.22);border-radius:10px;background:rgba(99,222,255,.08);color:#e8f8ff;padding:7px 11px;font:700 10px Arial,sans-serif;cursor:pointer}
      #detail .ld85-btn:disabled{opacity:.48;cursor:not-allowed}
      #detail .ld85-note{margin-top:10px;color:#8392aa;font-size:9.5px;line-height:1.45;overflow-wrap:anywhere}
    `;
    shadow.appendChild(style);
  }

  function pill(label, tone = '') {
    return el('span', `ld85-pill${tone ? ` ${tone}` : ''}`, label);
  }

  function node(kind, label, value, pills = []) {
    const card = el('section', `ld85-node ${kind}`);
    card.append(el('small', '', label), el('b', '', text(value)));
    const meta = el('div', 'ld85-meta');
    for (const item of pills) meta.appendChild(pill(item.label, item.tone));
    card.appendChild(meta);
    return card;
  }

  function statusTone(value) {
    return value ? 'ok' : 'warn';
  }

  function shortSha(value) {
    const sha = String(value || '');
    return sha ? sha.slice(0, 12) : '—';
  }

  function databaseSummary(state) {
    if (!state || typeof state !== 'object') return 'Estado remoto não disponível';
    const schema = state.schema || state.database?.schema || state.project?.database || '';
    const version = state.version || state.database?.version || '';
    const pieces = [schema, version].filter(Boolean).map(String);
    if (pieces.length) return pieces.join(' · ');
    const keys = Object.keys(state).filter(key => !/^error|token|secret/i.test(key));
    return keys.length ? `${keys.slice(0, 5).join(', ')}` : 'Estado remoto inspecionado';
  }

  function buildHead(target, state) {
    const previousIcon = target.querySelector('.detail-head svg')?.cloneNode(true) || null;
    clear(target);
    const head = el('div', 'detail-head');
    if (previousIcon) head.appendChild(previousIcon);
    head.appendChild(el('b', '', 'Project State'));
    const badge = el('span', 'state', state.ready ? 'READY' : 'ATENÇÃO');
    badge.dataset.runtime = state.ready ? 'online' : 'offline';
    head.appendChild(badge);
    target.appendChild(head);
  }

  async function render() {
    const target = detail();
    if (!target || target.dataset.module !== MODULE_ID) return false;
    ensureStyles();
    const projectApi = api();
    if (!projectApi?.snapshot) throw new Error('Canonical Project State client não carregado.');

    const previousState = target.querySelector('.state');
    if (previousState) {
      previousState.textContent = 'VERIFICANDO';
      previousState.dataset.runtime = 'checking';
    }

    const state = await projectApi.snapshot();
    if (!target.isConnected || target.dataset.module !== MODULE_ID) return false;
    buildHead(target, state);

    const graph = el('div', 'ld85-grid');
    graph.appendChild(node('lovable', 'Lovable Project', state.project?.id || 'Não identificado', [
      { label: state.project?.detected ? 'DETECTADO' : 'SEM ID', tone: statusTone(state.project?.detected) },
      { label: `Build ${BUILD}`, tone: 'ok' }
    ]));
    graph.appendChild(el('div', 'ld85-link'));
    graph.appendChild(node('github', 'GitHub', state.github?.fullName || 'Não mapeado', [
      { label: text(state.github?.branch, 'SEM BRANCH'), tone: statusTone(state.github?.branch) },
      { label: state.github?.reachable ? 'REACHABLE' : 'OFFLINE', tone: statusTone(state.github?.reachable) },
      { label: state.github?.authMode === 'github_app' ? 'GITHUB APP' : 'LEGACY AUTH', tone: state.github?.authMode === 'github_app' ? 'ok' : 'warn' }
    ]));
    graph.appendChild(el('div', 'ld85-link'));
    graph.appendChild(node('supabase', 'Supabase', state.supabase?.projectName || state.supabase?.projectRef || 'Não mapeado', [
      { label: state.supabase?.authMode === 'oauth' ? 'OAUTH' : 'AUTH', tone: state.supabase?.authMode === 'oauth' ? 'ok' : 'warn' },
      { label: state.supabase?.reachable ? 'REACHABLE' : 'OFFLINE', tone: statusTone(state.supabase?.reachable) },
      { label: state.supabase?.inspected ? 'INSPECIONADO' : 'SEM INSPEÇÃO', tone: statusTone(state.supabase?.inspected) }
    ]));
    target.appendChild(graph);

    const summary = el('div', 'ld85-summary');
    const summaryItems = [
      ['Branch', state.github?.branch || '—'],
      ['HEAD', shortSha(state.github?.headSha)],
      ['Supabase Ref', state.supabase?.projectRef || '—'],
      ['Database State', databaseSummary(state.supabase?.state)]
    ];
    for (const [label, value] of summaryItems) {
      const card = el('div');
      card.append(el('small', '', label), el('b', '', text(value)));
      summary.appendChild(card);
    }
    target.appendChild(summary);

    const actions = el('div', 'ld85-actions');
    const refresh = el('button', 'ld85-btn', 'Atualizar estado');
    refresh.type = 'button';
    refresh.dataset.ld85Action = 'refresh';
    actions.appendChild(refresh);
    target.appendChild(actions);

    const problems = [];
    if (!state.project?.detected) problems.push('projeto Lovable não identificado');
    if (!state.readiness?.githubMapped) problems.push('GitHub não mapeado');
    else if (!state.readiness?.githubReachable) problems.push(state.github?.error || 'GitHub não alcançável');
    if (!state.readiness?.supabaseMapped) problems.push('Supabase não mapeado');
    else if (!state.readiness?.supabaseReachable) problems.push(state.supabase?.error || 'Supabase não alcançável');
    target.appendChild(el('div', 'ld85-note', problems.length
      ? `Estado parcial: ${problems.join(' · ')}`
      : `Projeto reconciliado sob demanda em ${text(state.collectedAt)}. Nenhum polling permanente foi ativado.`));

    target.dataset.ld85Canonical = 'true';
    return true;
  }

  function bind() {
    const shadow = root();
    if (!shadow || shadow.__ld85ProjectStateBound) return false;
    shadow.__ld85ProjectStateBound = true;
    ensureStyles();

    shadow.addEventListener('pointerover', event => {
      const item = event.target.closest?.('.fly-item');
      if (item?.dataset?.item === MODULE_ID) queueMicrotask(() => render().catch(() => {}));
    });

    shadow.addEventListener('click', event => {
      const action = event.target.closest?.('[data-ld85-action]');
      if (action) {
        event.preventDefault();
        event.stopPropagation();
        action.disabled = true;
        render().catch(error => {
          const target = detail();
          if (target?.dataset?.module === MODULE_ID) target.appendChild(el('div', 'ld85-note', error?.message || String(error)));
        }).finally(() => { if (action.isConnected) action.disabled = false; });
        return;
      }
      const item = event.target.closest?.('.fly-item');
      if (item?.dataset?.item === MODULE_ID) queueMicrotask(() => render().catch(() => {}));
    });

    for (const eventName of ['ld84:github-mapped', 'ld84:supabase-mapped']) {
      window.addEventListener(eventName, () => {
        if (detail()?.dataset?.module === MODULE_ID) queueMicrotask(() => render().catch(() => {}));
      });
    }

    window.LovableDecrypterCanonicalProjectState = Object.freeze({
      build: BUILD,
      version: VERSION,
      handles: id => String(id || '') === MODULE_ID,
      render
    });

    document.getElementById(HOST_ID)?.setAttribute('data-ld-project-state', 'canonical-v85');
    return true;
  }

  if (!bind()) document.addEventListener('DOMContentLoaded', bind, { once: true });
})();
