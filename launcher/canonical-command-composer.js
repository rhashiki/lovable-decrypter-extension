(() => {
  'use strict';

  if (window.__LD92_CANONICAL_COMMAND_COMPOSER__) return;
  window.__LD92_CANONICAL_COMMAND_COMPOSER__ = true;

  const BUILD = 92;
  const VERSION = '2.6.92';
  const MODULE_ID = 'command-composer';
  const HOST_ID = 'lovable-decrypter-launcher';
  const NS = 'http://www.w3.org/2000/svg';

  const state = {
    mode: 'plan',
    command: '',
    phase: 'idle',
    busy: false,
    result: null,
    diff: null,
    error: '',
    taskId: ''
  };

  const root = () => document.getElementById(HOST_ID)?.shadowRoot || null;
  const detail = () => root()?.getElementById('detail') || null;
  const api = () => window.LovableDecrypterCanonicalCommandComposerApi || null;
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
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', String(size)); svg.setAttribute('height', String(size)); svg.setAttribute('fill', 'none'); svg.setAttribute('aria-hidden', 'true');
    for (const d of ['M8 9 5 12l3 3','m16 9 3 3-3 3','m14 5-4 14']) {
      const path = document.createElementNS(NS, 'path'); path.setAttribute('d', d); path.setAttribute('stroke', 'currentColor'); path.setAttribute('stroke-width', '1.75'); path.setAttribute('stroke-linecap', 'round'); path.setAttribute('stroke-linejoin', 'round'); svg.appendChild(path);
    }
    return svg;
  }

  function ensureStyles() {
    const shadow = root();
    if (!shadow || shadow.querySelector('style[data-ld92-composer]')) return;
    const style = document.createElement('style'); style.dataset.ld92Composer = 'true';
    style.textContent = `
      #detail .ld92-modes{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:12px}
      #detail .ld92-mode{min-height:34px;border:1px solid rgba(255,255,255,.065);border-radius:10px;background:rgba(255,255,255,.015);color:#9caac0;font:800 9px Arial,sans-serif;cursor:pointer}
      #detail .ld92-mode.active{border-color:rgba(59,210,255,.3);background:rgba(59,210,255,.09);color:#e9f9ff}
      #detail .ld92-input{width:100%;min-height:116px;resize:vertical;margin-top:10px;border:1px solid rgba(255,255,255,.075);border-radius:12px;background:rgba(4,10,20,.35);color:#edf5ff;padding:10px 11px;font:11px/1.5 Arial,sans-serif;outline:none}
      #detail .ld92-input:focus{border-color:rgba(59,210,255,.3);box-shadow:0 0 0 2px rgba(59,210,255,.045)}
      #detail .ld92-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}
      #detail .ld92-btn{min-height:33px;border:1px solid rgba(59,210,255,.2);border-radius:9px;background:rgba(59,210,255,.08);color:#e8f8ff;padding:6px 10px;font:800 9px Arial,sans-serif;cursor:pointer}
      #detail .ld92-btn.secondary{background:rgba(255,255,255,.018);border-color:rgba(255,255,255,.07);color:#cad7e8}
      #detail .ld92-btn.danger{background:rgba(255,103,122,.05);border-color:rgba(255,103,122,.18);color:#ffabb6}
      #detail .ld92-btn.warn{background:rgba(255,187,83,.06);border-color:rgba(255,187,83,.2);color:#ffd183}
      #detail .ld92-btn:disabled{opacity:.45;cursor:not-allowed}
      #detail .ld92-phase{margin-top:9px;padding:8px 9px;border:1px solid rgba(59,210,255,.09);border-radius:9px;background:rgba(59,210,255,.03);color:#a7b7cc;font-size:9px;line-height:1.45}
      #detail .ld92-section{margin-top:13px}
      #detail .ld92-title{color:#8391a8;font-size:8px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;margin-bottom:6px}
      #detail .ld92-card{padding:9px 10px;border:1px solid rgba(255,255,255,.055);border-radius:11px;background:rgba(255,255,255,.015);margin-top:6px}
      #detail .ld92-card b{display:block;color:#edf4ff;font-size:10px;line-height:1.4;overflow-wrap:anywhere}
      #detail .ld92-card small{display:block;color:#8493aa;font-size:8.7px;line-height:1.45;margin-top:3px;overflow-wrap:anywhere}
      #detail .ld92-badges{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}
      #detail .ld92-badge{padding:4px 7px;border-radius:999px;background:rgba(59,210,255,.08);color:#9ae6ff;font-size:8px;font-weight:800}
      #detail .ld92-badge.ok{background:rgba(62,207,142,.1);color:#7ceab0}
      #detail .ld92-badge.warn{background:rgba(255,187,83,.1);color:#ffd183}
      #detail .ld92-badge.bad{background:rgba(255,103,122,.1);color:#ff9fac}
      #detail .ld92-step{margin-top:5px;padding:6px 8px;border-left:2px solid rgba(59,210,255,.16);border-radius:0 8px 8px 0;background:rgba(255,255,255,.012);color:#9dacbf;font-size:8.8px;line-height:1.4;overflow-wrap:anywhere}
      #detail .ld92-diff{margin-top:7px;border:1px solid rgba(255,255,255,.055);border-radius:9px;overflow:hidden;background:rgba(3,8,16,.28)}
      #detail .ld92-diff-head{padding:7px 8px;border-bottom:1px solid rgba(255,255,255,.05);color:#cfd9e8;font-size:8.8px;font-weight:800;overflow-wrap:anywhere}
      #detail .ld92-diff pre{margin:0;padding:8px;max-height:230px;overflow:auto;white-space:pre-wrap;word-break:break-word;color:#aebdce;font:8.5px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace}
      #detail .ld92-note{margin-top:8px;color:#7f8da4;font-size:8.8px;line-height:1.45}
      #detail .ld92-error{margin-top:9px;padding:8px 9px;border:1px solid rgba(255,103,122,.14);border-radius:9px;background:rgba(255,103,122,.035);color:#ffb2bd;font-size:9px;line-height:1.4}
    `;
    shadow.appendChild(style);
  }

  function installRailButton() {
    const shadow = root();
    const railButtons = shadow?.getElementById('railButtons');
    if (!railButtons || railButtons.querySelector('[data-id="command-composer"]')) return Boolean(railButtons);
    const button = el('button', 'rail-btn'); button.type = 'button'; button.dataset.kind = 'direct'; button.dataset.id = MODULE_ID; button.setAttribute('aria-label', 'Command Composer');
    button.append(icon(21), el('span', 'tip', 'Command Composer'));
    railButtons.insertBefore(button, railButtons.firstChild);
    return true;
  }

  function showDetail(anchor) {
    const shadow = root(); const target = detail(); const rail = shadow?.getElementById('rail'); const flyout = shadow?.getElementById('flyout');
    if (!target || !anchor) return false;
    for (const node of shadow.querySelectorAll('.rail-btn.active')) node.classList.remove('active');
    anchor.classList.add('active');
    if (flyout) flyout.classList.remove('show');
    target.dataset.module = MODULE_ID;
    target.style.display = ''; target.style.visibility = ''; target.classList.add('show');
    const anchorRect = anchor.getBoundingClientRect();
    const railRect = rail?.getBoundingClientRect?.() || anchorRect;
    target.style.left = `${Math.max(8, Math.round(anchorRect.left - 348))}px`;
    target.style.top = `${Math.max(8, Math.min(Math.round(anchorRect.top), innerHeight - 260))}px`;
    target.style.height = `${Math.min(Math.max(420, target.scrollHeight || 420), Math.max(420, railRect.height || 620), innerHeight - 16)}px`;
    target.style.maxHeight = `${Math.max(260, innerHeight - 16)}px`;
    target.style.overflowY = 'auto';
    return true;
  }

  function phaseLabel() {
    const map = {
      idle: 'Pronto. PLAN não escreve; BUILD para antes de cada write.',
      planning: 'Context Engine + modelo local: gerando plano…',
      building: 'Agente local executando somente leituras automáticas até encontrar uma proposta de write…',
      previewing: 'Gerando diff somente-leitura da proposta…',
      waiting_approval: 'Write bloqueado. Revise o diff e aprove explicitamente para continuar.',
      approving: 'Aprovação vinculada ao proposalDigest · Scope Intelligence + Human Intent + Continuity em validação…',
      completed: 'Execução concluída.',
      cancelled: 'Tarefa cancelada. Nenhuma aprovação pendente será executada.',
      stopped: 'Agente interrompeu a execução sem novo write.',
      error: 'Execução interrompida por erro.'
    };
    return map[state.phase] || state.phase;
  }

  function head(target) {
    const row = el('div', 'detail-head'); row.append(icon(23), el('b', '', 'Command Composer'));
    const badge = el('span', 'state', state.mode === 'plan' ? 'PLAN · READ' : 'BUILD · GATED'); badge.dataset.runtime = state.error ? 'offline' : 'online'; row.appendChild(badge); target.appendChild(row);
  }

  function renderPlan(target) {
    const plan = state.result?.plan;
    if (!plan) return;
    const section = el('section', 'ld92-section'); section.appendChild(el('div', 'ld92-title', 'Plano atual'));
    const card = el('div', 'ld92-card'); card.append(el('b', '', text(plan.summary, 'Plano sem resumo')), el('small', '', `${Number(plan.plan?.length || 0)} etapa(s) · ${Number(plan.files?.length || 0)} arquivo(s) previsto(s)`));
    for (const step of (plan.plan || []).slice(0, 20)) card.appendChild(el('div', 'ld92-step', step));
    for (const file of (plan.files || []).slice(0, 30)) card.appendChild(el('div', 'ld92-step', `${text(file?.path || file)}${file?.reason ? ` · ${file.reason}` : ''}`));
    section.appendChild(card); target.appendChild(section);
  }

  function renderProposal(target) {
    const proposal = state.result?.proposal;
    if (!proposal) return;
    const section = el('section', 'ld92-section'); section.appendChild(el('div', 'ld92-title', 'Write aguardando aprovação'));
    const card = el('div', 'ld92-card'); card.append(el('b', '', `${text(proposal.tool)} · ${Number(proposal.paths?.length || 0)} path(s)`), el('small', '', text(proposal.reason, 'Proposta gerada pelo agente local.')));
    const badges = el('div', 'ld92-badges'); badges.append(el('span', 'ld92-badge', `DIGEST ${String(proposal.digest || '').slice(0,12)}`), el('span', `ld92-badge ${proposal.destructive ? 'bad' : 'ok'}`, proposal.destructive ? 'DESTRUCTIVE' : 'GATED WRITE'));
    card.appendChild(badges); section.appendChild(card);

    for (const file of state.diff?.files || []) {
      const diff = el('div', 'ld92-diff');
      diff.appendChild(el('div', 'ld92-diff-head', `${text(file.path)} · ${text(file.action).toUpperCase()} · +${Number(file.addedLines || 0)} / -${Number(file.removedLines || 0)}`));
      const pre = el('pre'); pre.textContent = String(file.preview || '(preview indisponível)'); diff.appendChild(pre); section.appendChild(diff);
    }

    const actions = el('div', 'ld92-actions');
    const approve = el('button', `ld92-btn ${proposal.destructive ? 'warn' : ''}`, proposal.destructive ? 'Aprovar exclusão' : 'Aprovar esta escrita'); approve.type = 'button'; approve.dataset.ld92Action = 'approve'; approve.disabled = state.busy || !state.diff; actions.appendChild(approve);
    const cancel = el('button', 'ld92-btn danger', 'Cancelar tarefa'); cancel.type = 'button'; cancel.dataset.ld92Action = 'cancel'; cancel.disabled = state.busy || !state.taskId; actions.appendChild(cancel);
    section.appendChild(actions);
    section.appendChild(el('div', 'ld92-note', 'A aprovação vale somente para este proposalDigest. Se o agente propuser outra escrita, um novo diff e uma nova aprovação serão exigidos.'));
    target.appendChild(section);
  }

  function renderResult(target) {
    const result = state.result?.result;
    if (!result || state.result?.status === 'waiting_approval') return;
    const section = el('section', 'ld92-section'); section.appendChild(el('div', 'ld92-title', 'Resultado'));
    const card = el('div', 'ld92-card'); card.append(el('b', '', text(result.summary, state.result?.status)), el('small', '', text(result.verification, 'Sem verificação adicional informada.'))); section.appendChild(card); target.appendChild(section);
  }

  function render() {
    const target = detail(); if (!target || target.dataset.module !== MODULE_ID) return false;
    ensureStyles(); clear(target); head(target);

    const modes = el('div', 'ld92-modes');
    for (const [mode, label] of [['plan','PLAN · somente leitura'],['build','BUILD · writes aprovados']]) {
      const button = el('button', `ld92-mode${state.mode === mode ? ' active' : ''}`, label); button.type = 'button'; button.dataset.ld92Action = 'mode'; button.dataset.mode = mode; button.disabled = state.busy; modes.appendChild(button);
    }
    target.appendChild(modes);

    const input = el('textarea', 'ld92-input'); input.placeholder = state.mode === 'plan' ? 'Descreva o que você quer planejar…' : 'Descreva a alteração que o agente deve executar…'; input.value = state.command; input.disabled = state.busy || state.phase === 'waiting_approval'; input.dataset.ld92Input = 'true'; target.appendChild(input);

    const actions = el('div', 'ld92-actions');
    const run = el('button', 'ld92-btn', state.mode === 'plan' ? 'Gerar plano' : 'Iniciar Build'); run.type = 'button'; run.dataset.ld92Action = 'run'; run.disabled = state.busy || state.phase === 'waiting_approval'; actions.appendChild(run);
    const reset = el('button', 'ld92-btn secondary', 'Novo comando'); reset.type = 'button'; reset.dataset.ld92Action = 'reset'; reset.disabled = state.busy; actions.appendChild(reset); target.appendChild(actions);

    target.appendChild(el('div', 'ld92-phase', phaseLabel()));
    if (state.error) target.appendChild(el('div', 'ld92-error', state.error));
    renderPlan(target); renderProposal(target); renderResult(target);
    target.appendChild(el('div', 'ld92-note', `Build ${BUILD} · local-first. Sem paid/remote fallback. Anexos entram na Build 93. O Composer nunca chama Tool Runtime WRITE diretamente.`));
    target.style.height = `${Math.min(Math.max(460, target.scrollHeight + 18), innerHeight - 16)}px`;
    return true;
  }

  async function processBuildResult(result) {
    state.result = result || null;
    state.taskId = String(result?.run?.taskId || state.taskId || '');
    state.diff = null;
    if (result?.status === 'waiting_approval' && result?.proposal) {
      state.phase = 'previewing'; render();
      state.diff = await api().previewProposal(result);
      state.phase = 'waiting_approval';
    } else if (result?.status === 'completed') state.phase = 'completed';
    else if (result?.status === 'cancelled') state.phase = 'cancelled';
    else state.phase = result?.status === 'stopped' ? 'stopped' : (result?.status || 'completed');
  }

  async function runCommand() {
    if (state.busy) return;
    const center = api(); if (!center) throw new Error('Canonical Command Composer client não carregado.');
    state.busy = true; state.error = ''; state.result = null; state.diff = null; state.taskId = '';
    try {
      if (state.mode === 'plan') {
        state.phase = 'planning'; render();
        state.result = await center.plan(state.command);
        state.taskId = String(state.result?.run?.taskId || ''); state.phase = 'completed';
      } else {
        state.phase = 'building'; render();
        await processBuildResult(await center.buildCommand(state.command));
      }
    } catch (error) {
      state.phase = 'error'; state.error = `${error?.code || 'ERRO'} · ${error?.message || error}`;
    } finally { state.busy = false; render(); }
  }

  async function approve() {
    if (state.busy || !state.result?.proposal?.digest || !state.taskId) return;
    state.busy = true; state.error = ''; state.phase = 'approving'; render();
    try {
      await processBuildResult(await api().approveWrite(state.taskId, state.result.proposal.digest, { humanDecision: true }));
    } catch (error) {
      state.phase = 'error'; state.error = `${error?.code || 'ERRO'} · ${error?.message || error}`;
    } finally { state.busy = false; render(); }
  }

  async function cancel() {
    if (state.busy || !state.taskId) return;
    state.busy = true; state.error = '';
    try { state.result = await api().cancelTask(state.taskId); state.phase = 'cancelled'; state.diff = null; }
    catch (error) { state.phase = 'error'; state.error = `${error?.code || 'ERRO'} · ${error?.message || error}`; }
    finally { state.busy = false; render(); }
  }

  function reset() {
    if (state.busy) return;
    Object.assign(state, { command:'', phase:'idle', result:null, diff:null, error:'', taskId:'' }); render();
  }

  function openComposer(anchor) {
    if (!showDetail(anchor)) return;
    state.error = ''; render();
  }

  function bind() {
    const shadow = root(); if (!shadow || shadow.__ld92ComposerBound) return false;
    shadow.__ld92ComposerBound = true; ensureStyles(); installRailButton();
    shadow.addEventListener('input', event => {
      const input = event.target.closest?.('[data-ld92-input]'); if (input) state.command = String(input.value || '');
    }, true);
    shadow.addEventListener('click', event => {
      const composerRail = event.target.closest?.('.rail-btn[data-id="command-composer"]');
      if (composerRail) { event.preventDefault(); event.stopImmediatePropagation(); openComposer(composerRail); return; }
      const action = event.target.closest?.('[data-ld92-action]');
      if (!action) return;
      event.preventDefault(); event.stopImmediatePropagation();
      const type = action.dataset.ld92Action;
      if (type === 'mode') { if (!state.busy && state.phase !== 'waiting_approval') { state.mode = action.dataset.mode === 'build' ? 'build' : 'plan'; state.result = null; state.diff = null; state.error = ''; state.phase = 'idle'; render(); } return; }
      if (type === 'run') runCommand();
      else if (type === 'approve') approve();
      else if (type === 'cancel') cancel();
      else if (type === 'reset') reset();
    }, true);
    return true;
  }

  window.LovableDecrypterCanonicalCommandComposer = Object.freeze({
    build: BUILD,
    version: VERSION,
    handles: moduleId => moduleId === MODULE_ID,
    open() {
      const button = root()?.querySelector('.rail-btn[data-id="command-composer"]');
      if (button) openComposer(button);
    }
  });

  if (!bind()) document.addEventListener('DOMContentLoaded', bind, { once: true });
})();
