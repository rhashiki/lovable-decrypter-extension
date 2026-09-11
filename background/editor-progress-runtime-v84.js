'use strict';

(() => {
  const SCHEMA = 'ld-editor-progress/1';
  const STORAGE_KEY = 'ld84_editor_progress';
  let active = null;
  let aiCall = 0;

  if (typeof ld84EditorPlan !== 'function' || typeof ld84EditorBuild !== 'function' || typeof ld84EditorLocalChat !== 'function') {
    throw new Error('EDITOR_PROGRESS_DEPENDENCIES_REQUIRED');
  }

  const planBase84 = ld84EditorPlan;
  const buildBase84 = ld84EditorBuild;
  const aiBase84 = ld84EditorLocalChat;
  const contextBase84 = typeof ld84ContextBuild === 'function' ? ld84ContextBuild : null;

  function setLocal(value) {
    return new Promise(resolve => chrome.storage.local.set(value, () => resolve()));
  }

  async function publish(phase, label, step, total, status = 'running', extra = {}) {
    if (!active) return;
    const safeTotal = Math.max(1, Number(total || active.total || 1));
    const safeStep = Math.max(0, Math.min(safeTotal, Number(step || 0)));
    const payload = {
      schema: SCHEMA,
      operationId: active.operationId,
      kind: active.kind,
      projectId: active.projectId || '',
      phase: String(phase || ''),
      label: String(label || '').slice(0, 240),
      step: safeStep,
      total: safeTotal,
      percent: Math.round((safeStep / safeTotal) * 100),
      status,
      indeterminate: extra.indeterminate === true,
      provider: extra.provider || null,
      model: extra.model || null,
      code: extra.code || null,
      startedAt: active.startedAt,
      updatedAt: new Date().toISOString()
    };
    active.last = payload;
    await setLocal({ [STORAGE_KEY]: payload });
  }

  function begin(kind, message, total) {
    if (active) {
      const error = new Error('EDITOR_OPERATION_IN_PROGRESS');
      error.code = 'EDITOR_OPERATION_IN_PROGRESS';
      throw error;
    }
    active = {
      operationId: crypto.randomUUID(),
      kind,
      projectId: String(message?.projectId || '').slice(0, 120),
      total,
      startedAt: new Date().toISOString(),
      last: null
    };
    aiCall = 0;
    return active;
  }

  async function finishSuccess(label) {
    if (!active) return;
    await publish('complete', label, active.total, active.total, 'complete');
    active = null;
    aiCall = 0;
  }

  async function finishError(error) {
    if (!active) return;
    const current = active.last || {};
    await publish(
      current.phase || 'error',
      `Falha: ${String(error?.code || error?.message || error || 'EDITOR_OPERATION_FAILED').slice(0, 180)}`,
      Number(current.step || 0),
      active.total,
      'error',
      { code: String(error?.code || error?.message || 'EDITOR_OPERATION_FAILED') }
    );
    active = null;
    aiCall = 0;
  }

  async function aiWithProgress(messages, options = {}) {
    if (!active) return aiBase84(messages, options);
    aiCall += 1;
    if (active.kind === 'plan') {
      await publish('planning-model', 'Planejamento · enviando contexto para a IA', 1, active.total, 'running', { indeterminate: true });
    } else if (aiCall === 1) {
      await publish('planning-model', 'Planejamento · analisando pedido e árvore Git', 1, active.total, 'running', { indeterminate: true });
    } else {
      await publish('shadow-model', 'Shadow Build · gerando alterações em memória', 5, active.total, 'running', { indeterminate: true });
    }
    try {
      const result = await aiBase84(messages, options);
      if (active?.kind === 'plan') {
        await publish('planning-validate', 'Planejamento · resposta recebida, validando escopo', 3, active.total);
      } else if (aiCall === 1) {
        await publish('planning-complete', 'Planejamento concluído · preparando contexto do projeto', 2, active.total);
      } else {
        await publish('shadow-validate', 'Shadow Build recebido · validando arquivos, Scope e preflight', 7, active.total);
      }
      return result;
    } catch (error) {
      throw error;
    }
  }

  async function contextWithProgress(input = {}) {
    if (!active || active.kind !== 'build' || !contextBase84) return contextBase84 ? contextBase84(input) : null;
    await publish('context-pack', 'Build · montando Context Pack e Project Brain', 3, active.total, 'running', { indeterminate: true });
    const result = await contextBase84(input);
    await publish('context-ready', 'Build · Context Pack pronto e HEAD conferido', 4, active.total);
    return result;
  }

  async function planWithProgress(message = {}) {
    begin('plan', message, 4);
    await publish('prepare', 'Planejamento · validando vínculo, branch e HEAD', 0, 4, 'running', { indeterminate: true });
    try {
      const result = await planBase84(message);
      await finishSuccess('Plano validado · ZERO WRITE confirmado');
      return result;
    } catch (error) {
      await finishError(error);
      throw error;
    }
  }

  async function buildWithProgress(message = {}) {
    begin('build', message, 8);
    await publish('prepare', 'Build · validando vínculo, branch e HEAD', 0, 8, 'running', { indeterminate: true });
    try {
      const result = await buildBase84(message);
      await finishSuccess('Shadow Build validado · nenhum write executado');
      return result;
    } catch (error) {
      await finishError(error);
      throw error;
    }
  }

  ld84EditorLocalChat = aiWithProgress;
  if (contextBase84) ld84ContextBuild = contextWithProgress;
  ld84EditorPlan = planWithProgress;
  ld84EditorBuild = buildWithProgress;

  Object.defineProperty(globalThis, 'LovableDecrypterEditorProgressV84', {
    value: Object.freeze({
      schema: SCHEMA,
      build: 84,
      storageKey: STORAGE_KEY,
      truthfulMilestonesOnly: true,
      syntheticTimeProgress: false,
      modelWaitIndeterminate: true,
      globalEditorOperationLock: true
    }),
    configurable: false,
    enumerable: false,
    writable: false
  });
})();