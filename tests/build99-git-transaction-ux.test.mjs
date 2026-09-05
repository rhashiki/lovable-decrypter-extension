import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  GIT_TRANSACTION_SCHEMA,
  committedTransactionOperations,
  proveTransactionCommitSpan,
  safeCompareProjection,
  gitTransactionFingerprint
} from '../core/git-transaction.js';

const op = (sha, at, branch = 'main', taskId = 'task-99') => ({
  id: `op-${sha.slice(0, 6)}`,
  status: 'ok',
  mode: 'write',
  origin: 'ai',
  tool: 'repo.patch_apply',
  finishedAt: at,
  context: { branch, taskId, projectId: 'project-99' },
  result: { commitSha: sha, branch }
});

const sha1 = '1'.repeat(40);
const sha2 = '2'.repeat(40);
const foreign = 'f'.repeat(40);
const operations = [
  op(sha2, '2026-09-05T10:02:00Z'),
  op(sha1, '2026-09-05T10:01:00Z'),
  { ...op('3'.repeat(40), '2026-09-05T10:03:00Z'), origin: 'undo', tool: 'git_transaction.revert' },
  { ...op(sha1, '2026-09-05T10:04:00Z'), id: 'duplicate-sha' }
];
const committed = committedTransactionOperations(operations);
assert.deepEqual(committed.map(row => row.result.commitSha), [sha1, sha2]);

const exact = proveTransactionCommitSpan(committed, { commits: [{ sha: sha1 }, { sha: sha2 }] });
assert.equal(exact.schema, GIT_TRANSACTION_SCHEMA);
assert.equal(exact.sameBranch, true);
assert.equal(exact.exactSpan, true);
assert.equal(exact.contiguous, true);
assert.equal(exact.partialRevertAllowed, false);

const contaminated = proveTransactionCommitSpan(committed, { commits: [{ sha: sha1 }, { sha: foreign }, { sha: sha2 }] });
assert.equal(contaminated.contiguous, false);
assert.deepEqual(contaminated.foreignCommits, [foreign]);

const splitBranch = proveTransactionCommitSpan([
  op(sha1, '2026-09-05T10:01:00Z', 'main'),
  op(sha2, '2026-09-05T10:02:00Z', 'feature')
], { commits: [{ sha: sha1 }, { sha: sha2 }] });
assert.equal(splitBranch.sameBranch, false);
assert.equal(splitBranch.contiguous, false);

const projection = safeCompareProjection({
  status: 'ahead',
  ahead_by: 2,
  total_commits: 2,
  files: [{ filename: 'src/App.tsx', status: 'modified', additions: 10, deletions: 3, changes: 13, patch: 'RAW_PATCH_MUST_NOT_SURFACE_99' }]
});
assert.equal(projection.files[0].path, 'src/App.tsx');
assert.equal(projection.files[0].patchIncluded, false);
assert.equal(JSON.stringify(projection).includes('RAW_PATCH_MUST_NOT_SURFACE_99'), false);

const fingerprint = gitTransactionFingerprint({
  transactionId: 'tx-99',
  projectId: 'project-99',
  branch: 'main',
  baseSha: 'a'.repeat(40),
  appliedSha: sha2,
  currentHead: 'b'.repeat(40),
  commitShas: [sha1, sha2],
  changes: [{ path: 'src/App.tsx', action: 'update', destructive: false, preview: 'RAW_DIFF' }],
  conflicts: []
});
assert.equal(fingerprint.commitShas.length, 2);
assert.equal(JSON.stringify(fingerprint).includes('RAW_DIFF'), false);

const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const runtimePackage = JSON.parse(fs.readFileSync('release/runtime-package.json', 'utf8'));
const worker = fs.readFileSync('background/service-worker-entry.js', 'utf8');
const runtime = fs.readFileSync('background/git-transaction-runtime.js', 'utf8');
const client = fs.readFileSync('content/canonical-git-transactions-client.js', 'utf8');
const ui = fs.readFileSync('launcher/canonical-git-transactions.js', 'utf8');
const guarded = fs.readFileSync('core/guarded-commit.js', 'utf8');

