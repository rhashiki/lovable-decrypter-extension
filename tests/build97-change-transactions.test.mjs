import assert from 'node:assert/strict';
import fs from 'node:fs';

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
  getChangeTransaction,
  listChangeTransactions,
  CHANGE_TRANSACTIONS_KEY
} = await import('../core/change-transactions.js');

const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const runtimeSource = fs.readFileSync('background/change-transaction-runtime.js', 'utf8');
const clientSource = fs.readFileSync('content/canonical-change-transactions-client.js', 'utf8');
const uiSource = fs.readFileSync('launcher/canonical-change-transactions.js', 'utf8');
const composerSource = fs.readFileSync('content/canonical-command-composer-client.js', 'utf8');
const serviceWorkerSource = fs.readFileSync('background/service-worker-entry.js', 'utf8');
const databaseRuntimeSource = fs.readFileSync('background/database-runtime.js', 'utf8');

assert.equal(manifest.version, '2.6.97');
assert.match(manifest.version_name, /Build 97 .* Change Transactions/);
const scripts = manifest.content_scripts.flatMap(item => item.js || []);
const reversibleIndex = scripts.indexOf('content/reversible-operations-client.js');
const txClientIndex = scripts.indexOf('content/canonical-change-transactions-client.js');
const composerIndex = scripts.indexOf('content/canonical-command-composer-client.js');
const txUiIndex = scripts.indexOf('launcher/canonical-change-transactions.js');
assert.ok(reversibleIndex >= 0 && txClientIndex > reversibleIndex, 'reversible client must load before change transaction client');
assert.ok(composerIndex > txClientIndex, 'change transaction client must load before composer client');
assert.ok(txUiIndex > composerIndex, 'change transaction UI must load after canonical APIs');
assert.match(serviceWorkerSource, /installChangeTransactionRuntime/);

const RAW_PROMPT = 'RAW_PROMPT_MUST_NEVER_PERSIST_97';
const RAW_SQL = 'DROP TABLE raw_sql_must_never_persist_97';
const RAW_DIFF = '+ RAW_DIFF_MUST_NEVER_PERSIST_97';
const RAW_FILE = 'RAW_FILE_CONTENT_MUST_NEVER_PERSIST_97';

const created = await createChangeTransaction({
  projectId: 'project-97',
  mode: 'build',
  status: 'waiting_approval',
  commandDigest: 'a'.repeat(64),
  rawPrompt: RAW_PROMPT,
  intent: { label: 'CODE · BUILD', rawPrompt: RAW_PROMPT },
  capabilityRoute: { resolved: true, requiredCapabilities: ['CODE'], primaryCapability: 'CODE' },
  plan: {
    summary: 'Alterar componente com segurança.',
    plan: ['Ler', 'Editar', 'Validar'],
    files: [{ path: 'src/App.tsx', reason: 'UI' }],
    rawPrompt: RAW_PROMPT
  },
  review: {
    proposalDigest: 'b'.repeat(64),
    tool: 'repo.write_file',
    files: [{ path: 'src/App.tsx', action: 'update', addedLines: 2, removedLines: 1, preview: RAW_DIFF, content: RAW_FILE }]
  },
  database: {
    ticketId: 'ticket-97',
    sqlHash: 'c'.repeat(64),
    risk: 'CAUTION',
    status: 'prepared',
    sql: RAW_SQL
  }
});

assert.equal(created.schema, 'ld-change-transaction/1');
assert.equal(created.authority.writer, false);
assert.equal(created.authority.approvalAuthority, false);
assert.equal(created.privacy.rawPromptPersisted, false);
assert.equal(created.privacy.rawSqlPersisted, false);
assert.equal(created.privacy.rawDiffPersisted, false);
assert.equal(created.privacy.rawFileContentPersisted, false);

let serialized = JSON.stringify(local.get(CHANGE_TRANSACTIONS_KEY));
for (const forbidden of [RAW_PROMPT, RAW_SQL, RAW_DIFF, RAW_FILE]) {
  assert.ok(!serialized.includes(forbidden), `forbidden raw payload persisted: ${forbidden}`);
}
assert.ok(serialized.includes('src/App.tsx'), 'safe path metadata should persist');
assert.ok(serialized.includes('ticket-97'), 'database ticket reference should persist');
assert.ok(serialized.includes('a'.repeat(64)), 'intent digest should persist');

