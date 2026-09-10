'use strict';

const LD84_CONTEXT_SCHEMA = 'ld-context-pack/2';
const LD84_SCOPE_SCHEMA = 'ld-scope-intelligence/2';
const LD84_CONTEXT_BUILD = 84;
const LD84_CONTEXT_VERSION = '2.6.84';
const LD84_CONTEXT_PROTOCOL = 'ld-runtime-bus/1';
const LD84_CONTEXT_BACKEND = 'https://kkzxxnfxgrouhkzyszxs.supabase.co/functions/v1';
const LD84_CONTEXT_ACCOUNT_KEY = 'ld84_account';
const LD84_CONTEXT_DEVICE_KEY = 'ld84_device_id';
const LD84_CONTEXT_TRUST_KEY = 'ld84_trust';
const LD84_CONTEXT_PROJECT_KEY = 'ld84_project_snapshot';
const LD84_CONTEXT_BINDINGS_KEY = 'ld84_project_bindings';
const LD84_CONTEXT_USER_EDIT_PREFIX = 'ld84_user_edit_context_v1_';
const LD84_CONTEXT_MAX_FILES = 16;
const LD84_CONTEXT_MAX_CODE_BYTES = 150000;
const LD84_CONTEXT_MAX_FILE_BYTES = 72000;
const LD84_CONTEXT_MAX_TREE = 4000;
const LD84_CONTEXT_HUMAN_WINDOW_MS = 24 * 60 * 60 * 1000;
const LD84_CONTEXT_API_VERSION = '2026-03-10';

const ld84ContextText = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const ld84ContextUnique = values => [...new Set((Array.isArray(values) ? values : []).map(value => ld84ContextText(value, 1200)).filter(Boolean))];
const ld84ContextSafePath = value => ld84ContextText(value, 1200).replace(/\\/g, '/').replace(/^\/+/, '');
const ld84ContextEncoder = new TextEncoder();
const ld84ContextBytes = value => ld84ContextEncoder.encode(String(value ?? '')).byteLength;

