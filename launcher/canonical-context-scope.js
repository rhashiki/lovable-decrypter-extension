(() => {
  'use strict';

  if (window.__LD87_CANONICAL_CONTEXT_SCOPE__) return;
  window.__LD87_CANONICAL_CONTEXT_SCOPE__ = true;

  const BUILD = 87;
  const VERSION = '2.6.87';
  const HOST_ID = 'lovable-decrypter-launcher';
  const MODULES = new Set(['context-pack', 'scope-intelligence']);
  let lastAnalysis = null;

  const text = (value, fallback = '—') => {
    const out = String(value ?? '').trim();
    return out || fallback;
  };

  function root() { return document.getElementById(HOST_ID)?.shadowRoot || null; }
  function detail() { return root()?.getElementById('detail') || null; }
  function api() { return window.LovableDecrypterCanonicalContextScopeApi || null; }
  function el(tag, className = '', value = '') {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== '') node.textContent = String(value);
    return node;
  }
  function clear(node) { while (node?.firstChild) node.firstChild.remove(); }

  function ensureStyles() {
    const shadow = root();
    if (!shadow || shadow.querySelector('style[data-ld87-context-scope]')) return;
    const style = document.createElement('style');
    style.dataset.ld87ContextScope = 'true';
    style.textContent = `
      #detail .ld87-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px}
      #detail .ld87-summary div{padding:9px 10px;border:1px solid rgba(255,255,255,.055);border-radius:11px;background:rgba(255,255,255,.016)}
      #detail .ld87-summary small{display:block;color:#7e8ca3;font-size:8px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;margin-bottom:4px}
      #detail .ld87-summary b{display:block;color:#eaf2ff;font-size:10px;overflow-wrap:anywhere}
      #detail .ld87-field{display:grid;gap:6px;margin-top:12px}
      #detail .ld87-field span{color:#8d9ab3;font-size:9px;font-weight:800;letter-spacing:.05em;text-transform:uppercase}
      #detail .ld87-field textarea{width:100%;min-height:72px;resize:vertical;border:1px solid rgba(255,255,255,.08);border-radius:11px;background:#0b1626;color:#eef5ff;padding:9px 10px;outline:none;font:10.5px/1.45 Arial,sans-serif;box-sizing:border-box}
      #detail .ld87-actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:9px}
      #detail .ld87-btn{min-height:34px;border:1px solid rgba(99,222,255,.22);border-radius:10px;background:rgba(99,222,255,.08);color:#e8f8ff;padding:7px 11px;font:700 10px Arial,sans-serif;cursor:pointer}
      #detail .ld87-btn.secondary{background:rgba(255,255,255,.025);border-color:rgba(255,255,255,.08);color:#dce7f8}
      #detail .ld87-btn:disabled{opacity:.45;cursor:not-allowed}
      #detail .ld87-section{margin-top:13px}
      #detail .ld87-title{display:flex;justify-content:space-between;align-items:center;margin-bottom:7px;color:#8a99b2;font-size:9px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}
      #detail .ld87-list{display:grid;gap:7px}
      #detail .ld87-row{display:grid;grid-template-columns:1fr auto;gap:9px;align-items:start;padding:9px 10px;border:1px solid rgba(255,255,255,.055);border-radius:11px;background:rgba(255,255,255,.016)}
      #detail .ld87-row b{display:block;color:#edf4ff;font-size:10px;line-height:1.35;overflow-wrap:anywhere}
      #detail .ld87-row small{display:block;color:#8190a8;font-size:8.8px;line-height:1.4;margin-top:3px;overflow-wrap:anywhere}
      #detail .ld87-badge{padding:4px 7px;border-radius:999px;background:rgba(66,210,255,.08);color:#91e3ff;font-size:8px;font-weight:800;white-space:nowrap}
      #detail .ld87-badge.strong{background:rgba(255,103,122,.11);color:#ff9fac}
      #detail .ld87-badge.soft{background:rgba(255,187,83,.1);color:#ffd183}
      #detail .ld87-badge.ok{background:rgba(62,207,142,.1);color:#7ceab0}
      #detail .ld87-note{margin-top:10px;color:#8392aa;font-size:9.5px;line-height:1.45;overflow-wrap:anywhere}
      #detail .ld87-progress{margin-top:9px;padding:8px 9px;border-radius:10px;background:rgba(99,222,255,.035);border:1px solid rgba(99,222,255,.09);color:#9fb1c8;font-size:9px;line-height:1.4}
    `;
    shadow.appendChild(style);
  }

  function buildHead(target) {
    const icon = target.querySelector('.detail-head svg')?.cloneNode(true) || null;
    clear(target);
    const head = el('div', 'detail-head');
    if (icon) head.appendChild(icon);
    head.appendChild(el('b', '', 'Context + Scope'));
    const state = el('span', 'state', 'ONLINE');
    state.dataset.runtime = 'online';
    head.appendChild(state);
    target.appendChild(head);
  }

  function summaryCard(label, value) {
    const card = el('div');
    card.append(el('small', '', label), el('b', '', text(value)));
    return card;
  }

  function section(title, count) {
    const wrap = el('section', 'ld87-section');
    const head = el('div', 'ld87-title');
    head.append(el('span', '', title), el('span', '', String(count)));
    const list = el('div', 'ld87-list');
    wrap.append(head, list);
    return { wrap, list };
  }

  function row(title, description, badgeLabel = '', badgeTone = '') {
    const item = el('div', 'ld87-row');
    const copy = el('div');
    copy.append(el('b', '', text(title)), el('small', '', text(description, '')));
    item.appendChild(copy);
    if (badgeLabel) item.appendChild(el('span', `ld87-badge${badgeTone ? ` ${badgeTone}` : ''}`, badgeLabel));
    return item;
  }

  function progress(target, value) {
    let node = target.querySelector('.ld87-progress');
    if (!node) {
      node = el('div', 'ld87-progress');
      target.appendChild(node);
    }
    node.textContent = String(value || '');
    return node;
  }

  function renderAnalysis(target, analysis) {
    if (!analysis) return;
    const paths = Array.isArray(analysis.selectedPaths) ? analysis.selectedPaths : [];
    const files = section('Context Pack · arquivos selecionados', paths.length);
    for (const path of paths.slice(0, 24)) files.list.appendChild(row(path, 'Selecionado pelo Context Engine', 'CONTEXT', 'ok'));
    if (!paths.length) files.list.appendChild(row('Nenhum arquivo selecionado', 'O pack retornou sem paths de código.'));
    target.appendChild(files.wrap);

    const overlaps = analysis.preflight?.lockOverlaps || [];
    const preflight = section('Scope preflight · Human Intent', overlaps.length);
    if (!overlaps.length) preflight.list.appendChild(row('Sem sobreposição detectada', 'Nenhum User Intent Lock coincide com os arquivos selecionados.', 'OK', 'ok'));
    for (const lock of overlaps) {
      preflight.list.appendChild(row(lock.path, lock.policy || 'Edição humana recente protegida', lock.level?.toUpperCase() || 'LOCK', lock.level === 'strong' ? 'strong' : 'soft'));
    }
    target.appendChild(preflight.wrap);
    target.appendChild(el('div', 'ld87-note', analysis.preflight?.note || 'A validação formal request→plan→diff continua obrigatória antes de qualquer write.'));
  }

  async function render() {
    const target = detail();
    if (!target || !MODULES.has(target.dataset.module)) return false;
    ensureStyles();
    const contextScope = api();
    if (!contextScope?.status) throw new Error('Canonical Context + Scope client não carregado.');

    const prior = target.querySelector('.state');
    if (prior) { prior.textContent = 'VERIFICANDO'; prior.dataset.runtime = 'checking'; }
    const status = await contextScope.status();
    if (!target.isConnected || !MODULES.has(target.dataset.module)) return false;
    buildHead(target);

    const summary = el('div', 'ld87-summary');
    summary.append(
      summaryCard('Context Engine', status.context?.engine || 'context-engine-v2'),
      summaryCard('Scope Intelligence', status.scope?.engine || 'scope-intelligence-v2'),
      summaryCard('User Intent', status.scope?.humanIntentPolicy || 'USER_EDIT > AI_EDIT'),
      summaryCard('Locks ativos', String(status.locks?.length || 0))
    );
    target.appendChild(summary);

    const sources = section('Fontes do contexto', status.context?.sources?.length || 0);
    for (const source of status.context?.sources || []) sources.list.appendChild(row(source, 'Fonte disponível para ranking do Context Pack', 'SOURCE'));
    target.appendChild(sources.wrap);

    const locks = section('User Intent Locks', status.locks?.length || 0);
    for (const lock of status.locks || []) locks.list.appendChild(row(lock.path, `${lock.policy || ''}${lock.lastObservedAt ? ` · ${lock.lastObservedAt}` : ''}`, lock.level.toUpperCase(), lock.level));
    if (!status.locks?.length) locks.list.appendChild(row('Nenhum lock ativo', 'Não há edição humana recente protegida neste projeto.', 'OK', 'ok'));
    target.appendChild(locks.wrap);

    const field = el('label', 'ld87-field');
    field.appendChild(el('span', '', 'Tarefa para montar Context Pack'));
    const input = document.createElement('textarea');
    input.dataset.ld87Task = 'true';
    input.placeholder = 'Ex.: corrigir o fluxo de login sem alterar o restante do projeto';
    if (lastAnalysis?.task) input.value = lastAnalysis.task;
    field.appendChild(input);
    target.appendChild(field);

    const actions = el('div', 'ld87-actions');
    const build = el('button', 'ld87-btn', 'Montar Context Pack');
    build.type = 'button'; build.dataset.ld87Action = 'build';
    const refresh = el('button', 'ld87-btn secondary', 'Atualizar');
    refresh.type = 'button'; refresh.dataset.ld87Action = 'refresh';
    actions.append(build, refresh);
    target.appendChild(actions);

    renderAnalysis(target, lastAnalysis);
    target.appendChild(el('div', 'ld87-note', `Enforcement: ${text(status.scope?.enforcement)}. Skip/approve não bypassa Scope Intelligence; a validação formal continua no background sobre pedido → plano → diff.`));
    target.dataset.ld87Canonical = 'true';
    return true;
  }

  async function act(action) {
    const target = detail();
    if (!target || !MODULES.has(target.dataset.module)) return;
    if (action === 'refresh') { await render(); return; }
    if (action === 'build') {
      const task = target.querySelector('[data-ld87-task]')?.value?.trim() || '';
      if (!task) throw new Error('Informe uma tarefa para montar o Context Pack.');
      progress(target, 'Preparando Context Pack…');
      lastAnalysis = await api().build(task, {
        onProgress: event => {
          const current = detail();
          if (current && MODULES.has(current.dataset.module)) progress(current, `${text(event.stage, 'Context')} · ${text(event.detail, '')}`);
        }
      });
      await render();
      const current = detail();
      if (current && MODULES.has(current.dataset.module)) progress(current, `Context Pack concluído · ${lastAnalysis.selectedPaths?.length || 0} arquivo(s) · ${lastAnalysis.preflight?.lockOverlapCount || 0} lock(s) em sobreposição.`);
      return;
    }
    throw new Error(`Ação desconhecida: ${action}`);
  }

  function moduleFromEvent(event) {
    const item = event.target.closest?.('.fly-item');
    return item?.dataset?.item || detail()?.dataset?.module || '';
  }

  function bind() {
    const shadow = root();
    if (!shadow || shadow.__ld87ContextScopeBound) return false;
    shadow.__ld87ContextScopeBound = true;
    ensureStyles();

    shadow.addEventListener('pointerover', event => {
      const moduleId = moduleFromEvent(event);
      if (MODULES.has(moduleId)) queueMicrotask(() => render().catch(() => {}));
    });

    shadow.addEventListener('click', event => {
      const actionNode = event.target.closest?.('[data-ld87-action]');
      if (actionNode) {
        event.preventDefault();
        event.stopPropagation();
        actionNode.disabled = true;
        act(actionNode.dataset.ld87Action || '').catch(error => {
          const target = detail();
          if (target && MODULES.has(target.dataset.module)) progress(target, error?.message || String(error));
        }).finally(() => { if (actionNode.isConnected) actionNode.disabled = false; });
        return;
      }
      const moduleId = moduleFromEvent(event);
      if (MODULES.has(moduleId)) queueMicrotask(() => render().catch(() => {}));
    });

    window.LovableDecrypterCanonicalContextScope = Object.freeze({
      build: BUILD,
      version: VERSION,
      handles: id => MODULES.has(String(id || '')),
      render
    });
    document.getElementById(HOST_ID)?.setAttribute('data-ld-context-scope', 'canonical-v87');
    return true;
  }

  if (!bind()) document.addEventListener('DOMContentLoaded', bind, { once: true });
})();
