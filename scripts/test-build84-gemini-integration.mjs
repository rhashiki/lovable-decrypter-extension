import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = file => fs.readFileSync(file, 'utf8');
const json = file => JSON.parse(read(file));

const manifest = json('manifest.json');
const pkg = json('release/runtime-package.json');
const checkpoint = json('docs/checkpoints/build84-integrations-resource-management-validated.json');
const inventory = json('docs/functional-capabilities-v84.json');
const launcher = read('launcher/launcher-runtime.js');
const client = read('launcher/runtime-client-v84.js');
const account = read('launcher/account-controller-v84.js');
const editorUi = read('launcher/editor-direct-v84.js');
const polish = read('launcher/ux-polish-v84.js');
const resources = read('launcher/integration-resource-manager-v84.js');
const supabaseManagerUi = read('launcher/supabase-project-manager-v84.js');
const resourceEntries = read('launcher/integration-resource-entrypoints-v84.js');
const geminiUi = read('launcher/gemini-integration-v84.js');
const runtime = read('background/runtime-entry-v84.js');
const integrationRuntime = read('background/runtime-entry-v84-integrations.js');
const editorRuntime = read('background/editor-direct-runtime-v84.js');
const supabaseManagerRuntime = read('background/supabase-project-manager-runtime-v84.js');
const worker = read('background/build84-service-worker.js');
const supabaseManagerBackend = read('supabase/functions/ld-supabase-manager/index.ts');

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
assert.equal(checkpoint.browser_results.github_resource_manager_nested_once, true);
assert.equal(checkpoint.browser_results.supabase_resource_manager_nested_once, true);
assert.equal(checkpoint.browser_results.duplicate_resource_actions_removed, true);
assert.equal(checkpoint.browser_results.ram_stabilizes, true);

const byId = new Map(inventory.capabilities.map(item => [item.id, item]));
assert.equal(byId.get('integration.github-repository-management')?.status, 'validated');
assert.equal(byId.get('integration.supabase-project-selection')?.status, 'validated');
assert.equal(byId.get('integration.supabase-manager')?.status, 'reattached-unvalidated');
assert.equal(byId.get('integration.gemini')?.status, 'reattached-unvalidated');
assert.equal(byId.get('ui.editor-direct')?.status, 'reattached-unvalidated');

assert.ok(worker.includes("'editor-direct-runtime-v84.js'"));
assert.ok(worker.includes("'supabase-project-manager-runtime-v84.js'"));
assert.ok(worker.includes("mode: 'event-driven'"));
assert.ok(worker.includes('continuousPolling: false'));
assert.ok(editorRuntime.includes("importScripts('runtime-entry-v84-integrations.js')"), 'Editor Direct worker must preserve integration runtime chain');
assert.ok(editorUi.includes('Editor Direto'), 'Editor Direct UI must remain shipped');
assert.ok(resources.includes("type: 'ld84.integration.resources.status'"));
assert.ok(resources.includes("type: 'ld84.integration.resources.save'"));
assert.ok(resources.includes('Gerenciador Supabase'));
assert.ok(resources.includes('LovableDecrypterSupabaseManagerV84'));
assert.ok(resourceEntries.includes('function ensureSingleNestedEntry('));
assert.ok(!resourceEntries.includes('GitHub · Gerenciar repositórios'));
assert.ok(!resourceEntries.includes('Supabase · Gerenciar projetos'));

for (const text of ['Gerenciador Supabase','Testar acesso','Vincular ao Lovable','Criar projeto','Atualizar provisionamento']) {
  assert.ok(supabaseManagerUi.includes(text), `Supabase manager action missing: ${text}`);
}
assert.ok(supabaseManagerUi.includes('pode consumir quota ou gerar cobrança'));
assert.ok(supabaseManagerUi.includes("confirm: true"));
assert.ok(supabaseManagerUi.includes("type: 'ld84.supabase.manager.project-status'"));
assert.ok(supabaseManagerUi.includes('Não há polling'));
assert.ok(supabaseManagerUi.includes('senha do banco foi guardada no Vault'));

for (const type of [
  'ld84.supabase.manager.status',
  'ld84.supabase.manager.test',
  'ld84.supabase.manager.regions',
  'ld84.supabase.manager.bind',
  'ld84.supabase.manager.create',
  'ld84.supabase.manager.project-status'
]) assert.ok(supabaseManagerRuntime.includes(type), `Supabase manager runtime action missing: ${type}`);
assert.ok(supabaseManagerRuntime.includes("if (message.confirm !== true) throw new Error('PROJECT_CREATE_CONFIRMATION_REQUIRED')"));
assert.ok(supabaseManagerRuntime.includes("ld84SbmBackend('ld-supabase-manager', 'create_project'"));
assert.ok(supabaseManagerRuntime.includes("confirm: true"), 'background must propagate explicit confirmation to backend');
assert.ok(supabaseManagerRuntime.includes("ld84SbmBackend('ld-integration-selection', 'set'"));
assert.ok(supabaseManagerRuntime.includes("const LD84_SBM_BINDINGS_KEY = 'ld84_project_bindings'"));
assert.ok(supabaseManagerRuntime.includes('remoteDelete: false'));
assert.ok(supabaseManagerRuntime.includes('passwordReturnedToClient: false'));
assert.ok(supabaseManagerRuntime.includes("next: 'manual-project-status'"));
assert.ok(supabaseManagerRuntime.includes('selectionPending: !selectionUpdated'));
assert.ok(supabaseManagerRuntime.includes("next: ready ? (selectionUpdated ? 'test-or-bind' : 'manual-refresh-selection') : 'manual-refresh'"));
assert.ok(supabaseManagerRuntime.includes("await ld84SbmEnsureCreatedProjectSelected(ref).catch(() => false)"));

