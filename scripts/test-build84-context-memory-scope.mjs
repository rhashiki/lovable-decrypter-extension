import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const pkg = JSON.parse(read('release/runtime-package.json'));
const serviceWorker = read('background/build84-service-worker.js');
const runtime = read('background/context-intelligence-runtime-v84.js');
const enforcement = read('background/editor-context-scope-enforcement-v84.js');
const preflight = read('background/editor-supabase-preflight-enforcement-v84.js');
const postCommit = read('background/editor-post-commit-verification-v84.js');
const editorUi = read('launcher/editor-direct-authority-v84.js');
const launcher = read('launcher/context-intelligence-v84.js');
const memory = read('supabase/functions/ld-memory-engine/index.ts');
const supabaseBroker = read('supabase/functions/ld-editor-supabase-apply/index.ts');

const requiredPackagePaths = [
  'launcher/context-intelligence-v84.js',
  'background/context-intelligence-runtime-v84.js',
  'background/editor-context-scope-enforcement-v84.js',
  'background/editor-supabase-preflight-enforcement-v84.js',
  'background/editor-post-commit-verification-v84.js'
];
for (const path of requiredPackagePaths) assert(pkg.paths.includes(path), `runtime-package missing ${path}`);
assert.equal(manifest.version, '2.6.84');
for (const path of requiredPackagePaths.filter(path => path.startsWith('launcher/'))) assert(manifest.content_scripts[0].js.includes(path), `manifest missing ${path}`);
assert(pkg.forbidden_paths.includes('content/lovable-sync-verifier.js'), 'legacy Lovable Firebase sync verifier must remain forbidden');

const contextImport = serviceWorker.indexOf("'context-intelligence-runtime-v84.js'");
const enforcementImport = serviceWorker.indexOf("'editor-context-scope-enforcement-v84.js'");
const preflightImport = serviceWorker.indexOf("'editor-supabase-preflight-enforcement-v84.js'");
const postCommitImport = serviceWorker.indexOf("'editor-post-commit-verification-v84.js'");
assert(contextImport >= 0, 'service worker must load context runtime');
assert(enforcementImport > contextImport, 'editor enforcement must load after context runtime');
assert(preflightImport > enforcementImport, 'resource preflight must load after editor enforcement');
assert(postCommitImport > preflightImport, 'post-commit verification must load last');
for (const token of [
  'contextPack: true',
  'projectBrainMemory: true',
  'scopeIntelligence: true',
  'editorContextScopeEnforcement: true',
  'editorSupabasePreflightEnforcement: true',
  'editorPostCommitVerification: true',
  'scopeRequiredBeforeWrite: true',
  'resourcePreflightRequiredBeforeReview: true',
  'githubHeadRequiredAfterCommit: true',
  'lovablePreviewAutomaticVerification: false'
]) assert(serviceWorker.includes(token), `service worker invariant missing: ${token}`);

