import { assertSafeRepoPath, isSensitivePath } from './utils.js';

export const AUTONOMY_POLICY_SCHEMA = 'ld-guided-autonomy-policy/1';
export const AUTONOMY_POLICY_STORAGE_KEY = 'ld98_guided_autonomy_policy_v1';
export const AUTONOMY_MODES = Object.freeze(['manual', 'guided', 'autonomous']);
export const POLICY_DECISIONS = Object.freeze(['AUTO', 'ASK', 'ALWAYS_ASK', 'DENY']);

const text = (value, max = 240) => String(value ?? '').trim().slice(0, max);
const unique = values => [...new Set((Array.isArray(values) ? values : []).map(value => text(value, 1200)).filter(Boolean))];

export function normalizeAutonomyMode(value = 'manual') {
  const mode = String(value || 'manual').trim().toLowerCase();
  return AUTONOMY_MODES.includes(mode) ? mode : 'manual';
}

function proposalPaths(tool = '', input = {}) {
  if (tool === 'repo.patch_apply') return unique((Array.isArray(input?.patches) ? input.patches : []).map(patch => patch?.path));
  if (tool === 'repo.write_file') return unique([input?.path]);
  return unique(input?.paths || []);
}

function patchEditCount(input = {}) {
  return (Array.isArray(input?.patches) ? input.patches : []).reduce((total, patch) => total + (Array.isArray(patch?.edits) ? patch.edits.length : 0), 0);
}

export function classifyPolicyAction({ capability = '', tool = '', input = {}, action = '' } = {}) {
  const explicit = String(action || '').trim().toUpperCase();
  if (explicit) return explicit;
  const cap = String(capability || '').trim().toUpperCase();
  if (cap === 'DATABASE') return 'DATABASE_WRITE';
  if (cap === 'DEPLOY') return 'DEPLOY';
  if (cap === 'GIT') return 'GIT_PUSH';
  if (cap === 'TEST') return 'TEST';
  if (cap === 'CONTEXT') return 'READ';
  if (tool === 'repo.patch_apply') return 'CODE_UPDATE';
  if (tool === 'repo.write_file') {
    const writeAction = String(input?.action || 'update').trim().toLowerCase();
    if (writeAction === 'delete') return 'CODE_DELETE';
    if (writeAction === 'create') return 'CODE_CREATE';
    return 'CODE_UPDATE';
  }
  if (/^(repo\.(list_files|read_file|grep|git_diff|patch_preview)|diagnostics\.run|lsp\.query)$/i.test(tool)) return tool === 'diagnostics.run' || tool === 'lsp.query' ? 'TEST' : 'READ';
  return 'UNKNOWN';
}

function boundedCodeRule(mode, tool, input, paths) {
  const limit = mode === 'autonomous'
    ? { paths: 12, edits: 40, contentChars: 200000 }
    : { paths: 5, edits: 16, contentChars: 80000 };
  if (!paths.length) return { ok: false, rule: 'CODE_PATH_REQUIRED' };
  if (paths.length > limit.paths) return { ok: false, rule: 'CODE_PATH_LIMIT' };
  if (tool === 'repo.patch_apply' && patchEditCount(input) > limit.edits) return { ok: false, rule: 'PATCH_EDIT_LIMIT' };
  if (tool === 'repo.write_file' && String(input?.action || 'update').toLowerCase() !== 'delete' && String(input?.content || '').length > limit.contentChars) {
    return { ok: false, rule: 'WHOLE_FILE_CONTENT_LIMIT' };
  }
  return { ok: true, rule: mode === 'autonomous' ? 'BOUNDED_CODE_AUTONOMOUS' : 'BOUNDED_CODE_GUIDED' };
}

export function evaluateAutonomyPolicy({ mode = 'manual', capability = '', tool = '', input = {}, action = '', riskSignals = {} } = {}) {
  const normalizedMode = normalizeAutonomyMode(mode);
  const policyAction = classifyPolicyAction({ capability, tool, input, action });
  const rawPaths = proposalPaths(tool, input);
  const invalidPaths = [];
  const sensitivePaths = [];
  const paths = [];
  for (const raw of rawPaths) {
    try {
      const safe = assertSafeRepoPath(raw);
      paths.push(safe);
      if (isSensitivePath(safe)) sensitivePaths.push(safe);
    } catch (_) { invalidPaths.push(text(raw, 1200)); }
  }

  let decision = 'ASK';
  let rule = 'DEFAULT_ASK';

  if (invalidPaths.length || sensitivePaths.length) {
    decision = 'DENY';
    rule = invalidPaths.length ? 'INVALID_PATH_DENY' : 'SENSITIVE_PATH_DENY';
  } else if (riskSignals?.scopeViolation === true || riskSignals?.humanIntentConflict === true || riskSignals?.proposalTampered === true) {
    decision = 'DENY';
    rule = riskSignals?.scopeViolation === true ? 'SCOPE_VIOLATION_DENY' : riskSignals?.humanIntentConflict === true ? 'HUMAN_INTENT_CONFLICT_DENY' : 'PROPOSAL_TAMPER_DENY';
  } else if (['DATABASE_WRITE','DATABASE_DESTRUCTIVE','GIT_PUSH','DEPLOY','CODE_DELETE'].includes(policyAction)) {
    decision = 'ALWAYS_ASK';
    rule = `${policyAction}_HUMAN_REQUIRED`;
  } else if (policyAction === 'DEPENDENCY_INSTALL') {
    decision = 'ASK';
    rule = 'DEPENDENCY_INSTALL_ASK';
  } else if (['READ','TEST'].includes(policyAction)) {
    decision = 'AUTO';
    rule = `${policyAction}_SAFE_AUTO`;
  } else if (['CODE_UPDATE','CODE_CREATE'].includes(policyAction)) {
    if (normalizedMode === 'manual') {
      decision = 'ASK';
      rule = 'MANUAL_MODE_WRITE_ASK';
    } else {
      const bounded = boundedCodeRule(normalizedMode, tool, input, paths);
      decision = bounded.ok ? 'AUTO' : 'ASK';
      rule = bounded.rule;
    }
  } else {
    decision = 'ASK';
    rule = 'UNKNOWN_ACTION_ASK';
  }

  return Object.freeze({
    schema: AUTONOMY_POLICY_SCHEMA,
    build: 98,
    mode: normalizedMode,
    action: policyAction,
    decision,
    rule,
    automaticEligible: decision === 'AUTO',
    humanRequired: decision === 'ASK' || decision === 'ALWAYS_ASK',
    denied: decision === 'DENY',
    paths: Object.freeze(paths.slice(0, 30)),
    invalidPathCount: invalidPaths.length,
    sensitivePathCount: sensitivePaths.length,
    mandatoryGates: Object.freeze({
      proposalDigest: true,
      currentHead: true,
      scopeIntelligence: true,
      humanIntent: true,
      toolRuntime: true,
      continuity: true,
      guardedCommit: true
    }),
    constraints: Object.freeze({
      databaseAutoApproval: false,
      deployAutoApproval: false,
      gitPushAutoApproval: false,
      destructiveAutoApproval: false,
      callerSuppliedDecisionTrusted: false,
      humanIntentOverridesAllowedForAuto: false
    }),
    writer: false,
    approvalAuthority: false
  });
}

export function publicPolicySettings(value = {}) {
  return Object.freeze({
    schema: AUTONOMY_POLICY_SCHEMA,
    build: 98,
    mode: normalizeAutonomyMode(value?.mode),
    updatedAt: text(value?.updatedAt, 80),
    userSelected: value?.userSelected === true,
    fixedSafetyFloor: true
  });
}
