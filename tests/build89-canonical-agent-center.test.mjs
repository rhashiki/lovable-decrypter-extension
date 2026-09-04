import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(path, 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const pkg = JSON.parse(read('release/runtime-package.json'));
const settings = read('settings/config.js');
const canonicalClient = read('content/canonical-agent-center-client.js');
const canonicalUi = read('launcher/canonical-agent-center.js');
const localClient = read('content/local-agent-orchestrator-client.js');
const registryClient = read('content/agent-runtime-registry-client.js');
const skillsClient = read('content/portable-skills-client.js');
const sandboxClient = read('content/agent-sandbox-client.js');
const sessionsClient = read('content/native-agent-session-client.js');
const registryRuntime = read('background/agent-runtime-registry-runtime.js');
const skillsRuntime = read('background/portable-skills-runtime.js');
const sandboxRuntime = read('background/agent-sandbox-runtime.js');
const sessionsRuntime = read('background/native-agent-session-runtime.js');
const localRuntime = read('background/local-agent-orchestrator.js');
const registryCore = read('core/agent-runtime-registry.js');
const wiring = read('launcher/canonical-runtime-wiring.js');
const roadmap = read('docs/ROADMAP_V2_6_LOCAL_FIRST_AI.md');

assert.equal(manifest.version, '2.6.89');
assert.match(manifest.version_name, /Build 89\b/);
assert.equal(pkg.candidate, manifest.version);
assert.ok(settings.startsWith("export const VERSION = '2.6.89';"));

const scripts = (manifest.content_scripts || []).flatMap(entry => entry.js || []);
for (const required of [
  'content/local-agent-orchestrator-client.js',
  'content/agent-runtime-registry-client.js',
  'content/portable-skills-client.js',
  'content/agent-sandbox-client.js',
  'content/native-agent-session-client.js',
  'content/canonical-agent-center-client.js',
  'launcher/canonical-agent-center.js'
]) assert.ok(scripts.includes(required), `Build89 active script missing: ${required}`);

assert.ok(localClient.includes('writesRequireHumanApproval') || localRuntime.includes('writesRequireHumanApproval:true'));
assert.ok(localRuntime.includes('scopeIntelligenceBeforeWrite:true'));
assert.ok(localRuntime.includes('humanIntentBeforeWrite:true'));
assert.ok(localRuntime.includes('writeApprovalBoundToProposalDigest:true'));
assert.ok(localRuntime.includes('noPaidFallback:true'));
assert.ok(localRuntime.includes('noRemoteFallback:true'));

assert.ok(registryClient.includes('writeAuthority:false'));
assert.ok(registryClient.includes('credentialsDurable:false'));
assert.ok(registryRuntime.includes('externalWriteAuthority:false'));
assert.ok(registryRuntime.includes('credentialsDurable:false'));
assert.ok(registryRuntime.includes("storage:'chrome.storage.session'"));
assert.ok(registryRuntime.includes('promptCredentialsAllowed:false'));
assert.ok(registryCore.includes('canWriteAuthoritative:false'));
assert.ok(registryCore.includes('requiresDecrypterApproval:true'));
assert.ok(registryCore.includes('writeAuthority: false'));

assert.ok(skillsClient.includes('writeAuthority:false'));
assert.ok(skillsRuntime.includes('skillMayExpandIntent:false'));
assert.ok(skillsRuntime.includes('writeAuthority:false'));
assert.ok(skillsRuntime.includes('sourceImmutable:true'));
assert.ok(skillsRuntime.includes('stagedCopyRequired:true'));

assert.ok(sandboxClient.includes('writeAuthority:false'));
assert.ok(sandboxRuntime.includes("storage:'session-only'"));
assert.ok(sandboxRuntime.includes('rawFileContentPersisted:false'));
assert.ok(sandboxRuntime.includes('gitCredentials:false'));
assert.ok(sandboxRuntime.includes('providerCredentials:false'));
assert.ok(sandboxRuntime.includes('writeAuthority:false'));

assert.ok(sessionsClient.includes('silentSwitch:false'));
assert.ok(sessionsClient.includes('writeAuthority:false'));
assert.ok(sessionsRuntime.includes('approvalCarryOver:false'));
assert.ok(sessionsRuntime.includes('replayAuthority:false'));
assert.ok(sessionsRuntime.includes('writeAuthority:false'));
assert.ok(sessionsRuntime.includes('approvalInvalidated:true'));
assert.ok(sessionsRuntime.includes('replayAllowed:false'));

assert.ok(canonicalClient.includes("const SCHEMA = 'ld-canonical-agent-center/1'"));
assert.ok(canonicalClient.includes('localAgent().status()'));
assert.ok(canonicalClient.includes('registry().status()'));
assert.ok(canonicalClient.includes('skills().status()'));
assert.ok(canonicalClient.includes('sandbox().status()'));
assert.ok(canonicalClient.includes('sessions().status()'));
assert.ok(canonicalClient.includes('externalRuntimeWriteAuthority: false'));
assert.ok(canonicalClient.includes('commandExecutionFromAgentCenter: false'));
assert.ok(canonicalClient.includes('writeApprovalFromAgentCenter: false'));
assert.ok(!canonicalClient.includes('localAgent().start('));
assert.ok(!canonicalClient.includes('localAgent().approveWrite('));
assert.ok(!canonicalClient.includes('localAgent().resume('));
assert.ok(!canonicalClient.includes('sessions().switchRuntime('));

assert.ok(canonicalUi.includes("new Set(['local-agent', 'agent-sandbox'])"));
assert.ok(canonicalUi.includes('Agent Center'));
assert.ok(canonicalUi.includes('PROPOSAL ONLY'));
assert.ok(canonicalUi.includes('Agent Runtime Registry'));
assert.ok(canonicalUi.includes('Portable Skills'));
assert.ok(canonicalUi.includes('Native Sessions'));
assert.ok(canonicalUi.includes('Agent Sandbox'));
assert.ok(canonicalUi.includes('não inicia prompts'));
assert.ok(!canonicalUi.includes('Aprovar write'));
assert.ok(!canonicalUi.includes('Executar prompt'));
assert.ok(!canonicalUi.includes('innerHTML'));
assert.ok(!canonicalUi.includes('setInterval('));
assert.ok(!canonicalUi.includes('MutationObserver'));

assert.ok(wiring.includes('LovableDecrypterCanonicalAgentCenter?.handles'));
assert.ok(wiring.includes('canonicalAgent:Boolean(window.LovableDecrypterCanonicalAgentApi)'));
assert.ok(roadmap.includes('Build 88 — Canonical MCP Center ✅'));
assert.ok(roadmap.includes('Build 89 — Canonical Agent Center 🚧 CURRENT'));

for (const forbidden of ['ui/', 'diagnostic/']) assert.ok(!JSON.stringify(manifest).includes(forbidden), `forbidden active path: ${forbidden}`);
assert.ok(pkg.paths.includes('content/canonical-agent-center-client.js'));
assert.ok(pkg.forbidden_roots.includes('ui'));
assert.ok(pkg.forbidden_roots.includes('diagnostic'));

console.log(JSON.stringify({
  ok: true,
  schema: 'ld-build89-canonical-agent-center/1',
  version: manifest.version,
  localAgentObservability: true,
  runtimeRegistry: true,
  portableSkills: true,
  sandbox: true,
  nativeSessions: true,
  commandExecutionFromCenter: false,
  writeApprovalFromCenter: false,
  externalRuntimeWriteAuthority: false
}, null, 2));
