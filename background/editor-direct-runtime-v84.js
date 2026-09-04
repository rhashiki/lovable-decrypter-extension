'use strict';

importScripts('runtime-entry-v84-integrations.js');

const LD84_EDITOR_SCHEMA = 'ld-editor-direct/1';
const LD84_EDITOR_BACKEND = 'https://kkzxxnfxgrouhkzyszxs.supabase.co/functions/v1';
const LD84_EDITOR_ACCOUNT_KEY = 'ld84_account';
const LD84_EDITOR_DEVICE_KEY = 'ld84_device_id';
const LD84_EDITOR_TRUST_KEY = 'ld84_trust';
const LD84_EDITOR_PROJECT_KEY = 'ld84_project_snapshot';
const LD84_EDITOR_SETTINGS_KEY = 'ld84_editor_local_settings';
const LD84_EDITOR_BINDINGS_KEY = 'ld84_project_bindings';
const LD84_EDITOR_SHADOW_PREFIX = 'ld84_editor_shadow_';
const LD84_EDITOR_SHADOW_TTL_MS = 30 * 60 * 1000;
const LD84_EDITOR_MAX_FILES = 16;
const LD84_EDITOR_MAX_FILE_BYTES = 900000;
const LD84_EDITOR_MAX_CONTEXT_BYTES = 2400000;
const LD84_EDITOR_DEFAULT_ENDPOINT = 'http://127.0.0.1:8000';
const LD84_EDITOR_DEFAULT_MODEL = 'decrypter-local';
const LD84_EDITOR_API_VERSION = '2026-03-10';

