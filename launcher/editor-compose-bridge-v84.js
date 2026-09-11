(() => {
  'use strict';
  if (window.__LD84_EDITOR_COMPOSE_BRIDGE__) return;
  window.__LD84_EDITOR_COMPOSE_BRIDGE__ = true;

  const HOST_ID = 'lovable-decrypter-launcher';
  const CONTROL_ATTR = 'data-ld84-compose-bridge';
  const PREF_KEY = 'ld84_native_compose';
  const PROGRESS_KEY = 'ld84_editor_progress';
  let current = null;
  let busy = false;
  let reviewPending = false;
  let activeRun = null;
  const queue = [];

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
  function getLocal(keys){return new Promise(resolve=>chrome.storage.local.get(keys,v=>resolve(v||{})));}
  function setLocal(value){return new Promise(resolve=>chrome.storage.local.set(value,()=>resolve()));}
  function extensionShadow(){return document.getElementById(HOST_ID)?.shadowRoot||null;}
  function isExtensionNode(node){try{return !!node?.getRootNode?.()?.host?.id&&node.getRootNode().host.id===HOST_ID;}catch(_){return false;}}
  function isEditable(node){return node instanceof Element&&!isExtensionNode(node)&&(node.matches('textarea')||node.getAttribute('contenteditable')==='true');}
  function readCommand(input){return input instanceof HTMLTextAreaElement?String(input.value||'').trim():String(input.innerText||input.textContent||'').trim();}
  function clearCommand(input){
    if(input instanceof HTMLTextAreaElement){const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')?.set;if(setter)setter.call(input,'');else input.value='';}
    else input.textContent='';
    input.dispatchEvent(new Event('input',{bubbles:true}));
  }
  function semanticSendButton(button){
    if(!(button instanceof HTMLButtonElement)||button.closest(`[${CONTROL_ATTR}]`))return false;
    if(String(button.type||'').toLowerCase()==='submit')return true;
    const semantic=[button.getAttribute('aria-label'),button.getAttribute('title'),button.textContent].filter(Boolean).join(' ').toLowerCase();
    return /\b(send|submit|enviar|mandar|run|prompt|message)\b/.test(semantic);
  }
  function scoreComposer(input){
    const rect=input.getBoundingClientRect();if(rect.width<260||rect.height<28||rect.bottom<innerHeight*.45)return 0;
    let score=1;const hint=[input.getAttribute('placeholder'),input.getAttribute('aria-label'),input.getAttribute('data-placeholder')].filter(Boolean).join(' ').toLowerCase();
    if(/ask|message|prompt|describe|lovable|chat|build|make|create|edit|pergunte|criar/.test(hint))score+=3;
    let a=input.parentElement;for(let d=0;a&&d<6;d++,a=a.parentElement){if(a.matches('form'))score+=2;if([...a.querySelectorAll('button')].some(semanticSendButton))score+=3;const s=[a.getAttribute('aria-label'),a.getAttribute('data-testid'),a.className].filter(v=>typeof v==='string').join(' ').toLowerCase();if(/chat|composer|prompt|message/.test(s))score+=2;}return score;
  }
  function findContainer(input){let a=input.parentElement,b=a;for(let d=0;a&&d<7;d++,a=a.parentElement){b=a;if(a.matches('form')||[...a.querySelectorAll('button')].some(semanticSendButton))return a;}return b||input.parentElement;}
  function bestComposer(){return [...document.querySelectorAll('textarea,[contenteditable="true"]')].filter(isEditable).map(input=>({input,score:scoreComposer(input)})).sort((a,b)=>b.score-a.score)[0]?.input||null;}
  function node(tag,text,css=''){const n=document.createElement(tag);if(text!=null)n.textContent=text;if(css)n.style.cssText=css;return n;}
  function button(text){const b=node('button',text,'border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#eef5ff;border-radius:9px;padding:7px 10px;font:600 11px Arial;cursor:pointer');b.type='button';b.setAttribute(CONTROL_ATTR,'1');return b;}
  function fmtElapsed(started){const s=Math.max(0,Math.floor((Date.now()-started)/1000));return s<60?`${s}s`:`${Math.floor(s/60)}m ${String(s%60).padStart(2,'0')}s`;}
  function friendlyError(out){const code=String(out?.code||out?.message||'EDITOR_OPERATION_FAILED');if(code==='GEMINI_RATE_LIMITED'||code==='GEMINI_HTTP_429')return 'Gemini atingiu o limite de uso. O Decrypter fez no máximo um retry e parou sem escrever nada.';if(code==='EDITOR_CANCELLED_BY_USER')return 'Operação cancelada. Nenhum write foi executado.';return code;}

  function ensureThread(){
    if(!current?.container)return null;if(current.thread?.isConnected)return current.thread;
    const t=node('div',null,'position:absolute;left:2px;right:2px;bottom:calc(100% + 10px);z-index:45;max-height:min(58vh,590px);overflow:auto;display:grid;gap:10px;padding:4px 7px;pointer-events:auto;font-family:Arial,sans-serif;scrollbar-width:thin');
    t.setAttribute(CONTROL_ATTR,'thread');current.container.appendChild(t);current.thread=t;return t;
  }
  function addUserBubble(command){const t=ensureThread();if(!t)return null;const b=node('div',command,'justify-self:end;max-width:88%;padding:11px 13px;border-radius:15px 15px 4px 15px;background:linear-gradient(135deg,#7c3aed,#9333ea);color:white;font:600 12px/1.45 Arial;box-shadow:0 8px 24px rgba(76,29,149,.24);white-space:pre-wrap');t.appendChild(b);t.scrollTop=t.scrollHeight;trimThread();return b;}
  function addAssistantCard(){const t=ensureThread();if(!t)return null;const c=node('section',null,'padding:12px 13px;border:1px solid rgba(255,255,255,.09);border-radius:14px;background:rgba(10,15,24,.96);color:#e9f2ff;box-shadow:0 12px 34px rgba(0,0,0,.28)');c.setAttribute('data-ld84-run-card','1');t.appendChild(c);t.scrollTop=t.scrollHeight;trimThread();return c;}
  function trimThread(){if(!current?.thread)return;const cards=[...current.thread.children];while(cards.length>10){cards.shift()?.remove();}}
  function stageNames(kind){return kind==='plan'?['Lendo o projeto','Planejando','Validando','Plano pronto']:['Lendo o projeto','Planejando','Montando contexto','Gerando alterações','Validando Scope','Aguardando sua revisão'];}
  function stageIndex(progress,run){
    if(run.review)return 5;if(progress?.status==='complete')return progress.kind==='plan'?3:4;
    const p=String(progress?.phase||'');if(/cancel|error/.test(p))return -1;if(/shadow-validate/.test(p))return 4;if(/shadow-model/.test(p))return 3;if(/context/.test(p))return 2;if(/planning/.test(p))return 1;return 0;
  }
  function renderRun(run,progress=null){
    if(!run?.card)return;run.progress=progress||run.progress;const names=stageNames(run.kind);const idx=stageIndex(run.progress,run);run.card.replaceChildren();
    const head=node('div',null,'display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:9px');const title=node('b',run.kind==='plan'?'Editor Direto · Plan':'Editor Direto · Build','font:700 12px Arial;color:#fff');const elapsed=node('span',`há ${fmtElapsed(run.started)}`,'font:10px Arial;color:#8ca0bd');run.elapsed=elapsed;head.append(title,elapsed);run.card.append(head);
    const list=node('div',null,'display:grid;gap:7px');names.forEach((name,i)=>{const row=node('div',null,'display:flex;gap:8px;align-items:center;font:11px/1.3 Arial');const mark=node('span',i<idx?'✓':i===idx?'●':'○',`width:14px;color:${i<idx?'#45dc98':i===idx?'#60a5fa':'#64748b'};font-weight:700`);const text=node('span',name,`color:${i<=idx?'#dce8f8':'#7b8ba3'}`);row.append(mark,text);list.append(row);});run.card.append(list);
    if(run.progress?.label){run.card.append(node('div',run.progress.label,'margin-top:9px;padding-top:8px;border-top:1px solid rgba(255,255,255,.06);font:10px/1.4 Arial;color:#8fa4c0'));}
    if(run.busy){const actions=node('div',null,'display:flex;justify-content:flex-end;margin-top:10px');const stop=button(run.stopRequested?'Parando…':'Parar');stop.disabled=run.stopRequested;stop.onclick=()=>cancelRun(run,stop);actions.append(stop);run.card.append(actions);}
    if(run.error)renderError(run);else if(run.plan)renderPlan(run);else if(run.shadow)renderShadow(run);else if(run.receipt)renderReceipt(run);
  }
  function tick(run){if(!run?.busy||run!==activeRun)return;run.elapsed.textContent=`há ${fmtElapsed(run.started)}`;run.timer=setTimeout(()=>tick(run),1000);}
  function renderError(run){const box=node('div',friendlyError(run.error),'margin-top:10px;padding:9px 10px;border:1px solid rgba(255,91,115,.25);border-radius:10px;background:rgba(255,91,115,.08);color:#ffd6de;font:11px/1.45 Arial');run.card.append(box);}
  function renderPlan(run){const p=run.plan;const box=node('div',null,'margin-top:10px;padding-top:9px;border-top:1px solid rgba(255,255,255,.07)');box.append(node('b','Plano · ZERO WRITE','font:700 11px Arial;color:#c7f0ff'));if(p.summary)box.append(node('div',p.summary,'margin-top:6px;font:11px/1.45 Arial;color:#cbd6e8'));const steps=Array.isArray(p.plan)?p.plan:[];if(steps.length){const ol=document.createElement('ol');ol.style.cssText='margin:8px 0 0;padding-left:18px;color:#aebdd2;font:11px/1.5 Arial';steps.forEach(s=>{const li=document.createElement('li');li.textContent=s;ol.append(li);});box.append(ol);}const a=node('div',null,'display:flex;justify-content:flex-end;margin-top:9px');const build=button('Preparar Shadow Build');build.onclick=()=>{run.resolved=true;startCommand(run.command,'build',true);};a.append(build);box.append(a);run.card.append(box);}
  function fileList(files){const box=node('div',null,'display:grid;gap:5px;margin-top:8px');(files||[]).forEach(f=>{const r=node('div',null,'display:flex;justify-content:space-between;gap:12px;padding:7px 8px;border-radius:8px;background:rgba(255,255,255,.04);font:10px Arial');r.append(node('b',f.path||'arquivo','color:#dbeafe'),node('span',String(f.action||'update').toUpperCase(),'color:#7dd3fc'));box.append(r);});return box;}
  function renderShadow(run){const out=run.shadow;const box=node('div',null,'margin-top:10px;padding-top:9px;border-top:1px solid rgba(255,255,255,.07)');box.append(node('b','Shadow Build pronto · ZERO WRITE','font:700 11px Arial;color:#baf7d4'));box.append(fileList(out.files));if(out.supabaseApplyRequired)box.append(node('div',`${(out.supabaseMigrations||[]).length} migration(s) Supabase serão aplicadas somente depois do commit GitHub.`,'margin-top:8px;font:10px/1.4 Arial;color:#f5d69a'));const approve=node('label',null,'display:flex;gap:8px;align-items:flex-start;margin-top:10px;padding:8px;border-radius:9px;background:rgba(255,255,255,.035);font:10px/1.4 Arial;color:#cbd5e1');const cb=document.createElement('input');cb.type='checkbox';cb.style.marginTop='1px';approve.append(cb,node('span',out.supabaseApplyRequired?'Revisei os arquivos e autorizo GitHub + migrations Supabase listadas.':'Revisei os arquivos e autorizo o commit GitHub.'));box.append(approve);const actions=node('div',null,'display:flex;gap:7px;justify-content:flex-end;margin-top:9px');const discard=button('Descartar');const apply=button(out.supabaseApplyRequired?'Aplicar GitHub + Supabase':'Aplicar no GitHub');apply.disabled=true;cb.onchange=()=>{apply.disabled=!cb.checked;};discard.onclick=()=>discardShadow(run);apply.onclick=()=>applyShadow(run,apply);actions.append(discard,apply);box.append(actions);run.card.append(box);}
  function renderReceipt(run){const out=run.receipt;const box=node('div',null,'margin-top:10px;padding-top:9px;border-top:1px solid rgba(255,255,255,.07)');box.append(node('b',out.supabaseApply?.ok?'✓ GitHub + Supabase atualizados':'✓ GitHub atualizado','font:700 11px Arial;color:#86efac'));box.append(node('div',`Commit ${(out.commitSha||'').slice(0,8)} · ${out.repository||''}`,'margin-top:6px;font:11px Arial;color:#dbeafe'));if(out.supabaseApply?.ok)box.append(node('div',`Supabase: ${(out.supabaseApply.applied||[]).length} aplicada(s), ${(out.supabaseApply.skipped||[]).length} já registrada(s).`,'margin-top:5px;font:10px Arial;color:#9fb1c8'));box.append(node('div','GitHub confirmado. O Preview do Lovable pode reconstruir depois; isso é validado separadamente.','margin-top:7px;font:10px/1.4 Arial;color:#91a4bd'));if(out.commitUrl){const a=node('a','Abrir commit','display:inline-block;margin-top:8px;color:#7dd3fc;font:600 10px Arial;text-decoration:none');a.href=out.commitUrl;a.target='_blank';a.rel='noopener noreferrer';box.append(a);}run.card.append(box);}

  async function cancelRun(run,nodeButton){if(!run?.busy)return;run.stopRequested=true;if(nodeButton)nodeButton.disabled=true;await send({type:'ld84.cancel.current'});renderRun(run,run.progress);}
  function resourcesBinding(resources){const binding=resources?.binding||{};const repo=binding.repository||(resources?.repositories||[]).length===1?((resources?.repositories||[])[0]?.fullName||''):binding.repository;return {repo:binding.repository||((resources?.repositories||[]).length===1?resources.repositories[0].fullName:''),branch:binding.branch||((resources?.repositories||[]).find(r=>r.fullName===repo)?.defaultBranch||'main'),supabase:binding.supabaseProject||((resources?.supabaseProjects||[]).length===1?resources.supabaseProjects[0].ref:'')};}
  async function startCommand(command,kind=current?.modeValue||'build',reuse=false){
    if(!command)return;if(busy||reviewPending){queue.push({command,kind});updateControl();if(!reuse)addUserBubble(command);toast(`Mensagem adicionada à fila (${queue.length}).`);return;}
    busy=true;if(!reuse)addUserBubble(command);const run={command,kind,started:Date.now(),busy:true,review:false,card:addAssistantCard(),progress:null,error:null,plan:null,shadow:null,receipt:null};activeRun=run;renderRun(run);tick(run);
    try{
      const resources=await send({type:'ld84.editor.resources'});if(!resources?.ok)throw resources;
      const b=resourcesBinding(resources);if(!resources.projectId)throw {code:'EDITOR_PROJECT_ID_REQUIRED'};if(!b.repo)throw {code:'EDITOR_REPOSITORY_BINDING_REQUIRED',message:'Abra o Editor avançado uma vez para salvar o vínculo deste projeto.'};
      const out=await send({type:kind==='plan'?'ld84.editor.plan':'ld84.editor.build',command,projectId:resources.projectId,repository:b.repo,branch:b.branch,supabaseProject:b.supabase});if(!out?.ok)throw out;
      run.busy=false;clearTimeout(run.timer);busy=false;
      if(kind==='plan'){run.plan=out.plan||{};renderRun(run,{schema:'ld-editor-progress/1',kind:'plan',status:'complete',phase:'complete',label:'Plano pronto · nenhum write executado',step:4,total:4});processQueue();}
      else{run.shadow=out;run.review=true;reviewPending=true;renderRun(run,{schema:'ld-editor-progress/1',kind:'build',status:'complete',phase:'complete',label:'Shadow pronto · aguardando sua revisão',step:8,total:8});}
    }catch(error){run.busy=false;clearTimeout(run.timer);busy=false;run.error=error;renderRun(run,run.progress);if(String(error?.code||error?.message)==='EDITOR_CANCELLED_BY_USER')toast('Operação cancelada sem write.');processQueue();}
  }
  async function applyShadow(run,buttonNode){if(!run?.shadow?.shadowId||busy)return;busy=true;run.review=false;reviewPending=false;run.busy=true;run.progress={schema:'ld-editor-progress/1',kind:'build',phase:'apply',status:'running',label:'Aplicando · revalidando Trust, HEAD e Scope',step:5,total:6};renderRun(run,run.progress);buttonNode.disabled=true;
    try{const out=await send({type:'ld84.editor.apply',shadowId:run.shadow.shadowId,supabaseApproved:run.shadow.supabaseApplyRequired===true});if(!out?.ok)throw out;run.busy=false;busy=false;run.receipt=out;run.shadow=null;renderRun(run,{schema:'ld-editor-progress/1',kind:'build',phase:'complete',status:'complete',label:'Aplicação confirmada',step:6,total:6});processQueue();}
    catch(error){run.busy=false;busy=false;run.error=error;if(error?.gitApplied===true){run.error=null;const box=node('div',`GitHub já aplicado no commit ${(error.commitSha||'').slice(0,8)}; Supabase ficou pendente. Não repita o Git.`,'margin-top:10px;color:#f5d69a;font:11px/1.4 Arial');run.card.append(box);}else{reviewPending=true;run.review=true;}renderRun(run,run.progress);}
  }
  function discardShadow(run){run.shadow=null;run.review=false;reviewPending=false;run.card.append(node('div','Shadow descartado · nenhum write executado.','margin-top:9px;font:10px Arial;color:#94a3b8'));processQueue();}
  function processQueue(){if(busy||reviewPending||!queue.length)return;const next=queue.shift();updateControl();startCommand(next.command,next.kind,true);}

  function toast(text,kind='info'){document.querySelector('[data-ld84-compose-toast]')?.remove();const n=node('div',text,`position:fixed;right:18px;bottom:18px;z-index:2147483646;max-width:390px;padding:10px 12px;border-radius:11px;font:11px/1.4 Arial;background:${kind==='error'?'rgba(72,19,31,.97)':'rgba(10,21,39,.97)'};border:1px solid ${kind==='error'?'rgba(255,91,115,.45)':'rgba(56,189,248,.3)'};color:${kind==='error'?'#ffd5dd':'#e8f5ff'};box-shadow:0 14px 40px rgba(0,0,0,.35)`);n.setAttribute('data-ld84-compose-toast','1');document.documentElement.append(n);setTimeout(()=>n.remove(),5000);}
  async function savePref(){if(!current)return;await setLocal({[PREF_KEY]:{enabled:current.active===true,mode:current.modeValue||'build'}});}
  async function setActive(value){if(!current){const input=bestComposer();if(input)await mount(input);}if(!current)return toast('Abra/focalize o compose do Lovable para ativar o Editor Direto.','error');current.active=value;updateControl();await savePref();}
  function updateControl(){if(!current)return;current.compact.textContent=current.active?'Decrypter ON':'Decrypter';current.compact.style.background=current.active?'rgba(76,29,149,.96)':'rgba(10,21,39,.92)';current.bar.style.display=current.active?'flex':'none';current.mode.textContent=current.modeValue==='plan'?'Plan':'Build';current.queue.textContent=queue.length?` · fila ${queue.length}`:'';const shadow=extensionShadow();const side=shadow?.querySelector('[data-ld-editor-direct]');if(side){side.setAttribute('aria-pressed',current.active?'true':'false');side.style.boxShadow=current.active?'inset 3px 0 #8b5cf6':'';}}
  async function mount(input){if(scoreComposer(input)<4)return;const container=findContainer(input);if(!container)return;if(current?.input===input&&current.shell?.isConnected)return;current?.shell?.remove();current?.bar?.remove();current?.thread?.remove();if(getComputedStyle(container).position==='static')container.style.position='relative';
    const stored=await getLocal([PREF_KEY]);const pref=stored[PREF_KEY]||{};const shell=node('div',null,'position:absolute;right:54px;bottom:8px;z-index:43;display:flex;align-items:center;font-family:Arial;pointer-events:auto');shell.setAttribute(CONTROL_ATTR,'shell');const compact=button('Decrypter');compact.style.cssText+=';height:28px;padding:0 9px';shell.append(compact);container.append(shell);
    const bar=node('div',null,'position:absolute;left:10px;right:10px;bottom:-29px;z-index:43;height:25px;align-items:center;gap:7px;padding:0 9px;border-radius:999px;border:1px solid rgba(139,92,246,.35);background:rgba(8,15,25,.97);box-shadow:0 8px 22px rgba(0,0,0,.28);color:#dce8f8;font:10px Arial;cursor:pointer');bar.setAttribute(CONTROL_ATTR,'bar');const dot=node('span','●','color:#34d399;font-size:9px');const label=node('span','⚡ Editor direto ativo · comandos do chat vão para o Decrypter','flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis');const queueNode=node('span','','color:#94a3b8');const mode=button('Build');mode.style.cssText='height:19px;padding:0 7px;border-radius:999px;border:1px solid rgba(139,92,246,.3);background:rgba(76,29,149,.35);color:#e9ddff;font:700 9px Arial;cursor:pointer';bar.append(dot,label,queueNode,mode);container.append(bar);
    current={input,container,shell,compact,bar,mode,queue:queueNode,thread:null,active:pref.enabled===true,modeValue:pref.mode==='plan'?'plan':'build'};compact.onclick=e=>{e.preventDefault();e.stopPropagation();setActive(!current.active);};bar.onclick=e=>{if(e.target===mode)return;setActive(false);};mode.onclick=e=>{e.preventDefault();e.stopPropagation();current.modeValue=current.modeValue==='build'?'plan':'build';updateControl();savePref();};updateControl();bindSidebar();}
  function bindSidebar(){const shadow=extensionShadow();if(!shadow||shadow.__ld84NativeComposePrimaryBound)return;shadow.addEventListener('click',event=>{const target=event.target instanceof Element?event.target.closest('[data-ld-editor-direct], [data-ld-parity="editor-direct"]'):null;if(!target||event.altKey)return;event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();setActive(!(current?.active===true));},true);Object.defineProperty(shadow,'__ld84NativeComposePrimaryBound',{value:true});}

  function intercept(command,kind,event){if(!current?.active||!command)return false;event?.preventDefault?.();event?.stopPropagation?.();event?.stopImmediatePropagation?.();clearCommand(current.input);console.info('[LovableDecrypter] comando interceptado → Editor Direto',{projectId:location.pathname.split('/').filter(Boolean).pop()||'',len:command.length,mode:kind});startCommand(command,kind);return true;}
  document.addEventListener('focusin',e=>{if(isEditable(e.target))mount(e.target);},true);
  document.addEventListener('input',e=>{if(isEditable(e.target)&&(!current||current.input!==e.target))mount(e.target);},true);
  document.addEventListener('keydown',e=>{if(!current?.active||e.target!==current.input||e.key!=='Enter'||e.shiftKey||e.ctrlKey||e.metaKey||e.altKey||e.isComposing)return;intercept(readCommand(current.input),current.modeValue,e);},true);
  document.addEventListener('submit',e=>{if(current?.active&&e.target instanceof HTMLFormElement&&e.target.contains(current.input))intercept(readCommand(current.input),current.modeValue,e);},true);
  document.addEventListener('click',e=>{if(!current?.active)return;const b=e.target instanceof Element?e.target.closest('button'):null;if(b&&current.container.contains(b)&&semanticSendButton(b))intercept(readCommand(current.input),current.modeValue,e);},true);
  chrome.storage.onChanged.addListener((changes,area)=>{if(area!=='local'||!changes[PROGRESS_KEY]||!activeRun?.busy)return;const p=changes[PROGRESS_KEY].newValue;if(!p||p.schema!=='ld-editor-progress/1')return;activeRun.progress=p;renderRun(activeRun,p);});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{bindSidebar();const i=bestComposer();if(i)mount(i);},{once:true});else{bindSidebar();const i=bestComposer();if(i)mount(i);}

  Object.defineProperty(window,'LovableDecrypterEditorComposeBridgeV84',{value:Object.freeze({schema:'ld-editor-compose-bridge/2',build:84,nativeComposerPrimary:true,nativeInlineTranscript:true,queue:true,explicitReviewPreserved:true,networkMonkeypatch:false,nativeSendPreservedWhenOff:true,advancedPanelViaAltClick:true}),configurable:false,enumerable:false,writable:false});
})();