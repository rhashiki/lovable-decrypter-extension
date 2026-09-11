(() => {
  'use strict';
  if (window.__LD84_EDITOR_NATIVE_CHAT__) return;
  window.__LD84_EDITOR_NATIVE_CHAT__ = true;

  const HOST_ID = 'lovable-decrypter-launcher';
  const PREF_KEY = 'ld84_native_compose';
  const PROGRESS_KEY = 'ld84_editor_progress';
  const OWN = 'data-ld84-native-chat';
  const state = {
    input: null,
    container: null,
    compact: null,
    bar: null,
    thread: null,
    modeButton: null,
    queueLabel: null,
    enabled: false,
    mode: 'build',
    busy: false,
    reviewPending: false,
    activeRun: null,
    queue: [],
    originalPlaceholder: ''
  };

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
  function getLocal(keys){return new Promise(resolve=>chrome.storage.local.get(keys,value=>resolve(value||{})));}
  function setLocal(value){return new Promise(resolve=>chrome.storage.local.set(value,()=>resolve()));}
  function shadow(){return document.getElementById(HOST_ID)?.shadowRoot||null;}
  function el(tag,text,css=''){const n=document.createElement(tag);if(text!=null)n.textContent=text;if(css)n.style.cssText=css;n.setAttribute(OWN,'1');return n;}
  function btn(text,primary=false){const b=el('button',text,`border:1px solid ${primary?'rgba(139,92,246,.52)':'rgba(255,255,255,.12)'};background:${primary?'rgba(109,40,217,.82)':'rgba(255,255,255,.06)'};color:#eef5ff;border-radius:9px;padding:7px 10px;font:600 11px Arial;cursor:pointer`);b.type='button';return b;}
  function isOwn(node){return node instanceof Element&&!!node.closest(`[${OWN}]`);}
  function isEditable(node){return node instanceof Element&&!isOwn(node)&&(node.matches('textarea')||node.getAttribute('contenteditable')==='true');}
  function readInput(input){return input instanceof HTMLTextAreaElement?String(input.value||'').trim():String(input.innerText||input.textContent||'').trim();}
  function clearInput(input){
    if(input instanceof HTMLTextAreaElement){const set=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')?.set;if(set)set.call(input,'');else input.value='';}
    else input.textContent='';
    input.dispatchEvent(new Event('input',{bubbles:true}));
  }
  function semanticSend(button){
    if(!(button instanceof HTMLButtonElement)||isOwn(button))return false;
    if(String(button.type||'').toLowerCase()==='submit')return true;
    const text=[button.getAttribute('aria-label'),button.getAttribute('title'),button.textContent].filter(Boolean).join(' ').toLowerCase();
    return /\b(send|submit|enviar|mandar|run|prompt|message)\b/.test(text);
  }
  function composerScore(input){
    const r=input.getBoundingClientRect();if(r.width<250||r.height<26||r.bottom<innerHeight*.42)return 0;
    let score=1;const hint=[input.getAttribute('placeholder'),input.getAttribute('aria-label'),input.getAttribute('data-placeholder')].filter(Boolean).join(' ').toLowerCase();
    if(/ask|message|prompt|describe|lovable|chat|build|create|edit|pergunte|criar/.test(hint))score+=4;
    let a=input.parentElement;for(let d=0;a&&d<7;d++,a=a.parentElement){if(a.matches('form'))score+=2;if([...a.querySelectorAll('button')].some(semanticSend))score+=3;const s=[a.getAttribute('aria-label'),a.getAttribute('data-testid'),a.className].filter(v=>typeof v==='string').join(' ').toLowerCase();if(/chat|composer|prompt|message/.test(s))score+=2;}return score;
  }
  function composerContainer(input){let a=input.parentElement,b=a;for(let d=0;a&&d<8;d++,a=a.parentElement){b=a;if(a.matches('form')||[...a.querySelectorAll('button')].some(semanticSend))return a;}return b||input.parentElement;}
  function bestComposer(){return [...document.querySelectorAll('textarea,[contenteditable="true"]')].filter(isEditable).map(input=>({input,score:composerScore(input)})).sort((a,b)=>b.score-a.score)[0]?.input||null;}
  function elapsed(start){const s=Math.max(0,Math.floor((Date.now()-start)/1000));return s<60?`${s}s`:`${Math.floor(s/60)}m ${String(s%60).padStart(2,'0')}s`;}
  function friendlyError(value){const code=String(value?.code||value?.message||'EDITOR_OPERATION_FAILED');if(code==='GEMINI_HTTP_429'||code==='GEMINI_RATE_LIMITED')return 'Gemini atingiu o limite de uso. O retry único terminou e nenhum write foi executado.';if(code==='EDITOR_CANCELLED_BY_USER')return 'Operação cancelada. Nenhum write foi executado.';return code;}
  function toast(text,error=false){document.querySelector(`[${OWN}="toast"]`)?.remove();const n=el('div',text,`position:fixed;right:18px;bottom:18px;z-index:2147483646;max-width:390px;padding:10px 12px;border-radius:11px;font:11px/1.4 Arial;background:${error?'rgba(72,19,31,.97)':'rgba(8,18,32,.97)'};border:1px solid ${error?'rgba(255,91,115,.45)':'rgba(56,189,248,.3)'};color:${error?'#ffd5dd':'#e8f5ff'};box-shadow:0 14px 40px rgba(0,0,0,.35)`);n.setAttribute(OWN,'toast');document.documentElement.append(n);setTimeout(()=>n.remove(),5000);}

  function removeSurface(){for(const key of ['compact','bar','thread']){state[key]?.remove();state[key]=null;}}
  function positionSurface(){
    if(!state.container?.isConnected)return;
    const r=state.container.getBoundingClientRect();
    if(state.compact){state.compact.style.left=`${Math.max(8,r.right-132)}px`;state.compact.style.top=`${Math.max(8,r.bottom-39)}px`;}
    if(state.bar){const width=Math.max(260,r.width-18);state.bar.style.left=`${Math.max(6,r.left+9)}px`;state.bar.style.width=`${width}px`;state.bar.style.top=`${Math.min(innerHeight-30,Math.max(6,r.bottom-12))}px`;}
    if(state.thread){state.thread.style.left=`${Math.max(0,r.left)}px`;state.thread.style.width=`${Math.max(300,r.width)}px`;state.thread.style.bottom=`${Math.max(70,innerHeight-r.top+8)}px`;state.thread.style.maxHeight=`${Math.max(160,Math.min(580,r.top-75))}px`;}
  }
  function makeSurface(){
    removeSurface();
    state.compact=btn('Decrypter');state.compact.style.cssText+=';position:fixed;z-index:2147483605;height:27px;padding:0 9px;box-shadow:0 6px 18px rgba(0,0,0,.28)';state.compact.onclick=e=>{e.preventDefault();e.stopPropagation();setEnabled(!state.enabled);};document.documentElement.append(state.compact);
    state.bar=el('div',null,'position:fixed;z-index:2147483605;height:25px;display:none;align-items:center;gap:7px;padding:0 9px;border-radius:999px;border:1px solid rgba(139,92,246,.38);background:rgba(8,15,25,.98);box-shadow:0 8px 22px rgba(0,0,0,.32);color:#dce8f8;font:10px Arial;cursor:pointer;box-sizing:border-box');const dot=el('span','●','color:#34d399;font-size:9px');const label=el('span','⚡ Editor direto ativo · comandos do chat vão para o Decrypter','flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis');state.queueLabel=el('span','','color:#94a3b8;white-space:nowrap');state.modeButton=btn('Build');state.modeButton.style.cssText='height:19px;padding:0 7px;border-radius:999px;border:1px solid rgba(139,92,246,.3);background:rgba(76,29,149,.38);color:#e9ddff;font:700 9px Arial;cursor:pointer';state.bar.append(dot,label,state.queueLabel,state.modeButton);state.bar.onclick=e=>{if(e.target===state.modeButton)return;setEnabled(false);};state.modeButton.onclick=e=>{e.preventDefault();e.stopPropagation();state.mode=state.mode==='build'?'plan':'build';refreshChrome();savePref();};document.documentElement.append(state.bar);
    state.thread=el('div',null,'position:fixed;z-index:2147483604;overflow:auto;display:grid;align-content:end;gap:10px;padding:5px 7px;pointer-events:auto;font-family:Arial,sans-serif;scrollbar-width:thin;box-sizing:border-box');document.documentElement.append(state.thread);positionSurface();refreshChrome();
  }
  async function mount(input){if(composerScore(input)<4)return;if(state.input===input&&state.container?.isConnected){positionSurface();return;}state.input=input;state.container=composerContainer(input);if(!state.container)return;state.originalPlaceholder=input instanceof HTMLTextAreaElement?input.placeholder:'';const stored=await getLocal([PREF_KEY]);const pref=stored[PREF_KEY]||{};state.enabled=pref.enabled===true;state.mode=pref.mode==='plan'?'plan':'build';makeSurface();bindSidebar();}
  async function savePref(){await setLocal({[PREF_KEY]:{enabled:state.enabled,mode:state.mode}});}
  async function setEnabled(value){if(!state.input?.isConnected){const input=bestComposer();if(input)await mount(input);}if(!state.input)return toast('Foque o compose do Lovable para ativar o Editor Direto.',true);state.enabled=value===true;refreshChrome();positionSurface();await savePref();}
  function refreshChrome(){
    if(state.compact){state.compact.textContent=state.enabled?'Decrypter ON':'Decrypter';state.compact.style.background=state.enabled?'rgba(76,29,149,.97)':'rgba(8,18,32,.96)';state.compact.style.borderColor=state.enabled?'rgba(167,139,250,.58)':'rgba(255,255,255,.12)';}
    if(state.bar)state.bar.style.display=state.enabled?'flex':'none';if(state.modeButton)state.modeButton.textContent=state.mode==='plan'?'Plan':'Build';if(state.queueLabel)state.queueLabel.textContent=state.queue.length?`fila ${state.queue.length}`:'';
    if(state.input instanceof HTMLTextAreaElement)state.input.placeholder=(state.busy||state.reviewPending)?'Colocar próxima mensagem na fila…':state.originalPlaceholder;
    const side=shadow()?.querySelector('[data-ld-editor-direct], [data-ld-parity="editor-direct"]');if(side){side.setAttribute('aria-pressed',state.enabled?'true':'false');side.style.boxShadow=state.enabled?'inset 3px 0 #8b5cf6':'';}
  }
  function bindSidebar(){const root=shadow();if(!root||root.__ld84NativeChatPrimaryBound)return;root.addEventListener('click',event=>{const target=event.target instanceof Element?event.target.closest('[data-ld-editor-direct], [data-ld-parity="editor-direct"]'):null;if(!target||event.altKey)return;event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();setEnabled(!state.enabled);},true);Object.defineProperty(root,'__ld84NativeChatPrimaryBound',{value:true});}

  function appendUser(command,queued=false){if(!state.thread)return;const box=el('div',null,'justify-self:end;max-width:88%;display:grid;gap:4px');const bubble=el('div',command,'padding:11px 13px;border-radius:15px 15px 4px 15px;background:linear-gradient(135deg,#7c3aed,#9333ea);color:white;font:600 12px/1.45 Arial;box-shadow:0 8px 24px rgba(76,29,149,.24);white-space:pre-wrap');box.append(bubble);if(queued)box.append(el('span','Na fila','justify-self:end;color:#94a3b8;font:9px Arial'));state.thread.append(box);trimThread();scrollThread();}
  function assistantCard(){const card=el('section',null,'padding:12px 13px;border:1px solid rgba(255,255,255,.09);border-radius:14px;background:rgba(10,15,24,.97);color:#e9f2ff;box-shadow:0 12px 34px rgba(0,0,0,.3)');card.setAttribute(OWN,'card');state.thread?.append(card);trimThread();scrollThread();return card;}
  function trimThread(){if(!state.thread)return;while(state.thread.children.length>12)state.thread.firstElementChild?.remove();}
  function scrollThread(){if(state.thread)state.thread.scrollTop=state.thread.scrollHeight;}
  function stageNames(kind){return kind==='plan'?['Lendo o projeto','Planejando','Validando','Plano pronto']:['Lendo o projeto','Planejando','Montando contexto','Gerando alterações','Validando Scope','Aguardando sua revisão'];}
  function stageIndex(progress,run){if(run.partial)return 5;if(run.review)return 5;if(progress?.status==='complete')return run.kind==='plan'?3:4;const p=String(progress?.phase||'');if(/shadow-validate/.test(p))return 4;if(/shadow-model/.test(p))return 3;if(/context/.test(p))return 2;if(/planning/.test(p))return 1;return 0;}
  function renderRun(run,progress=run.progress){
    if(!run?.card)return;run.progress=progress;run.card.replaceChildren();const head=el('div',null,'display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:9px');run.elapsedNode=el('span',`há ${elapsed(run.started)}`,'font:10px Arial;color:#8ca0bd');head.append(el('b',run.kind==='plan'?'Editor Direto · Plan':'Editor Direto · Build','font:700 12px Arial;color:#fff'),run.elapsedNode);run.card.append(head);
    const idx=stageIndex(run.progress,run);const list=el('div',null,'display:grid;gap:7px');stageNames(run.kind).forEach((name,i)=>{const row=el('div',null,'display:flex;gap:8px;align-items:center;font:11px/1.3 Arial');row.append(el('span',i<idx?'✓':i===idx?'●':'○',`width:14px;color:${i<idx?'#45dc98':i===idx?'#60a5fa':'#64748b'};font-weight:700`),el('span',name,`color:${i<=idx?'#dce8f8':'#7b8ba3'}`));list.append(row);});run.card.append(list);if(run.progress?.label)run.card.append(el('div',run.progress.label,'margin-top:9px;padding-top:8px;border-top:1px solid rgba(255,255,255,.06);font:10px/1.4 Arial;color:#8fa4c0'));
    if(run.busy&&!run.applying){const actions=el('div',null,'display:flex;justify-content:flex-end;margin-top:10px');const stop=btn(run.stopRequested?'Parando…':'Parar');stop.disabled=run.stopRequested;stop.onclick=()=>cancelRun(run,stop);actions.append(stop);run.card.append(actions);}
    if(run.error)renderError(run);else if(run.plan)renderPlan(run);else if(run.partial)renderPartial(run);else if(run.shadow)renderShadow(run);else if(run.receipt)renderReceipt(run);scrollThread();
  }
  function runTick(run){if(!run.busy||run!==state.activeRun)return;if(run.elapsedNode)run.elapsedNode.textContent=`há ${elapsed(run.started)}`;run.timer=setTimeout(()=>runTick(run),1000);}
  function renderError(run){run.card.append(el('div',friendlyError(run.error),'margin-top:10px;padding:9px 10px;border:1px solid rgba(255,91,115,.25);border-radius:10px;background:rgba(255,91,115,.08);color:#ffd6de;font:11px/1.45 Arial'));}
  function renderPlan(run){const p=run.plan||{};const box=el('div',null,'margin-top:10px;padding-top:9px;border-top:1px solid rgba(255,255,255,.07)');box.append(el('b','Plano · ZERO WRITE','font:700 11px Arial;color:#c7f0ff'));if(p.summary)box.append(el('div',p.summary,'margin-top:6px;font:11px/1.45 Arial;color:#cbd6e8'));if(Array.isArray(p.plan)&&p.plan.length){const ol=document.createElement('ol');ol.setAttribute(OWN,'1');ol.style.cssText='margin:8px 0 0;padding-left:18px;color:#aebdd2;font:11px/1.5 Arial';p.plan.forEach(s=>{const li=document.createElement('li');li.textContent=s;ol.append(li);});box.append(ol);}const actions=el('div',null,'display:flex;justify-content:flex-end;margin-top:9px');const build=btn('Preparar Shadow Build',true);build.onclick=()=>startCommand(run.command,'build',false,true);actions.append(build);box.append(actions);run.card.append(box);}
  function fileList(files){const box=el('div',null,'display:grid;gap:5px;margin-top:8px');(files||[]).forEach(file=>{const row=el('div',null,'display:flex;justify-content:space-between;gap:12px;padding:7px 8px;border-radius:8px;background:rgba(255,255,255,.04);font:10px Arial');row.append(el('b',file.path||'arquivo','color:#dbeafe'),el('span',String(file.action||'update').toUpperCase(),'color:#7dd3fc'));box.append(row);});return box;}
  function renderShadow(run){const out=run.shadow;const box=el('div',null,'margin-top:10px;padding-top:9px;border-top:1px solid rgba(255,255,255,.07)');box.append(el('b','Shadow Build pronto · ZERO WRITE','font:700 11px Arial;color:#baf7d4'),fileList(out.files));if(out.supabaseApplyRequired)box.append(el('div',`${(out.supabaseMigrations||[]).length} migration(s) Supabase serão aplicadas somente depois do commit GitHub.`,'margin-top:8px;font:10px/1.4 Arial;color:#f5d69a'));const approve=el('label',null,'display:flex;gap:8px;align-items:flex-start;margin-top:10px;padding:8px;border-radius:9px;background:rgba(255,255,255,.035);font:10px/1.4 Arial;color:#cbd5e1');const check=document.createElement('input');check.type='checkbox';check.setAttribute(OWN,'1');check.style.marginTop='1px';approve.append(check,el('span',out.supabaseApplyRequired?'Revisei os arquivos e autorizo o commit GitHub seguido das migrations Supabase listadas.':'Revisei os arquivos e autorizo o commit GitHub.'));box.append(approve);const actions=el('div',null,'display:flex;gap:7px;justify-content:flex-end;margin-top:9px');const discard=btn('Descartar');const apply=btn(out.supabaseApplyRequired?'Aplicar GitHub + Supabase':'Aplicar no GitHub',true);apply.disabled=true;check.onchange=()=>apply.disabled=!check.checked;discard.onclick=()=>discardShadow(run);apply.onclick=()=>applyShadow(run,apply);actions.append(discard,apply);box.append(actions);run.card.append(box);}
  function renderPartial(run){const out=run.partial;const box=el('div',null,'margin-top:10px;padding-top:9px;border-top:1px solid rgba(255,255,255,.07)');box.append(el('b','GitHub aplicado · Supabase pendente','font:700 11px Arial;color:#f6d58f'),el('div',`Commit ${(out.commitSha||'').slice(0,8)} já existe. O Git não será repetido.`,'margin-top:6px;font:10px/1.45 Arial;color:#cbd5e1'));const actions=el('div',null,'display:flex;gap:7px;justify-content:flex-end;margin-top:9px');if(out.commitUrl){const open=btn('Abrir commit');open.onclick=()=>window.open(out.commitUrl,'_blank','noopener,noreferrer');actions.append(open);}const retry=btn('Tentar Supabase novamente',true);retry.disabled=!out.recoveryId;retry.onclick=()=>retrySupabase(run,retry);actions.append(retry);box.append(actions);run.card.append(box);}
  function renderReceipt(run){const out=run.receipt;const box=el('div',null,'margin-top:10px;padding-top:9px;border-top:1px solid rgba(255,255,255,.07)');box.append(el('b',out.supabaseApply?.ok?'✓ GitHub + Supabase atualizados':'✓ GitHub atualizado','font:700 11px Arial;color:#86efac'),el('div',`Commit ${(out.commitSha||'').slice(0,8)} · ${out.repository||''}`,'margin-top:6px;font:11px Arial;color:#dbeafe'));if(out.supabaseApply?.ok)box.append(el('div',`Supabase: ${(out.supabaseApply.applied||[]).length} aplicada(s), ${(out.supabaseApply.skipped||[]).length} já registrada(s).`,'margin-top:5px;font:10px Arial;color:#9fb1c8'));const gh=out.syncVerification?.github;box.append(el('div',gh?.verified===true?'HEAD do GitHub confirmado no commit criado.':'Commit criado; confirmação do HEAD deve ser revisada no GitHub Sync.','margin-top:7px;font:10px/1.4 Arial;color:#91a4bd'),el('div','Preview do Lovable é uma autoridade separada e pode reconstruir depois.','margin-top:4px;font:10px/1.4 Arial;color:#91a4bd'));if(out.commitUrl){const open=el('a','Abrir commit','display:inline-block;margin-top:8px;color:#7dd3fc;font:600 10px Arial;text-decoration:none');open.href=out.commitUrl;open.target='_blank';open.rel='noopener noreferrer';box.append(open);}run.card.append(box);}

  function binding(resources){const b=resources?.binding||{};const repos=Array.isArray(resources?.repositories)?resources.repositories:[];const projects=Array.isArray(resources?.supabaseProjects)?resources.supabaseProjects:[];const repository=b.repository||(repos.length===1?repos[0].fullName:'');const branch=b.branch||(repos.find(r=>r.fullName===repository)?.defaultBranch||'main');const supabase=b.supabaseProject||(projects.length===1?projects[0].ref:'');return {repository,branch,supabase};}
  async function cancelRun(run,button){if(!run?.busy||run.applying)return;run.stopRequested=true;button.disabled=true;await send({type:'ld84.cancel.current'});renderRun(run);}
  async function startCommand(command,kind=state.mode,queued=false,reuse=false){
    if(!command)return;if(state.busy||state.reviewPending){state.queue.push({command,kind});if(!queued&&!reuse)appendUser(command,true);refreshChrome();return toast(`Mensagem adicionada à fila (${state.queue.length}).`);}
    state.busy=true;refreshChrome();if(!queued&&!reuse)appendUser(command,false);const run={command,kind,started:Date.now(),busy:true,applying:false,review:false,card:assistantCard(),progress:null,error:null,plan:null,shadow:null,partial:null,receipt:null};state.activeRun=run;renderRun(run);runTick(run);
    try{
      const resources=await send({type:'ld84.editor.resources'});if(!resources?.ok)throw resources;const b=binding(resources);if(!resources.projectId)throw {code:'EDITOR_PROJECT_ID_REQUIRED'};if(!b.repository)throw {code:'EDITOR_REPOSITORY_BINDING_REQUIRED',message:'Salve o vínculo do projeto no painel avançado.'};
      const out=await send({type:kind==='plan'?'ld84.editor.plan':'ld84.editor.build',command,projectId:resources.projectId,repository:b.repository,branch:b.branch,supabaseProject:b.supabase});if(!out?.ok)throw out;
      run.busy=false;clearTimeout(run.timer);state.busy=false;
      if(kind==='plan'){run.plan=out.plan||{};renderRun(run,{schema:'ld-editor-progress/1',kind:'plan',status:'complete',phase:'complete',label:'Plano pronto · nenhum write executado',step:4,total:4});processQueue();}
      else{run.shadow=out;run.review=true;state.reviewPending=true;renderRun(run,{schema:'ld-editor-progress/1',kind:'build',status:'complete',phase:'complete',label:'Shadow pronto · aguardando sua revisão',step:8,total:8});}
    }catch(error){run.busy=false;clearTimeout(run.timer);state.busy=false;run.error=error;renderRun(run);processQueue();}finally{refreshChrome();}
  }
  async function applyShadow(run,button){if(!run?.shadow?.shadowId||state.busy)return;state.busy=true;state.reviewPending=false;run.review=false;run.busy=true;run.applying=true;button.disabled=true;refreshChrome();renderRun(run,{schema:'ld-editor-progress/1',kind:'build',phase:'apply',status:'running',label:'Aplicando · revalidando Trust, HEAD e Scope',step:5,total:6});
    try{const out=await send({type:'ld84.editor.apply',shadowId:run.shadow.shadowId,supabaseApproved:run.shadow.supabaseApplyRequired===true});if(!out?.ok)throw out;run.busy=false;run.applying=false;state.busy=false;run.receipt=out;run.shadow=null;renderRun(run,{schema:'ld-editor-progress/1',kind:'build',phase:'complete',status:'complete',label:'Aplicação confirmada',step:6,total:6});processQueue();}
    catch(error){run.busy=false;run.applying=false;state.busy=false;if(error?.gitApplied===true){run.shadow=null;run.partial=error;state.reviewPending=true;renderRun(run,{schema:'ld-editor-progress/1',kind:'build',phase:'supabase-pending',status:'error',label:'GitHub aplicado · Supabase pendente',step:5,total:6});}else{run.error=error;run.review=true;state.reviewPending=true;renderRun(run);} }finally{refreshChrome();}
  }
  async function retrySupabase(run,button){if(!run?.partial?.recoveryId||state.busy)return;state.busy=true;run.busy=true;run.applying=true;button.disabled=true;refreshChrome();renderRun(run,{schema:'ld-editor-progress/1',kind:'build',phase:'supabase-retry',status:'running',label:'Retry Supabase · GitHub não será repetido',step:5,total:6});
    try{const out=await send({type:'ld84.editor.supabase.retry',recoveryId:run.partial.recoveryId,supabaseApproved:true});if(!out?.ok)throw out;run.partial=null;run.receipt=out;run.busy=false;run.applying=false;state.busy=false;state.reviewPending=false;renderRun(run,{schema:'ld-editor-progress/1',kind:'build',phase:'complete',status:'complete',label:'Supabase confirmado sem repetir Git',step:6,total:6});processQueue();}
    catch(error){run.partial={...run.partial,...error};run.busy=false;run.applying=false;state.busy=false;state.reviewPending=true;renderRun(run);}finally{refreshChrome();}
  }
  function discardShadow(run){run.shadow=null;run.review=false;state.reviewPending=false;run.card.append(el('div','Shadow descartado · nenhum write executado.','margin-top:9px;font:10px Arial;color:#94a3b8'));refreshChrome();processQueue();}
  function processQueue(){if(state.busy||state.reviewPending||!state.queue.length)return;const next=state.queue.shift();refreshChrome();startCommand(next.command,next.kind,true,false);}
  function appendUser(command,queued){appendUserBubble(command,queued);}
  function appendUserBubble(command,queued=false){if(!state.thread)return;const wrap=el('div',null,'justify-self:end;max-width:88%;display:grid;gap:4px');wrap.append(el('div',command,'padding:11px 13px;border-radius:15px 15px 4px 15px;background:linear-gradient(135deg,#7c3aed,#9333ea);color:#fff;font:600 12px/1.45 Arial;box-shadow:0 8px 24px rgba(76,29,149,.24);white-space:pre-wrap'));if(queued)wrap.append(el('span','Na fila','justify-self:end;color:#94a3b8;font:9px Arial'));state.thread.append(wrap);trimThread();scrollThread();}

  function intercept(command,event){if(!state.enabled||!command)return false;event?.preventDefault?.();event?.stopPropagation?.();event?.stopImmediatePropagation?.();clearInput(state.input);console.info('[LovableDecrypter] comando interceptado → Editor Direto',{projectId:location.pathname.split('/').filter(Boolean).pop()||'',len:command.length,mode:state.mode});startCommand(command,state.mode,false,false);return true;}
  document.addEventListener('focusin',event=>{if(isEditable(event.target))mount(event.target).catch(()=>{});},true);
  document.addEventListener('input',event=>{if(isEditable(event.target)&&event.target!==state.input)mount(event.target).catch(()=>{});},true);
  document.addEventListener('keydown',event=>{if(!state.enabled||event.target!==state.input||event.key!=='Enter'||event.shiftKey||event.ctrlKey||event.metaKey||event.altKey||event.isComposing)return;intercept(readInput(state.input),event);},true);
  document.addEventListener('submit',event=>{if(state.enabled&&event.target instanceof HTMLFormElement&&event.target.contains(state.input))intercept(readInput(state.input),event);},true);
  document.addEventListener('click',event=>{if(!state.enabled)return;const button=event.target instanceof Element?event.target.closest('button'):null;if(button&&state.container?.contains(button)&&semanticSend(button))intercept(readInput(state.input),event);},true);
  addEventListener('resize',positionSurface,{passive:true});addEventListener('scroll',positionSurface,{passive:true,capture:true});document.addEventListener('pointerdown',positionSurface,true);
  chrome.storage.onChanged.addListener((changes,area)=>{if(area!=='local'||!changes[PROGRESS_KEY]||!state.activeRun?.busy||state.activeRun.applying)return;const p=changes[PROGRESS_KEY].newValue;if(p?.schema!=='ld-editor-progress/1')return;state.activeRun.progress=p;renderRun(state.activeRun,p);});

  function boot(){bindSidebar();const input=bestComposer();if(input)mount(input).catch(()=>{});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();

  Object.defineProperty(window,'LovableDecrypterEditorNativeChatV84',{value:Object.freeze({schema:'ld-editor-native-chat/1',build:84,nativeComposerPrimary:true,inlineTranscript:true,queue:true,cancellablePlanBuild:true,explicitShadowReview:true,networkMonkeypatch:false,promptPersistence:false,advancedPanelViaAltClick:true}),configurable:false,enumerable:false,writable:false});
})();