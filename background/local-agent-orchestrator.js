import { getSettings } from '../storage/settings-store.js';
import { GitAdapter } from '../github/git-adapter.js';
import { buildProjectContextV2 } from './context-engine-runtime.js';
import { executeLocalChat, localRuntimeHealth } from './local-model-runtime.js';
import { invokeToolRuntimeAction } from './tool-runtime.js';
import { loadRecentUserEdits } from '../core/context-engine-v2.js';
import { assertScopeIntelligence, scopeIntelligenceFingerprint } from '../core/scope-intelligence-v2.js';
import { normalizeApprovalPlan } from '../core/approval-transaction.js';
import { applyTextPatch } from '../core/patch-engine.js';
import {
  AUTONOMY_POLICY_STORAGE_KEY,
  evaluateAutonomyPolicy,
  normalizeAutonomyMode
} from '../core/guided-autonomy-policy.js';
import {
  localAgentProposalDigest,
  localAgentProposalPaths,
  localAgentProposalPublic,
  normalizeLocalAgentWriteProposal
} from '../core/local-agent-approval.js';
import {
  createContinuityTask,
  defineContinuitySteps,
  claimContinuityStep,
  completeContinuityStep,
  failContinuityStep,
  continuityDigest,
  getContinuityTask,
  listContinuityTasks,
  resumeContinuityTask,
  cancelContinuityTask
} from '../core/continuity-engine.js';

const PORT_NAME = 'ld2-local-agent-orchestrator';
const RUNS_KEY = 'ld68_local_agent_runs_v1';
const SESSION_PREFIX = 'ld68_local_agent_session_v1_';
const APPROVAL_TX_PREFIX = 'ld2_approval_tx_v1_';
const MAX_RUNS = 80;
const DEFAULT_MAX_ITERATIONS = 8;
const READ_TOOLS = new Set(['repo.list_files','repo.read_file','repo.grep','repo.git_diff','repo.patch_preview','diagnostics.run','lsp.query']);
const WRITE_TOOLS = new Set(['repo.patch_apply','repo.write_file']);

const text = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const nowIso = () => new Date().toISOString();
const sessionKey = taskId => `${SESSION_PREFIX}${text(taskId,160).replace(/[^a-z0-9-]/gi,'')}`;
const txKey = id => `${APPROVAL_TX_PREFIX}${text(id,160).replace(/[^a-z0-9-]/gi,'')}`;

async function loadRuns(){const s=await chrome.storage.local.get(RUNS_KEY);return Array.isArray(s[RUNS_KEY])?s[RUNS_KEY]:[];}
async function saveRuns(rows){await chrome.storage.local.set({[RUNS_KEY]:(Array.isArray(rows)?rows:[]).slice(0,MAX_RUNS)});}
async function upsertRun(patch={}){const rows=await loadRuns();const i=rows.findIndex(x=>x?.taskId===patch.taskId);const next={...(i>=0?rows[i]:{}),...patch,updatedAt:nowIso()};if(i>=0)rows[i]=next;else rows.unshift(next);await saveRuns(rows);return next;}
async function getRun(taskId){return (await loadRuns()).find(x=>x?.taskId===taskId)||null;}
async function loadSession(taskId){const s=await chrome.storage.session.get(sessionKey(taskId));return s[sessionKey(taskId)]||null;}
async function saveSession(taskId,state){await chrome.storage.session.set({[sessionKey(taskId)]:state});return state;}
async function clearSession(taskId){await chrome.storage.session.remove(sessionKey(taskId));}

async function currentAutonomyMode(){
  const stored=await chrome.storage.local.get(AUTONOMY_POLICY_STORAGE_KEY);
  return normalizeAutonomyMode(stored?.[AUTONOMY_POLICY_STORAGE_KEY]?.mode||'manual');
}
function publicPolicyDecision(decision={}){
  return {
    schema:'ld-guided-autonomy-policy/1',
    build:98,
    mode:text(decision?.mode,40),
    action:text(decision?.action,80),
    decision:text(decision?.decision,40),
    rule:text(decision?.rule,120),
    automaticEligible:decision?.automaticEligible===true,
    humanRequired:decision?.humanRequired===true,
    denied:decision?.denied===true,
    mandatoryGates:decision?.mandatoryGates||{},
    constraints:decision?.constraints||{}
  };
}
async function evaluatePendingPolicy(pending={}){
  const mode=await currentAutonomyMode();
  return evaluateAutonomyPolicy({mode,tool:pending?.tool,input:pending?.input||{}});
}

function activeGithub(settings,projectId=''){const mapping=projectId&&settings?.projectMappings?.[projectId]?settings.projectMappings[projectId]:{};return{...(settings?.github||{}),...(mapping||{})};}
async function currentHead(adapter,branch='main'){const ref=await adapter.getRef(branch||'main');return text(ref?.object?.sha||ref?.sha,160).toLowerCase();}
function stripFence(value=''){const source=String(value||'').trim();const match=source.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);return match?match[1].trim():source;}
function parseJson(value='',code='LOCAL_AGENT_INVALID_JSON'){const source=stripFence(value);try{return JSON.parse(source);}catch{}const a=source.indexOf('{'),b=source.lastIndexOf('}');if(a>=0&&b>a){try{return JSON.parse(source.slice(a,b+1));}catch{}}throw Object.assign(new Error(code),{code});}

