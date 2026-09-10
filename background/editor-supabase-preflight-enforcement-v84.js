'use strict';

(() => {
  const SCHEMA = 'ld-editor-supabase-preflight-enforcement/1';
  const BUILD = 84;
  const CLIENT_VERSION = '2.6.84';
  const CLIENT_PROTOCOL = 'ld-runtime-bus/1';
  const BACKEND = 'https://kkzxxnfxgrouhkzyszxs.supabase.co/functions/v1';
  const TRUST_KEY = 'ld84_trust';
  const SHADOW_PREFIX = 'ld84_editor_shadow_';

  if (typeof ld84EditorBuild !== 'function' || typeof ld84EditorLoadShadow !== 'function') throw new Error('EDITOR_SUPABASE_PREFLIGHT_RUNTIME_REQUIRED');
  if (typeof ld84EditorCredentials !== 'function' || typeof ld84EditorGet !== 'function') throw new Error('EDITOR_SUPABASE_PREFLIGHT_CREDENTIAL_RUNTIME_REQUIRED');

  const baseBuild = ld84EditorBuild;

  async function post(endpoint, body, trustRequired = false) {
    if (typeof ensureTrust === 'function') await ensureTrust(false);
    const credentials = await ld84EditorCredentials();
    const headers = {
      'content-type': 'application/json',
      'x-license-key': credentials.licenseKey,
      'x-device-id': credentials.deviceId
    };
    if (trustRequired) {
      const stored = await ld84EditorGet([TRUST_KEY]);
      const trust = stored[TRUST_KEY] && typeof stored[TRUST_KEY] === 'object' ? stored[TRUST_KEY] : null;
      if (!trust?.token || !trust?.expiresAt || Date.parse(trust.expiresAt) <= Date.now() + 15000) throw new Error('EDITOR_TRUST_REQUIRED');
      headers['x-decrypter-trust'] = String(trust.token);
      headers['x-decrypter-client-version'] = CLIENT_VERSION;
      headers['x-decrypter-client-protocol'] = String(trust.protocol || CLIENT_PROTOCOL);
    }
    const response = await fetch(`${BACKEND}/${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.ok !== true) {
      const error = new Error(String(payload?.code || `EDITOR_PREFLIGHT_HTTP_${response.status}`));
      error.code = String(payload?.code || `EDITOR_PREFLIGHT_HTTP_${response.status}`);
      error.details = payload;
      throw error;
    }
    return payload;
  }

  async function validateShadow(shadow) {
    const projectRef = String(shadow?.supabaseProject || '').trim();
    const repository = String(shadow?.repository || '').trim();
    if (!projectRef) throw new Error('EDITOR_SUPABASE_BINDING_REQUIRED');
    if (!repository) throw new Error('EDITOR_REPOSITORY_BINDING_REQUIRED');

    const supabase = await post('ld-editor-supabase-apply', {
      action: 'status',
      project_ref: projectRef
    }, true);
    if (supabase.migration_api_ready !== true) throw new Error('EDITOR_SUPABASE_MIGRATION_API_NOT_READY');
    if (String(supabase.project_ref || '') !== projectRef) throw new Error('EDITOR_SUPABASE_PREFLIGHT_PROJECT_MISMATCH');
    if (supabase.selected_project_enforced !== true) throw new Error('EDITOR_SUPABASE_SELECTION_ENFORCEMENT_REQUIRED');

    const githubSelection = await post('ld-integration-selection', {
      action: 'get',
      integration: 'github'
    }, false);
    if (githubSelection.mode === 'selected') {
      const selected = Array.isArray(githubSelection.selected) ? githubSelection.selected.map(value => String(value || '').trim()) : [];
      if (!selected.includes(repository)) throw new Error('GITHUB_REPOSITORY_NOT_SELECTED');
    } else if (githubSelection.mode !== 'all') {
      throw new Error('EDITOR_GITHUB_SELECTION_STATE_INVALID');
    }

    return {
      schema: SCHEMA,
      build: BUILD,
      projectRef,
      repository,
      migrationApiReady: true,
      migrationHistoryCount: Number.isFinite(Number(supabase.migration_history_count)) ? Number(supabase.migration_history_count) : null,
      supabaseSelectionVerified: true,
      githubSelectionVerified: true,
      verifiedAt: new Date().toISOString()
    };
  }

  async function ld84EditorBuildWithResourcePreflight(message = {}) {
    const result = await baseBuild(message);
    if (result?.supabaseApplyRequired !== true) return result;
    const { key, shadow } = await ld84EditorLoadShadow(result.shadowId);
    try {
      const preflight = await validateShadow(shadow);
      return { ...result, supabasePreflight: preflight };
    } catch (error) {
      if (typeof ld84EditorRemove === 'function') await ld84EditorRemove([key], chrome.storage.session);
      throw error;
    }
  }

  ld84EditorBuild = ld84EditorBuildWithResourcePreflight;

  Object.defineProperty(globalThis, 'LovableDecrypterEditorSupabasePreflightV84', {
    value: Object.freeze({
      schema: SCHEMA,
      build: BUILD,
      migrationApiRequiredBeforeReview: true,
      selectedSupabaseProjectRequired: true,
      selectedGithubRepositoryRequired: true,
      failedPreflightDiscardsShadow: true,
      eventDriven: true
    }),
    configurable: false,
    enumerable: false,
    writable: false
  });
})();
