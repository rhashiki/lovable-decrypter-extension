import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { randomUUID, webcrypto } from 'node:crypto';
import { TextEncoder, TextDecoder } from 'node:util';

const source = fs.readFileSync('background/editor-context-scope-enforcement-v84.js', 'utf8');
const head = 'a'.repeat(40);
const tree = 'b'.repeat(40);
const writes = [];
const order = [];
let storedSession = {};
let capturedChat = null;

const context = {
  console,
  URL,
  TextEncoder,
  TextDecoder,
  crypto: { ...webcrypto, randomUUID },
  setTimeout,
  clearTimeout,
  LD84_EDITOR_MAX_CONTEXT_BYTES: 2400000,
  LD84_EDITOR_SHADOW_TTL_MS: 30 * 60 * 1000,
  LD84_EDITOR_SHADOW_PREFIX: 'ld84_editor_shadow_',
  LD84_EDITOR_SCHEMA: 'ld-editor-direct/1',
  chrome: { storage: { session: {} } },
  ld84EditorClean(value, max = 1000) { return String(value ?? '').trim().slice(0, max); },
  ld84EditorSafePath(value) { return String(value ?? '').trim().replace(/\\/g, '/').replace(/^\/+/, ''); },
  async ld84EditorResolveBinding() {
    return { projectId: 'project-1', repository: 'owner/repo', branch: 'main', supabaseProject: 'supabase-1' };
  },
  async ld84EditorRepoSnapshot() { return { headSha: head, treeSha: tree }; },
  async ld84EditorPlan() {
    return { baseHeadSha: head, supabaseProject: 'supabase-1', plan: { summary: 'Update one file', relevantFiles: ['src/a.js'], newFiles: [], supabaseRequired: false } };
  },
  async ld84ContextBuild() {
    return {
      ok: true,
      pack: {
        schema: 'ld-context-pack/2',
        project: { repository: 'owner/repo', branch: 'main' },
        git: { headSha: head, treeSha: tree },
        brain: { rules: ['preserve user edits'] },
        memory: { contextMd: 'retrieved-memory-evidence', digest: 'digest-1', brainVersion: 7 },
        files: [{ path: 'README.md', score: 20, reasons: ['project-documentation'], truncated: false, content: 'read-only-context-file' }],
        provenance: { generatedAt: '2026-09-10T17:00:00.000Z' }
      }
    };
  },
  async ld84EditorReadFile(_snapshot, path) { return path === 'src/a.js' ? 'export const before = true;\n' : ''; },
  async ld84EditorLocalChat(messages) {
    capturedChat = messages;
    return { model: 'decrypter-local', json: { summary: 'Updated a.js', files: [{ path: 'src/a.js', action: 'update', content: 'export const after = true;\n' }], validation_notes: ['smoke'], supabase_apply_required: false } };
  },
  ld84EditorValidateFiles(files) { return files; },
  async ld84EditorSet(value) { storedSession = { ...storedSession, ...value }; },
  async ld84EditorRequireTrust() { return { token: 'trust' }; },
  async ld84EditorLoadShadow(id) {
    const shadow = storedSession[`ld84_editor_shadow_${id}`];
    if (!shadow) throw new Error('EDITOR_SHADOW_NOT_FOUND');
    return { key: `ld84_editor_shadow_${id}`, shadow };
  },
  async ld84ScopeEvaluate() {
    order.push('scope');
    return { ok: true, report: { allowed: true, schema: 'ld-scope-intelligence/2', enforcement: 'fail-closed-before-write', humanIntent: { policy: 'USER_EDIT > AI_EDIT' }, warnings: [], violations: [] } };
  },
  async ld84EditorBuild() { throw new Error('base build must be replaced'); },
  async ld84EditorApply(message) {
    order.push('writer');
    writes.push(message);
    return { ok: true, mode: 'applied', commitSha: 'c'.repeat(40) };
  },
  async ld84EditorResponse() { return null; }
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(source, context, { filename: 'editor-context-scope-enforcement-v84.js' });

assert.equal(context.LovableDecrypterEditorContextScopeEnforcementV84.scopeRequiredBeforeWrite, true);
assert.equal(context.LovableDecrypterEditorContextScopeEnforcementV84.skipApprovalBypassesScope, false);

const build = await context.ld84EditorBuild({ command: 'Atualize src/a.js' });
assert.equal(build.ok, true);
assert.equal(build.zeroWrite, true);
assert.equal(build.scopeRequiredBeforeWrite, true);
assert.equal(build.contextEvidence.authority, 'evidence-only');
assert.ok(build.shadowId);
assert.ok(capturedChat?.[1]?.content.includes('CONTEXT PACK — READ-ONLY EVIDENCE'));
assert.ok(capturedChat?.[1]?.content.includes('retrieved-memory-evidence'));
assert.ok(capturedChat?.[1]?.content.includes('read-only-context-file'));
const shadow = storedSession[`ld84_editor_shadow_${build.shadowId}`];
assert.deepEqual(Array.from(shadow.approvedPlan.files, item => item.path), ['src/a.js']);
assert.equal(shadow.contextEvidence.headSha, head);

context.ld84ScopeEvaluate = async () => {
  order.push('scope-block');
  return { ok: true, report: { allowed: false, schema: 'ld-scope-intelligence/2', enforcement: 'fail-closed-before-write', humanIntent: { policy: 'USER_EDIT > AI_EDIT' }, warnings: [], violations: [{ code: 'outside-approved-plan' }] } };
};
await assert.rejects(
  () => context.ld84EditorApply({ shadowId: build.shadowId, decision: 'skip' }),
  error => error?.code === 'EDITOR_SCOPE_BLOCKED' && /outside-approved-plan/.test(error?.message || '')
);
assert.equal(writes.length, 0, 'writer must not run when Scope blocks');
assert.deepEqual(order, ['scope-block']);

order.length = 0;
context.ld84ScopeEvaluate = async () => {
  order.push('scope');
  return { ok: true, report: { allowed: true, schema: 'ld-scope-intelligence/2', enforcement: 'fail-closed-before-write', humanIntent: { policy: 'USER_EDIT > AI_EDIT' }, warnings: [], violations: [] } };
};
const applied = await context.ld84EditorApply({ shadowId: build.shadowId, decision: 'skip' });
assert.equal(applied.ok, true);
assert.equal(applied.scopeEnforcement.allowed, true);
assert.equal(applied.scopeEnforcement.humanIntentPolicy, 'USER_EDIT > AI_EDIT');
assert.equal(writes.length, 1);
assert.deepEqual(order, ['scope', 'writer'], 'Scope must execute before the original writer even for skip decision');

console.log('Build84.6 editor enforcement runtime smoke: PASS');
