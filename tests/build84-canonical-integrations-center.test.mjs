import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(path, 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const pkg = JSON.parse(read('release/runtime-package.json'));
const settings = read('settings/config.js');
const client = read('content/canonical-integrations-client.js');
const center = read('launcher/canonical-integrations-center.js');
const wiring = read('launcher/canonical-runtime-wiring.js');
const githubRuntime = read('background/github-app-runtime.js');
const supabaseRuntime = read('background/supabase-oauth-runtime.js');
const callback = read('content/integration-callback-bridge.js');

assert.equal(manifest.version, '2.6.84');
assert.match(manifest.version_name, /Build 84\b/);
assert.equal(pkg.candidate, manifest.version);
assert.ok(settings.startsWith("export const VERSION = '2.6.84';"));
assert.equal(manifest.background?.service_worker, 'background/service-worker-entry.js');

const scripts = (manifest.content_scripts || []).flatMap(entry => entry.js || []);
for (const required of [
  'launcher/launcher-runtime.js',
  'content/content.js',
  'content/integration-callback-bridge.js',
  'content/integration-readiness-client.js',
  'content/canonical-integrations-client.js',
  'launcher/canonical-runtime-wiring.js',
  'launcher/canonical-integrations-center.js'
]) assert.ok(scripts.includes(required), `Build84 active script missing: ${required}`);

for (const forbidden of ['ui/', 'diagnostic/', 'ui-shell-bootstrap', 'ui-mount-guardian', 'integrations-v49']) {
  assert.ok(!JSON.stringify(manifest).includes(forbidden), `legacy integration/UI path reactivated: ${forbidden}`);
}
assert.ok(pkg.forbidden_roots.includes('ui'));
assert.ok(pkg.forbidden_roots.includes('diagnostic'));
assert.ok(pkg.paths.includes('content/canonical-integrations-client.js'));
assert.ok(pkg.paths.includes('content/integration-callback-bridge.js'));

assert.ok(client.includes("schema: 'ld-canonical-integrations/1'"));
assert.ok(client.includes("github: 'ld2-github-app'"));
assert.ok(client.includes("supabase: 'ld2-supabase-oauth'"));
assert.ok(client.includes("githubCall('status')"));
assert.ok(client.includes("githubCall('disconnect')"));
assert.ok(client.includes("supabaseCall('manager_status')"));
assert.ok(client.includes("supabaseCall('project_test'"));
assert.ok(client.includes("authMode: 'github_app'"));
assert.ok(client.includes("authMode: 'oauth'"));
assert.ok(client.includes("token: ''"), 'GitHub PAT must be cleared when GitHub App mapping is selected');
assert.ok(client.includes("anonKey: ''"));
assert.ok(client.includes("managementToken: ''"));
assert.ok(client.includes('trustedAuthUrl'));
assert.ok(client.includes("url.protocol !== 'https:'"));
assert.ok(client.includes('freeTierVerified === true'));
assert.ok(!client.includes('WebGL'));
assert.ok(!client.includes('hardwareConcurrency'));
assert.ok(!client.includes('deviceMemory'));
assert.ok(!client.includes('setInterval('));
assert.ok(!client.includes('MutationObserver'));

assert.ok(center.includes("new Set(['github', 'supabase', 'lovable', 'gemini'])"));
assert.ok(center.includes("data-ld-integrations-center', 'canonical-v84'"));
assert.ok(center.includes("data-ld84-action"));
assert.ok(center.includes("github-map"));
assert.ok(center.includes("supabase-map"));
assert.ok(center.includes("gemini-test"));
assert.ok(center.includes("gemini-models"));
assert.ok(center.includes('Nenhuma service_role'));
assert.ok(!center.includes('setInterval('), 'canonical integration center must not poll');
assert.ok(!center.includes('MutationObserver'), 'canonical integration center must not observer-mount');
assert.ok(!center.includes('ui/'));
assert.ok(!center.includes('diagnostic/'));

assert.ok(wiring.includes('LovableDecrypterCanonicalIntegrations?.handles'));
assert.ok(wiring.includes("const VERSION = chrome.runtime.getManifest().version"));
assert.ok(wiring.includes("CORE_CLIENT_NOT_LOADED"));
assert.ok(!wiring.includes("const VERSION = '2.6.83'"));

for (const token of ["['status', 'connect', 'disconnect']", 'ld2-github-app']) assert.ok(githubRuntime.includes(token), `GitHub secure contract lost: ${token}`);
for (const token of ["OAUTH_ACTIONS", "'status', 'connect', 'disconnect'", "'manager_status'", "'project_test'", 'ld2-supabase-oauth']) assert.ok(supabaseRuntime.includes(token), `Supabase secure contract lost: ${token}`);
assert.ok(callback.includes("['github','supabase']"));
assert.ok(callback.includes('LD2_INTEGRATION_CALLBACK_COMPLETE'));

console.log(JSON.stringify({
  ok: true,
  schema: 'ld-build84-canonical-integrations-center/1',
  version: manifest.version,
  providers: ['github', 'supabase', 'lovable', 'gemini'],
  legacyUiActivated: false,
  pollingIntroduced: false,
  githubAuth: 'github_app',
  supabaseAuth: 'oauth'
}, null, 2));
