import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const composerSource = fs.readFileSync('content/canonical-command-composer-client.js', 'utf8');
const dbClientSource = fs.readFileSync('content/canonical-database-runtime-client.js', 'utf8');
const bridgeSource = fs.readFileSync('background/database-runtime.js', 'utf8');
const backendSource = fs.readFileSync('supabase/functions/ld-database-runtime/index.ts', 'utf8');
const migrationSource = fs.readFileSync('supabase/migrations/20260904193000_build95_database_write_tickets.sql', 'utf8');
const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));

if (process.env.LD_SUCCESSOR_REGRESSION === '1') {
  const [, , patch = '0'] = String(manifest.version || '').split('.');
  assert.equal(String(manifest.version || '').startsWith('2.6.'), true);
  assert.ok(Number(patch) >= 95, 'successor regression requires Lovable Decrypter 2.6.95+');
} else {
  assert.equal(manifest.version, '2.6.95');
}
const scripts = manifest.content_scripts.flatMap(item => item.js || []);
assert.ok(scripts.includes('content/canonical-database-runtime-client.js'));
assert.ok(scripts.indexOf('content/canonical-database-runtime-client.js') < scripts.indexOf('content/canonical-command-composer-client.js'));

assert.match(migrationSource, /create table if not exists public\.ld_database_write_tickets/i);
assert.match(migrationSource, /sql_hash text not null/i);
assert.doesNotMatch(migrationSource, /^\s*sql\s+text\b/im, 'raw SQL must not have a persistence column');
assert.match(migrationSource, /enable row level security/i);
assert.match(migrationSource, /revoke all on table public\.ld_database_write_tickets from public, anon, authenticated/i);
assert.match(migrationSource, /grant all on table public\.ld_database_write_tickets to service_role/i);

assert.match(backendSource, /DATABASE_SQL_BLOCKED/);
assert.match(backendSource, /risk = blocked\.length \? "BLOCKED" : destructive\.length \? "DESTRUCTIVE" : caution\.length \? "CAUTION" : readOnly \? "SAFE" : "DESTRUCTIVE"/);
assert.match(backendSource, /body\.human_decision !== true/);
assert.match(backendSource, /body\.destructive_confirmation !== true \|\| evidence\.length < 8/);
assert.match(backendSource, /await shaHex\(sql\) !== String\(ticket\.sql_hash\)/);
assert.match(backendSource, /status: "running"/);
assert.match(backendSource, /DATABASE_WRITE_OUTCOME_AMBIGUOUS/);
assert.match(backendSource, /verification_required: true/);
assert.match(backendSource, /verification_only: true, automatic_retry: false/);
assert.match(backendSource, /requireScope\(session\.scope, "database:write"\)/);
assert.match(backendSource, /authorizedProject\(session\.accessToken, ref\)/);
assert.match(backendSource, /raw_sql_persistence: false, auto_retry_write: false/);
assert.match(backendSource, /CREATE TABLE sem ENABLE ROW LEVEL SECURITY/);
assert.match(backendSource, /CREATE TABLE sem GRANT explícito/);

