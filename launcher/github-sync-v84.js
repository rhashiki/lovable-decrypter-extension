(() => {
  'use strict';
  if (window.__LD84_GITHUB_SYNC__) return;
  window.__LD84_GITHUB_SYNC__ = true;

  const HOST_ID = 'lovable-decrypter-launcher';
  const MODAL_ID = 'ld84-github-sync-modal';

  function send(message) {
    return new Promise(resolve => {
      try {
        chrome.runtime.sendMessage(message, response => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false, code: 'RUNTIME_MESSAGE_FAILED', message: chrome.runtime.lastError.message });
            return;
          }
          resolve(response || { ok: false, code: 'EMPTY_RUNTIME_RESPONSE' });
        });
      } catch (error) {
        resolve({ ok: false, code: 'RUNTIME_MESSAGE_FAILED', message: error?.message || String(error) });
      }
    });
  }

  function styles() {
    return `
      #${MODAL_ID}{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:24px;background:rgba(3,7,16,.56);backdrop-filter:blur(10px);pointer-events:auto;font-family:Arial,sans-serif;color:#f3f7ff}
      #${MODAL_ID} .ghs-card{width:min(720px,calc(100vw - 32px));max-height:min(820px,calc(100vh - 32px));overflow:auto;border:1px solid rgba(255,255,255,.10);border-radius:24px;background:linear-gradient(180deg,rgba(20,31,54,.985),rgba(9,16,30,.995));box-shadow:0 28px 90px rgba(0,0,0,.46);padding:22px}
      #${MODAL_ID} .ghs-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:16px}
      #${MODAL_ID} h2{font:700 20px/1.25 Arial,sans-serif;margin:0;color:#fff}
      #${MODAL_ID} .ghs-sub{margin-top:5px;color:#9aa7bf;font:12px/1.45 Arial,sans-serif}
      #${MODAL_ID} .ghs-close{width:36px;height:36px;border-radius:12px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.05);color:#dce7fb;cursor:pointer;font:22px/1 Arial,sans-serif}
      #${MODAL_ID} .ghs-status{padding:12px 13px;border-radius:13px;background:rgba(59,210,255,.07);border:1px solid rgba(59,210,255,.16);color:#dcecff;font:12px/1.45 Arial,sans-serif;margin-bottom:14px}
      #${MODAL_ID} .ghs-policy{padding:11px 12px;border-radius:12px;background:rgba(67,216,142,.06);border:1px solid rgba(67,216,142,.16);color:#a9d9bf;font:11px/1.5 Arial,sans-serif;margin-bottom:14px}
      #${MODAL_ID} .ghs-grid{display:grid;grid-template-columns:130px 1fr;gap:8px 12px;padding:4px 0 10px}
      #${MODAL_ID} .ghs-key{color:#8291ad;font:11px/1.4 Arial,sans-serif}.ghs-value{color:#f1f6ff;font:12px/1.4 Arial,sans-serif;overflow-wrap:anywhere}
      #${MODAL_ID} .ghs-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
      #${MODAL_ID} .ghs-btn{min-height:38px;padding:0 13px;border-radius:11px;border:1px solid rgba(59,210,255,.20);background:rgba(59,210,255,.10);color:#e9f8ff;cursor:pointer;font:600 12px Arial,sans-serif}
      #${MODAL_ID} .ghs-btn.secondary{border-color:rgba(255,255,255,.10);background:rgba(255,255,255,.05);color:#cbd7eb}
      #${MODAL_ID} .ghs-btn:disabled{opacity:.55;cursor:default}
      #${MODAL_ID} .ghs-section{margin-top:18px;padding-top:15px;border-top:1px solid rgba(255,255,255,.07)}
      #${MODAL_ID} .ghs-section h3{margin:0 0 10px;font:700 13px Arial,sans-serif;color:#dce8fa}
      #${MODAL_ID} .ghs-list{display:grid;gap:7px}
      #${MODAL_ID} .ghs-commit{padding:10px 11px;border-radius:12px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.06)}
      #${MODAL_ID} .ghs-commit-top{display:flex;justify-content:space-between;gap:14px;color:#eef5ff;font:11px/1.4 Arial,sans-serif}.ghs-sha{font-family:monospace;color:#72ddff}.ghs-meta{margin-top:4px;color:#8191aa;font:10px/1.4 Arial,sans-serif}
      #${MODAL_ID} .ghs-compare{display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:end}
      #${MODAL_ID} label{display:grid;gap:5px;color:#8fa0b9;font:10px Arial,sans-serif}#${MODAL_ID} select{height:38px;border-radius:10px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.045);color:#eef5ff;padding:0 10px;font:11px Arial,sans-serif}#${MODAL_ID} option{background:#101a2d;color:#eef5ff}
      #${MODAL_ID} .ghs-compare-result{margin-top:10px;padding:10px 11px;border-radius:11px;background:rgba(255,255,255,.03);color:#cbd8ea;font:11px/1.45 Arial,sans-serif}
      #${MODAL_ID} .ghs-files{display:grid;gap:5px;margin-top:8px}.ghs-file{display:flex;justify-content:space-between;gap:10px;padding:7px 9px;border-radius:9px;background:rgba(255,255,255,.025);font:10px/1.35 Arial,sans-serif;color:#bdcbe0}.ghs-file span:last-child{color:#8596b0;white-space:nowrap}
      @media(max-width:640px){#${MODAL_ID}{padding:10px}#${MODAL_ID} .ghs-card{width:calc(100vw - 16px);padding:16px}#${MODAL_ID} .ghs-grid{grid-template-columns:100px 1fr}#${MODAL_ID} .ghs-compare{grid-template-columns:1fr}}
    `;
  }

  function shell(shadow, subtitle = 'GitHub como source of truth · sincronização sob demanda') {
    shadow?.getElementById?.(MODAL_ID)?.remove();
    const overlay = document.createElement('div');
    overlay.id = MODAL_ID;
    const style = document.createElement('style');
    style.textContent = styles();
    const card = document.createElement('section');
    card.className = 'ghs-card';
    const head = document.createElement('div');
    head.className = 'ghs-head';
    const titleWrap = document.createElement('div');
    const title = document.createElement('h2');
    title.textContent = 'GitHub Sync & History';
    const sub = document.createElement('div');
    sub.className = 'ghs-sub';
    sub.textContent = subtitle;
    titleWrap.append(title, sub);
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'ghs-close';
    close.textContent = '×';
    close.setAttribute('aria-label', 'Fechar');
    head.append(titleWrap, close);
    const body = document.createElement('div');
    card.append(head, body);
    overlay.append(style, card);
    close.addEventListener('click', () => overlay.remove(), { once: true });
    overlay.addEventListener('click', event => { if (event.target === overlay) overlay.remove(); });
    shadow.appendChild(overlay);
    return { overlay, body };
  }

  function statusBox(parent, text) {
    const node = document.createElement('div');
    node.className = 'ghs-status';
    node.textContent = text;
    parent.appendChild(node);
    return node;
  }
  function field(grid, key, value) {
    const k = document.createElement('div'); k.className = 'ghs-key'; k.textContent = key;
    const v = document.createElement('div'); v.className = 'ghs-value'; v.textContent = value == null || value === '' ? '—' : String(value);
    grid.append(k, v);
  }
  function button(text, secondary = false) {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = `ghs-btn${secondary ? ' secondary' : ''}`;
    node.textContent = text;
    return node;
  }
  function shortSha(value) { return String(value || '').slice(0, 7) || '—'; }
  function fmtDate(value) {
    if (!value) return '—';
    try { return new Date(value).toLocaleString('pt-BR'); } catch (_) { return String(value); }
  }

  async function renderHistory(modal, status) {
    const previous = modal.body.querySelector('.ghs-history-section');
    previous?.remove();
    const section = document.createElement('section');
    section.className = 'ghs-section ghs-history-section';
    const heading = document.createElement('h3');
    heading.textContent = 'Histórico Git';
    const loading = statusBox(section, 'Carregando commits do branch vinculado…');
    section.appendChild(heading);
    section.appendChild(loading);
    modal.body.appendChild(section);

    const result = await send({ type: 'ld84.github.sync.history', limit: 20 });
    if (!result?.ok) {
      loading.textContent = result?.message || result?.code || 'Falha ao carregar histórico.';
      return;
    }
    const commits = Array.isArray(result.commits) ? result.commits : [];
    loading.textContent = `${commits.length} commit(s) · ${result.repository || status.repository} · ${result.branch || status.branch}`;
    const list = document.createElement('div');
    list.className = 'ghs-list';
    for (const commit of commits) {
      const item = document.createElement('div');
      item.className = 'ghs-commit';
      const top = document.createElement('div');
      top.className = 'ghs-commit-top';
      const message = document.createElement('span');
      message.textContent = commit.message || '(sem mensagem)';
      const sha = document.createElement('button');
      sha.type = 'button';
      sha.className = 'ghs-btn secondary ghs-sha';
      sha.style.minHeight = '28px';
      sha.textContent = commit.shortSha || shortSha(commit.sha);
      sha.addEventListener('click', () => { if (commit.htmlUrl) window.open(commit.htmlUrl, '_blank', 'noopener,noreferrer'); });
      top.append(message, sha);
      const meta = document.createElement('div');
      meta.className = 'ghs-meta';
      meta.textContent = `${commit.author || 'Git'} · ${fmtDate(commit.date)}`;
      item.append(top, meta);
      list.appendChild(item);
    }
    if (!commits.length) {
      const empty = document.createElement('div');
      empty.className = 'ghs-compare-result';
      empty.textContent = 'Nenhum commit retornado para o branch vinculado.';
      list.appendChild(empty);
    }
    section.appendChild(list);

    if (commits.length >= 2) {
      const compareWrap = document.createElement('div');
      compareWrap.className = 'ghs-section';
      const compareTitle = document.createElement('h3');
      compareTitle.textContent = 'Comparar commits';
      const compare = document.createElement('div');
      compare.className = 'ghs-compare';
      const baseLabel = document.createElement('label'); baseLabel.textContent = 'Base';
      const base = document.createElement('select');
      const headLabel = document.createElement('label'); headLabel.textContent = 'Head';
      const head = document.createElement('select');
      for (const commit of commits) {
        const label = `${commit.shortSha || shortSha(commit.sha)} · ${String(commit.message || '').slice(0, 60)}`;
        const a = document.createElement('option'); a.value = commit.sha; a.textContent = label; base.appendChild(a);
        const b = document.createElement('option'); b.value = commit.sha; b.textContent = label; head.appendChild(b);
      }
      base.selectedIndex = Math.min(1, commits.length - 1);
      head.selectedIndex = 0;
      baseLabel.appendChild(base); headLabel.appendChild(head);
      const run = button('Comparar');
      compare.append(baseLabel, headLabel, run);
      const output = document.createElement('div');
      output.className = 'ghs-compare-result';
      output.textContent = 'Selecione base/head para comparar sem alterar o repositório.';
      run.addEventListener('click', async () => {
        run.disabled = true;
        output.textContent = 'Comparando…';
        const out = await send({ type: 'ld84.github.sync.compare', base: base.value, head: head.value });
        run.disabled = false;
        if (!out?.ok) {
          output.textContent = out?.message || out?.code || 'Falha na comparação.';
          return;
        }
        const c = out.comparison || {};
        output.textContent = `${c.status || 'comparado'} · ahead ${c.aheadBy || 0} · behind ${c.behindBy || 0} · ${c.totalCommits || 0} commit(s)`;
        compareWrap.querySelector('.ghs-files')?.remove();
        const files = document.createElement('div');
        files.className = 'ghs-files';
        for (const file of Array.isArray(c.files) ? c.files.slice(0, 20) : []) {
          const row = document.createElement('div');
          row.className = 'ghs-file';
          const name = document.createElement('span'); name.textContent = file.filename || '';
          const delta = document.createElement('span'); delta.textContent = `+${file.additions || 0} −${file.deletions || 0}`;
          row.append(name, delta); files.appendChild(row);
        }
        if (files.childElementCount) compareWrap.appendChild(files);
      });
      compareWrap.append(compareTitle, compare, output);
      section.appendChild(compareWrap);
    }
  }

  async function open(shadow, action = 'open') {
    const modal = shell(shadow, action === 'details' ? 'Detalhes da sincronização autoritativa GitHub' : 'GitHub como source of truth · sincronização sob demanda');
    const loading = statusBox(modal.body, 'Resolvendo binding do projeto…');
    const result = await send({ type: 'ld84.github.sync.status' });
    if (!result?.ok) {
      loading.textContent = result?.message || result?.code || 'Não foi possível resolver o GitHub Sync.';
      const policy = document.createElement('div');
      policy.className = 'ghs-policy';
      policy.textContent = 'O GitHub Sync é fail-closed: requer projeto Lovable detectado, repositório explicitamente vinculado e autorizado/selecionado no GitHub App. Nenhum fallback escreve no Lovable.';
      modal.body.appendChild(policy);
      return;
    }
    modal.body.replaceChildren();
    const summary = statusBox(modal.body, result.sync?.checkedAt
      ? `Último snapshot GitHub: ${fmtDate(result.sync.checkedAt)}${result.sync.changedSinceLastSync ? ' · HEAD mudou desde o snapshot anterior' : ''}`
      : 'Binding válido. O branch ainda não foi sincronizado nesta Build84.');
    const policy = document.createElement('div');
    policy.className = 'ghs-policy';
    policy.textContent = 'Autoridade: GitHub. A sincronização apenas lê HEAD/histórico. Escritas continuam exclusivamente pelo Apply explícito do Editor Direto, sem force-push e sem escrever diretamente no Lovable.';
    modal.body.appendChild(policy);
    const grid = document.createElement('div');
    grid.className = 'ghs-grid';
    field(grid, 'Project ID', result.projectId);
    field(grid, 'Repositório', result.repository);
    field(grid, 'Branch', result.branch);
    field(grid, 'HEAD', result.sync?.headSha ? shortSha(result.sync.headSha) : 'Ainda não consultado');
    field(grid, 'HEAD anterior', result.sync?.previousHeadSha ? shortSha(result.sync.previousHeadSha) : '—');
    field(grid, 'Alterado', result.sync?.changedSinceLastSync ? 'Sim' : 'Não');
    modal.body.appendChild(grid);

    const actions = document.createElement('div');
    actions.className = 'ghs-actions';
    const refresh = button('Sincronizar estado');
    const history = button('Ver histórico', true);
    const repo = button('Abrir repositório', true);
    refresh.addEventListener('click', async () => {
      refresh.disabled = true;
      summary.textContent = 'Consultando HEAD autoritativo no GitHub…';
      const out = await send({ type: 'ld84.github.sync.refresh' });
      refresh.disabled = false;
      if (!out?.ok) {
        summary.textContent = out?.message || out?.code || 'Falha ao sincronizar.';
        return;
      }
      summary.textContent = out.sync?.changedSinceLastSync
        ? `HEAD atualizado para ${shortSha(out.sync.headSha)} · houve mudança desde ${shortSha(out.sync.previousHeadSha)}.`
        : `HEAD confirmado em ${shortSha(out.sync?.headSha)} · sem mudança desde o snapshot anterior.`;
      field(grid, 'Snapshot novo', shortSha(out.sync?.headSha));
    });
    history.addEventListener('click', () => { renderHistory(modal, result).catch(() => {}); });
    repo.addEventListener('click', () => { if (result.repository) window.open(`https://github.com/${result.repository}`, '_blank', 'noopener,noreferrer'); });
    actions.append(refresh, history, repo);
    modal.body.appendChild(actions);
    if (action === 'details') renderHistory(modal, result).catch(() => {});
  }

  function bind() {
    const host = document.getElementById(HOST_ID);
    const shadow = host?.shadowRoot;
    if (!shadow) return false;
    if (shadow.__ld84GithubSyncBound) return true;
    Object.defineProperty(shadow, '__ld84GithubSyncBound', { value: true, configurable: false });
    shadow.addEventListener('click', event => {
      const detail = shadow.getElementById('detail');
      if (!detail || detail.dataset.module !== 'git-history') return;
      const action = event.target?.closest?.('button.action');
      if (!action) return;
      const label = String(action.textContent || '').trim();
      const mapped = label.includes('Detalhes') ? 'details' : label.includes('Ver estado') ? 'status' : label.includes('Abrir módulo') ? 'open' : '';
      if (!mapped) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      open(shadow, mapped).catch(() => {});
    }, true);
    return true;
  }

  const api = Object.freeze({ open: action => {
    const shadow = document.getElementById(HOST_ID)?.shadowRoot;
    if (!shadow) return false;
    open(shadow, action || 'open').catch(() => {});
    return true;
  }});
  Object.defineProperty(window, 'LovableDecrypterGithubSyncV84', { value: api, configurable: false, enumerable: false, writable: false });

  if (!bind() && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { bind(); }, { once: true });
  }
})();
