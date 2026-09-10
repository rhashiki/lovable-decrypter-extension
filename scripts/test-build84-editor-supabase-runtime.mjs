import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { randomUUID, webcrypto } from 'node:crypto';
import { TextEncoder, TextDecoder } from 'node:util';

const source = fs.readFileSync('background/editor-context-scope-enforcement-v84.js', 'utf8');
const preflightSource = fs.readFileSync('background/editor-supabase-preflight-enforcement-v84.js', 'utf8');
const head = 'a'.repeat(40);
const commit = 'c'.repeat(40);
const migrationPath = 'supabase/migrations/20260910180000_add_profiles_index.sql';
const migrationSql = 'create index if not exists profiles_name_idx on public.profiles(name);\n';
let sessionStore = {};
let localStore = { ld84_trust: { token: 'trust-token', expiresAt: '2099-01-01T00:00:00.000Z', protocol: 'ld-runtime-bus/1' } };
let writerShouldFail = false;
let scopeAllowed = true;
let brokerMode = 'success';
let writerCalls = 0;
let brokerApplyCalls = 0;
let preflightCalls = 0;
const order = [];

const chrome = { storage: { session: { area: 'session' }, local: { area: 'local' } } };
const storeFor = area => area === chrome.storage.session ? sessionStore : localStore;
const replaceStoreFor = (area, next) => { if (area === chrome.storage.session) sessionStore = next; else localStore = next; };

