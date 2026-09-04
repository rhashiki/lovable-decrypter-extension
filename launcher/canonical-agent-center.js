(() => {
  'use strict';

  if (window.__LD89_CANONICAL_AGENT_CENTER__) return;
  window.__LD89_CANONICAL_AGENT_CENTER__ = true;

  const BUILD = 89;
  const VERSION = '2.6.89';
  const HOST_ID = 'lovable-decrypter-launcher';
  const MODULES = new Set(['local-agent', 'agent-sandbox']);
  const probes = new Map();

  const text = (value, fallback = '—') => {
    const out = String(value ?? '').trim();
    return out || fallback;
  };
  function root() { return document.getElementById(HOST_ID)?.shadowRoot || null; }
  function detail() { return root()?.getElementById('detail') || null; }
  function api() { return window.LovableDecrypterCanonicalAgentApi || null; }
  function el(tag, className = '', value = '') {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== '') node.textContent = String(value);
    return node;
  }
  function clear(node) { while (node?.firstChild) node.firstChild.remove(); }

  function ensureStyles() {
    const shadow = root();
    if (!shadow || shadow.querySelector('style[data-ld89-agent]')) return;
    const style = document.createElement('style');
    style.dataset.ld89Agent = 'true';
    style.textContent = `
      #detail .ld89-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px}
      #detail .ld89-summary div{padding:9px 10px;border:1px solid rgba(255,255,255,.055);border-radius:11px;background:rgba(255,255,255,.016)}
      #detail .ld89-summary small{display:block;color:#7e8ca3;font-size:8px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;margin-bottom:4px}
      #detail .ld89-summary b{display:block;color:#eaf2ff;font-size:10px;overflow-wrap:anywhere}
      #detail .ld89-section{margin-top:13px}
      #detail .ld89-title{display:flex;justify-content:space-between;align-items:center;margin-bottom:7px;color:#8a99b2;font-size:9px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}
      #detail .ld89-list{display:grid;gap:7px}
      #detail .ld89-card{padding:9px 10px;border:1px solid rgba(255,255,255,.055);border-radius:11px;background:rgba(255,255,255,.016)}
      #detail .ld89-head{display:flex;align-items:flex-start;justify-content:space-between;gap:9px}
      #detail .ld89-head b{display:block;color:#edf4ff;font-size:10px;line-height:1.35;overflow-wrap:anywhere}
      #detail .ld89-head small{display:block;color:#8190a8;font-size:8.7px;line-height:1.4;margin-top:3px;overflow-wrap:anywhere}
      #detail .ld89-badges{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}
      #detail .ld89-badge{padding:4px 7px;border-radius:999px;background:rgba(66,210,255,.08);color:#91e3ff;font-size:8px;font-weight:800;white-space:nowrap}
      #detail .ld89-badge.ok{background:rgba(62,207,142,.1);color:#7ceab0}
      #detail .ld89-badge.warn{background:rgba(255,187,83,.1);color:#ffd183}
      #detail .ld89-badge.bad{background:rgba(255,103,122,.1);color:#ff9fac}
      #detail .ld89-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
      #detail .ld89-btn{min-height:31px;border:1px solid rgba(99,222,255,.2);border-radius:9px;background:rgba(99,222,255,.075);color:#e8f8ff;padding:6px 9px;font:700 9px Arial,sans-serif;cursor:pointer}
      #detail .ld89-btn.secondary{background:rgba(255,255,255,.02);border-color:rgba(255,255,255,.075);color:#dce7f8}
      #detail .ld89-btn.danger{border-color:rgba(255,103,122,.18);background:rgba(255,103,122,.05);color:#ffabb6}
      #detail .ld89-btn:disabled{opacity:.43;cursor:not-allowed}
      #detail .ld89-note{margin-top:9px;color:#8392aa;font-size:9.3px;line-height:1.45;overflow-wrap:anywhere}
      #detail .ld89-status{margin-top:9px;padding:8px 9px;border:1px solid rgba(99,222,255,.09);border-radius:9px;background:rgba(99,222,255,.03);color:#9eb0c8;font-size:9px;line-height:1.4;overflow-wrap:anywhere}
    `;
    shadow.appendChild(style);
  }

  function badge(label, tone = '') { return el('span', `ld89-badge${tone ? ` ${tone}` : ''}`, label); }
  function summaryCard(label, value) {
    const card = el('div'); card.append(el('small', '', label), el('b', '', text(value))); return card;
  }
  function section(title, count) {
    const wrap = el('section', 'ld89-section');
    const head = el('div', 'ld89-title'); head.append(el('span', '', title), el('span', '', String(count)));
    const list = el('div', 'ld89-list'); wrap.append(head, list); return { wrap, list };
  }
  function button(label, action, data = {}, tone = 'secondary', disabled = false) {
    const node = el('button', `ld89-btn ${tone}`, label); node.type = 'button'; node.dataset.ld89Action = action;
    for (const [key, value] of Object.entries(data)) node.dataset[key] = String(value);
    node.disabled = disabled; return node;
  }
  function statusLine(target, value) {
    let node = target.querySelector('.ld89-status');
    if (!node) { node = el('div', 'ld89-status'); target.appendChild(node); }
    node.textContent = String(value || ''); return node;
  }
  function buildHead(target) {
    const icon = target.querySelector('.detail-head svg')?.cloneNode(true) || null; clear(target);
    const head = el('div', 'detail-head'); if (icon) head.appendChild(icon); head.appendChild(el('b', '', 'Agent Center'));
    const state = el('span', 'state', 'PROPOSAL ONLY'); state.dataset.runtime = 'online'; head.appendChild(state); target.appendChild(head);
  }
  function cardHead(title, subtitle, badgeNode) {
    const head = el('div', 'ld89-head'); const copy = el('div'); copy.append(el('b', '', title), el('small', '', subtitle)); head.append(copy, badgeNode); return head;
  }

  function renderRuntime(runtime) {
    const card = el('article', 'ld89-card');
    const probe = probes.get(runtime.id);
    const availability = probe ? probe.available === true : null;
    card.appendChild(cardHead(text(runtime.label || runtime.id), `${text(runtime.id)} · ${text(runtime.sessionEndpoint, 'sem endpoint')}`, badge(
      availability === true ? 'AVAILABLE' : availability === false ? text(probe.code, 'UNAVAILABLE') : 'NOT PROBED',
      availability === true ? 'ok' : availability === false ? 'warn' : ''
    )));
    const tags = el('div', 'ld89-badges');
    tags.append(
      badge('PROPOSAL ONLY', 'ok'),
      badge(runtime.sessionAuthConfigured ? 'SESSION AUTH' : 'NO AUTH'),
      badge(runtime.writeAuthority ? 'WRITE AUTHORITY' : 'NO WRITE AUTHORITY', runtime.writeAuthority ? 'bad' : 'ok')
    );
    card.appendChild(tags);
    const actions = el('div', 'ld89-actions');
    actions.appendChild(button('Probe', 'probe-runtime', { runtimeId: runtime.id }, ''));
    if (probe?.code === 'AGENT_RUNTIME_HOST_PERMISSION_REQUIRED') actions.appendChild(button('Permitir host', 'runtime-permission', { runtimeId: runtime.id, endpoint: runtime.sessionEndpoint }, ''));
    card.appendChild(actions);
    if (probe) card.appendChild(el('div', 'ld89-note', `Probe: ${text(probe.code, probe.available ? 'OK' : 'indisponível')} · versão ${text(probe.version)} · endpoint ${text(probe.endpoint, runtime.sessionEndpoint)}`));
    return card;
  }

  function renderRun(run) {
    const card = el('article', 'ld89-card');
    const active = !['completed','cancelled','failed'].includes(String(run.status || '').toLowerCase());
    card.appendChild(cardHead(text(run.taskId, 'task'), `${text(run.repo)} · ${text(run.branch)} · ${text(run.lastAction, 'sem ação')}`, badge(text(run.status).toUpperCase(), active ? 'warn' : run.status === 'completed' ? 'ok' : 'bad')));
    const tags = el('div', 'ld89-badges'); tags.append(badge(`ITER ${Number(run.iteration || 0)}/${Number(run.maxIterations || 0)}`), badge(run.pendingWriteDigest ? 'WRITE PENDING' : 'NO PENDING WRITE', run.pendingWriteDigest ? 'warn' : 'ok'));
    card.appendChild(tags);
    if (active) { const actions = el('div', 'ld89-actions'); actions.appendChild(button('Cancelar tarefa', 'cancel-task', { taskId: run.taskId }, 'danger')); card.appendChild(actions); }
    return card;
  }

  function renderSkill(skill) {
    const card = el('article', 'ld89-card');
    card.appendChild(cardHead(text(skill.displayName || skill.slug), text(skill.description, skill.slug), badge(skill.enabled ? 'ENABLED' : 'DISABLED', skill.enabled ? 'ok' : 'warn')));
    const tags = el('div', 'ld89-badges');
    tags.append(badge(skill.official ? 'OFFICIAL' : skill.custom ? 'CUSTOM' : 'IMPORTED'), badge(skill.pinned ? 'PINNED' : 'NOT PINNED'), badge('NO WRITE AUTHORITY', 'ok'));
    card.appendChild(tags);
    const actions = el('div', 'ld89-actions');
    actions.append(
      button(skill.enabled ? 'Desabilitar' : 'Habilitar', 'skill-toggle', { slug: skill.slug, enabled: String(!skill.enabled) }, skill.enabled ? 'danger' : ''),
      button(skill.pinned ? 'Desafixar' : 'Fixar', 'skill-pin', { slug: skill.slug, pinned: String(!skill.pinned) })
    );
    card.appendChild(actions); return card;
  }

  function renderSession(session) {
    const card = el('article', 'ld89-card');
    card.appendChild(cardHead(text(session.id, 'session'), `${text(session.runtimeId)} · task ${text(session.taskId)}`, badge(text(session.status, 'ACTIVE').toUpperCase())));
    const tags = el('div', 'ld89-badges');
    tags.append(badge(`GEN ${Number(session.generation || 0)}`), badge('NO REPLAY AUTHORITY', 'ok'), badge('NO WRITE AUTHORITY', 'ok'));
    card.appendChild(tags);
    if (String(session.status || '').toLowerCase() !== 'closed') { const actions = el('div', 'ld89-actions'); actions.appendChild(button('Fechar sessão', 'close-session', { sessionId: session.id }, 'danger')); card.appendChild(actions); }
    return card;
  }

  async function render() {
    const target = detail(); if (!target || !MODULES.has(target.dataset.module)) return false;
    ensureStyles(); const center = api(); if (!center?.snapshot) throw new Error('Canonical Agent Center client não carregado.');
    const prior = target.querySelector('.state'); if (prior) { prior.textContent = 'VERIFICANDO'; prior.dataset.runtime = 'checking'; }
    const snapshot = await center.snapshot(); if (!target.isConnected || !MODULES.has(target.dataset.module)) return false;
    buildHead(target);

    const summary = el('div', 'ld89-summary');
    summary.append(
      summaryCard('Local Agent', snapshot.localAgent?.runtime?.ok === true ? 'Ready' : text(snapshot.localAgent?.runtime?.code, 'Unavailable')),
      summaryCard('Runtimes', String(snapshot.registry?.runtimeCount || 0)),
      summaryCard('Skills', String(snapshot.skills?.all?.length || 0)),
      summaryCard('Sandbox / Sessions', `${Number(snapshot.sandbox?.count || 0)} / ${Number(snapshot.sessions?.status?.sessionCount || 0)}`)
    );
    target.appendChild(summary);

    const runtimes = section('Agent Runtime Registry', snapshot.registry?.runtimes?.length || 0);
    for (const runtime of snapshot.registry?.runtimes || []) runtimes.list.appendChild(renderRuntime(runtime));
    target.appendChild(runtimes.wrap);

    const runs = section('Tarefas do agente local', snapshot.runs?.length || 0);
    for (const run of snapshot.runs || []) runs.list.appendChild(renderRun(run));
    if (!snapshot.runs?.length) runs.list.appendChild(el('div', 'ld89-note', 'Nenhuma tarefa local registrada para este projeto. O envio de comandos entra na Build 92.'));
    target.appendChild(runs.wrap);

    const skillSection = section('Portable Skills', snapshot.skills?.all?.length || 0);
    for (const skill of snapshot.skills?.all || []) skillSection.list.appendChild(renderSkill(skill));
    if (!snapshot.skills?.all?.length) skillSection.list.appendChild(el('div', 'ld89-note', 'Nenhuma skill registrada. Skills são contexto técnico e nunca expandem a intenção do usuário.'));
    target.appendChild(skillSection.wrap);

    const sessionSection = section('Native Sessions', snapshot.sessions?.all?.length || 0);
    for (const session of snapshot.sessions?.all || []) sessionSection.list.appendChild(renderSession(session));
    if (!snapshot.sessions?.all?.length) sessionSection.list.appendChild(el('div', 'ld89-note', 'Nenhuma sessão nativa ativa.'));
    target.appendChild(sessionSection.wrap);

    const sandboxSection = section('Agent Sandbox', Number(snapshot.sandbox?.count || 0));
    sandboxSection.list.appendChild(el('div', 'ld89-note', `Worktree físico: ${text(snapshot.sandbox?.physicalWorktree)} · storage ${text(snapshot.sandbox?.storage)} · raw file content persisted: ${snapshot.sandbox?.rawFileContentPersisted === true ? 'sim' : 'não'} · write authority: ${snapshot.sandbox?.writeAuthority === true ? 'sim' : 'não'}.`));
    target.appendChild(sandboxSection.wrap);

    const actions = el('div', 'ld89-actions'); actions.appendChild(button('Atualizar', 'refresh')); target.appendChild(actions);
    target.appendChild(el('div', 'ld89-note', 'Agent Center é controle/observabilidade. Ele não inicia prompts, não aprova writes, não troca runtime silenciosamente e não concede autoridade de escrita a agentes externos.'));
    target.dataset.ld89Canonical = 'true'; return true;
  }

  async function act(action, node) {
    const center = api(); const target = detail(); if (!center || !target) return;
    if (action === 'refresh') { await render(); return; }
    if (action === 'probe-runtime') { statusLine(target, 'Verificando runtime…'); const runtimeId = node.dataset.runtimeId || ''; probes.set(runtimeId, await center.probeRuntime(runtimeId)); await render(); return; }
    if (action === 'runtime-permission') { await center.requestRuntimePermission(node.dataset.runtimeId || '', node.dataset.endpoint || ''); probes.set(node.dataset.runtimeId || '', await center.probeRuntime(node.dataset.runtimeId || '')); await render(); return; }
    if (action === 'skill-toggle') { await center.setSkillEnabled(node.dataset.slug || '', node.dataset.enabled === 'true'); await render(); return; }
    if (action === 'skill-pin') { await center.setSkillPinned(node.dataset.slug || '', node.dataset.pinned === 'true'); await render(); return; }
    if (action === 'cancel-task') { await center.cancelLocalTask(node.dataset.taskId || ''); await render(); return; }
    if (action === 'close-session') { await center.closeSession(node.dataset.sessionId || ''); await render(); return; }
    throw new Error(`Ação do Agent Center desconhecida: ${action}`);
  }

  function bind() {
    const shadow = root(); if (!shadow || shadow.__ld89AgentBound) return false; shadow.__ld89AgentBound = true; ensureStyles();
    shadow.addEventListener('pointerover', event => { const item = event.target.closest?.('.fly-item'); if (MODULES.has(item?.dataset?.item)) queueMicrotask(() => render().catch(() => {})); });
    shadow.addEventListener('click', event => {
      const actionNode = event.target.closest?.('[data-ld89-action]');
      if (actionNode) {
        event.preventDefault(); event.stopPropagation(); actionNode.disabled = true;
        act(actionNode.dataset.ld89Action || '', actionNode).catch(error => { const target = detail(); if (target && MODULES.has(target.dataset.module)) statusLine(target, error?.message || String(error)); }).finally(() => { if (actionNode.isConnected) actionNode.disabled = false; }); return;
      }
      const item = event.target.closest?.('.fly-item'); if (MODULES.has(item?.dataset?.item)) queueMicrotask(() => render().catch(() => {}));
    });
    window.LovableDecrypterCanonicalAgentCenter = Object.freeze({ build: BUILD, version: VERSION, handles: id => MODULES.has(String(id || '')), render });
    document.getElementById(HOST_ID)?.setAttribute('data-ld-agent-center', 'canonical-v89'); return true;
  }

  if (!bind()) document.addEventListener('DOMContentLoaded', bind, { once: true });
})();
