'use strict';

(() => {
  const SCHEMA = 'ld-editor-cancel/1';
  let cancelReject = null;
  let cancelPromise = null;
  let cancelled = false;

  if (typeof ld84EditorLocalChat !== 'function') {
    throw new Error('EDITOR_CANCEL_DEPENDENCY_REQUIRED');
  }

  const baseChat = ld84EditorLocalChat;

  function resetGate() {
    cancelled = false;
    cancelPromise = new Promise((_, reject) => {
      cancelReject = reject;
    });
  }

  function begin() {
    resetGate();
  }

  function end() {
    cancelled = false;
    cancelReject = null;
    cancelPromise = null;
  }

  function cancel() {
    if (cancelled) return false;
    cancelled = true;
    const error = new Error('EDITOR_CANCELLED_BY_USER');
    error.code = 'EDITOR_CANCELLED_BY_USER';
    error.details = {
      safe: true,
      writeExecuted: false,
      note: 'The provider request may finish remotely, but its result is ignored by the Decrypter pipeline.'
    };
    if (cancelReject) cancelReject(error);
    return true;
  }

  async function cancellableChat(messages, options = {}) {
    if (!cancelPromise) resetGate();
    return Promise.race([
      baseChat(messages, options),
      cancelPromise
    ]);
  }

  ld84EditorLocalChat = cancellableChat;
  globalThis.ld84EditorCancelBegin = begin;
  globalThis.ld84EditorCancelEnd = end;
  globalThis.ld84EditorCancelCurrent = cancel;

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (String(message?.type || '') !== 'ld84.cancel.current') return;
    const allowed = (() => {
      try {
        const url = new URL(sender?.url || sender?.tab?.url || '');
        return url.protocol === 'chrome-extension:' || url.hostname === 'lovable.dev' || url.hostname.endsWith('.lovable.dev');
      } catch (_) {
        return false;
      }
    })();
    if (!allowed) {
      sendResponse({ ok: false, code: 'SENDER_NOT_ALLOWED' });
      return false;
    }
    sendResponse({ ok: true, schema: SCHEMA, cancelled: cancel() });
    return false;
  });

  Object.defineProperty(globalThis, 'LovableDecrypterEditorCancelV84', {
    value: Object.freeze({
      schema: SCHEMA,
      build: 84,
      pipelineResultDiscard: true,
      providerRequestAbortGuaranteed: false,
      writeAfterCancel: false
    }),
    configurable: false,
    enumerable: false,
    writable: false
  });
})();