function publicRun(row={}){
  return {
    schema:'ld-local-agent/1',taskId:text(row.taskId,160),projectId:text(row.projectId,160),repo:text(row.repo,300),branch:text(row.branch,240),
    status:text(row.status,80),mode:text(row.mode,40),iteration:Number(row.iteration||0)||0,maxIterations:Number(row.maxIterations||DEFAULT_MAX_ITERATIONS)||DEFAULT_MAX_ITERATIONS,
    commandDigest:text(row.commandDigest,128),contextDigest:text(row.contextDigest,128),planDigest:text(row.planDigest,128),resumeGeneration:Number(row.resumeGeneration||0)||0,
    pendingWriteDigest:text(row.pendingWriteDigest,128),pendingTool:text(row.pendingTool,160),pendingPaths:Array.isArray(row.pendingPaths)?row.pendingPaths.slice(0,30):[],
    autonomyMode:text(row.autonomyMode||'manual',40),lastPolicyDecision:text(row.lastPolicyDecision,40),lastPolicyRule:text(row.lastPolicyRule,120),lastAuthorizationKind:text(row.lastAuthorizationKind,40),
    lastAction:text(row.lastAction,160),lastErrorCode:text(row.lastErrorCode,160),createdAt:text(row.createdAt,80),updatedAt:text(row.updatedAt,80),completedAt:text(row.completedAt,80),
    routeHistory:(Array.isArray(row.routeHistory)?row.routeHistory:[]).slice(-16).map(x=>({tier:text(x?.tier,40),model:text(x?.model,240),degraded:x?.degraded===true,at:text(x?.at,80)})),
    rawPromptPersistedDurably:false,rawModelOutputPersistedDurably:false,paidFallbackAllowed:false,remoteFallbackAllowed:false
  };
}

function compact(value,max=200000){let out='';try{out=JSON.stringify(value);}catch{out='{}';}return out.length>max?`${out.slice(0,max)}\n...[truncated in-memory]`:out;}
function compactTrace(result={}){
  const d=result?.data||{};const out={tool:text(result?.tool,160),operationId:text(result?.operationId,160),code:text(d?.code,120),commitSha:text(d?.commitSha,160),fileCount:Number(d?.fileCount||0)||0,matchCount:Number(d?.matchCount||0)||0};
  if(out.tool==='repo.read_file')Object.assign(out,{path:text(d?.path,1000),blobSha:text(d?.blobSha,160),content:String(d?.content||'').slice(0,60000)});
  if(out.tool==='repo.grep')out.matches=(Array.isArray(d?.matches)?d.matches:[]).slice(0,80).map(x=>({path:text(x?.path,1000),line:Number(x?.line||0)||0,preview:String(x?.preview||'').slice(0,1000)}));
  if(out.tool==='repo.list_files')out.files=(Array.isArray(d?.files)?d.files:[]).slice(0,300).map(x=>({path:text(x?.path,1000),sha:text(x?.sha,160),size:Number(x?.size||0)||0}));
  if(out.tool==='repo.git_diff')out.files=(Array.isArray(d?.files)?d.files:[]).slice(0,100).map(x=>({path:text(x?.path,1000),status:text(x?.status,80),additions:Number(x?.additions||0),deletions:Number(x?.deletions||0),patch:String(x?.patch||'').slice(0,8000)}));
  if(out.tool==='diagnostics.run'||out.tool==='lsp.query')out.result=compact(d,30000);
  return out;
}

function planPrompt(){return [
  'You are Lovable Decrypter local planner. Return ONLY JSON.',
  'Schema: {"summary":string,"plan":string[],"files":[{"path":string,"reason":string}],"warnings":string[]}.',
  'Scope must be minimal. Never include .env, credentials, secrets or unrelated cleanup.',
  'Human edits outrank previous AI edits. Never widen scope because a tool exists.',
  'Never suggest paid or remote AI fallback.'
].join('\n');}
function agentPrompt(tools=[]){return [
  'You are Lovable Decrypter Local Agent. Return ONLY one JSON object.',
  'Allowed shapes: {"type":"tool","tool":string,"input":object,"reason":string} OR {"type":"final","summary":string,"verification":string} OR {"type":"stop","reason":string}.',
  'Read tools run automatically. Writes are gated by the Build 98 policy engine; the model never decides whether a write is AUTO or human-approved.',
  'Prefer repo.patch_apply for updates. Read the current file first and include expectedBlobSha. Use small exact search/replace edits.',
  'Never invent file contents/blob SHAs, touch sensitive paths, expand the approved plan, or fabricate diagnostics.',
  'After writes, inspect Git diff and use diagnostics when available. Never request remote/paid fallback.',
  `TOOLS\n${tools.map(x=>`${x.name} [${x.mode}] ${x.description||''}`).join('\n')}`
].join('\n');}
function validPlan(value={}){const plan=normalizeApprovalPlan(value);if(!plan.summary||!plan.plan.length)throw Object.assign(new Error('LOCAL_AGENT_PLAN_INVALID'),{code:'LOCAL_AGENT_PLAN_INVALID'});return plan;}
function validAction(value={},toolMap=new Map()){
  const type=text(value?.type,40).toLowerCase();
  if(type==='final')return{type,summary:text(value?.summary,30000),verification:text(value?.verification,12000)};
  if(type==='stop')return{type,reason:text(value?.reason,12000)};
  if(type!=='tool')throw Object.assign(new Error('LOCAL_AGENT_ACTION_INVALID'),{code:'LOCAL_AGENT_ACTION_INVALID'});
  const tool=text(value?.tool,160),def=toolMap.get(tool);if(!def||(!READ_TOOLS.has(tool)&&!WRITE_TOOLS.has(tool)))throw Object.assign(new Error(`LOCAL_AGENT_TOOL_NOT_ALLOWED:${tool}`),{code:'LOCAL_AGENT_TOOL_NOT_ALLOWED'});
  return{type,tool,mode:def.mode,input:value?.input&&typeof value.input==='object'?value.input:{},reason:text(value?.reason,8000)};
}

