import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const pkg = JSON.parse(read('release/runtime-package.json'));
const bridge = read('launcher/editor-compose-bridge-v84.js');
const progress = read('background/editor-progress-runtime-v84.js');
const cancel = read('background/editor-cancel-runtime-v84.js');
const serviceWorker = read('background/build84-service-worker.js');
const enforcement = read('background/editor-context-scope-enforcement-v84.js');

assert.equal(manifest.version, '2.6.84.7');
assert.equal(pkg.candidate, '2.6.84.7');
for (const path of [
  'launcher/editor-compose-bridge-v84.js',
  'launcher/editor-progress-ui-v84.js',
  'background/editor-progress-runtime-v84.js',
  'background/editor-cancel-runtime-v84.js'
]) assert(pkg.paths.includes(path), `runtime package missing ${path}`);
for (const path of ['launcher/editor-compose-bridge-v84.js','launcher/editor-progress-ui-v84.js']) {
  assert(manifest.content_scripts[0].js.includes(path), `manifest missing ${path}`);
}

for (const token of [
  "schema:'ld-editor-compose-bridge/2'",
  'nativeComposerPrimary:true',
  'nativeInlineTranscript:true',
  'explicitReviewPreserved:true',
  'networkMonkeypatch:false',
  "type:'ld84.editor.plan'",
  "type:'ld84.editor.apply'",
  "type:'ld84.cancel.current'",
  'Aguardando sua revisão',
  'Shadow Build pronto · ZERO WRITE',
  'Fila'
]) {
  if (token === 'Fila') assert(/fila/i.test(bridge), 'compose queue disclosure missing');
  else assert(bridge.includes(token), `compose invariant missing: ${token}`);
}
for (const forbidden of ['window.fetch =','XMLHttpRequest.prototype','sendBeacon =','new MutationObserver(','setInterval(']) {
  assert(!bridge.includes(forbidden), `compose bridge forbidden surface: ${forbidden}`);
}
assert(bridge.includes('stopImmediatePropagation()'), 'native Lovable send must be stopped when Decrypter is active');
assert(bridge.includes("current.active?'Decrypter ON':'Decrypter'"), 'compose activation indicator missing');
assert(bridge.includes('reviewPending=true'), 'Build must pause for explicit Shadow review');
assert(bridge.includes('apply.disabled=true'), 'Apply must start disabled until explicit approval');

for (const token of [
  "const SCHEMA = 'ld-editor-cancel/1'",
  'pipelineResultDiscard:true',
  'providerRequestAbortGuaranteed:false',
  'writeAfterCancel:false',
  "message?.type || '') !== 'ld84.cancel.current'"
]) assert(cancel.includes(token), `cancel invariant missing: ${token}`);
assert(!cancel.includes('ld84.editor.apply'), 'cancel runtime must never trigger Apply');

for (const token of [
  'cancellablePipeline: true',
  'lateResultDiscard: true',
  'globalThis.ld84EditorCancelBegin',
  'globalThis.ld84EditorCancelAssert'
]) assert(progress.includes(token), `progress/cancel invariant missing: ${token}`);
assert(!progress.includes('setInterval('), 'progress runtime must not poll with setInterval');

const rate = serviceWorker.indexOf("'editor-ai-rate-limit-v84.js'");
const cancelImport = serviceWorker.indexOf("'editor-cancel-runtime-v84.js'");
const context = serviceWorker.indexOf("'context-intelligence-runtime-v84.js'");
const enforcementImport = serviceWorker.indexOf("'editor-context-scope-enforcement-v84.js'");
const progressImport = serviceWorker.indexOf("'editor-progress-runtime-v84.js'");
assert(rate >= 0 && cancelImport > rate, 'cancellation must wrap final provider router/rate-limit runtime');
assert(context > cancelImport, 'context must run after cancellation wrapper is installed');
assert(enforcementImport > context, 'Scope enforcement must remain after Context Pack');
assert(progressImport > enforcementImport, 'progress wrapper must observe final Editor authority');
for (const token of ['editorCancellation: true','editorCancellationWriteAfterCancel: false','scopeRequiredBeforeWrite: true']) {
  assert(serviceWorker.includes(token), `service worker invariant missing: ${token}`);
}

const scopeCall = enforcement.indexOf('await ld84ScopeEvaluate');
const writerCall = enforcement.indexOf('gitResult = await ld84EditorApplyBase84(message)');
assert(scopeCall >= 0 && writerCall > scopeCall, 'Scope must remain before original Git writer');
assert(enforcement.includes('originalWriterAuthorityPreserved: true'), 'native compose must not replace writer authority');

console.log('Build84.7 Native Compose Chat contract PASS');
