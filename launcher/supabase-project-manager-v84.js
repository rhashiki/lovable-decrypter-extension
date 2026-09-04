(() => {
  'use strict';
  if (window.__LD84_SUPABASE_PROJECT_MANAGER_UI__) return;
  window.__LD84_SUPABASE_PROJECT_MANAGER_UI__ = true;

  const HOST_ID = 'lovable-decrypter-launcher';
  const MODAL_ID = 'ld84-supabase-project-manager-modal';

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

  function currentProjectSnapshot() {
    let url;
    try { url = new URL(location.href); } catch (_) { return null; }
    const parts = url.pathname.split('/').filter(Boolean);
    let projectId = '';
    let workspaceId = '';
    for (const marker of ['projects', 'project']) {
      const index = parts.indexOf(marker);
      if (index >= 0 && parts[index + 1]) { projectId = parts[index + 1]; break; }
    }
    for (const marker of ['workspaces', 'workspace']) {
      const index = parts.indexOf(marker);
      if (index >= 0 && parts[index + 1]) { workspaceId = parts[index + 1]; break; }
    }
    return {
      detected: url.hostname === 'lovable.dev' || url.hostname.endsWith('.lovable.dev'),
      projectId: String(projectId || '').slice(0, 120),
      workspaceId: String(workspaceId || '').slice(0, 120),
      url: url.href,
      title: String(document.title || '').slice(0, 300),
      pathname: url.pathname,
      collectedAt: new Date().toISOString()
    };
  }

  async function captureProject() {
    const context = currentProjectSnapshot();
    if (context) await send({ type: 'ld84.project.snapshot', context });
    return context;
  }

  function styles() {
    return `
      #${MODAL_ID}{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:18px;background:rgba(3,7,16,.58);backdrop-filter:blur(11px);pointer-events:auto;font-family:Arial,sans-serif;color:#f3f7ff}
      #${MODAL_ID} *{box-sizing:border-box}
      #${MODAL_ID} .sbm-card{width:min(760px,calc(100vw - 28px));max-height:min(850px,calc(100vh - 28px));overflow:auto;border:1px solid rgba(255,255,255,.11);border-radius:24px;background:linear-gradient(180deg,rgba(15,35,29,.99),rgba(7,18,15,.995));box-shadow:0 30px 100px rgba(0,0,0,.5);padding:20px;scrollbar-width:thin}
      #${MODAL_ID} .sbm-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:14px}
      #${MODAL_ID} .sbm-title{display:flex;gap:12px;align-items:flex-start}
      #${MODAL_ID} .sbm-mark{display:grid;place-items:center;width:38px;height:38px;flex:0 0 38px;border-radius:12px;background:rgba(62,207,142,.12);border:1px solid rgba(62,207,142,.24);color:#7af1b5;font:800 11px Arial,sans-serif}
      #${MODAL_ID} h2{margin:0;color:#fff;font:700 20px/1.2 Arial,sans-serif}
      #${MODAL_ID} .sbm-sub{margin-top:5px;color:#90aa9f;font:12px/1.45 Arial,sans-serif}
      #${MODAL_ID} .sbm-close{width:36px;height:36px;flex:0 0 36px;border:1px solid rgba(255,255,255,.10);border-radius:12px;background:rgba(255,255,255,.05);color:#dbe7e0;font:22px/1 Arial,sans-serif;cursor:pointer}
      #${MODAL_ID} .sbm-status{padding:11px 12px;border:1px solid rgba(62,207,142,.18);border-radius:13px;background:rgba(62,207,142,.065);color:#e0fff0;font:12px/1.45 Arial,sans-serif;margin-bottom:13px;overflow-wrap:anywhere}
      #${MODAL_ID} .sbm-status[data-kind="error"]{border-color:rgba(255,99,125,.24);background:rgba(255,99,125,.08);color:#ffd5dc}
      #${MODAL_ID} .sbm-status[data-kind="success"]{border-color:rgba(62,207,142,.30);background:rgba(62,207,142,.10);color:#dcffed}
      #${MODAL_ID} .sbm-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      #${MODAL_ID} .sbm-field{display:grid;gap:5px}
      #${MODAL_ID} .sbm-field.full{grid-column:1/-1}
      #${MODAL_ID} .sbm-label{color:#88a397;font:700 10px/1.3 Arial,sans-serif;text-transform:uppercase;letter-spacing:.04em}
      #${MODAL_ID} input,#${MODAL_ID} select{width:100%;height:39px;border:1px solid rgba(255,255,255,.10);border-radius:11px;background:rgba(255,255,255,.045);color:#edf7f2;font:12px Arial,sans-serif;padding:0 11px;outline:none}
      #${MODAL_ID} option{background:#10221b;color:#fff}
      #${MODAL_ID} input:focus,#${MODAL_ID} select:focus{border-color:rgba(62,207,142,.38);box-shadow:0 0 0 3px rgba(62,207,142,.06)}
      #${MODAL_ID} .sbm-section{margin-top:13px;padding-top:13px;border-top:1px solid rgba(255,255,255,.065)}
      #${MODAL_ID} .sbm-section-title{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:9px;color:#ecfff5;font:700 12px Arial,sans-serif}
      #${MODAL_ID} .sbm-list{display:grid;gap:7px}
      #${MODAL_ID} .sbm-row{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;padding:10px 11px;border-radius:12px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.03)}
      #${MODAL_ID} .sbm-row b{display:block;color:#effaf4;font:600 12px/1.35 Arial,sans-serif;overflow-wrap:anywhere}
      #${MODAL_ID} .sbm-row small{display:block;margin-top:3px;color:#7f988d;font:10px/1.35 Arial,sans-serif;overflow-wrap:anywhere}
      #${MODAL_ID} .sbm-tag{padding:4px 7px;border-radius:999px;background:rgba(62,207,142,.10);color:#9ff3c8;font:700 9px Arial,sans-serif;text-transform:uppercase}
      #${MODAL_ID} .sbm-actions{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:8px;margin-top:12px}
      #${MODAL_ID} .sbm-btn{min-height:36px;padding:0 12px;border-radius:11px;border:1px solid rgba(62,207,142,.22);background:rgba(62,207,142,.11);color:#e8fff3;cursor:pointer;font:600 12px Arial,sans-serif}
      #${MODAL_ID} .sbm-btn.secondary{border-color:rgba(255,255,255,.10);background:rgba(255,255,255,.05);color:#c8d8d0}
      #${MODAL_ID} .sbm-btn:disabled{opacity:.48;cursor:default}
      #${MODAL_ID} .sbm-warning{padding:10px 11px;border-radius:11px;border:1px solid rgba(255,191,71,.18);background:rgba(255,191,71,.06);color:#f4dfb5;font:11px/1.45 Arial,sans-serif;margin-top:9px}
      #${MODAL_ID} .sbm-confirm{display:flex;align-items:flex-start;gap:8px;margin-top:10px;color:#c9d9d1;font:11px/1.45 Arial,sans-serif}
      #${MODAL_ID} .sbm-confirm input{width:16px;height:16px;flex:0 0 16px;margin:0;accent-color:#3ecf8e}
      #${MODAL_ID} .sbm-empty{padding:16px;border:1px dashed rgba(255,255,255,.1);border-radius:12px;color:#82988e;text-align:center;font:11px/1.45 Arial,sans-serif}
      @media(max-width:720px){#${MODAL_ID}{padding:8px}#${MODAL_ID} .sbm-card{width:100%;max-height:calc(100vh - 16px);border-radius:18px;padding:15px}#${MODAL_ID} .sbm-grid{grid-template-columns:1fr}}
    `;
  }

  function field(label, control, full = false) {
    const wrap = document.createElement('div');
    wrap.className = `sbm-field${full ? ' full' : ''}`;
    const text = document.createElement('label');
    text.className = 'sbm-label';
    text.textContent = label;
    wrap.append(text, control);
    return wrap;
  }
  function button(label, secondary = false) {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = `sbm-btn${secondary ? ' secondary' : ''}`;
    node.textContent = label;
    return node;
  }
  function option(select, value, label) {
    const node = document.createElement('option');
    node.value = value;
    node.textContent = label;
    select.appendChild(node);
  }
  function setStatus(state, text, kind = '') {
    state.status.textContent = text;
    state.status.dataset.kind = kind;
  }
  function removeModal(shadow) {
    shadow?.getElementById?.(MODAL_ID)?.remove();
  }
  function createModal(shadow) {
    removeModal(shadow);
    const overlay = document.createElement('div');
    overlay.id = MODAL_ID;
    const style = document.createElement('style');
    style.textContent = styles();
    const card = document.createElement('section');
    card.className = 'sbm-card';
    const head = document.createElement('div');
    head.className = 'sbm-head';
    const titleWrap = document.createElement('div');
    titleWrap.className = 'sbm-title';
    const mark = document.createElement('div'); mark.className = 'sbm-mark'; mark.textContent = 'SB';
    const copy = document.createElement('div');
    const title = document.createElement('h2'); title.textContent = 'Gerenciador Supabase';
    const sub = document.createElement('div'); sub.className = 'sbm-sub'; sub.textContent = 'Testar, vincular e criar projetos sem expor credenciais de banco.';
    copy.append(title, sub); titleWrap.append(mark, copy);
    const close = document.createElement('button'); close.type = 'button'; close.className = 'sbm-close'; close.textContent = '×'; close.setAttribute('aria-label', 'Fechar');
    head.append(titleWrap, close);
    const status = document.createElement('div'); status.className = 'sbm-status'; status.textContent = 'Carregando projetos Supabase…';
    const body = document.createElement('div');
    card.append(head, status, body); overlay.append(style, card); shadow.appendChild(overlay);
    close.addEventListener('click', () => overlay.remove(), { once: true });
    overlay.addEventListener('click', event => { if (event.target === overlay) overlay.remove(); });
    return { overlay, card, status, body };
  }

  function regionOptions(raw) {
    const out = [];
    const add = (type, item, prefix) => {
      if (!item?.code) return;
      const id = `${type}:${item.code}`;
      if (out.some(entry => entry.id === id)) return;
      out.push({ id, type, code: String(item.code), label: `${prefix}${item.name || item.code}` });
    };
    add('smartGroup', raw?.recommendations?.smartGroup, 'Recomendado · ');
    const smart = raw?.all?.smartGroup;
    for (const item of Array.isArray(smart) ? smart : smart ? [smart] : []) add('smartGroup', item, 'Smart · ');
    const specific = Array.isArray(raw?.all?.specific) ? raw.all.specific : Array.isArray(raw?.recommendations?.specific) ? raw.recommendations.specific : [];
    for (const item of specific) add('specific', item, '');
    return out;
  }

  async function testProject(state, ref) {
    if (!ref) return setStatus(state, 'Selecione um projeto Supabase.', 'error');
    setStatus(state, `Testando banco ${ref}…`);
    const result = await send({ type: 'ld84.supabase.manager.test', projectRef: ref });
    if (!result?.ok) return setStatus(state, result?.message || result?.code || 'Teste recusado.', 'error');
    setStatus(state, `${result.project?.name || ref} · banco acessível via OAuth Management API.`, 'success');
  }

  async function bindProject(state, ref) {
    if (!ref) return setStatus(state, 'Selecione um projeto Supabase.', 'error');
    setStatus(state, `Vinculando ${ref} ao projeto Lovable atual…`);
    const result = await send({ type: 'ld84.supabase.manager.bind', projectRef: ref, projectId: state.data.projectId });
    if (!result?.ok) return setStatus(state, result?.message || result?.code || 'Vínculo recusado.', 'error');
    state.data.binding = result.binding;
    setStatus(state, `${ref} vinculado ao projeto Lovable ${result.projectId}.`, 'success');
    renderOverview(state);
  }

  function renderOverview(state) {
    state.body.replaceChildren();
    const data = state.data;
    const grid = document.createElement('div'); grid.className = 'sbm-grid';
    const projectInput = document.createElement('input'); projectInput.readOnly = true; projectInput.value = data.projectId || 'Projeto Lovable não identificado';
    const select = document.createElement('select'); option(select, '', 'Selecione um projeto Supabase');
    for (const project of data.projects || []) option(select, project.ref, `${project.name || project.ref} · ${project.ref}`);
    if (data.binding?.supabaseProject && [...select.options].some(item => item.value === data.binding.supabaseProject)) select.value = data.binding.supabaseProject;
    state.select = select;
    grid.append(field('Projeto Lovable', projectInput), field('Projeto Supabase', select));
    state.body.appendChild(grid);

    const actions = document.createElement('div'); actions.className = 'sbm-actions';
    const refresh = button('Atualizar', true);
    refresh.addEventListener('click', () => load(state.shadow).catch(() => {}));
    const test = button('Testar acesso', true); test.addEventListener('click', () => testProject(state, select.value));
    const bind = button('Vincular ao Lovable'); bind.disabled = !data.projectId; bind.addEventListener('click', () => bindProject(state, select.value));
    const create = button('Criar projeto'); create.addEventListener('click', () => renderCreate(state));
    actions.append(refresh, test, bind, create); state.body.appendChild(actions);

    const section = document.createElement('div'); section.className = 'sbm-section';
    const sectionTitle = document.createElement('div'); sectionTitle.className = 'sbm-section-title'; sectionTitle.textContent = `Disponíveis ao Decrypter · ${(data.projects || []).length}`;
    const list = document.createElement('div'); list.className = 'sbm-list';
    if (!(data.projects || []).length) {
      const empty = document.createElement('div'); empty.className = 'sbm-empty'; empty.textContent = 'Nenhum projeto está selecionado em Integrações > Supabase > Gerenciar projetos.'; list.appendChild(empty);
    } else {
      for (const project of data.projects) {
        const row = document.createElement('div'); row.className = 'sbm-row';
        const copy = document.createElement('div');
        const name = document.createElement('b'); name.textContent = project.name || project.ref;
        const meta = document.createElement('small'); meta.textContent = [project.ref, project.region, project.status].filter(Boolean).join(' · ');
        copy.append(name, meta);
        const tag = document.createElement('span'); tag.className = 'sbm-tag'; tag.textContent = data.binding?.supabaseProject === project.ref ? 'vinculado' : 'disponível';
        row.append(copy, tag); list.appendChild(row);
      }
    }
    section.append(sectionTitle, list); state.body.appendChild(section);
  }

  async function renderCreate(state) {
    state.body.replaceChildren();
    const back = button('← Voltar', true); back.addEventListener('click', () => renderOverview(state));
    state.body.appendChild(back);
    const section = document.createElement('div'); section.className = 'sbm-section';
    const title = document.createElement('div'); title.className = 'sbm-section-title'; title.textContent = 'Criar projeto Supabase';
    const grid = document.createElement('div'); grid.className = 'sbm-grid';
    const name = document.createElement('input'); name.placeholder = 'Nome do projeto'; name.maxLength = 80;
    const org = document.createElement('select');
    for (const item of state.data.organizations || []) option(org, item.slug, item.name || item.slug);
    const region = document.createElement('select'); option(region, '', 'Selecione uma organização primeiro'); region.disabled = true;
    grid.append(field('Nome', name), field('Organização', org), field('Região', region, true));
    section.append(title, grid);

    const warning = document.createElement('div'); warning.className = 'sbm-warning';
    warning.textContent = 'Criar um projeto é uma operação remota real no Supabase e pode consumir quota ou gerar cobrança conforme o plano da organização. Nada será criado sem a confirmação abaixo.';
    const confirm = document.createElement('label'); confirm.className = 'sbm-confirm';
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox';
    const text = document.createElement('span'); text.textContent = 'Confirmo que quero criar este projeto Supabase nesta organização.';
    confirm.append(checkbox, text); section.append(warning, confirm);

    const actions = document.createElement('div'); actions.className = 'sbm-actions';
    const create = button('Criar projeto'); create.disabled = true; actions.appendChild(create); section.appendChild(actions); state.body.appendChild(section);
    const syncCreate = () => { create.disabled = !(checkbox.checked && name.value.trim().length >= 2 && org.value && region.value); };
    checkbox.addEventListener('change', syncCreate); name.addEventListener('input', syncCreate); region.addEventListener('change', syncCreate);

    const loadRegions = async () => {
      region.disabled = true; region.replaceChildren(); option(region, '', 'Consultando regiões…'); syncCreate();
      if (!org.value) return;
      const result = await send({ type: 'ld84.supabase.manager.regions', organizationSlug: org.value });
      region.replaceChildren();
      if (!result?.ok) {
        option(region, '', result?.message || result?.code || 'Falha ao consultar regiões');
        setStatus(state, 'Não foi possível consultar as regiões.', 'error');
        return;
      }
      const options = regionOptions(result.regions);
      if (!options.length) {
        option(region, '', 'Nenhuma região retornada');
        setStatus(state, 'O Supabase não retornou regiões disponíveis.', 'error');
        return;
      }
      for (const item of options) option(region, item.id, item.label);
      region.disabled = false; syncCreate();
      setStatus(state, `${options.length} opção(ões) de região disponíveis.`);
    };
    org.addEventListener('change', () => loadRegions().catch(() => {}));
    if (org.value) await loadRegions();

    create.addEventListener('click', async () => {
      if (!checkbox.checked) return;
      const [regionType, regionCode] = String(region.value || '').split(':');
      create.disabled = true;
      setStatus(state, 'Criando projeto no Supabase…');
      const result = await send({
        type: 'ld84.supabase.manager.create',
        confirm: true,
        name: name.value.trim(),
        organizationSlug: org.value,
        regionType,
        regionCode
      });
      if (!result?.ok) {
        syncCreate();
        return setStatus(state, result?.message || result?.code || 'Criação recusada.', 'error');
      }
      setStatus(state, `Projeto ${result.project?.ref || ''} criado. A senha do banco foi guardada no Vault e não é exibida no navegador.`, 'success');
      renderProvisioning(state, result.project);
    });
  }

  function renderProvisioning(state, project) {
    state.body.replaceChildren();
    const card = document.createElement('div'); card.className = 'sbm-section';
    const title = document.createElement('div'); title.className = 'sbm-section-title'; title.textContent = 'Projeto criado';
    const row = document.createElement('div'); row.className = 'sbm-row';
    const copy = document.createElement('div');
    const name = document.createElement('b'); name.textContent = project?.name || project?.ref || 'Projeto Supabase';
    const meta = document.createElement('small'); meta.textContent = [project?.ref, project?.region, project?.status].filter(Boolean).join(' · ');
    copy.append(name, meta); const tag = document.createElement('span'); tag.className = 'sbm-tag'; tag.textContent = 'provisionando'; row.append(copy, tag);
    const note = document.createElement('div'); note.className = 'sbm-warning'; note.textContent = 'Não há polling. Use “Atualizar provisionamento” quando quiser consultar o estado novamente.';
    const actions = document.createElement('div'); actions.className = 'sbm-actions';
    const check = button('Atualizar provisionamento');
    const back = button('Voltar ao gerenciador', true); back.addEventListener('click', () => load(state.shadow).catch(() => {}));
    actions.append(back, check); card.append(title, row, note, actions); state.body.appendChild(card);
    check.addEventListener('click', async () => {
      check.disabled = true; setStatus(state, `Consultando ${project.ref}…`);
      const result = await send({ type: 'ld84.supabase.manager.project-status', projectRef: project.ref });
      check.disabled = false;
      if (!result?.ok) return setStatus(state, result?.message || result?.code || 'Falha ao consultar provisionamento.', 'error');
      if (result.ready) {
        setStatus(state, `${project.ref} está ativo e saudável.`, 'success');
        const test = button('Testar e vincular');
        test.addEventListener('click', async () => {
          const tested = await send({ type: 'ld84.supabase.manager.test', projectRef: project.ref });
          if (!tested?.ok) return setStatus(state, tested?.message || tested?.code || 'Teste falhou.', 'error');
          const bound = await send({ type: 'ld84.supabase.manager.bind', projectRef: project.ref, projectId: state.data.projectId });
          if (!bound?.ok) return setStatus(state, bound?.message || bound?.code || 'Vínculo falhou.', 'error');
          setStatus(state, `${project.ref} testado e vinculado ao projeto Lovable.`, 'success');
          load(state.shadow).catch(() => {});
        });
        actions.appendChild(test);
      } else {
        setStatus(state, `${project.ref} ainda está provisionando. Consulte novamente quando desejar.`);
      }
    });
  }

  async function load(shadow) {
    const modal = createModal(shadow);
    await captureProject();
    const data = await send({ type: 'ld84.supabase.manager.status' });
    if (!data?.ok) {
      setStatus(modal, data?.message || data?.code || 'Gerenciador Supabase indisponível.', 'error');
      return;
    }
    const state = { ...modal, shadow, data };
    if (data.reauthorizeRequired) {
      setStatus(state, `Reautorização Supabase necessária: ${(data.missingScopes || []).join(', ') || 'escopos insuficientes'}.`, 'error');
    } else if (!data.projectId) {
      setStatus(state, 'Abra um projeto Lovable para criar um vínculo. Teste e criação continuam disponíveis.');
    } else {
      setStatus(state, `${data.selectedProjectCount} projeto(s) disponíveis · Lovable ${data.projectId}.`, 'success');
    }
    renderOverview(state);
  }

  function bind() {
    const host = document.getElementById(HOST_ID);
    const shadow = host?.shadowRoot;
    if (!shadow) return false;
    if (shadow.__ld84SupabaseProjectManagerBound) return true;
    Object.defineProperty(shadow, '__ld84SupabaseProjectManagerBound', { value: true, configurable: false });
    shadow.addEventListener('click', event => {
      const control = event.target?.closest?.('[data-ld-supabase-project-manager]');
      if (!control) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      load(shadow).catch(error => {
        const modal = createModal(shadow);
        setStatus(modal, error?.message || String(error), 'error');
      });
    });
    return true;
  }

  Object.defineProperty(window, 'LovableDecrypterSupabaseManagerV84', {
    value: Object.freeze({ open: () => {
      const shadow = document.getElementById(HOST_ID)?.shadowRoot;
      if (!shadow) return Promise.resolve(false);
      return load(shadow).then(() => true);
    }}),
    configurable: false,
    enumerable: false,
    writable: false
  });

  const bound = bind();
  if (!bound && document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { bind(); }, { once: true });
})();
