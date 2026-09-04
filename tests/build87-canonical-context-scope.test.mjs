import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(path, 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const pkg = JSON.parse(read('release/runtime-package.json'));
const settings = read('settings/config.js');
const contextClient = read('content/context-engine-client.js');
const canonicalClient = read('content/canonical-context-scope-client.js');
const canonicalUi = read('launcher/canonical-context-scope.js');
const contextRuntime = read('background/context-engine-runtime.js');
const scopeRuntime = read('background/scope-intelligence-runtime.js');
const scopeCore = read('core/scope-intelligence-v2.js');
const approval = read('background/approval-runtime.js');
const wiring = read('launcher/canonical-runtime-wiring.js');

assert.equal(manifest.version, '2.6.87');
assert.match(manifest.version_name, /Build 87\b/);
assert.equal(pkg.candidate, manifest.version);
assert.ok(settings.startsWith("export const VERSION = '2.6.87';"));

const scripts = (manifest.content_scripts || []).flatMap(entry => entry.js || []);
for (const required of [
  'content/context-engine-client.js',
  'content/canonical-context-scope-client.js',
  'launcher/canonical-context-scope.js',
  'launcher/canonical-runtime-wiring.js'
]) assert.ok(scripts.includes(required), `Build87 active script missing: ${required}`);

assert.ok(contextClient.includes("status() { return call('status'"));
assert.ok(contextClient.includes("userEdits(limit = 24)"));
assert.ok(contextClient.includes("return call('build'"));
assert.ok(contextRuntime.includes("engine: 'context-engine-v2'"));
assert.ok(contextRuntime.includes("selection: 'budgeted-multi-source-ranking'"));
assert.ok(contextRuntime.includes('rawPromptPersistence: false'));
assert.ok(contextRuntime.includes('rawKeystrokePersistence: false'));
assert.ok(contextRuntime.includes("sources: ['repository'"));

assert.ok(scopeRuntime.includes("const PORT_NAME = 'ld2-scope-intelligence'"));
assert.ok(scopeRuntime.includes("op === 'locks'"));
assert.ok(scopeRuntime.includes("op === 'evaluate'"));
assert.ok(scopeRuntime.includes("enforcement: 'fail-closed-before-write'"));
assert.ok(scopeRuntime.includes("humanIntentPolicy: 'USER_EDIT > AI_EDIT'"));
assert.ok(scopeCore.includes('outside-approved-plan'));
assert.ok(scopeCore.includes('human-intent-override-required'));
assert.ok(scopeCore.includes('broad-rewrite'));

assert.ok(canonicalClient.includes("const SCHEMA = 'ld-canonical-context-scope/1'"));
assert.ok(canonicalClient.includes("const SCOPE_PORT = 'ld2-scope-intelligence'"));
assert.ok(canonicalClient.includes('contextApi().build'));
assert.ok(canonicalClient.includes("scopeCall('locks'"));
assert.ok(canonicalClient.includes("scopeCall('evaluate'"));
assert.ok(canonicalClient.includes('formalScopeEvaluationPerformed: false'));
assert.ok(canonicalClient.includes('finalDiffValidationRequired: true'));
assert.ok(canonicalClient.includes("formalWriteAuthority: 'background-scope-intelligence-v2'"));
assert.ok(canonicalClient.includes('directWriteAuthority: false'));
assert.ok(!canonicalClient.includes('chrome.storage.local.set'));
assert.ok(!canonicalClient.includes('chrome.storage.session.set'));

assert.ok(canonicalUi.includes("new Set(['context-pack', 'scope-intelligence'])"));
assert.ok(canonicalUi.includes('Context + Scope'));
assert.ok(canonicalUi.includes('Montar Context Pack'));
assert.ok(canonicalUi.includes('User Intent Locks'));
assert.ok(canonicalUi.includes('Context Pack · arquivos selecionados'));
assert.ok(canonicalUi.includes('Scope preflight · Human Intent'));
assert.ok(canonicalUi.includes('validação formal request→plan→diff'));
assert.ok(!canonicalUi.includes('.content'));
assert.ok(!canonicalUi.includes('innerHTML'));
assert.ok(!canonicalUi.includes('setInterval('));
assert.ok(!canonicalUi.includes('MutationObserver'));

assert.ok(approval.includes('assertScopeIntelligence({'));
assert.ok(approval.includes('scopeIntelligenceHash'));
assert.ok(approval.includes("tx.status = 'validated'"));
assert.ok(approval.indexOf('assertScopeIntelligence({') < approval.indexOf("tx.status = 'validated'"));

assert.ok(wiring.includes('LovableDecrypterCanonicalContextScope?.handles'));
assert.ok(wiring.includes('canonicalContextScope: Boolean(window.LovableDecrypterCanonicalContextScopeApi)'));

for (const forbidden of ['ui/', 'diagnostic/']) assert.ok(!JSON.stringify(manifest).includes(forbidden), `forbidden active path: ${forbidden}`);
assert.ok(pkg.paths.includes('content/canonical-context-scope-client.js'));
assert.ok(pkg.forbidden_roots.includes('ui'));
assert.ok(pkg.forbidden_roots.includes('diagnostic'));

console.log(JSON.stringify({
  ok: true,
  schema: 'ld-build87-canonical-context-scope/1',
  version: manifest.version,
  contextPack: true,
  userIntentLocks: true,
  visualPreflight: true,
  formalScopeAuthority: 'background approval flow',
  directWriteAuthority: false
}, null, 2));