async function ensureStep(taskId,descriptor){await defineContinuitySteps(taskId,[descriptor]);}
async function inference({run,state,key,label,role,messages,iteration=0}){
  const stepKey=`${key}:g${run.resumeGeneration||0}`;await ensureStep(run.taskId,{idempotencyKey:stepKey,label,kind:'inference',mode:'inference',resumable:true,retrySafe:true,maxAttempts:4});
  const digest=await continuityDigest(JSON.stringify({role,iteration,commandDigest:run.commandDigest,contextDigest:run.contextDigest}));
  const lease=await claimContinuityStep({taskId:run.taskId,idempotencyKey:stepKey,workerId:'local-agent-orchestrator',leaseMs:240000,inputDigest:digest});
  if(lease.replay)return{replay:true};if(!lease.claimed)throw Object.assign(new Error('LOCAL_AGENT_INFERENCE_BUSY'),{code:'LOCAL_AGENT_INFERENCE_BUSY'});
  try{const result=await executeLocalChat({command:state.command,role,iteration,failures:Number(run.failureCount||0),contextFileCount:Array.isArray(state.contextPack?.files)?state.contextPack.files.length:0,messages});await completeContinuityStep({taskId:run.taskId,idempotencyKey:stepKey,leaseToken:lease.leaseToken,outputDigest:await continuityDigest(result.content)});return{replay:false,result};}
  catch(error){await failContinuityStep({taskId:run.taskId,idempotencyKey:stepKey,leaseToken:lease.leaseToken,errorCode:error?.code||'LOCAL_INFERENCE_FAILED',outcomeUnknown:false}).catch(()=>null);throw error;}
}
async function ensureContext(run,state){
  if(state.contextPack)return state.contextPack;const key=`context:g${run.resumeGeneration||0}`;await ensureStep(run.taskId,{idempotencyKey:key,label:'Context Engine v2',kind:'context',mode:'read',resumable:true,retrySafe:true});
  const lease=await claimContinuityStep({taskId:run.taskId,idempotencyKey:key,workerId:'local-agent-orchestrator',leaseMs:180000,inputDigest:run.commandDigest});
  if(lease.replay&&!state.contextPack){run.resumeGeneration=(run.resumeGeneration||0)+1;await upsertRun(run);return ensureContext(run,state);}if(!lease.claimed&&!lease.replay)throw Object.assign(new Error('LOCAL_AGENT_CONTEXT_BUSY'),{code:'LOCAL_AGENT_CONTEXT_BUSY'});
  try{const pack=await buildProjectContextV2({task:state.command,projectId:run.projectId,explicitPaths:state.explicitPaths||[],skills:state.skills||[],includeKnowledge:state.includeKnowledge!==false});const digest=text(pack?.digest,128)||await continuityDigest(compact({files:(pack?.files||[]).map(x=>[x.path,x.sha||x.blobSha||'',x.truncated===true]),budget:pack?.budget},100000));if(lease?.leaseToken)await completeContinuityStep({taskId:run.taskId,idempotencyKey:key,leaseToken:lease.leaseToken,outputDigest:digest});state.contextPack=pack;run.contextDigest=digest;await Promise.all([saveSession(run.taskId,state),upsertRun(run)]);return pack;}
  catch(error){if(lease?.leaseToken)await failContinuityStep({taskId:run.taskId,idempotencyKey:key,leaseToken:lease.leaseToken,errorCode:error?.code||'CONTEXT_ENGINE_FAILED',outcomeUnknown:false}).catch(()=>null);throw error;}
}
async function ensurePlan(run,state){
  if(state.plan)return state.plan;const pack=await ensureContext(run,state);const inf=await inference({run,state,key:'plan',label:'Local plan',role:'planner',messages:[{role:'system',content:planPrompt()},{role:'user',content:`REQUEST\n${state.command}\n\nCONTEXT\n${compact(pack,170000)}`}]});
  if(inf.replay){run.resumeGeneration=(run.resumeGeneration||0)+1;await upsertRun(run);return ensurePlan(run,state);}const plan=validPlan(parseJson(inf.result.content,'LOCAL_AGENT_PLAN_JSON_INVALID'));state.plan=plan;run.planDigest=await continuityDigest(JSON.stringify(plan));const route=inf.result.route||{};run.routeHistory=[...(run.routeHistory||[]),{tier:route.tier,model:route.model,degraded:route.degraded===true,at:nowIso()}].slice(-16);run.lastAction='plan-ready';await Promise.all([saveSession(run.taskId,state),upsertRun(run)]);return plan;
}

