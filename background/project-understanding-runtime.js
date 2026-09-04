import { DEFAULT_BACKEND_BASE } from '../settings/config.js';
import { getSettings } from '../storage/settings-store.js';
import { GitAdapter } from '../github/git-adapter.js';
import { getRepositoryCache, getCachedText, syncRepositoryCache } from '../core/repo-cache.js';
import { buildProjectUnderstandingMap } from '../core/project-understanding-map.js';

const PORT_NAME = 'ld2-project-understanding';
const BUILD = 96;
const MAX_ANALYZED_FILES = 240;
const MAX_TOTAL_SOURCE_CHARS = 3_000_000;
const MAX_SINGLE_SOURCE_CHARS = 220_000;
const SOURCE_PATH = /\.(?:[cm]?[jt]sx?|vue|svelte|astro|json|sql)$/i;
const SENSITIVE_PATH = /(^|\/)(?:\.env(?:\..*)?|.*(?:secret|credential|private[-_.]?key).*)(?:\/|$)|\.(?:pem|p12|pfx|key)$/i;

const clean = (value, max = 1200) => String(value ?? '').trim().slice(0, max);

function projectMappings(settings, projectId) {
  const githubMapping = projectId ? settings?.projectMappings?.[projectId] || null : null;
  const supabaseMapping = projectId ? settings?.supabaseMappings?.[projectId] || null : null;
  const github = { ...(settings?.github || {}), ...(githubMapping || {}) };
  const supabase = { ...(settings?.supabase || {}), ...(supabaseMapping || {}) };
  return { githubMapping, supabaseMapping, github, supabase };
}

