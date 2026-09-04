import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(path, 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const pkg = JSON.parse(read('release/runtime-package.json'));
const settings = read('settings/config.js');
const core = read('core/tool-runtime.js');
const background = read('background/tool-runtime.js');
const client = read('content/tool-runtime-client.js');
const canonicalClient = read('content/canonical-tool-runtime-client.js');
const canonicalUi = read('launcher/canonical-tool-runtime.js');
const wiring = read('launcher/canonical-runtime-wiring.js');
const journal = read('core/operation-journal.js');

assert.equal(manifest.version, '2.6.86');
assert.match(manifest.version_name, /Build 86\b/);
assert.equal(pkg.candidate, manifest.version);
assert.ok(settings.startsWith("export const VERSION = '2.6.86';"));

const scripts = (manifest.content_scripts || []).flatMap(entry => entry.js || []);
for (const required of [
  'content/tool-runtime-client.js',
  'content/canonical-tool-runtime-client.js',
  'launcher/canonical-tool-runtime.js',
  'launcher/canonical-runtime-wiring.js'
]) assert.ok(scripts.includes(required), `Build86 active script missing: ${required}`);

for (const token of [
  "name: 'repo.list_files'",
  "name: 'repo.read_file'",
  "name: 'repo.grep'",
  "name: 'repo.git_diff'",
  "name: 'repo.patch_preview'",
  "name: 'repo.patch_apply'",
  "name: 'repo.write_file'",
  'TOOL_WRITE_APPROVAL_REQUIRED',
  'TOOL_SCOPE_LOCK_REJECTED'
]) assert.ok(core.includes(token), `Tool Runtime core contract missing: ${token}`);

for (const token of [
  'resolveWriteAuthorization',
  "tx.status !== 'validated'",
  'scopeIntelligenceHash',
  'assertLocalAgentProposalBinding',
  'checkpointWriteHead',
  "ambiguousWriteRetry: 'verification-required'"
]) assert.ok(background.includes(token), `Write authority gate missing: ${token}`);

assert.ok(client.includes("const PORT_NAME = 'ld2-tool-runtime'"));
assert.ok(client.includes("authorization: options.transactionId ? { transactionId: options.transactionId } : {}"));

assert.ok(canonicalClient.includes("const SCHEMA = 'ld-canonical-tool-runtime/1'"));
assert.ok(canonicalClient.includes('schema: SCHEMA'));
assert.ok(canonicalClient.includes('invokeRead'));
assert.ok(canonicalClient.includes("definition.mode !== 'read'"));
assert.ok(canonicalClient.includes('CANONICAL_DIRECT_WRITE_BLOCKED'));
assert.ok(canonicalClient.includes("return invokeRead('repo.list_files'"));
assert.ok(canonicalClient.includes("directWriteAllowed: false"));
assert.ok(canonicalClient.includes("writeAuthority: 'validated-change-transaction-only'"));
assert.ok(!canonicalClient.includes('transactionId:'), 'canonical read client must not mint or inject a write transaction id');

assert.ok(canonicalUi.includes("const MODULE_ID = 'tool-runtime'"));
assert.ok(canonicalUi.includes('Operation Journal'));
assert.ok(canonicalUi.includes('Testar leitura segura'));
assert.ok(canonicalUi.includes('WRITE · TX REQUIRED'));
assert.ok(canonicalUi.includes('A UI canônica não chama ferramentas WRITE diretamente'));
assert.ok(!canonicalUi.includes('repo.patch_apply'));
assert.ok(!canonicalUi.includes('repo.write_file'));
assert.ok(!canonicalUi.includes('setInterval('));
assert.ok(!canonicalUi.includes('MutationObserver'));

assert.ok(wiring.includes('LovableDecrypterCanonicalToolRuntime?.handles'));
assert.ok(wiring.includes('canonicalTools: Boolean(window.LovableDecrypterCanonicalToolsApi)'));

assert.ok(journal.includes("status: 'running'"));
assert.ok(journal.includes('finishedAt'));
assert.ok(journal.includes('durationMs'));
assert.ok(journal.includes('Never persist file contents, prompts, replacement text, secrets or tokens.'));

for (const forbidden of ['ui/', 'diagnostic/']) {
  assert.ok(!JSON.stringify(manifest).includes(forbidden), `forbidden active path: ${forbidden}`);
}
assert.ok(pkg.paths.includes('content/canonical-tool-runtime-client.js'));
assert.ok(pkg.forbidden_roots.includes('ui'));
assert.ok(pkg.forbidden_roots.includes('diagnostic'));

console.log(JSON.stringify({
  ok: true,
  schema: 'ld-build86-canonical-tool-runtime/1',
  version: manifest.version,
  realRegistry: true,
  operationJournal: true,
  directReadSmoke: 'repo.list_files',
  directWriteAllowed: false,
  writeGate: 'validated transaction + scope intelligence + continuity'
}, null, 2));
