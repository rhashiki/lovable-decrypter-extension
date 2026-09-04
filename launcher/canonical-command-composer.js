(() => {
  'use strict';

  if (window.__LD95_CANONICAL_COMMAND_COMPOSER__) return;
  window.__LD95_CANONICAL_COMMAND_COMPOSER__ = true;

  const BUILD = 95;
  const VERSION = '2.6.95';
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
    taskId: '',
    dbRecoveryEvidence: '',
    dbDestructiveConfirmed: false,
    dbVerification: null
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
    if (!shadow || shadow.querySelector('style[data-ld95-composer]')) return;
    const style = document.createElement('style'); style.dataset.ld95Composer = 'true';
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
      #detail .ld95-db-check{display:flex;gap:7px;align-items:flex-start;margin-top:9px;color:#c8d5e6;font-size:9px;line-height:1.4}
      #detail .ld95-db-recovery{width:100%;min-height:64px;resize:vertical;margin-top:8px;border:1px solid rgba(255,187,83,.18);border-radius:9px;background:rgba(4,10,20,.35);color:#edf5ff;padding:8px;font:9px/1.45 Arial,sans-serif}
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
      planning: 'Context Engine / Database introspection: gerando plano somente-leitura…',
      building: 'Roteando a capacidade e preparando execução gated…',
      previewing: 'Gerando diff somente-leitura da proposta…',
      waiting_approval: 'Write de código bloqueado. Revise o diff e aprove explicitamente para continuar.',
      waiting_database_approval: 'Write de banco bloqueado. Revise SQL, risco e projeto antes de aprovar.',
      approving: 'Aprovação vinculada ao write exato · validações em andamento…',
      database_running: 'Ticket aprovado. Executando o SQL exato uma única vez…',
      database_ambiguous: 'Resultado do write é ambíguo. Não repita: use Verificar estado.',
      database_verified: 'Estado do banco reinspecionado sem repetir o write.',
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

    if (state.result?.database) {
      const db = state.result.database;
      const dbCard = el('div', 'ld92-card');
      dbCard.append(el('b', '', `Supabase · ${text(db.projectName, db.projectRef)}`), el('small', '', db.explicitSqlRequiredForBuild ? 'PLAN somente-leitura. Para BUILD, forneça SQL explícito.' : 'SQL explícito detectado; nenhuma escrita foi executada no PLAN.'));
      section.appendChild(dbCard);
    }
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

  function renderDatabaseProposal(target) {
    const proposal = state.result?.databaseProposal;
    if (!proposal) return;
    const ticket = proposal.ticket || {};
    const classification = proposal.classification || {};
    const risk = text(ticket.risk || classification.risk, 'DESTRUCTIVE').toUpperCase();
    const destructive = risk === 'DESTRUCTIVE';
    const riskClass = destructive ? 'bad' : (risk === 'CAUTION' ? 'warn' : 'ok');

    const section = el('section', 'ld92-section'); section.appendChild(el('div', 'ld92-title', 'Database · Plan → Review → Run'));
    const card = el('div', 'ld92-card');
    card.append(el('b', '', `Supabase · ${text(proposal.project?.projectName, proposal.project?.projectRef)}`), el('small', '', `Ticket ${String(ticket.id || '').slice(0, 12)}… · expira ${text(ticket.expires_at || ticket.expiresAt, 'em breve')}`));
    const badges = el('div', 'ld92-badges');
    badges.append(el('span', `ld92-badge ${riskClass}`, risk), el('span', 'ld92-badge', 'SQL HASH BOUND'), el('span', 'ld92-badge ok', 'NO AUTO-RETRY'));
    card.appendChild(badges); section.appendChild(card);

    for (const note of (classification.notes || classification.review_notes || []).slice(0, 12)) section.appendChild(el('div', 'ld92-step', note));

    const sqlBox = el('div', 'ld92-diff');
    sqlBox.appendChild(el('div', 'ld92-diff-head', `SQL exato · ${String(proposal.sql || '').length} caracteres`));
    const pre = el('pre'); pre.textContent = String(proposal.sql || ''); sqlBox.appendChild(pre); section.appendChild(sqlBox);

    if (destructive) {
      const label = el('label', 'ld95-db-check');
      const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = state.dbDestructiveConfirmed; checkbox.dataset.ld95DbDestructive = 'true'; checkbox.disabled = state.busy;
      label.append(checkbox, el('span', '', 'Confirmo que revisei esta operação DESTRUCTIVE e quero executá-la neste projeto Supabase.'));
      section.appendChild(label);
      const recovery = el('textarea', 'ld95-db-recovery'); recovery.placeholder = 'Evidência de recuperação/backup (obrigatória para DESTRUCTIVE)…'; recovery.value = state.dbRecoveryEvidence; recovery.dataset.ld95DbRecovery = 'true'; recovery.disabled = state.busy; section.appendChild(recovery);
    }

    const actions = el('div', 'ld92-actions');
    const approve = el('button', `ld92-btn ${destructive ? 'warn' : ''}`, destructive ? 'Aprovar + executar DESTRUCTIVE' : 'Aprovar + executar uma vez');
    approve.type = 'button'; approve.dataset.ld92Action = 'db-approve';
    approve.disabled = state.busy || !ticket.id || (destructive && (!state.dbDestructiveConfirmed || state.dbRecoveryEvidence.trim().length < 8));
    actions.appendChild(approve);
    section.appendChild(actions);
    section.appendChild(el('div', 'ld92-note', 'O backend valida o hash deste SQL e consome o ticket antes do write. Timeout/erro ambíguo nunca dispara retry automático.'));
    target.appendChild(section);
  }

  function renderDatabaseVerification(target) {
    if (!state.dbVerification && state.phase !== 'database_ambiguous') return;
    const section = el('section', 'ld92-section'); section.appendChild(el('div', 'ld92-title', 'Database verification'));
    if (state.dbVerification) {
      const rows = Array.isArray(state.dbVerification.schema) ? state.dbVerification.schema.length : 0;
      const card = el('div', 'ld92-card'); card.append(el('b', '', 'Estado reinspecionado'), el('small', '', `${rows} registro(s) de metadados retornados pela introspecção fixa. O write não foi repetido.`)); section.appendChild(card);
    }
    if (state.phase === 'database_ambiguous') {
      const actions = el('div', 'ld92-actions'); const verify = el('button', 'ld92-btn warn', 'Verificar estado sem repetir write'); verify.type = 'button'; verify.dataset.ld92Action = 'db-verify'; verify.disabled = state.busy; actions.appendChild(verify); section.appendChild(actions);
    }
    target.appendChild(section);
  }

  function renderResult(target) {
    const databaseExecution = state.result?.databaseExecution;
    if (databaseExecution) {
      const section = el('section', 'ld92-section'); section.appendChild(el('div', 'ld92-title', 'Resultado do banco'));
      const card = el('div', 'ld92-card');
      const ticket = databaseExecution.ticket || databaseExecution.approvedTicket || {};
      card.append(el('b', '', `Write ${text(ticket.status || databaseExecution.status, 'applied')}`), el('small', '', `Ticket ${text(ticket.id, '—')} · execução única · sem retry automático`));
      section.appendChild(card); target.appendChild(section);
      return;
    }

    const result = state.result?.result;
    if (!result || state.result?.status === 'waiting_approval') return;
    const section = el('section', 'ld92-section'); section.appendChild(el('div', 'ld92-title', 'Resultado'));
    const card = el('div', 'ld92-card'); card.append(el('b', '', text(result.summary, state.result?.status)), el('small', '', text(result.verification, 'Sem verificação adicional informada.'))); section.appendChild(card); target.appendChild(section);
  }

  function render() {
    const target = detail(); if (!target || target.dataset.module !== MODULE_ID) return false;
    ensureStyles(); clear(target); head(target);

    const pending = state.phase === 'waiting_approval' || state.phase === 'waiting_database_approval' || state.phase === 'database_ambiguous';
    const modes = el('div', 'ld92-modes');
    for (const [mode, label] of [['plan','PLAN · somente leitura'],['build','BUILD · writes aprovados']]) {
      const button = el('button', `ld92-mode${state.mode === mode ? ' active' : ''}`, label); button.type = 'button'; button.dataset.ld92Action = 'mode'; button.dataset.mode = mode; button.disabled = state.busy || pending; modes.appendChild(button);
    }
    target.appendChild(modes);

    const input = el('textarea', 'ld92-input'); input.placeholder = state.mode === 'plan' ? 'Descreva o que você quer planejar…' : 'Código: descreva a alteração. Banco: forneça SQL explícito (SQL: ou bloco ```sql).'; input.value = state.command; input.disabled = state.busy || pending; input.dataset.ld92Input = 'true'; target.appendChild(input);

    const actions = el('div', 'ld92-actions');
    const run = el('button', 'ld92-btn', state.mode === 'plan' ? 'Gerar plano' : 'Iniciar Build'); run.type = 'button'; run.dataset.ld92Action = 'run'; run.disabled = state.busy || pending; actions.appendChild(run);
    const reset = el('button', 'ld92-btn secondary', 'Novo comando'); reset.type = 'button'; reset.dataset.ld92Action = 'reset'; reset.disabled = state.busy; actions.appendChild(reset); target.appendChild(actions);

    target.appendChild(el('div', 'ld92-phase', phaseLabel()));
    if (state.error) target.appendChild(el('div', 'ld92-error', state.error));
    renderPlan(target); renderProposal(target); renderDatabaseProposal(target); renderDatabaseVerification(target); renderResult(target);
    target.appendChild(el('div', 'ld92-note', `Build ${BUILD} · CODE usa Agent/Tool Runtime; DATABASE usa ticket Plan → Review → Run. Sem paid/remote fallback e sem auto-approval.`));
    target.style.height = `${Math.min(Math.max(460, target.scrollHeight + 18), innerHeight - 16)}px`;
    return true;
  }

  async function processBuildResult(result) {
    state.result = result || null;
    state.taskId = String(result?.run?.taskId || state.taskId || '');
    state.diff = null;
    state.dbVerification = null;
    if (result?.status === 'waiting_approval' && result?.proposal) {
      state.phase = 'previewing'; render();
      state.diff = await api().previewProposal(result);
      state.phase = 'waiting_approval';
    } else if (result?.status === 'waiting_database_approval' && result?.databaseProposal) {
      state.phase = 'waiting_database_approval';
    } else if (result?.status === 'completed') state.phase = 'completed';
    else if (result?.status === 'cancelled') state.phase = 'cancelled';
    else state.phase = result?.status === 'stopped' ? 'stopped' : (result?.status || 'completed');
  }

  async function runCommand() {
    if (state.busy) return;
    const center = api(); if (!center) throw new Error('Canonical Command Composer client não carregado.');
    state.busy = true; state.error = ''; state.result = null; state.diff = null; state.taskId = ''; state.dbVerification = null; state.dbRecoveryEvidence = ''; state.dbDestructiveConfirmed = false;
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

  async function approveDatabase() {
    const proposal = state.result?.databaseProposal;
    const ticket = proposal?.ticket || {};
    if (state.busy || !ticket.id || !proposal?.sql) return;
    const destructive = String(ticket.risk || proposal?.classification?.risk || '').toUpperCase() === 'DESTRUCTIVE';
    if (destructive && (!state.dbDestructiveConfirmed || state.dbRecoveryEvidence.trim().length < 8)) return;

    state.busy = true; state.error = ''; state.phase = 'database_running'; render();
    try {
      const execution = await api().approveDatabase(ticket.id, proposal.sql, {
        humanDecision: true,
        destructiveConfirmation: destructive && state.dbDestructiveConfirmed,
        recoveryEvidence: state.dbRecoveryEvidence
      });
      state.result = { ...state.result, status: 'completed', databaseExecution: execution };
      state.phase = 'completed';
    } catch (error) {
      state.error = `${error?.code || 'ERRO'} · ${error?.message || error}`;
      state.phase = error?.verificationRequired || error?.code === 'DATABASE_WRITE_OUTCOME_AMBIGUOUS' ? 'database_ambiguous' : 'error';
    } finally { state.busy = false; render(); }
  }

  async function verifyDatabase() {
    const ticketId = String(state.result?.databaseProposal?.ticket?.id || '');
    if (state.busy || !ticketId) return;
    state.busy = true; state.error = ''; render();
    try {
      state.dbVerification = await api().verifyDatabase(ticketId);
      state.phase = 'database_verified';
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
    Object.assign(state, { command:'', phase:'idle', result:null, diff:null, error:'', taskId:'', dbRecoveryEvidence:'', dbDestructiveConfirmed:false, dbVerification:null }); render();
  }

  function openComposer(anchor) {
    if (!showDetail(anchor)) return;
    state.error = ''; render();
  }

  function bind() {
    const shadow = root(); if (!shadow || shadow.__ld95ComposerBound) return false;
    shadow.__ld95ComposerBound = true; ensureStyles(); installRailButton();
    shadow.addEventListener('input', event => {
      const input = event.target.closest?.('[data-ld92-input]'); if (input) state.command = String(input.value || '');
      const recovery = event.target.closest?.('[data-ld95-db-recovery]'); if (recovery) { state.dbRecoveryEvidence = String(recovery.value || ''); render(); }
    }, true);
    shadow.addEventListener('change', event => {
      const checkbox = event.target.closest?.('[data-ld95-db-destructive]');
      if (checkbox) { state.dbDestructiveConfirmed = checkbox.checked === true; render(); }
    }, true);
    shadow.addEventListener('click', event => {
      const composerRail = event.target.closest?.('.rail-btn[data-id="command-composer"]');
      if (composerRail) { event.preventDefault(); event.stopImmediatePropagation(); openComposer(composerRail); return; }
      const action = event.target.closest?.('[data-ld92-action]');
      if (!action) return;
      event.preventDefault(); event.stopImmediatePropagation();
      const type = action.dataset.ld92Action;
      if (type === 'mode') {
        const pending = state.phase === 'waiting_approval' || state.phase === 'waiting_database_approval' || state.phase === 'database_ambiguous';
        if (!state.busy && !pending) { state.mode = action.dataset.mode === 'build' ? 'build' : 'plan'; state.result = null; state.diff = null; state.error = ''; state.phase = 'idle'; state.dbVerification = null; render(); }
        return;
      }
      if (type === 'run') runCommand();
      else if (type === 'approve') approve();
      else if (type === 'db-approve') approveDatabase();
      else if (type === 'db-verify') verifyDatabase();
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
