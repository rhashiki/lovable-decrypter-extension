import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(path, 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const pkg = JSON.parse(read('release/runtime-package.json'));
const settings = read('settings/config.js');
const background = read('background/project-state-runtime.js');
const entry = read('background/service-worker-entry.js');
const client = read('content/canonical-project-state-client.js');
const center = read('launcher/canonical-project-state.js');
const wiring = read('launcher/canonical-runtime-wiring.js');

assert.equal(manifest.version, '2.6.85');
assert.match(manifest.version_name, /Build 85\b/);
assert.equal(pkg.candidate, manifest.version);
assert.ok(settings.startsWith("export const VERSION = '2.6.85';"));

const scripts = (manifest.content_scripts || []).flatMap(entry => entry.js || []);
for (const required of [
  'content/canonical-project-state-client.js',
  'launcher/canonical-project-state.js',
  'launcher/canonical-runtime-wiring.js',
  'launcher/canonical-integrations-center.js'
]) assert.ok(scripts.includes(required), `Build85 active script missing: ${required}`);

assert.ok(entry.includes("installProjectStateRuntime();"));
assert.ok(background.includes("action === 'canonical_snapshot'"));
assert.ok(background.includes("schema: 'ld-canonical-project-state/1'"));
assert.ok(background.includes('new GitAdapter(github)'));
assert.ok(background.includes('adapter.getRef(branch)'));
assert.ok(background.includes('inspectProjectState({ project_ref: projectRef })'));
assert.ok(background.includes('/token|secret|password|service[_-]?role|api[_-]?key|credential/i'));
assert.ok(background.includes('githubMapped'));
assert.ok(background.includes('supabaseMapped'));
assert.ok(!background.includes('setInterval('));
assert.ok(!background.includes('MutationObserver'));

assert.ok(client.includes("const PORT = 'ld2-project-state'"));
assert.ok(client.includes("request('canonical_snapshot'"));
assert.ok(client.includes("schema: 'ld-canonical-project-state/1'"));
assert.ok(!client.includes('setInterval('));
assert.ok(!client.includes('MutationObserver'));

assert.ok(center.includes("const MODULE_ID = 'project-state'"));
assert.ok(center.includes('GitHub'));
assert.ok(center.includes('Supabase'));
assert.ok(center.includes('HEAD'));
assert.ok(center.includes('Atualizar estado'));
assert.ok(center.includes('Nenhum polling permanente'));
assert.ok(!center.includes('setInterval('));
assert.ok(!center.includes('MutationObserver'));
assert.ok(!center.includes('ui/'));
assert.ok(!center.includes('diagnostic/'));

assert.ok(wiring.includes('LovableDecrypterCanonicalProjectState?.handles'));
assert.ok(wiring.includes('projectState: Boolean(window.LovableDecrypterCanonicalProjectStateApi)'));
assert.ok(wiring.includes('fab.title = `Lovable Decrypter v${VERSION}`'));

for (const forbidden of ['ui/', 'diagnostic/', 'lovable-project-runtime.js']) {
  assert.ok(!JSON.stringify(manifest).includes(forbidden), `forbidden active path: ${forbidden}`);
}
assert.ok(pkg.paths.includes('content/canonical-project-state-client.js'));
assert.ok(pkg.forbidden_roots.includes('ui'));
assert.ok(pkg.forbidden_roots.includes('diagnostic'));

console.log(JSON.stringify({
  ok: true,
  schema: 'ld-build85-canonical-project-state/1',
  version: manifest.version,
  onDemand: true,
  githubHeadInspection: true,
  supabaseInspection: true,
  legacyProjectPollingActivated: false
}, null, 2));
