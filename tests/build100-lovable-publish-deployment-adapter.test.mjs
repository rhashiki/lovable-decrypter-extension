import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  LOVABLE_MCP_ENDPOINT,
  LOVABLE_DEPLOY_TOOL,
  isOfficialLovableMcpEndpoint,
  selectOfficialLovableMcpServer,
  validateLovableDeployPolicies,
  safeLiveUrl,
  projectObservationFromMcp,
  deploymentResultFromMcp,
  deploymentOutcomeClassification,
  deploymentFingerprint
} from '../core/lovable-deployment-adapter.js';
import { evaluateAutonomyPolicy } from '../core/guided-autonomy-policy.js';

const local = new Map();
globalThis.chrome = {
  storage: {
    local: {
      async get(key) {
        if (typeof key === 'string') return { [key]: local.get(key) };
        const out = {};
        for (const item of Array.isArray(key) ? key : []) out[item] = local.get(item);
        return out;
      },
      async set(values) { for (const [key, value] of Object.entries(values || {})) local.set(key, value); }
    }
  }
};

const {
  createChangeTransaction,
  patchChangeTransaction,
  CHANGE_TRANSACTIONS_KEY
} = await import('../core/change-transactions.js');

const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const runtimePackage = JSON.parse(fs.readFileSync('release/runtime-package.json', 'utf8'));
const adapterSource = fs.readFileSync('core/lovable-deployment-adapter.js', 'utf8');
const runtimeSource = fs.readFileSync('background/lovable-deployment-runtime.js', 'utf8');
const clientSource = fs.readFileSync('content/canonical-lovable-deployment-client.js', 'utf8');
const uiSource = fs.readFileSync('launcher/canonical-lovable-deployment.js', 'utf8');
const serviceWorkerSource = fs.readFileSync('background/service-worker-entry.js', 'utf8');
const composerSource = fs.readFileSync('content/canonical-command-composer-client.js', 'utf8');
const localAgentSource = fs.readFileSync('background/local-agent-orchestrator.js', 'utf8');

assert.equal(manifest.version, '2.6.100');
assert.match(manifest.version_name, /Build 100 .* Lovable Publish \/ Deployment Adapter/);
assert.equal(runtimePackage.candidate, '2.6.100');
const scripts = manifest.content_scripts.flatMap(item => item.js || []);
const projectStateIndex = scripts.indexOf('content/canonical-project-state-client.js');
const mcpRuntimeIndex = scripts.indexOf('content/mcp-runtime-client.js');
const deployClientIndex = scripts.indexOf('content/canonical-lovable-deployment-client.js');
const composerIndex = scripts.indexOf('content/canonical-command-composer-client.js');
const deployUiIndex = scripts.indexOf('launcher/canonical-lovable-deployment.js');
assert.ok(projectStateIndex >= 0 && deployClientIndex > projectStateIndex, 'Project State must load before deployment client');
assert.ok(mcpRuntimeIndex >= 0 && deployClientIndex > mcpRuntimeIndex, 'MCP runtime must load before deployment client');
assert.ok(composerIndex > deployClientIndex, 'deployment client must load before composer');
assert.ok(deployUiIndex > composerIndex, 'deployment UI must load after canonical APIs');
assert.ok(runtimePackage.paths.includes('content/canonical-lovable-deployment-client.js'));
assert.match(serviceWorkerSource, /installLovableDeploymentRuntime/);

assert.equal(LOVABLE_MCP_ENDPOINT, 'https://mcp.lovable.dev/');
assert.equal(LOVABLE_DEPLOY_TOOL, 'deploy_project');
assert.equal(isOfficialLovableMcpEndpoint('https://mcp.lovable.dev'), true);
assert.equal(isOfficialLovableMcpEndpoint('https://mcp.lovable.dev/'), true);
assert.equal(isOfficialLovableMcpEndpoint('https://evil.example/mcp'), false);
assert.equal(isOfficialLovableMcpEndpoint('http://mcp.lovable.dev'), false);
const selected = selectOfficialLovableMcpServer([
  { id: 'evil', endpoint: 'https://evil.example/mcp', trust: 'approved' },
  { id: 'pending', endpoint: 'https://mcp.lovable.dev', trust: 'pending' },
  { id: 'approved', endpoint: 'https://mcp.lovable.dev/', trust: 'approved' }
]);
assert.equal(selected.id, 'approved');

