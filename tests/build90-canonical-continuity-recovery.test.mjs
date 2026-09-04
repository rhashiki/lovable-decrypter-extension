import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(path, 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const pkg = JSON.parse(read('release/runtime-package.json'));
const settings = read('settings/config.js');
const canonicalClient = read('content/canonical-continuity-recovery-client.js');
const canonicalUi = read('launcher/canonical-continuity-recovery.js');
const continuityClient = read('content/continuity-runtime-client.js');
const continuityRuntime = read('background/continuity-runtime.js');
const continuityCore = read('core/continuity-engine.js');
const reversalClient = read('content/reversible-operations-client.js');
const reversalRuntime = read('background/reversible-operations-runtime.js');
const wiring = read('launcher/canonical-runtime-wiring.js');

assert.equal(manifest.version, '2.6.90');
assert.match(manifest.version_name, /Build 90\b/);
assert.equal(pkg.candidate, manifest.version);
assert.ok(settings.startsWith("export const VERSION = '2.6.90';"));

const scripts = (manifest.content_scripts || []).flatMap(entry => entry.js || []);
for (const required of [
  'content/continuity-runtime-client.js',
  'content/reversible-operations-client.js',
  'content/canonical-continuity-recovery-client.js',
  'launcher/canonical-continuity-recovery.js'
]) assert.ok(scripts.includes(required), `Build90 active script missing: ${required}`);

assert.ok(continuityRuntime.includes("writeAmbiguityPolicy: 'operation-journal-or-prewrite-head-verification-before-retry'"));
assert.ok(continuityRuntime.includes("step.status !== 'verification_required'"));
assert.ok(continuityRuntime.includes("checkpoint?.type !== 'git-head-before-write'"));
assert.ok(continuityRuntime.includes("action: 'verified-no-write-safe-to-retry'"));
assert.ok(continuityRuntime.includes('writeRetryRequiresVerification: true'));
assert.ok(continuityCore.includes('CONTINUITY_VERIFICATION_REQUIRED_BEFORE_RESUME'));
assert.ok(continuityCore.includes("step.status === 'verification_required'"));
assert.ok(continuityCore.includes("mode === 'write' ? input?.retrySafe === true"));

assert.ok(reversalClient.includes('humanDecision: true'));
assert.ok(reversalRuntime.includes('REVERSAL_HUMAN_CONFIRMATION_REQUIRED'));
assert.ok(reversalRuntime.includes('REVERSAL_DESTRUCTIVE_CONFIRMATION_REQUIRED'));
assert.ok(reversalRuntime.includes("strategy: 'preserve'") || canonicalClient.includes("strategy: 'preserve'"));

assert.ok(canonicalClient.includes("const SCHEMA = 'ld-canonical-continuity-recovery/1'"));
assert.ok(canonicalClient.includes('continuity().verifyWrite'));
assert.ok(canonicalClient.includes('continuity().resume'));
assert.ok(canonicalClient.includes("direction: 'undo', strategy: 'preserve'"));
assert.ok(canonicalClient.includes("direction: 'redo', strategy: 'preserve'"));
assert.ok(canonicalClient.includes('retryWriteWithoutVerification: undefined'));
assert.ok(canonicalClient.includes('cascadeReversal: undefined'));
assert.ok(canonicalClient.includes('automaticWriteRetry: false'));

assert.ok(canonicalUi.includes("new Set(['continuity', 'smart-undo', 'checkpoint'])"));
assert.ok(canonicalUi.includes('Continuity + Recovery'));
assert.ok(canonicalUi.includes('Recovery Doctor canônico'));
assert.ok(canonicalUi.includes('Verificar write'));
assert.ok(canonicalUi.includes('Retomar tarefa'));
assert.ok(canonicalUi.includes('Preview Undo'));
assert.ok(canonicalUi.includes('Preview Redo'));
assert.ok(canonicalUi.includes('Confirmar reversão destrutiva'));
assert.ok(canonicalUi.includes('Cascade destrutivo não é exposto'));
assert.ok(!canonicalUi.includes('strategy: \'cascade\''));
assert.ok(!canonicalUi.includes('setInterval('));
assert.ok(!canonicalUi.includes('MutationObserver'));
assert.ok(!canonicalUi.includes('innerHTML'));

assert.ok(wiring.includes('LovableDecrypterCanonicalContinuityRecovery?.handles'));
assert.ok(wiring.includes('canonicalRecovery:Boolean(window.LovableDecrypterCanonicalContinuityRecoveryApi)'));
assert.ok(pkg.paths.includes('content/canonical-continuity-recovery-client.js'));
assert.ok(pkg.forbidden_roots.includes('ui'));
assert.ok(pkg.forbidden_roots.includes('diagnostic'));
for (const forbidden of ['ui/', 'diagnostic/']) assert.ok(!JSON.stringify(manifest).includes(forbidden), `forbidden active path: ${forbidden}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'ld-build90-canonical-continuity-recovery/1',
  version: manifest.version,
  continuity: true,
  checkpointsVisible: true,
  ambiguousWriteVerification: true,
  automaticWriteRetry: false,
  smartUndoRedo: 'preview-confirm-preserve',
  cascadeExposed: false
}, null, 2));