async function materializeProposal(proposal,adapter,branch){
  const normalized=normalizeLocalAgentWriteProposal(proposal?.tool,proposal?.input||{});const files=[];
  if(normalized.tool==='repo.patch_apply'){
    for(const patch of normalized.input.patches){if(!patch.expectedBlobSha)throw Object.assign(new Error(`LOCAL_AGENT_EXPECTED_BLOB_REQUIRED:${patch.path}`),{code:'LOCAL_AGENT_EXPECTED_BLOB_REQUIRED'});const file=await adapter.getFileByPath(patch.path,branch);const applied=await applyTextPatch({path:patch.path,currentText:file?.text||'',currentBlobSha:file?.sha||'',patch});files.push({path:patch.path,action:'update',before:file?.text||'',content:applied.content});}
    return files;
  }
  const input=normalized.input;
  if(input.action==='create'){
    try{await adapter.getFileByPath(input.path,branch);throw Object.assign(new Error(`LOCAL_AGENT_CREATE_EXISTS:${input.path}`),{code:'LOCAL_AGENT_CREATE_EXISTS'});}catch(error){if(error?.code==='LOCAL_AGENT_CREATE_EXISTS')throw error;}
    files.push({path:input.path,action:'create',before:'',content:input.content});return files;
  }
  if(!input.expectedBlobSha)throw Object.assign(new Error(`LOCAL_AGENT_EXPECTED_BLOB_REQUIRED:${input.path}`),{code:'LOCAL_AGENT_EXPECTED_BLOB_REQUIRED'});
  const file=await adapter.getFileByPath(input.path,branch);if(text(file?.sha,160)!==text(input.expectedBlobSha,160))throw Object.assign(new Error(`LOCAL_AGENT_PROPOSAL_STALE:${input.path}`),{code:'LOCAL_AGENT_PROPOSAL_STALE'});
  files.push({path:input.path,action:input.action,before:file?.text||'',content:input.action==='delete'?'':input.content});return files;
}

async function createApproval(run,state,pending,{authorizationKind='human',humanIntentOverrides=[],policyDecision=null}={}){
  const proposal=normalizeLocalAgentWriteProposal(pending.tool,pending.input),digest=await localAgentProposalDigest(proposal);if(digest!==pending.digest)throw Object.assign(new Error('LOCAL_AGENT_PROPOSAL_DIGEST_MISMATCH'),{code:'LOCAL_AGENT_PROPOSAL_DIGEST_MISMATCH'});
  const settings=await getSettings(),github=activeGithub(settings,run.projectId),adapter=new GitAdapter(github),head=await currentHead(adapter,github.branch||'main');if(!head)throw Object.assign(new Error('LOCAL_AGENT_HEAD_UNAVAILABLE'),{code:'LOCAL_AGENT_HEAD_UNAVAILABLE'});
  const [recentUserEdits,files]=await Promise.all([loadRecentUserEdits(run.projectId,80),materializeProposal(proposal,adapter,github.branch||'main')]);const paths=localAgentProposalPaths(proposal);
  const effectiveOverrides=authorizationKind==='human'?[...new Set((Array.isArray(humanIntentOverrides)?humanIntentOverrides:[]).filter(path=>paths.includes(path)))]:[];
  const scope=assertScopeIntelligence({command:state.command,approvedPlan:state.plan,files,recentUserEdits,humanIntentOverrides:effectiveOverrides,decision:'approve'});const scopeHash=await continuityDigest(JSON.stringify(scopeIntelligenceFingerprint(scope)));const id=crypto.randomUUID();
  const policy=authorizationKind==='policy'?publicPolicyDecision(policyDecision||{}):null;
  const tx={schema:'ld-approval-transaction/1',id,planId:id,projectId:run.projectId,source:authorizationKind==='policy'?'guided-autonomy-policy-v98':'local-agent-v68',decision:'approve',humanDecision:authorizationKind==='human',authorizationKind,status:'validated',baseHeadSha:head,stateRevision:`git:${head}`,authorizedFiles:paths,humanIntentOverrides:effectiveOverrides,scopeIntelligenceHash:scopeHash,localAgentProposalDigest:digest,policyAuthorization:policy,hash:await continuityDigest(JSON.stringify({projectId:run.projectId,head,paths,digest,scopeHash,authorizationKind,policyRule:policy?.rule||''})),createdAt:nowIso(),expiresAt:new Date(Date.now()+5*60*1000).toISOString(),bundleId:`local-agent:${authorizationKind}:${run.taskId}:${digest.slice(0,12)}`};
  await chrome.storage.session.set({[txKey(id)]:tx});return{transaction:tx,head};
}