const patched = await patchChangeTransaction(created.id, {
  status: 'completed',
  links: { taskId: 'task-97', approvalTransactionIds: ['approval-97'], operationIds: ['operation-97'] },
  database: { ticketId: 'ticket-97', status: 'applied', sql: RAW_SQL },
  recovery: { status: 'applied', sourceOperationId: 'operation-97', reversalOperationId: 'reversal-97', commitSha: 'd'.repeat(40), direction: 'undo', strategy: 'preserve' }
});
assert.equal(patched.links.taskId, 'task-97');
assert.equal(patched.database.status, 'applied');
assert.equal(patched.recovery.sourceOperationId, 'operation-97');
serialized = JSON.stringify(local.get(CHANGE_TRANSACTIONS_KEY));
assert.ok(!serialized.includes(RAW_SQL));
assert.equal((await getChangeTransaction(created.id)).id, created.id);
assert.equal((await listChangeTransactions({ projectId: 'project-97' })).length, 1);

assert.match(runtimeSource, /projectionOnly: true/);
assert.match(runtimeSource, /writeAuthority: false/);
assert.match(runtimeSource, /approvalAuthority: false/);
assert.match(runtimeSource, /rawPromptPersistence: false/);
assert.match(runtimeSource, /rawSqlPersistence: false/);
assert.match(runtimeSource, /rawDiffPersistence: false/);
assert.match(runtimeSource, /listOperationJournal/);
assert.match(runtimeSource, /getContinuityTask/);
assert.match(runtimeSource, /resolveTransactionId/);
assert.match(runtimeSource, /ticketId/);
assert.match(runtimeSource, /operationJournal: 'evidence'/);
assert.match(runtimeSource, /reversibleOperations: 'revert'/);
assert.doesNotMatch(runtimeSource, /repo\.write_file|repo\.patch_apply|atomicCommit|createCommit|updateBranch/);

assert.match(clientSource, /CHANGE_TRANSACTION_REVERT_HUMAN_DECISION_REQUIRED/);
assert.match(clientSource, /options\.humanDecision !== true/);
assert.match(clientSource, /reversible\(\)\.preview/);
assert.match(clientSource, /reversible\(\)\.apply/);
assert.match(clientSource, /projectionOnly: true/);
assert.match(clientSource, /writeAuthority: false/);
assert.match(clientSource, /approvalAuthority: false/);
assert.doesNotMatch(clientSource, /repo\.write_file|repo\.patch_apply|atomicCommit|createCommit|updateBranch/);

assert.match(uiSource, /Review/);
assert.match(uiSource, /Explain/);
assert.match(uiSource, /Preparar Revert/);
assert.match(uiSource, /data-ld97-revert-confirm/);
assert.match(uiSource, /humanDecision: true/);
assert.match(uiSource, /confirmDestructive: plan\.destructive === true/);
assert.match(uiSource, /directWriteAuthority: false/);
assert.match(uiSource, /directApprovalAuthority: false/);
assert.doesNotMatch(uiSource, /innerHTML/);
assert.doesNotMatch(uiSource, /repo\.write_file|repo\.patch_apply|atomicCommit|createCommit|updateBranch/);

assert.match(composerSource, /changeTransactionsEnabled: true/);
assert.match(composerSource, /changeTransactionProjectionOnly: true/);
assert.match(composerSource, /changeTransactionId/);
assert.match(composerSource, /codeReview/);
assert.match(composerSource, /databaseResult/);

assert.match(databaseRuntimeSource, /reconcileChangeTransaction/);
assert.match(databaseRuntimeSource, /row\?\.database\?\.ticketId === ticketId/);
assert.match(databaseRuntimeSource, /verification_required/);
assert.match(databaseRuntimeSource, /Projection reconciliation must never alter Database Runtime success\/failure semantics/);
assert.doesNotMatch(databaseRuntimeSource, /sql:[^\n]*payload|rawSql|rawPrompt/);

console.log('Build 97 Change Transactions adversarial contract: OK');
