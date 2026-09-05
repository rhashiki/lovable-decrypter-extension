(() => {
  'use strict';

  if (window.__LD97_CANONICAL_CHANGE_TRANSACTIONS__) return;
  window.__LD97_CANONICAL_CHANGE_TRANSACTIONS__ = true;

  const BUILD = 97;
  const VERSION = '2.6.97';
  const MODULE_ID = 'change-transactions';
  const HOST_ID = 'lovable-decrypter-launcher';
  const NS = 'http://www.w3.org/2000/svg';

  const state = {
    busy: false,
    error: '',
    items: [],
    selectedId: '',
    review: null,
    showExplanation: false,
    revert: null,
    revertConfirmed: false
  };

  const root = () => document.getElementById(HOST_ID)?.shadowRoot || null;
  const detail = () => root()?.getElementById('detail') || null;
  const api = () => window.LovableDecrypterCanonicalChangeTransactionsApi || null;
  const text = (value, fallback = '—') => { const out = String(value ?? '').trim(); return out || fallback; };

  function el(tag, className = '', value = '') {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== '') node.textContent = String(value);
    return node;
  }
  function clear(node) { while (node?.firstChild) node.firstChild.remove(); }
  function icon(size = 21) {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('fill', 'none');
    svg.setAttribute('aria-hidden', 'true');
    for (const d of ['M7 7h10v10H7z','M4 10V4h6','M20 14v6h-6']) {
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', d);
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', '1.65');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(path);
    }
    return svg;
  }

  function ensureStyles() {
    const shadow = root();
    if (!shadow || shadow.querySelector('style[data-ld97-change-transactions]')) return;
    const style = document.createElement('style');
    style.dataset.ld97ChangeTransactions = 'true';
    style.textContent = `
      #detail .ld97-toolbar{display:flex;gap:6px;margin-top:10px;flex-wrap:wrap}
      #detail .ld97-btn{min-height:32px;border:1px solid rgba(59,210,255,.2);border-radius:9px;background:rgba(59,210,255,.08);color:#e8f8ff;padding:6px 10px;font:800 9px Arial,sans-serif;cursor:pointer}
      #detail .ld97-btn.secondary{background:rgba(255,255,255,.018);border-color:rgba(255,255,255,.07);color:#cbd7e7}
      #detail .ld97-btn.warn{background:rgba(255,187,83,.06);border-color:rgba(255,187,83,.2);color:#ffd183}
      #detail .ld97-btn.danger{background:rgba(255,103,122,.05);border-color:rgba(255,103,122,.18);color:#ffabb6}
      #detail .ld97-btn:disabled{opacity:.45;cursor:not-allowed}
      #detail .ld97-list{display:grid;gap:6px;margin-top:11px}
      #detail .ld97-item{width:100%;text-align:left;padding:9px 10px;border:1px solid rgba(255,255,255,.055);border-radius:11px;background:rgba(255,255,255,.014);cursor:pointer;color:#dbe7f5}
      #detail .ld97-item.active{border-color:rgba(59,210,255,.28);background:rgba(59,210,255,.065)}
      #detail .ld97-item b{display:block;font-size:9.5px;line-height:1.4;overflow-wrap:anywhere}
      #detail .ld97-item small{display:block;margin-top:3px;color:#8493aa;font-size:8.3px;line-height:1.35;overflow-wrap:anywhere}
      #detail .ld97-section{margin-top:13px}
      #detail .ld97-title{color:#8391a8;font-size:8px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;margin-bottom:6px}
      #detail .ld97-card{padding:9px 10px;border:1px solid rgba(255,255,255,.055);border-radius:11px;background:rgba(255,255,255,.015);margin-top:6px}
      #detail .ld97-card b{display:block;color:#edf4ff;font-size:10px;line-height:1.4;overflow-wrap:anywhere}
      #detail .ld97-card small{display:block;color:#8493aa;font-size:8.7px;line-height:1.45;margin-top:3px;overflow-wrap:anywhere}
      #detail .ld97-row{margin-top:5px;padding:6px 8px;border-left:2px solid rgba(59,210,255,.16);border-radius:0 8px 8px 0;background:rgba(255,255,255,.012);color:#9dacbf;font-size:8.7px;line-height:1.4;overflow-wrap:anywhere}
      #detail .ld97-badges{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}
      #detail .ld97-badge{padding:4px 7px;border-radius:999px;background:rgba(59,210,255,.08);color:#9ae6ff;font-size:8px;font-weight:800}
      #detail .ld97-badge.ok{background:rgba(62,207,142,.1);color:#7ceab0}
      #detail .ld97-badge.warn{background:rgba(255,187,83,.1);color:#ffd183}
      #detail .ld97-badge.bad{background:rgba(255,103,122,.1);color:#ff9fac}
      #detail .ld97-explain{margin-top:7px;padding:9px;border:1px solid rgba(59,210,255,.1);border-radius:9px;background:rgba(59,210,255,.025);color:#b8c9dc;font-size:8.8px;line-height:1.5;overflow-wrap:anywhere}
      #detail .ld97-check{display:flex;gap:7px;align-items:flex-start;margin-top:9px;color:#c8d5e6;font-size:9px;line-height:1.4}
      #detail .ld97-error{margin-top:9px;padding:8px 9px;border:1px solid rgba(255,103,122,.14);border-radius:9px;background:rgba(255,103,122,.035);color:#ffb2bd;font-size:9px;line-height:1.4}
      #detail .ld97-empty{margin-top:12px;color:#7f8da4;font-size:9px;line-height:1.5}
    `;
    shadow.appendChild(style);
  }

  function installRailButton() {
    const shadow = root();
    const railButtons = shadow?.getElementById('railButtons');
    if (!railButtons || railButtons.querySelector('[data-id="change-transactions"]')) return Boolean(railButtons);
    const button = el('button', 'rail-btn');
    button.type = 'button';
    button.dataset.kind = 'direct';
    button.dataset.id = MODULE_ID;
    button.setAttribute('aria-label', 'Change Transactions');
    button.append(icon(21), el('span', 'tip', 'Change Transactions'));
    railButtons.appendChild(button);
    return true;
  }

  function showDetail(anchor) {
    const shadow = root();
    const target = detail();
    const rail = shadow?.getElementById('rail');
    const flyout = shadow?.getElementById('flyout');
    if (!target || !anchor) return false;
    for (const node of shadow.querySelectorAll('.rail-btn.active')) node.classList.remove('active');
    anchor.classList.add('active');
    if (flyout) flyout.classList.remove('show');
    target.dataset.module = MODULE_ID;
    target.style.display = '';
    target.style.visibility = '';
    target.classList.add('show');
    const anchorRect = anchor.getBoundingClientRect();
    const railRect = rail?.getBoundingClientRect?.() || anchorRect;
    target.style.left = `${Math.max(8, Math.round(anchorRect.left - 388))}px`;
    target.style.top = `${Math.max(8, Math.min(Math.round(anchorRect.top), innerHeight - 280))}px`;
    target.style.width = '380px';
    target.style.height = `${Math.min(Math.max(460, railRect.height || 620), innerHeight - 16)}px`;
    target.style.maxHeight = `${Math.max(280, innerHeight - 16)}px`;
    target.style.overflowY = 'auto';
    return true;
  }

  function statusClass(status) {
    const value = String(status || '').toLowerCase();
    if (['completed','verified','reverted','applied','approved'].includes(value)) return 'ok';
    if (['failed','error'].includes(value)) return 'bad';
    if (value.includes('verification') || value.includes('waiting') || value.includes('approval')) return 'warn';
    return '';
  }

  function formatAt(value) {
    const date = new Date(String(value || ''));
    return Number.isFinite(date.getTime()) ? date.toLocaleString('pt-BR') : '—';
  }

  function renderHead(target) {
    const row = el('div', 'detail-head');
    row.append(icon(23), el('b', '', 'Change Transactions'));
    const badge = el('span', 'state', `BUILD ${BUILD} · PROJECTION`);
    badge.dataset.runtime = state.error ? 'offline' : 'online';
    row.appendChild(badge);
    target.appendChild(row);
  }

  function renderList(target) {
    const toolbar = el('div', 'ld97-toolbar');
    const refresh = el('button', 'ld97-btn secondary', 'Atualizar');
    refresh.type = 'button'; refresh.dataset.ld97Action = 'refresh'; refresh.disabled = state.busy;
    toolbar.appendChild(refresh); target.appendChild(toolbar);

    if (!state.items.length) {
      target.appendChild(el('div', 'ld97-empty', 'Nenhuma Change Transaction encontrada para este projeto. As próximas execuções do Command Composer aparecerão aqui.'));
      return;
    }
    const list = el('div', 'ld97-list');
    for (const tx of state.items.slice(0, 60)) {
      const button = el('button', `ld97-item${state.selectedId === tx.id ? ' active' : ''}`);
      button.type = 'button'; button.dataset.ld97Action = 'select'; button.dataset.txId = tx.id;
      button.append(
        el('b', '', `${text(tx.intent?.label, 'TRANSACTION')} · ${text(tx.status, 'created').toUpperCase()}`),
        el('small', '', `${formatAt(tx.updatedAt)} · ${tx.id.slice(0, 12)}…`)
      );
      list.appendChild(button);
    }
    target.appendChild(list);
  }

  function renderReview(target) {
    const review = state.review;
    if (!review) return;
    const tx = review.transaction || {};
    const section = el('section', 'ld97-section');
    section.appendChild(el('div', 'ld97-title', 'Review'));
    const card = el('div', 'ld97-card');
    card.append(
      el('b', '', text(tx.intent?.label, 'Change Transaction')),
      el('small', '', `${text(review.status, tx.status).toUpperCase()} · ${formatAt(tx.updatedAt)} · ID ${text(tx.id).slice(0, 16)}…`)
    );
    const badges = el('div', 'ld97-badges');
    badges.append(
      el('span', `ld97-badge ${statusClass(review.status)}`, text(review.status).toUpperCase()),
      el('span', 'ld97-badge', `${Number(tx.review?.files?.length || 0)} FILE(S)`),
      el('span', 'ld97-badge', `${Number(review.operations?.length || 0)} OP(S)`)
    );
    if (review.commit?.sha) badges.appendChild(el('span', 'ld97-badge ok', `COMMIT ${review.commit.sha.slice(0, 10)}`));
    if (review.continuity?.verificationRequired) badges.appendChild(el('span', 'ld97-badge warn', 'VERIFY REQUIRED'));
    card.appendChild(badges); section.appendChild(card);

    if (tx.plan?.summary) section.appendChild(el('div', 'ld97-row', `Plano · ${tx.plan.summary}`));
    for (const file of tx.review?.files || []) {
      section.appendChild(el('div', 'ld97-row', `${text(file.path)} · ${text(file.action).toUpperCase()} · +${Number(file.addedLines || 0)} / -${Number(file.removedLines || 0)}`));
    }
    if (tx.database?.ticketId) {
      section.appendChild(el('div', 'ld97-row', `Database · ${text(tx.database.risk, 'UNKNOWN')} · ${text(tx.database.status, 'prepared')} · ticket ${tx.database.ticketId.slice(0, 12)}…`));
    }
    for (const test of review.tests || []) {
      section.appendChild(el('div', 'ld97-row', `Validation · ${text(test.tool)} · ${text(test.status).toUpperCase()}${test.errorCode ? ` · ${test.errorCode}` : ''}`));
    }
    if (review.commit?.sha) section.appendChild(el('div', 'ld97-row', `Git · ${review.commit.sha} · ${text(review.commit.branch)}`));
    if (tx.recovery?.status) section.appendChild(el('div', 'ld97-row', `Recovery · ${text(tx.recovery.status)} · ${text(tx.recovery.direction)} · ${text(tx.recovery.strategy)}`));

    const actions = el('div', 'ld97-toolbar');
    const explain = el('button', 'ld97-btn secondary', state.showExplanation ? 'Ocultar explicação' : 'Explain');
    explain.type = 'button'; explain.dataset.ld97Action = 'explain'; explain.disabled = state.busy; actions.appendChild(explain);
    const reviewBtn = el('button', 'ld97-btn secondary', 'Review novamente');
    reviewBtn.type = 'button'; reviewBtn.dataset.ld97Action = 'review'; reviewBtn.disabled = state.busy; actions.appendChild(reviewBtn);
    if (review.reversibleOperationId && review.status !== 'reverted') {
      const revert = el('button', 'ld97-btn warn', 'Preparar Revert');
      revert.type = 'button'; revert.dataset.ld97Action = 'revert-preview'; revert.disabled = state.busy; actions.appendChild(revert);
    }
    section.appendChild(actions);

    if (state.showExplanation) section.appendChild(el('div', 'ld97-explain', text(review.explain, 'Sem explicação disponível.')));
    target.appendChild(section);
  }

  function renderRevert(target) {
    const prepared = state.revert;
    if (!prepared) return;
    const plan = prepared.preview?.plan || prepared.preview?.preview?.plan || {};
    const destructive = plan.destructive === true;
    const changes = Array.isArray(plan.changes) ? plan.changes : [];
    const conflicts = Array.isArray(plan.conflicts) ? plan.conflicts : [];
    const section = el('section', 'ld97-section');
    section.appendChild(el('div', 'ld97-title', 'Revert · Preview'));
    const card = el('div', 'ld97-card');
    card.append(
      el('b', '', `${text(plan.direction, 'undo').toUpperCase()} · ${text(plan.strategy, 'preserve').toUpperCase()}`),
      el('small', '', `${changes.length} alteração(ões) · ${conflicts.length} conflito(s) · source ${text(prepared.sourceOperationId).slice(0, 14)}…`)
    );
    const badges = el('div', 'ld97-badges');
    badges.append(el('span', `ld97-badge ${destructive ? 'bad' : 'warn'}`, destructive ? 'DESTRUCTIVE' : 'REVERSAL'), el('span', 'ld97-badge', 'PREVIEW ONLY'));
    card.appendChild(badges); section.appendChild(card);
    for (const conflict of conflicts.slice(0, 20)) section.appendChild(el('div', 'ld97-row', `Conflito · ${text(conflict.path)} · ${text(conflict.code)}`));
    for (const change of changes.slice(0, 40)) section.appendChild(el('div', 'ld97-row', `${text(change.path)} · ${text(change.action).toUpperCase()}`));

    const label = el('label', 'ld97-check');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox'; checkbox.checked = state.revertConfirmed; checkbox.dataset.ld97RevertConfirm = 'true'; checkbox.disabled = state.busy || plan.allowed === false;
    label.append(checkbox, el('span', '', destructive ? 'Confirmo explicitamente esta reversão DESTRUCTIVE após revisar o preview.' : 'Confirmo explicitamente que revisei este preview e quero aplicar a reversão.'));
    section.appendChild(label);

    const actions = el('div', 'ld97-toolbar');
    const apply = el('button', destructive ? 'ld97-btn danger' : 'ld97-btn warn', destructive ? 'Aplicar Revert DESTRUCTIVE' : 'Aplicar Revert');
    apply.type = 'button'; apply.dataset.ld97Action = 'revert-apply'; apply.disabled = state.busy || !state.revertConfirmed || plan.allowed === false; actions.appendChild(apply);
    const cancel = el('button', 'ld97-btn secondary', 'Cancelar preview'); cancel.type = 'button'; cancel.dataset.ld97Action = 'revert-cancel'; cancel.disabled = state.busy; actions.appendChild(cancel);
    section.appendChild(actions);
    target.appendChild(section);
  }

  function render() {
    const target = detail();
    if (!target || target.dataset.module !== MODULE_ID) return false;
    ensureStyles(); clear(target); renderHead(target);
    if (state.error) target.appendChild(el('div', 'ld97-error', state.error));
    renderList(target); renderReview(target); renderRevert(target);
    target.appendChild(el('div', 'ld97-empty', `Build ${BUILD} · projeção durável e sanitizada. Operation Journal é evidência; Continuity governa recovery; Reversible Operations é a única autoridade de revert.`));
    return true;
  }

  async function refresh(selectId = state.selectedId) {
    const center = api();
    if (!center?.list || !center?.review) throw new Error('Change Transactions client não carregado.');
    state.busy = true; state.error = ''; render();
    try {
      state.items = await center.list(60);
      if (selectId && state.items.some(item => item.id === selectId)) {
        state.selectedId = selectId;
        state.review = await center.review(selectId);
      } else if (state.selectedId && !state.items.some(item => item.id === state.selectedId)) {
        state.selectedId = ''; state.review = null; state.revert = null;
      }
    } catch (error) {
      state.error = `${error?.code || 'CHANGE_TRANSACTION_ERROR'} · ${error?.message || error}`;
    } finally { state.busy = false; render(); }
  }

  async function selectTransaction(id) {
    if (state.busy || !id) return;
    state.selectedId = id; state.revert = null; state.revertConfirmed = false; state.showExplanation = false;
    await refresh(id);
  }

  async function prepareRevert() {
    if (state.busy || !state.selectedId) return;
    state.busy = true; state.error = ''; state.revert = null; state.revertConfirmed = false; render();
    try { state.revert = await api().revertPreview(state.selectedId, { direction: 'undo', strategy: 'preserve' }); }
    catch (error) { state.error = `${error?.code || 'REVERT_PREVIEW_FAILED'} · ${error?.message || error}`; }
    finally { state.busy = false; render(); }
  }

  async function applyRevert() {
    if (state.busy || !state.selectedId || !state.revert || state.revertConfirmed !== true) return;
    const plan = state.revert.preview?.plan || state.revert.preview?.preview?.plan || {};
    state.busy = true; state.error = ''; render();
    try {
      const result = await api().applyRevert(state.selectedId, state.revert.sourceOperationId, state.revert.preview, {
        humanDecision: true,
        confirmDestructive: plan.destructive === true
      });
      state.review = result.review || await api().review(state.selectedId);
      state.revert = null; state.revertConfirmed = false;
      state.items = await api().list(60);
    } catch (error) { state.error = `${error?.code || 'REVERT_APPLY_FAILED'} · ${error?.message || error}`; }
    finally { state.busy = false; render(); }
  }

  function open(anchor) {
    if (!showDetail(anchor)) return;
    render(); refresh().catch(() => null);
  }

  function bind() {
    const shadow = root();
    if (!shadow || shadow.__ld97ChangeTransactionsBound) return false;
    shadow.__ld97ChangeTransactionsBound = true; ensureStyles(); installRailButton();
    shadow.addEventListener('change', event => {
      const checkbox = event.target.closest?.('[data-ld97-revert-confirm]');
      if (checkbox) { state.revertConfirmed = checkbox.checked === true; render(); }
    }, true);
    shadow.addEventListener('click', event => {
      const rail = event.target.closest?.('.rail-btn[data-id="change-transactions"]');
      if (rail) { event.preventDefault(); event.stopImmediatePropagation(); open(rail); return; }
      const action = event.target.closest?.('[data-ld97-action]');
      if (!action || detail()?.dataset.module !== MODULE_ID) return;
      event.preventDefault(); event.stopImmediatePropagation();
      const type = action.dataset.ld97Action;
      if (type === 'refresh') refresh();
      else if (type === 'select') selectTransaction(action.dataset.txId || '');
      else if (type === 'review') refresh(state.selectedId);
      else if (type === 'explain') { state.showExplanation = !state.showExplanation; render(); }
      else if (type === 'revert-preview') prepareRevert();
      else if (type === 'revert-apply') applyRevert();
      else if (type === 'revert-cancel') { state.revert = null; state.revertConfirmed = false; render(); }
    }, true);
    return true;
  }

  window.LovableDecrypterCanonicalChangeTransactions = Object.freeze({
    build: BUILD,
    version: VERSION,
    handles: moduleId => moduleId === MODULE_ID,
    open() {
      const button = root()?.querySelector('.rail-btn[data-id="change-transactions"]');
      if (button) open(button);
    },
    readOnlyProjection: true,
    directWriteAuthority: false,
    directApprovalAuthority: false
  });

  if (!bind()) document.addEventListener('DOMContentLoaded', bind, { once: true });
})();
