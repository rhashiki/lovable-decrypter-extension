import { DEFAULT_BACKEND_BASE } from '../settings/config.js';
import { getSettings } from '../storage/settings-store.js';
import { listChangeTransactions, patchChangeTransaction } from '../core/change-transactions.js';

const PORT_NAME = 'ld2-database-runtime';
const ENDPOINT = 'ld-database-runtime';
const ACTIONS = new Set(['status', 'introspect', 'prepare', 'ticket', 'approve', 'run', 'verify']);
const DEFAULT_TIMEOUT_MS = 70000;
const WRITE_TIMEOUT_MS = 120000;

const text = (value, max = 180) => String(value ?? '').trim().slice(0, max);

async function reconcileChangeTransaction(action, payload = {}, body = null, error = null) {
  if (!['approve', 'run', 'verify'].includes(action)) return;
  const ticketId = text(body?.ticket?.id || body?.ticket_id || payload?.ticketId || payload?.ticket_id);
  if (!ticketId) return;
  try {
    const rows = await listChangeTransactions({ limit: 160 });
    const tx = rows.find(row => row?.database?.ticketId === ticketId);
    if (!tx?.id) return;
    if (error) {
      await patchChangeTransaction(tx.id, {
        status: error?.verificationRequired === true ? 'verification_required' : 'failed',
        database: {
          ticketId,
          status: error?.verificationRequired === true ? 'verification_required' : (tx.database?.status || 'prepared'),
          verificationRequired: error?.verificationRequired === true
        },
        lastError: { code: text(error?.code), message: String(error?.message || error || '').slice(0, 900) }
      });
      return;
    }
    const mappedStatus = action === 'approve' ? 'approved' : action === 'run' ? 'applied' : 'verified';
    await patchChangeTransaction(tx.id, {
      status: action === 'run' ? 'completed' : mappedStatus,
      database: {
        ticketId,
        sqlHash: body?.ticket?.sql_hash || body?.ticket?.sqlHash || tx.database?.sqlHash || '',
        risk: body?.ticket?.risk || tx.database?.risk || '',
        status: mappedStatus,
        projectRef: body?.ticket?.project_ref || body?.mappedProject?.projectRef || tx.database?.projectRef || '',
        projectName: body?.mappedProject?.projectName || tx.database?.projectName || '',
        verificationRequired: false
      }
    });
  } catch (_) {
    // Projection reconciliation must never alter Database Runtime success/failure semantics.
  }
}

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
      await reconcileChangeTransaction(action, payload, body, error);
      throw error;
    }
    await reconcileChangeTransaction(action, payload, body, null);
    return body;
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeout = new Error(action === 'run'
        ? 'A execução do banco excedeu o tempo limite. O resultado é ambíguo: verifique o estado antes de qualquer nova tentativa.'
        : 'O Database Runtime não respondeu dentro do tempo limite.');
      timeout.code = action === 'run' ? 'DATABASE_WRITE_OUTCOME_AMBIGUOUS' : 'DATABASE_RUNTIME_TIMEOUT';
      timeout.verificationRequired = action === 'run';
      await reconcileChangeTransaction(action, payload, null, timeout);
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
