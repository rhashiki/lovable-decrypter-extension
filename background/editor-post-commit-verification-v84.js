'use strict';

(() => {
  const SCHEMA = 'ld-editor-post-commit-verification/1';
  const BUILD = 84;
  const LOVABLE_REASON = 'BROWSER_HOMOLOGATION_REQUIRED';

  if (typeof ld84EditorApply !== 'function') throw new Error('EDITOR_POST_COMMIT_APPLY_RUNTIME_REQUIRED');
  if (typeof ld84GhsRefresh !== 'function') throw new Error('EDITOR_POST_COMMIT_GITHUB_SYNC_RUNTIME_REQUIRED');

  const baseApply = ld84EditorApply;

  function clean(value, max = 500) {
    return String(value ?? '').trim().slice(0, max);
  }

  function expectedCommit(result) {
    const sha = clean(result?.commitSha, 80).toLowerCase();
    return /^[0-9a-f]{40}$/.test(sha) ? sha : '';
  }

  async function verifyGithub(result) {
    const expectedSha = expectedCommit(result);
    const expectedRepository = clean(result?.repository, 220);
    const expectedBranch = clean(result?.branch, 180);
    if (!expectedSha || !expectedRepository || !expectedBranch) {
      return {
        verified: false,
        observable: false,
        reason: 'GITHUB_COMMIT_RESULT_INCOMPLETE',
        expectedSha,
        observedSha: '',
        repository: expectedRepository,
        branch: expectedBranch
      };
    }

    try {
      const refreshed = await ld84GhsRefresh();
      const observedSha = clean(refreshed?.sync?.headSha, 80).toLowerCase();
      const repository = clean(refreshed?.repository, 220);
      const branch = clean(refreshed?.branch, 180);
      const repositoryMatches = repository.toLowerCase() === expectedRepository.toLowerCase();
      const branchMatches = branch === expectedBranch;
      const shaMatches = observedSha === expectedSha;
      return {
        verified: repositoryMatches && branchMatches && shaMatches,
        observable: true,
        reason: repositoryMatches && branchMatches && shaMatches ? 'GITHUB_HEAD_CONFIRMED' : 'GITHUB_HEAD_MISMATCH',
        expectedSha,
        observedSha,
        repository,
        branch,
        repositoryMatches,
        branchMatches,
        checkedAt: clean(refreshed?.sync?.checkedAt, 100) || new Date().toISOString()
      };
    } catch (error) {
      return {
        verified: false,
        observable: false,
        reason: 'GITHUB_POST_COMMIT_READ_FAILED',
        expectedSha,
        observedSha: '',
        repository: expectedRepository,
        branch: expectedBranch,
        code: clean(error?.code || error?.message || error, 240),
        checkedAt: new Date().toISOString()
      };
    }
  }

  function lovableState() {
    return {
      verified: false,
      observable: false,
      reason: LOVABLE_REASON,
      authority: 'browser-manual-homologation',
      privateApiUsed: false,
      sessionTokenScraping: false
    };
  }

  async function ld84EditorApplyWithPostCommitVerification(message = {}) {
    const result = await baseApply(message);
    const gitWasApplied = result?.ok === true || result?.gitApplied === true;
    if (!gitWasApplied || !expectedCommit(result)) return result;

    const github = await verifyGithub(result);
    return {
      ...result,
      lovableSync: {
        verified: false,
        observable: false,
        reason: LOVABLE_REASON,
        deprecatedAmbiguousField: true
      },
      syncVerification: {
        schema: SCHEMA,
        github,
        lovable: lovableState(),
        invariant: 'GITHUB_HEAD_DOES_NOT_PROVE_LOVABLE_PREVIEW',
        checkedAt: new Date().toISOString()
      }
    };
  }

  ld84EditorApply = ld84EditorApplyWithPostCommitVerification;

  Object.defineProperty(globalThis, 'LovableDecrypterEditorPostCommitVerificationV84', {
    value: Object.freeze({
      schema: SCHEMA,
      build: BUILD,
      githubHeadReadAfterCommit: true,
      githubExactRepositoryRequired: true,
      githubExactBranchRequired: true,
      githubExactCommitRequired: true,
      lovablePreviewAutomaticVerification: false,
      lovablePrivateApiUsed: false,
      lovableSessionTokenScraping: false,
      manualBrowserHomologationRequired: true,
      eventDriven: true,
      continuousPolling: false
    }),
    configurable: false,
    enumerable: false,
    writable: false
  });
})();
