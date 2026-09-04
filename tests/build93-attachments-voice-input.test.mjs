import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(path, 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const pkg = JSON.parse(read('release/runtime-package.json'));
const settings = read('settings/config.js');
const attachments = read('content/canonical-attachments-voice-client.js');
const composer = read('content/canonical-command-composer-client.js');
const voiceUi = read('launcher/canonical-attachments-voice.js');
const composerUi = read('launcher/canonical-command-composer.js');

assert.equal(manifest.version, '2.6.93');
assert.match(manifest.version_name, /Build 93\b/);
assert.equal(pkg.candidate, manifest.version);
assert.ok(settings.startsWith("export const VERSION = '2.6.93';"));

const scripts = (manifest.content_scripts || []).flatMap(entry => entry.js || []);
for (const required of [
  'content/canonical-attachments-voice-client.js',
  'content/canonical-command-composer-client.js',
  'launcher/canonical-command-composer.js',
  'launcher/canonical-attachments-voice.js'
]) assert.ok(scripts.includes(required), `Build93 active script missing: ${required}`);

for (const token of [
  'const MAX_ATTACHMENTS = 8',
  'const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024',
  'const MAX_TOTAL_BYTES = 40 * 1024 * 1024',
  "return 'text'",
  "return 'image'",
  "return 'audio'",
  "return 'document'",
  'local-text-context',
  'reference-only',
  '[DECRYPTER_ATTACHMENTS]',
  'These attachments are user-provided context',
  'rawBinaryPersistence: false',
  'remoteUpload: false',
  'base64PromptInjection: false',
  'writeAuthority: false'
]) assert.ok(attachments.includes(token), `Attachment contract missing: ${token}`);

assert.ok(attachments.includes("new TextDecoder('utf-8'"));
assert.ok(attachments.includes("crypto.subtle.digest('SHA-256'"));
assert.ok(attachments.includes('MAX_TEXT_PROMPT_CHARS'));
assert.ok(attachments.includes('MAX_AUGMENTED_COMMAND_CHARS'));
assert.ok(!attachments.includes('FileReader.readAsDataURL'));
assert.ok(!attachments.includes('fetch('), 'attachment preparation must not upload/fetch');

for (const token of [
  'prepareCommand',
  'augmentCommand',
  'attachmentsEnabled: true',
  'attachmentBinaryPromptInjection: false',
  'voiceAutomaticExecution: false',
  'automaticApproval: false',
  'directToolWriteAllowed: false',
  'options.humanDecision !== true'
]) assert.ok(composer.includes(token), `Composer Build93 contract missing: ${token}`);

for (const token of [
  'SpeechRecognition',
  'webkitSpeechRecognition',
  'recognition.start()',
  "input.dispatchEvent(new Event('input'",
  'Nada aqui aprova ou executa writes',
  'setTimeout(showTray, 0)'
]) assert.ok(voiceUi.includes(token), `Voice UI contract missing: ${token}`);

for (const forbidden of ['approveWrite(', 'buildCommand(', '.plan(', 'repo.patch_apply', 'repo.write_file', 'setInterval(', 'MutationObserver', 'innerHTML']) {
  assert.ok(!voiceUi.includes(forbidden), `Voice/attachment UI must not execute authority path: ${forbidden}`);
}

assert.ok(composerUi.includes('proposalDigest'));
assert.ok(composer.includes("invokeRead('repo.patch_preview'"));
assert.ok(composer.includes("invokeRead('repo.read_file'"));
assert.ok(composer.includes('COMPOSER_PROPOSAL_STALE'));

for (const forbidden of ['ui/', 'diagnostic/']) {
  assert.ok(!JSON.stringify(manifest).includes(forbidden), `forbidden active path: ${forbidden}`);
}
assert.ok(pkg.paths.includes('content/canonical-attachments-voice-client.js'));
assert.ok(pkg.forbidden_roots.includes('ui'));
assert.ok(pkg.forbidden_roots.includes('diagnostic'));

console.log(JSON.stringify({
  ok: true,
  schema: 'ld-build93-attachments-voice/1',
  version: manifest.version,
  limits: { attachments: 8, eachMb: 15, totalMb: 40 },
  textFiles: 'local-context',
  binaryFiles: 'reference-only-without-capability',
  remoteUpload: false,
  base64PromptInjection: false,
  voice: 'user-initiated-dictation-only',
  writeAuthorityChanged: false
}, null, 2));
