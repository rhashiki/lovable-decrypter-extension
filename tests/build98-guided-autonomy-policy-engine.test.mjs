import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  evaluateAutonomyPolicy,
  normalizeAutonomyMode,
  AUTONOMY_POLICY_SCHEMA
} from '../core/guided-autonomy-policy.js';

const patch = (path='src/App.tsx', edits=1) => ({
  tool: 'repo.patch_apply',
  input: { patches: [{ path, expectedBlobSha: 'a'.repeat(40), edits: Array.from({ length: edits }, (_, i) => ({ search: `old${i}`, replace: `new${i}` })) }] }
});
const write = (action='update', path='src/App.tsx', content='export default 1;') => ({ tool:'repo.write_file', input:{ action, path, expectedBlobSha:'a'.repeat(40), content } });

assert.equal(AUTONOMY_POLICY_SCHEMA, 'ld-guided-autonomy-policy/1');
assert.equal(normalizeAutonomyMode('garbage'), 'manual');
assert.equal(evaluateAutonomyPolicy({ mode:'manual', ...patch() }).decision, 'ASK');
assert.equal(evaluateAutonomyPolicy({ mode:'guided', ...patch() }).decision, 'AUTO');
assert.equal(evaluateAutonomyPolicy({ mode:'autonomous', ...patch() }).decision, 'AUTO');
assert.equal(evaluateAutonomyPolicy({ mode:'guided', ...write('create','src/new-file.ts') }).decision, 'AUTO');
assert.equal(evaluateAutonomyPolicy({ mode:'autonomous', ...write('update') }).decision, 'AUTO');
assert.equal(evaluateAutonomyPolicy({ mode:'autonomous', ...write('delete') }).decision, 'ALWAYS_ASK');
assert.equal(evaluateAutonomyPolicy({ mode:'autonomous', capability:'DATABASE', action:'DATABASE_WRITE' }).decision, 'ALWAYS_ASK');
assert.equal(evaluateAutonomyPolicy({ mode:'autonomous', action:'DATABASE_DESTRUCTIVE' }).decision, 'ALWAYS_ASK');
assert.equal(evaluateAutonomyPolicy({ mode:'autonomous', action:'GIT_PUSH' }).decision, 'ALWAYS_ASK');
assert.equal(evaluateAutonomyPolicy({ mode:'autonomous', action:'DEPLOY' }).decision, 'ALWAYS_ASK');
assert.equal(evaluateAutonomyPolicy({ mode:'autonomous', action:'DEPENDENCY_INSTALL' }).decision, 'ASK');
assert.equal(evaluateAutonomyPolicy({ mode:'autonomous', tool:'repo.read_file', input:{ paths:['src/App.tsx'] } }).decision, 'AUTO');
assert.equal(evaluateAutonomyPolicy({ mode:'autonomous', tool:'diagnostics.run' }).decision, 'AUTO');
assert.equal(evaluateAutonomyPolicy({ mode:'autonomous', tool:'unknown.tool' }).decision, 'ASK');
assert.equal(evaluateAutonomyPolicy({ mode:'autonomous', ...patch('.env') }).decision, 'DENY');
assert.equal(evaluateAutonomyPolicy({ mode:'autonomous', ...patch('../escape.ts') }).decision, 'DENY');
assert.equal(evaluateAutonomyPolicy({ mode:'autonomous', ...patch(), riskSignals:{ scopeViolation:true } }).decision, 'DENY');
assert.equal(evaluateAutonomyPolicy({ mode:'autonomous', ...patch(), riskSignals:{ humanIntentConflict:true } }).decision, 'DENY');
assert.equal(evaluateAutonomyPolicy({ mode:'autonomous', ...patch(), riskSignals:{ proposalTampered:true } }).decision, 'DENY');
assert.equal(evaluateAutonomyPolicy({ mode:'guided', ...patch('src/App.tsx',17) }).decision, 'ASK');
assert.equal(evaluateAutonomyPolicy({ mode:'autonomous', ...patch('src/App.tsx',41) }).decision, 'ASK');
assert.equal(evaluateAutonomyPolicy({ mode:'guided', ...write('update','src/App.tsx','x'.repeat(80001)) }).decision, 'ASK');

