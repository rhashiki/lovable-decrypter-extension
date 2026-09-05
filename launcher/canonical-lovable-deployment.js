(() => {
  'use strict';
  if (window.__LD100_CANONICAL_LOVABLE_DEPLOYMENT__) return;
  window.__LD100_CANONICAL_LOVABLE_DEPLOYMENT__ = true;

  const BUILD = 100;
  const VERSION = '2.6.100';
  const MODULE_ID = 'lovable-deployment';
  const HOST_ID = 'lovable-decrypter-launcher';
  const NS = 'http://www.w3.org/2000/svg';
  const state = {
    busy: false,
    error: '',
    status: null,
    prepared: null,
    result: null,
    verification: null
  };

  const root = () => document.getElementById(HOST_ID)?.shadowRoot || null;
  const detail = () => root()?.getElementById('detail') || null;
  const api = () => window.LovableDecrypterCanonicalLovableDeploymentApi || null;
  const text = (value, fallback = '—') => {
    const out = String(value ?? '').trim();
    return out || fallback;
  };

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
    const paths = [
      'M12 3v11', 'm8 9-4-4-4 4', 'M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5'
    ];
    for (const d of paths) {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', d);
      p.setAttribute('stroke', 'currentColor');
      p.setAttribute('stroke-width', '1.7');
      p.setAttribute('stroke-linecap', 'round');
      p.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(p);
    }
    return svg;
  }

  function ensureStyles() {
    const shadow = root();
    if (!shadow || shadow.querySelector('style[data-ld100-deploy]')) return;
    const style = document.createElement('style');
    style.dataset.ld100Deploy = 'true';
    style.textContent = `
      #detail .ld100-toolbar{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}
      #detail .ld100-btn{min-height:32px;border:1px solid rgba(59,210,255,.2);border-radius:9px;background:rgba(59,210,255,.08);color:#e8f8ff;padding:6px 10px;font:800 9px Arial,sans-serif;cursor:pointer}
      #detail .ld100-btn.secondary{background:rgba(255,255,255,.018);border-color:rgba(255,255,255,.07);color:#cbd7e7}
      #detail .ld100-btn.warn{background:rgba(255,187,83,.07);border-color:rgba(255,187,83,.22);color:#ffd183}
      #detail .ld100-btn:disabled{opacity:.45;cursor:not-allowed}
      #detail .ld100-card{padding:9px 10px;border:1px solid rgba(255,255,255,.055);border-radius:11px;background:rgba(255,255,255,.015);margin-top:7px}
      #detail .ld100-card b{display:block;font-size:9.5px;line-height:1.45;overflow-wrap:anywhere}
      #detail .ld100-card small{display:block;margin-top:3px;color:#8493aa;font-size:8.3px;line-height:1.45;overflow-wrap:anywhere}
      #detail .ld100-title{margin-top:13px;color:#8391a8;font-size:8px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}
      #detail .ld100-row{margin-top:5px;padding:6px 8px;border-left:2px solid rgba(59,210,255,.16);background:rgba(255,255,255,.012);color:#9dacbf;font-size:8.7px;line-height:1.45;overflow-wrap:anywhere}
      #detail .ld100-badges{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}
      #detail .ld100-badge{padding:4px 7px;border-radius:999px;background:rgba(59,210,255,.08);color:#9ae6ff;font-size:8px;font-weight:800}
      #detail .ld100-badge.ok{background:rgba(62,207,142,.1);color:#7ceab0}
      #detail .ld100-badge.warn{background:rgba(255,187,83,.1);color:#ffd183}
      #detail .ld100-badge.bad{background:rgba(255,103,122,.1);color:#ff9fac}
      #detail .ld100-error{margin-top:9px;padding:8px 9px;border:1px solid rgba(255,103,122,.14);border-radius:9px;background:rgba(255,103,122,.035);color:#ffb2bd;font-size:9px;line-height:1.45}
      #detail .ld100-note{margin-top:9px;color:#7f8da4;font-size:8.7px;line-height:1.5}
      #detail .ld100-live{display:block;margin-top:7px;padding:8px 9px;border-radius:9px;background:rgba(62,207,142,.06);border:1px solid rgba(62,207,142,.15);color:#91efbd;font-size:8.7px;overflow-wrap:anywhere}
    `;
    shadow.appendChild(style);
  }

  function installRailButton() {
    const shadow = root();
    const rail = shadow?.getElementById('railButtons');
    if (!rail || rail.querySelector('[data-id="lovable-deployment"]')) return Boolean(rail);
    const button = el('button', 'rail-btn');
    button.type = 'button';
    button.dataset.kind = 'direct';
    button.dataset.id = MODULE_ID;
    button.setAttribute('aria-label', 'Publish / Deploy');
    button.append(icon(21), el('span', 'tip', 'Publish / Deploy'));
    rail.appendChild(button);
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
    const ar = anchor.getBoundingClientRect();
    const rr = rail?.getBoundingClientRect?.() || ar;
    target.style.left = `${Math.max(8, Math.round(ar.left - 408))}px`;
    target.style.top = `${Math.max(8, Math.min(Math.round(ar.top), innerHeight - 280))}px`;
    target.style.width = '400px';
    target.style.height = `${Math.min(Math.max(480, rr.height || 640), innerHeight - 16)}px`;
    target.style.maxHeight = `${Math.max(300, innerHeight - 16)}px`;
    target.style.overflowY = 'auto';
    return true;
  }

  function badge(value, kind = '') { return el('span', `ld100-badge ${kind}`, value); }
  function shortSha(value) { return String(value || '').slice(0, 10) || '—'; }

  function renderStatus(target) {
    const s = state.status;
    if (!s) return;
    target.appendChild(el('div', 'ld100-title', 'Deployment readiness'));
    const card = el('div', 'ld100-card');
    card.append(
      el('b', '', `Lovable · MCP oficial · ${text(s.target?.projectId, s.target?.projectId || 'projeto não resolvido')}`),
      el('small', '', s.target ? `${text(s.target.github?.fullName)} · ${text(s.target.github?.branch)} · HEAD ${shortSha(s.target.expectedCommitSha)}` : text(s.targetError?.message, 'Project State indisponível'))
    );
    const badges = el('div', 'ld100-badges');
    badges.append(
      badge(s.officialMcpServerConfigured ? 'MCP CONFIGURADO' : 'MCP AUSENTE', s.officialMcpServerConfigured ? 'ok' : 'bad'),
      badge(s.server?.trust === 'approved' ? 'TRUSTED' : 'TRUST PENDENTE', s.server?.trust === 'approved' ? 'ok' : 'warn'),
      badge(s.hostPermission?.granted ? 'HOST OK' : 'HOST PERMISSION', s.hostPermission?.granted ? 'ok' : 'warn'),
      badge(s.projectScope?.ready ? 'PROJECT SCOPE LOCK' : 'SCOPE NÃO CONFIGURADO', s.projectScope?.ready ? 'ok' : 'warn'),
      badge('DEPLOY · ALWAYS ASK', 'warn')
    );
    card.appendChild(badges);
    target.appendChild(card);

    if (!s.officialMcpServerConfigured) target.appendChild(el('div', 'ld100-note', 'Conecte o servidor oficial https://mcp.lovable.dev no MCP Center. O Deployment Adapter não usa endpoint REST privado como fallback.'));
    else if (!s.hostPermission?.granted) target.appendChild(el('div', 'ld100-note', 'A permissão de host e o OAuth do Lovable MCP devem ser concluídos no MCP Center antes do preflight.'));
    else if (!s.projectScope?.ready) target.appendChild(el('div', 'ld100-note', 'O deploy ainda não está habilitado para este projeto. “Aplicar escopo seguro” limita get_project/deploy_project ao project_id atual; a publicação ainda exigirá confirmação humana one-shot.'));
  }

  function renderPrepared(target) {
    const prepared = state.prepared;
    if (!prepared) return;
    const ticket = prepared.ticket || {};
    const p = prepared.preflight || {};
    target.appendChild(el('div', 'ld100-title', 'Publish approval'));
    const card = el('div', 'ld100-card');
    card.append(
      el('b', '', `Versão pronta para publicar · HEAD ${shortSha(ticket.expectedCommitSha)}`),
      el('small', '', `Ticket ${String(ticket.id || '').slice(0, 12)}… · Change Transaction ${String(ticket.transactionId || '').slice(0, 12)}…`)
    );
    const badges = el('div', 'ld100-badges');
    badges.append(badge('PREFLIGHT OK', 'ok'), badge('MCP deploy_project', 'ok'), badge('HUMAN APPROVAL', 'warn'), badge('NO AUTO-RETRY', 'ok'));
    card.appendChild(badges);
    target.appendChild(card);
    target.appendChild(el('div', 'ld100-row', `Git observado pelo Lovable: ${shortSha(p.observedCommitSha)} · esperado: ${shortSha(p.expectedCommitSha)}`));
    if (p.liveUrl) target.appendChild(el('div', 'ld100-row', `Versão atualmente publicada: ${p.liveUrl}`));

    const toolbar = el('div', 'ld100-toolbar');
    const publish = el('button', 'ld100-btn warn', 'Aprovar e publicar agora');
    publish.type = 'button';
    publish.dataset.ld100Action = 'approve-run';
    publish.disabled = state.busy || !ticket.id;
    const cancel = el('button', 'ld100-btn secondary', 'Descartar ticket');
    cancel.type = 'button';
    cancel.dataset.ld100Action = 'discard';
    cancel.disabled = state.busy;
    toolbar.append(publish, cancel);
    target.appendChild(toolbar);
    target.appendChild(el('div', 'ld100-note', 'Este clique aprova somente este deploy_project, para este project_id e este ticket. Nenhuma alteração futura será publicada automaticamente.'));
  }

  function renderResult(target) {
    const result = state.result;
    if (!result) return;
    target.appendChild(el('div', 'ld100-title', 'Deployment result'));
    const card = el('div', 'ld100-card');
    const verified = result.status === 'verified' || result.verification?.verified === true;
    card.append(
      el('b', '', verified ? 'Publicação confirmada' : `Publicação · ${text(result.status).toUpperCase()}`),
      el('small', '', `Operation ${String(result.operationId || '').slice(0, 12) || '—'} · retry automático: BLOQUEADO`)
    );
    const badges = el('div', 'ld100-badges');
    badges.append(badge(verified ? 'VERIFIED' : 'VERIFY REQUIRED', verified ? 'ok' : 'warn'), badge('EXPLICIT DEPLOY', 'ok'));
    card.appendChild(badges);
    target.appendChild(card);
    if (result.liveUrl) target.appendChild(el('div', 'ld100-live', result.liveUrl));
    const toolbar = el('div', 'ld100-toolbar');
    const redeploy = el('button', 'ld100-btn secondary', 'Preparar nova publicação');
    redeploy.type = 'button';
    redeploy.dataset.ld100Action = 'prepare';
    redeploy.disabled = state.busy;
    toolbar.appendChild(redeploy);
    target.appendChild(toolbar);
  }

  function renderVerification(target) {
    const v = state.verification;
    if (!v) return;
    target.appendChild(el('div', 'ld100-title', 'Ambiguous outcome verification'));
    const card = el('div', 'ld100-card');
    card.append(
      el('b', '', v.verified ? 'Resultado atribuído com segurança' : 'Resultado ainda não atribuível'),
      el('small', '', text(v.reason, 'Verificação concluída.'))
    );
    const badges = el('div', 'ld100-badges');
    badges.append(badge(v.liveObserved ? 'LIVE URL OBSERVED' : 'LIVE NÃO OBSERVADO', v.liveObserved ? 'warn' : 'bad'), badge(v.commitMatches ? 'HEAD MATCH' : 'HEAD MISMATCH', v.commitMatches ? 'ok' : 'bad'), badge('NO RETRY', 'ok'));
    card.appendChild(badges);
    target.appendChild(card);
    if (v.liveUrl) target.appendChild(el('div', 'ld100-live', v.liveUrl));
  }

  function render() {
    const target = detail();
    if (!target || target.dataset.module !== MODULE_ID) return false;
    ensureStyles();
    clear(target);
    const head = el('div', 'detail-head');
    head.append(icon(23), el('b', '', 'Publish / Deploy'));
    const st = el('span', 'state', `BUILD ${BUILD} · EXPLICIT`);
    st.dataset.runtime = state.error ? 'offline' : 'online';
    head.appendChild(st);
    target.appendChild(head);

    if (state.error) target.appendChild(el('div', 'ld100-error', state.error));
    renderStatus(target);

    const toolbar = el('div', 'ld100-toolbar');
    const refresh = el('button', 'ld100-btn secondary', 'Atualizar');
    refresh.type = 'button'; refresh.dataset.ld100Action = 'refresh'; refresh.disabled = state.busy;
    toolbar.appendChild(refresh);
    if (state.status?.officialMcpServerConfigured && state.status?.hostPermission?.granted && !state.status?.projectScope?.ready) {
      const scope = el('button', 'ld100-btn secondary', 'Aplicar escopo seguro');
      scope.type = 'button'; scope.dataset.ld100Action = 'scope'; scope.disabled = state.busy;
      toolbar.appendChild(scope);
    }
    if (state.status?.target && state.status?.officialMcpServerConfigured && state.status?.hostPermission?.granted && state.status?.projectScope?.ready && !state.prepared) {
      const prepare = el('button', 'ld100-btn', 'Preparar publicação');
      prepare.type = 'button'; prepare.dataset.ld100Action = 'prepare'; prepare.disabled = state.busy;
      toolbar.appendChild(prepare);
    }
    target.appendChild(toolbar);

    renderPrepared(target);
    renderResult(target);
    renderVerification(target);
    target.appendChild(el('div', 'ld100-note', 'Build 100 · Publish é capacidade DEPLOY explícita. O executor é o MCP oficial do Lovable; deploy_project nunca é AUTO. Rollback não é inventado: o contrato MCP atual não expõe ferramenta de rollback/unpublish para este adapter.'));
    return true;
  }

  async function refresh() {
    state.busy = true;
    state.error = '';
    render();
    try {
      const center = api();
      if (!center) throw Object.assign(new Error('Deployment client não carregado.'), { code: 'LOVABLE_DEPLOY_CLIENT_REQUIRED' });
      state.status = await center.status();
    } catch (error) {
      state.error = `${error?.code || 'LOVABLE_DEPLOY_STATUS_FAILED'} · ${error?.message || error}`;
    } finally {
      state.busy = false;
      render();
    }
  }

  async function configureScope() {
    if (state.busy) return;
    state.busy = true; state.error = ''; render();
    try {
      await api().configureScope();
      state.status = await api().status();
    } catch (error) {
      state.error = `${error?.code || 'LOVABLE_DEPLOY_SCOPE_FAILED'} · ${error?.message || error}`;
    } finally { state.busy = false; render(); }
  }

  async function prepare() {
    if (state.busy) return;
    state.busy = true; state.error = ''; state.prepared = null; state.result = null; state.verification = null; render();
    try {
      state.prepared = await api().prepare();
    } catch (error) {
      state.error = `${error?.code || 'LOVABLE_DEPLOY_PREPARE_FAILED'} · ${error?.message || error}`;
    } finally { state.busy = false; render(); }
  }

  async function approveAndRun() {
    const ticketId = state.prepared?.ticket?.id;
    if (state.busy || !ticketId) return;
    state.busy = true; state.error = ''; render();
    try {
      state.result = await api().approveAndRun(ticketId, { humanDecision: true });
      state.prepared = null;
      state.verification = null;
      state.status = await api().status();
    } catch (error) {
      state.error = `${error?.code || 'LOVABLE_DEPLOY_FAILED'} · ${error?.message || error}`;
      if (error?.verificationRequired === true) {
        try { state.verification = await api().verify(ticketId); } catch (_) {}
      }
    } finally { state.busy = false; render(); }
  }

  function discard() {
    if (state.busy) return;
    state.prepared = null;
    state.error = '';
    render();
  }

  function open(anchor) {
    if (!showDetail(anchor)) return;
    render();
    refresh().catch(() => null);
  }

  function bind() {
    const shadow = root();
    if (!shadow || shadow.__ld100DeploymentBound) return false;
    shadow.__ld100DeploymentBound = true;
    ensureStyles();
    installRailButton();
    shadow.addEventListener('click', event => {
      const rail = event.target.closest?.('.rail-btn[data-id="lovable-deployment"]');
      if (rail) {
        event.preventDefault();
        event.stopImmediatePropagation();
        open(rail);
        return;
      }
      const node = event.target.closest?.('[data-ld100-action]');
      if (!node || detail()?.dataset.module !== MODULE_ID) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const action = node.dataset.ld100Action;
      if (action === 'refresh') refresh();
      else if (action === 'scope') configureScope();
      else if (action === 'prepare') prepare();
      else if (action === 'approve-run') approveAndRun();
      else if (action === 'discard') discard();
    }, true);
    return true;
  }

  window.LovableDecrypterCanonicalLovableDeployment = Object.freeze({
    build: BUILD,
    version: VERSION,
    handles: id => String(id || '') === MODULE_ID,
    open() {
      const button = root()?.querySelector('.rail-btn[data-id="lovable-deployment"]');
      if (button) open(button);
    },
    directDeployWrite: false,
    deployAlwaysAsk: true,
    automaticDeployAfterMutation: false,
    automaticRetry: false,
    privateRestPublishEndpointUsed: false
  });

  if (!bind()) document.addEventListener('DOMContentLoaded', bind, { once: true });
})();
