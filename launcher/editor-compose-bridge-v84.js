(() => {
  'use strict';
  if (window.__LD84_EDITOR_COMPOSE_BRIDGE__) return;
  window.__LD84_EDITOR_COMPOSE_BRIDGE__ = true;

  const HOST_ID = 'lovable-decrypter-launcher';
  const CONTROL_ATTR = 'data-ld84-compose-bridge';
  let current = null;
  let busy = false;

  function isExtensionNode(node) {
    try { return !!node?.getRootNode?.()?.host?.id && node.getRootNode().host.id === HOST_ID; } catch (_) { return false; }
  }

  function isEditable(node) {
    if (!(node instanceof Element) || isExtensionNode(node)) return false;
    if (node.matches('textarea')) return true;
    if (node.getAttribute('contenteditable') === 'true') return true;
    return false;
  }

  function semanticSendButton(button) {
    if (!(button instanceof HTMLButtonElement)) return false;
    if (button.closest(`[${CONTROL_ATTR}]`)) return false;
    if (String(button.type || '').toLowerCase() === 'submit') return true;
    const semantic = [button.getAttribute('aria-label'), button.getAttribute('title'), button.textContent]
      .filter(Boolean).join(' ').toLowerCase();
    return /\b(send|submit|enviar|mandar|run|prompt|message)\b/.test(semantic);
  }

  function scoreComposer(input) {
    const rect = input.getBoundingClientRect();
    if (rect.width < 260 || rect.height < 28 || rect.bottom < window.innerHeight * 0.45) return 0;
    let score = 1;
    const hint = [input.getAttribute('placeholder'), input.getAttribute('aria-label'), input.getAttribute('data-placeholder')]
      .filter(Boolean).join(' ').toLowerCase();
    if (/ask|message|prompt|describe|lovable|chat|build|make|create|edit/.test(hint)) score += 3;
    let ancestor = input.parentElement;
    for (let depth = 0; ancestor && depth < 6; depth += 1, ancestor = ancestor.parentElement) {
      if (ancestor.matches('form')) score += 2;
      if ([...ancestor.querySelectorAll('button')].some(semanticSendButton)) score += 3;
      const label = [ancestor.getAttribute('aria-label'), ancestor.getAttribute('data-testid'), ancestor.className]
        .filter(value => typeof value === 'string').join(' ').toLowerCase();
      if (/chat|composer|prompt|message/.test(label)) score += 2;
    }
    return score;
  }

  function findContainer(input) {
    let candidate = input.parentElement;
    let best = candidate;
    for (let depth = 0; candidate && depth < 7; depth += 1, candidate = candidate.parentElement) {
      best = candidate;
      if (candidate.matches('form')) return candidate;
      if ([...candidate.querySelectorAll(':scope > button, button')].some(semanticSendButton)) return candidate;
    }
    return best || input.parentElement;
  }

  function readCommand(input) {
    if (input instanceof HTMLTextAreaElement) return String(input.value || '').trim();
    return String(input.innerText || input.textContent || '').trim();
  }

  function toast(text, kind = 'info') {
    document.querySelector('[data-ld84-compose-toast]')?.remove();
    const node = document.createElement('div');
    node.setAttribute('data-ld84-compose-toast', '1');
    node.style.cssText = [
      'position:fixed','right:18px','bottom:18px','z-index:2147483646','max-width:380px',
      'padding:11px 13px','border-radius:12px','font:12px/1.4 Arial,sans-serif',
      `background:${kind === 'error' ? 'rgba(72,19,31,.96)' : 'rgba(10,21,39,.96)'}`,
      `border:1px solid ${kind === 'error' ? 'rgba(255,91,115,.45)' : 'rgba(56,189,248,.32)'}`,
      `color:${kind === 'error' ? '#ffd5dd' : '#e8f5ff'}`,
      'box-shadow:0 16px 45px rgba(0,0,0,.34)'
    ].join(';');
    node.textContent = text;
    document.documentElement.appendChild(node);
    setTimeout(() => { try { node.remove(); } catch (_) {} }, 6000);
  }

  function updateControl() {
    if (!current?.shell) return;
    current.toggle.textContent = current.active ? 'Decrypter ON' : 'Decrypter';
    current.toggle.style.background = current.active ? 'rgba(37,99,235,.95)' : 'rgba(10,21,39,.92)';
    current.mode.style.display = current.active ? 'inline-flex' : 'none';
    current.mode.textContent = current.modeValue === 'plan' ? 'Plan' : 'Build';
  }

  function mount(input) {
    if (scoreComposer(input) < 4) return;
    const container = findContainer(input);
    if (!container) return;
    if (current?.input === input && current.shell?.isConnected) return;
    current?.shell?.remove();

    const computed = getComputedStyle(container);
    if (computed.position === 'static') {
      container.dataset.ld84ComposePreviousPosition = container.style.position || '';
      container.style.position = 'relative';
    }

    const shell = document.createElement('div');
    shell.setAttribute(CONTROL_ATTR, '1');
    shell.style.cssText = [
      'position:absolute','right:54px','bottom:8px','z-index:40','display:flex','gap:5px','align-items:center',
      'font-family:Arial,sans-serif','pointer-events:auto'
    ].join(';');
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.title = 'Quando ativo, Enter/Enviar passa pelo Editor Direto e não pelo chat do Lovable.';
    toggle.style.cssText = 'height:28px;padding:0 9px;border-radius:9px;border:1px solid rgba(125,211,252,.32);background:rgba(10,21,39,.92);color:#e8f5ff;font:700 10px Arial;cursor:pointer;box-shadow:0 5px 18px rgba(0,0,0,.22)';
    const mode = document.createElement('button');
    mode.type = 'button';
    mode.title = 'Alternar entre preparar Shadow Build e apenas Plan · ZERO WRITE.';
    mode.style.cssText = 'height:28px;padding:0 8px;border-radius:9px;border:1px solid rgba(129,140,248,.28);background:rgba(30,41,75,.94);color:#dbeafe;font:700 10px Arial;cursor:pointer';
    shell.append(toggle, mode);
    container.appendChild(shell);
    current = { input, container, shell, toggle, mode, active: false, modeValue: 'build' };
    updateControl();

    toggle.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      current.active = !current.active;
      updateControl();
      toast(current.active ? 'Editor Direto ativado neste compose. O próximo envio será interceptado pelo Decrypter.' : 'Editor Direto desativado. O compose voltou ao comportamento normal do Lovable.');
    });
    mode.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      current.modeValue = current.modeValue === 'build' ? 'plan' : 'build';
      updateControl();
    });
  }

  function editorShadow() {
    return document.getElementById(HOST_ID)?.shadowRoot || null;
  }

  function clickEditorControl() {
    const shadow = editorShadow();
    const control = shadow?.querySelector('[data-ld-editor-direct], [data-ld-parity="editor-direct"]');
    if (!control) return false;
    control.click();
    return true;
  }

  function waitForEditor(timeoutMs = 5000) {
    const started = performance.now();
    return new Promise(resolve => {
      const check = () => {
        const shadow = editorShadow();
        const modal = shadow?.getElementById('ld84-editor-direct-modal');
        const prompt = modal ? [...modal.querySelectorAll('textarea')].sort((a,b) => b.clientHeight - a.clientHeight)[0] : null;
        if (modal && prompt) return resolve({ shadow, modal, prompt });
        if (performance.now() - started >= timeoutMs) return resolve(null);
        setTimeout(check, 60);
      };
      check();
    });
  }

  function buttonsByText(modal, pattern) {
    return [...modal.querySelectorAll('button')].filter(button => pattern.test(String(button.textContent || '').trim()));
  }

  async function route(command, modeValue) {
    if (busy) return toast('Já existe uma operação do Editor Direto em andamento.', 'error');
    busy = true;
    try {
      if (!clickEditorControl()) throw new Error('EDITOR_DIRECT_CONTROL_NOT_FOUND');
      const editor = await waitForEditor();
      if (!editor) throw new Error('EDITOR_DIRECT_MODAL_TIMEOUT');
      editor.prompt.value = command;
      editor.prompt.dispatchEvent(new Event('input', { bubbles: true }));
      document.dispatchEvent(new CustomEvent('ld84-editor-modal-opened'));

      if (modeValue === 'plan') {
        const planMode = buttonsByText(editor.modal, /^Plan$/i)[0];
        if (planMode) planMode.click();
        await new Promise(resolve => setTimeout(resolve, 0));
        const execute = buttonsByText(editor.modal, /Planejar|ZERO WRITE/i).find(button => !/^Plan$/i.test(String(button.textContent || '').trim()));
        if (!execute) throw new Error('EDITOR_DIRECT_PLAN_BUTTON_NOT_FOUND');
        execute.click();
      } else {
        const buildMode = buttonsByText(editor.modal, /^Build$/i)[0];
        if (buildMode) buildMode.click();
        await new Promise(resolve => setTimeout(resolve, 0));
        const execute = buttonsByText(editor.modal, /Preparar Shadow Build/i)[0];
        if (!execute) throw new Error('EDITOR_DIRECT_BUILD_BUTTON_NOT_FOUND');
        execute.click();
      }
    } catch (error) {
      toast(String(error?.message || error || 'EDITOR_COMPOSE_ROUTE_FAILED'), 'error');
    } finally {
      busy = false;
    }
  }

  function intercept(command, modeValue, event) {
    if (!current?.active || !command) return false;
    event?.preventDefault?.();
    event?.stopPropagation?.();
    event?.stopImmediatePropagation?.();
    route(command, modeValue);
    return true;
  }

  document.addEventListener('focusin', event => {
    const target = event.target;
    if (isEditable(target)) mount(target);
  }, true);

  document.addEventListener('input', event => {
    const target = event.target;
    if (isEditable(target) && (!current || current.input !== target)) mount(target);
  }, true);

  document.addEventListener('keydown', event => {
    if (!current?.active || event.target !== current.input) return;
    if (event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
    intercept(readCommand(current.input), current.modeValue, event);
  }, true);

  document.addEventListener('submit', event => {
    if (!current?.active || !(event.target instanceof HTMLFormElement) || !event.target.contains(current.input)) return;
    intercept(readCommand(current.input), current.modeValue, event);
  }, true);

  document.addEventListener('click', event => {
    if (!current?.active) return;
    const button = event.target instanceof Element ? event.target.closest('button') : null;
    if (!button || !current.container.contains(button) || !semanticSendButton(button)) return;
    intercept(readCommand(current.input), current.modeValue, event);
  }, true);

  Object.defineProperty(window, 'LovableDecrypterEditorComposeBridgeV84', {
    value: Object.freeze({
      schema: 'ld-editor-compose-bridge/1',
      build: 84,
      nativeComposerOptIn: true,
      networkMonkeypatch: false,
      nativeSendPreservedWhenOff: true,
      defaultMode: 'build',
      explicitReviewPreserved: true
    }),
    configurable: false,
    enumerable: false,
    writable: false
  });
})();