assert.ok(supabaseManagerBackend.includes('action === "create_project"'));
assert.ok(supabaseManagerBackend.includes('action === "project_status"'));
assert.ok(supabaseManagerBackend.includes('action === "project_test"'));
assert.ok(supabaseManagerBackend.includes('dbPassSecret(ref)'));
assert.ok(supabaseManagerBackend.includes('database_password_stored: true'));
assert.ok(!supabaseManagerBackend.includes('database_password: password'), 'database password must never be returned to browser');
assert.ok(!supabaseManagerBackend.includes('action === "delete_project"'), 'remote project deletion must not be exposed');

for (const text of ['Abrir módulo', 'Ver estado', 'Detalhes']) assert.ok(geminiUi.includes(text), `Gemini action missing: ${text}`);
for (const text of ['Atualizar modelos', 'Testar conexão', 'Salvar', 'Remover chave']) assert.ok(geminiUi.includes(text), `Gemini config action missing: ${text}`);
assert.ok(geminiUi.includes("shadow.addEventListener('click'"));
assert.ok(geminiUi.includes("}, true)"), 'Gemini action routing must use capture phase to avoid generic action races');
assert.ok(geminiUi.includes("type: 'ld84.gemini.status'"));
assert.ok(geminiUi.includes("type: 'ld84.gemini.models'"));
assert.ok(geminiUi.includes("type: 'ld84.gemini.save'"));
assert.ok(geminiUi.includes("type: 'ld84.gemini.clear'"));
assert.ok(geminiUi.includes('FREE ONLY'));
assert.ok(geminiUi.includes('não envia prompt ao Gemini'));
assert.ok(geminiUi.includes('IA local'));

assert.ok(integrationRuntime.includes("const LD84_GEMINI_CONFIG_KEY = 'ld84_gemini_config'"));
assert.ok(integrationRuntime.includes("const LD84_GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'"));
assert.ok(integrationRuntime.includes("headers: { 'x-goog-api-key': apiKey }"));
assert.ok(integrationRuntime.includes("validationMode: 'models-list-no-generation'"));
assert.ok(integrationRuntime.includes("centralOrchestrator: 'local-ai'"));
assert.ok(integrationRuntime.includes("automaticExecution: false"));
assert.ok(integrationRuntime.includes("bootActivation: false"));
assert.ok(integrationRuntime.includes("providerRole: 'optional'"));
assert.ok(integrationRuntime.includes("capability: 'integration.gemini'"));
assert.ok(integrationRuntime.includes("alg: 'AES-256-GCM'"));
assert.ok(!integrationRuntime.includes(':generateContent'), 'Gemini integration validation must not generate content');
assert.ok(!integrationRuntime.includes('/interactions'), 'Gemini integration validation must not generate interactions');

for (const [name, source] of Object.entries({
  launcher, client, account, editorUi, polish, resources, supabaseManagerUi, resourceEntries, geminiUi,
  runtime, integrationRuntime, editorRuntime, supabaseManagerRuntime, worker
})) {
  assert.ok(!/MutationObserver\s*\(/.test(source), `${name}: MutationObserver forbidden`);
  assert.ok(!/setInterval\s*\(/.test(source), `${name}: setInterval forbidden`);
  assert.ok(!/\.inert\s*=|setAttribute\(\s*['\"]inert/.test(source), `${name}: inert takeover forbidden`);
  assert.ok(!/XMLHttpRequest\.prototype\s*\.|window\.fetch\s*=|globalThis\.fetch\s*=|navigator\.sendBeacon\s*=/.test(source), `${name}: network monkeypatch forbidden`);
}
assert.ok(!geminiUi.includes('document.body'), 'Gemini UI must remain inside canonical launcher Shadow DOM');
assert.ok(!supabaseManagerUi.includes('document.body'), 'Supabase manager UI must remain inside canonical launcher Shadow DOM');
assert.ok(!integrationRuntime.includes('chrome.alarms'), 'integration runtime must remain event-driven');
assert.ok(!supabaseManagerRuntime.includes('chrome.alarms'), 'Supabase manager runtime must remain event-driven');

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
  'launcher/integration-resource-entrypoints-v84.js',
  'launcher/gemini-integration-v84.js',
  'background/runtime-entry-v84.js',
  'background/runtime-entry-v84-integrations.js',
  'background/editor-direct-runtime-v84.js',
  'background/supabase-project-manager-runtime-v84.js',
  'background/build84-service-worker.js'
]) assert.ok(packagePaths.has(required), `package path missing: ${required}`);

const manifestText = JSON.stringify(manifest);
for (const token of ['ui-mount-guardian','composer-guardian','composer-bridge-v3','decrypter-chat.js','approval-auto-repair','service-worker-entry.js','canonical-runtime-entry.js']) {
  assert.ok(!manifestText.includes(token), `legacy runtime leaked into manifest: ${token}`);
}

console.log(JSON.stringify({
  ok: true,
  schema: 'ld-build84-integration-refinement/3',
  version: manifest.version,
  integrationsCheckpoint: 'VALIDADO',
  gemini: 'reattached-unvalidated',
  supabaseProjectManager: {
    state: 'reattached-unvalidated',
    backend: 'ld-supabase-manager',
    eventDriven: true,
    createRequiresConfirmation: true,
    passwordExposure: false,
    remoteDelete: false,
    provisioning: 'manual-refresh',
    discoveryLag: 'tolerated-and-reconciled'
  },
  globalObservers: 0,
  continuousPolling: 0,
  heavyRuntimeAtBoot: 0,
  legacyDomStackShipped: false
}, null, 2));
