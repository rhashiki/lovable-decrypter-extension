(() => {
  'use strict';
  if (window.__LD84_GEMINI_INTEGRATION__) return;
  window.__LD84_GEMINI_INTEGRATION__ = true;

  const HOST_ID = 'lovable-decrypter-launcher';
  const MODAL_ID = 'ld84-gemini-modal';

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

  function removeModal(shadow) {
    shadow?.getElementById?.(MODAL_ID)?.remove();
  }

  function styles() {
    return `
      #${MODAL_ID}{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:24px;background:rgba(3,7,16,.56);backdrop-filter:blur(10px);pointer-events:auto;font-family:Arial,sans-serif;color:#f3f7ff}
      #${MODAL_ID} .ld84-gem-card{width:min(620px,calc(100vw - 32px));max-height:min(780px,calc(100vh - 32px));overflow:auto;border:1px solid rgba(255,255,255,.10);border-radius:24px;background:linear-gradient(180deg,rgba(20,31,54,.985),rgba(9,16,30,.995));box-shadow:0 28px 90px rgba(0,0,0,.46);padding:22px}
      #${MODAL_ID} .ld84-gem-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:16px}
      #${MODAL_ID} .ld84-gem-title{display:flex;align-items:center;gap:11px}
      #${MODAL_ID} .ld84-gem-mark{width:38px;height:38px;display:grid;place-items:center;border:1px solid rgba(170,126,255,.25);border-radius:13px;background:rgba(170,126,255,.09);color:#cab7ff;font:700 20px/1 Arial,sans-serif}
      #${MODAL_ID} h2{font:700 20px/1.25 Arial,sans-serif;margin:0;color:#fff}
      #${MODAL_ID} .ld84-gem-sub{margin-top:4px;color:#9aa7bf;font:12px/1.45 Arial,sans-serif}
      #${MODAL_ID} .ld84-gem-close{width:36px;height:36px;border-radius:12px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.05);color:#dce7fb;cursor:pointer;font:22px/1 Arial,sans-serif}
      #${MODAL_ID} .ld84-gem-zero{display:flex;gap:10px;align-items:flex-start;padding:12px 13px;border:1px solid rgba(67,216,142,.18);border-radius:13px;background:rgba(67,216,142,.07);margin-bottom:14px}
      #${MODAL_ID} .ld84-gem-zero b{flex:0 0 auto;color:#69e3a7;font:800 11px Arial,sans-serif;letter-spacing:.08em}
      #${MODAL_ID} .ld84-gem-zero span{color:#a9b8cf;font:11px/1.45 Arial,sans-serif}
      #${MODAL_ID} .ld84-gem-status{padding:12px 13px;border-radius:13px;background:rgba(59,210,255,.07);border:1px solid rgba(59,210,255,.16);color:#dcecff;font:12px/1.45 Arial,sans-serif;margin-bottom:14px}
      #${MODAL_ID} .ld84-gem-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      #${MODAL_ID} .ld84-gem-field{display:grid;gap:6px;margin:10px 0}
      #${MODAL_ID} .ld84-gem-field>span{color:#95a5be;font:700 11px Arial,sans-serif}
      #${MODAL_ID} input,#${MODAL_ID} select{width:100%;height:40px;border-radius:11px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.045);color:#eef5ff;padding:0 11px;outline:none;font:12px Arial,sans-serif}
      #${MODAL_ID} input:focus,#${MODAL_ID} select:focus{border-color:rgba(59,210,255,.36);box-shadow:0 0 0 3px rgba(59,210,255,.07)}
      #${MODAL_ID} option{background:#101a2d;color:#eef5ff}
      #${MODAL_ID} .ld84-gem-note{margin-top:9px;color:#7889a4;font:10px/1.5 Arial,sans-serif}
      #${MODAL_ID} .ld84-gem-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
      #${MODAL_ID} .ld84-gem-btn{min-height:38px;padding:0 13px;border-radius:11px;border:1px solid rgba(59,210,255,.20);background:rgba(59,210,255,.10);color:#e9f8ff;cursor:pointer;font:600 12px Arial,sans-serif}
      #${MODAL_ID} .ld84-gem-btn.secondary{border-color:rgba(255,255,255,.10);background:rgba(255,255,255,.05);color:#cbd7eb}
      #${MODAL_ID} .ld84-gem-btn.danger{border-color:rgba(255,112,112,.20);background:rgba(255,112,112,.08);color:#ffd5d5}
      #${MODAL_ID} .ld84-gem-btn:disabled{opacity:.55;cursor:default}
      #${MODAL_ID} .ld84-gem-info{display:grid;gap:7px}
      #${MODAL_ID} .ld84-gem-row{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;padding:9px 10px;border-radius:11px;background:rgba(255,255,255,.028);font:11px/1.4 Arial,sans-serif}
      #${MODAL_ID} .ld84-gem-row span{color:#8495ae}.ld84-gem-row b{color:#e5eefb;text-align:right;overflow-wrap:anywhere}
      #${MODAL_ID} .ld84-gem-list-title{margin-top:10px;color:#8fa0bb;font:700 10px Arial,sans-serif}
      #${MODAL_ID} .ld84-gem-list{display:grid;gap:5px;margin-top:6px}
      #${MODAL_ID} .ld84-gem-list>div{padding:8px 10px;border-radius:10px;background:rgba(255,255,255,.035);color:#d6e2f5;font:11px Arial,sans-serif;overflow-wrap:anywhere}
      @media(max-width:620px){#${MODAL_ID}{padding:12px}#${MODAL_ID} .ld84-gem-card{width:calc(100vw - 20px);padding:17px}#${MODAL_ID} .ld84-gem-grid{grid-template-columns:1fr}}
    `;
  }

  function shell(shadow, subtitle) {
    removeModal(shadow);
    const overlay = document.createElement('div');
    overlay.id = MODAL_ID;
    const style = document.createElement('style');
    style.textContent = styles();
    const card = document.createElement('section');
    card.className = 'ld84-gem-card';
    const head = document.createElement('div');
    head.className = 'ld84-gem-head';
    const titleWrap = document.createElement('div');
    titleWrap.className = 'ld84-gem-title';
    const mark = document.createElement('div');
    mark.className = 'ld84-gem-mark';
    mark.textContent = '✦';
    const titles = document.createElement('div');
    const title = document.createElement('h2');
    title.textContent = 'Gemini';
    const sub = document.createElement('div');
    sub.className = 'ld84-gem-sub';
    sub.textContent = subtitle || 'Integração opcional sob demanda';
    titles.append(title, sub);
    titleWrap.append(mark, titles);
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'ld84-gem-close';
    close.textContent = '×';
    close.setAttribute('aria-label', 'Fechar');
    head.append(titleWrap, close);
    const body = document.createElement('div');
    card.append(head, body);
    overlay.append(style, card);
    close.addEventListener('click', () => overlay.remove(), { once: true });
    overlay.addEventListener('click', event => { if (event.target === overlay) overlay.remove(); });
    shadow.appendChild(overlay);
    return { overlay, card, body };
  }

  function statusLine(parent, text) {
    const node = document.createElement('div');
    node.className = 'ld84-gem-status';
    node.textContent = text;
    parent.appendChild(node);
    return node;
  }

  function infoRow(parent, label, value) {
    const row = document.createElement('div');
    row.className = 'ld84-gem-row';
    const key = document.createElement('span');
    key.textContent = label;
    const content = document.createElement('b');
    content.textContent = value == null || value === '' ? '—' : String(value);
    row.append(key, content);
    parent.appendChild(row);
  }

  function selectOption(id, label) {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = label || id;
    return option;
  }

  function populateSelect(select, models, selected) {
    select.replaceChildren();
    const values = Array.isArray(models) ? models : [];
    for (const model of values) select.appendChild(selectOption(model.id, `${model.displayName || model.id} · FREE`));
    if (selected && !values.some(model => model.id === selected)) select.appendChild(selectOption(selected, `${selected} · FREE`));
    if (selected) select.value = selected;
    if (!select.value && select.options.length) select.selectedIndex = 0;
  }

  function defaultModels(data) {
    const ids = Array.isArray(data?.allowedModels) ? data.allowedModels : [];
    return ids.map(id => ({ id, displayName: id }));
  }

  async function openConfig(shadow) {
    const modal = shell(shadow, 'Integração opcional · configuração somente sob demanda');
    const loading = statusLine(modal.body, 'Carregando configuração…');
    const result = await send({ type: 'ld84.gemini.status' });
    if (!result?.ok) {
      loading.textContent = result?.message || result?.code || 'Falha ao carregar Gemini.';
      return;
    }
    const data = result.data || {};
    modal.body.replaceChildren();

    const zero = document.createElement('div');
    zero.className = 'ld84-gem-zero';
    const zeroTitle = document.createElement('b');
    zeroTitle.textContent = 'FREE ONLY';
    const zeroCopy = document.createElement('span');
    zeroCopy.textContent = 'O Decrypter só oferece nesta tela modelos com Free Tier verificado. Gemini permanece opcional e nunca é iniciado automaticamente no boot.';
    zero.append(zeroTitle, zeroCopy);
    modal.body.appendChild(zero);

    const state = statusLine(modal.body, data.configured
      ? `Chave configurada ${data.keyHint || ''} · ${data.model || 'modelo não definido'}`
      : 'Nenhuma chave Gemini configurada.');

    const keyField = document.createElement('label');
    keyField.className = 'ld84-gem-field';
    const keyLabel = document.createElement('span');
    keyLabel.textContent = 'Gemini Authorization / API Key';
    const keyInput = document.createElement('input');
    keyInput.type = 'password';
    keyInput.autocomplete = 'off';
    keyInput.placeholder = data.keyPresent ? `Chave salva ${data.keyHint || ''} · deixe em branco para manter` : 'Cole sua chave do Gemini';
    keyField.append(keyLabel, keyInput);
    modal.body.appendChild(keyField);

    const grid = document.createElement('div');
    grid.className = 'ld84-gem-grid';
    const mainField = document.createElement('label');
    mainField.className = 'ld84-gem-field';
    const mainLabel = document.createElement('span');
    mainLabel.textContent = 'Modelo principal';
    const mainSelect = document.createElement('select');
    mainField.append(mainLabel, mainSelect);
    const advancedField = document.createElement('label');
    advancedField.className = 'ld84-gem-field';
    const advancedLabel = document.createElement('span');
    advancedLabel.textContent = 'Modelo avançado';
    const advancedSelect = document.createElement('select');
    advancedField.append(advancedLabel, advancedSelect);
    grid.append(mainField, advancedField);
    modal.body.appendChild(grid);

    let models = defaultModels(data);
    populateSelect(mainSelect, models, data.model);
    populateSelect(advancedSelect, models, data.advancedModel);

    const note = document.createElement('div');
    note.className = 'ld84-gem-note';
    note.textContent = '“Testar conexão” valida a chave consultando a lista de modelos e não envia prompt ao Gemini. Se o projeto Google estiver configurado em tier pago, o faturamento continua sendo autoridade do Google; o Decrypter não usa esta integração automaticamente.';
    modal.body.appendChild(note);

    const actions = document.createElement('div');
    actions.className = 'ld84-gem-actions';
    const refresh = document.createElement('button');
    refresh.type = 'button';
    refresh.className = 'ld84-gem-btn secondary';
    refresh.textContent = 'Atualizar modelos';
    const test = document.createElement('button');
    test.type = 'button';
    test.className = 'ld84-gem-btn secondary';
    test.textContent = 'Testar conexão';
    const save = document.createElement('button');
    save.type = 'button';
    save.className = 'ld84-gem-btn';
    save.textContent = 'Salvar';
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'ld84-gem-btn danger';
    clear.textContent = 'Remover chave';
    clear.hidden = !data.keyPresent;
    actions.append(refresh, test, save, clear);
    modal.body.appendChild(actions);

    const draft = () => ({
      apiKey: keyInput.value.trim(),
      model: mainSelect.value,
      advancedModel: advancedSelect.value,
      maxOutputTokens: Number(data.maxOutputTokens || 32768),
      billingMode: 'free',
      zeroCost: true
    });

    async function loadModels(label) {
      refresh.disabled = true;
      test.disabled = true;
      state.textContent = label;
      const out = await send({ type: 'ld84.gemini.models', config: draft() });
      refresh.disabled = false;
      test.disabled = false;
      if (!out?.ok) {
        state.textContent = `Falha: ${out?.message || out?.code || 'não foi possível consultar os modelos'}`;
        return false;
      }
      models = Array.isArray(out.models) ? out.models : [];
      const mainBefore = mainSelect.value;
      const advancedBefore = advancedSelect.value;
      populateSelect(mainSelect, models, mainBefore);
      populateSelect(advancedSelect, models, advancedBefore);
      state.textContent = `${out.count || models.length} modelo(s) Free Tier compatíveis · chave aceita.`;
      return true;
    }

    refresh.addEventListener('click', () => { loadModels('Consultando modelos permitidos…').catch(() => {}); });
    test.addEventListener('click', () => { loadModels('Validando chave sem enviar prompt…').catch(() => {}); });
    save.addEventListener('click', async () => {
      save.disabled = true;
      state.textContent = 'Salvando configuração…';
      const out = await send({ type: 'ld84.gemini.save', config: draft() });
      save.disabled = false;
      if (!out?.ok) {
        state.textContent = `Falha: ${out?.message || out?.code || 'não foi possível salvar'}`;
        return;
      }
      keyInput.value = '';
      keyInput.placeholder = out.data?.keyPresent ? `Chave salva ${out.data?.keyHint || ''} · deixe em branco para manter` : 'Cole sua chave do Gemini';
      clear.hidden = !out.data?.keyPresent;
      state.textContent = `Configuração salva · ${out.data?.model || mainSelect.value} · modo Free Only.`;
    });
    clear.addEventListener('click', async () => {
      clear.disabled = true;
      state.textContent = 'Removendo chave do Decrypter…';
      const out = await send({ type: 'ld84.gemini.clear' });
      clear.disabled = false;
      if (!out?.ok) {
        state.textContent = `Falha: ${out?.message || out?.code || 'não foi possível remover'}`;
        return;
      }
      keyInput.value = '';
      keyInput.placeholder = 'Cole sua chave do Gemini';
      clear.hidden = true;
      state.textContent = 'Chave removida do Decrypter.';
    });
  }

  async function showInfo(shadow, mode) {
    const modal = shell(shadow, mode === 'status' ? 'Estado atual' : 'Detalhes da integração');
    const loading = statusLine(modal.body, mode === 'status' ? 'Atualizando estado…' : 'Carregando detalhes…');
    const result = await send({ type: 'ld84.gemini.status' });
    if (!result?.ok) {
      loading.textContent = result?.message || result?.code || 'Falha ao consultar Gemini.';
      return;
    }
    const data = result.data || {};
    modal.body.replaceChildren();
    const info = document.createElement('div');
    info.className = 'ld84-gem-info';
    if (mode === 'status') {
      infoRow(info, 'Configurado', data.configured ? 'Sim' : 'Não');
      infoRow(info, 'Chave', data.keyPresent ? data.keyHint || 'Configurada' : 'Não configurada');
      infoRow(info, 'Modelo principal', data.model || '—');
      infoRow(info, 'Política', 'Free Only · sob demanda');
    } else {
      infoRow(info, 'Configurado', data.configured ? 'Sim' : 'Não');
      infoRow(info, 'Chave', data.keyPresent ? data.keyHint || 'Configurada' : 'Não configurada');
      infoRow(info, 'Modelo principal', data.model || '—');
      infoRow(info, 'Modelo avançado', data.advancedModel || '—');
      infoRow(info, 'Máx. saída', data.maxOutputTokens || '—');
      infoRow(info, 'Modo de cobrança', 'Free Only');
      infoRow(info, 'Validação', 'Lista de modelos · sem prompt');
      infoRow(info, 'Última validação', data.verifiedAt || 'Ainda não validada');
      infoRow(info, 'Ativação no boot', data.bootActivation === false ? 'Não' : '—');
      infoRow(info, 'Execução automática', data.automaticExecution === false ? 'Não' : '—');
      infoRow(info, 'Orquestrador central', data.centralOrchestrator === 'local-ai' ? 'IA local' : data.centralOrchestrator || '—');
      const title = document.createElement('div');
      title.className = 'ld84-gem-list-title';
      title.textContent = 'Modelos permitidos nesta build';
      const list = document.createElement('div');
      list.className = 'ld84-gem-list';
      for (const model of Array.isArray(data.allowedModels) ? data.allowedModels : []) {
        const item = document.createElement('div');
        item.textContent = `${model} · FREE`;
        list.appendChild(item);
      }
      modal.body.append(info, title, list);
      return;
    }
    modal.body.appendChild(info);
  }

  function bind() {
    const host = document.getElementById(HOST_ID);
    const shadow = host?.shadowRoot;
    if (!shadow) return false;
    if (shadow.__ld84GeminiIntegrationBound) return true;
    Object.defineProperty(shadow, '__ld84GeminiIntegrationBound', { value: true, configurable: false });

    shadow.addEventListener('click', event => {
      const action = event.target?.closest?.('button.action');
      if (!action) return;
      const detail = shadow.getElementById('detail');
      if (String(detail?.dataset?.module || '') !== 'gemini') return;
      const label = String(action.querySelector('span')?.textContent || action.textContent || '').trim();
      if (!['Abrir módulo', 'Ver estado', 'Detalhes'].includes(label)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (label === 'Abrir módulo') openConfig(shadow).catch(() => {});
      else showInfo(shadow, label === 'Ver estado' ? 'status' : 'details').catch(() => {});
    }, true);
    return true;
  }

  const bound = bind();
  if (!bound && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { bind(); }, { once: true });
  }
})();