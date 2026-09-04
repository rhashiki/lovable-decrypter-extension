(() => {
  'use strict';

  if (window.__LD93_CANONICAL_ATTACHMENTS_VOICE__) return;
  window.__LD93_CANONICAL_ATTACHMENTS_VOICE__ = true;

  const BUILD = 93;
  const VERSION = '2.6.93';
  const HOST_ID = 'lovable-decrypter-launcher';
  const MODULE_ID = 'command-composer';
  let tray = null;
  let fileInput = null;
  let messageNode = null;
  let listening = false;
  let recognition = null;

  const root = () => document.getElementById(HOST_ID)?.shadowRoot || null;
  const detail = () => root()?.getElementById('detail') || null;
  const api = () => window.LovableDecrypterCanonicalAttachmentsVoiceApi || null;
  const el = (tag, className = '', text = '') => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== '') node.textContent = String(text);
    return node;
  };

  function ensureStyles() {
    const shadow = root();
    if (!shadow || shadow.querySelector('style[data-ld93-attachments-voice]')) return;
    const style = document.createElement('style');
    style.dataset.ld93AttachmentsVoice = 'true';
    style.textContent = `
      #ld93-tray{pointer-events:auto;position:fixed;z-index:20;width:340px;max-width:calc(100vw - 16px);padding:8px 9px;border:1px solid rgba(59,210,255,.15);border-radius:12px;background:linear-gradient(180deg,rgba(10,19,34,.985),rgba(7,14,26,.99));box-shadow:0 18px 42px rgba(0,0,0,.35);color:#dce9f7;font-family:Arial,sans-serif;display:none}
      #ld93-tray.show{display:block}
      #ld93-tray .ld93-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
      #ld93-tray .ld93-btn{min-height:30px;border:1px solid rgba(59,210,255,.2);border-radius:9px;background:rgba(59,210,255,.08);color:#e9f8ff;padding:5px 9px;font:800 8.7px Arial,sans-serif;cursor:pointer}
      #ld93-tray .ld93-btn.secondary{background:rgba(255,255,255,.02);border-color:rgba(255,255,255,.08);color:#c8d4e3}
      #ld93-tray .ld93-btn.listening{border-color:rgba(255,187,83,.35);background:rgba(255,187,83,.09);color:#ffd286}
      #ld93-tray .ld93-btn:disabled{opacity:.42;cursor:not-allowed}
      #ld93-tray .ld93-summary{margin-left:auto;color:#8392a8;font-size:8.2px;font-weight:700}
      #ld93-tray .ld93-list{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px;max-height:65px;overflow:auto}
      #ld93-tray .ld93-chip{display:flex;align-items:center;gap:5px;max-width:100%;padding:4px 6px;border:1px solid rgba(255,255,255,.06);border-radius:8px;background:rgba(255,255,255,.018);color:#aebdd0;font-size:8px}
      #ld93-tray .ld93-chip b{max-width:190px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#dbe7f4;font-size:8px}
      #ld93-tray .ld93-remove{border:0;background:transparent;color:#ff9fac;font-size:10px;cursor:pointer;padding:0 2px}
      #ld93-tray .ld93-message{margin-top:6px;color:#7f8da3;font-size:7.9px;line-height:1.35}
      #ld93-tray .ld93-message.error{color:#ffabb6}
    `;
    shadow.appendChild(style);
  }

  function formatBytes(value) {
    const n = Number(value || 0);
    if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
    if (n >= 1024) return `${Math.round(n / 1024)} KB`;
    return `${n} B`;
  }

  function positionTray() {
    if (!tray?.classList.contains('show')) return;
    const target = detail();
    if (!target || target.dataset.module !== MODULE_ID) return hideTray();
    const rect = target.getBoundingClientRect();
    const width = Math.min(340, Math.max(260, rect.width || 340));
    tray.style.width = `${width}px`;
    tray.style.left = `${Math.max(8, Math.min(innerWidth - width - 8, rect.left))}px`;
    tray.style.top = `${Math.max(8, Math.min(innerHeight - 128, rect.bottom - 112))}px`;
  }

  function setMessage(text = '', error = false) {
    if (!messageNode) return;
    messageNode.textContent = text;
    messageNode.classList.toggle('error', Boolean(error));
  }

  function renderTray() {
    if (!tray) return;
    const center = api();
    const snap = center?.snapshot?.() || { count:0,totalBytes:0,attachments:[] };
    const list = tray.querySelector('.ld93-list');
    const summary = tray.querySelector('.ld93-summary');
    const voice = tray.querySelector('[data-ld93-action="voice"]');
    if (summary) summary.textContent = `${snap.count || 0}/8 · ${formatBytes(snap.totalBytes || 0)}`;
    if (voice) {
      voice.disabled = !center?.voiceSupported?.();
      voice.classList.toggle('listening', listening);
      voice.textContent = listening ? 'Parar ditado' : (voice.disabled ? 'Ditado indisponível' : 'Ditado');
    }
    if (list) {
      list.replaceChildren();
      for (const item of snap.attachments || []) {
        const chip = el('span', 'ld93-chip');
        chip.append(el('span', '', item.kind.toUpperCase()), el('b', '', item.name), el('span', '', formatBytes(item.size)));
        const remove = el('button', 'ld93-remove', '×'); remove.type = 'button'; remove.title = 'Remover anexo'; remove.dataset.ld93Remove = item.id; chip.appendChild(remove);
        list.appendChild(chip);
      }
    }
    positionTray();
  }

  function createTray() {
    const shadow = root();
    if (!shadow) return false;
    ensureStyles();
    tray = shadow.getElementById('ld93-tray');
    if (tray) return true;

    tray = el('div'); tray.id = 'ld93-tray'; tray.dataset.build = String(BUILD);
    const row = el('div', 'ld93-row');
    const attach = el('button', 'ld93-btn', 'Anexar'); attach.type = 'button'; attach.dataset.ld93Action = 'attach'; row.appendChild(attach);
    const voice = el('button', 'ld93-btn secondary', 'Ditado'); voice.type = 'button'; voice.dataset.ld93Action = 'voice'; row.appendChild(voice);
    row.appendChild(el('span', 'ld93-summary', '0/8 · 0 B'));
    tray.appendChild(row);

    fileInput = document.createElement('input');
    fileInput.type = 'file'; fileInput.multiple = true; fileInput.hidden = true;
    fileInput.accept = '.txt,.md,.csv,.json,.js,.mjs,.cjs,.ts,.tsx,.jsx,.css,.html,.xml,.yaml,.yml,.toml,.sql,.py,.rb,.go,.rs,.java,.kt,.swift,.php,.sh,.pdf,.doc,.docx,.odt,.png,.jpg,.jpeg,.webp,.gif,.mp3,.wav,.ogg,.oga,.m4a,.aac,.flac,.webm,text/*,image/png,image/jpeg,image/webp,image/gif,audio/*,application/pdf';
    tray.appendChild(fileInput);
    tray.appendChild(el('div', 'ld93-list'));
    messageNode = el('div', 'ld93-message', 'Texto é incorporado localmente. Imagem/PDF/áudio ficam como referência até existir runtime com capacidade compatível. Nada aqui aprova ou executa writes.');
    tray.appendChild(messageNode);
    shadow.appendChild(tray);

    attach.addEventListener('click', () => fileInput?.click());
    fileInput.addEventListener('change', async () => {
      try {
        setMessage('Validando anexos localmente…');
        await api()?.addFiles?.(fileInput.files || []);
        setMessage('Anexos preparados localmente. Nenhum upload remoto foi realizado.');
      } catch (error) {
        setMessage(`${error?.code || 'ATTACHMENT_ERROR'} · ${error?.message || error}`, true);
      } finally {
        fileInput.value = '';
        renderTray();
      }
    });

    tray.addEventListener('click', event => {
      const remove = event.target.closest?.('[data-ld93-remove]');
      if (!remove) return;
      api()?.remove?.(remove.dataset.ld93Remove || '');
      renderTray();
    });

    voice.addEventListener('click', () => toggleDictation());
    renderTray();
    return true;
  }

  function currentTextarea() {
    const target = detail();
    return target?.dataset.module === MODULE_ID ? target.querySelector('[data-ld92-input]') : null;
  }

  function appendTranscript(value = '') {
    const input = currentTextarea();
    const transcript = String(value || '').trim();
    if (!input || !transcript) return;
    const before = String(input.value || '');
    input.value = `${before}${before.trim() ? ' ' : ''}${transcript}`;
    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  }

  function stopRecognition() {
    try { recognition?.stop?.(); } catch (_) {}
  }

  function toggleDictation() {
    const center = api();
    if (!center?.voiceSupported?.()) return setMessage('Reconhecimento de voz não está disponível neste navegador.', true);
    if (listening) return stopRecognition();
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return;
    recognition = new Recognition();
    recognition.lang = document.documentElement.lang || 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => { listening = true; setMessage('Ouvindo. O áudio serve somente para preencher o texto do comando.'); renderTray(); };
    recognition.onresult = event => {
      const transcript = Array.from(event.results || []).map(result => result?.[0]?.transcript || '').join(' ').trim();
      appendTranscript(transcript);
    };
    recognition.onerror = event => setMessage(`VOICE_${String(event?.error || 'ERROR').toUpperCase()} · não foi executado nenhum comando.`, true);
    recognition.onend = () => { listening = false; recognition = null; renderTray(); };
    try { recognition.start(); }
    catch (error) { listening = false; recognition = null; setMessage(error?.message || 'Falha ao iniciar ditado.', true); renderTray(); }
  }

  function showTray() {
    if (!createTray()) return;
    tray.classList.add('show');
    renderTray();
  }

  function hideTray() {
    if (!tray) return;
    tray.classList.remove('show');
    if (listening) stopRecognition();
  }

  function pathNode(event, predicate) {
    return (event.composedPath?.() || []).find(node => node instanceof Element && predicate(node)) || null;
  }

  document.addEventListener('click', event => {
    const composerRail = pathNode(event, node => node.matches?.('.rail-btn[data-id="command-composer"]'));
    if (composerRail) { setTimeout(showTray, 0); return; }

    const otherRail = pathNode(event, node => node.matches?.('.rail-btn') && node.dataset.id !== MODULE_ID);
    if (otherRail) { hideTray(); return; }

    const reset = pathNode(event, node => node.dataset?.ld92Action === 'reset');
    if (reset) {
      api()?.clear?.();
      setTimeout(() => { showTray(); renderTray(); }, 0);
    }
  }, true);

  window.addEventListener('resize', positionTray, { passive: true });

  window.LovableDecrypterCanonicalAttachmentsVoice = Object.freeze({
    build: BUILD,
    version: VERSION,
    handles: moduleId => moduleId === MODULE_ID,
    show: showTray,
    hide: hideTray,
    writeAuthority: false,
    automaticExecution: false
  });
})();