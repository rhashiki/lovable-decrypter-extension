import { DEFAULT_BACKEND_BASE } from '../settings/config.js';
import { getSettings } from '../storage/settings-store.js';

const PORT_NAME = 'ld2-database-runtime';
const ENDPOINT = 'ld-database-runtime';
const ACTIONS = new Set(['status', 'introspect', 'prepare', 'ticket', 'approve', 'run', 'verify']);
const DEFAULT_TIMEOUT_MS = 70000;
const WRITE_TIMEOUT_MS = 120000;

async function requestBackend(action, payload = {}) {
  if (!ACTIONS.has(action)) {
    const error = new Error('DATABASE_RUNTIME_ACTION_INVALID');
    error.code = 'DATABASE_RUNTIME_ACTION_INVALID';
    throw error;
  }

  const settings = await getSettings();
  const licenseKey = String(settings.auth?.licenseKey || '').trim();
  const deviceId = String(settings.auth?.deviceId || '').trim();
  if (!licenseKey) throw new Error('Faça login com sua KEY antes de acessar o banco.');
  if (!deviceId) throw new Error('Dispositivo não vinculado. Faça login novamente.');

  const base = String(settings.auth?.backendBase || DEFAULT_BACKEND_BASE).replace(/\/+$/, '');
  const controller = new AbortController();
  const timeoutMs = action === 'run' ? WRITE_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${base}/${ENDPOINT}`, {
      method: 'POST',
      signal: controller.signal,
      cache: 'no-store',
      redirect: 'error',
      headers: {
        'Content-Type': 'application/json',
        'x-license-key': licenseKey,
        'x-device-id': deviceId
      },
      body: JSON.stringify({ action, ...payload })
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.ok) {
      const code = body?.code || `HTTP_${response.status}`;
      const error = new Error(`Database Runtime: ${code}`);
      error.code = code;
      error.details = body || null;
      error.verificationRequired = body?.verification_required === true;
      throw error;
    }
    return body;
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeout = new Error(action === 'run'
        ? 'A execução do banco excedeu o tempo limite. O resultado é ambíguo: verifique o estado antes de qualquer nova tentativa.'
        : 'O Database Runtime não respondeu dentro do tempo limite.');
      timeout.code = action === 'run' ? 'DATABASE_WRITE_OUTCOME_AMBIGUOUS' : 'DATABASE_RUNTIME_TIMEOUT';
      timeout.verificationRequired = action === 'run';
      throw timeout;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function installDatabaseRuntime() {
  if (globalThis.__LD2_DATABASE_RUNTIME__) return;
  globalThis.__LD2_DATABASE_RUNTIME__ = true;

  chrome.runtime.onConnect.addListener(port => {
    if (port.name !== PORT_NAME) return;

    const handler = async message => {
      const id = String(message?.id || '');
      const action = String(message?.action || 'status');
      try {
        const data = await requestBackend(action, message?.payload || {});
        port.postMessage({ id, ok: true, data });
      } catch (error) {
        try {
          port.postMessage({
            id,
            ok: false,
            error: error?.message || String(error),
            code: error?.code || '',
            details: error?.details || null,
            verificationRequired: error?.verificationRequired === true
          });
        } catch (_) {}
      }
    };

    port.onMessage.addListener(handler);
  });
}
