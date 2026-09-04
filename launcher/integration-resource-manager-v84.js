(() => {
  'use strict';
  if (window.__LD84_INTEGRATION_RESOURCE_MANAGER__) return;
  window.__LD84_INTEGRATION_RESOURCE_MANAGER__ = true;

  const HOST_ID = 'lovable-decrypter-launcher';

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

  function removeManager(shadow) {
    shadow?.getElementById?.('ld84-resource-manager-modal')?.remove();
  }

  function managerStyles() {
    return `
      #ld84-resource-manager-modal{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:24px;background:rgba(3,7,16,.56);backdrop-filter:blur(10px);pointer-events:auto;font-family:Arial,sans-serif;color:#f3f7ff}
      #ld84-resource-manager-modal .ld84-rm-card{width:min(620px,calc(100vw - 32px));max-height:min(760px,calc(100vh - 32px));overflow:auto;border:1px solid rgba(255,255,255,.10);border-radius:24px;background:linear-gradient(180deg,rgba(20,31,54,.985),rgba(9,16,30,.995));box-shadow:0 28px 90px rgba(0,0,0,.46);padding:22px}
      #ld84-resource-manager-modal .ld84-rm-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:16px}
      #ld84-resource-manager-modal h2{font:700 20px/1.25 Arial,sans-serif;margin:0;color:#fff}
      #ld84-resource-manager-modal .ld84-rm-sub{margin-top:5px;color:#9aa7bf;font:12px/1.45 Arial,sans-serif}
      #ld84-resource-manager-modal .ld84-rm-close{width:36px;height:36px;border-radius:12px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.05);color:#dce7fb;cursor:pointer;font:22px/1 Arial,sans-serif}
      #ld84-resource-manager-modal .ld84-rm-status{padding:12px 13px;border-radius:13px;background:rgba(59,210,255,.07);border:1px solid rgba(59,210,255,.16);color:#dcecff;font:12px/1.45 Arial,sans-serif;margin-bottom:14px}
      #ld84-resource-manager-modal .ld84-rm-toolbar{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}
      #ld84-resource-manager-modal .ld84-rm-btn{min-height:36px;padding:0 12px;border-radius:11px;border:1px solid rgba(59,210,255,.20);background:rgba(59,210,255,.10);color:#e9f8ff;cursor:pointer;font:600 12px Arial,sans-serif}
      #ld84-resource-manager-modal .ld84-rm-btn.secondary{border-color:rgba(255,255,255,.10);background:rgba(255,255,255,.05);color:#cbd7eb}
      #ld84-resource-manager-modal .ld84-rm-btn:disabled{opacity:.55;cursor:default}
      #ld84-resource-manager-modal .ld84-rm-list{display:grid;gap:8px;margin-top:8px}
      #ld84-resource-manager-modal .ld84-rm-item{display:grid;grid-template-columns:22px 1fr;gap:10px;align-items:center;padding:11px 12px;border:1px solid rgba(255,255,255,.07);border-radius:13px;background:rgba(255,255,255,.035);cursor:pointer}
      #ld84-resource-manager-modal .ld84-rm-item:hover{border-color:rgba(59,210,255,.18);background:rgba(59,210,255,.045)}
      #ld84-resource-manager-modal input[type=checkbox]{width:17px;height:17px;accent-color:#3bd2ff}
      #ld84-resource-manager-modal .ld84-rm-name{display:block;color:#eef5ff;font:600 12px/1.35 Arial,sans-serif;overflow-wrap:anywhere}
      #ld84-resource-manager-modal .ld84-rm-meta{display:block;margin-top:3px;color:#8391aa;font:11px/1.35 Arial,sans-serif;overflow-wrap:anywhere}
      #ld84-resource-manager-modal .ld84-rm-empty{padding:18px;border:1px dashed rgba(255,255,255,.10);border-radius:13px;color:#8391aa;text-align:center;font:12px/1.45 Arial,sans-serif}
      #ld84-resource-manager-modal .ld84-rm-actions{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:9px;margin-top:16px}
    `;
  }

  function createManager(shadow, integration) {
    removeManager(shadow);
    const overlay = document.createElement('div');
    overlay.id = 'ld84-resource-manager-modal';
    const style = document.createElement('style');
    style.textContent = managerStyles();
    const card = document.createElement('section');
    card.className = 'ld84-rm-card';
    const head = document.createElement('div');
    head.className = 'ld84-rm-head';
    const heading = document.createElement('div');
    const title = document.createElement('h2');
    title.textContent = integration === 'github' ? 'Gerenciar repositórios' : 'Gerenciar projetos Supabase';
    const sub = document.createElement('div');
    sub.className = 'ld84-rm-sub';
    sub.textContent = integration === 'github'
      ? 'Escolha quais repositórios autorizados pelo GitHub App ficam disponíveis ao Decrypter.'
      : 'Escolha quais projetos visíveis pelo OAuth do Supabase ficam disponíveis ao Decrypter.';
    heading.append(title, sub);
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'ld84-rm-close';
    close.textContent = '×';
    close.setAttribute('aria-label', 'Fechar');
    head.append(heading, close);
    const status = document.createElement('div');
    status.className = 'ld84-rm-status';
    status.textContent = 'Carregando recursos autorizados…';
    const toolbar = document.createElement('div');
    toolbar.className = 'ld84-rm-toolbar';
    const list = document.createElement('div');
    list.className = 'ld84-rm-list';
    const actions = document.createElement('div');
    actions.className = 'ld84-rm-actions';
    card.append(head, status, toolbar, list, actions);
    overlay.append(style, card);
    close.addEventListener('click', () => overlay.remove(), { once: true });
    overlay.addEventListener('click', event => { if (event.target === overlay) overlay.remove(); });
    shadow.appendChild(overlay);
    return { overlay, status, toolbar, list, actions };
  }

  function button(text, secondary = false) {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = `ld84-rm-btn${secondary ? ' secondary' : ''}`;
    node.textContent = text;
    return node;
  }

  async function openManager(shadow, integration) {
    const modal = createManager(shadow, integration);

    const load = async () => {
      modal.status.textContent = 'Atualizando recursos autorizados…';
      modal.toolbar.replaceChildren();
      modal.list.replaceChildren();
      modal.actions.replaceChildren();
      const result = await send({ type: 'ld84.integration.resources.status', integration });
      if (!result?.ok) {
        modal.status.textContent = result?.message || result?.code || 'Falha ao consultar recursos.';
        return;
      }

      const available = Array.isArray(result.available) ? result.available : [];
      const selected = new Set(Array.isArray(result.selected) ? result.selected : []);
      modal.status.textContent = `${selected.size} de ${available.length} ${integration === 'github' ? 'repositório(s)' : 'projeto(s)'} disponíveis ao Decrypter.`;

      const selectAll = button('Selecionar todos', true);
      const clearAll = button('Remover todos', true);
      const refresh = button('Atualizar lista', true);
      selectAll.addEventListener('click', () => modal.list.querySelectorAll('input[type=checkbox]').forEach(input => { input.checked = true; }));
      clearAll.addEventListener('click', () => modal.list.querySelectorAll('input[type=checkbox]').forEach(input => { input.checked = false; }));
      refresh.addEventListener('click', () => { load().catch(() => {}); });
      modal.toolbar.append(selectAll, clearAll, refresh);

      if (integration === 'github' && result.manageUrl) {
        const official = button('Gerenciar acesso no GitHub', true);
        official.addEventListener('click', () => {
          try { window.open(String(result.manageUrl), '_blank', 'noopener,noreferrer'); } catch (_) {}
        });
        modal.toolbar.appendChild(official);
      }

      if (integration === 'github') {
        const sync = button('GitHub Sync & History', true);
        sync.dataset.ldGithubSync = 'true';
        sync.addEventListener('click', () => {
          modal.overlay.remove();
          const open = window.LovableDecrypterGithubSyncV84?.open;
          if (typeof open === 'function') open('open');
        });
        modal.toolbar.appendChild(sync);
      }

      if (integration === 'supabase') {
        const projectManager = button('Gerenciador Supabase', true);
        projectManager.dataset.ldSupabaseProjectManager = 'true';
        projectManager.addEventListener('click', () => {
          modal.overlay.remove();
          const open = window.LovableDecrypterSupabaseManagerV84?.open;
          if (typeof open === 'function') open().catch(() => {});
        });
        modal.toolbar.appendChild(projectManager);
      }

      if (!available.length) {
        const empty = document.createElement('div');
        empty.className = 'ld84-rm-empty';
        empty.textContent = integration === 'github'
          ? 'Nenhum repositório está autorizado nesta instalação do GitHub App.'
          : 'Nenhum projeto Supabase está visível para esta conexão OAuth.';
        modal.list.appendChild(empty);
      } else {
        for (const item of available) {
          const row = document.createElement('label');
          row.className = 'ld84-rm-item';
          const input = document.createElement('input');
          input.type = 'checkbox';
          input.value = String(item.id || '');
          input.checked = selected.has(String(item.id || ''));
          const text = document.createElement('span');
          const name = document.createElement('span');
          name.className = 'ld84-rm-name';
          name.textContent = String(item.label || item.id || '');
          const meta = document.createElement('span');
          meta.className = 'ld84-rm-meta';
          meta.textContent = String(item.meta || '');
          text.append(name, meta);
          row.append(input, text);
          modal.list.appendChild(row);
        }
      }

      const cancel = button('Cancelar', true);
      cancel.addEventListener('click', () => modal.overlay.remove(), { once: true });
      const save = button('Salvar seleção');
      save.addEventListener('click', async () => {
        save.disabled = true;
        const selectedValues = [...modal.list.querySelectorAll('input[type=checkbox]:checked')].map(input => input.value);
        modal.status.textContent = 'Salvando seleção…';
        const saved = await send({ type: 'ld84.integration.resources.save', integration, selected: selectedValues });
        save.disabled = false;
        if (!saved?.ok) {
          modal.status.textContent = saved?.message || saved?.code || 'Não foi possível salvar.';
          return;
        }
        modal.status.textContent = `${selectedValues.length} de ${(saved.available || []).length} ${integration === 'github' ? 'repositório(s)' : 'projeto(s)'} disponíveis ao Decrypter. Seleção salva.`;
      });
      modal.actions.append(cancel, save);
    };

    await load();
  }

  function bind() {
    const host = document.getElementById(HOST_ID);
    const shadow = host?.shadowRoot;
    if (!shadow) return false;
    if (shadow.__ld84IntegrationResourceManagerBound) return true;
    Object.defineProperty(shadow, '__ld84IntegrationResourceManagerBound', { value: true, configurable: false });

    shadow.addEventListener('click', event => {
      const manage = event.target?.closest?.('[data-ld-resource-manage]');
      if (!manage) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      openManager(shadow, String(manage.dataset.ldResourceManage || '')).catch(() => {});
    });
    return true;
  }

  const bound = bind();
  if (!bound && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { bind(); }, { once: true });
  }
})();
