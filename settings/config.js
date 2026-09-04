export const VERSION = '2.6.83';
export const TRUST_PROTOCOL_VERSION = '2.4.21';
export const STORAGE_KEY = 'ld2_settings';
export const HISTORY_KEY = 'ld2_history';
export const TOOL_RUNTIME_SCHEMA = 'ld-tool-runtime/1';
export const OPERATION_JOURNAL_SCHEMA = 'ld-operation-journal/1';
export const MCP_RUNTIME_SCHEMA = 'ld-mcp-runtime/1';
export const MCP_MARKETPLACE_SCHEMA = 'ld-mcp-marketplace/1';
export const MCP_MARKETPLACE_CATALOG_VERSION = 1;
export const MCP_PROTOCOL_VERSION = '2026-07-28';
export const CONTEXT_ENGINE_SCHEMA = 'ld-context-pack/2';
export const USER_EDIT_CONTEXT_SCHEMA = 'ld-user-edit-context/1';
export const SCOPE_INTELLIGENCE_SCHEMA = 'ld-scope-intelligence/2';
export const REVERSIBLE_OPERATIONS_SCHEMA = 'ld-reversible-operation/1';
export const CONTINUITY_ENGINE_SCHEMA = 'ld-continuity-task/1';
export const LOCAL_MODEL_ROUTER_SCHEMA = 'ld-local-model-router/1';
export const LOCAL_AGENT_SCHEMA = 'ld-local-agent/1';
export const DECRYPTER_BENCH_SCHEMA = 'ld-decrypterbench/2';
export const ACCOUNT_INTEGRATION_SCHEMA = 'ld-account-integration-readiness/1';
export const AGENT_RUNTIME_REGISTRY_SCHEMA = 'ld-agent-runtime-registry/1';
export const PORTABLE_SKILL_SCHEMA = 'ld-portable-skill/2';
export const PORTABLE_SKILL_REGISTRY_SCHEMA = 'ld-portable-skill-registry/2';
export const AGENT_SANDBOX_SCHEMA = 'ld-agent-sandbox/1';
export const AGENT_SANDBOX_DIFF_SCHEMA = 'ld-agent-sandbox-diff/1';
export const NATIVE_AGENT_SESSION_SCHEMA = 'ld-native-agent-session/1';
export const RUNTIME_SELECTION_SCHEMA = 'ld-runtime-selection/1';
export const UNIVERSAL_AGENT_BENCH_SCHEMA = 'ld-universal-agent-bench/1';
export const DEFAULT_BACKEND_BASE = 'https://kkzxxnfxgrouhkzyszxs.supabase.co/functions/v1';
export const DEFAULT_VAULT_API_BASE = `${DEFAULT_BACKEND_BASE}/ld-vault`;
export const DEFAULT_UPDATE_FEED_URL = `${DEFAULT_BACKEND_BASE}/ld-release-feed`;
export const STORE_URL = 'https://kkzxxnfxgrouhkzyszxs.supabase.co/functions/v1/ld-store';

