(() => {
  'use strict';
  if (window.__LD84_EDITOR_PROGRESS_UI__) return;
  window.__LD84_EDITOR_PROGRESS_UI__ = true;

  const STORAGE_KEY = 'ld84_editor_progress';
  const HOST_ID = 'lovable-decrypter-launcher';
  const PANEL_ID = 'ld84-editor-progress-panel';

  function hostShadow() {
    return document.getElementById(HOST_ID)?.shadowRoot || null;
  }

  function removePanel() {
    hostShadow()?.getElementById(PANEL_ID)?.remove();
  }

  function ensurePanel() {
    const shadow = hostShadow();
    if (!shadow) return null;
    const modal = shadow.getElementById('ld84-editor-direct-modal');
    if (!modal) return null;
    let panel = shadow.getElementById(PANEL_ID);
    if (panel) return panel;
    const status = modal.querySelector('.ed-status');
    if (!status) return null;
    panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.style.cssText = [
      'margin:-4px 0 13px',
      'padding:10px 11px',
      'border:1px solid rgba(59,210,255,.14)',
      'border-radius:12px',
      'background:rgba(6,15,29,.62)',
      'font-family:Arial,sans-serif'
    ].join(';');
    panel.innerHTML = `
      <div data-ld84-progress-head style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:7px">
        <span data-ld84-progress-label style="font:600 11px/1.35 Arial;color:#dbeafe">Aguardando operação…</span>
        <span data-ld84-progress-count style="font:700 10px/1 Arial;color:#7dd3fc">0/0</span>
      </div>
      <div style="height:7px;border-radius:999px;background:rgba(255,255,255,.07);overflow:hidden;position:relative">
        <div data-ld84-progress-bar style="height:100%;width:0%;border-radius:inherit;background:linear-gradient(90deg,#38bdf8,#818cf8);transition:width .18s ease"></div>
        <div data-ld84-progress-wait style="display:none;position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.2),transparent);animation:ld84ProgressSweep 1.25s linear infinite"></div>
      </div>
      <div data-ld84-progress-meta style="margin-top:6px;font:10px/1.35 Arial;color:#8191aa">Progresso baseado em etapas concluídas; sem estimativa fictícia de tempo.</div>
      <style>@keyframes ld84ProgressSweep{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}</style>`;
    status.insertAdjacentElement('afterend', panel);
    return panel;
  }

  function render(progress) {
    if (!progress || progress.schema !== 'ld-editor-progress/1') return;
    const panel = ensurePanel();
    if (!panel) return;
    const label = panel.querySelector('[data-ld84-progress-label]');
    const count = panel.querySelector('[data-ld84-progress-count]');
    const bar = panel.querySelector('[data-ld84-progress-bar]');
    const wait = panel.querySelector('[data-ld84-progress-wait]');
    const meta = panel.querySelector('[data-ld84-progress-meta]');
    const total = Math.max(1, Number(progress.total || 1));
    const step = Math.max(0, Math.min(total, Number(progress.step || 0)));
    const percent = Math.max(0, Math.min(100, Number(progress.percent || 0)));
    if (label) label.textContent = progress.label || progress.phase || 'Executando…';
    if (count) count.textContent = `${step}/${total} · ${percent}%`;
    if (bar) bar.style.width = `${percent}%`;
    if (wait) wait.style.display = progress.indeterminate === true && progress.status === 'running' ? 'block' : 'none';
    if (panel) {
      panel.style.borderColor = progress.status === 'error' ? 'rgba(255,91,115,.34)' : progress.status === 'complete' ? 'rgba(67,216,142,.32)' : 'rgba(59,210,255,.14)';
    }
    if (meta) {
      if (progress.status === 'error') meta.textContent = progress.code ? `Interrompido em ${progress.phase || 'etapa atual'} · ${progress.code}` : 'Operação interrompida.';
      else if (progress.status === 'complete') meta.textContent = 'Pipeline concluído. Esta barra avançou somente quando uma etapa real terminou.';
      else if (progress.indeterminate === true) meta.textContent = 'Aguardando uma operação externa/modelo; a porcentagem não avança artificialmente enquanto não há confirmação.';
      else meta.textContent = 'Progresso baseado em etapas concluídas; sem estimativa fictícia de tempo.';
    }
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[STORAGE_KEY]) return;
    render(changes[STORAGE_KEY].newValue);
  });

  document.addEventListener('ld84-editor-modal-opened', () => {
    chrome.storage.local.get([STORAGE_KEY], stored => render(stored?.[STORAGE_KEY]));
  });

  window.addEventListener('pagehide', removePanel, { once: true });
})();