assert.match(bridgeSource, /const ACTIONS = new Set\(\['status', 'introspect', 'prepare', 'ticket', 'approve', 'run', 'verify'\]\)/);
assert.match(bridgeSource, /DATABASE_WRITE_OUTCOME_AMBIGUOUS/);
assert.doesNotMatch(bridgeSource, /setInterval\s*\(/);
assert.doesNotMatch(bridgeSource, /chrome\.storage/);
assert.doesNotMatch(dbClientSource, /chrome\.storage/);
assert.match(dbClientSource, /browserStorageSqlAllowed: false/);
assert.match(dbClientSource, /automaticWriteRetry: false/);
assert.match(dbClientSource, /projectRefFromCanonicalMapping: true/);

const calls = [];
const context = {
  console,
  crypto: globalThis.crypto,
  window: null,
  location: { href: 'https://lovable.dev/projects/p1' }
};
context.window = context;
context.LovableDecrypterV2 = { getProjectId: () => 'lovable-project-1' };
context.LovableDecrypterCapabilityRouter = {
  route: async command => {
    if (command.includes('MIXED_TEST')) return { resolved: true, requiredCapabilities: ['CODE', 'DATABASE'], candidateCapabilities: [] };
    if (command.includes('CODE_TEST')) return { resolved: true, requiredCapabilities: ['CODE'], candidateCapabilities: [] };
    return { resolved: true, requiredCapabilities: ['DATABASE'], candidateCapabilities: ['CODE'] };
  }
};
context.LovableDecrypterCanonicalDatabaseRuntimeApi = {
  introspect: async () => { calls.push('db:introspect'); return { schema: [{ table_name: 'existing' }], mappedProject: { projectRef: 'abcdefgh', projectName: 'Demo' } }; },
  prepare: async sql => { calls.push(['db:prepare', sql]); return { ticket: { id: '11111111-1111-1111-1111-111111111111', risk: 'CAUTION' }, classification: { risk: 'CAUTION', notes: [] }, mappedProject: { projectRef: 'abcdefgh', projectName: 'Demo' } }; },
  approve: async () => { calls.push('db:approve'); return { ticket: { id: '11111111-1111-1111-1111-111111111111', status: 'approved' } }; },
  run: async (_id, sql) => { calls.push(['db:run', sql]); return { ticket: { id: '11111111-1111-1111-1111-111111111111', status: 'applied' } }; },
  verify: async () => { calls.push('db:verify'); return { verification_only: true, automatic_retry: false }; }
};
context.LovableDecrypterLocalAgent = {
  start: async command => { calls.push(['agent:start', command]); return { status: 'completed', result: { summary: 'ok' } }; },
  approveWrite: async () => ({}), cancel: async () => ({}), get: async () => ({})
};
context.LovableDecrypterCanonicalToolsApi = { invokeRead: async () => ({}) };
vm.createContext(context);
vm.runInContext(composerSource, context, { filename: 'canonical-command-composer-client.js' });
const api = context.LovableDecrypterCanonicalCommandComposerApi;
assert.equal(api.build, 95);
assert.equal(api.databaseRequiresExplicitSql, true);
assert.equal(api.databaseMixedAtomicExecution, false);
assert.equal(api.databaseAutomaticRetry, false);
assert.equal(api.capabilityCandidatesAutoActivated, false);

calls.length = 0;
const dbBuild = await api.buildCommand('SQL: create table demo(id bigint);');
assert.equal(dbBuild.status, 'waiting_database_approval');
assert.equal(dbBuild.databaseProposal.ticket.risk, 'CAUTION');
assert.deepEqual(calls.map(call => Array.isArray(call) ? call[0] : call), ['db:introspect', 'db:prepare']);
assert.ok(!calls.some(call => Array.isArray(call) && call[0] === 'agent:start'), 'DATABASE-only must never fall through to Local Agent BUILD');

await assert.rejects(
  () => api.buildCommand('crie a tabela de clientes sem SQL explícito'),
  error => error?.code === 'DATABASE_SQL_PLAN_REQUIRED'
);
assert.ok(!calls.some(call => Array.isArray(call) && call[0] === 'db:run'), 'missing SQL must never run');

await assert.rejects(
  () => api.buildCommand('MIXED_TEST altere código e banco'),
  error => error?.code === 'DATABASE_MIXED_TRANSACTION_NOT_AVAILABLE'
);

calls.length = 0;
await api.buildCommand('CODE_TEST altere apenas o arquivo de código');
assert.ok(calls.some(call => Array.isArray(call) && call[0] === 'agent:start'), 'CODE should preserve the existing Local Agent path');
assert.ok(!calls.some(call => Array.isArray(call) && call[0].startsWith('db:')), 'CODE must not touch database runtime');

calls.length = 0;
const plan = await api.plan('quero revisar o banco sem SQL explícito');
assert.equal(plan.database.writesPerformed, false);
assert.equal(plan.database.explicitSqlRequiredForBuild, true);
assert.deepEqual(calls, ['db:introspect']);

console.log('Build 95 Safe Database Plan → Review → Run contract: OK');
