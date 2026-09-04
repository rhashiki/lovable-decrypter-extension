(() => {
  'use strict';
  if (window.__LD84_ACCOUNT_CONTROLLER__) return;
  window.__LD84_ACCOUNT_CONTROLLER__ = true;

  const HOST_ID = 'lovable-decrypter-launcher';
  const MODAL_ID = 'ld84-account-modal';

  function send(message) {
    return new Promise(resolve => {
      try {
        chrome.runtime.sendMessage(message, response => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false, code: 'ACCOUNT_RUNTIME_FAILED', message: chrome.runtime.lastError.message });
            return;
          }
          resolve(response || { ok: false, code: 'EMPTY_ACCOUNT_RESPONSE' });
        });
      } catch (error) {
        resolve({ ok: false, code: 'ACCOUNT_RUNTIME_FAILED', message: error?.message || String(error) });
      }
    });
  }

  function escapeText(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
  }

  function ensureUi(shadow) {
    let modal = shadow.getElementById(MODAL_ID);
    if (modal) return modal;

    const style = document.createElement('style');
    style.id = 'ld84-account-style';
    style.textContent = `
      :host([data-ld-license="locked"]) .badge{background:#ff637d!important;box-shadow:0 0 15px rgba(255,99,125,.75)!important}
      :host([data-ld-license="active"]) .badge{background:#43d88e!important;box-shadow:0 0 15px rgba(67,216,142,.8)!important}
      #${MODAL_ID}{position:fixed;inset:0;z-index:20;display:none;align-items:center;justify-content:center;padding:20px;background:rgba(4,8,18,.58);backdrop-filter:blur(10px);pointer-events:auto}
      #${MODAL_ID}.show{display:flex}
      .ld84-card{width:min(460px,calc(100vw - 32px));border:1px solid rgba(255,255,255,.09);border-radius:24px;background:linear-gradient(180deg,rgba(20,30,49,.99),rgba(12,20,35,.99));box-shadow:0 35px 100px rgba(0,0,0,.55);color:#f3f7ff;font-family:Arial,sans-serif;overflow:hidden}
      .ld84-head{display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid rgba(255,255,255,.06)}
      .ld84-head div{display:grid;gap:3px}.ld84-head small{font-size:9px;letter-spacing:.12em;color:#57d5ff;font-weight:800}.ld84-head b{font-size:16px}
      .ld84-close{width:34px;height:34px;border:0;border-radius:12px;background:rgba(255,255,255,.04);color:#aebbd2;cursor:pointer;font-size:19px}
      .ld84-body{padding:20px;display:grid;gap:14px}.ld84-copy{font-size:11px;line-height:1.55;color:#9eabc2}
      .ld84-field{display:grid;gap:7px}.ld84-field label{font-size:10px;color:#a8b6cc;font-weight:700}.ld84-field input{width:100%;height:44px;border-radius:13px;border:1px solid rgba(255,255,255,.1);background:rgba(5,11,23,.65);color:#fff;padding:0 13px;font:12px Arial,sans-serif;outline:none}.ld84-field input:focus{border-color:rgba(59,210,255,.55);box-shadow:0 0 0 3px rgba(59,210,255,.08)}
      .ld84-status{min-height:40px;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.025);font-size:10px;line-height:1.45;color:#99a8c1}.ld84-status.ok{border-color:rgba(67,216,142,.22);color:#8df1b5}.ld84-status.error{border-color:rgba(255,99,125,.25);color:#ff9daf}
      .ld84-actions{display:flex;gap:8px;justify-content:flex-end;padding:16px 20px;border-top:1px solid rgba(255,255,255,.06)}.ld84-actions button{min-height:38px;border-radius:11px;border:1px solid rgba(255,255,255,.08);padding:0 14px;background:rgba(255,255,255,.035);color:#d8e1f0;font:11px Arial,sans-serif;cursor:pointer}.ld84-actions .primary{border-color:rgba(59,210,255,.32);background:linear-gradient(180deg,rgba(59,210,255,.2),rgba(59,210,255,.08));color:#eafaff}.ld84-actions .danger{border-color:rgba(255,99,125,.22);color:#ff9daf}.ld84-actions button:disabled{opacity:.5;cursor:wait}
      .ld84-meta{display:grid;gap:7px}.ld84-meta-row{display:flex;justify-content:space-between;gap:20px;padding:9px 10px;border-radius:11px;background:rgba(255,255,255,.025);font-size:10px}.ld84-meta-row span{color:#8595ae}.ld84-meta-row b{font-weight:700;color:#dbe6f7;text-align:right}
    `;
    shadow.appendChild(style);

    modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.innerHTML = `
      <section class="ld84-card" role="dialog" aria-modal="true" aria-label="Conta e licença">
        <header class="ld84-head"><div><small>LOVABLE DECRYPTER · BUILD 84</small><b>Conta & Licença</b></div><button class="ld84-close" type="button" aria-label="Fechar">×</button></header>
        <main class="ld84-body"><div class="ld84-content"></div><div class="ld84-status">Carregando estado local…</div></main>
        <footer class="ld84-actions"></footer>
      </section>`;
    shadow.appendChild(modal);
    modal.querySelector('.ld84-close').addEventListener('click', () => modal.classList.remove('show'));
    modal.addEventListener('click', event => { if (event.target === modal) modal.classList.remove('show'); });
    return modal;
  }

  function setLicenseState(host, active) {
    host.dataset.ldLicense = active ? 'active' : 'locked';
  }

  function setStatus(modal, text, kind = '') {
    const status = modal.querySelector('.ld84-status');
    status.className = `ld84-status${kind ? ` ${kind}` : ''}`;
    status.textContent = text;
  }

  function renderLocked(modal) {
    modal.querySelector('.ld84-content').innerHTML = `
      <div class="ld84-copy">Ative o Decrypter com sua chave de licença. Este modal pertence à única UI da extensão e não bloqueia nem modifica o shell do Lovable.</div>
      <div class="ld84-field"><label for="ld84-license-key">Chave de licença</label><input id="ld84-license-key" type="password" autocomplete="off" spellcheck="false" placeholder="LD2.…"></div>`;
    const actions = modal.querySelector('.ld84-actions');
    actions.innerHTML = '<button type="button" data-ld84-close>Agora não</button><button type="button" class="primary" data-ld84-activate>Ativar</button>';
    actions.querySelector('[data-ld84-close]').addEventListener('click', () => modal.classList.remove('show'));
    actions.querySelector('[data-ld84-activate]').addEventListener('click', async event => {
      const button = event.currentTarget;
      const key = String(modal.querySelector('#ld84-license-key')?.value || '').trim();
      if (!key) { setStatus(modal, 'Informe a chave de licença.', 'error'); return; }
      button.disabled = true;
      setStatus(modal, 'Validando licença no backend…');
      const result = await send({ type: 'ld84.account.activate', licenseKey: key, deviceLabel: 'Chrome · Lovable Decrypter Build 84' });
      button.disabled = false;
      if (!result?.ok) { setStatus(modal, `${result?.code || 'ACTIVATION_FAILED'}${result?.message ? ` · ${result.message}` : ''}`, 'error'); return; }
      await renderState(modal, result.account);
      setStatus(modal, 'Licença ativa neste navegador.', 'ok');
    });
  }

  function renderActive(modal, account) {
    const license = account?.license || {};
    const entitlement = license?.entitlement || {};
    modal.querySelector('.ld84-content').innerHTML = `
      <div class="ld84-copy">Licença validada. Somente os recursos da extensão são controlados pela licença; o Lovable permanece independente e utilizável.</div>
      <div class="ld84-meta">
        <div class="ld84-meta-row"><span>Status</span><b>Ativa</b></div>
        <div class="ld84-meta-row"><span>Licença</span><b>${escapeText(license.label || license.id || 'Ativa')}</b></div>
        <div class="ld84-meta-row"><span>Plano</span><b>${escapeText(license.commercial_tier || license.access_mode || '—')}</b></div>
        <div class="ld84-meta-row"><span>Expiração</span><b>${escapeText(entitlement.expires_at || 'Créditos / sem data')}</b></div>
      </div>`;
    const actions = modal.querySelector('.ld84-actions');
    actions.innerHTML = '<button type="button" class="danger" data-ld84-clear>Desativar neste navegador</button><button type="button" class="primary" data-ld84-close>Concluir</button>';
    actions.querySelector('[data-ld84-close]').addEventListener('click', () => modal.classList.remove('show'));
    actions.querySelector('[data-ld84-clear]').addEventListener('click', async event => {
      event.currentTarget.disabled = true;
      const result = await send({ type: 'ld84.account.clear' });
      if (!result?.ok) { event.currentTarget.disabled = false; setStatus(modal, result?.code || 'ACCOUNT_CLEAR_FAILED', 'error'); return; }
      renderLocked(modal);
      setStatus(modal, 'Licença removida deste navegador. O Lovable continua funcionando normalmente.');
      const host = document.getElementById(HOST_ID); if (host) setLicenseState(host, false);
    });
  }

  async function renderState(modal, suppliedAccount = null) {
    const result = suppliedAccount ? { ok: true, account: suppliedAccount } : await send({ type: 'ld84.account.status' });
    const host = document.getElementById(HOST_ID);
    const active = Boolean(result?.ok && result?.account?.active);
    if (host) setLicenseState(host, active);
    if (active) renderActive(modal, result.account); else renderLocked(modal);
    return active;
  }

  async function open(force = false) {
    const host = document.getElementById(HOST_ID);
    const shadow = host?.shadowRoot;
    if (!shadow) return false;
    const modal = ensureUi(shadow);
    await renderState(modal);
    if (force || host.dataset.ldLicense !== 'active') modal.classList.add('show');
    return true;
  }

  window.addEventListener('ld84:module-action', event => {
    if (event?.detail?.module !== 'account') return;
    open(true).catch(() => {});
  });

  open(false).catch(() => {});
})();