async function executeAuthorizedWrite(run,state,{authorizationKind='human',humanDecision=false,proposalDigest='',humanIntentOverrides=[]}={}){
  const pending=state.pendingProposal;if(!pending)throw Object.assign(new Error('LOCAL_AGENT_PENDING_WRITE_REQUIRED'),{code:'LOCAL_AGENT_PENDING_WRITE_REQUIRED'});if(proposalDigest!==pending.digest)throw Object.assign(new Error('LOCAL_AGENT_PROPOSAL_DIGEST_MISMATCH'),{code:'LOCAL_AGENT_PROPOSAL_DIGEST_MISMATCH'});
  const policyDecision=await evaluatePendingPolicy(pending);run.autonomyMode=policyDecision.mode;run.lastPolicyDecision=policyDecision.decision;run.lastPolicyRule=policyDecision.rule;
  if(policyDecision.denied){const error=Object.assign(new Error(`AUTONOMY_POLICY_DENIED:${policyDecision.rule}`),{code:'AUTONOMY_POLICY_DENIED',details:publicPolicyDecision(policyDecision)});run.status='policy_denied';run.lastErrorCode=error.code;await upsertRun(run);throw error;}
  if(authorizationKind==='policy'&&policyDecision.automaticEligible!==true)throw Object.assign(new Error(`AUTONOMY_POLICY_AUTO_NOT_ALLOWED:${policyDecision.rule}`),{code:'AUTONOMY_POLICY_AUTO_NOT_ALLOWED',details:publicPolicyDecision(policyDecision)});
  if(authorizationKind!=='policy'&&humanDecision!==true)throw Object.assign(new Error('LOCAL_AGENT_HUMAN_APPROVAL_REQUIRED'),{code:'LOCAL_AGENT_HUMAN_APPROVAL_REQUIRED'});
  const kind=authorizationKind==='policy'?'policy':'human';
  const approvalKey=`approval:${run.iteration}:g${run.resumeGeneration||0}`;await ensureStep(run.taskId,{idempotencyKey:approvalKey,label:kind==='policy'?`Policy authorization · ${policyDecision.rule}`:'Human approval',kind:'approval',mode:'read',resumable:false,retrySafe:true,paths:pending.paths});const approvalLease=await claimContinuityStep({taskId:run.taskId,idempotencyKey:approvalKey,workerId:kind==='policy'?'policy-v98':'human-decision',leaseMs:60000,inputDigest:pending.digest});if(!approvalLease.claimed&&!approvalLease.replay)throw Object.assign(new Error('LOCAL_AGENT_APPROVAL_BUSY'),{code:'LOCAL_AGENT_APPROVAL_BUSY'});if(approvalLease.claimed)await completeContinuityStep({taskId:run.taskId,idempotencyKey:approvalKey,leaseToken:approvalLease.leaseToken,outputDigest:pending.digest});
  const approved=await createApproval(run,state,pending,{authorizationKind:kind,humanIntentOverrides:kind==='human'?humanIntentOverrides:[],policyDecision}),writeKey=`write:${run.iteration}:${pending.digest.slice(0,16)}`;await ensureStep(run.taskId,{idempotencyKey:writeKey,label:pending.tool,kind:'tool',mode:'write',resumable:true,retrySafe:false,paths:pending.paths});
  try{
    const result=await invokeToolRuntimeAction('invoke',{projectId:run.projectId,taskId:run.taskId,tool:pending.tool,input:pending.input,origin:'ai',transactionId:approved.transaction.id,authorization:{transactionId:approved.transaction.id},continuity:{taskId:run.taskId,idempotencyKey:writeKey,workerId:'local-agent-orchestrator',inputDigest:pending.digest,leaseMs:180000}});
    state.trace=[...(state.trace||[]),compactTrace(result),{tool:'policy.authorization',code:'OK',authorizationKind:kind,policy:publicPolicyDecision(policyDecision)}].slice(-16);state.pendingProposal=null;run.pendingWriteDigest='';run.pendingTool='';run.pendingPaths=[];run.lastAuthorizationKind=kind;run.lastAction=kind==='policy'?'write-applied-policy-auto':'write-applied-human';run.iteration+=1;
    const commitSha=text(result?.data?.commitSha,160);if(commitSha){const key=`verify-diff:${run.iteration}:${commitSha.slice(0,12)}`;await ensureStep(run.taskId,{idempotencyKey:key,label:'Verify Git diff',kind:'verification',mode:'read',resumable:true,retrySafe:true,paths:pending.paths});try{const diff=await invokeToolRuntimeAction('invoke',{projectId:run.projectId,taskId:run.taskId,tool:'repo.git_diff',input:{base:approved.head,head:commitSha,includePatch:true},origin:'ai',continuity:{taskId:run.taskId,idempotencyKey:key,workerId:'local-agent-orchestrator'}});state.trace=[...state.trace,compactTrace(diff)].slice(-16);}catch(error){state.trace=[...state.trace,{tool:'repo.git_diff',code:error?.code||'VERIFY_DIFF_FAILED'}].slice(-16);}}
    const diagKey=`diagnostics:${run.iteration}`;await ensureStep(run.taskId,{idempotencyKey:diagKey,label:'Diagnostics',kind:'diagnostics',mode:'read',resumable:true,retrySafe:true,paths:pending.paths});try{const diag=await invokeToolRuntimeAction('invoke',{projectId:run.projectId,taskId:run.taskId,tool:'diagnostics.run',input:{paths:pending.paths},origin:'ai',continuity:{taskId:run.taskId,idempotencyKey:diagKey,workerId:'local-agent-orchestrator'}});state.trace=[...state.trace,compactTrace(diag)].slice(-16);}catch(error){state.trace=[...state.trace,{tool:'diagnostics.run',code:error?.code||'DIAGNOSTICS_UNAVAILABLE',unavailable:error?.code==='TOOL_CAPABILITY_UNAVAILABLE'}].slice(-16);}
    await Promise.all([saveSession(run.taskId,state),upsertRun(run)]);return result;
  }finally{await chrome.storage.session.remove(txKey(approved.transaction.id)).catch(()=>null);}
}

