import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(path, 'utf8');
const exists = path => fs.existsSync(path);

const manifest = JSON.parse(read('manifest.json'));
const packageSpec = JSON.parse(read('release/runtime-package.json'));
const wiring = read('launcher/canonical-runtime-wiring.js');
const launcher = read('launcher/launcher-runtime.js');
const entry = read('background/service-worker-entry.js');
const settings = read('settings/config.js');
const roadmap = read('docs/ROADMAP_V2_6_LOCAL_FIRST_AI.md');

assert.equal(manifest.version, '2.6.83');
assert.equal(manifest.background?.service_worker, 'background/service-worker-entry.js');
assert.equal(manifest.background?.type, 'module');
assert.ok(manifest.permissions?.includes('storage'));
assert.ok(manifest.permissions?.includes('identity'));

const activeScripts = (manifest.content_scripts || []).flatMap(item => item.js || []);
assert.equal(activeScripts[0], 'launcher/launcher-runtime.js');
assert.ok(activeScripts.includes('launcher/canonical-runtime-wiring.js'));

const requiredClients = [
  'content/content.js',
  'content/integration-readiness-client.js',
  'content/tool-runtime-client.js',
  'content/mcp-runtime-client.js',
  'content/mcp-marketplace-client.js',
  'content/context-engine-client.js',
  'content/reversible-operations-client.js',
  'content/continuity-runtime-client.js',
  'content/local-agent-orchestrator-client.js',
  'content/agent-runtime-registry-client.js',
  'content/portable-skills-client.js',
  'content/agent-sandbox-client.js',
  'content/native-agent-session-client.js'
];
for (const path of requiredClients) {
  assert.ok(exists(path), `missing modern client: ${path}`);
  assert.ok(activeScripts.includes(path), `modern client not activated: ${path}`);
}

const serializedManifest = JSON.stringify(manifest);
for (const forbidden of ['ui/', 'diagnostic/', 'ui-shell-bootstrap', 'ui-mount-guardian', 'decrypter-chat-runtime']) {
  assert.ok(!serializedManifest.includes(forbidden), `legacy visual dependency reactivated: ${forbidden}`);
}

assert.ok(launcher.includes("data-ld-ui-authority', 'canonical-v11"), 'canonical launcher authority marker lost');
assert.ok(wiring.includes("schema: 'ld-canonical-runtime/1'"));
assert.ok(wiring.includes('LovableDecrypterCanonicalRuntime'));
assert.ok(wiring.includes('serviceWorkerStatus'));
assert.ok(wiring.includes('integrationStatus'));
assert.ok(wiring.includes('LovableDecrypterContext'));
assert.ok(wiring.includes('LovableDecrypterTools'));
assert.ok(wiring.includes('LovableDecrypterMCP'));
assert.ok(wiring.includes('LovableDecrypterContinuity'));
assert.ok(wiring.includes('LovableDecrypterLocalAgent'));
assert.ok(wiring.includes('LovableDecrypterReversibleOperations'));
assert.ok(!wiring.includes('MutationObserver'), 'Build83 wiring must not restore observer-based mounting');
assert.ok(!wiring.includes('setInterval('), 'Build83 wiring must not poll for mounting');
assert.ok(!wiring.includes('ui/'), 'Build83 wiring must not reference legacy UI');
assert.ok(!wiring.includes('diagnostic/'), 'Build83 wiring must not reference diagnostic UI');

const engineInstallers = [
  'installToolRuntime();',
  'installMcpRuntime();',
  'installMcpMarketplaceRuntime();',
  'installContextEngineRuntime();',
  'installScopeIntelligenceRuntime();',
  'installReversibleOperationsRuntime();',
  'installContinuityRuntime();',
  'installLocalModelRuntime();',
  'installLocalAgentOrchestrator();',
  'installIntegrationReadinessRuntime();',
  'installAgentRuntimeRegistryRuntime();',
  'installPortableSkillsRuntime();',
  'installAgentSandboxRuntime();',
  'installNativeAgentSessionRuntime();'
];
for (const token of engineInstallers) assert.ok(entry.includes(token), `modern service-worker installer lost: ${token}`);
for (const forbidden of ['decrypter-chat-runtime', 'multi-agent-runtime-v74', "'../ui/", "'./ui/"]) {
  assert.ok(!entry.includes(forbidden), `service-worker entry references legacy visual layer: ${forbidden}`);
}

assert.ok(settings.startsWith("export const VERSION = '2.6.83';"), 'settings VERSION is not Build83');
assert.equal(packageSpec.candidate, '2.6.83');
assert.ok(packageSpec.paths.includes('background'));
assert.ok(packageSpec.paths.includes('core'));
assert.ok(packageSpec.paths.includes('launcher'));
assert.ok(packageSpec.forbidden_roots.includes('ui'));
assert.ok(packageSpec.forbidden_roots.includes('diagnostic'));
for (const path of requiredClients) assert.ok(packageSpec.paths.includes(path), `runtime package omits active client: ${path}`);

assert.ok(roadmap.includes('Build 83 — Canonical Runtime Wiring + CI Reconciliation'));
assert.ok(roadmap.includes('Build 94 — Intent & Capability Router'));
assert.ok(roadmap.includes('Build 95 — Safe Database Plan → Review → Run'));
assert.ok(roadmap.includes('Build 96 — Project Understanding / Context Map'));
assert.ok(roadmap.includes('Build 97 — Change Transactions'));
assert.ok(roadmap.includes('Build 116 — Deployment Hub / Production Readiness'));

console.log(JSON.stringify({
  ok: true,
  schema: 'ld-build83-canonical-runtime-wiring/1',
  version: manifest.version,
  activeScripts: activeScripts.length,
  modernClients: requiredClients.length,
  background: manifest.background.service_worker,
  visualAuthority: 'launcher/launcher-runtime.js',
  legacyUiActivated: false
}, null, 2));
