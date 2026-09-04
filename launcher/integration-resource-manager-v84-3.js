(() => {
  'use strict';
  if (window.__LD84_INTEGRATION_RESOURCE_MANAGER_V3__) return;
  window.__LD84_INTEGRATION_RESOURCE_MANAGER_V3__ = true;

  const HOST_ID = 'lovable-decrypter-launcher';
  const MODAL_ID = 'ld84-resource-manager-modal';

  function send(message) {
    return new Promise(resolve => {
      try {
        chrome.runtime.sendMessage(message, response => {
          if (chrome.runtime.lastError) return resolve({ ok:false, code:'RUNTIME_MESSAGE_FAILED', message:chrome.runtime.lastError.message });
          resolve(response || { ok:false, code:'EMPTY_RUNTIME_RESPONSE' });
        });
      } catch (error) {
        resolve({ ok:false, code:'RUNTIME_MESSAGE_FAILED', message:error?.message || String(error) });
      }
    });
  }

  function transientDB(result) {
    const code = String(result?.code || result?.message || '');
    return code === 'DB_ERROR' || /CONNECTION_READ_FAILED|OAUTH_CONFIG_READ_FAILED/.test(code);
  }

  async function resourceStatus(integration) {
    let out = await send({ type:'ld84.integration.resources.status', integration });
    if (!out?.ok && transientDB(out)) out = await send({ type:'ld84.integration.resources.status', integration });
    return out;
  }

  const CSS = `
    #${MODAL_ID}{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:24px;background:rgba(3,7,16,.56);backdrop-filter:blur(10px);pointer-events:auto;font-family:Arial,sans-serif;color:#f3f7ff}
    #${MODAL_ID} *{box-sizing:border-box}
    #${MODAL_ID} .ld84-rm-card{width:min(620px,calc(100vw - 32px));max-height:min(760px,calc(100vh - 32px));overflow:auto;scrollbar-width:thin;scrollbar-color:rgba(59,210,255,.48) rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.10);border-radius:24px;background:linear-gradient(180deg,rgba(20,31,54,.985),rgba(9,16,30,.995));box-shadow:0 28px 90px rgba(0,0,0,.46);padding:22px}
    #${MODAL_ID} .ld84-rm-card::-webkit-scrollbar{width:9px}#${MODAL_ID} .ld84-rm-card::-webkit-scrollbar-track{background:rgba(255,255,255,.02);border-radius:999px}#${MODAL_ID} .ld84-rm-card::-webkit-scrollbar-thumb{background:linear-gradient(180deg,rgba(59,210,255,.62),rgba(105,119,255,.38));border:2px solid rgba(9,16,30,.94);border-radius:999px}
    #${MODAL_ID} .ld84-rm-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:16px}#${MODAL_ID} h2{font:700 20px/1.25 Arial;margin:0;color:#fff}#${MODAL_ID} .ld84-rm-sub{margin-top:5px;color:#9aa7bf;font:12px/1.45 Arial}#${MODAL_ID} .ld84-rm-close{width:36px;height:36px;border-radius:12px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.05);color:#dce7fb;cursor:pointer;font:22px/1 Arial}
    #${MODAL_ID} .ld84-rm-status{padding:12px 13px;border-radius:13px;background:rgba(59,210,255,.07);border:1px solid rgba(59,210,255,.16);color:#dcecff;font:12px/1.45 Arial;margin-bottom:14px;overflow-wrap:anywhere}
    #${MODAL_ID} .ld84-rm-toolbar{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}#${MODAL_ID} .ld84-rm-btn{min-height:36px;padding:0 12px;border-radius:11px;border:1px solid rgba(59,210,255,.20);background:rgba(59,210,255,.10);color:#e9f8ff;cursor:pointer;font:600 12px Arial}#${MODAL_ID} .ld84-rm-btn.secondary{border-color:rgba(255,255,255,.10);background:rgba(255,255,255,.05);color:#cbd7eb}#${MODAL_ID} .ld84-rm-btn:disabled{opacity:.55;cursor:default}
    #${MODAL_ID} .ld84-rm-list{display:grid;gap:8px;margin-top:8px;max-height:330px;overflow:auto;padding-right:3px;scrollbar-width:thin}#${MODAL_ID} .ld84-rm-item{display:grid;grid-template-columns:22px 1fr;gap:10px;align-items:center;padding:11px 12px;border:1px solid rgba(255,255,255,.07);border-radius:13px;background:rgba(255,255,255,.035);cursor:pointer}#${MODAL_ID} .ld84-rm-item:hover{border-color:rgba(59,210,255,.18);background:rgba(59,210,255,.045)}#${MODAL_ID} input[type=checkbox]{width:17px;height:17px;accent-color:#3bd2ff}#${MODAL_ID} .ld84-rm-name{display:block;color:#eef5ff;font:600 12px/1.35 Arial;overflow-wrap:anywhere}#${MODAL_ID} .ld84-rm-meta{display:block;margin-top:3px;color:#8391aa;font:11px/1.35 Arial;overflow-wrap:anywhere}#${MODAL_ID} .ld84-rm-empty{padding:18px;border:1px dashed rgba(255,255,255,.10);border-radius:13px;color:#8391aa;text-align:center;font:12px/1.45 Arial}#${MODAL_ID} .ld84-rm-actions{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:9px;margin-top:16px}
  `;

  function setStatus(node, text, kind='') {
    node.textContent = text;
    node.dataset.kind = kind;
  }
  function button(text, secondary=false) {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = `ld84-rm-btn${secondary ? ' secondary' : ''}`;
    node.textContent = text;
    return node;
  }
  function remove(shadow) { shadow?.getElementById?.(MODAL_ID)?.remove(); }

  function create(shadow, integration) {
    remove(shadow);
    const overlay = document.createElement('div'); overlay.id = MODAL_ID;
    const style = document.createElement('style'); style.textContent = CSS;
    const card = document.createElement('section'); card.className = 'ld84-rm-card';
    const head = document.createElement('div'); head.className = 'ld84-rm-head';
    const heading = document.createElement('div');
    const title = document.createElement('h2'); title.textContent = integration === 'github' ? 'Gerenciar repositórios' : 'Gerenciar projetos Supabase';
    const sub = document.createElement('div'); sub.className = 'ld84-rm-sub';
    sub.textContent = integration === 'github'
      ? 'Escolha quais repositórios autorizados pelo GitHub App ficam disponíveis ao Decrypter.'
      : 'Escolha quais projetos visíveis pelo OAuth do Supabase ficam disponíveis ao Decrypter. O vínculo do projeto atual é detectado automaticamente quando houver correspondência inequívoca.';
    heading.append(title, sub);
    const close = button('×', true); close.className = 'ld84-rm-close'; close.setAttribute('aria-label','Fechar');
    head.append(heading, close);
    const status = document.createElement('div'); status.className = 'ld84-rm-status'; status.textContent = 'Carregando recursos autorizados…';
    const toolbar = document.createElement('div'); toolbar.className = 'ld84-rm-toolbar';
    const list = document.createElement('div'); list.className = 'ld84-rm-list';
    const actions = document.createElement('div'); actions.className = 'ld84-rm-actions';
    card.append(head, status, toolbar, list, actions); overlay.append(style, card); shadow.appendChild(overlay);
    close.addEventListener('click', () => overlay.remove(), { once:true });
    overlay.addEventListener('click', event => { if (event.target === overlay) overlay.remove(); });
    return { overlay, status, toolbar, list, actions };
  }

  async function openManager(shadow, integration) {
    const modal = create(shadow, integration);

    const load = async () => {
      setStatus(modal.status, 'Atualizando recursos autorizados…');
      modal.toolbar.replaceChildren(); modal.list.replaceChildren(); modal.actions.replaceChildren();
      const result = await resourceStatus(integration);
      if (!result?.ok) {
        setStatus(modal.status, result?.message || result?.code || 'Falha ao consultar recursos.', 'error');
        const retry = button('Tentar novamente', true);
        retry.addEventListener('click', () => load().catch(() => {}));
        modal.actions.appendChild(retry);
        return;
      }

      const available = Array.isArray(result.available) ? result.available : [];
      const selected = new Set(Array.isArray(result.selected) ? result.selected.map(String) : []);
      setStatus(modal.status, `${selected.size} de ${available.length} ${integration === 'github' ? 'repositório(s)' : 'projeto(s)'} disponíveis ao Decrypter.`);

      const selectAll = button('Selecionar todos', true);
      const clearAll = button('Remover todos', true);
      const refresh = button('Atualizar lista', true);
      selectAll.addEventListener('click', () => modal.list.querySelectorAll('input[type=checkbox]').forEach(input => { input.checked = true; }));
      clearAll.addEventListener('click', () => modal.list.querySelectorAll('input[type=checkbox]').forEach(input => { input.checked = false; }));
      refresh.addEventListener('click', () => load().catch(() => {}));
      modal.toolbar.append(selectAll, clearAll, refresh);

      if (integration === 'github' && result.manageUrl) {
        const official = button('Gerenciar acesso no GitHub', true);
        official.addEventListener('click', () => { try { window.open(String(result.manageUrl), '_blank', 'noopener,noreferrer'); } catch (_) {} });
        modal.toolbar.appendChild(official);
      }
      if (integration === 'github') {
        const sync = button('GitHub Sync & History', true);
        sync.addEventListener('click', () => {
          modal.overlay.remove();
          window.LovableDecrypterGithubSyncV84?.open?.('open');
        });
        modal.toolbar.appendChild(sync);
      }
      if (integration === 'supabase') {
        const manager = button('Gerenciador Supabase', true);
        manager.addEventListener('click', () => {
          modal.overlay.remove();
          window.LovableDecrypterSupabaseManagerV84?.open?.()?.catch?.(() => {});
        });
        modal.toolbar.appendChild(manager);
      }

      if (!available.length) {
        const empty = document.createElement('div'); empty.className = 'ld84-rm-empty';
        empty.textContent = integration === 'github' ? 'Nenhum repositório autorizado.' : 'Nenhum projeto Supabase visível.';
        modal.list.appendChild(empty);
      } else {
        for (const item of available) {
          const row = document.createElement('label'); row.className = 'ld84-rm-item';
          const input = document.createElement('input'); input.type='checkbox'; input.value=String(item.id || ''); input.checked=selected.has(String(item.id || ''));
          const text = document.createElement('span');
          const name = document.createElement('span'); name.className='ld84-rm-name'; name.textContent=String(item.label || item.id || '');
          const meta = document.createElement('span'); meta.className='ld84-rm-meta'; meta.textContent=String(item.meta || '');
          text.append(name, meta); row.append(input, text); modal.list.appendChild(row);
        }
      }

      const cancel = button('Cancelar', true); cancel.addEventListener('click', () => modal.overlay.remove(), { once:true });
      const save = button('Salvar seleção');
      save.addEventListener('click', async () => {
        save.disabled = true;
        const values = [...modal.list.querySelectorAll('input[type=checkbox]:checked')].map(input => input.value);
        setStatus(modal.status, 'Salvando e validando seleção…', 'testing');
        const saved = await send({ type:'ld84.integration.resources.save', integration, selected:values });
        save.disabled = false;
        if (!saved?.ok) return setStatus(modal.status, saved?.message || saved?.code || 'Não foi possível salvar.', 'error');
        setStatus(modal.status, `${values.length} de ${(saved.available || []).length} ${integration === 'github' ? 'repositório(s)' : 'projeto(s)'} disponíveis ao Decrypter. Seleção salva.`, 'success');
        if (integration === 'supabase') window.LovableDecrypterAutoBindingV84?.ensure?.({ source:'resource-save' })?.catch?.(() => {});
      });
      modal.actions.append(cancel, save);
    };

    await load();
  }

  function bind() {
    const shadow = document.getElementById(HOST_ID)?.shadowRoot;
    if (!shadow) return false;
    if (shadow.__ld84IntegrationResourceManagerV3Bound) return true;
    Object.defineProperty(shadow, '__ld84IntegrationResourceManagerV3Bound', { value:true, configurable:false });
    shadow.addEventListener('click', event => {
      const manage = event.target?.closest?.('[data-ld-resource-manage]');
      if (!manage) return;
      event.preventDefault(); event.stopImmediatePropagation();
      openManager(shadow, String(manage.dataset.ldResourceManage || '')).catch(() => {});
    });
    return true;
  }

  if (!bind() && document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => bind(), { once:true });
})();