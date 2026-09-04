(() => {
  'use strict';
  if (window.__LD84_OPERATION_FEEDBACK__) return;
  window.__LD84_OPERATION_FEEDBACK__ = true;

  const HOST_ID = 'lovable-decrypter-launcher';
  const CSS = `
    @keyframes ld84DangerPulseFast{
      0%,100%{box-shadow:0 0 0 1px rgba(255,48,78,.18),0 0 8px rgba(255,48,78,.14);background:rgba(255,42,72,.15)}
      50%{box-shadow:0 0 0 1px rgba(255,64,92,.52),0 0 30px rgba(255,38,72,.48);background:rgba(255,42,72,.28)}
    }
    #ld84-editor-direct-modal .ed-status[data-kind="testing"],
    #ld84-supabase-project-manager-modal .status[data-kind="testing"],
    #ld84-github-sync-modal .ghs-status[data-kind="testing"],
    #ld84-github-sync-modal [data-op-kind="testing"],
    #ld84-resource-manager-modal .ld84-rm-status[data-kind="testing"]{
      border-color:rgba(255,64,92,.62)!important;
      color:#ffe3e8!important;
      animation:ld84DangerPulseFast .62s ease-in-out infinite!important;
    }
    #ld84-editor-direct-modal .ed-status[data-kind="success"],
    #ld84-supabase-project-manager-modal .status[data-kind="success"],
    #ld84-github-sync-modal .ghs-status[data-kind="success"],
    #ld84-github-sync-modal [data-op-kind="success"],
    #ld84-resource-manager-modal .ld84-rm-status[data-kind="success"]{
      border-color:rgba(115,255,181,.58)!important;
      background:rgba(104,255,171,.18)!important;
      color:#effff6!important;
      animation:none!important;
      box-shadow:0 0 22px rgba(92,255,163,.13)!important;
    }
    #ld84-editor-direct-modal .ed-status[data-kind="success"]::before,
    #ld84-supabase-project-manager-modal .status[data-kind="success"]::before,
    #ld84-github-sync-modal .ghs-status[data-kind="success"]::before,
    #ld84-github-sync-modal [data-op-kind="success"]::before,
    #ld84-resource-manager-modal .ld84-rm-status[data-kind="success"]::before{content:'✓  ';font-weight:900;color:#7dffb9}
    #ld84-editor-direct-modal .ed-status[data-kind="error"],
    #ld84-supabase-project-manager-modal .status[data-kind="error"],
    #ld84-github-sync-modal .ghs-status[data-kind="error"],
    #ld84-github-sync-modal [data-op-kind="error"],
    #ld84-resource-manager-modal .ld84-rm-status[data-kind="error"]{animation:none!important;border-color:rgba(255,74,103,.55)!important;background:rgba(255,48,78,.16)!important;color:#ffe0e6!important}
  `;

  function setTesting(node, text) {
    if (!node) return;
    node.dataset.kind = 'testing';
    node.dataset.opKind = 'testing';
    if (text) node.textContent = text;
  }

  function bind() {
    const shadow = document.getElementById(HOST_ID)?.shadowRoot;
    if (!shadow) return false;
    if (shadow.__ld84OperationFeedbackBound) return true;
    Object.defineProperty(shadow, '__ld84OperationFeedbackBound', { value: true, configurable: false });

    if (!shadow.getElementById('ld84-operation-feedback-style')) {
      const style = document.createElement('style');
      style.id = 'ld84-operation-feedback-style';
      style.textContent = CSS;
      shadow.appendChild(style);
    }

    // Runs after direct button listeners. Their asynchronous completion remains authoritative
    // and replaces this temporary testing state with success/error.
    shadow.addEventListener('click', event => {
      const button = event.target?.closest?.('button');
      if (!button) return;
      const label = String(button.textContent || '').trim();

      const editor = button.closest('#ld84-editor-direct-modal');
      if (editor && label === 'Salvar vínculo') {
        setTesting(editor.querySelector('.ed-status'), 'Salvando e validando vínculo Lovable ↔ GitHub ↔ Supabase…');
        return;
      }

      const supabase = button.closest('#ld84-supabase-project-manager-modal');
      if (supabase) {
        const status = supabase.querySelector('.status');
        if (label === 'Renomear') setTesting(status, 'Renomeando projeto no Supabase…');
        else if (label === 'Vincular ao Lovable') setTesting(status, 'Salvando vínculo com o projeto Lovable atual…');
        else if (label === 'Atualizar provisionamento') setTesting(status, 'Consultando provisionamento no Supabase…');
        else if (label === 'Testar acesso') setTesting(status, 'Testando acesso ao banco…');
      }
    });
    return true;
  }

  if (!bind() && document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => bind(), { once: true });
})();