import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(path, 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const pkg = JSON.parse(read('release/runtime-package.json'));
const settings = read('settings/config.js');
const client = read('content/canonical-command-composer-client.js');
const ui = read('launcher/canonical-command-composer.js');
const agentClient = read('content/local-agent-orchestrator-client.js');
const agentRuntime = read('background/local-agent-orchestrator.js');
const toolCore = read('core/tool-runtime.js');
const wiring = read('launcher/canonical-runtime-wiring.js');

assert.equal(manifest.version, '2.6.92');
assert.match(manifest.version_name, /Build 92\b/);
assert.equal(pkg.candidate, manifest.version);
assert.ok(settings.startsWith("export const VERSION = '2.6.92';"));

const scripts = (manifest.content_scripts || []).flatMap(entry => entry.js || []);
for (const required of [
  'content/local-agent-orchestrator-client.js',
  'content/canonical-tool-runtime-client.js',
  'content/canonical-command-composer-client.js',
  'launcher/canonical-command-composer.js'
]) assert.ok(scripts.includes(required), `Build92 active script missing: ${required}`);

assert.ok(client.includes("const SCHEMA = 'ld-canonical-command-composer/1'"));
assert.ok(client.includes("mode: 'plan'"));
assert.ok(client.includes("mode: 'build'"));
assert.ok(client.includes("invokeRead('repo.patch_preview'"));
assert.ok(client.includes("invokeRead('repo.read_file'"));
assert.ok(client.includes('COMPOSER_PROPOSAL_STALE'));
assert.ok(client.includes('options.humanDecision !== true'));
assert.ok(client.includes('agent().approveWrite'));
assert.ok(client.includes('agent().cancel'));
assert.ok(client.includes('localFirst: true'));
assert.ok(client.includes('paidFallbackAllowed: false'));
assert.ok(client.includes('remoteFallbackAllowed: false'));
assert.ok(client.includes('directToolWriteAllowed: false'));
assert.ok(client.includes('automaticApproval: false'));
assert.ok(client.includes('attachmentsEnabled: false'));
assert.ok(client.includes('const leftEnd = Math.max(prefix, left.length - suffix)'));
assert.ok(client.includes('const rightEnd = Math.max(prefix, right.length - suffix)'));

for (const forbidden of ['LD2_BUILD_EXECUTE','LD2_PLAN_APPROVE','LD2_PLAN_APPLY','repo.patch_apply\', normalized.input']) {
  assert.ok(!client.includes(forbidden), `legacy/direct write shortcut found in canonical client: ${forbidden}`);
}

assert.ok(agentClient.includes('approveWrite(taskId, proposalDigest'));
assert.ok(agentRuntime.includes('writesRequireHumanApproval:true'));
assert.ok(agentRuntime.includes('writeApprovalBoundToProposalDigest:true'));
assert.ok(agentRuntime.includes("status='waiting_approval'"));
assert.ok(agentRuntime.includes("if(run.mode==='plan')"));
assert.ok(agentRuntime.includes("verification:'Plan mode: no write executed.'"));
assert.ok(toolCore.includes("name: 'repo.patch_preview'"));
assert.ok(toolCore.includes("mode: 'read'"));
assert.ok(toolCore.includes('TOOL_WRITE_APPROVAL_REQUIRED'));
assert.ok(toolCore.includes('TOOL_SCOPE_LOCK_REJECTED'));

assert.ok(ui.includes("const MODULE_ID = 'command-composer'"));
assert.ok(ui.includes('Command Composer'));
assert.ok(ui.includes('PLAN · somente leitura'));
assert.ok(ui.includes('BUILD · writes aprovados'));
assert.ok(ui.includes('Aprovar esta escrita'));
assert.ok(ui.includes('Aprovar exclusão'));
assert.ok(ui.includes('Cancelar tarefa'));
assert.ok(ui.includes('proposalDigest'));
assert.ok(ui.includes('Anexos entram na Build 93'));
assert.ok(!ui.includes('innerHTML'));
assert.ok(!ui.includes('setInterval('));
assert.ok(!ui.includes('MutationObserver'));

const runStart = ui.indexOf('async function runCommand()');
const approveStart = ui.indexOf('async function approve()');
assert.ok(runStart >= 0 && approveStart > runStart);
const runBlock = ui.slice(runStart, approveStart);
assert.ok(!runBlock.includes('approveWrite'), 'runCommand must never auto-approve a write');
const approveEnd = ui.indexOf('async function cancel()', approveStart);
const approveBlock = ui.slice(approveStart, approveEnd);
assert.ok(approveBlock.includes('approveWrite'));
assert.ok(approveBlock.includes('{ humanDecision: true }'));

assert.ok(wiring.includes('LovableDecrypterCanonicalCommandComposer?.handles'));
assert.ok(wiring.includes('canonicalComposer:Boolean(window.LovableDecrypterCanonicalCommandComposerApi)'));
assert.ok(pkg.paths.includes('content/canonical-command-composer-client.js'));
assert.ok(pkg.forbidden_roots.includes('ui'));
assert.ok(pkg.forbidden_roots.includes('diagnostic'));
for (const forbidden of ['ui/', 'diagnostic/']) assert.ok(!JSON.stringify(manifest).includes(forbidden), `forbidden active path: ${forbidden}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'ld-build92-canonical-command-composer/1',
  version: manifest.version,
  planMode: 'local-agent-no-write',
  buildMode: 'local-agent-gated',
  proposalPreview: 'read-only',
  approvalBinding: 'taskId+proposalDigest+humanDecision',
  automaticApproval: false,
  directToolWrite: false,
  legacyBuildShortcut: false,
  attachments: 'Build93'
}, null, 2));
