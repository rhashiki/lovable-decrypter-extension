import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=f=>fs.readFileSync(f,'utf8');
const json=f=>JSON.parse(read(f));
const manifest=json('manifest.json');
const pkg=json('release/runtime-package.json');
const checkpoint=json('docs/checkpoints/build84-browser-homologation-refinement-20260902.json');
const ux=read('launcher/ux-polish-v84-3.js');
const editor=read('launcher/editor-direct-authority-v84.js');
const resources=read('launcher/integration-resource-manager-v84-3.js');
const supabase=read('launcher/supabase-project-manager-v84-2.js');
const autobind=read('launcher/project-auto-binding-v84.js');
const github=read('launcher/github-sync-v84-3.js');
const entrypoints=read('launcher/integration-resource-entrypoints-v84.js');
const gemini=read('launcher/gemini-integration-v84-2.js');
const feedback=read('launcher/operation-feedback-v84.js');
const editorRuntime=read('background/editor-direct-runtime-v84.js');
const githubRuntime=read('background/github-sync-runtime-v84.js');
const worker=read('background/build84-service-worker.js');

assert.equal(manifest.version,'2.6.84');
assert.equal(manifest.background?.service_worker,'background/build84-service-worker.js');
assert.deepEqual(manifest.permissions||[],['storage']);
const app=(manifest.content_scripts||[]).find(x=>Array.isArray(x.js)&&x.js.includes('launcher/launcher-runtime.js'));
assert.ok(app,'canonical launcher content script missing');
assert.deepEqual(app.js,[
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
]);
for(const forbidden of ['launcher/ux-polish-v84-2.js','launcher/integration-resource-manager-v84-2.js','launcher/github-sync-v84.js','launcher/editor-direct-v84.js'])assert.ok(!app.js.includes(forbidden),`regressed UI shipped: ${forbidden}`);

assert.equal(checkpoint.validation,'real-browser-user-test');
for(const key of ['lovable_load_stable','ram_stable','editor_direct_full_ui_opens','editor_binding_save','github_sync_refresh','github_history','github_compare','supabase_manager_core','gemini_core'])assert.equal(checkpoint.validated[key],true,`missing real browser checkpoint ${key}`);

// Restore the exact compact dimensions from the previously browser-validated candidate.
for(const contract of ['width:58px!important','height:58px!important','width:52px!important','width:34px!important','height:34px!important','width:18px!important','height:18px!important'])assert.ok(ux.includes(contract),`validated launcher metric missing ${contract}`);
assert.ok(ux.includes('#detail .foot'));
assert.ok(ux.includes('#detail .state'));
assert.ok(ux.includes("button?.classList.contains('active')"));
assert.ok(ux.includes("flyout?.classList.remove('show')"));
assert.ok(ux.includes("detail?.classList.remove('show')"));
assert.ok(!ux.includes('Controle restaurado. O motor de edição direta será reativado'));

// Editor Direct stays functional and unique; binding receives operation feedback.
for(const type of ['ld84.editor.resources','ld84.editor.bind','ld84.editor.configure','ld84.editor.health','ld84.editor.plan','ld84.editor.build','ld84.editor.apply'])assert.ok(editor.includes(type),`Editor Direct missing ${type}`);
assert.ok(feedback.includes("label === 'Salvar vínculo'"));
assert.ok(feedback.includes('Salvando e validando vínculo Lovable ↔ GitHub ↔ Supabase'));
assert.ok(editorRuntime.includes("const LD84_EDITOR_BINDINGS_KEY = 'ld84_project_bindings'"));
assert.ok(editorRuntime.includes('force: false'));

// Automatic matching: strong and unique only, preserving other selected resources.
assert.ok(autobind.includes('function normalize(value)'));
assert.ok(autobind.includes('function uniqueBest('));
assert.ok(autobind.includes('first.score < 90'));
assert.ok(autobind.includes('second.score >= first.score - 8'));
assert.ok(autobind.includes("reason: 'single-authorized-resource'"));
assert.ok(autobind.includes('const union = [...new Set([...selected, id])]'));
assert.ok(autobind.includes("type: 'ld84.integration.resources.save'"));
assert.ok(autobind.includes("type: 'ld84.editor.bind'"));
assert.ok(autobind.includes("source: 'page-load'"));
assert.ok(github.includes('LovableDecrypterAutoBindingV84'));

