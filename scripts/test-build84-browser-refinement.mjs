import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = file => fs.readFileSync(file, 'utf8');
const json = file => JSON.parse(read(file));
const manifest = json('manifest.json');
const pkg = json('release/runtime-package.json');
const checkpoint = json('docs/checkpoints/build84-integrations-resource-management-validated.json');

const sources = {
  ux: read('launcher/ux-polish-v84-3.js'),
  editor: read('launcher/editor-direct-authority-v84.js'),
  resources: read('launcher/integration-resource-manager-v84-3.js'),
  supabase: read('launcher/supabase-project-manager-v84-2.js'),
  autoBinding: read('launcher/project-auto-binding-v84.js'),
  githubSync: read('launcher/github-sync-v84-3.js'),
  entrypoints: read('launcher/integration-resource-entrypoints-v84.js'),
  gemini: read('launcher/gemini-integration-v84-2.js'),
  feedback: read('launcher/operation-feedback-v84.js'),
  editorRuntime: read('background/editor-direct-runtime-v84.js'),
  supabaseRuntime: read('background/supabase-project-manager-runtime-v84.js'),
  renameRuntime: read('background/supabase-project-rename-runtime-v84.js'),
  githubRuntime: read('background/github-sync-runtime-v84.js'),
  geminiRuntime: read('background/gemini-provider-runtime-v84.js'),
  integrationsRuntime: read('background/runtime-entry-v84-integrations.js'),
  worker: read('background/build84-service-worker.js')
};

assert.equal(manifest.version, '2.6.84');
assert.equal(manifest.background?.service_worker, 'background/build84-service-worker.js');
assert.deepEqual(manifest.permissions || [], ['storage']);

const app = (manifest.content_scripts || []).find(item => Array.isArray(item.js) && item.js.includes('launcher/launcher-runtime.js'));
assert.ok(app, 'canonical launcher missing');
const expectedLauncher = [
  'launcher/launcher-runtime.js',
  'launcher/runtime-client-v84.js',
  'launcher/account-controller-v84.js',
  'launcher/ux-polish-v84-3.js',
  'launcher/editor-direct-authority-v84.js',
  'launcher/integration-resource-manager-v84-3.js',
  'launcher/supabase-project-manager-v84-2.js',
  'launcher/project-auto-binding-v84.js',
  'launcher/github-sync-v84-3.js',
  'launcher/integration-resource-entrypoints-v84.js',
  'launcher/gemini-integration-v84-2.js',
  'launcher/operation-feedback-v84.js'
];
assert.deepEqual(app.js, expectedLauncher);
assert.equal(app.run_at, 'document_start');
assert.equal(app.all_frames, false);

for (const forbidden of [
  'ui/ui.js', 'ui/matrix.css', 'content/decrypter-chat.js',
  'launcher/ux-polish-v84.js', 'launcher/ux-polish-v84-2.js',
  'launcher/editor-direct-v84.js',
  'launcher/integration-resource-manager-v84.js', 'launcher/integration-resource-manager-v84-2.js',
  'launcher/supabase-project-manager-v84.js',
  'launcher/github-sync-v84.js',
  'launcher/gemini-integration-v84.js'
]) assert.ok(!app.js.includes(forbidden), `legacy UI still shipped: ${forbidden}`);

assert.equal(checkpoint.status, 'VALIDADO');
assert.equal(checkpoint.validation, 'real-browser');
assert.equal(checkpoint.browser_results.ram_stabilizes, true);
assert.equal(checkpoint.browser_results.github_resource_manager_nested_once, true);
assert.equal(checkpoint.browser_results.supabase_resource_manager_nested_once, true);

// Canonical launcher / UX refinements.
assert.ok(sources.ux.includes("button.dataset.ldEditorDirect = 'true'"));
assert.ok(sources.ux.includes('clicking the already-active rail icon closes its open menu'));
assert.ok(sources.ux.includes('width:58px!important'));
assert.ok(sources.ux.includes('width:52px!important'));
assert.ok(sources.ux.includes('width:34px!important'));

// Editor Direct remains the unique write authority.
assert.ok(sources.editor.includes('[data-ld-parity="editor-direct"], [data-ld-editor-direct]'));
assert.ok(sources.editor.includes('delete control.dataset.ldParity'));
for (const type of ['ld84.editor.resources','ld84.editor.bind','ld84.editor.configure','ld84.editor.health','ld84.editor.plan','ld84.editor.build','ld84.editor.apply']) {
  assert.ok(sources.editor.includes(type), `Editor Direct action missing: ${type}`);
}
assert.ok(sources.editorRuntime.includes("const LD84_EDITOR_BINDINGS_KEY = 'ld84_project_bindings'"));
assert.ok(sources.editorRuntime.includes("method: 'PATCH'"), 'explicit Apply path must remain present');
assert.ok(sources.editorRuntime.includes('force: false'), 'Apply remains non-force');

// Resource management remains explicit and bounded.
assert.ok(sources.resources.includes('function resourceStatus(integration)'));
assert.ok(sources.resources.includes('transientDB(result)'));
assert.ok(sources.resources.includes("code === 'DB_ERROR'"));
assert.ok(sources.resources.includes('Tentar novamente'));
assert.ok(sources.resources.includes('GitHub Sync & History'));
assert.ok(sources.resources.includes('Gerenciador Supabase'));
assert.ok(sources.resources.includes("LovableDecrypterAutoBindingV84?.ensure?.({ source:'resource-save' })"));
assert.ok(sources.entrypoints.includes('function ensureSingleNestedEntry('));

