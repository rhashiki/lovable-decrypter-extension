(() => {
  'use strict';
  if (window.__LD98_CANONICAL_GUIDED_AUTONOMY__) return;
  window.__LD98_CANONICAL_GUIDED_AUTONOMY__ = true;

  const BUILD = 98;
  const VERSION = '2.6.98';
  const MODULE_ID = 'guided-autonomy';
  const HOST_ID = 'lovable-decrypter-launcher';
  const NS = 'http://www.w3.org/2000/svg';
  const state = { busy:false, error:'', settings:null };

  const root = () => document.getElementById(HOST_ID)?.shadowRoot || null;
  const detail = () => root()?.getElementById('detail') || null;
  const api = () => window.LovableDecrypterCanonicalAutonomyPolicyApi || null;
  const text = (value, fallback='—') => { const out=String(value??'').trim(); return out||fallback; };

  function el(tag,className='',value=''){const node=document.createElement(tag);if(className)node.className=className;if(value!=='')node.textContent=String(value);return node;}
  function clear(node){while(node?.firstChild)node.firstChild.remove();}
  function icon(size=21){const svg=document.createElementNS(NS,'svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('width',String(size));svg.setAttribute('height',String(size));svg.setAttribute('fill','none');svg.setAttribute('aria-hidden','true');for(const d of ['M12 3v18','M5 8h14','M7 16h10']){const p=document.createElementNS(NS,'path');p.setAttribute('d',d);p.setAttribute('stroke','currentColor');p.setAttribute('stroke-width','1.7');p.setAttribute('stroke-linecap','round');svg.appendChild(p);}return svg;}

  function ensureStyles(){const shadow=root();if(!shadow||shadow.querySelector('style[data-ld98-autonomy]'))return;const style=document.createElement('style');style.dataset.ld98Autonomy='true';style.textContent=`
    #detail .ld98-modes{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:11px}
    #detail .ld98-mode{min-height:48px;border:1px solid rgba(255,255,255,.06);border-radius:10px;background:rgba(255,255,255,.015);color:#9eacc0;padding:6px;font:800 8.5px Arial,sans-serif;cursor:pointer}
    #detail .ld98-mode.active{border-color:rgba(59,210,255,.3);background:rgba(59,210,255,.08);color:#eafaff}
    #detail .ld98-mode:disabled{opacity:.45;cursor:not-allowed}
    #detail .ld98-title{margin-top:13px;color:#8391a8;font-size:8px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}
    #detail .ld98-card{margin-top:6px;padding:9px 10px;border:1px solid rgba(255,255,255,.055);border-radius:11px;background:rgba(255,255,255,.015)}
    #detail .ld98-card b{display:block;color:#edf4ff;font-size:10px;line-height:1.4}
    #detail .ld98-card small{display:block;color:#8493aa;font-size:8.7px;line-height:1.45;margin-top:3px}
    #detail .ld98-row{display:grid;grid-template-columns:1.3fr .8fr;gap:8px;margin-top:5px;padding:6px 8px;border-left:2px solid rgba(59,210,255,.16);background:rgba(255,255,255,.012);color:#9dacbf;font-size:8.7px;line-height:1.4}
    #detail .ld98-value{text-align:right;font-weight:800;color:#d6e5f5}
    #detail .ld98-value.auto{color:#7ceab0} #detail .ld98-value.ask{color:#ffd183} #detail .ld98-value.deny{color:#ff9fac}
    #detail .ld98-note{margin-top:10px;color:#7f8da4;font-size:8.8px;line-height:1.5}
    #detail .ld98-error{margin-top:9px;padding:8px 9px;border:1px solid rgba(255,103,122,.14);border-radius:9px;background:rgba(255,103,122,.035);color:#ffb2bd;font-size:9px;line-height:1.4}
  `;shadow.appendChild(style);}

  function installRailButton(){const shadow=root(),railButtons=shadow?.getElementById('railButtons');if(!railButtons||railButtons.querySelector('[data-id="guided-autonomy"]'))return Boolean(railButtons);const button=el('button','rail-btn');button.type='button';button.dataset.kind='direct';button.dataset.id=MODULE_ID;button.setAttribute('aria-label','Guided Autonomy');button.append(icon(21),el('span','tip','Guided Autonomy'));railButtons.appendChild(button);return true;}

  function showDetail(anchor){const shadow=root(),target=detail(),rail=shadow?.getElementById('rail'),flyout=shadow?.getElementById('flyout');if(!target||!anchor)return false;for(const node of shadow.querySelectorAll('.rail-btn.active'))node.classList.remove('active');anchor.classList.add('active');if(flyout)flyout.classList.remove('show');target.dataset.module=MODULE_ID;target.style.display='';target.style.visibility='';target.classList.add('show');const ar=anchor.getBoundingClientRect(),rr=rail?.getBoundingClientRect?.()||ar;target.style.left=`${Math.max(8,Math.round(ar.left-368))}px`;target.style.top=`${Math.max(8,Math.min(Math.round(ar.top),innerHeight-260))}px`;target.style.width='360px';target.style.height=`${Math.min(Math.max(450,rr.height||600),innerHeight-16)}px`;target.style.maxHeight=`${Math.max(280,innerHeight-16)}px`;target.style.overflowY='auto';return true;}

  function matrix(mode){return [
    ['Leitura / Context / Testes','AUTO','auto'],
    ['Editar código seguro',mode==='manual'?'ASK':'AUTO',mode==='manual'?'ask':'auto'],
    ['Criar arquivo seguro',mode==='manual'?'ASK':'AUTO',mode==='manual'?'ask':'auto'],
    ['Excluir arquivo','ALWAYS ASK','ask'],
    ['Instalar dependência','ASK','ask'],
    ['Banco de dados','ALWAYS ASK','ask'],
    ['Git push','ALWAYS ASK','ask'],
    ['Deploy','ALWAYS ASK','ask'],
    ['Path sensível / scope conflitante','DENY','deny']
  ];}

  function render(){const target=detail();if(!target||target.dataset.module!==MODULE_ID)return false;ensureStyles();clear(target);const head=el('div','detail-head');head.append(icon(23),el('b','','Guided Autonomy'));const badge=el('span','state',`BUILD ${BUILD} · POLICY`);badge.dataset.runtime=state.error?'offline':'online';head.appendChild(badge);target.appendChild(head);if(state.error)target.appendChild(el('div','ld98-error',state.error));const current=state.settings?.mode||'manual';const modes=el('div','ld98-modes');for(const [mode,label,sub] of [['manual','MANUAL','todo write pergunta'],['guided','GUIDED','safe code automático'],['autonomous','AUTONOMOUS','safe code ampliado']]){const b=el('button',`ld98-mode${current===mode?' active':''}`);b.type='button';b.dataset.ld98Mode=mode;b.disabled=state.busy;b.append(el('b','',label),el('small','',sub));modes.appendChild(b);}target.appendChild(modes);target.appendChild(el('div','ld98-title','Policy matrix'));const card=el('div','ld98-card');card.append(el('b','',`${current.toUpperCase()} · piso de segurança fixo`),el('small','',state.settings?.userSelected?'Modo escolhido explicitamente pelo usuário.':'Padrão seguro: Manual até uma escolha explícita.'));for(const [name,value,cls] of matrix(current)){const row=el('div','ld98-row');row.append(el('span','',name),el('span',`ld98-value ${cls}`,value));card.appendChild(row);}target.appendChild(card);target.appendChild(el('div','ld98-note','AUTO nunca ignora Proposal Digest, HEAD atual, Scope Intelligence, Human Intent, Tool Runtime, Continuity ou Guarded Commit. O Policy Engine não possui write authority nem approval authority; apenas emite uma autorização limitada para código não destrutivo quando a política permitir.'));target.appendChild(el('div','ld98-note',`Build ${BUILD} · ${VERSION} · decisões recebidas do frontend nunca são confiadas pelo executor.`));return true;}

  async function load(){const center=api();if(!center?.get)throw new Error('Autonomy Policy client não carregado.');state.busy=true;state.error='';render();try{state.settings=await center.get();}catch(error){state.error=`${error?.code||'AUTONOMY_POLICY_FAILED'} · ${error?.message||error}`;}finally{state.busy=false;render();}}
  async function setMode(mode){if(state.busy)return;state.busy=true;state.error='';render();try{state.settings=await api().setMode(mode);}catch(error){state.error=`${error?.code||'AUTONOMY_POLICY_FAILED'} · ${error?.message||error}`;}finally{state.busy=false;render();}}
  function open(anchor){if(!showDetail(anchor))return;render();load().catch(()=>null);}
  function bind(){const shadow=root();if(!shadow||shadow.__ld98AutonomyBound)return false;shadow.__ld98AutonomyBound=true;ensureStyles();installRailButton();shadow.addEventListener('click',event=>{const rail=event.target.closest?.('.rail-btn[data-id="guided-autonomy"]');if(rail){event.preventDefault();event.stopImmediatePropagation();open(rail);return;}const mode=event.target.closest?.('[data-ld98-mode]');if(mode&&detail()?.dataset.module===MODULE_ID){event.preventDefault();event.stopImmediatePropagation();setMode(mode.dataset.ld98Mode||'manual');}},true);return true;}

  window.LovableDecrypterCanonicalGuidedAutonomy=Object.freeze({build:BUILD,version:VERSION,handles:id=>id===MODULE_ID,open(){const button=root()?.querySelector('.rail-btn[data-id="guided-autonomy"]');if(button)open(button);},writer:false,approvalAuthority:false,safetyFloorMutable:false});
  if(!bind())document.addEventListener('DOMContentLoaded',bind,{once:true});
})();