const PROJECT = 'project-100-demo';
const scopedServer = {
  toolPolicies: {
    get_project: {
      enabled: true,
      mode: 'read',
      allowedArgumentKeys: ['project_id'],
      constraints: { project_id: { equals: PROJECT } }
    },
    deploy_project: {
      enabled: true,
      mode: 'write',
      allowedArgumentKeys: ['project_id'],
      constraints: { project_id: { equals: PROJECT } }
    }
  }
};
assert.equal(validateLovableDeployPolicies(scopedServer, PROJECT).ready, true);
assert.equal(validateLovableDeployPolicies(scopedServer, 'another-project').ready, false);
assert.equal(validateLovableDeployPolicies({
  toolPolicies: {
    ...scopedServer.toolPolicies,
    deploy_project: { ...scopedServer.toolPolicies.deploy_project, allowedArgumentKeys: ['project_id', 'unexpected'] }
  }
}, PROJECT).ready, false);

assert.equal(safeLiveUrl('https://demo.lovable.app'), 'https://demo.lovable.app/');
assert.equal(safeLiveUrl('https://demo.lovable.app/path#secret'), 'https://demo.lovable.app/path');
assert.equal(safeLiveUrl('http://demo.lovable.app'), '');
assert.equal(safeLiveUrl('https://lovable.app.evil.example'), '');

const commitSha = 'a'.repeat(40);
const observed = projectObservationFromMcp({
  result: {
    structuredContent: {
      project_id: PROJECT,
      latest_commit_sha: commitSha,
      live_url: 'https://demo.lovable.app'
    }
  }
}, PROJECT);
assert.equal(observed.projectMatches, true);
assert.equal(observed.latestCommitSha, commitSha);
assert.equal(observed.liveUrl, 'https://demo.lovable.app/');
assert.equal(observed.rawResultPersisted, false);

const deployed = deploymentResultFromMcp({
  result: { content: [{ type: 'text', text: JSON.stringify({ project_id: PROJECT, live_url: 'https://demo.lovable.app', status: 'deployed' }) }] }
}, PROJECT);
assert.equal(deployed.projectMatches, true);
assert.equal(deployed.liveUrl, 'https://demo.lovable.app/');
assert.equal(deployed.rawResultPersisted, false);

const securityError = Object.assign(new Error('provider refused'), { code: 'MCP_REMOTE_ERROR', remoteData: { code: 'security_critical_findings' } });
assert.deepEqual(deploymentOutcomeClassification(securityError), { definitive: true, verificationRequired: false, code: 'LOVABLE_DEPLOY_SECURITY_BLOCKED' });
const timeoutError = Object.assign(new Error('timeout'), { code: 'MCP_TIMEOUT' });
assert.deepEqual(deploymentOutcomeClassification(timeoutError), { definitive: false, verificationRequired: true, code: 'LOVABLE_DEPLOY_OUTCOME_AMBIGUOUS' });

const policy = evaluateAutonomyPolicy({ mode: 'autonomous', capability: 'DEPLOY', action: 'DEPLOY' });
assert.equal(policy.decision, 'ALWAYS_ASK');
assert.equal(policy.automaticEligible, false);
assert.equal(policy.humanRequired, true);

const fingerprint = deploymentFingerprint({
  projectId: PROJECT,
  transactionId: 'tx-100',
  taskId: 'task-100',
  serverId: 'server-100',
  expectedCommitSha: commitSha,
  liveUrl: 'https://demo.lovable.app',
  status: 'verified'
});
assert.equal(fingerprint.endpoint, 'https://mcp.lovable.dev/');
assert.equal(fingerprint.tool, 'deploy_project');
assert.equal(fingerprint.automaticRetry, false);

