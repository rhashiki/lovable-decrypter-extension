(() => {
  'use strict';
  if (window.__LD99_CANONICAL_GIT_TRANSACTIONS_CLIENT__) return;
  window.__LD99_CANONICAL_GIT_TRANSACTIONS_CLIENT__ = true;

  const PORT='ld2-git-transactions';
  const BUILD=99;
  function projectId(){return String(window.LovableDecrypterV2?.getProjectId?.()||'');}
  function request(action,payload={},timeoutMs=180000){return new Promise((resolve,reject)=>{const port=chrome.runtime.connect({name:PORT}),id=crypto.randomUUID();let settled=false;const finish=(fn,value)=>{if(settled)return;settled=true;clearTimeout(timer);try{port.disconnect();}catch{}fn(value);};const timer=setTimeout(()=>{const error=new Error(`GIT_TRANSACTION_TIMEOUT:${action}`);error.code='GIT_TRANSACTION_TIMEOUT';finish(reject,error);},Math.max(5000,timeoutMs));port.onMessage.addListener(message=>{if(message?.id!==id)return;if(message.ok)finish(resolve,message.data);else{const error=new Error(message?.error||'GIT_TRANSACTION_FAILED');error.code=message?.code||'GIT_TRANSACTION_FAILED';error.plan=message?.plan||null;error.snapshot=message?.snapshot||null;finish(reject,error);}});port.onDisconnect.addListener(()=>{if(!settled){const error=new Error(chrome.runtime.lastError?.message||'GIT_TRANSACTION_DISCONNECTED');error.code='GIT_TRANSACTION_DISCONNECTED';finish(reject,error);}});port.postMessage({id,action,payload});});}

  async function list(limit=40){return (await request('list',{projectId:projectId(),limit},60000)).transactions||[];}
  async function snapshot(transactionId){return (await request('snapshot',{transactionId},180000)).snapshot;}
  async function revertPreview(transactionId){return request('revert_preview',{transactionId},180000);}
  async function applyRevert(previewId,options={}){
    if(options.humanDecision!==true){const error=new Error('Confirmação humana explícita é obrigatória para reverter a Change Transaction.');error.code='GIT_TRANSACTION_REVERT_HUMAN_CONFIRMATION_REQUIRED';throw error;}
    return request('revert_apply',{previewId,humanDecision:true},240000);
  }

  window.LovableDecrypterCanonicalGitTransactionsApi=Object.freeze({
    build:BUILD,schema:'ld-git-transaction/1',projectId,status:()=>request('status',{},30000),list,snapshot,revertPreview,applyRevert,
    directGitWrite:false,directCommitAuthority:false,partialRevertAllowed:false,previewRequired:true,humanConfirmationRequired:true,guardedCommitRuntimeRequired:true
  });
})();