// Auto-binding is conservative: existing binding, unique/strong name match, no deselection of other resources.
assert.ok(sources.autoBinding.includes("reason: 'existing-binding'"));
assert.ok(sources.autoBinding.includes("reason: 'single-authorized-resource'"));
assert.ok(sources.autoBinding.includes("reason: 'strong-name-match'"));
assert.ok(sources.autoBinding.includes("code: 'AUTO_BIND_GITHUB_AMBIGUOUS'"));
assert.ok(sources.autoBinding.includes("const union = [...new Set([...selected, id])]"));
assert.ok(!sources.autoBinding.includes('setInterval('));
assert.ok(!sources.autoBinding.includes('MutationObserver('));

// GitHub Sync remains read-only and fail-closed.
for (const code of ['GITHUB_PROJECT_BINDING_REQUIRED','GITHUB_REPOSITORY_NOT_AUTHORIZED','GITHUB_REPOSITORY_NOT_SELECTED']) {
  assert.ok(sources.githubRuntime.includes(code));
}
assert.ok(sources.githubRuntime.includes('explicit-project-binding'));
assert.ok(sources.githubRuntime.includes('historyReadOnly'));
assert.ok(sources.githubRuntime.includes('compareReadOnly'));
assert.ok(!sources.githubRuntime.includes("method: 'PATCH'"));
assert.ok(!sources.githubRuntime.includes("method: 'DELETE'"));
for (const label of ['Sincronizar estado','Ver histórico','Comparar']) assert.ok(sources.githubSync.includes(label));
assert.ok(sources.githubSync.includes('LovableDecrypterAutoBindingV84?.ensure'));

// Supabase manager and rename path.
for (const label of ['Disponíveis ao Decrypter','Atualizar provisionamento','Testar acesso','Vincular ao Lovable','Renomear projeto']) {
  assert.ok(sources.supabase.includes(label), `Supabase UI missing ${label}`);
}
assert.ok(sources.supabase.includes("type:'ld84.supabase.rename'"));
assert.ok(sources.supabaseRuntime.includes("type === 'ld84.supabase.manager.project-status'"));
assert.ok(sources.renameRuntime.includes('ld-supabase-project-rename'));
assert.ok(sources.renameRuntime.includes('SUPABASE_PROJECT_NOT_SELECTED'));

// Gemini provider remains non-automatic at boot and paid models require explicit opt-in.
assert.ok(sources.gemini.includes('Mostrar também modelos pagos / potencialmente cobrados'));
assert.ok(sources.gemini.includes('PAGO / POTENCIALMENTE COBRÁVEL'));
for (const type of ['ld84.gemini.v2.status','ld84.gemini.v2.models','ld84.gemini.v2.save','ld84.gemini.v2.clear']) assert.ok(sources.gemini.includes(type));
assert.ok(sources.geminiRuntime.includes('GEMINI_PAID_MODEL_OPT_IN_REQUIRED'));
assert.ok(sources.geminiRuntime.includes('local-ai'));
assert.ok(sources.geminiRuntime.includes('automaticExecution:false'));
assert.ok(sources.geminiRuntime.includes('bootActivation:false'));
assert.ok(!sources.geminiRuntime.includes(':generateContent'));
assert.ok(sources.integrationsRuntime.includes('local-ai'));

// Operation feedback ships as presentation only.
assert.ok(sources.feedback.includes('@keyframes ld84DangerPulseFast'));
assert.ok(sources.feedback.includes('data-kind="success"'));
assert.ok(sources.feedback.includes('data-kind="error"'));

// Service worker composition and event-driven invariants.
for (const script of ['editor-direct-runtime-v84.js','supabase-project-manager-runtime-v84.js','supabase-project-rename-runtime-v84.js','github-sync-runtime-v84.js','gemini-provider-runtime-v84.js']) {
  assert.ok(sources.worker.includes(script), `worker missing ${script}`);
}
for (const [name, source] of Object.entries(sources)) {
  assert.ok(!/MutationObserver\s*\(/.test(source), `${name}: MutationObserver forbidden`);
  assert.ok(!/setInterval\s*\(/.test(source), `${name}: setInterval forbidden`);
  assert.ok(!/\.inert\s*=|setAttribute\(\s*['\"]inert/.test(source), `${name}: inert takeover forbidden`);
  assert.ok(!/XMLHttpRequest\.prototype\s*\.|window\.fetch\s*=|globalThis\.fetch\s*=|navigator\.sendBeacon\s*=/.test(source), `${name}: network monkeypatch forbidden`);
}

const paths = new Set(pkg.paths || []);
for (const required of [
  'manifest.json','assets',
  ...expectedLauncher,
  'background/runtime-entry-v84.js','background/runtime-entry-v84-integrations.js',
  'background/editor-direct-runtime-v84.js','background/supabase-project-manager-runtime-v84.js',
  'background/supabase-project-rename-runtime-v84.js','background/github-sync-runtime-v84.js',
  'background/gemini-provider-runtime-v84.js','background/build84-service-worker.js'
]) assert.ok(paths.has(required), `package missing ${required}`);
for (const forbidden of pkg.forbidden_paths || []) assert.ok(!paths.has(forbidden), `forbidden path leaked into package: ${forbidden}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'ld-build84-browser-refinement/2',
  canonicalLauncher: true,
  editorDirectAuthority: 'functional-only',
  autoBinding: 'event-driven-conservative',
  resourceDbRetry: 'single-immediate',
  supabaseProjectDetail: true,
  supabaseRename: true,
  geminiPaidModels: 'explicit-opt-in',
  githubSync: 'read-only-fail-closed',
  continuousPolling: 0,
  globalObservers: 0
}, null, 2));