const auto = evaluateAutonomyPolicy({ mode:'guided', ...patch() });
assert.equal(auto.automaticEligible, true);
assert.equal(auto.writer, false);
assert.equal(auto.approvalAuthority, false);
assert.equal(auto.constraints.databaseAutoApproval, false);
assert.equal(auto.constraints.deployAutoApproval, false);
assert.equal(auto.constraints.gitPushAutoApproval, false);
assert.equal(auto.constraints.destructiveAutoApproval, false);
assert.equal(auto.constraints.callerSuppliedDecisionTrusted, false);
assert.equal(auto.constraints.humanIntentOverridesAllowedForAuto, false);
for (const gate of ['proposalDigest','currentHead','scopeIntelligence','humanIntent','toolRuntime','continuity','guardedCommit']) assert.equal(auto.mandatoryGates[gate], true);

const manifest = JSON.parse(fs.readFileSync('manifest.json','utf8'));
const runtimePackage = JSON.parse(fs.readFileSync('release/runtime-package.json','utf8'));
const orchestrator = fs.readFileSync('background/local-agent-orchestrator.js','utf8');
const runtime = fs.readFileSync('background/autonomy-policy-runtime.js','utf8');
const client = fs.readFileSync('content/canonical-autonomy-policy-client.js','utf8');
const ui = fs.readFileSync('launcher/canonical-guided-autonomy.js','utf8');
const worker = fs.readFileSync('background/service-worker-entry.js','utf8');

assert.equal(manifest.version,'2.6.98');
assert.match(manifest.version_name,/Build 98 .* Guided Autonomy/);
assert.equal(runtimePackage.candidate,'2.6.98');
const scripts=manifest.content_scripts.flatMap(x=>x.js||[]);
const policyClient=scripts.indexOf('content/canonical-autonomy-policy-client.js');
const composer=scripts.indexOf('content/canonical-command-composer-client.js');
const policyUi=scripts.indexOf('launcher/canonical-guided-autonomy.js');
assert.ok(policyClient>=0 && composer>policyClient,'Policy client must load before Composer');
assert.ok(policyUi>composer,'Guided Autonomy UI must load after canonical clients');
assert.match(worker,/installAutonomyPolicyRuntime/);

assert.match(runtime,/writer: false/);
assert.match(runtime,/approvalAuthority: false/);
assert.match(runtime,/callerSuppliedDecisionTrusted: false/);
assert.match(runtime,/safetyFloorMutable: false/);
assert.match(runtime,/databaseAutoApproval: false/);
assert.match(runtime,/destructiveAutoApproval: false/);
assert.doesNotMatch(runtime,/repo\.write_file|repo\.patch_apply|createCommit|updateBranch|git push/i);
assert.match(client,/writer: false/);
assert.match(client,/approvalAuthority: false/);
assert.match(client,/callerSuppliedDecisionTrusted: false/);
assert.doesNotMatch(client,/repo\.write_file|repo\.patch_apply|createCommit|updateBranch/);
assert.match(ui,/writer:false/);
assert.match(ui,/approvalAuthority:false/);
assert.match(ui,/safetyFloorMutable:false/);
assert.doesNotMatch(ui,/innerHTML/);
assert.doesNotMatch(ui,/repo\.write_file|repo\.patch_apply|createCommit|updateBranch/);

assert.match(orchestrator,/evaluatePendingPolicy\(pending\)/);
assert.match(orchestrator,/const policyDecision=await evaluatePendingPolicy\(pending\)/);
assert.match(orchestrator,/authorizationKind==='policy'/);
assert.match(orchestrator,/humanDecision:authorizationKind==='human'/);
assert.match(orchestrator,/source:authorizationKind==='policy'\?'guided-autonomy-policy-v98':'local-agent-v68'/);
assert.match(orchestrator,/effectiveOverrides=authorizationKind==='human'/);
assert.match(orchestrator,/humanIntentOverrides:kind==='human'\?humanIntentOverrides:\[\]/);
assert.match(orchestrator,/assertScopeIntelligence/);
assert.match(orchestrator,/invokeToolRuntimeAction\('invoke'/);
assert.match(orchestrator,/workerId:kind==='policy'\?'policy-v98':'human-decision'/);
assert.match(orchestrator,/AUTONOMY_POLICY_DENIED/);
assert.match(orchestrator,/callerSuppliedPolicyDecisionTrusted:false/);
assert.match(orchestrator,/destructiveWritesRequireHumanApproval:true/);
assert.doesNotMatch(orchestrator,/payload\?\.policyDecision|payload\.policyDecision/,'caller must not be able to submit a trusted policy decision');

console.log('Build 98 Guided Autonomy + Policy Engine adversarial contract: OK');
