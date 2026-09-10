(() => {
  'use strict';
  if (window.__LD84_CONTEXT_INTELLIGENCE_UI__) return;
  window.__LD84_CONTEXT_INTELLIGENCE_UI__ = true;

  const HOST_ID = 'lovable-decrypter-launcher';
  const MODAL_ID = 'ld84-context-intelligence-modal';
  const MODULES = new Set(['context-pack', 'scope-intelligence']);

  function send(message) {
    return new Promise(resolve => {
      try {
        chrome.runtime.sendMessage(message, response => {
          if (chrome.runtime.lastError) return resolve({ ok: false, code: 'RUNTIME_MESSAGE_FAILED', message: chrome.runtime.lastError.message });
          resolve(response || { ok: false, code: 'EMPTY_RUNTIME_RESPONSE' });
        });
      } catch (error) { resolve({ ok: false, code: 'RUNTIME_MESSAGE_FAILED', message: error?.message || String(error) }); }
    });
  }
  function el(tag, cls, text) { const node = document.createElement(tag); if (cls) node.className = cls; if (text != null) node.textContent = text; return node; }
  function setFoot(shadow, moduleId, text) {
    const detail = shadow?.getElementById?.('detail');
    if (!detail || detail.dataset.module !== moduleId) return;
    const foot = detail.querySelector('.foot');
    if (foot) foot.textContent = text;
  }
  const css = `
    #${MODAL_ID}{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:18px;background:rgba(3,7,16,.6);backdrop-filter:blur(11px);pointer-events:auto;font-family:Arial,sans-serif;color:#f4f8ff}
    #${MODAL_ID} *{box-sizing:border-box}#${MODAL_ID} .ci-card{width:min(760px,calc(100vw - 28px));max-height:min(840px,calc(100vh - 28px));overflow:auto;border:1px solid rgba(255,255,255,.11);border-radius:24px;background:linear-gradient(180deg,rgba(20,31,54,.99),rgba(8,15,29,.995));box-shadow:0 30px 100px rgba(0,0,0,.48);padding:20px}
    #${MODAL_ID} .ci-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:14px}#${MODAL_ID} h2{margin:0;font:700 20px/1.2 Arial;color:#fff}#${MODAL_ID} .ci-sub{margin-top:5px;color:#93a3bd;font:12px/1.45 Arial}
    #${MODAL_ID} .ci-close{width:36px;height:36px;border:1px solid rgba(255,255,255,.1);border-radius:12px;background:rgba(255,255,255,.05);color:#e4edfb;font:22px/1 Arial;cursor:pointer}
    #${MODAL_ID} .ci-status{padding:11px 12px;border:1px solid rgba(59,210,255,.17);border-radius:13px;background:rgba(59,210,255,.065);color:#dcecff;font:12px/1.45 Arial;margin-bottom:13px;overflow-wrap:anywhere}#${MODAL_ID} .ci-status[data-kind="error"]{border-color:rgba(255,91,115,.3);background:rgba(255,91,115,.09);color:#ffd5dd}#${MODAL_ID} .ci-status[data-kind="success"]{border-color:rgba(67,216,142,.3);background:rgba(67,216,142,.09);color:#dcffed}
    #${MODAL_ID} textarea{width:100%;min-height:128px;resize:vertical;padding:11px 12px;border:1px solid rgba(255,255,255,.1);border-radius:11px;background:rgba(255,255,255,.045);color:#edf5ff;font:12px/1.45 Arial;outline:none}#${MODAL_ID} .ci-label{display:block;margin:0 0 6px;color:#8999b3;font:700 10px/1.3 Arial;text-transform:uppercase;letter-spacing:.04em}
    #${MODAL_ID} .ci-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;margin-top:10px}#${MODAL_ID} .ci-btn{min-height:37px;padding:0 12px;border-radius:11px;border:1px solid rgba(59,210,255,.2);background:rgba(59,210,255,.1);color:#e9f8ff;cursor:pointer;font:600 12px Arial}#${MODAL_ID} .ci-btn.secondary{border-color:rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:#cbd7eb}#${MODAL_ID} .ci-btn:disabled{opacity:.48;cursor:default}
    #${MODAL_ID} .ci-grid{display:grid;grid-template-columns:150px 1fr;gap:8px 12px}#${MODAL_ID} .ci-key{color:#8190aa;font:11px/1.45 Arial}#${MODAL_ID} .ci-value{color:#edf5ff;font:11px/1.45 Arial;overflow-wrap:anywhere}
    #${MODAL_ID} .ci-section{margin-top:14px;padding-top:13px;border-top:1px solid rgba(255,255,255,.065)}#${MODAL_ID} .ci-section h3{margin:0 0 9px;color:#eaf2ff;font:700 12px Arial}#${MODAL_ID} .ci-files{display:grid;gap:6px}#${MODAL_ID} .ci-file{padding:8px 9px;border-radius:10px;background:rgba(255,255,255,.035);color:#cfd9e9;font:11px/1.4 Arial;display:flex;justify-content:space-between;gap:12px}#${MODAL_ID} .ci-tag{color:#9deaff;font:700 9px Arial;text-transform:uppercase}
    #${MODAL_ID} .ci-note{margin-top:13px;color:#8391aa;font:11px/1.45 Arial}@media(max-width:680px){#${MODAL_ID}{padding:8px}#${MODAL_ID} .ci-card{width:100%;max-height:calc(100vh - 16px);border-radius:18px;padding:15px}#${MODAL_ID} .ci-grid{grid-template-columns:1fr}}
  `;
  function modal(shadow, title, subtitle) {
    shadow.getElementById(MODAL_ID)?.remove();
    const overlay = el('div'); overlay.id = MODAL_ID;
    const style = el('style'); style.textContent = css;
    const card = el('section', 'ci-card');
    const head = el('div', 'ci-head'); const wrap = el('div'); wrap.append(el('h2', '', title), el('div', 'ci-sub', subtitle));
    const close = el('button', 'ci-close', '×'); close.type = 'button'; close.setAttribute('aria-label', 'Fechar'); head.append(wrap, close);
    const status = el('div', 'ci-status', 'Carregando…'); const body = el('div');
    card.append(head, status, body, el('div', 'ci-note', 'Build 84.6 · execução sob demanda · sem MutationObserver, polling contínuo ou persistência do prompt bruto.'));
    overlay.append(style, card); shadow.appendChild(overlay);
    close.addEventListener('click', () => overlay.remove(), { once: true }); overlay.addEventListener('click', event => { if (event.target === overlay) overlay.remove(); });
    return { overlay, card, status, body };
  }
  function field(grid, key, value) { grid.append(el('div', 'ci-key', key), el('div', 'ci-value', value == null || value === '' ? '—' : String(value))); }
  function statusKind(modalState, text, kind = '') { modalState.status.textContent = text; modalState.status.dataset.kind = kind; }

  async function openContext(shadow) {
    const state = modal(shadow, 'Context Pack', 'Project Brain + Memory + GitHub context · orçamento controlado');
    const info = await send({ type: 'ld84.context.status' });
    if (!info?.ok) return statusKind(state, info?.message || info?.code || 'Falha ao abrir Context Engine.', 'error');
    statusKind(state, info.summary || 'Context Engine pronto.', 'success');
    const grid = el('div', 'ci-grid');
    field(grid, 'Projeto', info?.data?.projectId || '—'); field(grid, 'Repositório', info?.data?.binding?.repository || '—'); field(grid, 'Branch', info?.data?.binding?.branch || 'main'); field(grid, 'Memory Engine', info?.data?.memoryEngine || 'project-brain-v2');
    state.body.append(grid);
    const section = el('div', 'ci-section'); section.append(el('h3', '', 'Gerar contexto sob demanda'));
    const label = el('label', 'ci-label', 'Tarefa / pedido atual'); const task = document.createElement('textarea'); task.placeholder = 'Descreva a tarefa para o Context Engine selecionar o menor conjunto útil de memória e arquivos…';
    const actions = el('div', 'ci-actions'); const build = el('button', 'ci-btn', 'Gerar Context Pack'); build.type = 'button'; actions.append(build); section.append(label, task, actions); state.body.append(section);
    build.addEventListener('click', async () => {
      const value = String(task.value || '').trim(); if (!value) return statusKind(state, 'Descreva a tarefa antes de gerar o Context Pack.', 'error');
      build.disabled = true; statusKind(state, 'Consultando Project Brain, memória e GitHub…');
      const out = await send({ type: 'ld84.context.build', task: value }); build.disabled = false;
      if (!out?.ok) return statusKind(state, out?.message || out?.code || 'Falha ao gerar Context Pack.', 'error');
      statusKind(state, out.summary || 'Context Pack pronto.', 'success');
      state.body.querySelector('[data-ci-result]')?.remove(); const result = el('div', 'ci-section'); result.dataset.ciResult = '1'; result.append(el('h3', '', 'Context Pack gerado'));
      const meta = el('div', 'ci-grid'); field(meta, 'HEAD', String(out?.pack?.git?.headSha || '').slice(0, 12)); field(meta, 'Brain', out?.pack?.memory?.brainVersion ?? '—'); field(meta, 'Memória', `${out?.pack?.memory?.hitCount || 0} hit(s) · ${out?.pack?.memory?.retrieval || 'none'}`); field(meta, 'Código', `${out?.pack?.budget?.usedCodeBytes || 0} bytes`); result.append(meta);
      const files = el('div', 'ci-files'); for (const file of out?.pack?.files || []) { const row = el('div', 'ci-file'); row.append(el('span', '', file.path), el('span', 'ci-tag', `${file.contextBytes || 0} B${file.truncated ? ' · parcial' : ''}`)); files.append(row); } result.append(files); state.body.append(result);
    });
  }
  async function openScope(shadow) {
    const state = modal(shadow, 'Scope Intelligence', 'Request → plano aprovado → diff · USER_EDIT > AI_EDIT');
    const out = await send({ type: 'ld84.scope.status' });
    if (!out?.ok) return statusKind(state, out?.message || out?.code || 'Falha ao abrir Scope Intelligence.', 'error');
    statusKind(state, out.summary || 'Scope Intelligence funcional.', 'success');
    const data = out.data || {}; const grid = el('div', 'ci-grid');
    field(grid, 'Enforcement', data.enforcement); field(grid, 'Comparação', data.comparison); field(grid, 'Human Intent', data.humanIntentPolicy); field(grid, 'Skip approval', data.skipApprovalBypassesScope === false ? 'não bypassa Scope' : '—'); field(grid, 'Execução', data.eventDriven ? 'event-driven' : '—'); state.body.append(grid);
    const section = el('div', 'ci-section'); section.append(el('h3', '', `Human Intent Locks ativos · ${(data.locks || []).length}`)); const files = el('div', 'ci-files');
    if (!(data.locks || []).length) files.append(el('div', 'ci-file', 'Nenhum lock persistido para o projeto atual.'));
    for (const lock of data.locks || []) { const row = el('div', 'ci-file'); row.append(el('span', '', lock.path), el('span', 'ci-tag', `${lock.level} · ${lock.count}x`)); files.append(row); } section.append(files); state.body.append(section);
  }
  async function handle(shadow, moduleId) {
    setFoot(shadow, moduleId, `Build 84.6 · ${moduleId} · abrindo autoridade funcional…`);
    if (moduleId === 'context-pack') await openContext(shadow); else await openScope(shadow);
    setFoot(shadow, moduleId, `Build 84.6 · ${moduleId} · FUNCIONAL · event-driven`);
  }
  function bind() {
    const host = document.getElementById(HOST_ID); const shadow = host?.shadowRoot; if (!shadow || shadow.__ld84ContextIntelligenceBound) return Boolean(shadow);
    Object.defineProperty(shadow, '__ld84ContextIntelligenceBound', { value: true, configurable: false });
    shadow.addEventListener('click', event => {
      const button = event.target?.closest?.('button.action'); if (!button) return;
      const moduleId = String(shadow.getElementById('detail')?.dataset?.module || ''); if (!MODULES.has(moduleId)) return;
      event.preventDefault(); event.stopImmediatePropagation(); handle(shadow, moduleId).catch(error => setFoot(shadow, moduleId, `Build 84.6 · ${moduleId} · ${error?.message || 'RUNTIME_ERROR'}`));
    }, true);
    return true;
  }
  if (!bind() && document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
})();
