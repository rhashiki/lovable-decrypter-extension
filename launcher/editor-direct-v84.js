(() => {
  'use strict';
  if (window.__LD84_EDITOR_DIRECT_UI__) return;
  window.__LD84_EDITOR_DIRECT_UI__ = true;

  const HOST_ID = 'lovable-decrypter-launcher';
  const MODAL_ID = 'ld84-editor-direct-modal';

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
    let parsed;
    try { parsed = new URL(location.href); } catch { return null; }
    const parts = parsed.pathname.split('/').filter(Boolean);
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
      detected: parsed.hostname === 'lovable.dev' || parsed.hostname.endsWith('.lovable.dev'),
      projectId: String(projectId || '').slice(0, 120),
      workspaceId: String(workspaceId || '').slice(0, 120),
      url: parsed.href,
      title: String(document.title || '').slice(0, 300),
      pathname: parsed.pathname,
      collectedAt: new Date().toISOString()
    };
  }

  function styleText() {
    return `
      #${MODAL_ID}{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:18px;background:rgba(3,7,16,.58);backdrop-filter:blur(11px);pointer-events:auto;font-family:Arial,sans-serif;color:#f3f7ff}
      #${MODAL_ID} *{box-sizing:border-box}
      #${MODAL_ID} .ed-card{width:min(760px,calc(100vw - 28px));max-height:min(860px,calc(100vh - 28px));overflow:auto;border:1px solid rgba(255,255,255,.11);border-radius:24px;background:linear-gradient(180deg,rgba(20,31,54,.99),rgba(8,15,29,.995));box-shadow:0 30px 100px rgba(0,0,0,.48);padding:20px;scrollbar-width:thin}
      #${MODAL_ID} .ed-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:15px}
      #${MODAL_ID} h2{margin:0;color:#fff;font:700 20px/1.2 Arial,sans-serif}
      #${MODAL_ID} .ed-sub{margin-top:5px;color:#92a2bd;font:12px/1.45 Arial,sans-serif}
      #${MODAL_ID} .ed-close{width:36px;height:36px;flex:0 0 36px;border:1px solid rgba(255,255,255,.10);border-radius:12px;background:rgba(255,255,255,.05);color:#dbe7fa;font:22px/1 Arial,sans-serif;cursor:pointer}
      #${MODAL_ID} .ed-status{padding:11px 12px;border:1px solid rgba(59,210,255,.16);border-radius:13px;background:rgba(59,210,255,.065);color:#dcecff;font:12px/1.45 Arial,sans-serif;margin-bottom:13px;overflow-wrap:anywhere}
      #${MODAL_ID} .ed-status[data-kind="error"]{border-color:rgba(255,99,125,.24);background:rgba(255,99,125,.08);color:#ffd5dc}
      #${MODAL_ID} .ed-status[data-kind="success"]{border-color:rgba(67,216,142,.22);background:rgba(67,216,142,.07);color:#d9ffea}
      #${MODAL_ID} .ed-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      #${MODAL_ID} .ed-field{display:grid;gap:5px}
      #${MODAL_ID} .ed-field.full{grid-column:1/-1}
      #${MODAL_ID} label.ed-label{color:#8999b3;font:700 10px/1.3 Arial,sans-serif;text-transform:uppercase;letter-spacing:.04em}
      #${MODAL_ID} input,#${MODAL_ID} select,#${MODAL_ID} textarea{width:100%;border:1px solid rgba(255,255,255,.10);border-radius:11px;background:rgba(255,255,255,.045);color:#edf5ff;font:12px/1.45 Arial,sans-serif;outline:none}
      #${MODAL_ID} input,#${MODAL_ID} select{height:38px;padding:0 11px}
      #${MODAL_ID} textarea{min-height:118px;resize:vertical;padding:11px 12px}
      #${MODAL_ID} input:focus,#${MODAL_ID} select:focus,#${MODAL_ID} textarea:focus{border-color:rgba(59,210,255,.38);box-shadow:0 0 0 3px rgba(59,210,255,.06)}
      #${MODAL_ID} option{background:#111c31;color:#fff}
      #${MODAL_ID} .ed-section{margin-top:13px;padding-top:13px;border-top:1px solid rgba(255,255,255,.065)}
      #${MODAL_ID} .ed-section-title{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:9px;color:#e8f1ff;font:700 12px Arial,sans-serif}
      #${MODAL_ID} .ed-muted{color:#8292ac;font:11px/1.4 Arial,sans-serif}
      #${MODAL_ID} .ed-mode{display:flex;gap:7px}
      #${MODAL_ID} .ed-btn{min-height:36px;padding:0 12px;border-radius:11px;border:1px solid rgba(59,210,255,.20);background:rgba(59,210,255,.10);color:#e9f8ff;cursor:pointer;font:600 12px Arial,sans-serif}
      #${MODAL_ID} .ed-btn.secondary{border-color:rgba(255,255,255,.10);background:rgba(255,255,255,.05);color:#cbd7eb}
      #${MODAL_ID} .ed-btn.danger{border-color:rgba(255,99,125,.20);background:rgba(255,99,125,.08);color:#ffd4dc}
      #${MODAL_ID} .ed-btn.active{border-color:rgba(59,210,255,.40);background:rgba(59,210,255,.18);color:#fff}
      #${MODAL_ID} .ed-btn:disabled{opacity:.48;cursor:default}
      #${MODAL_ID} .ed-actions{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:8px;margin-top:12px}
      #${MODAL_ID} details{border:1px solid rgba(255,255,255,.07);border-radius:12px;background:rgba(255,255,255,.025);padding:9px 11px}
      #${MODAL_ID} details summary{cursor:pointer;color:#dbe7fa;font:600 11px Arial,sans-serif}
      #${MODAL_ID} .ed-runtime-grid{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:8px;margin-top:9px}
      #${MODAL_ID} .ed-result{display:grid;gap:8px;margin-top:12px}
      #${MODAL_ID} .ed-result-card{padding:12px;border:1px solid rgba(255,255,255,.07);border-radius:13px;background:rgba(255,255,255,.03)}
      #${MODAL_ID} .ed-result-card h3{margin:0 0 7px;color:#f2f7ff;font:700 13px Arial,sans-serif}
      #${MODAL_ID} .ed-result-card p{margin:0;color:#a9b7cb;font:11px/1.5 Arial,sans-serif}
      #${MODAL_ID} .ed-list{margin:8px 0 0;padding-left:19px;color:#cfdaeb;font:11px/1.55 Arial,sans-serif}
      #${MODAL_ID} .ed-files{display:grid;gap:6px;margin-top:9px}
      #${MODAL_ID} .ed-file{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 9px;border-radius:10px;background:rgba(255,255,255,.035);font:11px Arial,sans-serif}
      #${MODAL_ID} .ed-file b{overflow-wrap:anywhere}
      #${MODAL_ID} .ed-tag{padding:4px 7px;border-radius:999px;background:rgba(59,210,255,.09);color:#bdefff;font:700 9px Arial,sans-serif;text-transform:uppercase}
      #${MODAL_ID} .ed-approve{display:flex;align-items:flex-start;gap:8px;padding:10px 11px;border:1px solid rgba(255,255,255,.07);border-radius:11px;background:rgba(255,255,255,.025);color:#c8d4e6;font:11px/1.45 Arial,sans-serif;margin-top:10px}
      #${MODAL_ID} .ed-approve input{width:16px;height:16px;margin:0;accent-color:#3bd2ff}
      #${MODAL_ID} .ed-warning{padding:10px 11px;border-radius:11px;border:1px solid rgba(255,191,71,.17);background:rgba(255,191,71,.055);color:#f5deb1;font:11px/1.45 Arial,sans-serif;margin-top:9px}
      #${MODAL_ID} .ed-link{color:#80ddff;text-decoration:none;font-weight:700}
      @media(max-width:720px){#${MODAL_ID}{padding:8px}#${MODAL_ID} .ed-card{width:100%;max-height:calc(100vh - 16px);border-radius:18px;padding:15px}#${MODAL_ID} .ed-grid,#${MODAL_ID} .ed-runtime-grid{grid-template-columns:1fr}}
    `;
  }

  function field(label, control, full = false) {
    const wrap = document.createElement('div');
    wrap.className = `ed-field${full ? ' full' : ''}`;
    const text = document.createElement('label');
    text.className = 'ed-label';
    text.textContent = label;
    wrap.append(text, control);
    return wrap;
  }

  function button(label, secondary = false) {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = `ed-btn${secondary ? ' secondary' : ''}`;
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
    style.textContent = styleText();
    const card = document.createElement('section');
    card.className = 'ed-card';
    const head = document.createElement('div');
    head.className = 'ed-head';
    const heading = document.createElement('div');
    const title = document.createElement('h2');
    title.textContent = 'Editor Direto';
    const sub = document.createElement('div');
    sub.className = 'ed-sub';
    sub.textContent = 'IA local → contexto GitHub → Plan/Shadow Build → revisão explícita → Apply';
    heading.append(title, sub);
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'ed-close';
    close.textContent = '×';
    close.setAttribute('aria-label', 'Fechar');
    head.append(heading, close);
    const status = document.createElement('div');
    status.className = 'ed-status';
    status.textContent = 'Carregando projeto e integrações…';
    const body = document.createElement('div');
    card.append(head, status, body);
    overlay.append(style, card);
    close.addEventListener('click', () => overlay.remove(), { once: true });
    overlay.addEventListener('click', event => { if (event.target === overlay) overlay.remove(); });
    shadow.appendChild(overlay);
    return { overlay, card, status, body };
  }

  async function captureProject() {
    const context = currentProjectSnapshot();
    if (context) await send({ type: 'ld84.project.snapshot', context });
    return context;
  }

  function renderPlan(state, result) {
    state.result.replaceChildren();
    const card = document.createElement('div');
    card.className = 'ed-result-card';
    const h3 = document.createElement('h3');
    h3.textContent = 'Plano · ZERO WRITE';
    const summary = document.createElement('p');
    summary.textContent = result?.plan?.summary || 'Plano gerado.';
    card.append(h3, summary);
    const steps = Array.isArray(result?.plan?.plan) ? result.plan.plan : [];
    if (steps.length) {
      const list = document.createElement('ol');
      list.className = 'ed-list';
      for (const item of steps) { const li = document.createElement('li'); li.textContent = item; list.appendChild(li); }
      card.appendChild(list);
    }
    const files = [...(result?.plan?.relevantFiles || []), ...(result?.plan?.newFiles || [])];
    if (files.length) {
      const fileBox = document.createElement('div');
      fileBox.className = 'ed-files';
      for (const path of files) {
        const row = document.createElement('div'); row.className = 'ed-file';
        const name = document.createElement('b'); name.textContent = path;
        const tag = document.createElement('span'); tag.className = 'ed-tag'; tag.textContent = (result?.plan?.newFiles || []).includes(path) ? 'novo' : 'ler';
        row.append(name, tag); fileBox.appendChild(row);
      }
      card.appendChild(fileBox);
    }
    if (result?.plan?.supabaseRequired) {
      const warning = document.createElement('div'); warning.className = 'ed-warning';
      warning.textContent = 'Este plano exige aplicação no Supabase. O Shadow Build pode ser preparado, mas o Apply ficará bloqueado até o runtime Supabase ser reativado.';
      card.appendChild(warning);
    }
    const actions = document.createElement('div'); actions.className = 'ed-actions';
    const prepare = button('Preparar Shadow Build');
    prepare.addEventListener('click', () => executeBuild(state));
    actions.appendChild(prepare);
    card.appendChild(actions);
    state.result.appendChild(card);
  }

  function renderShadow(state, result) {
    state.result.replaceChildren();
    state.shadowId = result.shadowId || '';
    const card = document.createElement('div'); card.className = 'ed-result-card';
    const h3 = document.createElement('h3'); h3.textContent = 'Shadow Build pronto · nenhum write executado';
    const summary = document.createElement('p'); summary.textContent = result.summary || 'Alterações preparadas em memória.';
    card.append(h3, summary);
    const meta = document.createElement('p');
    meta.style.marginTop = '7px';
    meta.textContent = `${result.repository || ''} · ${result.branch || 'main'} · base ${(result.baseHeadSha || '').slice(0, 8)}`;
    card.appendChild(meta);
    const files = document.createElement('div'); files.className = 'ed-files';
    for (const file of result.files || []) {
      const row = document.createElement('div'); row.className = 'ed-file';
      const name = document.createElement('b'); name.textContent = file.path;
      const tag = document.createElement('span'); tag.className = 'ed-tag'; tag.textContent = file.action;
      row.append(name, tag); files.appendChild(row);
    }
    card.appendChild(files);
    if (result.applyBlocked) {
      const warning = document.createElement('div'); warning.className = 'ed-warning';
      warning.textContent = result.applyBlockedReason === 'SUPABASE_APPLY_RUNTIME_NOT_REATTACHED'
        ? 'Apply bloqueado: este Shadow Build exige aplicação Supabase e o runtime de backend ainda não foi reativado.'
        : `Apply bloqueado: ${result.applyBlockedReason || 'dependência indisponível'}`;
      card.appendChild(warning);
    } else {
      const approve = document.createElement('label'); approve.className = 'ed-approve';
      const checkbox = document.createElement('input'); checkbox.type = 'checkbox';
      const text = document.createElement('span');
      text.textContent = 'Revisei os arquivos acima e autorizo explicitamente a criação do commit no GitHub. O HEAD será revalidado antes do Apply.';
      approve.append(checkbox, text); card.appendChild(approve);
      const actions = document.createElement('div'); actions.className = 'ed-actions';
      const apply = button('Aplicar no GitHub'); apply.disabled = true;
      checkbox.addEventListener('change', () => { apply.disabled = !checkbox.checked; });
      apply.addEventListener('click', () => executeApply(state, apply));
      actions.appendChild(apply); card.appendChild(actions);
    }
    state.result.appendChild(card);
  }

  function renderApplied(state, result) {
    state.result.replaceChildren();
    const card = document.createElement('div'); card.className = 'ed-result-card';
    const h3 = document.createElement('h3'); h3.textContent = 'GitHub atualizado';
    const p = document.createElement('p');
    p.textContent = `Commit ${(result.commitSha || '').slice(0, 8)} criado em ${result.repository || ''}. O GitSync do Lovable ainda não foi revalidado por este runtime.`;
    card.append(h3, p);
    if (result.commitUrl) {
      const actions = document.createElement('div'); actions.className = 'ed-actions';
      const open = button('Abrir commit', true);
      open.addEventListener('click', () => window.open(result.commitUrl, '_blank', 'noopener,noreferrer'));
      actions.appendChild(open); card.appendChild(actions);
    }
    state.result.appendChild(card);
  }

  async function saveBinding(state, quiet = false) {
    const repository = state.repo.value;
    const repoInfo = state.resources?.repositories?.find(item => item.fullName === repository);
    const branch = repoInfo?.defaultBranch || state.resources?.binding?.branch || 'main';
    const result = await send({
      type: 'ld84.editor.bind',
      projectId: state.projectId,
      repository,
      branch,
      supabaseProject: state.supabase.value
    });
    if (!result?.ok) {
      if (!quiet) setStatus(state, result?.message || result?.code || 'Não foi possível salvar o vínculo.', 'error');
      return false;
    }
    if (!quiet) setStatus(state, `Vínculo salvo: ${repository}${state.supabase.value ? ` · Supabase ${state.supabase.value}` : ''}.`, 'success');
    return true;
  }

  async function saveLocalAndHealth(state) {
    state.healthButton.disabled = true;
    const payload = {
      type: 'ld84.editor.configure',
      endpoint: state.endpoint.value,
      model: state.model.value,
      token: state.token.value,
      preserveToken: state.token.value === '' && state.tokenConfigured === true
    };
    const saved = await send(payload);
    if (!saved?.ok) {
      state.healthButton.disabled = false;
      setStatus(state, saved?.message || saved?.code || 'Configuração local inválida.', 'error');
      return;
    }
    const health = await send({ type: 'ld84.editor.health' });
    state.healthButton.disabled = false;
    const data = health?.health;
    state.tokenConfigured = Boolean(saved?.local?.tokenConfigured ?? (state.tokenConfigured || Boolean(state.token.value)));
    if (data?.ok) setStatus(state, `IA local pronta · ${data.runtime || 'local'} · ${data.model || data.servedModel || state.model.value} · ${data.latencyMs || 0} ms.`, 'success');
    else setStatus(state, `IA local indisponível: ${data?.code || health?.code || 'LOCAL_RUNTIME_UNAVAILABLE'}.`, 'error');
  }

  async function executePlan(state) {
    if (state.busy) return;
    const command = state.prompt.value.trim();
    if (!command) return setStatus(state, 'Digite o que você quer alterar no projeto.', 'error');
    if (!(await saveBinding(state, true))) return setStatus(state, 'Selecione e salve um repositório válido.', 'error');
    state.busy = true; state.execute.disabled = true;
    setStatus(state, 'IA local planejando · ZERO WRITE…');
    const result = await send({
      type: 'ld84.editor.plan',
      command,
      projectId: state.projectId,
      repository: state.repo.value,
      supabaseProject: state.supabase.value
    });
    state.busy = false; state.execute.disabled = false;
    if (!result?.ok) return setStatus(state, result?.message || result?.code || 'Falha no planejamento local.', 'error');
    setStatus(state, `Plano pronto com ${result?.plan?.plan?.length || 0} etapa(s) · nenhum arquivo alterado.`, 'success');
    renderPlan(state, result);
  }

  async function executeBuild(state) {
    if (state.busy) return;
    const command = state.prompt.value.trim();
    if (!command) return setStatus(state, 'Digite o que você quer alterar no projeto.', 'error');
    if (!(await saveBinding(state, true))) return setStatus(state, 'Selecione e salve um repositório válido.', 'error');
    state.busy = true; state.execute.disabled = true;
    setStatus(state, 'IA local lendo o escopo e preparando Shadow Build · ZERO WRITE…');
    const result = await send({
      type: 'ld84.editor.build',
      command,
      projectId: state.projectId,
      repository: state.repo.value,
      supabaseProject: state.supabase.value
    });
    state.busy = false; state.execute.disabled = false;
    if (!result?.ok) return setStatus(state, result?.message || result?.code || 'Falha ao preparar Shadow Build.', 'error');
    setStatus(state, `Shadow Build pronto · ${result.files?.length || 0} arquivo(s) · nenhum commit criado.`, 'success');
    renderShadow(state, result);
  }

  async function executeApply(state, buttonNode) {
    if (state.busy || !state.shadowId) return;
    state.busy = true; buttonNode.disabled = true;
    setStatus(state, 'Revalidando Trust + HEAD e aplicando commit GitHub…');
    const result = await send({ type: 'ld84.editor.apply', shadowId: state.shadowId });
    state.busy = false;
    if (!result?.ok) {
      buttonNode.disabled = false;
      return setStatus(state, result?.message || result?.code || 'Apply recusado.', 'error');
    }
    setStatus(state, `Commit ${(result.commitSha || '').slice(0, 8)} confirmado no GitHub. Lovable ainda não verificado.`, 'success');
    state.shadowId = '';
    renderApplied(state, result);
  }

  async function loadEditor(shadow) {
    const modal = createModal(shadow);
    await captureProject();
    const resources = await send({ type: 'ld84.editor.resources' });
    if (!resources?.ok) {
      modal.status.textContent = resources?.message || resources?.code || 'Não foi possível carregar o Editor Direto.';
      modal.status.dataset.kind = 'error';
      return;
    }

    const state = {
      ...modal,
      resources,
      projectId: resources.projectId || '',
      mode: 'build',
      busy: false,
      shadowId: '',
      tokenConfigured: resources.local?.tokenConfigured === true
    };

    const projectGrid = document.createElement('div'); projectGrid.className = 'ed-grid';
    const projectInput = document.createElement('input'); projectInput.readOnly = true; projectInput.value = state.projectId || 'Projeto Lovable não identificado';
    const repo = document.createElement('select'); option(repo, '', 'Selecione o repositório');
    for (const item of resources.repositories || []) option(repo, item.fullName, item.fullName);
    const supabase = document.createElement('select'); option(supabase, '', 'Sem projeto Supabase');
    for (const item of resources.supabaseProjects || []) option(supabase, item.ref, `${item.name || item.ref} · ${item.ref}`);
    if (resources.binding?.repository && [...repo.options].some(item => item.value === resources.binding.repository)) repo.value = resources.binding.repository;
    else if ((resources.repositories || []).length === 1) repo.value = resources.repositories[0].fullName;
    if (resources.binding?.supabaseProject && [...supabase.options].some(item => item.value === resources.binding.supabaseProject)) supabase.value = resources.binding.supabaseProject;
    state.repo = repo; state.supabase = supabase;
    projectGrid.append(field('Projeto Lovable', projectInput), field('Repositório GitHub', repo), field('Projeto Supabase', supabase, true));
    state.body.appendChild(projectGrid);

    const bindingActions = document.createElement('div'); bindingActions.className = 'ed-actions';
    const saveBind = button('Salvar vínculo', true); saveBind.addEventListener('click', () => saveBinding(state));
    bindingActions.appendChild(saveBind); state.body.appendChild(bindingActions);

    const runtime = document.createElement('details'); runtime.className = 'ed-section';
    const summary = document.createElement('summary'); summary.textContent = `IA local · ${resources.local?.endpoint || '127.0.0.1:8000'}${state.tokenConfigured ? ' · token configurado' : ''}`;
    const runtimeGrid = document.createElement('div'); runtimeGrid.className = 'ed-runtime-grid';
    const endpoint = document.createElement('input'); endpoint.value = resources.local?.endpoint || 'http://127.0.0.1:8000';
    const model = document.createElement('input'); model.value = resources.local?.model || 'decrypter-local';
    const token = document.createElement('input'); token.type = 'password'; token.placeholder = state.tokenConfigured ? 'Token já configurado' : 'RUNTIME_TOKEN';
    state.endpoint = endpoint; state.model = model; state.token = token;
    runtimeGrid.append(field('Endpoint local', endpoint), field('Modelo', model), field('Token local', token));
    const runtimeActions = document.createElement('div'); runtimeActions.className = 'ed-actions';
    const healthButton = button('Salvar e testar IA local', true); state.healthButton = healthButton;
    healthButton.addEventListener('click', () => saveLocalAndHealth(state));
    runtimeActions.appendChild(healthButton); runtime.append(summary, runtimeGrid, runtimeActions); state.body.appendChild(runtime);

    const commandSection = document.createElement('div'); commandSection.className = 'ed-section';
    const commandTitle = document.createElement('div'); commandTitle.className = 'ed-section-title';
    const titleText = document.createElement('span'); titleText.textContent = 'Comando';
    const modes = document.createElement('div'); modes.className = 'ed-mode';
    const planMode = button('Plan', true); const buildMode = button('Build', true); buildMode.classList.add('active');
    modes.append(planMode, buildMode); commandTitle.append(titleText, modes);
    const prompt = document.createElement('textarea'); prompt.placeholder = 'Descreva a alteração que você quer no projeto…'; state.prompt = prompt;
    const actions = document.createElement('div'); actions.className = 'ed-actions';
    const execute = button('Preparar Shadow Build'); state.execute = execute;
    actions.appendChild(execute); commandSection.append(commandTitle, prompt, actions); state.body.appendChild(commandSection);

    const result = document.createElement('div'); result.className = 'ed-result'; state.result = result; state.body.appendChild(result);

    const syncMode = () => {
      planMode.classList.toggle('active', state.mode === 'plan');
      buildMode.classList.toggle('active', state.mode === 'build');
      execute.textContent = state.mode === 'plan' ? 'Planejar · ZERO WRITE' : 'Preparar Shadow Build';
    };
    planMode.addEventListener('click', () => { state.mode = 'plan'; syncMode(); });
    buildMode.addEventListener('click', () => { state.mode = 'build'; syncMode(); });
    execute.addEventListener('click', () => state.mode === 'plan' ? executePlan(state) : executeBuild(state));

    if (!state.projectId) setStatus(state, 'Abra um projeto Lovable antes de usar o Editor Direto.', 'error');
    else if (!(resources.repositories || []).length) setStatus(state, 'Nenhum repositório GitHub está disponível ao Decrypter. Configure Integrações > GitHub.', 'error');
    else setStatus(state, `Editor Direto pronto para ${state.projectId}. O runtime local só será chamado quando você executar Plan ou Build.`, 'success');
  }

  function bind() {
    const host = document.getElementById(HOST_ID);
    const shadow = host?.shadowRoot;
    if (!shadow) return false;
    if (shadow.__ld84EditorDirectBound) return true;
    Object.defineProperty(shadow, '__ld84EditorDirectBound', { value: true, configurable: false });

    shadow.addEventListener('click', event => {
      const control = event.target?.closest?.('[data-ld-parity="editor-direct"]');
      if (!control) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      loadEditor(shadow).catch(error => {
        const modal = createModal(shadow);
        modal.status.textContent = error?.message || String(error);
        modal.status.dataset.kind = 'error';
      });
    });
    return true;
  }

  const bound = bind();
  if (!bound && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { bind(); }, { once: true });
  }
})();
