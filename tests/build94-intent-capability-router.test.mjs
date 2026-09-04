import fs from 'node:fs';
import assert from 'node:assert/strict';
import { routeIntentCapabilities, assertCapabilitySubset, CAPABILITIES } from '../core/capability-router.js';

const read = path => fs.readFileSync(path, 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const pkg = JSON.parse(read('release/runtime-package.json'));
const settings = read('settings/config.js');
const core = read('core/capability-router.js');
const runtime = read('background/capability-router-runtime.js');
const client = read('content/canonical-capability-router-client.js');
const ui = read('launcher/canonical-capability-router.js');
const composer = read('content/canonical-command-composer-client.js');
const sw = read('background/service-worker-entry.js');

assert.equal(manifest.version, '2.6.94');
assert.match(manifest.version_name, /Build 94\b/);
assert.equal(pkg.candidate, manifest.version);
assert.ok(settings.startsWith("export const VERSION = '2.6.94';"));
assert.deepEqual(CAPABILITIES, ['CODE','DATABASE','GIT','CONTEXT','TEST','RUNTIME','DEPLOY']);

const code = routeIntentCapabilities('corrija o componente AppBar');
assert.equal(code.route, 'CODE');
assert.deepEqual(code.requiredCapabilities, ['CODE']);
assert.equal(code.scopeExpansionAllowed, false);
assert.equal(code.automaticExecutionAllowed, false);
assert.equal(code.automaticApprovalAllowed, false);
assert.ok(code.capabilities.every(item => item.executableWithoutConfirmation === false));

const candidate = routeIntentCapabilities('crie uma tela de cadastro de clientes');
assert.equal(candidate.route, 'CODE');
assert.ok(candidate.requiredCapabilities.includes('CODE'));
assert.ok(candidate.candidateCapabilities.includes('DATABASE'));
assert.ok(!candidate.requiredCapabilities.includes('DATABASE'));
assert.ok(!candidate.capabilityPlan.some(step => step.capability === 'DATABASE'));

const mixed = routeIntentCapabilities('crie a tabela clientes e a tela de cadastro');
assert.equal(mixed.route, 'MIXED');
assert.ok(mixed.requiredCapabilities.includes('CODE'));
assert.ok(mixed.requiredCapabilities.includes('DATABASE'));
assert.ok(mixed.capabilityPlan.some(step => step.capability === 'CODE'));
assert.ok(mixed.capabilityPlan.some(step => step.capability === 'DATABASE'));

const deploy = routeIntentCapabilities('faça deploy na Vercel');
assert.equal(deploy.route, 'DEPLOY');
assert.deepEqual(deploy.requiredCapabilities, ['DEPLOY']);

const attachmentContext = routeIntentCapabilities('considere este material', {
  attachments: [{ kind:'text', name:'requisitos.md', mimeType:'text/markdown' }]
});
assert.ok(attachmentContext.requiredCapabilities.includes('CONTEXT'));
assert.equal(attachmentContext.attachmentSignals.length, 1);

assert.doesNotThrow(() => assertCapabilitySubset(code, ['CODE','CONTEXT','TEST']));
assert.throws(() => assertCapabilitySubset(mixed, ['CODE','CONTEXT','TEST']), error => error?.code === 'CAPABILITY_EXECUTION_NOT_AVAILABLE' && error.capabilities.includes('DATABASE'));

for (const token of [
  "authority: 'classification-only'",
  'scopeExpansionAllowed: false',
  'candidateRequiresConfirmation: true',
  'automaticExecutionAllowed: false',
  'automaticApprovalAllowed: false',
  'executableWithoutConfirmation: false'
]) assert.ok(core.includes(token) || runtime.includes(token), `Router safety contract missing: ${token}`);

assert.ok(sw.includes("installCapabilityRouterRuntime"));
assert.ok(sw.includes("./capability-router-runtime.js"));
assert.ok(client.includes("const PORT_NAME = 'ld2-capability-router'"));
assert.ok(client.includes('writeAuthority: false'));
assert.ok(ui.includes('CLASSIFICATION ONLY'));
assert.ok(ui.includes('Possíveis capacidades — não ativadas'));
assert.ok(ui.includes('Candidatos implícitos nunca são autoativados'));

for (const forbidden of ['repo.patch_apply','repo.write_file','approveWrite(','buildCommand(','callTool(','fetch(','setInterval(','MutationObserver','innerHTML']) {
  assert.ok(!ui.includes(forbidden), `Router UI must not execute authority path: ${forbidden}`);
}

assert.ok(composer.includes("const BUILD_EXECUTABLE_CAPABILITIES = Object.freeze(['CODE','CONTEXT','TEST'])"));
assert.ok(composer.includes('assertBuildCapabilities(await routeCommand(command))'));
assert.ok(composer.includes('CAPABILITY_ROUTE_UNRESOLVED'));
assert.ok(composer.includes('CAPABILITY_EXECUTION_NOT_AVAILABLE'));
assert.ok(composer.includes('capabilityCandidatesAutoActivated: false'));
assert.ok(composer.includes('capabilityRouteRequiredBeforeBuild: true'));
assert.ok(composer.includes('automaticApproval: false'));
assert.ok(composer.includes('directToolWriteAllowed: false'));
assert.ok(composer.includes('options.humanDecision !== true'));

const scripts = (manifest.content_scripts || []).flatMap(entry => entry.js || []);
for (const required of [
  'content/canonical-capability-router-client.js',
  'content/canonical-command-composer-client.js',
  'launcher/canonical-capability-router.js'
]) assert.ok(scripts.includes(required), `Build94 active script missing: ${required}`);

for (const forbidden of ['ui/', 'diagnostic/']) {
  assert.ok(!JSON.stringify(manifest).includes(forbidden), `forbidden active path: ${forbidden}`);
}
assert.ok(pkg.paths.includes('content/canonical-capability-router-client.js'));
assert.ok(pkg.forbidden_roots.includes('ui'));
assert.ok(pkg.forbidden_roots.includes('diagnostic'));

console.log(JSON.stringify({
  ok:true,
  schema:'ld-build94-intent-capability-router/1',
  version:manifest.version,
  routes:[...CAPABILITIES,'MIXED','UNRESOLVED'],
  candidateAutoActivation:false,
  routerAuthority:'classification-only',
  buildExecutableCapabilities:['CODE','CONTEXT','TEST'],
  unsupportedBuildCapabilities:['DATABASE','GIT','RUNTIME','DEPLOY']
}, null, 2));
