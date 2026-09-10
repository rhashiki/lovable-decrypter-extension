import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const pkg = JSON.parse(read('release/runtime-package.json'));
const serviceWorker = read('background/build84-service-worker.js');
const runtime = read('background/context-intelligence-runtime-v84.js');
const enforcement = read('background/editor-context-scope-enforcement-v84.js');
const launcher = read('launcher/context-intelligence-v84.js');
const memory = read('supabase/functions/ld-memory-engine/index.ts');

const requiredPackagePaths = [
  'launcher/context-intelligence-v84.js',
  'background/context-intelligence-runtime-v84.js',
  'background/editor-context-scope-enforcement-v84.js'
];
for (const path of requiredPackagePaths) {
  assert(pkg.paths.includes(path), `runtime-package missing ${path}`);
}
assert.equal(manifest.version, '2.6.84');
for (const path of requiredPackagePaths.filter(path => path.startsWith('launcher/'))) {
  assert(manifest.content_scripts[0].js.includes(path), `manifest missing ${path}`);
}

const contextImport = serviceWorker.indexOf("'context-intelligence-runtime-v84.js'");
const enforcementImport = serviceWorker.indexOf("'editor-context-scope-enforcement-v84.js'");
assert(contextImport >= 0, 'service worker must load context runtime');
assert(enforcementImport > contextImport, 'editor enforcement must load after context runtime');
assert.match(serviceWorker, /contextPack:\s*true/);
assert.match(serviceWorker, /projectBrainMemory:\s*true/);
assert.match(serviceWorker, /scopeIntelligence:\s*true/);
assert.match(serviceWorker, /editorContextScopeEnforcement:\s*true/);
assert.match(serviceWorker, /scopeRequiredBeforeWrite:\s*true/);

for (const [name, source] of [['runtime', runtime], ['enforcement', enforcement], ['launcher', launcher]]) {
  assert(!/\bnew\s+MutationObserver\s*\(/.test(source), `${name} must not construct MutationObserver`);
  assert(!/\bMutationObserver\s*\(/.test(source), `${name} must not invoke MutationObserver`);
  assert(!/\bsetInterval\s*\(/.test(source), `${name} must not use setInterval`);
  assert(!/\bchrome\.alarms\b/.test(source), `${name} must not use chrome.alarms`);
}
assert(!runtime.includes('localStorage'), 'background runtime must use extension storage, not page localStorage');
assert.match(runtime, /LD84_CONTEXT_SCHEMA = 'ld-context-pack\/2'/);
assert.match(runtime, /LD84_SCOPE_SCHEMA = 'ld-scope-intelligence\/2'/);
assert.match(runtime, /LD84_CONTEXT_PROTOCOL = 'ld-runtime-bus\/1'/);
assert.match(runtime, /LD84_CONTEXT_MAX_FILES = 16/);
assert.match(runtime, /LD84_CONTEXT_MAX_CODE_BYTES = 150000/);
assert.match(runtime, /rawPromptPersisted:\s*false/);
assert.match(runtime, /retrievedMemoryAuthority:\s*'evidence-only'/);
assert.match(runtime, /modelStateAuthority:\s*false/);
assert.match(runtime, /function ld84ContextSensitivePath/);
assert(runtime.includes('\\.env'), 'sensitive-path policy must reject .env files');
assert(runtime.includes('pem|key|p12|pfx'), 'sensitive-path policy must reject private credential file extensions');
assert.match(runtime, /ld84\.context\.build/);
assert.match(runtime, /ld84\.scope\.evaluate/);

for (const token of [
  'fail-closed-before-write',
  'USER_EDIT > AI_EDIT',
  'outside-approved-plan',
  'broad-rewrite',
  'human-intent-override-required',
  'skipApprovalBypassesScope: false'
]) assert(runtime.includes(token), `scope invariant missing: ${token}`);

for (const token of [
  'ld-editor-context-scope-enforcement/1',
  'await ld84ContextBuild',
  'EDITOR_CONTEXT_HEAD_MISMATCH',
  'CONTEXT PACK — READ-ONLY EVIDENCE',
  'authority: \'evidence-only\'',
  'approvedPlan',
  'await ld84ScopeEvaluate',
  'EDITOR_SCOPE_BLOCKED',
  'scopeRequiredBeforeWrite: true',
  'skipApprovalBypassesScope: false',
  'originalWriterAuthorityPreserved: true',
  'originalApplyRevalidatesHead: true'
]) assert(enforcement.includes(token), `editor enforcement invariant missing: ${token}`);

const scopeCall = enforcement.indexOf('await ld84ScopeEvaluate');
const writerCall = enforcement.indexOf('await ld84EditorApplyBase84(message)');
assert(scopeCall >= 0 && writerCall > scopeCall, 'Scope must run before the original writer is invoked');
assert.match(enforcement, /if \(scope\?\.ok !== true \|\| !scope\?\.report \|\| scope\.report\.allowed !== true\)/);
assert.match(enforcement, /if \(snapshot\.headSha !== shadow\.baseHeadSha\) throw new Error\('EDITOR_HEAD_CHANGED_BEFORE_SCOPE'\)/);
assert.match(enforcement, /humanIntentOverrides:\s*Array\.isArray\(message\.humanIntentOverrides\)/);
assert(!/skipScope|bypassScope|scopeDisabled/i.test(enforcement), 'enforcement must expose no Scope bypass switch');

for (const token of [
  "LEGACY_VERSION='2.4.21'",
  "SUPPORTED_PROTOCOLS=new Set(['ld-runtime-bus/1'])",
  'x-decrypter-client-protocol',
  '@supabase/supabase-js@2.112.4',
  'brain:structuredBrain',
  'raw_context_persisted:false',
  'TRUST_PROTOCOL_MISMATCH',
  'TRUST_SESSION_PROTOCOL_MISMATCH'
]) assert(memory.includes(token), `memory compatibility invariant missing: ${token}`);

assert.match(launcher, /new Set\(\['context-pack', 'scope-intelligence'\]\)/);
assert.match(launcher, /stopImmediatePropagation\(\)/);
assert.match(launcher, /Gerar Context Pack/);
assert.match(launcher, /Human Intent Locks ativos/);

console.log('Build84.6 Context/Memory/Scope + Editor enforcement: static contract PASS');