// Resource selection save feedback and no destructive remote semantics.
assert.ok(resources.includes("setStatus(modal.status, 'Salvando e validando seleção…', 'testing')"));
assert.ok(resources.includes("'success'"));
assert.ok(resources.includes('GitHub Sync & History'));
assert.ok(resources.includes('Gerenciador Supabase'));
assert.ok(!resources.includes('delete repository'));
assert.ok(!resources.includes('delete project'));
assert.ok(entrypoints.includes('ensureSingleNestedEntry'));

// GitHub history and compare refined UX.
assert.ok(github.includes('height:300px'));
assert.ok(github.includes('ghs-history-card'));
assert.ok(github.includes("button('Comparar commits',true)"));
assert.ok(github.includes('ghs-compare-panel'));
assert.ok(github.includes('height:230px'));
assert.ok(github.includes('ghs-compare-results'));
for(const label of ['Sincronizar estado','Ver histórico','Comparar commits'])assert.ok(github.includes(label));
for(const type of ['ld84.github.sync.status','ld84.github.sync.refresh','ld84.github.sync.history','ld84.github.sync.compare'])assert.ok(github.includes(type));
assert.ok(githubRuntime.includes('historyReadOnly: true'));
assert.ok(githubRuntime.includes('compareReadOnly: true'));
assert.ok(!githubRuntime.includes("method: 'PATCH'"));
assert.ok(!githubRuntime.includes("method: 'DELETE'"));

// Faster and stronger feedback pattern shared by all requested operations.
assert.ok(feedback.includes('@keyframes ld84DangerPulseFast'));
assert.ok(feedback.includes('animation:ld84DangerPulseFast .62s'));
assert.ok(feedback.includes("content:'✓  '"));
for(const label of ['Renomear','Vincular ao Lovable','Atualizar provisionamento','Testar acesso'])assert.ok(feedback.includes(label),`feedback missing ${label}`);
assert.ok(supabase.includes("type:'ld84.supabase.rename'"));
assert.ok(supabase.includes('Renomear projeto'));

// Gemini remains the already-browser-approved v2 path.
assert.ok(gemini.includes('Mostrar também modelos pagos / potencialmente cobrados'));
assert.ok(gemini.includes('PAGO / POTENCIALMENTE COBRÁVEL'));
assert.ok(gemini.includes('scrollbar-color'));

// Clean architecture remains event driven.
for(const [name,source] of Object.entries({ux,editor,resources,supabase,autobind,github,entrypoints,gemini,feedback,editorRuntime,githubRuntime,worker})){
  assert.ok(!/MutationObserver\s*\(/.test(source),`${name}: MutationObserver forbidden`);
  assert.ok(!/setInterval\s*\(/.test(source),`${name}: setInterval forbidden`);
  assert.ok(!/\.inert\s*=|setAttribute\(\s*['\"]inert/.test(source),`${name}: inert takeover forbidden`);
  assert.ok(!/XMLHttpRequest\.prototype\s*\.|window\.fetch\s*=|globalThis\.fetch\s*=|navigator\.sendBeacon\s*=/.test(source),`${name}: network monkeypatch forbidden`);
}

const paths=new Set(pkg.paths||[]);
for(const required of app.js.concat([
  'manifest.json','assets','background/runtime-entry-v84.js','background/runtime-entry-v84-integrations.js','background/editor-direct-runtime-v84.js','background/supabase-project-manager-runtime-v84.js','background/supabase-project-rename-runtime-v84.js','background/github-sync-runtime-v84.js','background/gemini-provider-runtime-v84.js','background/build84-service-worker.js'
]))assert.ok(paths.has(required),`package missing ${required}`);
for(const forbidden of pkg.forbidden_paths||[])assert.ok(!paths.has(forbidden),`forbidden path leaked: ${forbidden}`);

console.log(JSON.stringify({
  ok:true,
  schema:'ld-build84-ui-autobinding-refinement/1',
  validatedBrowserCheckpoint:true,
  fabDesktop:58,
  railMask:52,
  railButton:34,
  technicalFooterHidden:true,
  activeRailClickCloses:true,
  autoBinding:'strong-unique-only',
  selectionPreserved:true,
  githubHistoryFixedScroll:true,
  compareButtonFlow:true,
  compareResultsFixedScroll:true,
  testingPulseMs:620,
  continuousPolling:0,
  globalObservers:0
},null,2));