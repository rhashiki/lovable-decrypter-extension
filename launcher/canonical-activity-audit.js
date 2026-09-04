(() => {
  'use strict';

  if (window.__LD91_CANONICAL_ACTIVITY_AUDIT__) return;
  window.__LD91_CANONICAL_ACTIVITY_AUDIT__ = true;

  const BUILD = 91;
  const VERSION = '2.6.91';
  const HOST_ID = 'lovable-decrypter-launcher';
  const MODULES = new Set(['runtime-events', 'operations']);
  let activeFilter = 'all';

  const text = (value, fallback = '—') => { const out = String(value ?? '').trim(); return out || fallback; };
  const root = () => document.getElementById(HOST_ID)?.shadowRoot || null;
  const detail = () => root()?.getElementById('detail') || null;
  const api = () => window.LovableDecrypterCanonicalActivityAuditApi || null;
  function el(tag, className = '', value = '') { const node = document.createElement(tag); if (className) node.className = className; if (value !== '') node.textContent = String(value); return node; }
  function clear(node) { while (node?.firstChild) node.firstChild.remove(); }

  function ensureStyles() {
    const shadow = root(); if (!shadow || shadow.querySelector('style[data-ld91-audit]')) return;
    const style = document.createElement('style'); style.dataset.ld91Audit = 'true';
    style.textContent = `
      #detail .ld91-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px}
      #detail .ld91-summary div{padding:9px 10px;border:1px solid rgba(255,255,255,.055);border-radius:11px;background:rgba(255,255,255,.016)}
      #detail .ld91-summary small{display:block;color:#7e8ca3;font-size:8px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;margin-bottom:4px}
      #detail .ld91-summary b{display:block;color:#eaf2ff;font-size:10px;overflow-wrap:anywhere}
      #detail .ld91-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
      #detail .ld91-btn{min-height:30px;border:1px solid rgba(99,222,255,.14);border-radius:9px;background:rgba(255,255,255,.02);color:#c9d7ea;padding:6px 9px;font:700 8.7px Arial,sans-serif;cursor:pointer}
      #detail .ld91-btn.active{background:rgba(99,222,255,.09);border-color:rgba(99,222,255,.28);color:#e9f9ff}
      #detail .ld91-timeline{display:grid;gap:7px;margin-top:12px}
      #detail .ld91-event{padding:9px 10px;border:1px solid rgba(255,255,255,.055);border-radius:11px;background:rgba(255,255,255,.015)}
      #detail .ld91-head{display:flex;justify-content:space-between;align-items:flex-start;gap:9px}
      #detail .ld91-head b{display:block;color:#edf4ff;font-size:10px;line-height:1.35;overflow-wrap:anywhere}
      #detail .ld91-head small{display:block;color:#8190a8;font-size:8.6px;line-height:1.4;margin-top:3px;overflow-wrap:anywhere}
      #detail .ld91-badge{padding:4px 7px;border-radius:999px;background:rgba(66,210,255,.08);color:#91e3ff;font-size:8px;font-weight:800;white-space:nowrap}
      #detail .ld91-badge.commit{background:rgba(62,207,142,.1);color:#7ceab0}
      #detail .ld91-badge.approval{background:rgba(142,119,255,.1);color:#c9bcff}
      #detail .ld91-badge.recovery{background:rgba(255,187,83,.1);color:#ffd183}
      #detail .ld91-badge.runtime{background:rgba(99,166,255,.1);color:#b8d7ff}
      #detail .ld91-meta{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px;color:#8796ad;font-size:8.5px}
      #detail .ld91-chip{padding:3px 6px;border-radius:7px;background:rgba(255,255,255,.025);overflow-wrap:anywhere}
      #detail .ld91-note{margin-top:8px;color:#8392aa;font-size:9.2px;line-height:1.45;overflow-wrap:anywhere}
      #detail .ld91-status{margin-top:9px;padding:8px 9px;border:1px solid rgba(99,222,255,.09);border-radius:9px;background:rgba(99,222,255,.03);color:#9eb0c8;font-size:9px;line-height:1.4;overflow-wrap:anywhere}
    `;
    shadow.appendChild(style);
  }

  function summaryCard(label, value) { const card = el('div'); card.append(el('small', '', label), el('b', '', text(value))); return card; }
  function button(label, filter) { const node = el('button', `ld91-btn${activeFilter === filter ? ' active' : ''}`, label); node.type = 'button'; node.dataset.ld91Action = 'filter'; node.dataset.filter = filter; return node; }
  function statusLine(target, value) { let node = target.querySelector('.ld91-status'); if (!node) { node = el('div', 'ld91-status'); target.appendChild(node); } node.textContent = String(value || ''); return node; }

  function buildHead(target) {
    const icon = target.querySelector('.detail-head svg')?.cloneNode(true) || null; clear(target);
    const head = el('div', 'detail-head'); if (icon) head.appendChild(icon); head.appendChild(el('b', '', 'Activity + Audit'));
    const state = el('span', 'state', 'READ ONLY'); state.dataset.runtime = 'online'; head.appendChild(state); target.appendChild(head);
  }

  function eventCard(event) {
    const card = el('article', 'ld91-event');
    const head = el('div', 'ld91-head'); const copy = el('div'); copy.append(el('b', '', text(event?.title, event?.kind)), el('small', '', `${text(event?.at)} · ${text(event?.detail)}`));
    const category = text(event?.category, 'operation').toLowerCase(); head.append(copy, el('span', `ld91-badge ${category}`, category.toUpperCase())); card.appendChild(head);
    const meta = el('div', 'ld91-meta');
    const rows = [
      event?.status ? `status ${event.status}` : '',
      event?.repo ? `repo ${event.repo}` : '',
      event?.branch ? `branch ${event.branch}` : '',
      event?.taskId ? `task ${event.taskId}` : '',
      event?.transactionId ? `tx ${event.transactionId}` : '',
      event?.operationId ? `op ${event.operationId}` : '',
      event?.commitSha ? `commit ${String(event.commitSha).slice(0,12)}` : '',
      Number(event?.fileCount || 0) ? `${Number(event.fileCount)} file(s)` : '',
      event?.errorCode ? `error ${event.errorCode}` : ''
    ].filter(Boolean);
    for (const row of rows) meta.appendChild(el('span', 'ld91-chip', row));
    if (meta.childElementCount) card.appendChild(meta);
    if (Array.isArray(event?.paths) && event.paths.length) card.appendChild(el('div', 'ld91-note', event.paths.slice(0, 8).join(' · ')));
    return card;
  }

  async function render() {
    const target = detail(); if (!target || !MODULES.has(target.dataset.module)) return false;
    ensureStyles(); const center = api(); if (!center?.snapshot) throw new Error('Canonical Activity + Audit client não carregado.');
    const prior = target.querySelector('.state'); if (prior) { prior.textContent = 'VERIFICANDO'; prior.dataset.runtime = 'checking'; }
    const snapshot = await center.snapshot(160); if (!target.isConnected || !MODULES.has(target.dataset.module)) return false;
    buildHead(target);

    const summary = el('div', 'ld91-summary');
    summary.append(
      summaryCard('Eventos', String(snapshot.events?.length || 0)),
      summaryCard('Operações / commits', `${Number(snapshot.counts?.operation || 0)} / ${Number(snapshot.counts?.commit || 0)}`),
      summaryCard('Approvals', String(snapshot.counts?.approval || 0)),
      summaryCard('Recovery / runtime', `${Number(snapshot.counts?.recovery || 0)} / ${Number(snapshot.counts?.runtime || 0)}`)
    ); target.appendChild(summary);

    const filters = el('div', 'ld91-actions');
    for (const [id, label] of [['all','Tudo'],['operation','Operações'],['commit','Commits'],['approval','Approvals'],['recovery','Recovery'],['runtime','Runtime']]) filters.appendChild(button(label, id));
    target.appendChild(filters);

    const timeline = el('div', 'ld91-timeline');
    const events = (snapshot.events || []).filter(event => activeFilter === 'all' || event?.category === activeFilter);
    for (const event of events) timeline.appendChild(eventCard(event));
    if (!events.length) timeline.appendChild(el('div', 'ld91-note', 'Nenhum evento nesta categoria para o projeto atual.'));
    target.appendChild(timeline);

    target.appendChild(el('div', 'ld91-note', `Fontes: ${(snapshot.sources || []).join(' · ')}. Auditoria redigida: prompt bruto, output bruto do modelo, conteúdo de arquivos e credenciais não são incluídos.`));
    const actions = el('div', 'ld91-actions'); const refresh = el('button', 'ld91-btn', 'Atualizar'); refresh.type = 'button'; refresh.dataset.ld91Action = 'refresh'; actions.appendChild(refresh); target.appendChild(actions);
    target.dataset.ld91Canonical = 'true'; return true;
  }

  function bind() {
    const shadow = root(); if (!shadow || shadow.__ld91AuditBound) return false; shadow.__ld91AuditBound = true; ensureStyles();
    shadow.addEventListener('click', event => {
      const actionNode = event.target.closest?.('[data-ld91-action]');
      if (actionNode) {
        event.preventDefault(); event.stopImmediatePropagation();
        if (actionNode.dataset.ld91Action === 'filter') activeFilter = actionNode.dataset.filter || 'all';
        render().catch(error => statusLine(detail(), `${error?.code || 'ERRO'} · ${error?.message || error}`)); return;
      }
      const item = event.target.closest?.('.fly-item')?.dataset?.item || '';
      if (MODULES.has(item)) queueMicrotask(() => render().catch(error => statusLine(detail(), `${error?.code || 'ERRO'} · ${error?.message || error}`)));
    }, true);
    return true;
  }

  window.LovableDecrypterCanonicalActivityAudit = Object.freeze({ build: BUILD, version: VERSION, handles: moduleId => MODULES.has(moduleId), render });
  if (!bind()) document.addEventListener('DOMContentLoaded', bind, { once: true });
})();
