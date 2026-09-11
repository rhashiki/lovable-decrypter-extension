(() => {
  'use strict';
  if (window.__LD84_EDITOR_COMPOSE_STATE_HIGHLIGHT__) return;
  window.__LD84_EDITOR_COMPOSE_STATE_HIGHLIGHT__ = true;

  const CONTROL_ATTR = 'data-ld84-compose-bridge';
  const HIGHLIGHT_ATTR = 'data-ld84-compose-state-highlight';
  const PREF_KEY = 'ld84_native_compose';

  const ACTIVE = Object.freeze({
    state: 'active',
    border: 'rgba(34,197,94,.98)',
    glow: 'rgba(34,197,94,.38)',
    soft: 'rgba(34,197,94,.16)'
  });
  const INACTIVE = Object.freeze({
    state: 'inactive',
    border: 'rgba(239,68,68,.98)',
    glow: 'rgba(239,68,68,.34)',
    soft: 'rgba(239,68,68,.14)'
  });

  function composeContainer() {
    const shell = document.querySelector(`[${CONTROL_ATTR}="shell"]`);
    return shell?.parentElement || null;
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
      'z-index:42',
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
    const container = composeContainer();
    if (!container) return false;
    const highlight = ensureHighlight(container);
    if (!highlight) return false;

    const palette = enabled ? ACTIVE : INACTIVE;
    highlight.dataset.state = palette.state;
    highlight.style.borderColor = palette.border;
    highlight.style.boxShadow = `0 0 0 1px ${palette.soft}, 0 0 18px ${palette.glow}, inset 0 0 12px ${palette.soft}`;
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