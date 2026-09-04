(() => {
  'use strict';

  if (window.__LD94_CANONICAL_CAPABILITY_ROUTER__) return;
  window.__LD94_CANONICAL_CAPABILITY_ROUTER__ = true;

  const BUILD = 94;
  const VERSION = '2.6.94';
  const MODULE_ID = 'capability-router';
  const HOST_ID = 'lovable-decrypter-launcher';
  const NS = 'http://www.w3.org/2000/svg';
  const state = { command: '', busy: false, report: null, error: '' };

  const root = () => document.getElementById(HOST_ID)?.shadowRoot || null;
  const detail = () => root()?.getElementById('detail') || null;
  const api = () => window.LovableDecrypterCapabilityRouter || null;
  const el = (tag, className = '', text = '') => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== '') node.textContent = String(text);
    return node;
  };

  function icon(size = 21) {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('fill', 'none');
    for (const d of ['M5 5h5v5H5z','M14 5h5v5h-5z','M9 10v4','M15 10v4','M9 14H6v5h5v-5H9Z','M15 14h3v5h-5v-5h2Z']) {
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', d); path.setAttribute('stroke', 'currentColor'); path.setAttribute('stroke-width', '1.6'); path.setAttribute('stroke-linecap', 'round'); path.setAttribute('stroke-linejoin', 'round'); svg.appendChild(path);
    }
    return svg;
  }

  function ensureStyles() {
    const shadow = root();
    if (!shadow || shadow.querySelector('style[data-ld94-router]')) return;
    const style = document.createElement('style'); style.dataset.ld94Router = 'true';
    style.textContent = `
      #detail .ld94-input{width:100%;min-height:100px;resize:vertical;margin-top:10px;border:1px solid rgba(255,255,255,.075);border-radius:12px;background:rgba(4,10,20,.35);color:#edf5ff;padding:10px 11px;font:11px/1.5 Arial,sans-serif;outline:none}
      #detail .ld94-input:focus{border-color:rgba(59,210,255,.3)}
      #detail .ld94-actions{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}
      #detail .ld94-btn{min-height:33px;border:1px solid rgba(59,210,255,.2);border-radius:9px;background:rgba(59,210,255,.08);color:#e8f8ff;padding:6px 10px;font:800 9px Arial,sans-serif;cursor:pointer}
      #detail .ld94-btn:disabled{opacity:.45;cursor:not-allowed}
      #detail .ld94-route{margin-top:10px;padding:9px 10px;border:1px solid rgba(59,210,255,.13);border-radius:11px;background:rgba(59,210,255,.035)}
      #detail .ld94-route b{display:block;color:#eff8ff;font-size:11px}
      #detail .ld94-route small{display:block;color:#8fa0b7;font-size:8.7px;margin-top:3px;line-height:1.4}
      #detail .ld94-title{margin-top:12px;margin-bottom:5px;color:#8190a8;font-size:8px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}
      #detail .ld94-cap{margin-top:5px;padding:7px 8px;border:1px solid rgba(255,255,255,.055);border-radius:9px;background:rgba(255,255,255,.014)}
      #detail .ld94-cap b{display:block;color:#dce7f5;font-size:9.4px}
      #detail .ld94-cap small{display:block;color:#8796aa;font-size:8.2px;line-height:1.4;margin-top:2px}
      #detail .ld94-badge{display:inline-block;margin-left:5px;padding:2px 5px;border-radius:999px;background:rgba(59,210,255,.09);color:#92e5ff;font-size:7.4px;font-weight:800}
      #detail .ld94-badge.candidate{background:rgba(255,187,83,.09);color:#ffd183}
      #detail .ld94-step{margin-top:5px;padding:6px 8px;border-left:2px solid rgba(59,210,255,.2);background:rgba(255,255,255,.012);border-radius:0 8px 8px 0;color:#9dadbf;font-size:8.5px}
      #detail .ld94-note{margin-top:10px;color:#7d8da3;font-size:8.5px;line-height:1.45}
      #detail .ld94-error{margin-top:8px;color:#ffabb6;font-size:8.7px}
    `;
    shadow.appendChild(style);
  }

  function installRailButton() {
    const shadow = root();
    const railButtons = shadow?.getElementById('railButtons');
    if (!railButtons || railButtons.querySelector('[data-id="capability-router"]')) return Boolean(railButtons);
    const button = el('button', 'rail-btn'); button.type = 'button'; button.dataset.kind = 'direct'; button.dataset.id = MODULE_ID; button.setAttribute('aria-label', 'Capability Router');
    button.append(icon(21), el('span', 'tip', 'Capability Router'));
    const composer = railButtons.querySelector('[data-id="command-composer"]');
    if (composer?.nextSibling) railButtons.insertBefore(button, composer.nextSibling); else railButtons.insertBefore(button, railButtons.firstChild);
    return true;
  }

  function showDetail(anchor) {
    const shadow = root(); const target = detail(); const rail = shadow?.getElementById('rail'); const flyout = shadow?.getElementById('flyout');
    if (!target || !anchor) return false;
    for (const node of shadow.querySelectorAll('.rail-btn.active')) node.classList.remove('active');
    anchor.classList.add('active'); if (flyout) flyout.classList.remove('show');
    target.dataset.module = MODULE_ID; target.style.display = ''; target.style.visibility = ''; target.classList.add('show');
    const rect = anchor.getBoundingClientRect(); const railRect = rail?.getBoundingClientRect?.() || rect;
    target.style.left = `${Math.max(8, Math.round(rect.left - 348))}px`;
    target.style.top = `${Math.max(8, Math.min(Math.round(rect.top), innerHeight - 260))}px`;
    target.style.height = `${Math.min(Math.max(420, target.scrollHeight || 420), Math.max(420, railRect.height || 620), innerHeight - 16)}px`;
    target.style.maxHeight = `${Math.max(260, innerHeight - 16)}px`; target.style.overflowY = 'auto';
    return true;
  }

  function render() {
    const target = detail(); if (!target || target.dataset.module !== MODULE_ID) return false;
    ensureStyles(); target.replaceChildren();
    const head = el('div', 'detail-head'); head.append(icon(23), el('b', '', 'Intent & Capability Router'));
    const status = el('span', 'state', state.busy ? 'CLASSIFICANDO' : 'CLASSIFICATION ONLY'); status.dataset.runtime = state.error ? 'offline' : 'online'; head.appendChild(status); target.appendChild(head);
    const input = el('textarea', 'ld94-input'); input.placeholder = 'Descreva um pedido para visualizar quais capacidades ele realmente exige…'; input.value = state.command; input.dataset.ld94Input = 'true'; input.disabled = state.busy; target.appendChild(input);
    const actions = el('div', 'ld94-actions'); const run = el('button', 'ld94-btn', 'Classificar pedido'); run.type = 'button'; run.dataset.ld94Action = 'route'; run.disabled = state.busy || !state.command.trim(); actions.appendChild(run); target.appendChild(actions);
    if (state.error) target.appendChild(el('div', 'ld94-error', state.error));

    const report = state.report;
    if (report) {
      const route = el('div', 'ld94-route'); route.append(el('b', '', `Rota: ${report.route}`), el('small', '', report.mixed ? 'Múltiplas capacidades explícitas; cada domínio mantém seus próprios gates.' : 'Classificação baseada somente no pedido explícito do usuário.')); target.appendChild(route);
      const required = (report.capabilities || []).filter(item => item.status === 'required');
      if (required.length) {
        target.appendChild(el('div', 'ld94-title', 'Capacidades requeridas'));
        for (const item of required) { const card = el('div', 'ld94-cap'); const title = el('b', '', item.label || item.id); title.appendChild(el('span', 'ld94-badge', 'REQUIRED')); card.append(title, el('small', '', `${item.evidence || 'sinal explícito'} · ${item.reason || ''}`)); target.appendChild(card); }
      }
      const candidates = (report.capabilities || []).filter(item => item.status === 'candidate');
      if (candidates.length) {
        target.appendChild(el('div', 'ld94-title', 'Possíveis capacidades — não ativadas'));
        for (const item of candidates) { const card = el('div', 'ld94-cap'); const title = el('b', '', item.label || item.id); title.appendChild(el('span', 'ld94-badge candidate', 'CONFIRMAR')); card.append(title, el('small', '', `${item.evidence || 'sinal implícito'} · não entra no escopo sem confirmação.`)); target.appendChild(card); }
      }
      if (report.capabilityPlan?.length) {
        target.appendChild(el('div', 'ld94-title', 'Plano de capacidades'));
        for (const step of report.capabilityPlan) target.appendChild(el('div', 'ld94-step', `${step.index}. ${step.capability} · ${step.authority} · auto-execução: NÃO`));
      }
    }
    target.appendChild(el('div', 'ld94-note', 'Build 94 · O Router apenas classifica e explica. Candidatos implícitos nunca são autoativados. Ele não chama Tool Runtime, banco, Git, deploy, aprovação ou qualquer write.'));
    target.style.height = `${Math.min(Math.max(450, target.scrollHeight + 18), innerHeight - 16)}px`;
    return true;
  }

  async function route() {
    if (state.busy || !state.command.trim()) return;
    const center = api(); if (!center?.route) { state.error = 'Capability Router client não carregado.'; render(); return; }
    state.busy = true; state.error = ''; state.report = null; render();
    try { state.report = await center.route(state.command); }
    catch (error) { state.error = `${error?.code || 'ERRO'} · ${error?.message || error}`; }
    finally { state.busy = false; render(); }
  }

  function open(anchor) { if (showDetail(anchor)) { state.error = ''; render(); } }

  function bind() {
    const shadow = root(); if (!shadow || shadow.__ld94CapabilityRouterBound) return false;
    shadow.__ld94CapabilityRouterBound = true; ensureStyles(); installRailButton();
    shadow.addEventListener('input', event => { const input = event.target.closest?.('[data-ld94-input]'); if (input) { state.command = String(input.value || ''); const button = detail()?.querySelector('[data-ld94-action="route"]'); if (button) button.disabled = !state.command.trim() || state.busy; } }, true);
    shadow.addEventListener('click', event => {
      const rail = event.target.closest?.('.rail-btn[data-id="capability-router"]');
      if (rail) { event.preventDefault(); event.stopImmediatePropagation(); open(rail); return; }
      const action = event.target.closest?.('[data-ld94-action="route"]');
      if (action) { event.preventDefault(); event.stopImmediatePropagation(); route(); }
    }, true);
    return true;
  }

  window.LovableDecrypterCanonicalCapabilityRouter = Object.freeze({ build: BUILD, version: VERSION, handles: moduleId => moduleId === MODULE_ID, open: () => { const button = root()?.querySelector('.rail-btn[data-id="capability-router"]'); if (button) open(button); }, writeAuthority: false, automaticExecutionAllowed: false });
  if (!bind()) document.addEventListener('DOMContentLoaded', bind, { once: true });
})();