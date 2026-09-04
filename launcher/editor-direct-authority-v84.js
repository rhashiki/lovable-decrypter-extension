(() => {
  'use strict';
  if (window.__LD84_EDITOR_DIRECT_AUTHORITY__) return;
  window.__LD84_EDITOR_DIRECT_AUTHORITY__ = true;

  const HOST_ID = 'lovable-decrypter-launcher';
  const MODAL_ID = 'ld84-editor-direct-modal';

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

  function projectSnapshot() {
    let url;
    try { url = new URL(location.href); } catch (_) { return null; }
    const parts = url.pathname.split('/').filter(Boolean);
    let projectId = '';
    let workspaceId = '';
    for (const marker of ['projects','project']) {
      const i = parts.indexOf(marker);
      if (i >= 0 && parts[i + 1]) { projectId = parts[i + 1]; break; }
    }
    for (const marker of ['workspaces','workspace']) {
      const i = parts.indexOf(marker);
      if (i >= 0 && parts[i + 1]) { workspaceId = parts[i + 1]; break; }
    }
    return {
      detected: url.hostname === 'lovable.dev' || url.hostname.endsWith('.lovable.dev'),
      projectId: String(projectId).slice(0,120),
      workspaceId: String(workspaceId).slice(0,120),
      url: url.href,
      title: String(document.title || '').slice(0,300),
      pathname: url.pathname,
      collectedAt: new Date().toISOString()
    };
  }

  const css = `
    #${MODAL_ID}{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:18px;background:rgba(3,7,16,.6);backdrop-filter:blur(11px);pointer-events:auto;font-family:Arial,sans-serif;color:#f4f8ff}
    #${MODAL_ID} *{box-sizing:border-box}
    #${MODAL_ID} .ed-card{width:min(780px,calc(100vw - 28px));max-height:min(870px,calc(100vh - 28px));overflow:auto;scrollbar-width:thin;scrollbar-color:rgba(82,207,255,.42) rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.11);border-radius:24px;background:linear-gradient(180deg,rgba(20,31,54,.99),rgba(8,15,29,.995));box-shadow:0 30px 100px rgba(0,0,0,.48);padding:20px}
    #${MODAL_ID} .ed-card::-webkit-scrollbar{width:9px}#${MODAL_ID} .ed-card::-webkit-scrollbar-track{background:rgba(255,255,255,.025);border-radius:999px}#${MODAL_ID} .ed-card::-webkit-scrollbar-thumb{background:linear-gradient(180deg,rgba(82,207,255,.58),rgba(121,107,255,.42));border:2px solid rgba(8,15,29,.9);border-radius:999px}
    #${MODAL_ID} .ed-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:14px}#${MODAL_ID} h2{margin:0;font:700 20px/1.2 Arial;color:#fff}#${MODAL_ID} .ed-sub{margin-top:5px;color:#93a3bd;font:12px/1.45 Arial}
    #${MODAL_ID} .ed-close{width:36px;height:36px;border:1px solid rgba(255,255,255,.1);border-radius:12px;background:rgba(255,255,255,.05);color:#e4edfb;font:22px/1 Arial;cursor:pointer}
    #${MODAL_ID} .ed-status{padding:11px 12px;border:1px solid rgba(59,210,255,.17);border-radius:13px;background:rgba(59,210,255,.065);color:#dcecff;font:12px/1.45 Arial;margin-bottom:13px;overflow-wrap:anywhere}#${MODAL_ID} .ed-status[data-kind="error"]{border-color:rgba(255,91,115,.3);background:rgba(255,91,115,.09);color:#ffd5dd}#${MODAL_ID} .ed-status[data-kind="success"]{border-color:rgba(67,216,142,.3);background:rgba(67,216,142,.09);color:#dcffed}
    #${MODAL_ID} .ed-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}#${MODAL_ID} .ed-field{display:grid;gap:5px}#${MODAL_ID} .full{grid-column:1/-1}#${MODAL_ID} .ed-label{color:#8999b3;font:700 10px/1.3 Arial;text-transform:uppercase;letter-spacing:.04em}
    #${MODAL_ID} input,#${MODAL_ID} select,#${MODAL_ID} textarea{width:100%;border:1px solid rgba(255,255,255,.1);border-radius:11px;background:rgba(255,255,255,.045);color:#edf5ff;font:12px/1.45 Arial;outline:none}#${MODAL_ID} input,#${MODAL_ID} select{height:39px;padding:0 11px}#${MODAL_ID} textarea{min-height:122px;resize:vertical;padding:11px 12px}#${MODAL_ID} option{background:#111c31;color:#fff}
    #${MODAL_ID} .ed-section{margin-top:14px;padding-top:13px;border-top:1px solid rgba(255,255,255,.065)}#${MODAL_ID} .ed-section-title{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:9px;color:#e8f1ff;font:700 12px Arial}#${MODAL_ID} .ed-mode,#${MODAL_ID} .ed-actions{display:flex;flex-wrap:wrap;gap:8px}#${MODAL_ID} .ed-actions{justify-content:flex-end;margin-top:11px}
    #${MODAL_ID} .ed-btn{min-height:37px;padding:0 12px;border-radius:11px;border:1px solid rgba(59,210,255,.2);background:rgba(59,210,255,.1);color:#e9f8ff;cursor:pointer;font:600 12px Arial}#${MODAL_ID} .ed-btn.secondary{border-color:rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:#cbd7eb}#${MODAL_ID} .ed-btn.active{border-color:rgba(59,210,255,.42);background:rgba(59,210,255,.18);color:#fff}#${MODAL_ID} .ed-btn:disabled{opacity:.48;cursor:default}
    #${MODAL_ID} details{border:1px solid rgba(255,255,255,.07);border-radius:12px;background:rgba(255,255,255,.025);padding:9px 11px}#${MODAL_ID} details summary{cursor:pointer;color:#dbe7fa;font:600 11px Arial}#${MODAL_ID} .ed-runtime-grid{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:8px;margin-top:9px}
    #${MODAL_ID} .ed-result{display:grid;gap:8px;margin-top:12px}#${MODAL_ID} .ed-result-card{padding:12px;border:1px solid rgba(255,255,255,.07);border-radius:13px;background:rgba(255,255,255,.03)}#${MODAL_ID} .ed-result-card h3{margin:0 0 7px;color:#f2f7ff;font:700 13px Arial}#${MODAL_ID} .ed-result-card p{margin:0;color:#a9b7cb;font:11px/1.5 Arial}#${MODAL_ID} .ed-list{margin:8px 0 0;padding-left:19px;color:#cfdaeb;font:11px/1.55 Arial}
    #${MODAL_ID} .ed-files{display:grid;gap:6px;margin-top:9px}#${MODAL_ID} .ed-file{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 9px;border-radius:10px;background:rgba(255,255,255,.035);font:11px Arial}#${MODAL_ID} .ed-tag{padding:4px 7px;border-radius:999px;background:rgba(59,210,255,.09);color:#bdefff;font:700 9px Arial;text-transform:uppercase}
    #${MODAL_ID} .ed-approve{display:flex;gap:8px;align-items:flex-start;padding:10px 11px;border:1px solid rgba(255,255,255,.07);border-radius:11px;background:rgba(255,255,255,.025);color:#c8d4e6;font:11px/1.45 Arial;margin-top:10px}#${MODAL_ID} .ed-approve input{width:16px;height:16px;margin:0;accent-color:#3bd2ff}#${MODAL_ID} .ed-warning{padding:10px 11px;border-radius:11px;border:1px solid rgba(255,191,71,.18);background:rgba(255,191,71,.06);color:#f5deb1;font:11px/1.45 Arial;margin-top:9px}
    @media(max-width:720px){#${MODAL_ID}{padding:8px}#${MODAL_ID} .ed-card{width:100%;max-height:calc(100vh - 16px);border-radius:18px;padding:15px}#${MODAL_ID} .ed-grid,#${MODAL_ID} .ed-runtime-grid{grid-template-columns:1fr}}
  `;

  function el(tag, cls, text) { const n=document.createElement(tag); if(cls)n.className=cls; if(text!=null)n.textContent=text; return n; }
  function button(text, secondary=false){const n=el('button',`ed-btn${secondary?' secondary':''}`,text);n.type='button';return n;}
  function field(label, control, full=false){const w=el('div',`ed-field${full?' full':''}`);const l=el('label','ed-label',label);w.append(l,control);return w;}
  function option(select,value,label){const o=document.createElement('option');o.value=value;o.textContent=label;select.appendChild(o);}
  function setStatus(state,text,kind=''){state.status.textContent=text;state.status.dataset.kind=kind;}

  function modal(shadow){
    shadow.getElementById(MODAL_ID)?.remove();
    const overlay=el('div');overlay.id=MODAL_ID;const style=el('style');style.textContent=css;
    const card=el('section','ed-card');const head=el('div','ed-head');const titleWrap=el('div');titleWrap.append(el('h2','', 'Editor Direto'),el('div','ed-sub','IA local → contexto GitHub → Plan/Shadow Build → revisão explícita → Apply'));
    const close=button('×',true);close.className='ed-close';close.setAttribute('aria-label','Fechar');head.append(titleWrap,close);
    const status=el('div','ed-status','Carregando projeto e integrações…');const body=el('div');card.append(head,status,body);overlay.append(style,card);shadow.appendChild(overlay);
    close.addEventListener('click',()=>overlay.remove(),{once:true});overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove();});return {overlay,card,status,body};
  }

  function resultPlan(state,out){
    state.result.replaceChildren();const card=el('div','ed-result-card');card.append(el('h3','', 'Plano · ZERO WRITE'),el('p','',out?.plan?.summary||'Plano gerado.'));
    const steps=Array.isArray(out?.plan?.plan)?out.plan.plan:[];if(steps.length){const ol=el('ol','ed-list');for(const s of steps)ol.append(el('li','',s));card.append(ol);}
    const files=[...(out?.plan?.relevantFiles||[]),...(out?.plan?.newFiles||[])];if(files.length){const box=el('div','ed-files');for(const p of files){const row=el('div','ed-file');row.append(el('b','',p),el('span','ed-tag',(out?.plan?.newFiles||[]).includes(p)?'novo':'ler'));box.append(row);}card.append(box);}
    if(out?.plan?.supabaseRequired)card.append(el('div','ed-warning','Este plano exige aplicação Supabase. O Apply permanece bloqueado até o runtime de escrita Supabase ser reativado.'));
    const actions=el('div','ed-actions');const prepare=button('Preparar Shadow Build');prepare.addEventListener('click',()=>runBuild(state));actions.append(prepare);card.append(actions);state.result.append(card);
  }

  function resultShadow(state,out){
    state.result.replaceChildren();state.shadowId=out.shadowId||'';const card=el('div','ed-result-card');card.append(el('h3','', 'Shadow Build pronto · nenhum write executado'),el('p','',out.summary||'Alterações preparadas em memória.'));
    card.append(el('p','',`${out.repository||''} · ${out.branch||'main'} · base ${(out.baseHeadSha||'').slice(0,8)}`));const files=el('div','ed-files');for(const f of out.files||[]){const row=el('div','ed-file');row.append(el('b','',f.path),el('span','ed-tag',f.action));files.append(row);}card.append(files);
    if(out.applyBlocked){card.append(el('div','ed-warning',`Apply bloqueado: ${out.applyBlockedReason||'dependência indisponível'}.`));}
    else {const approve=el('label','ed-approve');const cb=document.createElement('input');cb.type='checkbox';approve.append(cb,el('span','', 'Revisei os arquivos acima e autorizo explicitamente a criação do commit no GitHub. O HEAD será revalidado antes do Apply.'));card.append(approve);const actions=el('div','ed-actions');const apply=button('Aplicar no GitHub');apply.disabled=true;cb.addEventListener('change',()=>{apply.disabled=!cb.checked;});apply.addEventListener('click',()=>runApply(state,apply));actions.append(apply);card.append(actions);}
    state.result.append(card);
  }

  function resultApplied(state,out){state.result.replaceChildren();const card=el('div','ed-result-card');card.append(el('h3','', 'GitHub atualizado'),el('p','',`Commit ${(out.commitSha||'').slice(0,8)} criado em ${out.repository||''}. O GitSync/Preview do Lovable ainda será validado separadamente.`));if(out.commitUrl){const actions=el('div','ed-actions');const open=button('Abrir commit',true);open.addEventListener('click',()=>window.open(out.commitUrl,'_blank','noopener,noreferrer'));actions.append(open);card.append(actions);}state.result.append(card);}

  async function saveBinding(state,quiet=false){
    const repository=state.repo.value;const info=(state.resources.repositories||[]).find(r=>r.fullName===repository);const branch=info?.defaultBranch||state.resources.binding?.branch||'main';
    const out=await send({type:'ld84.editor.bind',projectId:state.projectId,repository,branch,supabaseProject:state.supabase.value});if(!out?.ok){if(!quiet)setStatus(state,out?.message||out?.code||'Falha ao salvar vínculo.','error');return false;}state.resources.binding=out.binding;if(!quiet)setStatus(state,`Vínculo salvo: ${repository}${state.supabase.value?` · Supabase ${state.supabase.value}`:''}.`,'success');return true;
  }
  async function health(state){state.health.disabled=true;const saved=await send({type:'ld84.editor.configure',endpoint:state.endpoint.value,model:state.model.value,token:state.token.value,preserveToken:state.token.value===''&&state.tokenConfigured});if(!saved?.ok){state.health.disabled=false;return setStatus(state,saved?.message||saved?.code||'Configuração local inválida.','error');}const out=await send({type:'ld84.editor.health'});state.health.disabled=false;state.tokenConfigured=Boolean(saved?.local?.tokenConfigured??(state.tokenConfigured||state.token.value));const h=out?.health;if(h?.ok)setStatus(state,`IA local pronta · ${h.runtime||'local'} · ${h.model||h.servedModel||state.model.value} · ${h.latencyMs||0} ms.`,'success');else setStatus(state,`IA local indisponível: ${h?.code||out?.code||'LOCAL_RUNTIME_UNAVAILABLE'}.`,'error');}
  async function runPlan(state){if(state.busy)return;const command=state.prompt.value.trim();if(!command)return setStatus(state,'Digite o que você quer alterar no projeto.','error');if(!(await saveBinding(state,true)))return setStatus(state,'Selecione e salve um repositório válido.','error');state.busy=true;state.execute.disabled=true;setStatus(state,'IA local planejando · ZERO WRITE…');const out=await send({type:'ld84.editor.plan',command,projectId:state.projectId,repository:state.repo.value,supabaseProject:state.supabase.value});state.busy=false;state.execute.disabled=false;if(!out?.ok)return setStatus(state,out?.message||out?.code||'Falha no planejamento local.','error');setStatus(state,`Plano pronto com ${out?.plan?.plan?.length||0} etapa(s) · nenhum arquivo alterado.`,'success');resultPlan(state,out);}
  async function runBuild(state){if(state.busy)return;const command=state.prompt.value.trim();if(!command)return setStatus(state,'Digite o que você quer alterar no projeto.','error');if(!(await saveBinding(state,true)))return setStatus(state,'Selecione e salve um repositório válido.','error');state.busy=true;state.execute.disabled=true;setStatus(state,'IA local lendo o escopo e preparando Shadow Build · ZERO WRITE…');const out=await send({type:'ld84.editor.build',command,projectId:state.projectId,repository:state.repo.value,supabaseProject:state.supabase.value});state.busy=false;state.execute.disabled=false;if(!out?.ok)return setStatus(state,out?.message||out?.code||'Falha ao preparar Shadow Build.','error');setStatus(state,`Shadow Build pronto · ${out.files?.length||0} arquivo(s) · nenhum commit criado.`,'success');resultShadow(state,out);}
  async function runApply(state,node){if(state.busy||!state.shadowId)return;state.busy=true;node.disabled=true;setStatus(state,'Revalidando Trust + HEAD e aplicando commit GitHub…');const out=await send({type:'ld84.editor.apply',shadowId:state.shadowId});state.busy=false;if(!out?.ok){node.disabled=false;return setStatus(state,out?.message||out?.code||'Apply recusado.','error');}state.shadowId='';setStatus(state,`Commit ${(out.commitSha||'').slice(0,8)} confirmado no GitHub.`,'success');resultApplied(state,out);}

  async function openEditor(shadow){
    const ui=modal(shadow);const context=projectSnapshot();if(context)await send({type:'ld84.project.snapshot',context});const resources=await send({type:'ld84.editor.resources'});if(!resources?.ok){ui.status.textContent=resources?.message||resources?.code||'Não foi possível carregar o Editor Direto.';ui.status.dataset.kind='error';return;}
    const state={...ui,resources,projectId:resources.projectId||'',mode:'build',busy:false,shadowId:'',tokenConfigured:resources.local?.tokenConfigured===true};
    const grid=el('div','ed-grid');const project=document.createElement('input');project.readOnly=true;project.value=state.projectId||'Projeto Lovable não identificado';const repo=document.createElement('select');option(repo,'','Selecione o repositório');for(const r of resources.repositories||[])option(repo,r.fullName,r.fullName);const supabase=document.createElement('select');option(supabase,'','Sem projeto Supabase');for(const p of resources.supabaseProjects||[])option(supabase,p.ref,`${p.name||p.ref} · ${p.ref}`);if(resources.binding?.repository&&[...repo.options].some(o=>o.value===resources.binding.repository))repo.value=resources.binding.repository;else if((resources.repositories||[]).length===1)repo.value=resources.repositories[0].fullName;if(resources.binding?.supabaseProject&&[...supabase.options].some(o=>o.value===resources.binding.supabaseProject))supabase.value=resources.binding.supabaseProject;state.repo=repo;state.supabase=supabase;grid.append(field('Projeto Lovable',project),field('Repositório GitHub',repo),field('Projeto Supabase',supabase,true));state.body.append(grid);
    const bindActions=el('div','ed-actions');const save=button('Salvar vínculo',true);save.addEventListener('click',()=>saveBinding(state));bindActions.append(save);state.body.append(bindActions);
    const details=document.createElement('details');details.className='ed-section';const summary=document.createElement('summary');summary.textContent=`IA local · ${resources.local?.endpoint||'127.0.0.1:8000'}${state.tokenConfigured?' · token configurado':''}`;const runtimeGrid=el('div','ed-runtime-grid');const endpoint=document.createElement('input');endpoint.value=resources.local?.endpoint||'http://127.0.0.1:8000';const model=document.createElement('input');model.value=resources.local?.model||'decrypter-local';const token=document.createElement('input');token.type='password';token.placeholder=state.tokenConfigured?'Token já configurado':'RUNTIME_TOKEN';state.endpoint=endpoint;state.model=model;state.token=token;runtimeGrid.append(field('Endpoint local',endpoint),field('Modelo',model),field('Token local',token));const runtimeActions=el('div','ed-actions');const healthBtn=button('Salvar e testar IA local',true);state.health=healthBtn;healthBtn.addEventListener('click',()=>health(state));runtimeActions.append(healthBtn);details.append(summary,runtimeGrid,runtimeActions);state.body.append(details);
    const command=el('div','ed-section');const title=el('div','ed-section-title');title.append(el('span','', 'Comando'));const modes=el('div','ed-mode');const plan=button('Plan',true);const build=button('Build',true);build.classList.add('active');modes.append(plan,build);title.append(modes);const prompt=document.createElement('textarea');prompt.placeholder='Descreva a alteração que você quer no projeto…';state.prompt=prompt;const actions=el('div','ed-actions');const execute=button('Preparar Shadow Build');state.execute=execute;actions.append(execute);command.append(title,prompt,actions);state.body.append(command);const result=el('div','ed-result');state.result=result;state.body.append(result);
    const sync=()=>{plan.classList.toggle('active',state.mode==='plan');build.classList.toggle('active',state.mode==='build');execute.textContent=state.mode==='plan'?'Planejar · ZERO WRITE':'Preparar Shadow Build';};plan.addEventListener('click',()=>{state.mode='plan';sync();});build.addEventListener('click',()=>{state.mode='build';sync();});execute.addEventListener('click',()=>state.mode==='plan'?runPlan(state):runBuild(state));
    if(!state.projectId)setStatus(state,'Abra um projeto Lovable antes de usar o Editor Direto.','error');else if(!(resources.repositories||[]).length)setStatus(state,'Nenhum repositório GitHub está disponível ao Decrypter. Configure Integrações > GitHub.','error');else setStatus(state,`Editor Direto pronto para ${state.projectId}. O runtime local só é chamado ao executar Plan ou Build.`,'success');
  }

  function bind(){
    const host=document.getElementById(HOST_ID);const shadow=host?.shadowRoot;if(!shadow)return false;if(shadow.__ld84EditorDirectAuthorityBound)return true;
    const control=shadow.querySelector('[data-ld-parity="editor-direct"], [data-ld-editor-direct]');if(!control)return false;
    delete control.dataset.ldParity;control.dataset.ldEditorDirect='true';control.title='Editor Direto';
    control.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();openEditor(shadow).catch(error=>{const ui=modal(shadow);ui.status.textContent=error?.message||String(error);ui.status.dataset.kind='error';});},true);
    Object.defineProperty(shadow,'__ld84EditorDirectAuthorityBound',{value:true,configurable:false});return true;
  }

  if(!bind()&&document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{bind();},{once:true});
})();
