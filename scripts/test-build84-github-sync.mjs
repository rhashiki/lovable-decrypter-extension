import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = file => fs.readFileSync(file, 'utf8');
const json = file => JSON.parse(read(file));

const manifest = json('manifest.json');
const pkg = json('release/runtime-package.json');
const inventory = json('docs/functional-capabilities-v84.json');
const checkpoint = json('docs/checkpoints/build84-integrations-resource-management-validated.json');

const launcher = read('launcher/launcher-runtime.js');
const client = read('launcher/runtime-client-v84.js');
const account = read('launcher/account-controller-v84.js');
const editorUi = read('launcher/editor-direct-v84.js');
const polish = read('launcher/ux-polish-v84.js');
const resources = read('launcher/integration-resource-manager-v84.js');
const supabaseManagerUi = read('launcher/supabase-project-manager-v84.js');
const githubSyncUi = read('launcher/github-sync-v84.js');
const resourceEntries = read('launcher/integration-resource-entrypoints-v84.js');
const geminiUi = read('launcher/gemini-integration-v84.js');
const runtime = read('background/runtime-entry-v84.js');
const integrationRuntime = read('background/runtime-entry-v84-integrations.js');
const editorRuntime = read('background/editor-direct-runtime-v84.js');
const supabaseManagerRuntime = read('background/supabase-project-manager-runtime-v84.js');
const githubSyncRuntime = read('background/github-sync-runtime-v84.js');
const worker = read('background/build84-service-worker.js');

assert.equal(manifest.version, '2.6.84');
assert.equal(manifest.background?.service_worker, 'background/build84-service-worker.js');
assert.deepEqual(manifest.permissions || [], ['storage']);
for (const permission of [
  'https://lovable.dev/*',
  'https://*.lovable.dev/*',
  'https://kkzxxnfxgrouhkzyszxs.supabase.co/*',
  'https://api.github.com/*',
  'https://generativelanguage.googleapis.com/*',
  'http://127.0.0.1:8000/*',
  'http://localhost:8000/*'
]) assert.ok((manifest.host_permissions || []).includes(permission), `missing host permission: ${permission}`);

const app = (manifest.content_scripts || []).find(item => Array.isArray(item.js) && item.js.includes('launcher/launcher-runtime.js'));
assert.ok(app, 'canonical launcher content script missing');
assert.deepEqual(app.js, [
  'launcher/launcher-runtime.js',
  'launcher/runtime-client-v84.js',
  'launcher/account-controller-v84.js',
  'launcher/editor-direct-v84.js',
  'launcher/ux-polish-v84.js',
  'launcher/integration-resource-manager-v84.js',
  'launcher/supabase-project-manager-v84.js',
  'launcher/github-sync-v84.js',
  'launcher/integration-resource-entrypoints-v84.js',
  'launcher/gemini-integration-v84.js'
]);
assert.equal(app.run_at, 'document_start');
assert.equal(app.all_frames, false);

assert.equal(checkpoint.status, 'VALIDADO');
assert.equal(checkpoint.validation, 'real-browser');
for (const capability of [
  'integration.github',
  'integration.github-repository-management',
  'integration.supabase',
  'integration.supabase-project-selection',
  'project.state',
  'ui.monitor-state'
]) assert.ok(checkpoint.validated_capabilities.includes(capability), `validated checkpoint missing ${capability}`);
assert.equal(checkpoint.browser_results.ram_stabilizes, true);
assert.equal(checkpoint.browser_results.github_resource_manager_nested_once, true);
assert.equal(checkpoint.browser_results.supabase_resource_manager_nested_once, true);

const byId = new Map(inventory.capabilities.map(item => [item.id, item]));
assert.equal(byId.get('integration.github-repository-management')?.status, 'validated');
assert.equal(byId.get('integration.supabase-project-selection')?.status, 'validated');
assert.equal(byId.get('integration.github-sync')?.status, 'reattached-unvalidated');
assert.equal(byId.get('project.history')?.status, 'reattached-unvalidated');
assert.equal(byId.get('integration.supabase-manager')?.status, 'reattached-unvalidated');
assert.equal(byId.get('integration.gemini')?.status, 'reattached-unvalidated');
assert.equal(byId.get('ui.editor-direct')?.status, 'reattached-unvalidated');
assert.equal(byId.get('integration.github-sync')?.target_authority, 'background/github-sync-runtime-v84');
assert.equal(byId.get('project.history')?.target_authority, 'background/github-sync-runtime-v84');

