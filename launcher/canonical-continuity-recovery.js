(() => {
  'use strict';

  if (window.__LD90_CANONICAL_CONTINUITY_RECOVERY__) return;
  window.__LD90_CANONICAL_CONTINUITY_RECOVERY__ = true;

  const BUILD = 90;
  const VERSION = '2.6.90';
  const HOST_ID = 'lovable-decrypter-launcher';
  const MODULES = new Set(['continuity', 'smart-undo', 'checkpoint']);
  const previews = new Map();

  const text = (value, fallback = '—') => {
    const out = String(value ?? '').trim();
    return out || fallback;
  };
  const root = () => document.getElementById(HOST_ID)?.shadowRoot || null;
  const detail = () => root()?.getElementById('detail') || null;
  const api = () => window.LovableDecrypterCanonicalContinuityRecoveryApi || null;
  function el(tag, className = '', value = '') {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== '') node.textContent = String(value);
    return node;
  }
  function clear(node) { while (node?.firstChild) node.firstChild.remove(); }

  function ensureStyles() {
    const shadow = root();
    if (!shadow || shadow.querySelector('style[data-ld90-recovery]')) return;
    const style = document.createElement('style');
    style.dataset.ld90Recovery = 'true';
    style.textContent = `
      #detail .ld90-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px}
      #detail .ld90-summary div{padding:9px 10px;border:1px solid rgba(255,255,255,.055);border-radius:11px;background:rgba(255,255,255,.016)}
      #detail .ld90-summary small{display:block;color:#7e8ca3;font-size:8px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;margin-bottom:4px}
      #detail .ld90-summary b{display:block;color:#eaf2ff;font-size:10px;overflow-wrap:anywhere}
      #detail .ld90-section{margin-top:13px}
      #detail .ld90-title{display:flex;justify-content:space-between;align-items:center;margin-bottom:7px;color:#8a99b2;font-size:9px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}
      #detail .ld90-list{display:grid;gap:7px}
      #detail .ld90-card{padding:9px 10px;border:1px solid rgba(255,255,255,.055);border-radius:11px;background:rgba(255,255,255,.016)}
      #detail .ld90-head{display:flex;align-items:flex-start;justify-content:space-between;gap:9px}
      #detail .ld90-head b{display:block;color:#edf4ff;font-size:10px;line-height:1.35;overflow-wrap:anywhere}
      #detail .ld90-head small{display:block;color:#8190a8;font-size:8.7px;line-height:1.4;margin-top:3px;overflow-wrap:anywhere}
      #detail .ld90-badges{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}
      #detail .ld90-badge{padding:4px 7px;border-radius:999px;background:rgba(66,210,255,.08);color:#91e3ff;font-size:8px;font-weight:800;white-space:nowrap}
      #detail .ld90-badge.ok{background:rgba(62,207,142,.1);color:#7ceab0}
      #detail .ld90-badge.warn{background:rgba(255,187,83,.1);color:#ffd183}
      #detail .ld90-badge.bad{background:rgba(255,103,122,.1);color:#ff9fac}
      #detail .ld90-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
      #detail .ld90-btn{min-height:31px;border:1px solid rgba(99,222,255,.2);border-radius:9px;background:rgba(99,222,255,.075);color:#e8f8ff;padding:6px 9px;font:700 9px Arial,sans-serif;cursor:pointer}
      #detail .ld90-btn.secondary{background:rgba(255,255,255,.02);border-color:rgba(255,255,255,.075);color:#dce7f8}
      #detail .ld90-btn.warn{border-color:rgba(255,187,83,.18);background:rgba(255,187,83,.06);color:#ffd183}
      #detail .ld90-btn.danger{border-color:rgba(255,103,122,.18);background:rgba(255,103,122,.05);color:#ffabb6}
      #detail .ld90-btn:disabled{opacity:.43;cursor:not-allowed}
      #detail .ld90-note{margin-top:8px;color:#8392aa;font-size:9.2px;line-height:1.45;overflow-wrap:anywhere}
      #detail .ld90-step{margin-top:6px;padding:7px 8px;border-left:2px solid rgba(99,222,255,.18);background:rgba(255,255,255,.012);border-radius:0 8px 8px 0;color:#9cabc0;font-size:8.8px;line-height:1.4}
      #detail .ld90-preview{margin-top:8px;padding:8px;border:1px solid rgba(255,187,83,.12);border-radius:9px;background:rgba(255,187,83,.025)}
      #detail .ld90-status{margin-top:9px;padding:8px 9px;border:1px solid rgba(99,222,255,.09);border-radius:9px;background:rgba(99,222,255,.03);color:#9eb0c8;font-size:9px;line-height:1.4;overflow-wrap:anywhere}
    `;
    shadow.appendChild(style);
  }

  function badge(label, tone = '') { return el('span', `ld90-badge${tone ? ` ${tone}` : ''}`, label); }
  function summaryCard(label, value) { const card = el('div'); card.append(el('small', '', label), el('b', '', text(value))); return card; }
  function section(title, count) { const wrap = el('section', 'ld90-section'); const head = el('div', 'ld90-title'); head.append(el('span', '', title), el('span', '', String(count))); const list = el('div', 'ld90-list'); wrap.append(head, list); return { wrap, list }; }
  function button(label, action, data = {}, tone = 'secondary', disabled = false) {
    const node = el('button', `ld90-btn ${tone}`, label); node.type = 'button'; node.dataset.ld90Action = action;
    for (const [key, value] of Object.entries(data)) node.dataset[key] = String(value);
    node.disabled = disabled; return node;
  }
  function statusLine(target, value) { let node = target.querySelector('.ld90-status'); if (!node) { node = el('div', 'ld90-status'); target.appendChild(node); } node.textContent = String(value || ''); return node; }
  function cardHead(title, subtitle, badgeNode) { const head = el('div', 'ld90-head'); const copy = el('div'); copy.append(el('b', '', title), el('small', '', subtitle)); head.append(copy, badgeNode); return head; }

  function buildHead(target) {
    const icon = target.querySelector('.detail-head svg')?.cloneNode(true) || null;
    clear(target);
    const head = el('div', 'detail-head'); if (icon) head.appendChild(icon); head.appendChild(el('b', '', 'Continuity + Recovery'));
    const state = el('span', 'state', 'FAIL CLOSED'); state.dataset.runtime = 'online'; head.appendChild(state); target.appendChild(head);
  }

  function renderTask(task) {
    const card = el('article', 'ld90-card');
    const status = String(task?.status || 'unknown').toLowerCase();
    const tone = status === 'completed' ? 'ok' : ['verification_required','interrupted'].includes(status) ? 'warn' : ['failed','cancelled'].includes(status) ? 'bad' : '';
    card.appendChild(cardHead(text(task?.id, 'task'), `${text(task?.repo)} · ${text(task?.branch)} · resume ${Number(task?.resumeCount || 0)}`, badge(status.toUpperCase(), tone)));
    const tags = el('div', 'ld90-badges');
    tags.append(
      badge(`${Number(task?.steps?.length || 0)} STEPS`),
      badge(`${Number(task?.checkpoints?.length || 0)} CHECKPOINTS`, task?.checkpoints?.length ? 'ok' : ''),
      badge(`${Number(task?.verificationRequired?.length || 0)} VERIFY`, task?.verificationRequired?.length ? 'warn' : 'ok')
    );
    card.appendChild(tags);

    for (const step of task?.steps || []) {
      if (!['interrupted','verification_required','failed'].includes(String(step?.status || '')) && !step?.checkpoint) continue;
      const note = el('div', 'ld90-step', `${text(step?.label, step?.idempotencyKey)} · ${text(step?.mode).toUpperCase()} · ${text(step?.status).toUpperCase()} · tentativa ${Number(step?.attempts || 0)}/${Number(step?.maxAttempts || 0)}${step?.checkpoint ? ` · checkpoint ${text(step.checkpoint.type, step.checkpointId)}` : ''}${step?.lastErrorCode ? ` · ${step.lastErrorCode}` : ''}`);
      card.appendChild(note);
    }

    const actions = el('div', 'ld90-actions');
    for (const step of task?.verificationRequired || []) {
      if (step?.mode === 'write') actions.appendChild(button('Verificar write', 'verify-write', { taskId: task.id, stepId: step.id || step.idempotencyKey }, 'warn'));
    }
    if (task?.canResume) actions.appendChild(button('Retomar tarefa', 'resume-task', { taskId: task.id }, ''));
    if (task?.canCancel) actions.appendChild(button('Cancelar', 'cancel-task', { taskId: task.id }, 'danger'));
    if (actions.childElementCount) card.appendChild(actions);
    if (task?.verificationRequired?.length) card.appendChild(el('div', 'ld90-note', 'Retomada bloqueada até a verificação do resultado ambíguo. Nenhum write é repetido automaticamente.'));
    return card;
  }

  function renderPreview(operationId) {
    const preview = previews.get(operationId);
    if (!preview) return null;
    const plan = preview?.plan || {};
    const wrap = el('div', 'ld90-preview');
    const tags = el('div', 'ld90-badges');
    tags.append(
      badge(text(plan?.direction, 'preview').toUpperCase()),
      badge(text(plan?.strategy, 'preserve').toUpperCase(), 'ok'),
      badge(plan?.allowed === true ? 'ALLOWED' : 'BLOCKED', plan?.allowed === true ? 'ok' : 'bad'),
      badge(plan?.destructive === true ? 'DESTRUCTIVE' : 'NON-DESTRUCTIVE', plan?.destructive === true ? 'warn' : 'ok')
    );
    wrap.appendChild(tags);
    wrap.appendChild(el('div', 'ld90-note', `${Number(plan?.changes?.length || 0)} mudança(s) · ${Number(plan?.conflicts?.length || 0)} conflito(s) · preview expira em ${text(preview?.expiresAt)}.`));
    for (const conflict of (plan?.conflicts || []).slice(0, 5)) wrap.appendChild(el('div', 'ld90-step', `${text(conflict?.path)} · ${text(conflict?.message, conflict?.code)}`));
    if (plan?.allowed === true && preview?.previewId) {
      const actions = el('div', 'ld90-actions');
      actions.appendChild(button(plan?.destructive === true ? 'Confirmar reversão destrutiva' : 'Aplicar reversão', 'apply-reversal', { operationId, previewId: preview.previewId, destructive: String(plan?.destructive === true) }, plan?.destructive === true ? 'warn' : ''));
      wrap.appendChild(actions);
    }
    return wrap;
  }

  function renderOperation(operation) {
    const card = el('article', 'ld90-card');
    card.appendChild(cardHead(text(operation?.tool, 'write operation'), `${text(operation?.commitSha).slice(0, 12)} · ${text(operation?.finishedAt)}`, badge(operation?.canRedo ? 'UNDONE' : 'APPLIED', operation?.canRedo ? 'warn' : 'ok')));
    const tags = el('div', 'ld90-badges');
    tags.append(badge(`${Number(operation?.paths?.length || 0)} PATHS`), badge('PRESERVE USER EDITS', 'ok'));
    card.appendChild(tags);
    const actions = el('div', 'ld90-actions');
    if (operation?.canUndo) actions.appendChild(button('Preview Undo', 'preview-undo', { operationId: operation.id }, ''));
    if (operation?.canRedo) actions.appendChild(button('Preview Redo', 'preview-redo', { operationId: operation.id }, ''));
    if (actions.childElementCount) card.appendChild(actions);
    const preview = renderPreview(operation.id); if (preview) card.appendChild(preview);
    return card;
  }

  async function render() {
    const target = detail(); if (!target || !MODULES.has(target.dataset.module)) return false;
    ensureStyles(); const center = api(); if (!center?.snapshot) throw new Error('Canonical Continuity + Recovery client não carregado.');
    const prior = target.querySelector('.state'); if (prior) { prior.textContent = 'VERIFICANDO'; prior.dataset.runtime = 'checking'; }
    const snapshot = await center.snapshot(); if (!target.isConnected || !MODULES.has(target.dataset.module)) return false;
    buildHead(target);

    const summary = el('div', 'ld90-summary');
    summary.append(
      summaryCard('Tarefas', String(snapshot.tasks?.length || 0)),
      summaryCard('Requer atenção', String(snapshot.attentionCount || 0)),
      summaryCard('Verificações de write', String(snapshot.verificationRequiredCount || 0)),
      summaryCard('Checkpoints', String(snapshot.checkpointCount || 0))
    );
    target.appendChild(summary);

    const recovery = section('Recovery Doctor canônico', 1);
    const doctor = el('article', 'ld90-card');
    doctor.appendChild(cardHead('Lease / write recovery', 'Operation Journal + pre-write HEAD verification', badge('SAFE RECOVERY', 'ok')));
    doctor.appendChild(el('div', 'ld90-note', 'Leases expirados podem ser recuperados. Writes ambíguos permanecem bloqueados até confirmação por Journal ou comparação do HEAD anterior ao write.'));
    const doctorActions = el('div', 'ld90-actions'); doctorActions.appendChild(button('Recuperar leases expirados', 'recover-leases', {}, '')); doctor.appendChild(doctorActions); recovery.list.appendChild(doctor); target.appendChild(recovery.wrap);

    const tasks = section('Continuity tasks', snapshot.tasks?.length || 0);
    for (const task of snapshot.tasks || []) tasks.list.appendChild(renderTask(task));
    if (!snapshot.tasks?.length) tasks.list.appendChild(el('div', 'ld90-note', 'Nenhuma tarefa de continuidade registrada para este projeto.'));
    target.appendChild(tasks.wrap);

    const reversals = section('Smart Undo / Redo', snapshot.operations?.length || 0);
    for (const operation of snapshot.operations || []) reversals.list.appendChild(renderOperation(operation));
    if (!snapshot.operations?.length) reversals.list.appendChild(el('div', 'ld90-note', 'Nenhuma operação Git reversível encontrada.'));
    target.appendChild(reversals.wrap);

    const actions = el('div', 'ld90-actions'); actions.appendChild(button('Atualizar', 'refresh')); target.appendChild(actions);
    target.appendChild(el('div', 'ld90-note', `Build ${BUILD} · estratégia padrão de reversão: preserve. Cascade destrutivo não é exposto. Retry de write sem verificação não existe.`));
    target.dataset.ld90Canonical = 'true'; return true;
  }

  async function act(action, node) {
    const center = api(); const target = detail(); if (!center || !target) return;
    if (action === 'refresh') { await render(); return; }
    if (action === 'recover-leases') { statusLine(target, 'Recuperando leases expirados…'); const result = await center.recoverExpiredLeases(); statusLine(target, `Recovery concluído · ${Number(result?.recovered?.length || 0)} step(s) · ${Number(result?.taskCount || 0)} tarefa(s).`); await render(); return; }
    if (action === 'verify-write') { statusLine(target, 'Verificando resultado do write pelo Journal/HEAD…'); const result = await center.verifyWrite(node.dataset.taskId || '', node.dataset.stepId || ''); statusLine(target, `Verificação concluída · ${text(result?.action, result?.verified ? 'verified' : 'not verified')}.`); await render(); return; }
    if (action === 'resume-task') { statusLine(target, 'Retomando somente steps seguros…'); await center.resumeTask(node.dataset.taskId || ''); await render(); return; }
    if (action === 'cancel-task') { await center.cancelTask(node.dataset.taskId || ''); await render(); return; }
    if (action === 'preview-undo' || action === 'preview-redo') {
      const operationId = node.dataset.operationId || ''; statusLine(target, 'Calculando preview de reversão preservando edições humanas…');
      previews.set(operationId, action === 'preview-undo' ? await center.previewUndo(operationId) : await center.previewRedo(operationId)); await render(); return;
    }
    if (action === 'apply-reversal') {
      const operationId = node.dataset.operationId || ''; const destructive = node.dataset.destructive === 'true';
      statusLine(target, destructive ? 'Aplicando reversão destrutiva explicitamente confirmada…' : 'Aplicando reversão validada…');
      await center.applyReversal(node.dataset.previewId || '', { confirmDestructive: destructive }); previews.delete(operationId); await render(); return;
    }
    throw new Error(`Ação de Continuity + Recovery desconhecida: ${action}`);
  }

  function bind() {
    const shadow = root(); if (!shadow || shadow.__ld90RecoveryBound) return false; shadow.__ld90RecoveryBound = true; ensureStyles();
    shadow.addEventListener('click', event => {
      const actionNode = event.target.closest?.('[data-ld90-action]');
      if (actionNode) {
        event.preventDefault(); event.stopImmediatePropagation();
        act(actionNode.dataset.ld90Action || '', actionNode).catch(error => statusLine(detail(), `${error?.code || 'ERRO'} · ${error?.message || error}`)); return;
      }
      const module = event.target.closest?.('.fly-item')?.dataset?.item || (event.target.closest?.('.rail-btn')?.dataset?.kind === 'direct' ? event.target.closest('.rail-btn')?.dataset?.id : '');
      if (MODULES.has(module)) queueMicrotask(() => render().catch(error => statusLine(detail(), `${error?.code || 'ERRO'} · ${error?.message || error}`)));
    }, true);
    return true;
  }

  window.LovableDecrypterCanonicalContinuityRecovery = Object.freeze({
    build: BUILD,
    version: VERSION,
    handles: moduleId => MODULES.has(moduleId),
    render
  });

  if (!bind()) document.addEventListener('DOMContentLoaded', bind, { once: true });
})();
