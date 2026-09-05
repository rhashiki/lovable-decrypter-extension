export const GIT_TRANSACTION_SCHEMA = 'ld-git-transaction/1';
export const GIT_TRANSACTION_REVERT_SCHEMA = 'ld-git-transaction-revert/1';

const text = (value, max = 1200) => String(value ?? '').trim().slice(0, max);
const timeMs = value => Date.parse(String(value || '')) || 0;

export function committedTransactionOperations(entries = []) {
  const rows = (Array.isArray(entries) ? entries : []).filter(entry => {
    if (entry?.status !== 'ok' || entry?.mode !== 'write') return false;
    if (!text(entry?.result?.commitSha, 128)) return false;
    if (['undo','redo'].includes(String(entry?.origin || '').toLowerCase())) return false;
    if (/^(reversible\.|git_transaction\.revert)/.test(String(entry?.tool || ''))) return false;
    return true;
  }).sort((a,b) => timeMs(a?.finishedAt || a?.startedAt) - timeMs(b?.finishedAt || b?.startedAt));

  const seen = new Set();
  return rows.filter(entry => {
    const sha = text(entry?.result?.commitSha, 128).toLowerCase();
    if (!sha || seen.has(sha)) return false;
    seen.add(sha);
    return true;
  });
}

export function proveTransactionCommitSpan(operations = [], compare = {}) {
  const committed = committedTransactionOperations(operations);
  const transactionShas = committed.map(entry => text(entry?.result?.commitSha, 128).toLowerCase());
  const compareShas = (Array.isArray(compare?.commits) ? compare.commits : []).map(commit => text(commit?.sha, 128).toLowerCase()).filter(Boolean);
  const branches = [...new Set(committed.map(entry => text(entry?.result?.branch || entry?.context?.branch, 240)).filter(Boolean))];
  const sameBranch = branches.length <= 1;
  const exactSpan = transactionShas.length > 0 && transactionShas.length === compareShas.length && transactionShas.every((sha,index) => sha === compareShas[index]);
  const foreignCommits = compareShas.filter(sha => !transactionShas.includes(sha));
  const missingCommits = transactionShas.filter(sha => !compareShas.includes(sha));
  return Object.freeze({
    schema: GIT_TRANSACTION_SCHEMA,
    commitCount: transactionShas.length,
    branch: branches[0] || '',
    sameBranch,
    exactSpan,
    contiguous: sameBranch && exactSpan,
    transactionShas: Object.freeze(transactionShas),
    compareShas: Object.freeze(compareShas),
    foreignCommits: Object.freeze(foreignCommits),
    missingCommits: Object.freeze(missingCommits),
    partialRevertAllowed: false
  });
}

export function safeCompareProjection(compare = {}) {
  return Object.freeze({
    status: text(compare?.status, 40),
    aheadBy: Math.max(0, Number(compare?.ahead_by || compare?.aheadBy || 0) || 0),
    behindBy: Math.max(0, Number(compare?.behind_by || compare?.behindBy || 0) || 0),
    totalCommits: Math.max(0, Number(compare?.total_commits || compare?.totalCommits || 0) || 0),
    files: Object.freeze((Array.isArray(compare?.files) ? compare.files : []).slice(0, 120).map(file => Object.freeze({
      path: text(file?.filename || file?.path, 1200),
      status: text(file?.status, 40),
      additions: Math.max(0, Number(file?.additions || 0) || 0),
      deletions: Math.max(0, Number(file?.deletions || 0) || 0),
      changes: Math.max(0, Number(file?.changes || 0) || 0),
      patchIncluded: false
    })).filter(file => file.path))
  });
}

export function gitTransactionFingerprint(value = {}) {
  return Object.freeze({
    schema: GIT_TRANSACTION_REVERT_SCHEMA,
    transactionId: text(value?.transactionId, 180),
    projectId: text(value?.projectId, 180),
    branch: text(value?.branch, 240),
    baseSha: text(value?.baseSha, 128).toLowerCase(),
    appliedSha: text(value?.appliedSha, 128).toLowerCase(),
    currentHead: text(value?.currentHead, 128).toLowerCase(),
    commitShas: Object.freeze((Array.isArray(value?.commitShas) ? value.commitShas : []).map(sha => text(sha, 128).toLowerCase()).filter(Boolean)),
    changes: Object.freeze((Array.isArray(value?.changes) ? value.changes : []).map(change => Object.freeze({
      path: text(change?.path, 1200),
      action: text(change?.action, 40),
      destructive: change?.destructive === true
    })).sort((a,b) => a.path.localeCompare(b.path))),
    conflicts: Object.freeze((Array.isArray(value?.conflicts) ? value.conflicts : []).map(conflict => Object.freeze({
      path: text(conflict?.path, 1200),
      code: text(conflict?.code, 120)
    })).sort((a,b) => a.path.localeCompare(b.path)))
  });
}
