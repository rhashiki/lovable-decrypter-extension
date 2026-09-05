import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  LOVABLE_DEPLOYMENT_SCHEMA,
  LOVABLE_DEPLOYMENT_BUILD,
  sanitizeDeploymentTransport,
  deploymentPreflightFingerprint,
  publicDeploymentReceipt,
  deploymentSafetyContract
} from '../core/lovable-deployment-adapter.js';

assert.equal(LOVABLE_DEPLOYMENT_BUILD, 100);
assert.equal(LOVABLE_DEPLOYMENT_SCHEMA, 'ld-lovable-deployment/1');

const absent = sanitizeDeploymentTransport({});
assert.equal(absent.available, false);
assert.equal(absent.homologated, false);
assert.equal(absent.capabilities.publish, false);

const unverified = sanitizeDeploymentTransport({ id:'future-browser-transport', provider:'lovable', homologated:false, publish(){}, verify(){} });
assert.equal(unverified.available, true);
assert.equal(unverified.homologated, false);
assert.equal(unverified.capabilities.publish, true);
assert.equal(unverified.capabilities.verify, true);
assert.equal(unverified.undocumentedEndpointUsed, false);

const verified = sanitizeDeploymentTransport({ id:'verified-transport', provider:'lovable', homologated:true, publish(){}, verify(){}, rollback(){}, redeploy(){} });
assert.equal(verified.homologated, true);
assert.equal(verified.capabilities.rollback, true);
assert.equal(verified.capabilities.redeploy, true);

const safety = deploymentSafetyContract();
assert.equal(safety.automaticPublish, false);
assert.equal(safety.publishAfterCommit, false);
assert.equal(safety.publishAfterBuild, false);
assert.equal(safety.humanConfirmationRequired, true);
assert.equal(safety.preflightRequired, true);
assert.equal(safety.headLockRequired, true);
assert.equal(safety.projectLockRequired, true);
assert.equal(safety.oneShotTicketRequired, true);
assert.equal(safety.ambiguousPublishRetryAllowed, false);
assert.equal(safety.undocumentedEndpointAllowed, false);
assert.equal(safety.writer, false);
assert.equal(safety.approvalAuthority, false);

const fingerprint = deploymentPreflightFingerprint({
  projectId:'project-100', transportId:'verified-transport', transportHomologated:true,
  git:{owner:'owner',repo:'repo',branch:'main',headSha:'A'.repeat(40)},
  lovable:{detected:true,contextProjectId:'project-100',gitSyncFullName:'owner/repo',gitSyncBranch:'main',sessionAvailable:true},
  blockers:['B','A'], activeTransactionCount:0,
  rawPrompt:'RAW_PROMPT_MUST_NOT_ENTER_FINGERPRINT', token:'SECRET'
});
const serializedFingerprint = JSON.stringify(fingerprint);
assert.equal(serializedFingerprint.includes('RAW_PROMPT_MUST_NOT_ENTER_FINGERPRINT'), false);
assert.equal(serializedFingerprint.includes('SECRET'), false);
assert.deepEqual(fingerprint.blockers, ['A','B']);
assert.equal(fingerprint.git.headSha, 'a'.repeat(40));

const receipt = publicDeploymentReceipt({
  id:'receipt-100', projectId:'project-100', transportId:'verified-transport', status:'published_verified',
  sourceHeadSha:'b'.repeat(40), deploymentId:'dep-1', deploymentUrl:'https://example.invalid',
  verification:{verified:true,observable:true,reason:'verified'}, rollbackAvailable:true, redeployAvailable:true,
  accessToken:'SECRET_TOKEN', providerPayload:{secret:'SECRET_PROVIDER_PAYLOAD'}
});
const serializedReceipt = JSON.stringify(receipt);
assert.equal(serializedReceipt.includes('SECRET_TOKEN'), false);
assert.equal(serializedReceipt.includes('SECRET_PROVIDER_PAYLOAD'), false);
assert.equal(receipt.rawProviderPayloadPersisted, false);
assert.equal(receipt.credentialsPersisted, false);