assert.ok(worker.includes("'editor-direct-runtime-v84.js'"));
assert.ok(worker.includes("'supabase-project-manager-runtime-v84.js'"));
assert.ok(worker.includes("'github-sync-runtime-v84.js'"));
assert.ok(worker.includes('githubSyncHistory: true'));
assert.ok(worker.includes("mode: 'event-driven'"));
assert.ok(worker.includes('continuousPolling: false'));

assert.ok(launcher.includes("['git-history','Git history','branch']"), 'launcher must preserve canonical Git history module');
assert.ok(resources.includes('GitHub Sync & History'));
assert.ok(resources.includes('LovableDecrypterGithubSyncV84'));
assert.ok(resources.includes('Gerenciador Supabase'));
assert.ok(resourceEntries.includes('function ensureSingleNestedEntry('));
assert.ok(!resourceEntries.includes('GitHub · Gerenciar repositórios'));
assert.ok(!resourceEntries.includes('Supabase · Gerenciar projetos'));

for (const text of [
  'GitHub Sync & History',
  'GitHub como source of truth',
  'Sincronizar estado',
  'Ver histórico',
  'Comparar',
  'Apply explícito do Editor Direto'
]) assert.ok(githubSyncUi.includes(text), `GitHub Sync UI contract missing: ${text}`);
for (const type of [
  'ld84.github.sync.status',
  'ld84.github.sync.refresh',
  'ld84.github.sync.history',
  'ld84.github.sync.compare'
]) assert.ok(githubSyncUi.includes(type), `GitHub Sync UI action missing: ${type}`);
assert.ok(githubSyncUi.includes("detail.dataset.module !== 'git-history'"));
assert.ok(githubSyncUi.includes("shadow.addEventListener('click'"));
assert.ok(githubSyncUi.includes("}, true)"), 'GitHub Sync action routing must use capture phase');
assert.ok(!githubSyncUi.includes('document.body'), 'GitHub Sync UI must remain inside canonical Shadow DOM');

for (const type of [
  'ld84.github.sync.status',
  'ld84.github.sync.refresh',
  'ld84.github.sync.history',
  'ld84.github.sync.compare'
]) assert.ok(githubSyncRuntime.includes(type), `GitHub Sync runtime action missing: ${type}`);
for (const code of [
  'LOVABLE_PROJECT_ID_REQUIRED',
  'GITHUB_PROJECT_BINDING_REQUIRED',
  'GITHUB_REPOSITORY_NOT_AUTHORIZED',
  'GITHUB_REPOSITORY_NOT_SELECTED',
  'GITHUB_INSTALLATION_TOKEN_REQUIRED'
]) assert.ok(githubSyncRuntime.includes(code), `GitHub Sync fail-closed code missing: ${code}`);
assert.ok(githubSyncRuntime.includes("ld84GhsBackend('ld-github-app', 'token')"));
assert.ok(githubSyncRuntime.includes("const LD84_GHS_STATE_KEY = 'ld84_github_sync_state'"));
assert.ok(githubSyncRuntime.includes("bindingAuthority: 'explicit-project-binding'"));
assert.ok(githubSyncRuntime.includes("authority: 'github'"));
assert.ok(githubSyncRuntime.includes('historyReadOnly: true'));
assert.ok(githubSyncRuntime.includes('compareReadOnly: true'));
assert.ok(githubSyncRuntime.includes("writeAuthority: 'editor-direct-explicit-apply'"));
assert.ok(githubSyncRuntime.includes('forcePush: false'));
assert.ok(githubSyncRuntime.includes('directLovableWrite: false'));
assert.ok(githubSyncRuntime.includes('continuousPolling: false'));
assert.ok(githubSyncRuntime.includes('/compare/${encodeURIComponent(from)}...${encodeURIComponent(to)}'));
assert.ok(githubSyncRuntime.includes('/commits?${query}'));
assert.ok(!githubSyncRuntime.includes("method: 'PATCH'"), 'GitHub Sync/history must not mutate refs');
assert.ok(!githubSyncRuntime.includes("method: 'DELETE'"), 'GitHub Sync/history must not delete GitHub resources');
assert.ok(!githubSyncRuntime.includes('/git/'), 'GitHub Sync/history must not use Git data write endpoints');
assert.ok(!githubSyncRuntime.includes('/contents/'), 'GitHub Sync/history must not use contents write endpoints');
assert.ok(!githubSyncRuntime.includes('/pulls'), 'GitHub Sync/history must not create or mutate pull requests');

