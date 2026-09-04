import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const json = p => JSON.parse(read(p));
const exists = p => fs.existsSync(path.join(root, p));

const manifest = json('manifest.json');
const pkg = json('release/runtime-package.json');
const inventory = json('docs/functional-capabilities-v84.json');
const sources = Object.fromEntries([
  'launcher/launcher-runtime.js',
  'launcher/runtime-client-v84.js',
  'launcher/account-controller-v84.js',
  'launcher/ux-polish-v84.js',
  'launcher/integration-resource-manager-v84.js',
  'launcher/integration-resource-entrypoints-v84.js',
  'background/runtime-entry-v84.js',
  'background/runtime-entry-v84-integrations.js',
  'supabase/functions/ld-trust-attest/index.ts',
  'supabase/functions/ld-supabase-oauth/index.ts',
  'supabase/functions/ld-integration-selection/index.ts'
].map(file => [file, read(file)]));

const launcher = sources['launcher/launcher-runtime.js'];
const client = sources['launcher/runtime-client-v84.js'];
const account = sources['launcher/account-controller-v84.js'];
const polish = sources['launcher/ux-polish-v84.js'];
const resourceManager = sources['launcher/integration-resource-manager-v84.js'];
const resourceEntrypoints = sources['launcher/integration-resource-entrypoints-v84.js'];
const runtime = sources['background/runtime-entry-v84.js'];
const runtimeWrapper = sources['background/runtime-entry-v84-integrations.js'];
const trustBackend = sources['supabase/functions/ld-trust-attest/index.ts'];
const supabaseBackend = sources['supabase/functions/ld-supabase-oauth/index.ts'];
const selectionBackend = sources['supabase/functions/ld-integration-selection/index.ts'];

assert.equal(manifest.version, '2.6.84');
assert.equal(manifest.background?.service_worker, 'background/runtime-entry-v84-integrations.js');
assert.deepEqual(manifest.permissions || [], ['storage']);
assert.deepEqual(manifest.host_permissions, ['https://lovable.dev/*','https://*.lovable.dev/*','https://kkzxxnfxgrouhkzyszxs.supabase.co/*']);

const app = (manifest.content_scripts || []).find(item => Array.isArray(item.js) && item.js.includes('launcher/launcher-runtime.js'));
assert.ok(app, 'canonical launcher content script missing');
assert.deepEqual(app.js, [
  'launcher/launcher-runtime.js',
  'launcher/runtime-client-v84.js',
  'launcher/account-controller-v84.js',
  'launcher/ux-polish-v84.js',
  'launcher/integration-resource-manager-v84.js',
  'launcher/integration-resource-entrypoints-v84.js'
]);
assert.equal(app.run_at, 'document_start');
assert.equal(app.all_frames, false);

assert.match(launcher, /canonical-v11/);
assert.ok(client.includes("type: 'ld84.runtime.command'"));
assert.ok(client.includes('function integrationModal('));
assert.ok(account.includes("type: 'ld84.account.activate'"));
assert.ok(polish.includes("MONITOR_KEY = 'ld84_monitor_enabled'"));
assert.ok(polish.includes("parityButton('editor-direct', 'Editor Direto'"));

assert.ok(resourceManager.includes("type: 'ld84.integration.resources.status'"));
assert.ok(resourceManager.includes("type: 'ld84.integration.resources.save'"));
assert.ok(resourceManager.includes('Gerenciar acesso no GitHub'));
assert.ok(resourceManager.includes('Salvar seleção'));
assert.ok(!resourceManager.includes('function injectAction('), 'resource manager must not inject a second detail action');
assert.ok(!resourceManager.includes('refreshInjection'), 'resource manager must not own UI injection');

assert.ok(resourceEntrypoints.includes('function removeTopLevelResourceEntries('));
assert.ok(resourceEntrypoints.includes("flyout.querySelectorAll('[data-ld-resource-entrypoint],.ld84-resource-entry')"));
assert.ok(resourceEntrypoints.includes('function ensureSingleNestedEntry('));
assert.ok(resourceEntrypoints.includes("const existing = [...actions.querySelectorAll('[data-ld-resource-manage]')]"));
assert.ok(resourceEntrypoints.includes('if (existing.length === 1 && canonical && canonical.querySelector(\'svg\') && canonical.querySelector(\'span\')) return'));
assert.ok(resourceEntrypoints.includes('for (const node of existing) node.remove()'));
assert.ok(resourceEntrypoints.includes("button.dataset.ldResourceCanonicalDetail = integration"));
assert.ok(resourceEntrypoints.includes("label.textContent = integration === 'github' ? 'Gerenciar repositórios' : 'Gerenciar projetos'"));
assert.ok(resourceEntrypoints.includes('button.append(actionIcon(integration), label)'));
assert.ok(resourceEntrypoints.includes("['M5 4h14v16H5z','M8 8h8','M8 12h8','M8 16h5']"));
assert.ok(resourceEntrypoints.includes("'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3Z'"));
assert.ok(!resourceEntrypoints.includes('GitHub · Gerenciar repositórios'), 'resource action must not remain top-level in integrations');
assert.ok(!resourceEntrypoints.includes('Supabase · Gerenciar projetos'), 'resource action must not remain top-level in integrations');
assert.ok(!resourceEntrypoints.includes('makeFlyEntry('), 'top-level resource entry builder must be removed');
assert.ok(resourceEntrypoints.includes('fitDetail(shadow, detail)'));
assert.ok(resourceEntrypoints.includes('queueMicrotask'));

