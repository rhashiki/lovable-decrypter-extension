(() => {
  'use strict';
  if (window.__LD84_GITHUB_SYNC_V3__) return;
  window.__LD84_GITHUB_SYNC_V3__ = true;

  const HOST_ID = 'lovable-decrypter-launcher';
  const MODAL_ID = 'ld84-github-sync-modal';

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

  const CSS = `
    #${MODAL_ID}{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:18px;background:rgba(3,7,16,.58);backdrop-filter:blur(11px);pointer-events:auto;font-family:Arial,sans-serif;color:#f3f7ff}
    #${MODAL_ID} *{box-sizing:border-box}
    #${MODAL_ID} .ghs-card{width:min(760px,calc(100vw - 28px));max-height:min(850px,calc(100vh - 28px));overflow:auto;scrollbar-width:thin;scrollbar-color:rgba(59,210,255,.5) rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.10);border-radius:24px;background:linear-gradient(180deg,rgba(20,31,54,.99),rgba(9,16,30,.995));box-shadow:0 28px 90px rgba(0,0,0,.46);padding:20px}
    #${MODAL_ID} .ghs-card::-webkit-scrollbar,#${MODAL_ID} .ghs-scroll::-webkit-scrollbar{width:9px}#${MODAL_ID} .ghs-card::-webkit-scrollbar-track,#${MODAL_ID} .ghs-scroll::-webkit-scrollbar-track{background:rgba(255,255,255,.02);border-radius:999px}#${MODAL_ID} .ghs-card::-webkit-scrollbar-thumb,#${MODAL_ID} .ghs-scroll::-webkit-scrollbar-thumb{background:linear-gradient(180deg,rgba(59,210,255,.62),rgba(105,119,255,.42));border:2px solid rgba(9,16,30,.94);border-radius:999px}
    #${MODAL_ID} .ghs-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:14px}#${MODAL_ID} h2{font:700 20px/1.25 Arial;margin:0;color:#fff}#${MODAL_ID} .ghs-sub{margin-top:5px;color:#9aa7bf;font:12px/1.45 Arial}#${MODAL_ID} .ghs-close{width:36px;height:36px;border-radius:12px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.05);color:#dce7fb;cursor:pointer;font:22px/1 Arial}
    #${MODAL_ID} .ghs-status,#${MODAL_ID} .ghs-op-card{padding:12px 13px;border-radius:13px;background:rgba(59,210,255,.07);border:1px solid rgba(59,210,255,.16);color:#dcecff;font:12px/1.45 Arial;margin-bottom:13px;overflow-wrap:anywhere}
    #${MODAL_ID} .ghs-grid{display:grid;grid-template-columns:130px 1fr;gap:8px 12px;padding:4px 0 8px}#${MODAL_ID} .ghs-key{color:#8291ad;font:11px/1.4 Arial}.ghs-value{color:#f1f6ff;font:12px/1.4 Arial;overflow-wrap:anywhere}
    #${MODAL_ID} .ghs-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:13px}#${MODAL_ID} .ghs-btn{min-height:38px;padding:0 13px;border-radius:11px;border:1px solid rgba(59,210,255,.20);background:rgba(59,210,255,.10);color:#e9f8ff;cursor:pointer;font:600 12px Arial}#${MODAL_ID} .ghs-btn.secondary{border-color:rgba(255,255,255,.10);background:rgba(255,255,255,.05);color:#cbd7eb}#${MODAL_ID} .ghs-btn:disabled{opacity:.52;cursor:default}
    #${MODAL_ID} .ghs-section{margin-top:15px;padding-top:14px;border-top:1px solid rgba(255,255,255,.07)}#${MODAL_ID} .ghs-section h3{margin:0 0 9px;font:700 13px Arial;color:#dce8fa}
    #${MODAL_ID} .ghs-history-card{height:300px;overflow:auto;padding:10px;border:1px solid rgba(255,255,255,.075);border-radius:14px;background:rgba(255,255,255,.022);scrollbar-width:thin;scrollbar-color:rgba(59,210,255,.48) rgba(255,255,255,.02)}#${MODAL_ID} .ghs-list{display:grid;gap:7px}#${MODAL_ID} .ghs-commit{padding:10px 11px;border-radius:12px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.06)}#${MODAL_ID} .ghs-commit-top{display:flex;justify-content:space-between;gap:14px;color:#eef5ff;font:11px/1.4 Arial}.ghs-sha{font-family:monospace;color:#72ddff!important;min-height:28px!important}.ghs-meta{margin-top:4px;color:#8191aa;font:10px/1.4 Arial}
    #${MODAL_ID} .ghs-compare-panel{display:grid;gap:10px;padding:11px;border:1px solid rgba(255,255,255,.075);border-radius:14px;background:rgba(255,255,255,.025)}#${MODAL_ID} .ghs-compare{display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:end}#${MODAL_ID} label{display:grid;gap:5px;color:#8fa0b9;font:10px Arial}#${MODAL_ID} select{height:38px;border-radius:10px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.045);color:#eef5ff;padding:0 10px;font:11px Arial}#${MODAL_ID} option{background:#101a2d;color:#eef5ff}
    #${MODAL_ID} .ghs-compare-results{height:230px;overflow:auto;padding:10px 11px;border-radius:11px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);color:#cbd8ea;font:11px/1.45 Arial;scrollbar-width:thin;scrollbar-color:rgba(59,210,255,.48) rgba(255,255,255,.02)}#${MODAL_ID} .ghs-compare-summary{margin-bottom:8px;font-weight:700;color:#e7f3ff}#${MODAL_ID} .ghs-files{display:grid;gap:5px}.ghs-file{display:flex;justify-content:space-between;gap:10px;padding:7px 9px;border-radius:9px;background:rgba(255,255,255,.035);font:10px/1.35 Arial;color:#bdcbe0}.ghs-file span:last-child{color:#9aabc3;white-space:nowrap}
    @media(max-width:640px){#${MODAL_ID}{padding:8px}#${MODAL_ID} .ghs-card{width:100%;max-height:calc(100vh - 16px);padding:15px}#${MODAL_ID} .ghs-grid{grid-template-columns:100px 1fr}#${MODAL_ID} .ghs-compare{grid-template-columns:1fr}#${MODAL_ID} .ghs-history-card{height:260px}#${MODAL_ID} .ghs-compare-results{height:210px}}
  `;

  function el(tag, cls, text) { const n=document.createElement(tag); if(cls)n.className=cls; if(text!=null)n.textContent=text; return n; }
  function button(text, secondary=false) { const n=el('button',`ghs-btn${secondary?' secondary':''}`,text); n.type='button'; return n; }
  function shortSha(value){return String(value||'').slice(0,7)||'—';}
  function fmtDate(value){if(!value)return'—';try{return new Date(value).toLocaleString('pt-BR');}catch(_){return String(value);}}
  function setKind(node,text,kind=''){if(!node)return;node.textContent=text;node.dataset.kind=kind;node.dataset.opKind=kind;}
  function field(grid,key,value){grid.append(el('div','ghs-key',key),el('div','ghs-value',value==null||value===''?'—':String(value)));}

  function shell(shadow, subtitle='GitHub como source of truth · sincronização sob demanda') {
    shadow.getElementById(MODAL_ID)?.remove();
    const overlay=el('div');overlay.id=MODAL_ID;const style=el('style');style.textContent=CSS;const card=el('section','ghs-card');
    const head=el('div','ghs-head');const copy=el('div');copy.append(el('h2','', 'GitHub Sync & History'),el('div','ghs-sub',subtitle));const close=button('×',true);close.className='ghs-close';close.setAttribute('aria-label','Fechar');head.append(copy,close);
    const body=el('div');card.append(head,body);overlay.append(style,card);shadow.append(overlay);close.addEventListener('click',()=>overlay.remove(),{once:true});overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove();});return{overlay,body};
  }

  function commitRow(commit) {
    const item=el('div','ghs-commit');const top=el('div','ghs-commit-top');const message=el('span','',commit.message||'(sem mensagem)');const sha=button(commit.shortSha||shortSha(commit.sha),true);sha.classList.add('ghs-sha');sha.addEventListener('click',()=>{if(commit.htmlUrl)window.open(commit.htmlUrl,'_blank','noopener,noreferrer');});top.append(message,sha);item.append(top,el('div','ghs-meta',`${commit.author||'Git'} · ${fmtDate(commit.date)}`));return item;
  }

  async function loadHistory(state, options={}) {
    if (state.historyLoading) return state.commits || [];
    state.historyLoading=true;
    let section=state.modal.body.querySelector('.ghs-history-section');
    if(!section){section=el('section','ghs-section ghs-history-section');section.append(el('h3','', 'Histórico Git'));const card=el('div','ghs-history-card ghs-scroll');card.dataset.opKind='';section.append(card);state.modal.body.append(section);}
    const card=section.querySelector('.ghs-history-card');
    setKind(card,'Carregando histórico do branch vinculado…','testing');
    const out=await send({type:'ld84.github.sync.history',limit:30});
    state.historyLoading=false;
    if(!out?.ok){setKind(card,out?.message||out?.code||'Falha ao carregar histórico.','error');return[];}
    state.commits=Array.isArray(out.commits)?out.commits:[];
    card.replaceChildren();
    const header=el('div','ghs-op-card',`${state.commits.length} commit(s) · ${out.repository||state.status.repository} · ${out.branch||state.status.branch}`);header.dataset.opKind='success';card.append(header);
    const list=el('div','ghs-list');for(const commit of state.commits)list.append(commitRow(commit));if(!state.commits.length)list.append(el('div','ghs-op-card','Nenhum commit retornado para o branch vinculado.'));card.append(list);card.dataset.opKind='success';
    return state.commits;
  }

  async function showCompare(state) {
    const commits=state.commits?.length?state.commits:await loadHistory(state,{forCompare:true});
    let section=state.modal.body.querySelector('.ghs-compare-section');
    if(section){section.remove();return;}
    section=el('section','ghs-section ghs-compare-section');section.append(el('h3','', 'Comparar commits'));
    if(commits.length<2){const msg=el('div','ghs-op-card','São necessários pelo menos dois commits para comparar.');msg.dataset.opKind='error';section.append(msg);state.modal.body.append(section);return;}
    const panel=el('div','ghs-compare-panel');const compare=el('div','ghs-compare');const baseLabel=el('label','', 'Base');const headLabel=el('label','', 'Head');const base=document.createElement('select');const head=document.createElement('select');
    for(const commit of commits){const label=`${commit.shortSha||shortSha(commit.sha)} · ${String(commit.message||'').slice(0,62)}`;const a=document.createElement('option');a.value=commit.sha;a.textContent=label;base.append(a);const b=document.createElement('option');b.value=commit.sha;b.textContent=label;head.append(b);}
    base.selectedIndex=Math.min(1,commits.length-1);head.selectedIndex=0;baseLabel.append(base);headLabel.append(head);const run=button('Comparar');compare.append(baseLabel,headLabel,run);panel.append(compare);section.append(panel);state.modal.body.append(section);
    run.addEventListener('click',async()=>{let results=panel.querySelector('.ghs-compare-results');if(!results){results=el('div','ghs-compare-results ghs-scroll');panel.append(results);}run.disabled=true;setKind(results,'Comparando commits e arquivos alterados…','testing');const out=await send({type:'ld84.github.sync.compare',base:base.value,head:head.value});run.disabled=false;if(!out?.ok){setKind(results,out?.message||out?.code||'Falha na comparação.','error');return;}const c=out.comparison||{};results.replaceChildren();const summary=el('div','ghs-compare-summary',`✓  ${c.status||'comparado'} · ahead ${c.aheadBy||0} · behind ${c.behindBy||0} · ${c.totalCommits||0} commit(s)`);results.append(summary);const files=el('div','ghs-files');for(const file of Array.isArray(c.files)?c.files:[]){const row=el('div','ghs-file');row.append(el('span','',file.filename||''),el('span','',`+${file.additions||0} −${file.deletions||0}`));files.append(row);}if(!files.childElementCount)files.append(el('div','ghs-file','Nenhum arquivo alterado retornado.'));results.append(files);results.dataset.opKind='success';results.dataset.kind='success';});
  }

  async function open(shadow, action='open') {
    const modal=shell(shadow,action==='details'?'Detalhes do GitHub Sync':'GitHub como source of truth · sincronização sob demanda');
    const loading=el('div','ghs-status','Identificando automaticamente o projeto e resolvendo binding…');modal.body.append(loading);setKind(loading,loading.textContent,'testing');
    try { await window.LovableDecrypterAutoBindingV84?.ensure?.({source:'github-sync'}); } catch (_) {}
    const result=await send({type:'ld84.github.sync.status'});
    if(!result?.ok){setKind(loading,result?.message||result?.code||'Não foi possível resolver o GitHub Sync.','error');return;}
    modal.body.replaceChildren();const summary=el('div','ghs-status');setKind(summary,result.sync?.checkedAt?`Último snapshot: ${fmtDate(result.sync.checkedAt)}${result.sync.changedSinceLastSync?' · HEAD mudou':''}`:'Binding válido. Ainda não sincronizado nesta sessão.','');modal.body.append(summary);
    const grid=el('div','ghs-grid');field(grid,'Project ID',result.projectId);field(grid,'Repositório',result.repository);field(grid,'Branch',result.branch);field(grid,'HEAD',result.sync?.headSha?shortSha(result.sync.headSha):'Ainda não consultado');field(grid,'HEAD anterior',result.sync?.previousHeadSha?shortSha(result.sync.previousHeadSha):'—');field(grid,'Alterado',result.sync?.changedSinceLastSync?'Sim':'Não');modal.body.append(grid);
    const actions=el('div','ghs-actions');const refresh=button('Sincronizar estado');const history=button('Ver histórico',true);const compare=button('Comparar commits',true);const repo=button('Abrir repositório',true);actions.append(refresh,history,compare,repo);modal.body.append(actions);
    const state={modal,status:result,commits:[],historyLoading:false};
    refresh.addEventListener('click',async()=>{refresh.disabled=true;setKind(summary,'Consultando HEAD autoritativo no GitHub…','testing');const out=await send({type:'ld84.github.sync.refresh'});refresh.disabled=false;if(!out?.ok){setKind(summary,out?.message||out?.code||'Falha ao sincronizar.','error');return;}setKind(summary,out.sync?.changedSinceLastSync?`HEAD atualizado para ${shortSha(out.sync.headSha)} · mudou desde ${shortSha(out.sync.previousHeadSha)}.`:`HEAD confirmado em ${shortSha(out.sync?.headSha)} · sem mudança desde o snapshot anterior.`,'success');});
    history.addEventListener('click',()=>loadHistory(state).catch(()=>{}));
    compare.addEventListener('click',()=>showCompare(state).catch(()=>{}));
    repo.addEventListener('click',()=>{if(result.repository)window.open(`https://github.com/${result.repository}`,'_blank','noopener,noreferrer');});
    if(action==='details')await loadHistory(state);
  }

  function bind() {
    const shadow=document.getElementById(HOST_ID)?.shadowRoot;if(!shadow)return false;if(shadow.__ld84GithubSyncV3Bound)return true;Object.defineProperty(shadow,'__ld84GithubSyncV3Bound',{value:true,configurable:false});
    shadow.addEventListener('click',event=>{const detail=shadow.getElementById('detail');if(!detail||detail.dataset.module!=='git-history')return;const action=event.target?.closest?.('button.action');if(!action)return;const label=String(action.textContent||'').trim();const mapped=label.includes('Detalhes')?'details':label.includes('Ver estado')?'status':label.includes('Abrir módulo')?'open':'';if(!mapped)return;event.preventDefault();event.stopImmediatePropagation();open(shadow,mapped).catch(()=>{});},true);return true;
  }

  const api=Object.freeze({open:action=>{const shadow=document.getElementById(HOST_ID)?.shadowRoot;if(!shadow)return false;open(shadow,action||'open').catch(()=>{});return true;}});
  Object.defineProperty(window,'LovableDecrypterGithubSyncV84',{value:api,configurable:false,enumerable:false,writable:false});
  if(!bind()&&document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>bind(),{once:true});
})();