const RAW_MCP = 'RAW_MCP_RESULT_MUST_NEVER_PERSIST_100';
const RAW_TOKEN = 'Bearer super-secret-deploy-token-100';
const tx = await createChangeTransaction({
  projectId: PROJECT,
  mode: 'build',
  commandDigest: 'b'.repeat(64),
  intent: { digest: 'b'.repeat(64), label: 'DEPLOY · Lovable' },
  capabilityRoute: { resolved: true, requiredCapabilities: ['DEPLOY'], primaryCapability: 'DEPLOY' },
  deployment: {
    provider: 'lovable',
    transport: 'mcp',
    serverId: 'server-100',
    projectId: PROJECT,
    taskId: 'task-100',
    ticketId: 'ticket-100',
    mcpApprovalId: 'approval-100',
    expectedCommitSha: commitSha,
    status: 'prepared',
    liveUrl: 'https://demo.lovable.app',
    rawResult: RAW_MCP,
    token: RAW_TOKEN
  }
});
await patchChangeTransaction(tx.id, { deployment: { status: 'verified', rawMcpResponse: RAW_MCP, accessToken: RAW_TOKEN } });
const serialized = JSON.stringify(local.get(CHANGE_TRANSACTIONS_KEY));
assert.ok(!serialized.includes(RAW_MCP));
assert.ok(!serialized.includes(RAW_TOKEN));
assert.ok(serialized.includes('ticket-100'));
assert.ok(serialized.includes('https://demo.lovable.app/'));
assert.equal(tx.privacy.rawDeploymentResultPersisted, false);

assert.match(adapterSource, /LOVABLE_MCP_ENDPOINT = 'https:\/\/mcp\.lovable\.dev\/'/);
assert.match(adapterSource, /LOVABLE_DEPLOY_TOOL = 'deploy_project'/);
assert.match(adapterSource, /rawResultPersisted: false/);
assert.match(runtimeSource, /evaluateAutonomyPolicy\(\{ mode: 'autonomous', capability: 'DEPLOY', action: 'DEPLOY' \}\)/);
assert.match(runtimeSource, /decision\.decision !== 'ALWAYS_ASK'/);
assert.match(runtimeSource, /payload\?\.humanDecision !== true/);
assert.match(runtimeSource, /prepareMcpWriteApproval/);
assert.match(runtimeSource, /approveMcpWriteApproval/);
assert.match(runtimeSource, /allowedArgumentKeys: \['project_id'\]/);
assert.match(runtimeSource, /constraints: \{ project_id: \{ equals: projectId \} \}/);
assert.match(runtimeSource, /retrySafe: false, maxAttempts: 1/);
assert.match(runtimeSource, /client\.callTool\(ticket\.serverId, LOVABLE_DEPLOY_TOOL, \{ project_id: ticket\.projectId \}/);
assert.match(runtimeSource, /let deployOperationId = ''/);
assert.match(runtimeSource, /LOVABLE_DEPLOY_VERIFICATION_REQUIRED/);
assert.match(runtimeSource, /used: true, usedAt: nowIso\(\)/);
assert.match(runtimeSource, /allowUsed: true, allowExpired: true/);
assert.match(runtimeSource, /automaticRetry: false/);
assert.match(runtimeSource, /LOVABLE_DEPLOY_ROLLBACK_UNAVAILABLE/);
assert.doesNotMatch(runtimeSource, /api\.lovable\.dev/i);
assert.doesNotMatch(runtimeSource, /setInterval\s*\(/);
assert.doesNotMatch(runtimeSource, /fetch\s*\(/, 'deployment runtime must delegate transport to MCP client');

assert.match(clientSource, /humanDecision !== true/);
assert.match(clientSource, /approveAndRun/);
assert.match(clientSource, /automaticDeployAfterMutation: false/);
assert.match(clientSource, /automaticRetry: false/);
assert.doesNotMatch(clientSource, /fetch\s*\(/);
assert.doesNotMatch(clientSource, /callTool\s*\(/);

assert.match(uiSource, /Aprovar e publicar agora/);
assert.match(uiSource, /DEPLOY · ALWAYS ASK/);
assert.match(uiSource, /NO AUTO-RETRY/);
assert.match(uiSource, /privateRestPublishEndpointUsed: false/);
assert.doesNotMatch(uiSource, /innerHTML/);
assert.doesNotMatch(uiSource, /fetch\s*\(/);
assert.doesNotMatch(uiSource, /callTool\s*\(/);

assert.doesNotMatch(composerSource, /LovableDecrypterCanonicalLovableDeploymentApi|ld2-lovable-deployment/);
assert.doesNotMatch(localAgentSource, /LovableDecrypterLovableDeploymentRuntime|ld2-lovable-deployment/);

console.log('Build 100 Lovable Publish / Deployment Adapter adversarial contract: OK');
