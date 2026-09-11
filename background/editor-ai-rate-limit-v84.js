'use strict';

(() => {
  const SCHEMA = 'ld-editor-ai-rate-limit/1';
  const PROGRESS_KEY = 'ld84_editor_progress';
  const MAX_RETRY_DELAY_MS = 8000;
  const DEFAULT_RETRY_DELAY_MS = 2500;

  if (typeof ld84EditorLocalChat !== 'function' || typeof ld84EditorHealth !== 'function' || typeof ld84EditorLocalSettings !== 'function') {
    throw new Error('EDITOR_AI_RATE_LIMIT_DEPENDENCIES_REQUIRED');
  }

  const routedBase84 = ld84EditorLocalChat;

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function cancelled() {
    return typeof globalThis.ld84EditorCancelWasRequested === 'function' && globalThis.ld84EditorCancelWasRequested() === true;
  }

  function cancellationError() {
    const error = new Error('EDITOR_CANCELLED_BY_USER');
    error.code = 'EDITOR_CANCELLED_BY_USER';
    error.details = { safe: true, retryAttempted: false, writeExecuted: false };
    return error;
  }

  function parseRetryMs(error) {
    const details = error?.details && typeof error.details === 'object' ? error.details : {};
    const explicit = Number(details.retry_after_seconds || details.retryAfterSeconds || 0);
    if (Number.isFinite(explicit) && explicit > 0) return Math.min(MAX_RETRY_DELAY_MS, Math.ceil(explicit * 1000));
    const text = [details.message, error?.message].filter(Boolean).join(' ');
    const match = text.match(/(?:retry|try again)(?:\s+in|\s+after)?\s*([0-9]+(?:\.[0-9]+)?)\s*s(?:ec(?:ond)?s?)?/i);
    if (match) return Math.min(MAX_RETRY_DELAY_MS, Math.ceil(Number(match[1]) * 1000));
    return DEFAULT_RETRY_DELAY_MS;
  }

  async function publishRetry(delayMs) {
    const stored = await new Promise(resolve => chrome.storage.local.get([PROGRESS_KEY], value => resolve(value || {})));
    const current = stored[PROGRESS_KEY];
    if (!current || current.status !== 'running' || cancelled()) return;
    const next = {
      ...current,
      label: `Gemini atingiu o limite momentâneo · retry único em ${(delayMs / 1000).toFixed(delayMs % 1000 ? 1 : 0)} s`,
      indeterminate: true,
      code: 'GEMINI_HTTP_429',
      updatedAt: new Date().toISOString()
    };
    await new Promise(resolve => chrome.storage.local.set({ [PROGRESS_KEY]: next }, () => resolve()));
  }

  function rateLimited(error) {
    const code = String(error?.code || error?.message || '');
    return code === 'GEMINI_HTTP_429' || code === 'GEMINI_RATE_LIMITED';
  }

  async function chatWithBoundedRetry(messages, options = {}) {
    try {
      return await routedBase84(messages, options);
    } catch (error) {
      if (!rateLimited(error)) throw error;
      if (cancelled()) throw cancellationError();

      // Preserve provider determinism. If local became eligible after the Gemini
      // attempt, do not retry through the router because that could switch providers.
      const settings = await ld84EditorLocalSettings();
      const health = await ld84EditorHealth(settings);
      if (cancelled()) throw cancellationError();
      if (health?.ok === true && Boolean(settings?.token)) {
        const locked = new Error('GEMINI_RATE_LIMITED');
        locked.code = 'GEMINI_RATE_LIMITED';
        locked.details = {
          ...(error?.details || {}),
          retryAttempted: false,
          reason: 'provider-state-changed',
          remediation: 'Tente novamente manualmente. O Decrypter não troca de provedor depois que uma inferência já começou.'
        };
        throw locked;
      }

      const delayMs = parseRetryMs(error);
      await publishRetry(delayMs);
      await sleep(delayMs);
      if (cancelled()) throw cancellationError();

      try {
        return await routedBase84(messages, { ...options, rateLimitRetry: 1 });
      } catch (retryError) {
        if (cancelled()) throw cancellationError();
        if (!rateLimited(retryError)) throw retryError;
        const finalError = new Error('GEMINI_RATE_LIMITED');
        finalError.code = 'GEMINI_RATE_LIMITED';
        finalError.details = {
          ...(retryError?.details || error?.details || {}),
          retryAttempted: true,
          retryDelayMs: delayMs,
          remediation: 'O limite da chave Gemini continua ativo. Aguarde a janela de quota, use outra chave Gemini autorizada ou configure o runtime local. Nenhum write foi executado.'
        };
        throw finalError;
      }
    }
  }

  ld84EditorLocalChat = chatWithBoundedRetry;

  Object.defineProperty(globalThis, 'LovableDecrypterEditorAiRateLimitV84', {
    value: Object.freeze({
      schema: SCHEMA,
      build: 84,
      maxRetries: 1,
      maxRetryDelayMs: MAX_RETRY_DELAY_MS,
      providerSwitchAfterStart: false,
      retrySuppressedAfterCancellation: true,
      silentInfiniteRetry: false
    }),
    configurable: false,
    enumerable: false,
    writable: false
  });
})();