export const VERIFIED_FREE_MODEL_IDS = Object.freeze([
  'gemini-3.6-flash','gemini-3.5-flash','gemini-3.5-flash-lite','gemini-3.1-flash-lite','gemini-3-flash-preview','gemini-2.5-pro','gemini-2.5-flash','gemini-2.5-flash-lite'
]);
export const DEFAULT_FREE_MODEL = 'gemini-3.6-flash';
export const DEFAULT_FREE_ADVANCED_MODEL = 'gemini-2.5-pro';
export const DECRYPTER_LOCAL_PROVIDER_ID = 'decrypter-local';
export const DECRYPTER_LOCAL_RECOMMENDED_MODEL = 'qwen3-coder:30b';
export const DECRYPTER_LOCAL_MEDIUM_MODEL = 'qwen2.5-coder:14b';
export const DECRYPTER_LOCAL_SMALL_MODEL = 'qwen2.5-coder:7b';
export function normalizeGeminiModelId(value=''){return String(value||'').trim().replace(/^models\//,'');}
export function isSpecializedGeminiModel(value=''){const id=normalizeGeminiModelId(value).toLowerCase();return /(embedding|imagen|veo|image|tts|live|audio|aqa|robotics|computer-use|deep-research)/.test(id);}
export function isVerifiedFreeModel(value=''){const id=normalizeGeminiModelId(value);if(VERIFIED_FREE_MODEL_IDS.includes(id))return true;if(isSpecializedGeminiModel(id))return false;return VERIFIED_FREE_MODEL_IDS.some(base=>id===`${base}-latest`||id===`${base}-001`);}
const clampInt=(value,min,max,fallback)=>{const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,Math.round(n))):fallback;};
function localEndpoint(value=''){try{const u=new URL(String(value||'http://127.0.0.1:8000'));const host=u.hostname.toLowerCase();if(u.protocol!=='http:'||!['127.0.0.1','localhost'].includes(host))return 'http://127.0.0.1:8000';u.username='';u.password='';u.search='';u.hash='';return u.toString().replace(/\/$/,'');}catch{return 'http://127.0.0.1:8000';}}
export const DEFAULT_SETTINGS={auth:{licenseKey:'',licenseStatus:'signed-out',licenseId:'',licenseSubject:'',licenseExpiresAt:null,backendBase:DEFAULT_BACKEND_BASE,deviceId:'',vaultApiBase:DEFAULT_VAULT_API_BASE,updateFeedUrl:DEFAULT_UPDATE_FEED_URL,lastVaultSyncAt:null},gateway:{mode:'auto'},gemini:{apiKey:'',model:DEFAULT_FREE_MODEL,advancedModel:DEFAULT_FREE_ADVANCED_MODEL,maxOutputTokens:32768,billingMode:'free',zeroCost:true,dynamicModels:true},localAI:{enabled:true,localOnly:true,endpoint:'http://127.0.0.1:8000',largeModel:DECRYPTER_LOCAL_RECOMMENDED_MODEL,mediumModel:DECRYPTER_LOCAL_MEDIUM_MODEL,smallModel:DECRYPTER_LOCAL_SMALL_MODEL,maxIterations:8,maxOutputTokens:16384,paidFallbackAllowed:false,remoteFallbackAllowed:false},github:{authMode:'github_app',installationId:null,accountLogin:'',appSlug:'',token:'',owner:'',repo:'',branch:'main',createBranch:false,createPr:false},supabase:{authMode:'oauth',projectRef:'',projectName:'',organizationSlug:'',url:'',anonKey:'',managementToken:''},projectMappings:{},supabaseMappings:{},agent:{maxFiles:16,maxContextBytes:220000,rules:''},ui:{theme:'nexus',sounds:false,background:'glass',density:'comfortable',motion:'full'}};
export function mergeSettings(saved={}){const merged={...DEFAULT_SETTINGS,...saved,auth:{...DEFAULT_SETTINGS.auth,...(saved.auth||{})},gateway:{...DEFAULT_SETTINGS.gateway,...(saved.gateway||{})},gemini:{...DEFAULT_SETTINGS.gemini,...(saved.gemini||{})},localAI:{...DEFAULT_SETTINGS.localAI,...(saved.localAI||{})},github:{...DEFAULT_SETTINGS.github,...(saved.github||{})},supabase:{...DEFAULT_SETTINGS.supabase,...(saved.supabase||{})},agent:{...DEFAULT_SETTINGS.agent,...(saved.agent||{})},ui:{...DEFAULT_SETTINGS.ui,...(saved.ui||{})},projectMappings:{...(saved.projectMappings||{})},supabaseMappings:{...(saved.supabaseMappings||{})}};if(!merged.auth.updateFeedUrl||/raw\.githubusercontent\.com\/rhashiki\/lovable-decrypter-extension\/main\/updates\/latest\.json/i.test(String(merged.auth.updateFeedUrl)))merged.auth.updateFeedUrl=DEFAULT_UPDATE_FEED_URL;merged.gateway.mode=['auto','fast','deep'].includes(String(merged.gateway.mode||'').toLowerCase())?String(merged.gateway.mode).toLowerCase():'auto';merged.agent.maxFiles=clampInt(merged.agent.maxFiles,6,30,16);merged.agent.maxContextBytes=clampInt(merged.agent.maxContextBytes,80000,700000,220000);merged.agent.rules=String(merged.agent.rules||'');merged.localAI.enabled=merged.localAI.enabled!==false;merged.localAI.localOnly=true;merged.localAI.endpoint=localEndpoint(merged.localAI.endpoint);merged.localAI.largeModel=String(merged.localAI.largeModel||DECRYPTER_LOCAL_RECOMMENDED_MODEL).trim().slice(0,240)||DECRYPTER_LOCAL_RECOMMENDED_MODEL;merged.localAI.mediumModel=String(merged.localAI.mediumModel||DECRYPTER_LOCAL_MEDIUM_MODEL).trim().slice(0,240)||DECRYPTER_LOCAL_MEDIUM_MODEL;merged.localAI.smallModel=String(merged.localAI.smallModel||DECRYPTER_LOCAL_SMALL_MODEL).trim().slice(0,240)||DECRYPTER_LOCAL_SMALL_MODEL;merged.localAI.maxIterations=clampInt(merged.localAI.maxIterations,1,12,8);merged.localAI.maxOutputTokens=clampInt(merged.localAI.maxOutputTokens,1024,32768,16384);merged.localAI.paidFallbackAllowed=false;merged.localAI.remoteFallbackAllowed=false;merged.ui.theme='nexus';merged.ui.sounds=merged.ui.sounds===true;merged.ui.background=['glass','solid'].includes(String(merged.ui.background||'').toLowerCase())?String(merged.ui.background).toLowerCase():'glass';merged.ui.density=['comfortable','compact'].includes(String(merged.ui.density||'').toLowerCase())?String(merged.ui.density).toLowerCase():'comfortable';merged.ui.motion=['full','reduced'].includes(String(merged.ui.motion||'').toLowerCase())?String(merged.ui.motion).toLowerCase():'full';merged.gemini.billingMode='free';merged.gemini.zeroCost=true;if(!isVerifiedFreeModel(merged.gemini.model))merged.gemini.model=DEFAULT_FREE_MODEL;if(!isVerifiedFreeModel(merged.gemini.advancedModel))merged.gemini.advancedModel=DEFAULT_FREE_ADVANCED_MODEL;merged.github.authMode=merged.github.authMode==='legacy_token'?'legacy_token':'github_app';merged.github.installationId=Number.isInteger(Number(merged.github.installationId))&&Number(merged.github.installationId)>0?Number(merged.github.installationId):null;if(merged.github.authMode!=='legacy_token')merged.github.token='';merged.supabase.authMode='oauth';merged.supabase.anonKey='';merged.supabase.managementToken='';merged.github.createBranch=false;merged.github.createPr=false;return merged;}