const manifest = JSON.parse(fs.readFileSync('manifest.json','utf8'));
const runtimePackage = JSON.parse(fs.readFileSync('release/runtime-package.json','utf8'));
const worker = fs.readFileSync('background/service-worker-entry.js','utf8');
const runtime = fs.readFileSync('background/lovable-deployment-runtime.js','utf8');
const client = fs.readFileSync('content/canonical-lovable-deployment-client.js','utf8');
const ui = fs.readFileSync('launcher/canonical-lovable-deployment.js','utf8');
const composer = fs.readFileSync('content/canonical-command-composer-client.js','utf8');
const agent = fs.readFileSync('background/local-agent-orchestrator.js','utf8');
const gitTx = fs.readFileSync('background/git-transaction-runtime.js','utf8');

assert.equal(manifest.version, '2.6.100');
assert.match(manifest.version_name, /Build 100 .* Lovable Deployment Adapter/);
assert.equal(runtimePackage.candidate, '2.6.100');
const scripts = manifest.content_scripts.flatMap(row => row.js || []);
const deployClient = scripts.indexOf('content/canonical-lovable-deployment-client.js');
const composerIndex = scripts.indexOf('content/canonical-command-composer-client.js');
const deployUi = scripts.indexOf('launcher/canonical-lovable-deployment.js');
assert.ok(deployClient >= 0 && composerIndex > deployClient, 'deployment client must load before Composer');
assert.ok(deployUi > composerIndex, 'deployment UI must load after canonical APIs');
assert.match(worker, /installLovableDeploymentRuntime/);

assert.doesNotMatch(runtime, /api\.lovable\.dev/i, 'Build100 must not guess a Lovable publish endpoint');
assert.doesNotMatch(runtime, /fetch\s*\(/, 'deployment runtime must delegate only to an explicitly registered transport');
assert.doesNotMatch(client, /fetch\s*\(/);
assert.doesNotMatch(ui, /fetch\s*\(/);
assert.doesNotMatch(ui, /innerHTML/);
assert.match(runtime, /LOVABLE_DEPLOY_TRANSPORT_UNAVAILABLE/);
assert.match(runtime, /LOVABLE_DEPLOY_TRANSPORT_NOT_HOMOLOGATED/);
assert.match(runtime, /LOVABLE_DEPLOY_TRANSPORT_INCOMPLETE/);
assert.match(runtime, /if \(!preflight\.ready\)/);
assert.match(runtime, /payload\?\.humanDecision !== true/);
assert.match(runtime, /preflight\.git\.headSha !== ticket\.headSha/);
assert.match(runtime, /fingerprint !== ticket\.fingerprint/);
assert.match(runtime, /used: true/);
assert.match(runtime, /LOVABLE_DEPLOY_OUTCOME_AMBIGUOUS/);
assert.match(runtime, /verificationRequired = true/);
assert.match(runtime, /CHANGE_TRANSACTION_VERIFICATION_REQUIRED/);
assert.match(runtime, /LOVABLE_GITSYNC_MAPPING_MISMATCH/);
assert.match(runtime, /rawProviderPayloadPersisted: false|publicDeploymentReceipt/);

assert.match(client, /automaticPublish: false/);
assert.match(client, /publishAfterCommit: false/);
assert.match(client, /ambiguousPublishRetryAllowed: false/);
assert.match(client, /options\.humanDecision !== true/);
assert.match(ui, /Nenhum transporte de publish homologado/);
assert.match(ui, /não inventa endpoint interno do Lovable/i);
assert.match(ui, /NO SILENT DEPLOY/);
assert.match(ui, /Confirmo que revisei o preflight/);
assert.match(ui, /humanDecision:true/);

for (const source of [composer, agent, gitTx]) {
  assert.doesNotMatch(source, /canonical-lovable-deployment|LovableDecrypterCanonicalLovableDeployment|ld2-lovable-deployment/, 'existing execution paths must not silently invoke deployment');
}

console.log('Build 100 Lovable Deployment Adapter adversarial contract: OK');
