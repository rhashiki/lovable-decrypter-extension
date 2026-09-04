import { DEFAULT_BACKEND_BASE } from '../settings/config.js';
import { getSettings } from '../storage/settings-store.js';
import { GitAdapter } from '../github/git-adapter.js';

const PORT_NAME = 'ld2-project-state';
const REQUEST_TIMEOUT_MS = 60000;

function cleanText(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

async function inspectProjectState(payload = {}) {
  const settings = await getSettings();
  const licenseKey = String(settings.auth?.licenseKey || '').trim();
  const deviceId = String(settings.auth?.deviceId || '').trim();
  const projectRef = String(payload.project_ref || '').trim();

  if (!licenseKey) throw new Error('Faça login com sua KEY antes de inspecionar o projeto.');
  if (!deviceId) throw new Error('Dispositivo não vinculado. Faça login novamente.');
  if (!/^[a-z0-9]{8,32}$/i.test(projectRef)) throw new Error('PROJECT_REF_INVALID');

  const base = String(settings.auth?.backendBase || DEFAULT_BACKEND_BASE).replace(/\/+$/, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${base}/ld-project-state`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-license-key': licenseKey,
        'x-device-id': deviceId
      },
      body: JSON.stringify({ action: 'inspect', project_ref: projectRef })
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.ok) {
      const code = body?.code || `HTTP_${response.status}`;
      const error = new Error(`Project State: ${code}`);
      error.code = code;
      throw error;
    }
    return body.state || body;
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('A inspeção do estado do projeto excedeu o tempo limite.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function projectMappings(settings, projectId) {
  const githubMapping = projectId ? settings.projectMappings?.[projectId] || null : null;
  const supabaseMapping = projectId ? settings.supabaseMappings?.[projectId] || null : null;
  const github = {
    ...(settings.github || {}),
    ...(githubMapping || {})
  };
  const supabase = {
    ...(settings.supabase || {}),
    ...(supabaseMapping || {})
  };
  return { githubMapping, supabaseMapping, github, supabase };
}

async function inspectGithub(github = {}) {
  const owner = cleanText(github.owner, 160);
  const repo = cleanText(github.repo, 200);
  const branch = cleanText(github.branch || 'main', 200) || 'main';
  const configured = Boolean(owner && repo);
  const base = {
    configured,
    authMode: github.authMode === 'legacy_token' ? 'legacy_token' : 'github_app',
    owner,
    repo,
    fullName: configured ? `${owner}/${repo}` : '',
    branch,
    installationId: Number(github.installationId || 0) || null,
    headSha: '',
    reachable: false,
    error: ''
  };
  if (!configured) return base;
  try {
    const adapter = new GitAdapter(github);
    const ref = await adapter.getRef(branch);
    return {
      ...base,
      headSha: cleanText(ref?.object?.sha, 80),
      reachable: Boolean(ref?.object?.sha)
    };
  } catch (error) {
    return { ...base, error: cleanText(error?.message || error, 300) };
  }
}

async function inspectSupabase(supabase = {}) {
  const projectRef = cleanText(supabase.projectRef, 80);
  const base = {
    configured: Boolean(projectRef),
    authMode: 'oauth',
    projectRef,
    projectName: cleanText(supabase.projectName, 240),
    organizationSlug: cleanText(supabase.organizationSlug, 240),
    reachable: false,
    inspected: false,
    state: null,
    error: ''
  };
  if (!projectRef) return base;
  try {
    const state = await inspectProjectState({ project_ref: projectRef });
    return { ...base, reachable: true, inspected: true, state };
  } catch (error) {
    return { ...base, inspected: true, error: cleanText(error?.message || error, 300) };
  }
}

function sanitizeState(value, depth = 0) {
  if (depth > 8) return null;
  if (Array.isArray(value)) return value.slice(0, 250).map(item => sanitizeState(item, depth + 1));
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (/token|secret|password|service[_-]?role|api[_-]?key|credential/i.test(key)) continue;
    out[cleanText(key, 120)] = sanitizeState(item, depth + 1);
  }
  return out;
}

async function canonicalSnapshot(payload = {}) {
  const settings = await getSettings();
  const projectId = cleanText(payload.projectId, 100);
  const url = cleanText(payload.url, 1200);
  const mappings = projectMappings(settings, projectId);
  const [github, supabase] = await Promise.all([
    inspectGithub(mappings.github),
    inspectSupabase(mappings.supabase)
  ]);

  const readiness = {
    projectDetected: Boolean(projectId),
    githubMapped: Boolean(mappings.githubMapping?.owner && mappings.githubMapping?.repo),
    githubReachable: github.reachable,
    supabaseMapped: Boolean(mappings.supabaseMapping?.projectRef),
    supabaseReachable: supabase.reachable
  };

  return {
    schema: 'ld-canonical-project-state/1',
    collectedAt: new Date().toISOString(),
    project: {
      id: projectId,
      detected: Boolean(projectId),
      url
    },
    mappings: {
      github: mappings.githubMapping ? {
        owner: cleanText(mappings.githubMapping.owner, 160),
        repo: cleanText(mappings.githubMapping.repo, 200),
        branch: cleanText(mappings.githubMapping.branch || 'main', 200)
      } : null,
      supabase: mappings.supabaseMapping ? {
        projectRef: cleanText(mappings.supabaseMapping.projectRef, 80),
        projectName: cleanText(mappings.supabaseMapping.projectName, 240)
      } : null
    },
    github,
    supabase: { ...supabase, state: sanitizeState(supabase.state) },
    readiness,
    ready: readiness.projectDetected && readiness.githubMapped && readiness.githubReachable && readiness.supabaseMapped && readiness.supabaseReachable
  };
}

export function installProjectStateRuntime() {
  if (globalThis.__LD2_PROJECT_STATE_RUNTIME__) return;
  globalThis.__LD2_PROJECT_STATE_RUNTIME__ = true;

  chrome.runtime.onConnect.addListener(port => {
    if (port.name !== PORT_NAME) return;
    const handler = async message => {
      const id = String(message?.id || '');
      try {
        const action = String(message?.action || '');
        let data;
        if (action === 'inspect') data = await inspectProjectState(message?.payload || {});
        else if (action === 'canonical_snapshot') data = await canonicalSnapshot(message?.payload || {});
        else throw new Error('PROJECT_STATE_ACTION_INVALID');
        port.postMessage({ id, ok: true, data });
      } catch (error) {
        try {
          port.postMessage({
            id,
            ok: false,
            error: error?.message || String(error),
            code: error?.code || ''
          });
        } catch (_) {}
      }
    };
    port.onMessage.addListener(handler);
  });
}