function ld84EditorGet(keys, area = chrome.storage.local) {
  return new Promise(resolve => area.get(keys, value => resolve(value || {})));
}
function ld84EditorSet(value, area = chrome.storage.local) {
  return new Promise(resolve => area.set(value, () => resolve()));
}
function ld84EditorRemove(keys, area = chrome.storage.local) {
  return new Promise(resolve => area.remove(keys, () => resolve()));
}
function ld84EditorClean(value, max = 1000) {
  return String(value ?? '').trim().slice(0, max);
}
function ld84EditorSafePath(value) {
  const path = ld84EditorClean(value, 500).replace(/\\/g, '/').replace(/^\/+/, '');
  if (!path || path.includes('..') || path.startsWith('.git/')) return '';
  if (/(^|\/)(\.env(?:\.|$)|id_rsa|id_ed25519|secrets?\b)/i.test(path)) return '';
  if (/\.(pem|key|p12|pfx)$/i.test(path)) return '';
  return path;
}
function ld84EditorBinaryPath(path) {
  return /\.(png|jpe?g|gif|webp|avif|ico|pdf|zip|gz|tar|7z|woff2?|ttf|otf|mp3|wav|ogg|mp4|mov|avi|webm|exe|dll|so|dylib|bin)$/i.test(path);
}
function ld84EditorParseRepo(fullName) {
  const value = ld84EditorClean(fullName, 220);
  const parts = value.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw new Error('EDITOR_REPOSITORY_INVALID');
  return { owner: parts[0], repo: parts[1], fullName: value };
}
function ld84EditorNormalizeEndpoint(value) {
  const raw = ld84EditorClean(value || LD84_EDITOR_DEFAULT_ENDPOINT, 300).replace(/\/+$/, '');
  let parsed;
  try { parsed = new URL(raw); } catch { throw new Error('LOCAL_RUNTIME_ENDPOINT_INVALID'); }
  const host = parsed.hostname.toLowerCase();
  if (!['127.0.0.1', 'localhost'].includes(host)) throw new Error('LOCAL_RUNTIME_MUST_BE_LOCALHOST');
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('LOCAL_RUNTIME_PROTOCOL_INVALID');
  if (parsed.pathname !== '/' && parsed.pathname !== '') throw new Error('LOCAL_RUNTIME_ENDPOINT_MUST_BE_ORIGIN');
  return parsed.origin;
}
function ld84EditorJsonFromText(value) {
  const raw = String(value ?? '').trim();
  if (!raw) throw new Error('LOCAL_AI_EMPTY_RESPONSE');
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const candidate = fenced || raw;
  try { return JSON.parse(candidate); } catch (_) {}
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(candidate.slice(start, end + 1)); } catch (_) {}
  }
  throw new Error('LOCAL_AI_JSON_INVALID');
}
async function ld84EditorCredentials() {
  const stored = await ld84EditorGet([LD84_EDITOR_ACCOUNT_KEY, LD84_EDITOR_DEVICE_KEY]);
  const account = stored[LD84_EDITOR_ACCOUNT_KEY] && typeof stored[LD84_EDITOR_ACCOUNT_KEY] === 'object' ? stored[LD84_EDITOR_ACCOUNT_KEY] : {};
  const licenseKey = ld84EditorClean(account.licenseKey, 5000);
  const deviceId = ld84EditorClean(stored[LD84_EDITOR_DEVICE_KEY], 300);
  if (account.active !== true || !licenseKey) throw new Error('ACCOUNT_NOT_ACTIVE');
  if (!deviceId) throw new Error('DEVICE_REQUIRED');
  return { licenseKey, deviceId };
}
async function ld84EditorBackend(endpoint, action, payload = {}) {
  const credentials = await ld84EditorCredentials();
  const response = await fetch(`${LD84_EDITOR_BACKEND}/${endpoint}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-license-key': credentials.licenseKey,
      'x-device-id': credentials.deviceId
    },
    body: JSON.stringify({ action, ...payload })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok !== true) {
    const error = new Error(String(body?.code || `HTTP_${response.status}`));
    error.code = String(body?.code || `HTTP_${response.status}`);
    error.details = body;
    throw error;
  }
  return body;
}
async function ld84EditorLocalSettings() {
  const stored = await ld84EditorGet([LD84_EDITOR_SETTINGS_KEY]);
  const value = stored[LD84_EDITOR_SETTINGS_KEY] && typeof stored[LD84_EDITOR_SETTINGS_KEY] === 'object' ? stored[LD84_EDITOR_SETTINGS_KEY] : {};
  let endpoint = LD84_EDITOR_DEFAULT_ENDPOINT;
  try { endpoint = ld84EditorNormalizeEndpoint(value.endpoint || LD84_EDITOR_DEFAULT_ENDPOINT); } catch (_) {}
  return {
    endpoint,
    token: ld84EditorClean(value.token, 500),
    model: ld84EditorClean(value.model || LD84_EDITOR_DEFAULT_MODEL, 160) || LD84_EDITOR_DEFAULT_MODEL
  };
}
async function ld84EditorSaveLocalSettings(input = {}) {
  const settings = {
    endpoint: ld84EditorNormalizeEndpoint(input.endpoint || LD84_EDITOR_DEFAULT_ENDPOINT),
    token: ld84EditorClean(input.token, 500),
    model: ld84EditorClean(input.model || LD84_EDITOR_DEFAULT_MODEL, 160) || LD84_EDITOR_DEFAULT_MODEL
  };
  await ld84EditorSet({ [LD84_EDITOR_SETTINGS_KEY]: settings });
  return settings;
}
async function ld84EditorHealth(settingsInput = null) {
  const settings = settingsInput || await ld84EditorLocalSettings();
  const started = Date.now();
  try {
    const response = await fetch(`${settings.endpoint}/health`, {
      method: 'GET',
      cache: 'no-store',
      signal: AbortSignal.timeout(8000)
    });
    const body = await response.json().catch(() => ({}));
    return {
      ok: response.ok && body?.ok === true,
      reachable: true,
      endpoint: settings.endpoint,
      model: body?.model || settings.model,
      servedModel: body?.served_model || settings.model,
      runtime: body?.runtime || 'local',
      loadedModels: Array.isArray(body?.models_loaded) ? body.models_loaded : [],
      latencyMs: Number(body?.latency_ms || Date.now() - started),
      tokenConfigured: Boolean(settings.token),
      code: response.ok && body?.ok === true ? 'LOCAL_RUNTIME_READY' : String(body?.error || `LOCAL_RUNTIME_HTTP_${response.status}`)
    };
  } catch (error) {
    return {
      ok: false,
      reachable: false,
      endpoint: settings.endpoint,
      model: settings.model,
      servedModel: settings.model,
      runtime: 'local',
      loadedModels: [],
      latencyMs: Date.now() - started,
      tokenConfigured: Boolean(settings.token),
      code: error?.name === 'TimeoutError' ? 'LOCAL_RUNTIME_TIMEOUT' : 'LOCAL_RUNTIME_UNREACHABLE'
    };
  }
}
async function ld84EditorLocalChat(messages, options = {}) {
  const settings = await ld84EditorLocalSettings();
  const health = await ld84EditorHealth(settings);
  if (!health.ok) throw new Error(health.code || 'LOCAL_RUNTIME_UNAVAILABLE');
  if (!settings.token) throw new Error('LOCAL_RUNTIME_TOKEN_REQUIRED');
  const response = await fetch(`${settings.endpoint}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${settings.token}`
    },
    body: JSON.stringify({
      model: settings.model || LD84_EDITOR_DEFAULT_MODEL,
      messages,
      stream: false,
      temperature: 0.1,
      max_tokens: Math.max(1024, Math.min(32768, Number(options.maxTokens || 12000))),
      response_format: { type: 'json_object' }
    }),
    signal: AbortSignal.timeout(Math.max(30000, Math.min(240000, Number(options.timeoutMs || 180000))))
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(body?.error?.message || `LOCAL_AI_HTTP_${response.status}`));
  const content = body?.choices?.[0]?.message?.content;
  return {
    json: ld84EditorJsonFromText(content),
    model: String(body?.model || settings.model || LD84_EDITOR_DEFAULT_MODEL),
    usage: body?.usage || null
  };
}
async function ld84EditorResources() {
  const [github, githubSelection, supabase, supabaseSelection, projectStored, bindingsStored, local] = await Promise.all([
    ld84EditorBackend('ld-github-app', 'status'),
    ld84EditorBackend('ld-integration-selection', 'get', { integration: 'github' }).catch(() => ({ mode: 'all', selected: null })),
    ld84EditorBackend('ld-supabase-oauth', 'status').catch(() => ({ connected: false, projects: [] })),
    ld84EditorBackend('ld-integration-selection', 'get', { integration: 'supabase' }).catch(() => ({ mode: 'all', selected: null })),
    ld84EditorGet([LD84_EDITOR_PROJECT_KEY]),
    ld84EditorGet([LD84_EDITOR_BINDINGS_KEY]),
    ld84EditorLocalSettings()
  ]);
  const repositories = Array.isArray(github?.repositories) ? github.repositories : [];
  const githubAllowed = githubSelection?.mode === 'all' || githubSelection?.selected === null
    ? null
    : new Set((githubSelection?.selected || []).map(String));
  const selectedRepositories = repositories.filter(repo => githubAllowed === null || githubAllowed.has(String(repo?.full_name || ''))).map(repo => ({
    fullName: String(repo?.full_name || ''),
    defaultBranch: String(repo?.default_branch || 'main'),
    private: repo?.private === true
  })).filter(repo => repo.fullName);
  const projects = Array.isArray(supabase?.projects) ? supabase.projects : [];
  const supabaseAllowed = supabaseSelection?.mode === 'all' || supabaseSelection?.selected === null
    ? null
    : new Set((supabaseSelection?.selected || []).map(String));
  const selectedProjects = projects.filter(project => supabaseAllowed === null || supabaseAllowed.has(String(project?.ref || ''))).map(project => ({
    ref: String(project?.ref || ''),
    name: String(project?.name || project?.ref || ''),
    region: String(project?.region || '')
  })).filter(project => project.ref);
  const project = projectStored[LD84_EDITOR_PROJECT_KEY] && typeof projectStored[LD84_EDITOR_PROJECT_KEY] === 'object' ? projectStored[LD84_EDITOR_PROJECT_KEY] : null;
  const projectId = ld84EditorClean(project?.projectId, 120);
  const bindings = bindingsStored[LD84_EDITOR_BINDINGS_KEY] && typeof bindingsStored[LD84_EDITOR_BINDINGS_KEY] === 'object' ? bindingsStored[LD84_EDITOR_BINDINGS_KEY] : {};
  const binding = projectId && bindings[projectId] && typeof bindings[projectId] === 'object' ? bindings[projectId] : null;
  return {
    ok: true,
    schema: LD84_EDITOR_SCHEMA,
    project,
    projectId,
    repositories: selectedRepositories,
    supabaseProjects: selectedProjects,
    binding,
    local: { endpoint: local.endpoint, model: local.model, tokenConfigured: Boolean(local.token) }
  };
}
async function ld84EditorSaveBinding(message = {}) {
  const resources = await ld84EditorResources();
  const projectId = ld84EditorClean(message.projectId || resources.projectId, 120);
  if (!projectId) throw new Error('EDITOR_PROJECT_ID_REQUIRED');
  const repository = ld84EditorClean(message.repository, 220);
  const repo = resources.repositories.find(item => item.fullName === repository);
  if (!repo) throw new Error('EDITOR_REPOSITORY_NOT_SELECTED');
  const supabaseProject = ld84EditorClean(message.supabaseProject, 120);
  if (supabaseProject && !resources.supabaseProjects.some(item => item.ref === supabaseProject)) throw new Error('EDITOR_SUPABASE_PROJECT_NOT_SELECTED');
  const branch = ld84EditorClean(message.branch || repo.defaultBranch || 'main', 180) || 'main';
  const stored = await ld84EditorGet([LD84_EDITOR_BINDINGS_KEY]);
  const bindings = stored[LD84_EDITOR_BINDINGS_KEY] && typeof stored[LD84_EDITOR_BINDINGS_KEY] === 'object' ? stored[LD84_EDITOR_BINDINGS_KEY] : {};
  bindings[projectId] = { repository, supabaseProject, branch, updatedAt: new Date().toISOString() };
  await ld84EditorSet({ [LD84_EDITOR_BINDINGS_KEY]: bindings });
  return { ok: true, schema: LD84_EDITOR_SCHEMA, projectId, binding: bindings[projectId] };
}
async function ld84EditorGithubToken() {
  const body = await ld84EditorBackend('ld-github-app', 'token');
  if (!body?.token) throw new Error('GITHUB_INSTALLATION_TOKEN_REQUIRED');
  return String(body.token);
}
async function ld84EditorGithubRequest(token, path, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      accept: 'application/vnd.github+json',
      'x-github-api-version': LD84_EDITOR_API_VERSION,
      authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(String(body?.message || `GITHUB_HTTP_${response.status}`));
    error.code = `GITHUB_HTTP_${response.status}`;
    throw error;
  }
  return body;
}
async function ld84EditorResolveBinding(message = {}) {
  const resources = await ld84EditorResources();
  const projectId = ld84EditorClean(message.projectId || resources.projectId, 120);
  if (!projectId) throw new Error('EDITOR_PROJECT_ID_REQUIRED');
  const requestedRepo = ld84EditorClean(message.repository || resources.binding?.repository, 220);
  const repoInfo = resources.repositories.find(item => item.fullName === requestedRepo);
  if (!repoInfo) throw new Error('EDITOR_REPOSITORY_BINDING_REQUIRED');
  const branch = ld84EditorClean(message.branch || resources.binding?.branch || repoInfo.defaultBranch || 'main', 180) || 'main';
  const supabaseProject = ld84EditorClean(message.supabaseProject || resources.binding?.supabaseProject, 120);
  return { resources, projectId, repository: requestedRepo, repoInfo, branch, supabaseProject };
}
async function ld84EditorRepoSnapshot(binding) {
  const repo = ld84EditorParseRepo(binding.repository);
  const token = await ld84EditorGithubToken();
  const branch = await ld84EditorGithubRequest(token, `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/branches/${encodeURIComponent(binding.branch)}`);
  const headSha = String(branch?.commit?.sha || '').toLowerCase();
  const treeSha = String(branch?.commit?.commit?.tree?.sha || '').toLowerCase();
  if (!/^[0-9a-f]{40}$/i.test(headSha) || !/^[0-9a-f]{40}$/i.test(treeSha)) throw new Error('EDITOR_GITHUB_HEAD_INVALID');
  const tree = await ld84EditorGithubRequest(token, `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/git/trees/${encodeURIComponent(treeSha)}?recursive=1`);
  const files = (Array.isArray(tree?.tree) ? tree.tree : [])
    .filter(item => item?.type === 'blob')
    .map(item => ({ path: ld84EditorSafePath(item?.path), size: Number(item?.size || 0) }))
    .filter(item => item.path && !ld84EditorBinaryPath(item.path) && item.size <= LD84_EDITOR_MAX_FILE_BYTES)
    .slice(0, 1800);
  return { token, repo, branch: binding.branch, headSha, treeSha, files, truncated: tree?.truncated === true };
}
function ld84EditorTreeText(snapshot) {
  return snapshot.files.map(item => `${item.path}${item.size ? ` (${item.size}b)` : ''}`).join('\n').slice(0, 180000);
}
async function ld84EditorReadFile(snapshot, path) {
  const safe = ld84EditorSafePath(path);
  if (!safe || ld84EditorBinaryPath(safe)) throw new Error(`EDITOR_FILE_PATH_REJECTED:${path}`);
  const body = await ld84EditorGithubRequest(snapshot.token, `/repos/${encodeURIComponent(snapshot.repo.owner)}/${encodeURIComponent(snapshot.repo.repo)}/contents/${safe.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(snapshot.branch)}`);
  if (body?.type !== 'file' || body?.encoding !== 'base64' || typeof body?.content !== 'string') throw new Error(`EDITOR_FILE_READ_UNSUPPORTED:${safe}`);
  const normalized = body.content.replace(/\n/g, '');
  const bytes = Uint8Array.from(atob(normalized), char => char.charCodeAt(0));
  if (bytes.byteLength > LD84_EDITOR_MAX_FILE_BYTES) throw new Error(`EDITOR_FILE_TOO_LARGE:${safe}`);
  return new TextDecoder().decode(bytes);
}
function ld84EditorPlanNormalize(raw, snapshot) {
  const plan = raw && typeof raw === 'object' ? raw : {};
  const summary = ld84EditorClean(plan.summary || 'Plano gerado pela IA local.', 1400);
  const steps = (Array.isArray(plan.plan) ? plan.plan : []).map(item => ld84EditorClean(item, 600)).filter(Boolean).slice(0, 16);
  const existing = new Set(snapshot.files.map(item => item.path));
  const relevantFiles = [...new Set((Array.isArray(plan.relevant_files) ? plan.relevant_files : []).map(ld84EditorSafePath).filter(path => path && existing.has(path)))].slice(0, 12);
  const newFiles = [...new Set((Array.isArray(plan.new_files) ? plan.new_files : []).map(ld84EditorSafePath).filter(Boolean))].slice(0, 8);
  return {
    summary,
    plan: steps,
    relevantFiles,
    newFiles,
    backendRequired: plan.backend_required === true,
    supabaseRequired: plan.supabase_required === true,
    risks: (Array.isArray(plan.risks) ? plan.risks : []).map(item => ld84EditorClean(item, 500)).filter(Boolean).slice(0, 12)
  };
}
async function ld84EditorPlan(message = {}) {
  const command = ld84EditorClean(message.command, 12000);
  if (!command) throw new Error('EDITOR_COMMAND_REQUIRED');
  const binding = await ld84EditorResolveBinding(message);
  const snapshot = await ld84EditorRepoSnapshot(binding);
  const projectTitle = ld84EditorClean(binding.resources.project?.title, 300);
  const system = `Você é o planejador local do Lovable Decrypter. Responda SOMENTE JSON válido. Nunca invente arquivos existentes. Não escreva código nesta etapa. Analise o pedido e a árvore Git. Formato: {"summary":"...","plan":["..."],"relevant_files":["caminho existente"],"new_files":["caminho novo opcional"],"backend_required":false,"supabase_required":false,"risks":["..."]}. Máximo 12 relevant_files e 8 new_files.`;
  const user = `PROJETO LOVABLE: ${binding.projectId}\nTÍTULO: ${projectTitle || '—'}\nREPOSITÓRIO: ${binding.repository}\nBRANCH: ${binding.branch}\nSUPABASE VINCULADO: ${binding.supabaseProject || 'nenhum'}\n\nPEDIDO DO USUÁRIO:\n${command}\n\nÁRVORE DO REPOSITÓRIO:\n${ld84EditorTreeText(snapshot)}`;
  const result = await ld84EditorLocalChat([
    { role: 'system', content: system },
    { role: 'user', content: user }
  ], { maxTokens: 7000, timeoutMs: 180000 });
  const plan = ld84EditorPlanNormalize(result.json, snapshot);
  return {
    ok: true,
    schema: LD84_EDITOR_SCHEMA,
    mode: 'plan',
    zeroWrite: true,
    command,
    projectId: binding.projectId,
    repository: binding.repository,
    branch: binding.branch,
    supabaseProject: binding.supabaseProject,
    baseHeadSha: snapshot.headSha,
    model: result.model,
    plan
  };
}
function ld84EditorValidateFiles(rawFiles, snapshot, plan) {
  if (!Array.isArray(rawFiles) || !rawFiles.length) throw new Error('EDITOR_SHADOW_FILES_REQUIRED');
  if (rawFiles.length > LD84_EDITOR_MAX_FILES) throw new Error('EDITOR_SHADOW_FILE_LIMIT');
  const existing = new Set(snapshot.files.map(item => item.path));
  const allowedExisting = new Set(plan.relevantFiles);
  const allowedNew = new Set(plan.newFiles);
  const seen = new Set();
  const files = [];
  let totalBytes = 0;
  for (const item of rawFiles) {
    const path = ld84EditorSafePath(item?.path);
    const action = ld84EditorClean(item?.action, 20).toLowerCase();
    if (!path || seen.has(path)) throw new Error(`EDITOR_SHADOW_PATH_INVALID:${path || 'unknown'}`);
    seen.add(path);
    if (!['create', 'update', 'delete'].includes(action)) throw new Error(`EDITOR_SHADOW_ACTION_INVALID:${path}`);
    if ((action === 'update' || action === 'delete') && (!existing.has(path) || !allowedExisting.has(path))) throw new Error(`EDITOR_SHADOW_SCOPE_VIOLATION:${path}`);
    if (action === 'create' && existing.has(path)) throw new Error(`EDITOR_SHADOW_CREATE_EXISTS:${path}`);
    if (action === 'create' && allowedNew.size && !allowedNew.has(path)) throw new Error(`EDITOR_SHADOW_NEW_FILE_OUT_OF_PLAN:${path}`);
    if (ld84EditorBinaryPath(path)) throw new Error(`EDITOR_SHADOW_BINARY_REJECTED:${path}`);
    const content = action === 'delete' ? '' : String(item?.content ?? '');
    const bytes = new TextEncoder().encode(content).byteLength;
    if (bytes > LD84_EDITOR_MAX_FILE_BYTES) throw new Error(`EDITOR_SHADOW_FILE_TOO_LARGE:${path}`);
    totalBytes += bytes;
    if (totalBytes > LD84_EDITOR_MAX_CONTEXT_BYTES) throw new Error('EDITOR_SHADOW_TOTAL_TOO_LARGE');
    if (action !== 'delete' && /\.json$/i.test(path)) {
      try { JSON.parse(content); } catch { throw new Error(`EDITOR_SHADOW_JSON_INVALID:${path}`); }
    }
    files.push({ path, action, content });
  }
  return files;
}
async function ld84EditorBuild(message = {}) {
  const command = ld84EditorClean(message.command, 12000);
  if (!command) throw new Error('EDITOR_COMMAND_REQUIRED');
  const binding = await ld84EditorResolveBinding(message);
  const snapshot = await ld84EditorRepoSnapshot(binding);
  const planResult = await ld84EditorPlan({ ...message, command, repository: binding.repository, branch: binding.branch, supabaseProject: binding.supabaseProject });
  if (planResult.baseHeadSha !== snapshot.headSha) throw new Error('EDITOR_HEAD_CHANGED_DURING_PREPARE');
  const fileInputs = [];
  let contextBytes = 0;
  for (const path of planResult.plan.relevantFiles) {
    const content = await ld84EditorReadFile(snapshot, path);
    contextBytes += new TextEncoder().encode(content).byteLength;
    if (contextBytes > LD84_EDITOR_MAX_CONTEXT_BYTES) throw new Error('EDITOR_CONTEXT_TOO_LARGE');
    fileInputs.push({ path, content });
  }
  const system = `Você é o coder local do Lovable Decrypter. Responda SOMENTE JSON válido. Gere um Shadow Build, nunca execute escrita. Use apenas os arquivos existentes fornecidos e os new_files aprovados no plano. Para update/create devolva o CONTEÚDO COMPLETO do arquivo. Para delete use content vazio. Formato: {"summary":"...","files":[{"path":"...","action":"update|create|delete","content":"..."}],"validation_notes":["..."],"supabase_apply_required":false}. Não altere arquivos fora do escopo do plano.`;
  const user = `PEDIDO:\n${command}\n\nPLANO APROVADO PARA SHADOW:\n${JSON.stringify(planResult.plan)}\n\nREPOSITÓRIO: ${binding.repository}\nBRANCH: ${binding.branch}\nBASE HEAD: ${snapshot.headSha}\nSUPABASE VINCULADO: ${binding.supabaseProject || 'nenhum'}\n\nARQUIVOS LIDOS:\n${fileInputs.map(file => `\n--- ${file.path} ---\n${file.content}`).join('\n').slice(0, LD84_EDITOR_MAX_CONTEXT_BYTES)}`;
  const ai = await ld84EditorLocalChat([
    { role: 'system', content: system },
    { role: 'user', content: user }
  ], { maxTokens: 26000, timeoutMs: 240000 });
  const files = ld84EditorValidateFiles(ai.json?.files, snapshot, planResult.plan);
  const shadowId = crypto.randomUUID();
  const supabaseApplyRequired = ai.json?.supabase_apply_required === true || planResult.plan.supabaseRequired === true;
  const shadow = {
    schema: LD84_EDITOR_SCHEMA,
    id: shadowId,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + LD84_EDITOR_SHADOW_TTL_MS).toISOString(),
    projectId: binding.projectId,
    repository: binding.repository,
    branch: binding.branch,
    supabaseProject: binding.supabaseProject,
    baseHeadSha: snapshot.headSha,
    command,
    summary: ld84EditorClean(ai.json?.summary || planResult.plan.summary, 1400),
    files,
    validationNotes: (Array.isArray(ai.json?.validation_notes) ? ai.json.validation_notes : []).map(item => ld84EditorClean(item, 500)).filter(Boolean).slice(0, 16),
    supabaseApplyRequired,
    model: ai.model
  };
  await ld84EditorSet({ [`${LD84_EDITOR_SHADOW_PREFIX}${shadowId}`]: shadow }, chrome.storage.session);
  return {
    ok: true,
    schema: LD84_EDITOR_SCHEMA,
    mode: 'shadow',
    zeroWrite: true,
    shadowId,
    projectId: shadow.projectId,
    repository: shadow.repository,
    branch: shadow.branch,
    baseHeadSha: shadow.baseHeadSha,
    summary: shadow.summary,
    files: shadow.files.map(file => ({ path: file.path, action: file.action, bytes: new TextEncoder().encode(file.content).byteLength })),
    validationNotes: shadow.validationNotes,
    supabaseApplyRequired,
    applyBlocked: supabaseApplyRequired,
    applyBlockedReason: supabaseApplyRequired ? 'SUPABASE_APPLY_RUNTIME_NOT_REATTACHED' : '',
    model: shadow.model
  };
}
async function ld84EditorRequireTrust() {
  const stored = await ld84EditorGet([LD84_EDITOR_TRUST_KEY]);
  const trust = stored[LD84_EDITOR_TRUST_KEY] && typeof stored[LD84_EDITOR_TRUST_KEY] === 'object' ? stored[LD84_EDITOR_TRUST_KEY] : null;
  if (!trust?.token || !trust?.expiresAt || Date.parse(trust.expiresAt) <= Date.now() + 15000) throw new Error('EDITOR_TRUST_REQUIRED');
  return trust;
}
async function ld84EditorLoadShadow(id) {
  const shadowId = ld84EditorClean(id, 80);
  if (!shadowId) throw new Error('EDITOR_SHADOW_ID_REQUIRED');
  const key = `${LD84_EDITOR_SHADOW_PREFIX}${shadowId}`;
  const stored = await ld84EditorGet([key], chrome.storage.session);
  const shadow = stored[key];
  if (!shadow || shadow.id !== shadowId) throw new Error('EDITOR_SHADOW_NOT_FOUND');
  if (Date.parse(shadow.expiresAt || '') <= Date.now()) {
    await ld84EditorRemove([key], chrome.storage.session);
    throw new Error('EDITOR_SHADOW_EXPIRED');
  }
  return { key, shadow };
}
async function ld84EditorApply(message = {}) {
  await ld84EditorRequireTrust();
  const { key, shadow } = await ld84EditorLoadShadow(message.shadowId);
  if (shadow.supabaseApplyRequired === true) throw new Error('SUPABASE_APPLY_RUNTIME_NOT_REATTACHED');
  const binding = await ld84EditorResolveBinding({ projectId: shadow.projectId, repository: shadow.repository, branch: shadow.branch, supabaseProject: shadow.supabaseProject });
  if (binding.repository !== shadow.repository || binding.branch !== shadow.branch) throw new Error('EDITOR_BINDING_CHANGED');
  const snapshot = await ld84EditorRepoSnapshot(binding);
  if (snapshot.headSha !== shadow.baseHeadSha) throw new Error('EDITOR_HEAD_CHANGED_BEFORE_APPLY');
  const token = snapshot.token;
  const entries = [];
  for (const file of shadow.files) {
    if (file.action === 'delete') {
      entries.push({ path: file.path, mode: '100644', type: 'blob', sha: null });
      continue;
    }
    const blob = await ld84EditorGithubRequest(token, `/repos/${encodeURIComponent(snapshot.repo.owner)}/${encodeURIComponent(snapshot.repo.repo)}/git/blobs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: file.content, encoding: 'utf-8' })
    });
    if (!/^[0-9a-f]{40}$/i.test(String(blob?.sha || ''))) throw new Error(`EDITOR_GITHUB_BLOB_FAILED:${file.path}`);
    entries.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha });
  }
  const tree = await ld84EditorGithubRequest(token, `/repos/${encodeURIComponent(snapshot.repo.owner)}/${encodeURIComponent(snapshot.repo.repo)}/git/trees`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ base_tree: snapshot.treeSha, tree: entries })
  });
  if (!/^[0-9a-f]{40}$/i.test(String(tree?.sha || ''))) throw new Error('EDITOR_GITHUB_TREE_FAILED');
  const subject = ld84EditorClean(shadow.summary || shadow.command, 120).replace(/[\r\n]+/g, ' ');
  const commit = await ld84EditorGithubRequest(token, `/repos/${encodeURIComponent(snapshot.repo.owner)}/${encodeURIComponent(snapshot.repo.repo)}/git/commits`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      message: `Lovable Decrypter: ${subject || 'Editor Direto'}`,
      tree: tree.sha,
      parents: [shadow.baseHeadSha]
    })
  });
  const commitSha = String(commit?.sha || '').toLowerCase();
  if (!/^[0-9a-f]{40}$/i.test(commitSha)) throw new Error('EDITOR_GITHUB_COMMIT_FAILED');
  await ld84EditorGithubRequest(token, `/repos/${encodeURIComponent(snapshot.repo.owner)}/${encodeURIComponent(snapshot.repo.repo)}/git/refs/heads/${encodeURIComponent(shadow.branch)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sha: commitSha, force: false })
  });
  await ld84EditorRemove([key], chrome.storage.session);
  return {
    ok: true,
    schema: LD84_EDITOR_SCHEMA,
    mode: 'applied',
    repository: shadow.repository,
    branch: shadow.branch,
    commitSha,
    commitUrl: `https://github.com/${shadow.repository}/commit/${commitSha}`,
    lovableSync: { verified: false, reason: 'LOVABLE_GITSYNC_VERIFIER_NOT_REATTACHED' },
    summary: shadow.summary
  };
}
async function ld84EditorResponse(message = {}) {
  const type = String(message?.type || '');
  if (type === 'ld84.editor.resources') return ld84EditorResources();
  if (type === 'ld84.editor.health') return { ok: true, schema: LD84_EDITOR_SCHEMA, health: await ld84EditorHealth() };
  if (type === 'ld84.editor.configure') return { ok: true, schema: LD84_EDITOR_SCHEMA, local: await ld84EditorSaveLocalSettings(message) };
  if (type === 'ld84.editor.bind') return ld84EditorSaveBinding(message);
  if (type === 'ld84.editor.plan') return ld84EditorPlan(message);
  if (type === 'ld84.editor.build') return ld84EditorBuild(message);
  if (type === 'ld84.editor.apply') return ld84EditorApply(message);
  return null;
}
function ld84EditorSenderAllowed(sender) {
  const url = String(sender?.url || sender?.tab?.url || '');
  if (!url) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'chrome-extension:' || parsed.hostname === 'lovable.dev' || parsed.hostname.endsWith('.lovable.dev');
  } catch (_) { return false; }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const type = String(message?.type || '');
  if (!type.startsWith('ld84.editor.')) return;
  if (!ld84EditorSenderAllowed(sender)) {
    sendResponse({ ok: false, code: 'SENDER_NOT_ALLOWED' });
    return false;
  }
  Promise.resolve(ld84EditorResponse(message)).then(response => {
    if (response) sendResponse(response);
  }).catch(error => sendResponse({
    ok: false,
    code: String(error?.code || error?.message || 'EDITOR_RUNTIME_FAILED'),
    message: String(error?.message || error || 'EDITOR_RUNTIME_FAILED')
  }));
  return true;
});

Object.defineProperty(globalThis, 'LovableDecrypterEditorDirectV84', {
  value: Object.freeze({
    schema: LD84_EDITOR_SCHEMA,
    mode: 'event-driven',
    localAiAuthority: true,
    directLovablePromptRouting: false,
    planZeroWrite: true,
    shadowBuildZeroWrite: true,
    explicitApplyRequired: true,
    headRevalidation: true,
    supabaseApplyFailClosedUntilReattached: true
  }),
  configurable: false,
  enumerable: false,
  writable: false
});