function ld84ContextGet(keys) {
  return new Promise(resolve => chrome.storage.local.get(keys, value => resolve(value || {})));
}
function ld84ContextSet(value) {
  return new Promise(resolve => chrome.storage.local.set(value, () => resolve()));
}
function ld84ContextSensitivePath(path = '') {
  return /(^|\/)(\.env(?:\.|$)|\.git\/|id_rsa|id_ed25519|secrets?\b|credentials?\b)/i.test(path) || /\.(pem|key|p12|pfx)$/i.test(path);
}
function ld84ContextTextPath(path = '') {
  if (ld84ContextSensitivePath(path)) return false;
  return /(^|\/)(README|AGENTS|CLAUDE)(\.[^/]*)?$|\.(?:[cm]?[jt]sx?|json|mdx?|txt|css|scss|sass|less|html?|vue|svelte|astro|py|rb|php|java|kt|kts|go|rs|swift|c|cc|cpp|h|hpp|cs|sql|graphql|gql|toml|ya?ml|ini|conf|sh|bash|zsh|fish|ps1|gradle|properties)$/i.test(path);
}
function ld84ContextWords(value = '') {
  return [...new Set(String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/[a-z0-9_./-]{3,}/g) || [])]
    .flatMap(token => token.split(/[/.\\_-]+/)).filter(token => token.length >= 3).slice(0, 120);
}
function ld84ContextParseRepo(fullName) {
  const parts = ld84ContextText(fullName, 240).split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw new Error('CONTEXT_REPOSITORY_INVALID');
  return { owner: parts[0], repo: parts[1], fullName: `${parts[0]}/${parts[1]}` };
}
function ld84ContextBase64Url(bytes) {
  let raw = '';
  for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
async function ld84ContextSha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', ld84ContextEncoder.encode(String(value || '')));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
function ld84ContextNonce() {
  return ld84ContextBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}
async function ld84ContextCredentials() {
  const stored = await ld84ContextGet([LD84_CONTEXT_ACCOUNT_KEY, LD84_CONTEXT_DEVICE_KEY]);
  const account = stored[LD84_CONTEXT_ACCOUNT_KEY] && typeof stored[LD84_CONTEXT_ACCOUNT_KEY] === 'object' ? stored[LD84_CONTEXT_ACCOUNT_KEY] : {};
  const licenseKey = ld84ContextText(account.licenseKey, 5000);
  const deviceId = ld84ContextText(stored[LD84_CONTEXT_DEVICE_KEY], 400);
  if (account.active !== true || !licenseKey) throw new Error('ACCOUNT_NOT_ACTIVE');
  if (!deviceId) throw new Error('DEVICE_REQUIRED');
  return { licenseKey, deviceId };
}
async function ld84ContextEnsureTrust(force = false) {
  const stored = await ld84ContextGet([LD84_CONTEXT_TRUST_KEY]);
  const cached = stored[LD84_CONTEXT_TRUST_KEY] && typeof stored[LD84_CONTEXT_TRUST_KEY] === 'object' ? stored[LD84_CONTEXT_TRUST_KEY] : null;
  if (!force && cached?.token && cached?.expiresAt && Date.parse(cached.expiresAt) > Date.now() + 30000 && cached.protocol === LD84_CONTEXT_PROTOCOL) return cached;
  const credentials = await ld84ContextCredentials();
  const fingerprint = await ld84ContextSha256(`${LD84_CONTEXT_VERSION}|${LD84_CONTEXT_PROTOCOL}|background/context-intelligence-runtime-v84.js`);
  const response = await fetch(`${LD84_CONTEXT_BACKEND}/ld-trust-attest`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-license-key': credentials.licenseKey, 'x-device-id': credentials.deviceId },
    body: JSON.stringify({
      client_version: LD84_CONTEXT_VERSION,
      client_protocol: LD84_CONTEXT_PROTOCOL,
      client_fingerprint: fingerprint,
      nonce: ld84ContextNonce(),
      capabilities: ['context.pack', 'ai.memory', 'scope.intelligence'],
      integrity: { kind: 'runtime-contract', authority: 'background/context-intelligence-runtime-v84.js', critical_assets: 1 }
    })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok !== true || !body?.trust_token || !body?.expires_at) throw new Error(String(body?.code || `TRUST_HTTP_${response.status}`));
  const trust = { token: String(body.trust_token), expiresAt: String(body.expires_at), protocol: String(body.client_protocol || LD84_CONTEXT_PROTOCOL), attestedAt: new Date().toISOString() };
  await ld84ContextSet({ [LD84_CONTEXT_TRUST_KEY]: trust });
  return trust;
}
async function ld84ContextBackend(endpoint, action, payload = {}, trustRequired = false) {
  const credentials = await ld84ContextCredentials();
  const headers = { 'content-type': 'application/json', 'x-license-key': credentials.licenseKey, 'x-device-id': credentials.deviceId };
  if (trustRequired) {
    const trust = await ld84ContextEnsureTrust(false);
    headers['x-decrypter-trust'] = trust.token;
    headers['x-decrypter-client-version'] = LD84_CONTEXT_VERSION;
    headers['x-decrypter-client-protocol'] = LD84_CONTEXT_PROTOCOL;
  }
  const response = await fetch(`${LD84_CONTEXT_BACKEND}/${endpoint}`, { method: 'POST', headers, body: JSON.stringify({ action, ...payload }) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok !== true) {
    const error = new Error(String(body?.code || `HTTP_${response.status}`));
    error.code = String(body?.code || `HTTP_${response.status}`);
    throw error;
  }
  return body;
}
async function ld84ContextGithubToken() {
  const body = await ld84ContextBackend('ld-github-app', 'token');
  if (!body?.token) throw new Error('CONTEXT_GITHUB_TOKEN_REQUIRED');
  return String(body.token);
}
async function ld84ContextGithub(token, path) {
  const response = await fetch(`https://api.github.com${path}`, {
    method: 'GET',
    headers: { accept: 'application/vnd.github+json', 'x-github-api-version': LD84_CONTEXT_API_VERSION, authorization: `Bearer ${token}` },
    cache: 'no-store'
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(body?.message || `GITHUB_HTTP_${response.status}`));
  return body;
}
async function ld84ContextBinding(input = {}) {
  const stored = await ld84ContextGet([LD84_CONTEXT_PROJECT_KEY, LD84_CONTEXT_BINDINGS_KEY]);
  const project = stored[LD84_CONTEXT_PROJECT_KEY] && typeof stored[LD84_CONTEXT_PROJECT_KEY] === 'object' ? stored[LD84_CONTEXT_PROJECT_KEY] : {};
  const projectId = ld84ContextText(input.projectId || project.projectId, 160);
  if (!projectId) throw new Error('CONTEXT_PROJECT_REQUIRED');
  const bindings = stored[LD84_CONTEXT_BINDINGS_KEY] && typeof stored[LD84_CONTEXT_BINDINGS_KEY] === 'object' ? stored[LD84_CONTEXT_BINDINGS_KEY] : {};
  const saved = bindings[projectId] && typeof bindings[projectId] === 'object' ? bindings[projectId] : {};
  const repository = ld84ContextText(input.repository || saved.repository, 240);
  if (!repository) throw new Error('CONTEXT_GITHUB_MAPPING_REQUIRED');
  const branch = ld84ContextText(input.branch || saved.branch || 'main', 180) || 'main';
  return { projectId, project, repository, branch, supabaseProject: ld84ContextText(input.supabaseProject || saved.supabaseProject, 160) };
}
async function ld84ContextMemory(binding, task) {
  return ld84ContextBackend('ld-memory-engine', 'recall', { project_id: binding.projectId, query: task, top_k: 6 }, true);
}
function ld84ContextBrainImportant(memory) {
  return ld84ContextUnique(memory?.brain?.important_paths || memory?.memory?.brain?.important_paths || []).map(ld84ContextSafePath);
}
function ld84ContextScore(path, taskWords, explicitPaths, importantPaths) {
  const lower = path.toLowerCase();
  let score = 0;
  const reasons = [];
  if (explicitPaths.has(path)) { score += 280; reasons.push('explicit-task-path'); }
  if (importantPaths.has(path)) { score += 130; reasons.push('project-brain-important-path'); }
  if (/^(src|app|pages|components|routes|server|api|supabase)\//i.test(path)) { score += 18; reasons.push('source-area'); }
  if (/(^|\/)(readme|agents|claude|docs?|architecture|adr|rules?|skills?|design|spec|roadmap)[^/]*\.(md|mdx|txt)$/i.test(path)) { score += 32; reasons.push('project-documentation'); }
  if (/^(package\.json|README\.md|AGENTS\.md|CLAUDE\.md|src\/main\.tsx|src\/App\.tsx|vite\.config\.[jt]s|tsconfig\.json|supabase\/config\.toml)$/i.test(path)) { score += 45; reasons.push('project-core'); }
  if (/\.(test|spec|stories)\.[jt]sx?$|(^|\/)(fixtures|generated|dist|build|coverage|node_modules)\//i.test(path)) score -= 35;
  for (const word of taskWords) if (lower.includes(word)) { score += 18; reasons.push(`task:${word}`); }
  return { score, reasons: ld84ContextUnique(reasons).slice(0, 12) };
}
function ld84ContextDecodeBlob(body) {
  if (String(body?.encoding || '') !== 'base64') return String(body?.content || '');
  const normalized = String(body?.content || '').replace(/\s+/g, '');
  const raw = atob(normalized);
  const bytes = Uint8Array.from(raw, char => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
function ld84ContextClip(value, maxBytes) {
  const source = String(value || '');
  if (ld84ContextBytes(source) <= maxBytes) return { content: source, truncated: false };
  let low = 0, high = source.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (ld84ContextBytes(source.slice(0, mid)) <= maxBytes) low = mid; else high = mid - 1;
  }
  return { content: source.slice(0, low), truncated: true };
}
async function ld84ContextBuild(message = {}) {
  const task = ld84ContextText(message.task || message.command, 60000);
  if (!task) throw new Error('CONTEXT_TASK_REQUIRED');
  const binding = await ld84ContextBinding(message);
  const repo = ld84ContextParseRepo(binding.repository);
  const [token, memory] = await Promise.all([ld84ContextGithubToken(), ld84ContextMemory(binding, task)]);
  const branchInfo = await ld84ContextGithub(token, `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/branches/${encodeURIComponent(binding.branch)}`);
  const headSha = String(branchInfo?.commit?.sha || '').toLowerCase();
  const treeSha = String(branchInfo?.commit?.commit?.tree?.sha || '').toLowerCase();
  if (!headSha || !treeSha) throw new Error('CONTEXT_GITHUB_HEAD_INVALID');
  const tree = await ld84ContextGithub(token, `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/git/trees/${encodeURIComponent(treeSha)}?recursive=1`);
  if (tree?.truncated) throw new Error('CONTEXT_TREE_TRUNCATED');
  const taskWords = ld84ContextWords(task);
  const explicitPaths = new Set(ld84ContextUnique(message.explicitPaths || []).map(ld84ContextSafePath));
  const importantPaths = new Set(ld84ContextBrainImportant(memory));
  const candidates = (Array.isArray(tree?.tree) ? tree.tree : []).slice(0, LD84_CONTEXT_MAX_TREE)
    .filter(item => item?.type === 'blob' && item?.path && ld84ContextTextPath(item.path) && Number(item?.size || 0) <= 240000)
    .map(item => ({ path: ld84ContextSafePath(item.path), sha: String(item.sha || ''), size: Number(item.size || 0), ...ld84ContextScore(ld84ContextSafePath(item.path), taskWords, explicitPaths, importantPaths) }))
    .filter(item => item.path && item.sha)
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  const files = [];
  let codeBytes = 0;
  for (const candidate of candidates) {
    if (files.length >= LD84_CONTEXT_MAX_FILES || codeBytes >= LD84_CONTEXT_MAX_CODE_BYTES) break;
    if (candidate.score <= 0 && files.length >= 5) break;
    const remaining = LD84_CONTEXT_MAX_CODE_BYTES - codeBytes;
    if (remaining < 4000) break;
    try {
      const blob = await ld84ContextGithub(token, `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/git/blobs/${encodeURIComponent(candidate.sha)}`);
      const raw = ld84ContextDecodeBlob(blob);
      const selected = ld84ContextClip(raw, Math.min(LD84_CONTEXT_MAX_FILE_BYTES, remaining));
      const size = ld84ContextBytes(selected.content);
      if (!size) continue;
      files.push({ path: candidate.path, sha: candidate.sha, size: candidate.size || ld84ContextBytes(raw), contextBytes: size, truncated: selected.truncated, score: candidate.score, reasons: candidate.reasons, content: selected.content });
      codeBytes += size;
    } catch (_) {}
  }
  const memoryData = memory?.memory || {};
  const pack = {
    schema: LD84_CONTEXT_SCHEMA,
    build: LD84_CONTEXT_BUILD,
    task,
    project: { id: binding.projectId, repository: binding.repository, branch: binding.branch, supabaseProject: binding.supabaseProject || null },
    git: { headSha, treeSha },
    brain: memory?.brain || null,
    memory: { engine: memoryData.engine || 'project-brain-v2', brainVersion: memoryData.brain_version ?? null, hitCount: Number(memoryData.hit_count || 0), retrieval: memoryData.retrieval || 'none', citations: Array.isArray(memoryData.citations) ? memoryData.citations.slice(0, 8) : [], contextMd: String(memoryData.context_md || ''), digest: memoryData.digest || null },
    files,
    budget: { maxFiles: LD84_CONTEXT_MAX_FILES, maxCodeBytes: LD84_CONTEXT_MAX_CODE_BYTES, usedCodeBytes: codeBytes },
    authority: { precedence: ['user-request', 'explicit-user-manual-edit', 'project-rules', 'approved-plan', 'current-project-state', 'current-ai-plan', 'historical-ai-output'], retrievedMemoryAuthority: 'evidence-only', modelStateAuthority: false },
    provenance: { generatedAt: new Date().toISOString(), rawPromptPersisted: false, rawKeystrokesPersisted: false, continuousPolling: false, globalObservers: false }
  };
  return { ok: true, schema: LD84_CONTEXT_SCHEMA, build: LD84_CONTEXT_BUILD, capability: 'context.pack', state: 'reattached', targetPhase: '84.6', functionalInvocation: true, summary: `Context Pack pronto · ${files.length} arquivo(s) · ${codeBytes} bytes de código · Brain v${memoryData.brain_version || '—'}.`, pack };
}
async function ld84ContextStatus() {
  const stored = await ld84ContextGet([LD84_CONTEXT_PROJECT_KEY, LD84_CONTEXT_BINDINGS_KEY]);
  const project = stored[LD84_CONTEXT_PROJECT_KEY] && typeof stored[LD84_CONTEXT_PROJECT_KEY] === 'object' ? stored[LD84_CONTEXT_PROJECT_KEY] : {};
  const projectId = ld84ContextText(project.projectId, 160);
  const bindings = stored[LD84_CONTEXT_BINDINGS_KEY] && typeof stored[LD84_CONTEXT_BINDINGS_KEY] === 'object' ? stored[LD84_CONTEXT_BINDINGS_KEY] : {};
  const binding = projectId && bindings[projectId] ? bindings[projectId] : null;
  return { ok: true, schema: LD84_CONTEXT_SCHEMA, build: 84, capability: 'context.pack', state: 'reattached', targetPhase: '84.6', functionalInvocation: true, summary: binding ? `Context Engine pronto · ${binding.repository} · sob demanda.` : 'Context Engine pronto · vincule o projeto atual a um repositório no Editor Direto.', data: { projectId: projectId || null, binding: binding || null, memoryEngine: 'project-brain-v2', scopeEngine: LD84_SCOPE_SCHEMA, eventDriven: true, rawPromptPersistence: false, globalObservers: false, continuousPolling: false } };
}
function ld84ScopeRecent(value, now) {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) && parsed > 0 && now - parsed <= LD84_CONTEXT_HUMAN_WINDOW_MS;
}
function ld84ScopeLocks(edits = [], now = Date.now()) {
  const map = new Map();
  for (const edit of Array.isArray(edits) ? edits : []) {
    if (String(edit?.origin || '') !== 'user' || !ld84ScopeRecent(edit?.observedAt, now)) continue;
    for (const raw of Array.isArray(edit?.paths) ? edit.paths : []) {
      const path = ld84ContextSafePath(raw);
      if (!path) continue;
      const item = map.get(path) || { path, count: 0, eventIds: [], lastObservedAt: '' };
      item.count += 1;
      if (edit?.id) item.eventIds.push(ld84ContextText(edit.id, 160));
      if (!item.lastObservedAt || Date.parse(edit.observedAt || '') > Date.parse(item.lastObservedAt || '')) item.lastObservedAt = ld84ContextText(edit.observedAt, 80);
      map.set(path, item);
    }
  }
  return [...map.values()].map(item => ({ ...item, level: item.count >= 2 ? 'strong' : 'soft', eventIds: ld84ContextUnique(item.eventIds), policy: item.count >= 2 ? 'explicit-path-request-or-override-required' : 'preserve-unless-current-request-explicitly-targets-path' })).sort((a, b) => a.path.localeCompare(b.path));
}
async function ld84ScopeStoredEdits(projectId) {
  if (!projectId) return [];
  const key = `${LD84_CONTEXT_USER_EDIT_PREFIX}${projectId}`;
  const stored = await ld84ContextGet([key]);
  return Array.isArray(stored[key]) ? stored[key].slice(0, 80) : [];
}
function ld84ScopeLineDelta(before = '', after = '') {
  const left = String(before ?? '').split('\n'), right = String(after ?? '').split('\n');
  let prefix = 0;
  while (prefix < left.length && prefix < right.length && left[prefix] === right[prefix]) prefix += 1;
  let suffix = 0;
  while (suffix < left.length - prefix && suffix < right.length - prefix && left[left.length - 1 - suffix] === right[right.length - 1 - suffix]) suffix += 1;
  const removed = Math.max(0, left.length - prefix - suffix), added = Math.max(0, right.length - prefix - suffix), touched = Math.max(removed, added);
  return { beforeLines: left.length, afterLines: right.length, addedLines: added, removedLines: removed, touchedLines: touched, touchedRatio: Number((touched / Math.max(1, left.length)).toFixed(4)) };
}
function ld84ScopeExplicit(command, path) {
  const raw = String(command || '').toLowerCase();
  const clean = ld84ContextSafePath(path).toLowerCase();
  if (!raw || !clean) return false;
  if (raw.includes(clean)) return true;
  const base = clean.split('/').pop() || '';
  return base.length >= 5 && raw.includes(base);
}
async function ld84ScopeEvaluate(message = {}) {
  const command = ld84ContextText(message.command, 50000);
  const planFiles = (Array.isArray(message?.approvedPlan?.files) ? message.approvedPlan.files : Array.isArray(message?.plan?.files) ? message.plan.files : []).map(item => ({ path: ld84ContextSafePath(item?.path || item), action: String(item?.action || '').toLowerCase() })).filter(item => item.path).slice(0, 40);
  const files = (Array.isArray(message.files) ? message.files : []).map(item => ({ path: ld84ContextSafePath(item?.path), action: String(item?.action || '').toLowerCase(), before: typeof item?.before === 'string' ? item.before : '', content: typeof item?.content === 'string' ? item.content : '' })).filter(item => item.path).slice(0, 40);
  const binding = await ld84ContextBinding(message).catch(() => ({ projectId: ld84ContextText(message.projectId, 160) }));
  const recentEdits = Array.isArray(message.recentUserEdits) ? message.recentUserEdits : await ld84ScopeStoredEdits(binding.projectId);
  const locks = ld84ScopeLocks(recentEdits);
  const overrideSet = new Set(ld84ContextUnique(message.humanIntentOverrides || []).map(ld84ContextSafePath));
  const approved = new Set(planFiles.map(item => item.path));
  const violations = [], warnings = [];
  if (!command) violations.push({ code: 'request-missing', message: 'Pedido original ausente.' });
  if (!approved.size) violations.push({ code: 'approved-plan-empty', message: 'Plano aprovado não contém arquivos.' });
  if (!files.length) violations.push({ code: 'diff-empty', message: 'Nenhuma alteração preparada para comparar.' });
  const broad = /\b(projeto inteiro|todos os arquivos|refatora(?:r)? (?:o )?projeto|migra(?:r|ção) completa|whole project|entire project|all files)\b/i.test(command);
  for (const file of files) {
    if (!approved.has(file.path)) violations.push({ code: 'outside-approved-plan', path: file.path, message: `Arquivo fora do plano aprovado: ${file.path}` });
    if (!['create', 'update', 'delete'].includes(file.action)) violations.push({ code: 'invalid-action', path: file.path, message: `Ação inválida: ${file.path}` });
    if (file.action === 'delete' && !/\b(apaga(?:r)?|exclu(?:ir|a)|remove(?:r)?|deleta(?:r)?|delete|remove)\b/i.test(command)) violations.push({ code: 'delete-intent-missing', path: file.path, message: `Exclusão sem intenção explícita: ${file.path}` });
    if (file.action === 'update') {
      const delta = ld84ScopeLineDelta(file.before, file.content);
      if (delta.beforeLines >= 30 && delta.touchedRatio > 0.55 && !broad) violations.push({ code: 'broad-rewrite', path: file.path, ratio: delta.touchedRatio, message: `Reescrita ampla não autorizada em ${file.path}.` });
      else if (delta.beforeLines >= 30 && delta.touchedRatio > 0.35) warnings.push({ code: 'large-diff', path: file.path, ratio: delta.touchedRatio, message: `Diff amplo em ${file.path}.` });
    }
    const lock = locks.find(item => item.path === file.path);
    if (lock && !overrideSet.has(file.path) && !ld84ScopeExplicit(command, file.path)) violations.push({ code: 'human-intent-override-required', path: file.path, level: lock.level, message: `${lock.level} User Intent Lock em ${file.path}.` });
  }
  const report = { schema: LD84_SCOPE_SCHEMA, build: 84, allowed: violations.length === 0, enforcement: 'fail-closed-before-write', decision: message.decision === 'skip' ? 'skip' : 'approve', humanIntent: { policy: 'USER_EDIT > AI_EDIT', locks, overridesUsed: [...overrideSet].filter(path => files.some(file => file.path === path)) }, warnings, violations };
  return { ok: true, schema: LD84_SCOPE_SCHEMA, capability: 'scope.intelligence', state: 'reattached', targetPhase: '84.6', functionalInvocation: true, summary: report.allowed ? 'Scope Intelligence aprovado · request → plan → diff consistente.' : `Scope Intelligence bloqueou o write · ${violations.length} violação(ões).`, report };
}
async function ld84ScopeStatus(message = {}) {
  const binding = await ld84ContextBinding(message).catch(() => ({ projectId: ld84ContextText(message.projectId, 160) }));
  const locks = ld84ScopeLocks(await ld84ScopeStoredEdits(binding.projectId));
  return { ok: true, schema: LD84_SCOPE_SCHEMA, build: 84, capability: 'scope.intelligence', state: 'reattached', targetPhase: '84.6', functionalInvocation: true, summary: `Scope Intelligence funcional · fail-closed · ${locks.length} Human Intent Lock(s) ativo(s).`, data: { comparison: 'request->approved-plan->prepared-diff', enforcement: 'fail-closed-before-write', humanIntentPolicy: 'USER_EDIT > AI_EDIT', strongLockPolicy: 'explicit-path-in-current-request-or-explicit-override', skipApprovalBypassesScope: false, locks, eventDriven: true, continuousPolling: false, globalObservers: false } };
}
function ld84ContextSenderAllowed(sender) {
  const url = String(sender?.url || sender?.tab?.url || '');
  if (!url) return true;
  try { const parsed = new URL(url); return parsed.protocol === 'chrome-extension:' || parsed.hostname === 'lovable.dev' || parsed.hostname.endsWith('.lovable.dev'); } catch { return false; }
}
async function ld84ContextResponse(message = {}) {
  const type = String(message?.type || '');
  if (type === 'ld84.context.status') return ld84ContextStatus();
  if (type === 'ld84.context.build') return ld84ContextBuild(message);
  if (type === 'ld84.scope.status') return ld84ScopeStatus(message);
  if (type === 'ld84.scope.evaluate') return ld84ScopeEvaluate(message);
  return null;
}
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const type = String(message?.type || '');
  if (!type.startsWith('ld84.context.') && !type.startsWith('ld84.scope.')) return false;
  if (!ld84ContextSenderAllowed(sender)) { sendResponse({ ok: false, code: 'SENDER_NOT_ALLOWED' }); return false; }
  Promise.resolve(ld84ContextResponse(message)).then(response => sendResponse(response || { ok: false, code: 'CONTEXT_ACTION_INVALID' })).catch(error => sendResponse({ ok: false, code: error?.code || error?.message || 'CONTEXT_RUNTIME_ERROR', message: error?.message || String(error) }));
  return true;
});
Object.defineProperty(globalThis, 'LovableDecrypterContextIntelligenceV84', {
  value: Object.freeze({ build: 84, contextSchema: LD84_CONTEXT_SCHEMA, scopeSchema: LD84_SCOPE_SCHEMA, eventDriven: true, continuousPolling: false, globalObservers: false, rawPromptPersistence: false }),
  configurable: false, enumerable: false, writable: false
});
