(() => {
  'use strict';

  if (window.__LD90_CANONICAL_CONTINUITY_RECOVERY_CLIENT__) return;
  window.__LD90_CANONICAL_CONTINUITY_RECOVERY_CLIENT__ = true;

  const BUILD = 90;
  const SCHEMA = 'ld-canonical-continuity-recovery/1';

  function continuity() {
    const api = window.LovableDecrypterContinuity;
    if (!api?.status || !api?.list || !api?.verifyWrite || !api?.resume) throw new Error('Continuity client não carregado.');
    return api;
  }

  function reversible() {
    const api = window.LovableDecrypterReversibleOperations;
    if (!api?.status || !api?.list || !api?.preview || !api?.apply) throw new Error('Reversible Operations client não carregado.');
    return api;
  }

  function projectId() {
    return String(window.LovableDecrypterV2?.getProjectId?.() || '');
  }

  function taskView(task = {}) {
    const steps = Array.isArray(task?.steps) ? task.steps : [];
    const verificationRequired = steps.filter(step => step?.status === 'verification_required');
    const resumable = steps.some(step => ['interrupted','failed'].includes(String(step?.status || '')) && step?.resumable !== false && Number(step?.attempts || 0) < Number(step?.maxAttempts || 0));
    const checkpoints = steps.filter(step => step?.checkpoint || step?.checkpointId);
    return Object.freeze({
      ...task,
      verificationRequired,
      checkpoints,
      canVerifyWrite: verificationRequired.some(step => step?.mode === 'write'),
      canResume: !verificationRequired.length && resumable && !['completed','cancelled'].includes(String(task?.status || '')),
      canCancel: !['completed','cancelled','failed'].includes(String(task?.status || ''))
    });
  }

  async function snapshot() {
    const pid = projectId();
    const [continuityStatus, continuityList, reversalStatus, reversalList] = await Promise.all([
      continuity().status(),
      continuity().list({ projectId: pid, limit: 50 }),
      reversible().status(),
      reversible().list(pid, 40)
    ]);
    const tasks = (Array.isArray(continuityList?.tasks) ? continuityList.tasks : []).map(taskView);
    const operations = Array.isArray(reversalList) ? reversalList : Array.isArray(reversalList?.operations) ? reversalList.operations : [];
    return Object.freeze({
      schema: SCHEMA,
      build: BUILD,
      projectId: pid,
      continuity: continuityStatus,
      reversible: reversalStatus,
      tasks,
      operations,
      attentionCount: tasks.filter(task => task?.needsAttention || task?.verificationRequired?.length).length,
      verificationRequiredCount: tasks.reduce((sum, task) => sum + (task?.verificationRequired?.length || 0), 0),
      checkpointCount: tasks.reduce((sum, task) => sum + (task?.checkpoints?.length || 0), 0),
      automaticWriteRetry: false,
      ambiguousWriteVerificationRequired: true,
      reversalDefaultStrategy: 'preserve',
      cascadeExposed: false
    });
  }

  window.LovableDecrypterCanonicalContinuityRecoveryApi = Object.freeze({
    build: BUILD,
    schema: SCHEMA,
    projectId,
    snapshot,
    recoverExpiredLeases: () => continuity().recover('canonical-user-recovery'),
    verifyWrite: (taskId, stepId) => continuity().verifyWrite(taskId, stepId),
    resumeTask: taskId => continuity().resume(taskId),
    cancelTask: taskId => continuity().cancel(taskId),
    previewUndo: operationId => reversible().preview(operationId, { projectId: projectId(), direction: 'undo', strategy: 'preserve' }),
    previewRedo: operationId => reversible().preview(operationId, { projectId: projectId(), direction: 'redo', strategy: 'preserve' }),
    applyReversal: (previewId, { confirmDestructive = false } = {}) => reversible().apply(previewId, { confirmDestructive: confirmDestructive === true }),
    retryWriteWithoutVerification: undefined,
    cascadeReversal: undefined,
    automaticWriteRetry: false
  });
})();
