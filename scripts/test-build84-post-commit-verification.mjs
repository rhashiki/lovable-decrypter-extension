import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('background/editor-post-commit-verification-v84.js', 'utf8');
const commit = 'c'.repeat(40);
let nextResult = { ok: true, repository: 'owner/repo', branch: 'main', commitSha: commit };
let refreshMode = 'match';
let refreshCalls = 0;

const context = {
  console,
  setTimeout,
  clearTimeout,
  async ld84EditorApply() { return structuredClone(nextResult); },
  async ld84GhsRefresh() {
    refreshCalls += 1;
    if (refreshMode === 'throw') throw Object.assign(new Error('github unavailable'), { code: 'GITHUB_HTTP_503' });
    return {
      ok: true,
      repository: refreshMode === 'repo-mismatch' ? 'owner/other' : 'owner/repo',
      branch: refreshMode === 'branch-mismatch' ? 'develop' : 'main',
      sync: {
        headSha: refreshMode === 'sha-mismatch' ? 'd'.repeat(40) : commit,
        checkedAt: '2026-09-10T20:00:00.000Z'
      }
    };
  }
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(source, context, { filename: 'editor-post-commit-verification-v84.js' });

assert.equal(context.LovableDecrypterEditorPostCommitVerificationV84.githubHeadReadAfterCommit, true);
assert.equal(context.LovableDecrypterEditorPostCommitVerificationV84.lovablePreviewAutomaticVerification, false);
assert.equal(context.LovableDecrypterEditorPostCommitVerificationV84.lovablePrivateApiUsed, false);
assert.equal(context.LovableDecrypterEditorPostCommitVerificationV84.lovableSessionTokenScraping, false);
assert.equal(context.LovableDecrypterEditorPostCommitVerificationV84.continuousPolling, false);

let out = await context.ld84EditorApply({ shadowId: 'shadow-1' });
assert.equal(refreshCalls, 1);
assert.equal(out.syncVerification.github.verified, true);
assert.equal(out.syncVerification.github.reason, 'GITHUB_HEAD_CONFIRMED');
assert.equal(out.syncVerification.github.expectedSha, commit);
assert.equal(out.syncVerification.github.observedSha, commit);
assert.equal(out.syncVerification.lovable.verified, false);
assert.equal(out.syncVerification.lovable.observable, false);
assert.equal(out.syncVerification.lovable.reason, 'BROWSER_HOMOLOGATION_REQUIRED');
assert.equal(out.syncVerification.invariant, 'GITHUB_HEAD_DOES_NOT_PROVE_LOVABLE_PREVIEW');
assert.equal(out.lovableSync.deprecatedAmbiguousField, true);

for (const mode of ['repo-mismatch', 'branch-mismatch', 'sha-mismatch']) {
  refreshMode = mode;
  out = await context.ld84EditorApply({ shadowId: `shadow-${mode}` });
  assert.equal(out.syncVerification.github.verified, false, `${mode} must fail GitHub confirmation`);
  assert.equal(out.syncVerification.github.reason, 'GITHUB_HEAD_MISMATCH');
}

refreshMode = 'throw';
out = await context.ld84EditorApply({ shadowId: 'shadow-read-fail' });
assert.equal(out.ok, true, 'post-read failure must not pretend the already-created commit was rolled back');
assert.equal(out.syncVerification.github.verified, false);
assert.equal(out.syncVerification.github.observable, false);
assert.equal(out.syncVerification.github.reason, 'GITHUB_POST_COMMIT_READ_FAILED');
assert.equal(out.syncVerification.github.code, 'GITHUB_HTTP_503');

refreshMode = 'match';
nextResult = {
  ok: false,
  code: 'GIT_APPLIED_SUPABASE_FAILED',
  gitApplied: true,
  repository: 'owner/repo',
  branch: 'main',
  commitSha: commit,
  recoveryId: 'recovery-1'
};
out = await context.ld84EditorApply({ shadowId: 'shadow-partial' });
assert.equal(out.ok, false);
assert.equal(out.gitApplied, true);
assert.equal(out.syncVerification.github.verified, true, 'partial Supabase failure must still verify the Git commit');

const callsBeforeNoCommit = refreshCalls;
nextResult = { ok: false, code: 'EDITOR_SCOPE_BLOCKED' };
out = await context.ld84EditorApply({ shadowId: 'shadow-blocked' });
assert.equal(out.syncVerification, undefined);
assert.equal(refreshCalls, callsBeforeNoCommit, 'no Git commit means no post-commit read');

for (const forbidden of [
  'firebaseLocalStorageDb',
  'firebase:authUser:',
  'tokenFromLocalStorage',
  'tokenFromIndexedDb',
  'api.lovable.dev',
  '/gitsync',
  '/git-sync'
]) assert.equal(source.includes(forbidden), false, `post-commit verifier must not contain legacy Lovable session/API surface: ${forbidden}`);

console.log('Build84.6 post-commit GitHub verification / Lovable manual boundary: PASS');
