import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(path, 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const pkg = JSON.parse(read('release/runtime-package.json'));
const settings = read('settings/config.js');
const runtime = read('background/activity-audit-runtime.js');
const worker = read('background/service-worker-entry.js');
const client = read('content/canonical-activity-audit-client.js');
const ui = read('launcher/canonical-activity-audit.js');
const wiring = read('launcher/canonical-runtime-wiring.js');

assert.equal(manifest.version, '2.6.91');
assert.match(manifest.version_name, /Build 91\b/);
assert.equal(pkg.candidate, manifest.version);
assert.ok(settings.startsWith("export const VERSION = '2.6.91';"));

const scripts = (manifest.content_scripts || []).flatMap(entry => entry.js || []);
for (const required of [
  'content/canonical-activity-audit-client.js',
  'launcher/canonical-activity-audit.js'
]) assert.ok(scripts.includes(required), `Build91 active script missing: ${required}`);

assert.ok(worker.includes("import { installActivityAuditRuntime } from './activity-audit-runtime.js';"));
assert.ok(worker.includes('installActivityAuditRuntime();'));
assert.ok(runtime.includes("const SCHEMA = 'ld-activity-audit/1'"));
for (const source of ['operation-journal','approval-history','continuity-engine','local-agent-runs']) {
  assert.ok(runtime.includes(`'${source}'`), `audit source missing: ${source}`);
}
assert.ok(runtime.includes('rawPromptIncluded: false'));
assert.ok(runtime.includes('rawModelOutputIncluded: false'));
assert.ok(runtime.includes('rawFileContentIncluded: false'));
assert.ok(runtime.includes('credentialsIncluded: false'));
assert.ok(runtime.includes('raw command omitted'));
assert.ok(!runtime.includes('command: row?.command'));
assert.ok(runtime.includes('readOnly: true'));
assert.ok(runtime.includes('redacted: true'));

assert.ok(client.includes("const SCHEMA = 'ld-activity-audit/1'"));
assert.ok(client.includes("status: () => request('status')"));
assert.ok(client.includes("snapshot: (limit = 120) => request('snapshot'"));
assert.ok(client.includes('readOnly: true'));
assert.ok(client.includes('rawPromptIncluded: false'));
assert.ok(client.includes('credentialsIncluded: false'));
for (const forbidden of ['invoke(', 'apply(', 'approve', 'commit(', 'write(']) {
  assert.ok(!client.includes(forbidden), `audit client must remain read-only: ${forbidden}`);
}

assert.ok(ui.includes("new Set(['runtime-events', 'operations'])"));
assert.ok(ui.includes('Activity + Audit'));
assert.ok(ui.includes('READ ONLY'));
for (const label of ['Operações','Commits','Approvals','Recovery','Runtime']) assert.ok(ui.includes(label));
assert.ok(ui.includes('prompt bruto'));
assert.ok(ui.includes('conteúdo de arquivos'));
assert.ok(!ui.includes('innerHTML'));
assert.ok(!ui.includes('setInterval('));
assert.ok(!ui.includes('MutationObserver'));

assert.ok(wiring.includes('LovableDecrypterCanonicalActivityAudit?.handles'));
assert.ok(wiring.includes('canonicalAudit:Boolean(window.LovableDecrypterCanonicalActivityAuditApi)'));
assert.ok(wiring.includes("'runtime-events': async () => window.LovableDecrypterCanonicalActivityAuditApi?.snapshot"));
assert.ok(wiring.includes('operations: async () => window.LovableDecrypterCanonicalActivityAuditApi?.snapshot'));

assert.ok(pkg.paths.includes('content/canonical-activity-audit-client.js'));
assert.ok(pkg.forbidden_roots.includes('ui'));
assert.ok(pkg.forbidden_roots.includes('diagnostic'));
for (const forbidden of ['ui/', 'diagnostic/']) assert.ok(!JSON.stringify(manifest).includes(forbidden), `forbidden active path: ${forbidden}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'ld-build91-canonical-activity-audit/1',
  version: manifest.version,
  chronologicalAudit: true,
  sources: 4,
  readOnly: true,
  rawPromptIncluded: false,
  rawModelOutputIncluded: false,
  rawFileContentIncluded: false,
  credentialsIncluded: false
}, null, 2));
