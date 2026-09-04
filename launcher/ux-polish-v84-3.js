(() => {
  'use strict';
  if (window.__LD84_UX_POLISH_V3__) return;
  window.__LD84_UX_POLISH_V3__ = true;

  const HOST_ID = 'lovable-decrypter-launcher';
  const MONITOR_KEY = 'ld84_monitor_enabled';
  const NS = 'http://www.w3.org/2000/svg';

  const CSS = `
    #detail .foot,
    #detail .state,
    #detail > .label,
    #detail > .row,
    #ld84-module-modal .ld84-note{display:none!important}

    #fab{
      right:22px!important;
      bottom:22px!important;
      width:58px!important;
      height:58px!important;
      box-shadow:0 18px 44px rgba(7,8,20,.40),inset 0 1px 0 rgba(255,255,255,.06),0 0 28px rgba(59,210,255,.07)!important;
    }
    #fab:hover{box-shadow:0 20px 48px rgba(7,8,20,.44),inset 0 1px 0 rgba(255,255,255,.08),0 0 32px rgba(59,210,255,.11)!important}
    #fab > svg{width:30px!important;height:30px!important}
    #fab .badge{right:5px!important;bottom:5px!important;width:10px!important;height:10px!important;border-width:2px!important}
    :host([data-ld-monitor="off"]) #fab .badge{background:#ff637d!important;box-shadow:0 0 15px rgba(255,99,125,.75)!important}

    #railMask{
      right:25px!important;
      bottom:94px!important;
      width:52px!important;
      height:min(650px,calc(100vh - 112px))!important;
      min-height:0!important;
    }
    #rail{padding:10px 7px!important;border-radius:20px!important;overflow:hidden!important}
    .rail-logo{width:36px!important;height:36px!important;flex:0 0 36px!important;border-radius:14px!important;z-index:2!important}
    .rail-logo > svg{width:22px!important;height:22px!important}
    #railButtons{
      margin-top:9px!important;
      justify-content:flex-start!important;
      gap:4px!important;
      overflow-y:auto!important;
      overflow-x:hidden!important;
      padding:1px 0 6px!important;
      scrollbar-width:none!important;
      overscroll-behavior:contain!important;
    }
    #railButtons::-webkit-scrollbar{display:none!important}
    .rail-btn{width:34px!important;height:34px!important;flex:0 0 34px!important;border-radius:13px!important}
    .rail-btn > svg{width:18px!important;height:18px!important}
    .rail-btn:hover{transform:scale(1.08)!important}
    .rail-btn.active::after{left:-7px!important;width:5px!important;height:5px!important}
    .separator{width:22px!important;margin:1px 0!important}
    .tip{transform:translate(-10px,-50%)!important;padding:7px 9px!important;border-radius:9px!important}

    @media(max-width:820px){
      #fab{right:16px!important;bottom:16px!important;width:54px!important;height:54px!important}
      #railMask{right:17px!important;bottom:82px!important;width:52px!important;height:min(620px,calc(100vh - 98px))!important}
    }
  `;

  function icon(paths) {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('aria-hidden', 'true');
    for (const d of paths) {
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', d);
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', '1.75');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(path);
    }
    return svg;
  }

  function parityButton(id, label, paths) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'rail-btn ld84-parity-btn';
    if (id === 'editor-direct') button.dataset.ldEditorDirect = 'true';
    else button.dataset.ldParity = id;
    button.setAttribute('aria-label', label);
    button.title = label;
    button.appendChild(icon(paths));
    const tip = document.createElement('span');
    tip.className = 'tip';
    tip.textContent = label;
    button.appendChild(tip);
    return button;
  }

  function getMonitor() {
    return new Promise(resolve => chrome.storage.local.get([MONITOR_KEY], value => resolve(value?.[MONITOR_KEY] !== false)));
  }
  function setMonitor(enabled) {
    return new Promise(resolve => chrome.storage.local.set({ [MONITOR_KEY]: Boolean(enabled) }, () => resolve()));
  }
  function paintMonitor(host, button, enabled) {
    host.dataset.ldMonitor = enabled ? 'on' : 'off';
    button.dataset.monitor = enabled ? 'on' : 'off';
    button.setAttribute('aria-pressed', String(enabled));
    button.setAttribute('aria-label', enabled ? 'Monitor ON' : 'Monitor OFF');
    button.title = enabled ? 'Monitor ON' : 'Monitor OFF';
    const tip = button.querySelector('.tip');
    if (tip) tip.textContent = enabled ? 'Monitor ON' : 'Monitor OFF';
    const badge = host.shadowRoot?.getElementById('fab')?.querySelector('.badge');
    if (badge) {
      badge.style.background = enabled ? '#43d88e' : '#ff5d68';
      badge.style.boxShadow = enabled ? '0 0 15px rgba(67,216,142,.8)' : '0 0 15px rgba(255,93,104,.78)';
    }
    window.dispatchEvent(new CustomEvent('ld84:monitor-changed', { detail: { enabled } }));
  }

  async function install(host, shadow) {
    const railButtons = shadow.getElementById('railButtons');
    if (!railButtons) return false;

    if (!shadow.getElementById('ld84-ux-polish-v3-style')) {
      const style = document.createElement('style');
      style.id = 'ld84-ux-polish-v3-style';
      style.textContent = CSS;
      shadow.appendChild(style);
    }

    const canonicalSeparator = railButtons.querySelector('.separator');
    let monitor = railButtons.querySelector('[data-ld-parity="monitor"]');
    let editor = railButtons.querySelector('[data-ld-editor-direct]');

    if (!monitor) {
      monitor = parityButton('monitor', 'Monitor ON', ['M4 12h3l2-5 4 10 2-5h5','M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z']);
      if (canonicalSeparator?.nextSibling) railButtons.insertBefore(monitor, canonicalSeparator.nextSibling);
      else railButtons.appendChild(monitor);
    }
    if (!editor) {
      editor = parityButton('editor-direct', 'Editor Direto', ['m8 9-3 3 3 3','m16 9 3 3-3 3','m14 5-4 14']);
      railButtons.insertBefore(editor, monitor.nextSibling);
    }

    paintMonitor(host, monitor, await getMonitor());
    monitor.addEventListener('click', async event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const enabled = !(await getMonitor());
      await setMonitor(enabled);
      paintMonitor(host, monitor, enabled);
    }, true);

    // Canonical toggle refinement: clicking the already-active rail icon closes its open menu.
    shadow.addEventListener('click', event => {
      const button = event.target?.closest?.('.rail-btn[data-kind]');
      if (!button?.classList.contains('active')) return;
      const flyout = shadow.getElementById('flyout');
      const detail = shadow.getElementById('detail');
      if (!flyout?.classList.contains('show') && !detail?.classList.contains('show')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      flyout?.classList.remove('show');
      detail?.classList.remove('show');
      for (const node of shadow.querySelectorAll('.rail-btn.active,.fly-item.active')) node.classList.remove('active');
    }, true);

    return true;
  }

  function bind() {
    const host = document.getElementById(HOST_ID);
    const shadow = host?.shadowRoot;
    if (!shadow) return false;
    if (shadow.__ld84UxPolishV3Bound) return true;
    Object.defineProperty(shadow, '__ld84UxPolishV3Bound', { value: true, configurable: false });
    install(host, shadow).catch(() => {});
    return true;
  }

  if (!bind() && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => bind(), { once: true });
  }
})();