function safeTarget(payload = {}) {
  const raw = payload?.target && typeof payload.target === 'object' ? payload.target : {};
  const path = clean(raw.path, 1200).replace(/\\/g, '/').replace(/^\.\//, '');
  const category = clean(raw.category, 40).toLowerCase();
  if (path) {
    if (path.startsWith('/') || path.includes('\0') || path.split('/').some(part => !part || part === '.' || part === '..') || SENSITIVE_PATH.test(path)) {
      const error = new Error('PROJECT_MAP_TARGET_INVALID');
      error.code = 'PROJECT_MAP_TARGET_INVALID';
      throw error;
    }
    return { path, category: '' };
  }
  if (category && !['all','file','route','component','dependency','database','api'].includes(category)) {
    const error = new Error('PROJECT_MAP_CATEGORY_INVALID');
    error.code = 'PROJECT_MAP_CATEGORY_INVALID';
    throw error;
  }
  return category && category !== 'all' ? { path: '', category } : null;
}

function pathPriority(path) {
  let score = 0;
  if (/package\.json$/i.test(path)) score += 1000;
  if (/(?:^|\/)(?:routes?|pages?|app)\//i.test(path)) score += 850;
  if (/supabase\/(?:migrations|functions)\//i.test(path)) score += 820;
  if (/(?:^|\/)(?:components?|ui)\//i.test(path)) score += 760;
  if (/(?:^|\/)src\//i.test(path)) score += 600;
  if (/\.(?:tsx|jsx|vue|svelte|astro)$/i.test(path)) score += 300;
  if (/\.(?:ts|js|mjs|cjs)$/i.test(path)) score += 180;
  if (/\.sql$/i.test(path)) score += 140;
  score -= Math.min(120, path.split('/').length * 4);
  return score;
}

function categoryMatches(path, category) {
  if (!category) return true;
  if (category === 'dependency') return /package\.json$/i.test(path);
  if (category === 'route') return /(?:^|\/)(?:routes?|pages?|app)\//i.test(path);
  if (category === 'component') return /(?:^|\/)(?:components?|ui)\//i.test(path) || /\.(?:tsx|jsx|vue|svelte|astro)$/i.test(path);
  if (category === 'database') return /supabase\/|\.sql$/i.test(path);
  if (category === 'api') return /(?:api|service|client|functions?)\b/i.test(path);
  return true;
}

async function boundedCachedFiles(index, target = null) {
  const candidates = (index?.tree || [])
    .filter(item => item?.type === 'blob' && item?.path && SOURCE_PATH.test(item.path) && !SENSITIVE_PATH.test(item.path))
    .filter(item => !target?.path || item.path === target.path)
    .filter(item => categoryMatches(item.path, target?.category || ''))
    .sort((a, b) => pathPriority(b.path) - pathPriority(a.path) || a.path.localeCompare(b.path))
    .slice(0, target?.path ? 1 : MAX_ANALYZED_FILES);

  const files = [];
  let totalChars = 0;
  for (const item of candidates) {
    const cached = await getCachedText(item.sha);
    if (cached == null) continue;
    const content = String(cached).slice(0, MAX_SINGLE_SOURCE_CHARS);
    if (!content) continue;
    if (totalChars + content.length > MAX_TOTAL_SOURCE_CHARS) break;
    totalChars += content.length;
    files.push({ path: item.path, sha: item.sha, content });
  }
  return { files, totalChars, candidateCount: candidates.length };
}

async function directTargetFile(adapter, path) {
  if (!path || !SOURCE_PATH.test(path) || SENSITIVE_PATH.test(path)) return null;
  const result = await adapter.getFileByPath(path, adapter.branch);
  const content = String(result?.text || '').slice(0, MAX_SINGLE_SOURCE_CHARS);
  if (!content) return null;
  return { path, sha: clean(result?.sha, 80), content };
}

async function databaseIntrospection(settings, projectRef) {
  if (!/^[a-z0-9]{8,32}$/i.test(projectRef || '')) return { schema: [], available: false, error: '' };
  const licenseKey = clean(settings?.auth?.licenseKey, 20000);
  const deviceId = clean(settings?.auth?.deviceId, 1000);
  if (!licenseKey || !deviceId) return { schema: [], available: false, error: 'AUTH_REQUIRED' };
  const base = clean(settings?.auth?.backendBase || DEFAULT_BACKEND_BASE, 2000).replace(/\/+$/, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch(`${base}/ld-database-runtime`, {
      method: 'POST',
      signal: controller.signal,
      cache: 'no-store',
      redirect: 'error',
      headers: {
        'Content-Type': 'application/json',
        'x-license-key': licenseKey,
        'x-device-id': deviceId
      },
      body: JSON.stringify({ action: 'introspect', project_ref: projectRef })
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.ok) return { schema: [], available: false, error: clean(body?.code || `HTTP_${response.status}`, 300) };
    return { schema: Array.isArray(body.schema) ? body.schema : [], available: true, error: '' };
  } catch (error) {
    return { schema: [], available: false, error: clean(error?.name === 'AbortError' ? 'DATABASE_INTROSPECTION_TIMEOUT' : error?.message || error, 300) };
  } finally {
    clearTimeout(timer);
  }
}

async function buildSnapshot(payload = {}, { targeted = false } = {}) {
  const settings = await getSettings();
  const projectId = clean(payload.projectId, 160);
  if (!projectId) {
    const error = new Error('PROJECT_MAP_PROJECT_REQUIRED');
    error.code = 'PROJECT_MAP_PROJECT_REQUIRED';
    throw error;
  }
  const mappings = projectMappings(settings, projectId);
  const owner = clean(mappings.github?.owner, 160);
  const repo = clean(mappings.github?.repo, 200);
  const branch = clean(mappings.github?.branch || 'main', 200) || 'main';
  if (!owner || !repo) {
    const error = new Error('PROJECT_MAP_GITHUB_MAPPING_REQUIRED');
    error.code = 'PROJECT_MAP_GITHUB_MAPPING_REQUIRED';
    throw error;
  }

  const adapter = new GitAdapter({ ...mappings.github, owner, repo, branch });
  const target = safeTarget(payload);
  let index;
  let headSha = '';
  let stale = false;
  let source;

  if (targeted && target?.path) {
    const [ref, current] = await Promise.all([adapter.getRef(branch), getRepositoryCache(owner, repo, branch)]);
    headSha = clean(ref?.object?.sha, 80);
    index = current || { owner, repo, branch, headSha, updatedAt: '', tree: [] };
    stale = Boolean(index?.headSha && headSha && index.headSha !== headSha);
    const direct = await directTargetFile(adapter, target.path);
    source = { files: direct ? [direct] : [], totalChars: direct?.content?.length || 0, candidateCount: direct ? 1 : 0 };
    if (!index.tree?.some?.(item => item.path === target.path) && direct) {
      index = { ...index, tree: [...(index.tree || []), { path: target.path, type: 'blob', sha: direct.sha, size: direct.content.length }] };
    }
  } else {
    index = await syncRepositoryCache(adapter, { branch });
    headSha = clean(index?.headSha, 80);
    source = await boundedCachedFiles(index, target);
  }

  const projectRef = clean(mappings.supabase?.projectRef, 80);
  const database = await databaseIntrospection(settings, projectRef);
  const collectedAt = new Date().toISOString();
  const map = buildProjectUnderstandingMap({
    files: source.files,
    tree: index?.tree || [],
    project: {
      id: projectId,
      github: `${owner}/${repo}`,
      branch,
      supabaseProjectRef: projectRef
    },
    databaseSchema: database.schema,
    collectedAt,
    headSha,
    target
  });

  return Object.freeze({
    ...map,
    freshness: Object.freeze({ ...map.freshness, stale }),
    runtime: Object.freeze({
      build: BUILD,
      cacheHit: index?.cacheHit === true,
      cacheUpdatedAt: clean(index?.updatedAt, 80),
      analyzedSourceChars: source.totalChars,
      candidateFiles: source.candidateCount,
      databaseIntrospectionAvailable: database.available,
      databaseIntrospectionError: database.error,
      targetedRefresh: Boolean(targeted && target?.path),
      writeAuthority: false,
      polling: false
    })
  });
}

export function installProjectUnderstandingRuntime() {
  if (globalThis.__LD2_PROJECT_UNDERSTANDING_RUNTIME__) return;
  globalThis.__LD2_PROJECT_UNDERSTANDING_RUNTIME__ = true;

  chrome.runtime.onConnect.addListener(port => {
    if (port.name !== PORT_NAME) return;
    const handler = async message => {
      const id = String(message?.id || '');
      try {
        const action = String(message?.action || 'snapshot');
        let data;
        if (action === 'status') {
          data = { ok: true, build: BUILD, schema: 'ld-project-understanding-map/1', read_only: true, targeted_refresh: true, polling: false };
        } else if (action === 'snapshot') {
          data = await buildSnapshot(message?.payload || {}, { targeted: false });
        } else if (action === 'refresh_target') {
          const target = safeTarget(message?.payload || {});
          if (!target?.path) {
            const error = new Error('PROJECT_MAP_TARGET_PATH_REQUIRED');
            error.code = 'PROJECT_MAP_TARGET_PATH_REQUIRED';
            throw error;
          }
          data = await buildSnapshot({ ...(message?.payload || {}), target }, { targeted: true });
        } else {
          const error = new Error('PROJECT_MAP_ACTION_INVALID');
          error.code = 'PROJECT_MAP_ACTION_INVALID';
          throw error;
        }
        port.postMessage({ id, ok: true, data });
      } catch (error) {
        try {
          port.postMessage({ id, ok: false, error: error?.message || String(error), code: error?.code || '' });
        } catch (_) {}
      }
    };
    port.onMessage.addListener(handler);
  });
}
