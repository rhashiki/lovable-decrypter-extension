import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = file => fs.readFileSync(file, 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const pkg = JSON.parse(read('release/runtime-package.json'));
const checkpoint = JSON.parse(read('docs/checkpoints/build84-integrations-resource-management-validated.json'));

const app = (manifest.content_scripts || []).find(x => (x.js || []).includes('launcher/launcher-runtime.js'));
assert.ok(app, 'canonical launcher missing');
assert.equal(manifest.version, '2.6.84');
assert.equal(manifest.background?.service_worker, 'background/build84-service-worker.js');
assert.deepEqual(manifest.permissions || [], ['storage']);
assert.equal(app.run_at, 'document_start');
assert.equal(app.all_frames, false);

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

for (const path of [...(app.js || []), ...(app.css || [])]) {
  assert.ok(!path.startsWith('ui/'), `legacy ui returned: ${path}`);
}
for (const path of ['content/decrypter-chat.js','content/ui-mount-guardian.js','launcher/canonical-runtime-client.js']) {
  assert.ok(!app.js.includes(path), `legacy runtime returned: ${path}`);
}

assert.equal(checkpoint.status, 'VALIDADO');
assert.equal(checkpoint.validation, 'real-browser');
for (const key of ['ram_stabilizes','github_resource_manager_nested_once','supabase_resource_manager_nested_once','duplicate_resource_actions_removed']) {
  assert.equal(checkpoint.browser_results[key], true, `checkpoint regressed: ${key}`);
}

const sources = Object.fromEntries([
  'launcher/ux-polish-v84-3.js',
  'launcher/editor-direct-authority-v84.js',
  'launcher/integration-resource-manager-v84-3.js',
  'launcher/supabase-project-manager-v84-2.js',
  'launcher/project-auto-binding-v84.js',
  'launcher/github-sync-v84-3.js',
  'launcher/integration-resource-entrypoints-v84.js',
  'launcher/gemini-integration-v84-2.js',
  'launcher/operation-feedback-v84.js',
  'background/editor-direct-runtime-v84.js',
  'background/supabase-project-manager-runtime-v84.js',
  'background/supabase-project-rename-runtime-v84.js',
  'background/github-sync-runtime-v84.js',
  'background/gemini-provider-runtime-v84.js',
  'background/runtime-entry-v84-integrations.js',
  'background/build84-service-worker.js'
].map(path => [path, read(path)]));
const src = path => sources[path];

// Current validated UX + unique write authority.
assert.match(src('launcher/ux-polish-v84-3.js'), /ldEditorDirect/);
assert.match(src('launcher/ux-polish-v84-3.js'), /already-active rail icon closes its open menu/);
for (const token of ['ld84.editor.bind','ld84.editor.plan','ld84.editor.build','ld84.editor.apply']) {
  assert.match(src('launcher/editor-direct-authority-v84.js'), new RegExp(token.replaceAll('.', '\\.')));
}
assert.match(src('background/editor-direct-runtime-v84.js'), /method:\s*['"]PATCH['"]/);
assert.match(src('background/editor-direct-runtime-v84.js'), /force:\s*false/);

// Resources and auto-binding are explicit, conservative and union-preserving.
assert.match(src('launcher/integration-resource-manager-v84-3.js'), /transientDB/);
assert.match(src('launcher/integration-resource-manager-v84-3.js'), /Tentar novamente/);
assert.match(src('launcher/project-auto-binding-v84.js'), /existing-binding/);
assert.match(src('launcher/project-auto-binding-v84.js'), /single-authorized-resource/);
assert.match(src('launcher/project-auto-binding-v84.js'), /strong-name-match/);
assert.match(src('launcher/project-auto-binding-v84.js'), /AUTO_BIND_GITHUB_AMBIGUOUS/);
assert.match(src('launcher/project-auto-binding-v84.js'), /new Set\(\[\.\.\.selected, id\]\)/);

// GitHub Sync is read-only/fail-closed.
for (const token of ['GITHUB_PROJECT_BINDING_REQUIRED','GITHUB_REPOSITORY_NOT_AUTHORIZED','GITHUB_REPOSITORY_NOT_SELECTED','historyReadOnly','compareReadOnly']) {
  assert.match(src('background/github-sync-runtime-v84.js'), new RegExp(token));
}
assert.doesNotMatch(src('background/github-sync-runtime-v84.js'), /method:\s*['"](?:PATCH|DELETE)['"]/);
for (const label of ['Sincronizar estado','Ver histórico','Comparar']) assert.ok(src('launcher/github-sync-v84-3.js').includes(label));

// Supabase manager + rename.
for (const label of ['Atualizar provisionamento','Testar acesso','Vincular ao Lovable','Renomear projeto']) assert.ok(src('launcher/supabase-project-manager-v84-2.js').includes(label));
assert.match(src('background/supabase-project-rename-runtime-v84.js'), /SUPABASE_PROJECT_NOT_SELECTED/);

// Gemini stays non-automatic and paid/unverified models need explicit opt-in.
assert.match(src('launcher/gemini-integration-v84-2.js'), /Mostrar também modelos pagos/);
assert.match(src('background/gemini-provider-runtime-v84.js'), /GEMINI_PAID_MODEL_OPT_IN_REQUIRED/);
assert.match(src('background/gemini-provider-runtime-v84.js'), /automaticExecution:\s*false/);
assert.match(src('background/gemini-provider-runtime-v84.js'), /bootActivation:\s*false/);
assert.doesNotMatch(src('background/gemini-provider-runtime-v84.js'), /:generateContent/);

// Feedback is presentation-only and the canonical runtime remains event-driven.
assert.match(src('launcher/operation-feedback-v84.js'), /ld84DangerPulseFast/);
for (const [path, source] of Object.entries(sources)) {
  assert.doesNotMatch(source, /MutationObserver\s*\(/, `${path}: MutationObserver forbidden`);
  assert.doesNotMatch(source, /setInterval\s*\(/, `${path}: setInterval forbidden`);
  assert.doesNotMatch(source, /\.inert\s*=|setAttribute\(\s*['"]inert/, `${path}: inert takeover forbidden`);
  assert.doesNotMatch(source, /XMLHttpRequest\.prototype|(?:window|globalThis)\.fetch\s*=|navigator\.sendBeacon\s*=/, `${path}: network monkeypatch forbidden`);
}

const paths = new Set(pkg.paths || []);
for (const required of ['manifest.json','assets',...expectedLauncher,'background/build84-service-worker.js']) {
  assert.ok(paths.has(required), `package missing ${required}`);
}
for (const forbidden of pkg.forbidden_paths || []) assert.ok(!paths.has(forbidden), `forbidden package path: ${forbidden}`);

console.log(JSON.stringify({
  ok:true,
  schema:'ld-build84-browser-refinement/3',
  canonicalLauncher:true,
  editorDirectAuthority:'unique-write-authority',
  autoBinding:'event-driven-conservative',
  githubSync:'read-only-fail-closed',
  continuousPolling:0,
  globalObservers:0
}, null, 2));