assert.ok(runtime.includes("mode: 'event-driven'"));
assert.ok(runtime.includes('activeHeavyRuntimes: 0'));
assert.ok(runtime.includes("const CLIENT_PROTOCOL = 'ld-runtime-bus/1'"));
assert.ok(runtimeWrapper.includes("importScripts('runtime-entry-v84.js')"));
assert.ok(runtimeWrapper.includes('ld-integration-selection'));
assert.ok(runtimeWrapper.includes('RESOURCE_NOT_AUTHORIZED'));

assert.ok(trustBackend.includes("SUPPORTED_PROTOCOLS=new Set(['ld-runtime-bus/1'])"));
assert.ok(trustBackend.includes("compatibility:'protocol'"));
assert.ok(!trustBackend.includes("const EXPECTED_VERSION='2.4.21'"));
assert.ok(supabaseBackend.includes('async function listOrganizations(accessToken:string)'));
assert.ok(supabaseBackend.includes('project_discovery:listed.diagnostics'));
assert.ok(selectionBackend.includes('selected_repositories'));
assert.ok(selectionBackend.includes('selected_projects'));

for (const [name, source] of Object.entries({ launcher, client, account, polish, resourceManager, resourceEntrypoints, runtime, runtimeWrapper })) {
  assert.ok(!/MutationObserver\s*\(/.test(source), `${name}: MutationObserver forbidden`);
  assert.ok(!/setInterval\s*\(/.test(source), `${name}: setInterval forbidden`);
  assert.ok(!/\.inert\s*=|setAttribute\(\s*['\"]inert/.test(source), `${name}: inert takeover forbidden`);
  assert.ok(!/XMLHttpRequest\.prototype\s*\.|window\.fetch\s*=|globalThis\.fetch\s*=|navigator\.sendBeacon\s*=/.test(source), `${name}: network monkeypatch forbidden`);
}
assert.ok(!account.includes('document.body'));
assert.ok(!polish.includes('document.body'));
assert.ok(!resourceManager.includes('document.body'));
assert.ok(!resourceEntrypoints.includes('document.body'));
assert.ok(!runtime.includes('setTimeout('));
assert.ok(!runtime.includes('chrome.alarms'));
assert.ok(!runtimeWrapper.includes('setTimeout('));
assert.ok(!runtimeWrapper.includes('chrome.alarms'));

assert.equal(inventory.schema, 'ld-functional-capabilities/1');
assert.equal(inventory.build, 84);
assert.equal(inventory.policy.functional_loss_allowed, false);
assert.equal(inventory.policy.single_visual_authority, true);
assert.equal(inventory.policy.global_dom_observers_allowed, false);
assert.equal(inventory.policy.continuous_content_polling_allowed, false);
assert.equal(inventory.policy.heavy_runtime_boot_allowed, false);
assert.ok(Array.isArray(inventory.capabilities) && inventory.capabilities.length >= 48);
const ids = inventory.capabilities.map(item => item.id);
assert.equal(new Set(ids).size, ids.length);
for (const required of [
  'ui.fab','ui.rail','ui.monitor-state','ui.editor-direct','license.activation','trust.attestation',
  'integration.github','integration.github-repository-management','integration.supabase','integration.supabase-project-selection',
  'project.state','ai.gateway','ai.local-model','ai.memory','context.pack','scope.intelligence','tools.read','tools.write',
  'mcp.core','mcp.marketplace','recovery.undo-redo','continuity.engine','agent.local','agent.registry','skills.portable',
  'agent.sandbox','agent.native-sessions','updates.center','project.zip-export'
]) assert.ok(ids.includes(required), `functional parity capability missing: ${required}`);

const packagePaths = new Set(pkg.paths || []);
for (const required of [
  'manifest.json','assets','launcher/launcher-runtime.js','launcher/runtime-client-v84.js',
  'launcher/account-controller-v84.js','launcher/ux-polish-v84.js','launcher/integration-resource-manager-v84.js',
  'launcher/integration-resource-entrypoints-v84.js','background/runtime-entry-v84.js','background/runtime-entry-v84-integrations.js'
]) {
  assert.ok(packagePaths.has(required), `package path missing: ${required}`);
  assert.ok(exists(required), `package file missing: ${required}`);
}

const manifestText = JSON.stringify(manifest);
for (const token of ['ui-mount-guardian','composer-guardian','composer-bridge-v3','decrypter-chat.js','approval-auto-repair','service-worker-entry.js','canonical-runtime-entry.js']) {
  assert.ok(!manifestText.includes(token), `legacy runtime leaked into manifest: ${token}`);
}

console.log(JSON.stringify({
  ok: true,
  schema: 'ld-build84-clean-foundation/9',
  version: manifest.version,
  visualAuthorities: 1,
  globalObservers: 0,
  continuousPolling: 0,
  activeHeavyRuntimesAtBoot: 0,
  resourceEntryVisibility: 'single-nested-detail-action-idempotent',
  resourceSelection: 'server-side-allowlist',
  legacyDomStackShipped: false,
  functionalLossAllowed: false
}, null, 2));