assert.equal(manifest.version, '2.6.99');
assert.match(manifest.version_name, /Build 99 .* Git Transaction UX/);
assert.equal(runtimePackage.candidate, '2.6.99');
const scripts = manifest.content_scripts.flatMap(item => item.js || []);
const txClient = scripts.indexOf('content/canonical-change-transactions-client.js');
const gitClient = scripts.indexOf('content/canonical-git-transactions-client.js');
const composer = scripts.indexOf('content/canonical-command-composer-client.js');
const gitUi = scripts.indexOf('launcher/canonical-git-transactions.js');
assert.ok(txClient >= 0 && gitClient > txClient, 'Git Transaction client must load after Change Transactions client');
assert.ok(composer > gitClient, 'Git Transaction client must load before Composer');
assert.ok(gitUi > composer, 'Git Transaction UI must load after canonical APIs');
assert.match(worker, /installGitTransactionRuntime/);

assert.match(runtime, /const \{ tx, taskId, github, operations \} = await transactionContext\(transactionId\)/);
assert.match(runtime, /taskId: computed\.taskId/);
assert.match(runtime, /computed\.taskId !== ticket\.taskId/);
assert.match(runtime, /GIT_TRANSACTION_REVERT_TASK_CHANGED/);
assert.match(runtime, /computed\.snapshot\.currentHead !== ticket\.headSha/);
assert.match(runtime, /currentFingerprint !== ticket\.fingerprint/);
assert.match(runtime, /payload\?\.humanDecision !== true/);
assert.match(runtime, /GIT_TRANSACTION_NON_CONTIGUOUS/);
assert.match(runtime, /GIT_TRANSACTION_MULTI_BRANCH_BLOCKED/);
assert.match(runtime, /GIT_TRANSACTION_APPLIED_NOT_ANCESTOR/);
assert.match(runtime, /GIT_TRANSACTION_SENSITIVE_PATH_BLOCKED/);
assert.match(runtime, /GIT_TRANSACTION_NON_TEXT_BLOCKED/);
assert.match(runtime, /GIT_TRANSACTION_ALREADY_REVERTED/);
assert.match(runtime, /buildReversalPlan/);
assert.match(runtime, /strategy: 'preserve'/);
assert.match(runtime, /computed\.adapter\.atomicCommit/);
assert.match(runtime, /createBranch: false/);
assert.match(runtime, /createPr: false/);
assert.match(runtime, /partialRevertAllowed: false/);
assert.match(runtime, /rawPatchDurablePersistence: false/);
assert.doesNotMatch(runtime, /\.createCommit\(|\.updateBranch\(|\.deleteBranch\(/, 'Git Transaction runtime must not bypass Guarded Commit');

assert.match(guarded, /prepareShadowBuild/);
assert.match(guarded, /runRegressionSentinel/);
assert.match(guarded, /runValidationGate/);
assert.match(guarded, /createCheckpoint/);
assert.match(guarded, /verifyPublishedCheckpoint/);

assert.match(client, /humanDecision!==true/);
assert.match(client, /directGitWrite:false/);
assert.match(client, /directCommitAuthority:false/);
assert.match(client, /partialRevertAllowed:false/);
assert.doesNotMatch(client, /createCommit|updateBranch|deleteBranch|atomicCommit/);

assert.match(ui, /Commit cards/);
assert.match(ui, /BASE .* APPLIED .* HEAD/);
assert.match(ui, /Não será oferecido fallback parcial/);
assert.match(ui, /Confirmo que revisei o intervalo completo/);
assert.match(ui, /humanDecision:true/);
assert.match(ui, /partialRevertAllowed:false/);
assert.doesNotMatch(ui, /innerHTML/);
assert.doesNotMatch(ui, /createCommit|updateBranch|deleteBranch|atomicCommit/);

console.log('Build 99 Git Transaction UX adversarial contract: OK');