async function resolvePendingProposal(run,state,plan){
  const pending=state.pendingProposal;
  const policyDecision=await evaluatePendingPolicy(pending);
  Object.assign(run,{autonomyMode:policyDecision.mode,lastPolicyDecision:policyDecision.decision,lastPolicyRule:policyDecision.rule});
  if(policyDecision.denied){run.status='policy_denied';run.lastAction='policy-denied';run.lastErrorCode='AUTONOMY_POLICY_DENIED';await upsertRun(run);return{autoExecuted:false,response:{ok:false,status:'policy_denied',code:'AUTONOMY_POLICY_DENIED',run:publicRun(run),plan,proposal:{...localAgentProposalPublic(pending),digest:pending.digest,reason:pending.reason,normalized:pending.normalized},policy:publicPolicyDecision(policyDecision),humanApprovalRequired:false}};}
  if(policyDecision.automaticEligible){await executeAuthorizedWrite(run,state,{authorizationKind:'policy',proposalDigest:pending.digest,humanIntentOverrides:[]});return{autoExecuted:true,response:null};}
  run.status='waiting_approval';run.lastAction='write-awaiting-human';await upsertRun(run);return{autoExecuted:false,response:{ok:true,status:'waiting_approval',run:publicRun(run),plan,proposal:{...localAgentProposalPublic(pending),digest:pending.digest,reason:pending.reason,normalized:pending.normalized},policy:publicPolicyDecision(policyDecision),humanApprovalRequired:true}};
}

async function drive(run,state){
  const settings=await getSettings(),max=Math.max(1,Math.min(12,Number(run.maxIterations||settings?.localAI?.maxIterations||DEFAULT_MAX_ITERATIONS))),pack=await ensureContext(run,state),plan=await ensurePlan(run,state);
  if(run.mode==='plan'){run.status='completed';run.lastAction='plan-complete';run.completedAt=nowIso();await upsertRun(run);return{ok:true,status:'completed',run:publicRun(run),plan,result:{summary:plan.summary,verification:'Plan mode: no write executed.'},paidFallbackUsed:false,remoteFallbackUsed:false};}
  const listed=await invokeToolRuntimeAction('list',{projectId:run.projectId,taskId:run.taskId}),tools=(listed?.tools||[]).filter(x=>READ_TOOLS.has(x.name)||WRITE_TOOLS.has(x.name)),toolMap=new Map(tools.map(x=>[x.name,x]));
  while(run.iteration<max){
    if(state.pendingProposal){const resolved=await resolvePendingProposal(run,state,plan);if(!resolved.autoExecuted)return resolved.response;run=await getRun(run.taskId)||run;state=await loadSession(run.taskId)||state;continue;}
    const inf=await inference({run,state,key:`agent:${run.iteration}`,label:`Local agent ${run.iteration+1}`,role:run.iteration?'repair':'coding',iteration:run.iteration,messages:[{role:'system',content:agentPrompt(tools)},{role:'user',content:compact({request:state.command,plan,context:pack,recentToolEvidence:(state.trace||[]).slice(-8)},220000)}]});
    if(inf.replay){run.resumeGeneration=(run.resumeGeneration||0)+1;await upsertRun(run);continue;}const action=validAction(parseJson(inf.result.content,'LOCAL_AGENT_ACTION_JSON_INVALID'),toolMap),route=inf.result.route||{};run.routeHistory=[...(run.routeHistory||[]),{tier:route.tier,model:route.model,degraded:route.degraded===true,at:nowIso()}].slice(-16);
    if(action.type==='final'){run.status='completed';run.lastAction='final';run.completedAt=nowIso();await upsertRun(run);await clearSession(run.taskId);return{ok:true,status:'completed',run:publicRun(run),plan,result:{summary:action.summary,verification:action.verification},paidFallbackUsed:false,remoteFallbackUsed:false};}
    if(action.type==='stop'){run.status='stopped';run.lastAction='model-stop';await Promise.all([upsertRun(run),saveSession(run.taskId,state)]);return{ok:true,status:'stopped',run:publicRun(run),plan,reason:action.reason};}
    if(action.mode==='write'){
      const normalized=normalizeLocalAgentWriteProposal(action.tool,action.input),digest=await localAgentProposalDigest(normalized),paths=localAgentProposalPaths(normalized);state.pendingProposal={tool:action.tool,input:normalized.input,normalized,digest,paths,reason:action.reason};Object.assign(run,{status:'policy_evaluating',pendingWriteDigest:digest,pendingTool:action.tool,pendingPaths:paths,lastAction:'write-proposed'});await Promise.all([saveSession(run.taskId,state),upsertRun(run)]);
      const resolved=await resolvePendingProposal(run,state,plan);if(!resolved.autoExecuted)return resolved.response;run=await getRun(run.taskId)||run;state=await loadSession(run.taskId)||state;continue;
    }
    const key=`tool:${run.iteration}:${action.tool}`;await ensureStep(run.taskId,{idempotencyKey:key,label:action.tool,kind:action.tool==='diagnostics.run'?'diagnostics':'tool',mode:'read',resumable:true,retrySafe:true});try{const result=await invokeToolRuntimeAction('invoke',{projectId:run.projectId,taskId:run.taskId,tool:action.tool,input:action.input,origin:'ai',continuity:{taskId:run.taskId,idempotencyKey:key,workerId:'local-agent-orchestrator'}});state.trace=[...(state.trace||[]),compactTrace(result)].slice(-16);run.lastAction=`tool:${action.tool}`;}catch(error){state.trace=[...(state.trace||[]),{tool:action.tool,code:error?.code||'TOOL_FAILED',message:text(error?.message,1200)}].slice(-16);run.failureCount=Number(run.failureCount||0)+1;run.lastErrorCode=error?.code||'TOOL_FAILED';if(!['TOOL_CAPABILITY_UNAVAILABLE','TOOL_READ_LIMIT_EXCEEDED','GREP_QUERY_INVALID'].includes(error?.code||'')){await Promise.all([saveSession(run.taskId,state),upsertRun(run)]);throw error;}}
    run.iteration+=1;await Promise.all([saveSession(run.taskId,state),upsertRun(run)]);
  }
  run.status='iteration_limit';run.lastAction='iteration-limit';run.lastErrorCode='LOCAL_AGENT_ITERATION_LIMIT';await Promise.all([saveSession(run.taskId,state),upsertRun(run)]);return{ok:false,status:'iteration_limit',code:'LOCAL_AGENT_ITERATION_LIMIT',run:publicRun(run),plan};
}

