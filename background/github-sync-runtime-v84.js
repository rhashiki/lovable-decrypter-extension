'use strict';

const LD84_GHS_SCHEMA = 'ld-github-sync/1';
const LD84_GHS_BACKEND = 'https://kkzxxnfxgrouhkzyszxs.supabase.co/functions/v1';
const LD84_GHS_ACCOUNT_KEY = 'ld84_account';
const LD84_GHS_DEVICE_KEY = 'ld84_device_id';
const LD84_GHS_PROJECT_KEY = 'ld84_project_snapshot';
const LD84_GHS_BINDINGS_KEY = 'ld84_project_bindings';
const LD84_GHS_STATE_KEY = 'ld84_github_sync_state';
const LD84_GHS_API_VERSION = '2026-03-10';
const LD84_GHS_HISTORY_LIMIT = 30;

function ld84GhsGet(keys) {
  return new Promise(resolve => chrome.storage.local.get(keys, value => resolve(value || {})));
}
function ld84GhsSet(value) {
  return new Promise(resolve => chrome.storage.local.set(value, () => resolve()));
}
function ld84GhsClean(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}
function ld84GhsSenderAllowed(sender) {
  const value = String(sender?.url || sender?.tab?.url || '');
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'chrome-extension:' || url.hostname === 'lovable.dev' || url.hostname.endsWith('.lovable.dev');
  } catch (_) {
    return false;
  }
}
function ld84GhsParseRepo(value) {
  const fullName = ld84GhsClean(value, 220);
  const parts = fullName.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw new Error('GITHUB_REPOSITORY_INVALID');
  return { owner: parts[0], repo: parts[1], fullName };
}
function ld84GhsSafeRef(value) {
  const ref = ld84GhsClean(value, 180);
  if (!ref || /[\s~^:?*\[\\]/.test(ref) || ref.includes('..') || ref.startsWith('/') || ref.endsWith('/')) {
    throw new Error('GITHUB_REF_INVALID');
  }
  return ref;
}
function ld84GhsSafePath(value) {
  const path = ld84GhsClean(value, 500).replace(/\\/g, '/').replace(/^\/+/, '');
  if (!path) return '';
  if (path.includes('..') || path.startsWith('.git/')) throw new Error('GITHUB_PATH_INVALID');
  return path;
}
async function ld84GhsCredentials() {
  const stored = await ld84GhsGet([LD84_GHS_ACCOUNT_KEY, LD84_GHS_DEVICE_KEY]);
  const account = stored[LD84_GHS_ACCOUNT_KEY] && typeof stored[LD84_GHS_ACCOUNT_KEY] === 'object' ? stored[LD84_GHS_ACCOUNT_KEY] : {};
  const licenseKey = ld84GhsClean(account.licenseKey, 5000);
  const deviceId = ld84GhsClean(stored[LD84_GHS_DEVICE_KEY], 300);
  if (account.active !== true || !licenseKey) throw new Error('ACCOUNT_NOT_ACTIVE');
  if (!deviceId) throw new Error('DEVICE_REQUIRED');
  return { licenseKey, deviceId };
}
async function ld84GhsBackend(endpoint, action, payload = {}) {
  const credentials = await ld84GhsCredentials();
  const response = await fetch(`${LD84_GHS_BACKEND}/${endpoint}`, {
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
async function ld84GhsGithubToken() {
  const issued = await ld84GhsBackend('ld-github-app', 'token');
  const token = ld84GhsClean(issued?.token, 5000);
  if (!token) throw new Error('GITHUB_INSTALLATION_TOKEN_REQUIRED');
  return { token, expiresAt: String(issued?.expires_at || '') };
}
async function ld84GhsGithubRequest(token, path, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      accept: 'application/vnd.github+json',
      'x-github-api-version': LD84_GHS_API_VERSION,
      authorization: `Bearer ${token}`,
      ...(options.headers || {})
    },
    signal: options.signal || AbortSignal.timeout(30000)
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(String(body?.message || `GITHUB_HTTP_${response.status}`));
    error.code = `GITHUB_HTTP_${response.status}`;
    throw error;
  }
  return body;
}
async function ld84GhsResolve() {
  const [github, selection, stored] = await Promise.all([
    ld84GhsBackend('ld-github-app', 'status'),
    ld84GhsBackend('ld-integration-selection', 'get', { integration: 'github' }).catch(() => ({ mode: 'all', selected: null })),
    ld84GhsGet([LD84_GHS_PROJECT_KEY, LD84_GHS_BINDINGS_KEY, LD84_GHS_STATE_KEY])
  ]);
  if (github?.app_configured !== true) throw new Error('GITHUB_APP_NOT_CONFIGURED');
  if (github?.connected !== true) throw new Error('GITHUB_AUTHORIZATION_REQUIRED');

  const project = stored[LD84_GHS_PROJECT_KEY] && typeof stored[LD84_GHS_PROJECT_KEY] === 'object' ? stored[LD84_GHS_PROJECT_KEY] : null;
  const projectId = ld84GhsClean(project?.projectId, 120);
  if (!projectId) throw new Error('LOVABLE_PROJECT_ID_REQUIRED');

  const bindings = stored[LD84_GHS_BINDINGS_KEY] && typeof stored[LD84_GHS_BINDINGS_KEY] === 'object' ? stored[LD84_GHS_BINDINGS_KEY] : {};
  const binding = bindings[projectId] && typeof bindings[projectId] === 'object' ? bindings[projectId] : null;
  if (!binding?.repository) throw new Error('GITHUB_PROJECT_BINDING_REQUIRED');

  const repositories = Array.isArray(github?.repositories) ? github.repositories : [];
  const authorized = repositories.find(repo => String(repo?.full_name || '').toLowerCase() === String(binding.repository || '').toLowerCase());
  if (!authorized) throw new Error('GITHUB_REPOSITORY_NOT_AUTHORIZED');

  const selected = selection?.mode === 'all' || selection?.selected === null
    ? null
    : new Set((Array.isArray(selection?.selected) ? selection.selected : []).map(value => String(value).toLowerCase()));
  if (selected && !selected.has(String(authorized.full_name || '').toLowerCase())) throw new Error('GITHUB_REPOSITORY_NOT_SELECTED');

  const repo = ld84GhsParseRepo(authorized.full_name);
  const branch = ld84GhsSafeRef(binding.branch || authorized.default_branch || 'main');
  const states = stored[LD84_GHS_STATE_KEY] && typeof stored[LD84_GHS_STATE_KEY] === 'object' ? stored[LD84_GHS_STATE_KEY] : {};
  const state = states[projectId] && typeof states[projectId] === 'object' ? states[projectId] : null;
  return { project, projectId, binding, repo, branch, authorized, state, states };
}
async function ld84GhsBranchSnapshot(resolved, token) {
  const branch = await ld84GhsGithubRequest(
    token,
    `/repos/${encodeURIComponent(resolved.repo.owner)}/${encodeURIComponent(resolved.repo.repo)}/branches/${encodeURIComponent(resolved.branch)}`
  );
  const headSha = String(branch?.commit?.sha || '').toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(headSha)) throw new Error('GITHUB_HEAD_INVALID');
  const treeSha = String(branch?.commit?.commit?.tree?.sha || '').toLowerCase();
  return {
    headSha,
    treeSha: /^[0-9a-f]{40}$/.test(treeSha) ? treeSha : '',
    commitUrl: String(branch?.commit?.html_url || `https://github.com/${resolved.repo.fullName}/commit/${headSha}`),
    protected: branch?.protected === true
  };
}
async function ld84GhsCompareRaw(resolved, token, base, head) {
  const from = ld84GhsSafeRef(base);
  const to = ld84GhsSafeRef(head);
  return ld84GhsGithubRequest(
    token,
    `/repos/${encodeURIComponent(resolved.repo.owner)}/${encodeURIComponent(resolved.repo.repo)}/compare/${encodeURIComponent(from)}...${encodeURIComponent(to)}`
  );
}
function ld84GhsCompareShape(raw) {
  return {
    status: String(raw?.status || ''),
    aheadBy: Number(raw?.ahead_by || 0),
    behindBy: Number(raw?.behind_by || 0),
    totalCommits: Number(raw?.total_commits || 0),
    baseSha: String(raw?.base_commit?.sha || ''),
    mergeBaseSha: String(raw?.merge_base_commit?.sha || ''),
    htmlUrl: String(raw?.html_url || ''),
    files: (Array.isArray(raw?.files) ? raw.files : []).slice(0, 50).map(file => ({
      filename: String(file?.filename || ''),
      status: String(file?.status || ''),
      additions: Number(file?.additions || 0),
      deletions: Number(file?.deletions || 0),
      changes: Number(file?.changes || 0)
    }))
  };
}
async function ld84GhsStatus() {
  const resolved = await ld84GhsResolve();
  const state = resolved.state || null;
  return {
    ok: true,
    schema: LD84_GHS_SCHEMA,
    projectId: resolved.projectId,
    repository: resolved.repo.fullName,
    branch: resolved.branch,
    state: state ? 'linked' : 'linked-never-synced',
    sync: state,
    policy: {
      authority: 'github',
      bindingAuthority: 'explicit-project-binding',
      eventDriven: true,
      continuousPolling: false,
      writePath: 'editor-direct-explicit-apply',
      forcePush: false,
      directLovableWrite: false
    }
  };
}
async function ld84GhsRefresh() {
  const resolved = await ld84GhsResolve();
  const issued = await ld84GhsGithubToken();
  const current = await ld84GhsBranchSnapshot(resolved, issued.token);
  const previous = resolved.state || null;
  let delta = null;
  if (previous?.headSha && previous.headSha !== current.headSha) {
    try { delta = ld84GhsCompareShape(await ld84GhsCompareRaw(resolved, issued.token, previous.headSha, current.headSha)); }
    catch (error) { delta = { status: 'compare-unavailable', code: String(error?.code || error?.message || 'COMPARE_FAILED') }; }
  }
  const sync = {
    repository: resolved.repo.fullName,
    branch: resolved.branch,
    headSha: current.headSha,
    treeSha: current.treeSha,
    commitUrl: current.commitUrl,
    protected: current.protected,
    previousHeadSha: previous?.headSha || '',
    changedSinceLastSync: Boolean(previous?.headSha && previous.headSha !== current.headSha),
    delta,
    checkedAt: new Date().toISOString(),
    tokenExpiresAt: issued.expiresAt
  };
  resolved.states[resolved.projectId] = sync;
  await ld84GhsSet({ [LD84_GHS_STATE_KEY]: resolved.states });
  return {
    ok: true,
    schema: LD84_GHS_SCHEMA,
    projectId: resolved.projectId,
    repository: resolved.repo.fullName,
    branch: resolved.branch,
    sync
  };
}
async function ld84GhsHistory(message = {}) {
  const resolved = await ld84GhsResolve();
  const issued = await ld84GhsGithubToken();
  const limit = Math.max(1, Math.min(LD84_GHS_HISTORY_LIMIT, Number(message.limit || 20)));
  const query = new URLSearchParams({ sha: resolved.branch, per_page: String(limit) });
  const path = ld84GhsSafePath(message.path || '');
  if (path) query.set('path', path);
  const rows = await ld84GhsGithubRequest(
    issued.token,
    `/repos/${encodeURIComponent(resolved.repo.owner)}/${encodeURIComponent(resolved.repo.repo)}/commits?${query}`
  );
  const commits = (Array.isArray(rows) ? rows : []).map(row => ({
    sha: String(row?.sha || ''),
    shortSha: String(row?.sha || '').slice(0, 7),
    message: String(row?.commit?.message || '').split('\n')[0].slice(0, 240),
    author: String(row?.commit?.author?.name || row?.author?.login || ''),
    date: String(row?.commit?.author?.date || ''),
    htmlUrl: String(row?.html_url || ''),
    parents: (Array.isArray(row?.parents) ? row.parents : []).map(parent => String(parent?.sha || '')).filter(Boolean)
  }));
  return {
    ok: true,
    schema: LD84_GHS_SCHEMA,
    projectId: resolved.projectId,
    repository: resolved.repo.fullName,
    branch: resolved.branch,
    path,
    commits
  };
}
async function ld84GhsCompare(message = {}) {
  const resolved = await ld84GhsResolve();
  const issued = await ld84GhsGithubToken();
  const base = ld84GhsSafeRef(message.base || '');
  const head = ld84GhsSafeRef(message.head || resolved.branch);
  const raw = await ld84GhsCompareRaw(resolved, issued.token, base, head);
  return {
    ok: true,
    schema: LD84_GHS_SCHEMA,
    projectId: resolved.projectId,
    repository: resolved.repo.fullName,
    branch: resolved.branch,
    base,
    head,
    comparison: ld84GhsCompareShape(raw)
  };
}
async function ld84GhsResponse(message = {}) {
  const type = String(message?.type || '');
  if (type === 'ld84.github.sync.status') return ld84GhsStatus();
  if (type === 'ld84.github.sync.refresh') return ld84GhsRefresh();
  if (type === 'ld84.github.sync.history') return ld84GhsHistory(message);
  if (type === 'ld84.github.sync.compare') return ld84GhsCompare(message);
  return null;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const type = String(message?.type || '');
  if (!type.startsWith('ld84.github.sync.')) return;
  if (!ld84GhsSenderAllowed(sender)) {
    sendResponse({ ok: false, code: 'SENDER_NOT_ALLOWED' });
    return false;
  }
  Promise.resolve(ld84GhsResponse(message)).then(response => {
    if (response) sendResponse(response);
  }).catch(error => sendResponse({
    ok: false,
    code: String(error?.code || error?.message || 'GITHUB_SYNC_RUNTIME_FAILED'),
    message: String(error?.message || error || 'GITHUB_SYNC_RUNTIME_FAILED')
  }));
  return true;
});

Object.defineProperty(globalThis, 'LovableDecrypterGithubSyncV84Runtime', {
  value: Object.freeze({
    schema: LD84_GHS_SCHEMA,
    authority: 'github',
    bindingAuthority: 'explicit-project-binding',
    mode: 'event-driven',
    continuousPolling: false,
    historyReadOnly: true,
    compareReadOnly: true,
    writeAuthority: 'editor-direct-explicit-apply',
    forcePush: false,
    directLovableWrite: false
  }),
  configurable: false,
  enumerable: false,
  writable: false
});