for (const [name, source] of [
  ['runtime', runtime],
  ['enforcement', enforcement],
  ['preflight', preflight],
  ['postCommit', postCommit],
  ['launcher', launcher],
  ['editorUi', editorUi]
]) {
  assert(!/\bnew\s+MutationObserver\s*\(/.test(source), `${name} must not construct MutationObserver`);
  assert(!/\bMutationObserver\s*\(/.test(source), `${name} must not invoke MutationObserver`);
  assert(!/\bsetInterval\s*\(/.test(source), `${name} must not use setInterval`);
  assert(!/\bchrome\.alarms\b/.test(source), `${name} must not use chrome.alarms`);
}
assert(!runtime.includes('localStorage'), 'background runtime must use extension storage, not page localStorage');
for (const token of [
  "LD84_CONTEXT_SCHEMA = 'ld-context-pack/2'",
  "LD84_SCOPE_SCHEMA = 'ld-scope-intelligence/2'",
  "LD84_CONTEXT_PROTOCOL = 'ld-runtime-bus/1'",
  'LD84_CONTEXT_MAX_FILES = 16',
  'LD84_CONTEXT_MAX_CODE_BYTES = 150000',
  "retrievedMemoryAuthority: 'evidence-only'",
  'modelStateAuthority: false',
  'function ld84ContextSensitivePath',
  'ld84.context.build',
  'ld84.scope.evaluate'
]) assert(runtime.includes(token), `context invariant missing: ${token}`);
assert(runtime.includes('\\.env'), 'sensitive-path policy must reject .env files');
assert(runtime.includes('pem|key|p12|pfx'), 'sensitive-path policy must reject private credential file extensions');

for (const token of ['fail-closed-before-write','USER_EDIT > AI_EDIT','outside-approved-plan','broad-rewrite','human-intent-override-required','skipApprovalBypassesScope: false']) assert(runtime.includes(token), `scope invariant missing: ${token}`);

for (const token of [
  'ld-editor-context-scope-enforcement/1',
  'await ld84ContextBuild',
  'EDITOR_CONTEXT_HEAD_MISMATCH',
  'CONTEXT PACK — READ-ONLY EVIDENCE',
  "authority: 'evidence-only'",
  'approvedPlan',
  'await ld84ScopeEvaluate',
  'EDITOR_SCOPE_BLOCKED',
  'scopeRequiredBeforeWrite: true',
  'skipApprovalBypassesScope: false',
  'originalWriterAuthorityPreserved: true',
  'originalApplyRevalidatesHead: true',
  'git-first-commit-pinned-migrations',
  'EDITOR_SUPABASE_EXPLICIT_APPROVAL_REQUIRED',
  'git_applied_supabase_failed',
  'ld84.editor.supabase.retry',
  'supabaseRawSqlFromClient: false',
  'supabaseSeedAutoApply: false',
  'supabaseEdgeFunctionAutoDeploy: false',
  'supabaseMigrationHistoryRequired: true',
  'supabaseQueryFallback: false'
]) assert(enforcement.includes(token), `editor enforcement invariant missing: ${token}`);

const scopeCall = enforcement.indexOf('await ld84ScopeEvaluate');
const writerCall = enforcement.indexOf('gitResult = await ld84EditorApplyBase84(message)');
const supabaseCall = enforcement.indexOf('await applySupabaseAfterGit(shadow, gitResult, recoveryId)');
assert(scopeCall >= 0 && writerCall > scopeCall, 'Scope must run before the original writer');
assert(supabaseCall > writerCall, 'Supabase apply must run only after the Git writer succeeds');
assert(enforcement.includes("await ld84EditorSet({ [key]: shadow }, chrome.storage.session)"), 'Git failure must restore original Shadow');
assert(enforcement.includes("status: 'git_applied_pending_supabase'"), 'Git success must be journaled before Supabase');
assert(!/skipScope|bypassScope|scopeDisabled/i.test(enforcement), 'enforcement must expose no Scope bypass switch');

for (const token of [
  "const SCHEMA = 'ld-editor-supabase-preflight-enforcement/1'",
  "action: 'status'",
  'project_ref: projectRef',
  'migration_api_ready !== true',
  'selected_project_enforced !== true',
  "integration: 'github'",
  'GITHUB_REPOSITORY_NOT_SELECTED',
  'failedPreflightDiscardsShadow: true'
]) assert(preflight.includes(token), `resource preflight invariant missing: ${token}`);

for (const token of [
  "const SCHEMA = 'ld-editor-post-commit-verification/1'",
  'await ld84GhsRefresh()',
  "reason: repositoryMatches && branchMatches && shaMatches ? 'GITHUB_HEAD_CONFIRMED' : 'GITHUB_HEAD_MISMATCH'",
  "reason: 'GITHUB_POST_COMMIT_READ_FAILED'",
  "reason: LOVABLE_REASON",
  "invariant: 'GITHUB_HEAD_DOES_NOT_PROVE_LOVABLE_PREVIEW'",
  'lovablePreviewAutomaticVerification: false',
  'lovablePrivateApiUsed: false',
  'lovableSessionTokenScraping: false',
  'manualBrowserHomologationRequired: true'
]) assert(postCommit.includes(token), `post-commit invariant missing: ${token}`);
for (const forbidden of ['api.lovable.dev','firebaseLocalStorageDb','firebase:authUser:','/gitsync','/git-sync']) assert(!postCommit.includes(forbidden), `post-commit runtime must not use private Lovable surface: ${forbidden}`);

for (const token of [
  "const SCHEMA = 'ld-editor-supabase-apply/1'",
  "const CLIENT_PROTOCOL = 'ld-runtime-bus/1'",
  'x-decrypter-trust',
  'TRUST_BINDING_MISMATCH',
  'TRUST_SESSION_MISMATCH',
  "const MIGRATION_PATH = /^supabase\\/migrations\\/",
  'GITHUB_HEAD_CHANGED_BEFORE_SUPABASE',
  'MIGRATION_DIGEST_MISMATCH',
  '/database/migrations',
  'MIGRATION_HISTORY_CONFLICT',
  'SUPABASE_MIGRATIONS_API_UNAVAILABLE',
  "source: 'github-committed-migration-only'",
  'raw_sql_from_client: false',
  'seed_sql_auto_apply: false',
  'edge_function_auto_deploy: false',
  'query_fallback: false',
  'SUPABASE_PROJECT_NOT_SELECTED',
  'GITHUB_REPOSITORY_NOT_SELECTED'
]) assert(supabaseBroker.includes(token), `Supabase broker invariant missing: ${token}`);
assert(!supabaseBroker.includes('/database/query'), 'schema Apply must never fall back to arbitrary database/query');
assert(!/seed\.sql[^\n]*management\(/i.test(supabaseBroker), 'seed.sql must never be auto-applied');
assert(!/functions\/deploy/.test(supabaseBroker), 'Edge Functions must never be auto-deployed by Editor Supabase apply');

for (const token of [
  'Aplicar GitHub + Supabase',
  'autorizo explicitamente: (1) criar o commit no GitHub; (2) depois do commit, aplicar as migrations',
  'GitHub aplicado · Supabase pendente',
  'Tentar Supabase novamente',
  "type:'ld84.editor.supabase.retry'"
]) assert(editorUi.includes(token), `Editor UI Supabase disclosure missing: ${token}`);
assert(/não repita o Git/i.test(editorUi), 'Editor UI must warn not to repeat Git after partial Supabase failure');

for (const token of [
  "LEGACY_VERSION='2.4.21'",
  "SUPPORTED_PROTOCOLS=new Set(['ld-runtime-bus/1'])",
  'x-decrypter-client-protocol',
  '@supabase/supabase-js@2.112.4',
  'brain:structuredBrain',
  'raw_context_persisted:false',
  'TRUST_PROTOCOL_MISMATCH',
  'TRUST_SESSION_PROTOCOL_MISMATCH'
]) assert(memory.includes(token), `memory compatibility invariant missing: ${token}`);

assert.match(launcher, /new Set\(\['context-pack', 'scope-intelligence'\]\)/);
assert.match(launcher, /stopImmediatePropagation\(\)/);
assert.match(launcher, /Gerar Context Pack/);
assert.match(launcher, /Human Intent Locks ativos/);

console.log('Build84.6 Context/Memory/Scope + Git-first Supabase + post-commit verification: static contract PASS');