async function start(payload={}){
  const command=text(payload?.command,60000),projectId=text(payload?.projectId,160);if(!command)throw Object.assign(new Error('LOCAL_AGENT_COMMAND_REQUIRED'),{code:'LOCAL_AGENT_COMMAND_REQUIRED'});if(!projectId)throw Object.assign(new Error('LOCAL_AGENT_PROJECT_REQUIRED'),{code:'LOCAL_AGENT_PROJECT_REQUIRED'});
  const settings=await getSettings(),github=activeGithub(settings,projectId);if(settings?.localAI?.enabled===false)throw Object.assign(new Error('LOCAL_AGENT_DISABLED'),{code:'LOCAL_AGENT_DISABLED'});if(!github?.owner||!github?.repo)throw Object.assign(new Error('LOCAL_AGENT_GITHUB_MAPPING_REQUIRED'),{code:'LOCAL_AGENT_GITHUB_MAPPING_REQUIRED'});const health=await localRuntimeHealth({includeMetrics:true});if(!health.ok)throw Object.assign(new Error(health.code||'LOCAL_RUNTIME_UNAVAILABLE'),{code:health.code||'LOCAL_RUNTIME_UNAVAILABLE',details:health});if(!health.tokenConfigured)throw Object.assign(new Error('LOCAL_RUNTIME_TOKEN_REQUIRED'),{code:'LOCAL_RUNTIME_TOKEN_REQUIRED'});
  const autonomyMode=await currentAutonomyMode();const commandDigest=await continuityDigest(command),task=await createContinuityTask({projectId,repo:`${github.owner}/${github.repo}`,branch:github.branch||'main',commandDigest,metadata:{mode:payload?.mode||'build',source:'local-agent-v68',autonomyPolicyBuild:98}}),run=await upsertRun({taskId:task.id,projectId,repo:`${github.owner}/${github.repo}`,branch:github.branch||'main',status:'running',mode:payload?.mode==='plan'?'plan':'build',iteration:0,maxIterations:Math.max(1,Math.min(12,Number(payload?.maxIterations||settings?.localAI?.maxIterations||DEFAULT_MAX_ITERATIONS))),commandDigest,contextDigest:'',planDigest:'',resumeGeneration:0,pendingWriteDigest:'',pendingTool:'',pendingPaths:[],autonomyMode,lastPolicyDecision:'',lastPolicyRule:'',lastAuthorizationKind:'',lastAction:'created',lastErrorCode:'',failureCount:0,routeHistory:[],createdAt:nowIso(),completedAt:''});
  const state={command,explicitPaths:Array.isArray(payload?.explicitPaths)?payload.explicitPaths.slice(0,30):[],skills:Array.isArray(payload?.skills)?payload.skills.slice(0,12):[],includeKnowledge:payload?.includeKnowledge!==false,contextPack:null,plan:null,trace:[],pendingProposal:null};await saveSession(task.id,state);return drive(run,state);
}
async function resume(payload={}){
  const taskId=text(payload?.taskId,160);let run=await getRun(taskId);if(!run)throw Object.assign(new Error('LOCAL_AGENT_RUN_NOT_FOUND'),{code:'LOCAL_AGENT_RUN_NOT_FOUND'});let state=await loadSession(taskId);if(!state){const command=text(payload?.command,60000);if(!command||await continuityDigest(command)!==run.commandDigest)throw Object.assign(new Error('LOCAL_AGENT_REHYDRATION_REQUIRED'),{code:'LOCAL_AGENT_REHYDRATION_REQUIRED'});state={command,explicitPaths:Array.isArray(payload?.explicitPaths)?payload.explicitPaths.slice(0,30):[],skills:Array.isArray(payload?.skills)?payload.skills.slice(0,12):[],includeKnowledge:payload?.includeKnowledge!==false,contextPack:null,plan:payload?.plan?validPlan(payload.plan):null,trace:[],pendingProposal:payload?.pendingProposal||null};run.resumeGeneration=(run.resumeGeneration||0)+1;}
  await resumeContinuityTask(taskId).catch(()=>null);run.status='running';run.lastErrorCode='';await Promise.all([saveSession(taskId,state),upsertRun(run)]);if(state.pendingProposal&&payload?.humanDecision===true)await executeAuthorizedWrite(run,state,{authorizationKind:'human',humanDecision:true,proposalDigest:text(payload?.proposalDigest,128),humanIntentOverrides:Array.isArray(payload?.humanIntentOverrides)?payload.humanIntentOverrides:[]});run=await getRun(taskId);state=await loadSession(taskId)||state;return drive(run,state);
}
async function approveWrite(payload={}){const taskId=text(payload?.taskId,160),run=await getRun(taskId),state=await loadSession(taskId);if(!run||!state)throw Object.assign(new Error('LOCAL_AGENT_PENDING_SESSION_NOT_FOUND'),{code:'LOCAL_AGENT_PENDING_SESSION_NOT_FOUND'});await executeAuthorizedWrite(run,state,{authorizationKind:'human',humanDecision:payload?.humanDecision===true,proposalDigest:text(payload?.proposalDigest,128),humanIntentOverrides:Array.isArray(payload?.humanIntentOverrides)?payload.humanIntentOverrides:[]});return drive(await getRun(taskId),await loadSession(taskId));}
async function get(payload={}){const taskId=text(payload?.taskId,160),run=await getRun(taskId);if(!run)return{run:null,continuity:null,ephemeralSessionAvailable:false};const state=await loadSession(taskId),proposal=state?.pendingProposal?{...localAgentProposalPublic(state.pendingProposal),digest:state.pendingProposal.digest,reason:state.pendingProposal.reason,normalized:state.pendingProposal.normalized}:null;const policy=state?.pendingProposal?publicPolicyDecision(await evaluatePendingPolicy(state.pendingProposal)):null;return{run:publicRun(run),continuity:await getContinuityTask(taskId).catch(()=>null),ephemeralSessionAvailable:Boolean(state),proposal,policy,plan:state?.plan||null};}
async function list(payload={}){const projectId=text(payload?.projectId,160),rows=(await loadRuns()).filter(x=>!projectId||x?.projectId===projectId).slice(0,Math.max(1,Math.min(80,Number(payload?.limit||30)))),continuity=await listContinuityTasks({projectId,limit:80}).catch(()=>[]),map=new Map((continuity||[]).map(x=>[x.id,x]));return{runs:rows.map(x=>({...publicRun(x),continuity:map.get(x.taskId)||null}))};}
async function cancel(payload={}){const taskId=text(payload?.taskId,160),run=await getRun(taskId);if(!run)throw Object.assign(new Error('LOCAL_AGENT_RUN_NOT_FOUND'),{code:'LOCAL_AGENT_RUN_NOT_FOUND'});await cancelContinuityTask(taskId).catch(()=>null);run.status='cancelled';run.lastAction='cancelled';await Promise.all([upsertRun(run),clearSession(taskId)]);return{run:publicRun(run)};}