const context = {
  console,
  URL,
  Response,
  Request,
  Headers,
  TextEncoder,
  TextDecoder,
  crypto: {
    subtle: webcrypto.subtle,
    getRandomValues: webcrypto.getRandomValues.bind(webcrypto),
    randomUUID
  },
  setTimeout,
  clearTimeout,
  chrome,
  LD84_EDITOR_MAX_CONTEXT_BYTES: 2400000,
  LD84_EDITOR_SHADOW_TTL_MS: 30 * 60 * 1000,
  LD84_EDITOR_SHADOW_PREFIX: 'ld84_editor_shadow_',
  LD84_EDITOR_SCHEMA: 'ld-editor-direct/1',
  LD84_EDITOR_TRUST_KEY: 'ld84_trust',
  LD84_EDITOR_BACKEND: 'https://backend.test/functions/v1',
  async ensureTrust() { return { ok: true }; },
  ld84EditorClean(value, max = 1000) { return String(value ?? '').trim().slice(0, max); },
  ld84EditorSafePath(value) { return String(value ?? '').trim().replace(/\\/g, '/').replace(/^\/+/, ''); },
  async ld84EditorCredentials() { return { licenseKey: 'LD2.test', deviceId: 'device-1' }; },
  async ld84EditorGet(keys, area) {
    const store = storeFor(area);
    return Object.fromEntries(keys.filter(key => Object.hasOwn(store, key)).map(key => [key, store[key]]));
  },
  async ld84EditorSet(value, area) {
    replaceStoreFor(area, { ...storeFor(area), ...value });
  },
  async ld84EditorRemove(keys, area) {
    const store = { ...storeFor(area) };
    for (const key of keys) delete store[key];
    replaceStoreFor(area, store);
  },
  async ld84EditorResolveBinding() {
    return { projectId: 'project-1', repository: 'owner/repo', branch: 'main', supabaseProject: 'abcdefghijklmnopqrst' };
  },
  async ld84EditorRepoSnapshot() { return { headSha: head, treeSha: 'b'.repeat(40) }; },
  async ld84EditorPlan() {
    return {
      ok: true,
      baseHeadSha: head,
      supabaseProject: 'abcdefghijklmnopqrst',
      plan: {
        summary: 'Add profiles index',
        plan: ['Create tracked migration'],
        relevantFiles: ['src/a.js'],
        newFiles: [migrationPath],
        backendRequired: true,
        supabaseRequired: true,
        risks: []
      }
    };
  },
  async ld84ContextBuild() {
    return {
      ok: true,
      pack: {
        schema: 'ld-context-pack/2',
        project: { repository: 'owner/repo', branch: 'main' },
        git: { headSha: head, treeSha: 'b'.repeat(40) },
        brain: {}, memory: { contextMd: '', digest: 'memory-digest', brainVersion: 1 }, files: [], provenance: { generatedAt: '2026-09-10T18:00:00.000Z' }
      }
    };
  },
  async ld84EditorReadFile(_snapshot, path) { return path === 'src/a.js' ? 'export const before = true;\n' : ''; },
  async ld84EditorLocalChat() {
    return {
      model: 'decrypter-local',
      json: {
        summary: 'Add profiles index',
        files: [
          { path: 'src/a.js', action: 'update', content: 'export const after = true;\n' },
          { path: migrationPath, action: 'create', content: migrationSql }
        ],
        validation_notes: [],
        supabase_apply_required: true
      }
    };
  },
  ld84EditorValidateFiles(files) { return files; },
  async ld84EditorRequireTrust() { return localStore.ld84_trust; },
  async ld84EditorLoadShadow(id) {
    const key = `ld84_editor_shadow_${id}`;
    const shadow = sessionStore[key];
    if (!shadow) throw new Error('EDITOR_SHADOW_NOT_FOUND');
    return { key, shadow };
  },
  async ld84ScopeEvaluate() {
    order.push(scopeAllowed ? 'scope' : 'scope-block');
    return { ok: true, report: { allowed: scopeAllowed, schema: 'ld-scope-intelligence/2', enforcement: 'fail-closed-before-write', humanIntent: { policy: 'USER_EDIT > AI_EDIT' }, warnings: [], violations: scopeAllowed ? [] : [{ code: 'outside-approved-plan' }] } };
  },
  async ld84EditorBuild() { throw new Error('base build must be replaced'); },
  async ld84EditorApply(message) {
    order.push('writer');
    writerCalls += 1;
    const key = `ld84_editor_shadow_${message.shadowId}`;
    assert.equal(sessionStore[key]?.supabaseApplyRequired, false, 'base writer must receive only delegated Git shadow');
    if (writerShouldFail) throw new Error('GITHUB_WRITE_FAILED');
    const { [key]: _removed, ...rest } = sessionStore;
    sessionStore = rest;
    return { ok: true, mode: 'applied', repository: 'owner/repo', branch: 'main', commitSha: commit, commitUrl: `https://github.com/owner/repo/commit/${commit}` };
  },
  async ld84EditorResponse() { return null; },
  async fetch(url, options = {}) {
    const target = String(url);
    const body = JSON.parse(String(options.body || '{}'));

    if (target === 'https://kkzxxnfxgrouhkzyszxs.supabase.co/functions/v1/ld-integration-selection') {
      preflightCalls += 1;
      assert.equal(body.action, 'get');
      assert.equal(body.integration, 'github');
      return new Response(JSON.stringify({ ok: true, integration: 'github', mode: 'selected', selected: ['owner/repo'] }), { status: 200, headers: { 'content-type': 'application/json' } });
    }

    const isTestBroker = target === 'https://backend.test/functions/v1/ld-editor-supabase-apply';
    const isRealBrokerSurface = target === 'https://kkzxxnfxgrouhkzyszxs.supabase.co/functions/v1/ld-editor-supabase-apply';
    assert.ok(isTestBroker || isRealBrokerSurface, `unexpected backend target: ${target}`);
    assert.equal(options.headers['x-decrypter-trust'], 'trust-token');
    assert.equal(options.headers['x-decrypter-client-protocol'], 'ld-runtime-bus/1');

    if (body.action === 'status') {
      preflightCalls += 1;
      if (isRealBrokerSurface) assert.equal(body.project_ref, 'abcdefghijklmnopqrst');
      return new Response(JSON.stringify({
        ok: true,
        schema: 'ld-editor-supabase-apply/1',
        project_ref: 'abcdefghijklmnopqrst',
        migration_api_ready: true,
        migration_history_count: 3,
        selected_project_enforced: true,
        selected_repository_enforced: true
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (body.action === 'apply') {
      brokerApplyCalls += 1;
      order.push('broker-apply');
      assert.equal(body.project_ref, 'abcdefghijklmnopqrst');
      assert.equal(body.repository, 'owner/repo');
      assert.equal(body.branch, 'main');
      assert.equal(body.commit_sha, commit);
      assert.equal(body.approval?.explicit, true);
      assert.equal(body.approval?.surface, 'editor-direct-review');
      assert.deepEqual(Array.from(body.migrations, item => item.path), [migrationPath]);
      if (brokerMode === 'fail') return new Response(JSON.stringify({ ok: false, code: 'SUPABASE_MIGRATION_APPLY_FAILED', applied: [], skipped: [], failed: { path: migrationPath } }), { status: 422, headers: { 'content-type': 'application/json' } });
      return new Response(JSON.stringify({ ok: true, schema: 'ld-editor-supabase-apply/1', project_ref: 'abcdefghijklmnopqrst', applied: [{ path: migrationPath }], skipped: [], migration_history: true, source_verified_from_git: true }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({ ok: false, code: 'UNKNOWN_ACTION' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(source, context, { filename: 'editor-context-scope-enforcement-v84.js' });
vm.runInContext(preflightSource, context, { filename: 'editor-supabase-preflight-enforcement-v84.js' });

assert.equal(context.LovableDecrypterEditorSupabasePreflightV84.migrationApiRequiredBeforeReview, true);
assert.equal(context.LovableDecrypterEditorSupabasePreflightV84.selectedSupabaseProjectRequired, true);
assert.equal(context.LovableDecrypterEditorSupabasePreflightV84.selectedGithubRepositoryRequired, true);

const build = await context.ld84EditorBuild({ command: 'Crie o índice no Supabase' });
assert.equal(build.ok, true);
assert.equal(build.supabaseApplyRequired, true);
assert.equal(build.applyBlocked, false);
assert.deepEqual(Array.from(build.supabaseMigrations, item => item.path), [migrationPath]);
assert.equal(build.supabasePreflight.migrationApiReady, true);
assert.equal(build.supabasePreflight.projectRef, 'abcdefghijklmnopqrst');
assert.equal(build.supabasePreflight.repository, 'owner/repo');
assert.equal(build.supabasePreflight.supabaseSelectionVerified, true);
assert.equal(build.supabasePreflight.githubSelectionVerified, true);
assert.ok(preflightCalls >= 3, 'base broker status + project-aware broker preflight + GitHub selection preflight must run');
const shadowKey = `ld84_editor_shadow_${build.shadowId}`;
assert.equal(sessionStore[shadowKey].supabaseApplyPolicy, 'git-first-commit-pinned-migrations');

await assert.rejects(() => context.ld84EditorApply({ shadowId: build.shadowId }), /EDITOR_SUPABASE_EXPLICIT_APPROVAL_REQUIRED/);
assert.equal(writerCalls, 0);
assert.equal(brokerApplyCalls, 0);

scopeAllowed = false;
order.length = 0;
await assert.rejects(() => context.ld84EditorApply({ shadowId: build.shadowId, supabaseApproved: true, decision: 'skip' }), error => error?.code === 'EDITOR_SCOPE_BLOCKED');
assert.equal(writerCalls, 0);
assert.equal(brokerApplyCalls, 0);
assert.deepEqual(order, ['scope-block']);

scopeAllowed = true;
writerShouldFail = true;
order.length = 0;
await assert.rejects(() => context.ld84EditorApply({ shadowId: build.shadowId, supabaseApproved: true }), /GITHUB_WRITE_FAILED/);
assert.equal(writerCalls, 1);
assert.equal(brokerApplyCalls, 0);
assert.equal(sessionStore[shadowKey].supabaseApplyRequired, true, 'Git failure must restore the original Supabase-required Shadow');
assert.equal(localStore[`ld84_editor_supabase_recovery_${build.shadowId}`].status, 'git_failed');
assert.deepEqual(order, ['scope', 'writer']);

writerShouldFail = false;
brokerMode = 'fail';
order.length = 0;
const partial = await context.ld84EditorApply({ shadowId: build.shadowId, supabaseApproved: true });
assert.equal(partial.ok, false);
assert.equal(partial.code, 'GIT_APPLIED_SUPABASE_FAILED');
assert.equal(partial.gitApplied, true);
assert.equal(writerCalls, 2);
assert.equal(brokerApplyCalls, 1);
assert.equal(sessionStore[shadowKey], undefined, 'successful Git write removes the Shadow');
assert.equal(localStore[`ld84_editor_supabase_recovery_${build.shadowId}`].status, 'git_applied_supabase_failed');
assert.deepEqual(order, ['scope', 'writer', 'broker-apply']);

brokerMode = 'success';
order.length = 0;
const retry = await context.ld84EditorResponse({ type: 'ld84.editor.supabase.retry', recoveryId: partial.recoveryId, supabaseApproved: true });
assert.equal(retry.ok, true);
assert.equal(retry.mode, 'supabase_retry_complete');
assert.equal(writerCalls, 2, 'Supabase retry must never repeat Git writer');
assert.equal(brokerApplyCalls, 2);
assert.equal(localStore[`ld84_editor_supabase_recovery_${build.shadowId}`].status, 'complete');
assert.deepEqual(order, ['broker-apply']);

const build2 = await context.ld84EditorBuild({ command: 'Crie o índice no Supabase' });
order.length = 0;
const complete = await context.ld84EditorApply({ shadowId: build2.shadowId, supabaseApproved: true, decision: 'skip' });
assert.equal(complete.ok, true);
assert.equal(complete.mode, 'applied_with_supabase');
assert.equal(complete.supabaseApply.ok, true);
assert.deepEqual(order, ['scope', 'writer', 'broker-apply'], 'even skip decision must preserve Scope → Git → Supabase order');

console.log('Build84.6 Git-first Supabase recovery + resource preflight smoke: PASS');