assert.ok(editorRuntime.includes("importScripts('runtime-entry-v84-integrations.js')"));
assert.ok(editorRuntime.includes("method: 'PATCH'"), 'Editor Direct remains the explicit GitHub apply path');
assert.ok(editorRuntime.includes('force: false'), 'Editor Direct apply must remain non-force');
assert.ok(editorUi.includes('Editor Direto'));
assert.ok(supabaseManagerUi.includes('Gerenciador Supabase'));
assert.ok(supabaseManagerRuntime.includes("if (message.confirm !== true) throw new Error('PROJECT_CREATE_CONFIRMATION_REQUIRED')"));
assert.ok(geminiUi.includes('FREE ONLY'));
assert.ok(integrationRuntime.includes("centralOrchestrator: 'local-ai'"));
assert.ok(!integrationRuntime.includes(':generateContent'));

for (const [name, source] of Object.entries({
  launcher, client, account, editorUi, polish, resources, supabaseManagerUi, githubSyncUi, resourceEntries, geminiUi,
  runtime, integrationRuntime, editorRuntime, supabaseManagerRuntime, githubSyncRuntime, worker
})) {
  assert.ok(!/MutationObserver\s*\(/.test(source), `${name}: MutationObserver forbidden`);
  assert.ok(!/setInterval\s*\(/.test(source), `${name}: setInterval forbidden`);
  assert.ok(!/\.inert\s*=|setAttribute\(\s*['\"]inert/.test(source), `${name}: inert takeover forbidden`);
  assert.ok(!/XMLHttpRequest\.prototype\s*\.|window\.fetch\s*=|globalThis\.fetch\s*=|navigator\.sendBeacon\s*=/.test(source), `${name}: network monkeypatch forbidden`);
}
assert.ok(!githubSyncRuntime.includes('chrome.alarms'), 'GitHub Sync runtime must remain event-driven');
assert.ok(!supabaseManagerRuntime.includes('chrome.alarms'), 'Supabase manager runtime must remain event-driven');
assert.ok(!integrationRuntime.includes('chrome.alarms'), 'integration runtime must remain event-driven');

const packagePaths = new Set(pkg.paths || []);
for (const required of [
  'manifest.json',
  'assets',
  'launcher/launcher-runtime.js',
  'launcher/runtime-client-v84.js',
  'launcher/account-controller-v84.js',
  'launcher/editor-direct-v84.js',
  'launcher/ux-polish-v84.js',
  'launcher/integration-resource-manager-v84.js',
  'launcher/supabase-project-manager-v84.js',
  'launcher/github-sync-v84.js',
  'launcher/integration-resource-entrypoints-v84.js',
  'launcher/gemini-integration-v84.js',
  'background/runtime-entry-v84.js',
  'background/runtime-entry-v84-integrations.js',
  'background/editor-direct-runtime-v84.js',
  'background/supabase-project-manager-runtime-v84.js',
  'background/github-sync-runtime-v84.js',
  'background/build84-service-worker.js'
]) assert.ok(packagePaths.has(required), `package path missing: ${required}`);

const manifestText = JSON.stringify(manifest);
for (const token of [
  'ui-mount-guardian', 'composer-guardian', 'composer-bridge-v3', 'decrypter-chat.js',
  'approval-auto-repair', 'service-worker-entry.js', 'canonical-runtime-entry.js'
]) assert.ok(!manifestText.includes(token), `legacy runtime leaked into manifest: ${token}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'ld-build84-github-sync/1',
  version: manifest.version,
  validatedCheckpointPreserved: true,
  githubSync: {
    state: 'reattached-unvalidated',
    authority: 'github',
    bindingAuthority: 'explicit-project-binding',
    operations: ['status','refresh-head','history','compare'],
    writes: false,
    writeAuthority: 'editor-direct-explicit-apply',
    forcePush: false,
    continuousPolling: false
  },
  globalObservers: 0,
  continuousPolling: 0,
  heavyRuntimeAtBoot: 0,
  legacyDomStackShipped: false
}, null, 2));
