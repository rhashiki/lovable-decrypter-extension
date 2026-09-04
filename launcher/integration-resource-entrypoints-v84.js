(() => {
  'use strict';
  if (window.__LD84_INTEGRATION_RESOURCE_ENTRYPOINTS__) return;
  window.__LD84_INTEGRATION_RESOURCE_ENTRYPOINTS__ = true;

  const HOST_ID = 'lovable-decrypter-launcher';
  const NS = 'http://www.w3.org/2000/svg';

  function actionIcon(integration) {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('aria-hidden', 'true');

    const paths = integration === 'github'
      ? ['M5 4h14v16H5z','M8 8h8','M8 12h8','M8 16h5']
      : ['M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3Z','M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6','M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6'];

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

  function fitDetail(shadow, detail) {
    if (!detail?.classList.contains('show')) return;
    const rail = shadow.getElementById('rail');
    const maxH = Math.max(240, Math.floor(rail?.getBoundingClientRect?.().height || 0));
    if (!maxH) return;

    detail.style.height = 'auto';
    detail.style.maxHeight = 'none';
    detail.style.overflowY = 'hidden';

    const natural = Math.max(detail.scrollHeight || 0, 1);
    const height = Math.min(natural, maxH);
    let top = Number.parseFloat(detail.style.top || '8');
    if (!Number.isFinite(top)) top = 8;
    if (top + height > window.innerHeight - 8) top = Math.max(8, window.innerHeight - height - 8);

    detail.style.top = `${Math.round(top)}px`;
    detail.style.height = `${Math.round(height)}px`;
    detail.style.maxHeight = `${Math.round(height)}px`;
    detail.style.overflowY = natural > height ? 'auto' : 'hidden';
  }

  function removeTopLevelResourceEntries(shadow) {
    const flyout = shadow.getElementById('flyout');
    if (!flyout?.classList.contains('show')) return;
    const title = String(flyout.querySelector('.fly-title span')?.textContent || '').trim();
    if (title !== 'Integrações') return;
    for (const node of flyout.querySelectorAll('[data-ld-resource-entrypoint],.ld84-resource-entry')) node.remove();
  }

  function ensureSingleNestedEntry(shadow) {
    const detail = shadow.getElementById('detail');
    if (!detail?.classList.contains('show')) return;
    const integration = String(detail.dataset.module || '');
    if (!['github', 'supabase'].includes(integration)) return;
    const actions = detail.querySelector('.actions');
    if (!actions) return;

    const existing = [...actions.querySelectorAll('[data-ld-resource-manage]')];
    const canonical = existing.find(node => node.dataset.ldResourceCanonicalDetail === integration);
    if (existing.length === 1 && canonical && canonical.querySelector('svg') && canonical.querySelector('span')) return;

    for (const node of existing) node.remove();

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'action';
    button.dataset.ldResourceManage = integration;
    button.dataset.ldResourceCanonicalDetail = integration;

    const label = document.createElement('span');
    label.textContent = integration === 'github' ? 'Gerenciar repositórios' : 'Gerenciar projetos';
    button.append(actionIcon(integration), label);
    actions.appendChild(button);
    fitDetail(shadow, detail);
  }

  function scheduleEnsure(shadow) {
    queueMicrotask(() => {
      removeTopLevelResourceEntries(shadow);
      ensureSingleNestedEntry(shadow);
    });
  }

  function bind() {
    const host = document.getElementById(HOST_ID);
    const shadow = host?.shadowRoot;
    if (!shadow) return false;
    if (shadow.__ld84IntegrationResourceEntrypointsBound) return true;
    Object.defineProperty(shadow, '__ld84IntegrationResourceEntrypointsBound', { value: true, configurable: false });

    shadow.addEventListener('mouseover', () => scheduleEnsure(shadow));
    shadow.addEventListener('click', () => scheduleEnsure(shadow));
    scheduleEnsure(shadow);
    return true;
  }

  const bound = bind();
  if (!bound && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { bind(); }, { once: true });
  }
})();
