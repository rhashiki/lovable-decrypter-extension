'use strict';

const LD84_SBM_SCHEMA = 'ld-supabase-project-manager/1';
const LD84_SBM_BACKEND = 'https://kkzxxnfxgrouhkzyszxs.supabase.co/functions/v1';
const LD84_SBM_ACCOUNT_KEY = 'ld84_account';
const LD84_SBM_DEVICE_KEY = 'ld84_device_id';
const LD84_SBM_PROJECT_KEY = 'ld84_project_snapshot';
const LD84_SBM_BINDINGS_KEY = 'ld84_project_bindings';

function ld84SbmGet(keys) {
  return new Promise(resolve => chrome.storage.local.get(keys, value => resolve(value || {})));
}
function ld84SbmSet(value) {
  return new Promise(resolve => chrome.storage.local.set(value, () => resolve()));
}
function ld84SbmClean(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}
function ld84SbmSenderAllowed(sender) {
  const value = String(sender?.url || sender?.tab?.url || '');
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'chrome-extension:' || url.hostname === 'lovable.dev' || url.hostname.endsWith('.lovable.dev');
  } catch (_) {
    return false;
  }
}
async function ld84SbmCredentials() {
  const stored = await ld84SbmGet([LD84_SBM_ACCOUNT_KEY, LD84_SBM_DEVICE_KEY]);
  const account = stored[LD84_SBM_ACCOUNT_KEY] && typeof stored[LD84_SBM_ACCOUNT_KEY] === 'object' ? stored[LD84_SBM_ACCOUNT_KEY] : {};
  const licenseKey = ld84SbmClean(account.licenseKey, 5000);
  const deviceId = ld84SbmClean(stored[LD84_SBM_DEVICE_KEY], 300);
  if (account.active !== true || !licenseKey) throw new Error('ACCOUNT_NOT_ACTIVE');
  if (!deviceId) throw new Error('DEVICE_REQUIRED');
  return { licenseKey, deviceId };
}
async function ld84SbmBackend(endpoint, action, payload = {}) {
  const credentials = await ld84SbmCredentials();
  const response = await fetch(`${LD84_SBM_BACKEND}/${endpoint}`, {
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
async function ld84SbmSelection() {
  return ld84SbmBackend('ld-integration-selection', 'get', { integration: 'supabase' })
    .catch(() => ({ mode: 'all', selected: null }));
}
function ld84SbmAllowedProjects(projects, selection) {
  const list = Array.isArray(projects) ? projects : [];
  if (selection?.mode === 'all' || selection?.selected === null) return list;
  const allowed = new Set((Array.isArray(selection?.selected) ? selection.selected : []).map(String));
  return list.filter(project => allowed.has(String(project?.ref || '')));
}
async function ld84SbmProjectContext() {
  const stored = await ld84SbmGet([LD84_SBM_PROJECT_KEY, LD84_SBM_BINDINGS_KEY]);
  const project = stored[LD84_SBM_PROJECT_KEY] && typeof stored[LD84_SBM_PROJECT_KEY] === 'object' ? stored[LD84_SBM_PROJECT_KEY] : null;
  const projectId = ld84SbmClean(project?.projectId, 120);
  const bindings = stored[LD84_SBM_BINDINGS_KEY] && typeof stored[LD84_SBM_BINDINGS_KEY] === 'object' ? stored[LD84_SBM_BINDINGS_KEY] : {};
  const binding = projectId && bindings[projectId] && typeof bindings[projectId] === 'object' ? bindings[projectId] : null;
  return { project, projectId, bindings, binding };
}
async function ld84SbmStatus() {
  const [manager, selection, context] = await Promise.all([
    ld84SbmBackend('ld-supabase-manager', 'status'),
    ld84SbmSelection(),
    ld84SbmProjectContext()
  ]);
  const allProjects = Array.isArray(manager?.projects) ? manager.projects : [];
  const projects = ld84SbmAllowedProjects(allProjects, selection).map(project => ({
    ref: String(project?.ref || ''),
    name: String(project?.name || project?.ref || ''),
    region: String(project?.region || ''),
    status: String(project?.status || ''),
    organizationSlug: String(project?.organization_slug || ''),
    url: String(project?.url || '')
  })).filter(project => project.ref);
  const organizations = (Array.isArray(manager?.organizations) ? manager.organizations : []).map(org => ({
    id: String(org?.id || ''),
    slug: String(org?.slug || ''),
    name: String(org?.name || org?.slug || '')
  })).filter(org => org.slug);
  return {
    ok: true,
    schema: LD84_SBM_SCHEMA,
    connected: manager?.connected === true,
    projectId: context.projectId,
    binding: context.binding || null,
    projects,
    allProjectCount: allProjects.length,
    selectedProjectCount: projects.length,
    organizations,
    reauthorizeRequired: manager?.reauthorize_required === true,
    missingScopes: Array.isArray(manager?.missing_scopes) ? manager.missing_scopes : [],
    profile: manager?.profile || null,
    policy: {
      eventDriven: true,
      continuousPolling: false,
      remoteDelete: false,
      createRequiresExplicitConfirmation: true,
      passwordReturnedToClient: false
    }
  };
}
async function ld84SbmValidateSelectedRef(ref) {
  const status = await ld84SbmStatus();
  const project = status.projects.find(item => item.ref === ref);
  if (!project) throw new Error('SUPABASE_PROJECT_NOT_SELECTED');
  return { status, project };
}
async function ld84SbmBind(message = {}) {
  const ref = ld84SbmClean(message.projectRef, 120);
  if (!ref) throw new Error('SUPABASE_PROJECT_REQUIRED');
  await ld84SbmEnsureCreatedProjectSelected(ref).catch(() => false);
  const { status, project } = await ld84SbmValidateSelectedRef(ref);
  const projectId = ld84SbmClean(message.projectId || status.projectId, 120);
  if (!projectId) throw new Error('LOVABLE_PROJECT_ID_REQUIRED');
  const stored = await ld84SbmGet([LD84_SBM_BINDINGS_KEY]);
  const bindings = stored[LD84_SBM_BINDINGS_KEY] && typeof stored[LD84_SBM_BINDINGS_KEY] === 'object' ? stored[LD84_SBM_BINDINGS_KEY] : {};
  const current = bindings[projectId] && typeof bindings[projectId] === 'object' ? bindings[projectId] : {};
  bindings[projectId] = {
    ...current,
    supabaseProject: project.ref,
    supabaseProjectName: project.name,
    supabaseRegion: project.region,
    updatedAt: new Date().toISOString()
  };
  await ld84SbmSet({ [LD84_SBM_BINDINGS_KEY]: bindings });
  return { ok: true, schema: LD84_SBM_SCHEMA, projectId, binding: bindings[projectId] };
}
async function ld84SbmTest(message = {}) {
  const ref = ld84SbmClean(message.projectRef, 120);
  if (!ref) throw new Error('SUPABASE_PROJECT_REQUIRED');
  await ld84SbmEnsureCreatedProjectSelected(ref).catch(() => false);
  const { project } = await ld84SbmValidateSelectedRef(ref);
  const tested = await ld84SbmBackend('ld-supabase-manager', 'project_test', { project_ref: project.ref });
  return {
    ok: true,
    schema: LD84_SBM_SCHEMA,
    project,
    databaseAccess: tested?.database_access === true,
    testedAt: new Date().toISOString()
  };
}
async function ld84SbmRegions(message = {}) {
  const organizationSlug = ld84SbmClean(message.organizationSlug, 100);
  if (!organizationSlug) throw new Error('ORGANIZATION_REQUIRED');
  const status = await ld84SbmStatus();
  if (!status.organizations.some(org => org.slug === organizationSlug)) throw new Error('ORGANIZATION_NOT_AUTHORIZED');
  const result = await ld84SbmBackend('ld-supabase-manager', 'regions', { organization_slug: organizationSlug });
  return { ok: true, schema: LD84_SBM_SCHEMA, organizationSlug, regions: result?.regions || null };
}
async function ld84SbmEnsureCreatedProjectSelected(ref) {
  const selection = await ld84SbmSelection();
  if (selection?.mode === 'all' || selection?.selected === null) return true;
  const selected = [...new Set([...(Array.isArray(selection?.selected) ? selection.selected.map(String) : []), ref])];
  await ld84SbmBackend('ld-integration-selection', 'set', { integration: 'supabase', mode: 'selected', selected });
  return true;
}
async function ld84SbmCreate(message = {}) {
  if (message.confirm !== true) throw new Error('PROJECT_CREATE_CONFIRMATION_REQUIRED');
  const name = ld84SbmClean(message.name, 80);
  const organizationSlug = ld84SbmClean(message.organizationSlug, 100);
  const regionType = ld84SbmClean(message.regionType || 'smartGroup', 30);
  const regionCode = ld84SbmClean(message.regionCode, 50);
  if (name.length < 2) throw new Error('PROJECT_NAME_INVALID');
  if (!organizationSlug) throw new Error('ORGANIZATION_REQUIRED');
  const status = await ld84SbmStatus();
  if (!status.organizations.some(org => org.slug === organizationSlug)) throw new Error('ORGANIZATION_NOT_AUTHORIZED');
  if (regionCode && !['smartGroup', 'specific'].includes(regionType)) throw new Error('REGION_TYPE_INVALID');
  const created = await ld84SbmBackend('ld-supabase-manager', 'create_project', {
    confirm: true,
    name,
    organization_slug: organizationSlug,
    region_type: regionType,
    region_code: regionCode
  });
  const ref = ld84SbmClean(created?.project?.ref, 120);
  if (!ref) throw new Error('PROJECT_CREATE_RESPONSE_INVALID');
  let selectionUpdated = false;
  try { selectionUpdated = await ld84SbmEnsureCreatedProjectSelected(ref); } catch (_) {}
  return {
    ok: true,
    schema: LD84_SBM_SCHEMA,
    project: created.project,
    databasePasswordStored: created?.database_password_stored === true,
    selectionUpdated,
    selectionPending: !selectionUpdated,
    next: 'manual-project-status',
    continuousPolling: false
  };
}
async function ld84SbmProjectStatus(message = {}) {
  const ref = ld84SbmClean(message.projectRef, 120);
  if (!ref) throw new Error('SUPABASE_PROJECT_REQUIRED');
  const result = await ld84SbmBackend('ld-supabase-manager', 'project_status', { project_ref: ref });
  const project = result?.project || {};
  const status = String(project?.status || '').toUpperCase();
  const healthText = JSON.stringify(result?.health || {}).toUpperCase();
  const ready = status === 'ACTIVE_HEALTHY' || /ACTIVE_HEALTHY/.test(healthText);
  let selectionUpdated = false;
  if (ready) {
    try { selectionUpdated = await ld84SbmEnsureCreatedProjectSelected(ref); } catch (_) {}
  }
  return {
    ok: true,
    schema: LD84_SBM_SCHEMA,
    project,
    health: result?.health || null,
    ready,
    selectionUpdated,
    selectionPending: ready && !selectionUpdated,
    checkedAt: new Date().toISOString(),
    next: ready ? (selectionUpdated ? 'test-or-bind' : 'manual-refresh-selection') : 'manual-refresh'
  };
}
async function ld84SbmResponse(message = {}) {
  const type = String(message?.type || '');
  if (type === 'ld84.supabase.manager.status') return ld84SbmStatus();
  if (type === 'ld84.supabase.manager.test') return ld84SbmTest(message);
  if (type === 'ld84.supabase.manager.regions') return ld84SbmRegions(message);
  if (type === 'ld84.supabase.manager.bind') return ld84SbmBind(message);
  if (type === 'ld84.supabase.manager.create') return ld84SbmCreate(message);
  if (type === 'ld84.supabase.manager.project-status') return ld84SbmProjectStatus(message);
  return null;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const type = String(message?.type || '');
  if (!type.startsWith('ld84.supabase.manager.')) return;
  if (!ld84SbmSenderAllowed(sender)) {
    sendResponse({ ok: false, code: 'SENDER_NOT_ALLOWED' });
    return false;
  }
  Promise.resolve(ld84SbmResponse(message)).then(response => {
    if (response) sendResponse(response);
  }).catch(error => sendResponse({
    ok: false,
    code: String(error?.code || error?.message || 'SUPABASE_MANAGER_RUNTIME_FAILED'),
    message: String(error?.message || error || 'SUPABASE_MANAGER_RUNTIME_FAILED')
  }));
  return true;
});

Object.defineProperty(globalThis, 'LovableDecrypterSupabaseProjectManagerV84', {
  value: Object.freeze({
    schema: LD84_SBM_SCHEMA,
    mode: 'event-driven',
    continuousPolling: false,
    remoteDelete: false,
    explicitCreateConfirmation: true,
    passwordReturnedToClient: false
  }),
  configurable: false,
  enumerable: false,
  writable: false
});
