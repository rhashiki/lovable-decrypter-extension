(() => {
  'use strict';
  if (window.__LD84_EDITOR_COMPOSE_STATE_HIGHLIGHT__) return;
  window.__LD84_EDITOR_COMPOSE_STATE_HIGHLIGHT__ = true;

  const PREF_KEY = 'ld84_native_compose';
  const OWN = 'data-ld84-native-chat';
  const HIGHLIGHT_ATTR = 'data-ld84-compose-state-highlight';

  const ACTIVE = Object.freeze({
    state: 'active',
    border: 'rgba(34,197,94,.98)',
    glow: 'rgba(34,197,94,.42)',
    soft: 'rgba(34,197,94,.18)'
  });
  const INACTIVE = Object.freeze({
    state: 'inactive',
    border: 'rgba(239,68,68,.98)',
    glow: 'rgba(239,68,68,.38)',
    soft: 'rgba(239,68,68,.16)'
  });

  function isOwn(node) {
    return node instanceof Element && !!node.closest(`[${OWN}]`);
  }

  function semanticSend(button) {
    if (!(button instanceof HTMLButtonElement) || isOwn(button)) return false;
    if (String(button.type || '').toLowerCase() === 'submit') return true;
    const text = [button.getAttribute('aria-label'), button.getAttribute('title'), button.textContent]
      .filter(Boolean).join(' ').toLowerCase();
    return /\b(send|submit|enviar|mandar|run|prompt|message)\b/.test(text);
  }

  function composerScore(input) {
    if (!(input instanceof Element) || isOwn(input)) return 0;
    if (!(input.matches('textarea') || input.getAttribute('contenteditable') === 'true')) return 0;
    const r = input.getBoundingClientRect();
    if (r.width < 250 || r.height < 26 || r.bottom < innerHeight * .42) return 0;
    let score = 1;
    const hint = [input.getAttribute('placeholder'), input.getAttribute('aria-label'), input.getAttribute('data-placeholder')]
      .filter(Boolean).join(' ').toLowerCase();
    if (/ask|message|prompt|describe|lovable|chat|build|create|edit|pergunte|criar/.test(hint)) score += 4;
    let ancestor = input.parentElement;
    for (let depth = 0; ancestor && depth < 7; depth += 1, ancestor = ancestor.parentElement) {
      if (ancestor.matches('form')) score += 2;
      if ([...ancestor.querySelectorAll('button')].some(semanticSend)) score += 3;
      const semantic = [ancestor.getAttribute('aria-label'), ancestor.getAttribute('data-testid'), ancestor.className]
        .filter(value => typeof value === 'string').join(' ').toLowerCase();
      if (/chat|composer|prompt|message/.test(semantic)) score += 2;
    }
    return score;
  }

  function bestComposer() {
    return [...document.querySelectorAll('textarea,[contenteditable="true"]')]
      .map(input => ({ input, score: composerScore(input) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)[0]?.input || null;
  }

  function composerContainer(input) {
    let ancestor = input?.parentElement || null;
    let best = ancestor;
    for (let depth = 0; ancestor && depth < 8; depth += 1, ancestor = ancestor.parentElement) {
      best = ancestor;
      if (ancestor.matches('form')) return ancestor;
      if ([...ancestor.querySelectorAll('button')].some(semanticSend)) return ancestor;
    }
    return best;
  }

  function ensureHighlight(container) {
    if (!container) return null;
    let highlight = container.querySelector(`:scope > [${HIGHLIGHT_ATTR}]`);
    if (highlight) return highlight;

    if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
    highlight = document.createElement('div');
    highlight.setAttribute(HIGHLIGHT_ATTR, '1');
    highlight.setAttribute('aria-hidden', 'true');
    highlight.style.cssText = [
      'position:absolute',
      'inset:-2px',
      'z-index:2147483602',
      'pointer-events:none',
      'border:2px solid transparent',
      'border-radius:inherit',
      'box-sizing:border-box',
      'transition:border-color .18s ease,box-shadow .18s ease,opacity .18s ease',
      'opacity:1'
    ].join(';');
    container.appendChild(highlight);
    return highlight;
  }

  function paint(enabled) {
    const input = bestComposer();
    const container = composerContainer(input);
    if (!container) return false;

    for (const old of document.querySelectorAll(`[${HIGHLIGHT_ATTR}]`)) {
      if (old.parentElement !== container) old.remove();
    }

    const highlight = ensureHighlight(container);
    if (!highlight) return false;
    const palette = enabled ? ACTIVE : INACTIVE;
    highlight.dataset.state = palette.state;
    highlight.style.borderColor = palette.border;
    highlight.style.boxShadow = `0 0 0 1px ${palette.soft}, 0 0 20px ${palette.glow}, inset 0 0 12px ${palette.soft}`;
    container.dataset.ld84DecrypterState = palette.state;
    return true;
  }

  function readAndPaint() {
    chrome.storage.local.get([PREF_KEY], stored => {
      const pref = stored?.[PREF_KEY] && typeof stored[PREF_KEY] === 'object' ? stored[PREF_KEY] : {};
      paint(pref.enabled === true);
    });
  }

  function deferPaint() {
    setTimeout(readAndPaint, 0);
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[PREF_KEY]) return;
    const pref = changes[PREF_KEY].newValue && typeof changes[PREF_KEY].newValue === 'object'
      ? changes[PREF_KEY].newValue
      : {};
    if (!paint(pref.enabled === true)) deferPaint();
  });

  for (const eventName of ['focusin', 'input', 'click']) {
    document.addEventListener(eventName, deferPaint, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', deferPaint, { once: true });
  } else {
    deferPaint();
  }

  Object.defineProperty(window, 'LovableDecrypterComposeStateHighlightV84', {
    value: Object.freeze({
      schema: 'ld-editor-compose-state-highlight/1',
      build: 84,
      activeColor: 'green',
      inactiveColor: 'red',
      activeHex: '#22c55e',
      inactiveHex: '#ef4444',
      layoutShift: false,
      networkAccess: false,
      mutationObserver: false,
      polling: false
    }),
    configurable: false,
    enumerable: false,
    writable: false
  });
})();