async function handle(action,payload={}){
  const op=text(action,80).toLowerCase();if(op==='status'){const health=await localRuntimeHealth({includeMetrics:true}).catch(error=>({ok:false,code:error?.code||'LOCAL_RUNTIME_UNAVAILABLE'}));return{schema:'ld-local-agent/1',build:68,autonomyPolicyBuild:98,localOnly:true,loop:'plan->context->local-model->tools->policy-or-human-authorization->write->diff->diagnostics->repair',continuity:true,modelRouter:'large->medium->small',readToolsAutomatic:true,writesRequirePolicyAuthorization:true,safeCodeMayAuto:true,destructiveWritesRequireHumanApproval:true,callerSuppliedPolicyDecisionTrusted:false,writeApprovalBoundToProposalDigest:true,scopeIntelligenceBeforeWrite:true,humanIntentBeforeWrite:true,noPaidFallback:true,noRemoteFallback:true,rawPromptDurablePersistence:false,rawModelOutputDurablePersistence:false,ephemeralSessionRehydration:true,runtime:health};}
  if(op==='start')return start(payload);if(op==='resume')return resume(payload);if(op==='approve_write')return approveWrite(payload);if(op==='get')return get(payload);if(op==='list')return list(payload);if(op==='cancel')return cancel(payload);throw Object.assign(new Error('LOCAL_AGENT_ACTION_INVALID'),{code:'LOCAL_AGENT_ACTION_INVALID'});
}

export function installLocalAgentOrchestrator(){
  if(globalThis.__LD68_LOCAL_AGENT_ORCHESTRATOR__)return;globalThis.__LD68_LOCAL_AGENT_ORCHESTRATOR__=true;chrome.runtime.onConnect.addListener(port=>{if(port.name!==PORT_NAME)return;const listener=async message=>{const id=text(message?.id,160);try{port.postMessage({id,ok:true,data:await handle(message?.action||'status',message?.payload||{})});}catch(error){try{port.postMessage({id,ok:false,error:error?.message||String(error),code:error?.code||'LOCAL_AGENT_FAILED',details:error?.details||null});}catch{}}};port.onMessage.addListener(listener);});
  globalThis.LovableDecrypterLocalAgent=Object.freeze({build:68,autonomyPolicyBuild:98,schema:'ld-local-agent/1',port:PORT_NAME,localOnly:true,continuityBacked:true,modelRouter:'large->medium->small',readToolsAutomatic:true,writesRequirePolicyAuthorization:true,safeCodeMayAuto:true,destructiveWritesRequireHumanApproval:true,callerSuppliedPolicyDecisionTrusted:false,proposalDigestBinding:true,scopeIntelligenceRequired:true,humanIntentRequired:true,paidFallbackAllowed:false,remoteFallbackAllowed:false});
}
