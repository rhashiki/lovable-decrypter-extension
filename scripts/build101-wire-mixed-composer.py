from pathlib import Path


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 anchor, found {count}')
    return source.replace(old, new, 1)

# ---- Composer client ----
path = Path('content/canonical-command-composer-client.js')
source = path.read_text()

source = replace_once(source,
"""  function attachmentApi() {
    return window.LovableDecrypterCanonicalAttachmentsVoiceApi || null;
  }
""",
"""  function mixedOrchestration() {
    const api = window.LovableDecrypterCanonicalMixedOrchestrationApi;
    if (!api?.build || !api?.approveCode || !api?.approveDatabase || !api?.verifyDatabase || !api?.rehydrate) {
      const error = new Error('Mixed Code + Database Orchestration client não carregado.');
      error.code = 'MIXED_ORCHESTRATION_CLIENT_REQUIRED';
      throw error;
    }
    return api;
  }

  function attachmentApi() {
    return window.LovableDecrypterCanonicalAttachmentsVoiceApi || null;
  }
""", 'composer mixed getter')

source = replace_once(source,
"""    if (result?.changeTransactionId) {
      await changeTransactions().codeReview(result.changeTransactionId, diff).catch(() => null);
    }
    return diff;
""",
"""    if (result?.changeTransactionId) {
      await changeTransactions().codeReview(result.changeTransactionId, diff).catch(() => null);
      if (result?.mixed) {
        await changeTransactions().databaseResult(result.changeTransactionId, {
          ticket: result?.databaseProposal?.ticket || null,
          classification: result?.databaseProposal?.classification || null,
          project: result?.databaseProposal?.project || null,
          status: result?.databaseProposal?.ticket?.status || 'prepared'
        }, { status: 'waiting_mixed_code_approval' }).catch(() => null);
      }
    }
    return diff;
""", 'mixed preview parent status')

source = replace_once(source,
"""    if (containsDatabase(capabilityRoute)) {
      if (!databaseOnly(capabilityRoute)) {
        const error = new Error('Build 95 não executa CODE + DATABASE como se fossem uma transação atômica. Separe as mudanças ou use PLAN.');
        error.code = 'DATABASE_MIXED_TRANSACTION_NOT_AVAILABLE';
        error.capabilityRoute = capabilityRoute;
        throw error;
      }
      return databaseBuild(command, capabilityRoute);
    }
""",
"""    if (containsDatabase(capabilityRoute)) {
      if (!databaseOnly(capabilityRoute)) {
        return mixedOrchestration().build(command, capabilityRoute, options);
      }
      return databaseBuild(command, capabilityRoute);
    }
""", 'mixed build delegation')

source = replace_once(source,
"""  async function verifyDatabase(ticketId, options = {}) {
    const result = await database().verify(ticketId);
    if (options.changeTransactionId) {
      await changeTransactions().databaseResult(options.changeTransactionId, { ticketId, status: 'verified', verificationRequired: false }, { status: 'verified' }).catch(() => null);
    }
    return result;
  }

  window.LovableDecrypterCanonicalCommandComposerApi = Object.freeze({
""",
"""  async function verifyDatabase(ticketId, options = {}) {
    const result = await database().verify(ticketId);
    if (options.changeTransactionId) {
      await changeTransactions().databaseResult(options.changeTransactionId, { ticketId, status: 'verified', verificationRequired: false }, { status: 'verified' }).catch(() => null);
    }
    return result;
  }

  async function approveMixedCode(changeTransactionId, taskId, proposalDigest, options = {}) {
    return mixedOrchestration().approveCode(changeTransactionId, taskId, proposalDigest, options);
  }

  async function approveMixedDatabase(changeTransactionId, options = {}) {
    return mixedOrchestration().approveDatabase(changeTransactionId, options);
  }

  async function verifyMixedDatabase(changeTransactionId) {
    return mixedOrchestration().verifyDatabase(changeTransactionId);
  }

  async function rehydrateMixed(changeTransactionId, command) {
    return mixedOrchestration().rehydrate(changeTransactionId, command);
  }

  function dropMixed(changeTransactionId) {
    return mixedOrchestration().drop?.(changeTransactionId) || false;
  }

  window.LovableDecrypterCanonicalCommandComposerApi = Object.freeze({
""", 'mixed composer methods')

source = replace_once(source,
"""    approveWrite,
    approveDatabase,
    verifyDatabase,
    databaseIntrospect: () => database().introspect(),
""",
"""    approveWrite,
    approveDatabase,
    verifyDatabase,
    approveMixedCode,
    approveMixedDatabase,
    verifyMixedDatabase,
    rehydrateMixed,
    dropMixed,
    databaseIntrospect: () => database().introspect(),
""", 'mixed exports')

source = replace_once(source,
"""    databaseMixedAtomicExecution: false,
    databaseTicketedWrites: true,
""",
"""    databaseMixedAtomicExecution: false,
    mixedCodeDatabaseOrchestration: true,
    mixedOrchestrationBuild: 101,
    mixedSeparateAuthorizationBoundaries: true,
    mixedCodeAuthorization: 'human-only',
    mixedDatabaseAuthorization: 'human-only',
    mixedCodeMustCompleteBeforeDatabase: true,
    mixedRecoveryUsesGitTransaction: true,
    databaseTicketedWrites: true,
""", 'mixed capability flags')

path.write_text(source)

# ---- Canonical Composer UI ----
path = Path('launcher/canonical-command-composer.js')
source = path.read_text()

source = replace_once(source,
"""  const BUILD = 95;
  const VERSION = '2.6.95';
""",
"""  const BUILD = 101;
  const VERSION = '2.6.101';
""", 'composer UI version')

source = replace_once(source,
"""      waiting_approval: 'Write de código bloqueado. Revise o diff e aprove explicitamente para continuar.',
      waiting_database_approval: 'Write de banco bloqueado. Revise SQL, risco e projeto antes de aprovar.',
""",
"""      waiting_approval: 'Write de código bloqueado. Revise o diff e aprove explicitamente para continuar.',
      waiting_mixed_code_approval: 'MIXED · CODE 1º: revise e aprove a etapa de código. DATABASE permanece bloqueado.',
      waiting_database_approval: 'Write de banco bloqueado. Revise SQL, risco e projeto antes de aprovar.',
      waiting_mixed_database_approval: 'MIXED · DATABASE 2º: código concluído; agora revise e aprove o ticket do banco.',
      mixed_verification_review: 'MIXED · resultado do banco requer revisão de verificação. Nenhum SQL será repetido automaticamente.',
""", 'mixed phase labels')

source = replace_once(source,
"""    const section = el('section', 'ld92-section'); section.appendChild(el('div', 'ld92-title', 'Write aguardando aprovação'));
""",
"""    const section = el('section', 'ld92-section'); section.appendChild(el('div', 'ld92-title', state.result?.mixed ? 'MIXED · CODE 1º · aprovação' : 'Write aguardando aprovação'));
""", 'mixed code title')

source = replace_once(source,
"""    approve.disabled = state.busy || !ticket.id || (destructive && (!state.dbDestructiveConfirmed || state.dbRecoveryEvidence.trim().length < 8));
    actions.appendChild(approve);
    section.appendChild(actions);
    section.appendChild(el('div', 'ld92-note', 'O backend valida o hash deste SQL e consome o ticket antes do write. Timeout/erro ambíguo nunca dispara retry automático.'));
""",
"""    const mixedLocked = state.result?.mixed && proposal.lockedUntilCodeComplete === true;
    approve.disabled = state.busy || !ticket.id || mixedLocked || (destructive && (!state.dbDestructiveConfirmed || state.dbRecoveryEvidence.trim().length < 8));
    actions.appendChild(approve);
    section.appendChild(actions);
    if (mixedLocked) section.appendChild(el('div', 'ld92-note', 'MIXED: DATABASE 2º permanece bloqueado até CODE 1º concluir. Não existe atomicidade ACID entre GitHub e Supabase.'));
    section.appendChild(el('div', 'ld92-note', 'O backend valida o hash deste SQL e consome o ticket antes do write. Timeout/erro ambíguo nunca dispara retry automático.'));
""", 'mixed db lock')

source = replace_once(source,
"""  function renderDatabaseVerification(target) {
""",
"""  function renderMixedStatus(target) {
    const mixed = state.result?.mixed;
    if (!mixed) return;
    const section = el('section', 'ld92-section'); section.appendChild(el('div', 'ld92-title', 'MIXED · orchestration boundary'));
    const card = el('div', 'ld92-card');
    card.append(el('b', '', 'CODE 1º → DATABASE 2º'), el('small', '', 'Uma Change Transaction pai; autorizações independentes. Não é uma transação ACID entre GitHub e Supabase.'));
    const badges = el('div', 'ld92-badges');
    badges.append(
      el('span', `ld92-badge ${mixed.codeComplete ? 'ok' : 'warn'}`, mixed.codeComplete ? 'CODE COMPLETE' : 'CODE PENDING'),
      el('span', `ld92-badge ${mixed.databaseComplete ? 'ok' : 'warn'}`, mixed.databaseComplete ? 'DATABASE COMPLETE' : 'DATABASE LOCKED/GATED'),
      el('span', 'ld92-badge warn', 'HUMAN × 2'),
      el('span', 'ld92-badge', 'NO CROSS-PROVIDER ACID')
    );
    card.appendChild(badges); section.appendChild(card);
    section.appendChild(el('div', 'ld92-note', 'Se DATABASE falhar depois do commit de CODE, recovery usa o Git Transaction Revert da Build 99. Resultado ambíguo do banco exige Verify e nunca dispara retry automático.'));
    target.appendChild(section);
  }

  function renderDatabaseVerification(target) {
""", 'mixed status renderer')

source = replace_once(source,
"""    const pending = state.phase === 'waiting_approval' || state.phase === 'waiting_database_approval' || state.phase === 'database_ambiguous';
""",
"""    const pending = ['waiting_approval','waiting_mixed_code_approval','waiting_database_approval','waiting_mixed_database_approval','database_ambiguous','mixed_verification_review'].includes(state.phase);
""", 'mixed pending render')

source = replace_once(source,
"""    renderPlan(target); renderProposal(target); renderDatabaseProposal(target); renderDatabaseVerification(target); renderResult(target);
    target.appendChild(el('div', 'ld92-note', `Build ${BUILD} · CODE usa Agent/Tool Runtime; DATABASE usa ticket Plan → Review → Run. Sem paid/remote fallback e sem auto-approval.`));
""",
"""    renderPlan(target); renderMixedStatus(target); renderProposal(target); renderDatabaseProposal(target); renderDatabaseVerification(target); renderResult(target);
    target.appendChild(el('div', 'ld92-note', `Build ${BUILD} · CODE usa Agent/Tool Runtime; DATABASE usa ticket Plan → Review → Run. MIXED preserva duas autorizações humanas e recovery separado; não promete atomicidade entre provedores.`));
""", 'mixed render/note')

source = replace_once(source,
"""    if (result?.status === 'waiting_approval' && result?.proposal) {
      state.phase = 'previewing'; render();
      state.diff = await api().previewProposal(result);
      state.phase = 'waiting_approval';
    } else if (result?.status === 'waiting_database_approval' && result?.databaseProposal) {
      state.phase = 'waiting_database_approval';
    } else if (result?.status === 'completed') state.phase = 'completed';
""",
"""    if ((result?.status === 'waiting_approval' || result?.status === 'waiting_mixed_code_approval') && result?.proposal) {
      const mixedCode = result?.status === 'waiting_mixed_code_approval';
      state.phase = 'previewing'; render();
      state.diff = await api().previewProposal(result);
      state.phase = mixedCode ? 'waiting_mixed_code_approval' : 'waiting_approval';
    } else if (result?.status === 'waiting_database_approval' && result?.databaseProposal) {
      state.phase = 'waiting_database_approval';
    } else if (result?.status === 'waiting_mixed_database_approval' && result?.databaseProposal) {
      state.phase = 'waiting_mixed_database_approval';
    } else if (result?.status === 'mixed_verification_review') {
      state.phase = 'mixed_verification_review';
    } else if (result?.status === 'completed') state.phase = 'completed';
""", 'mixed process result')

source = replace_once(source,
"""    try {
      await processBuildResult(await api().approveWrite(state.taskId, state.result.proposal.digest, { humanDecision: true }));
""",
"""    try {
      const next = state.result?.mixed
        ? await api().approveMixedCode(state.result.changeTransactionId, state.taskId, state.result.proposal.digest, { humanDecision: true })
        : await api().approveWrite(state.taskId, state.result.proposal.digest, { humanDecision: true });
      await processBuildResult(next);
""", 'mixed code approval')

source = replace_once(source,
"""      const execution = await api().approveDatabase(ticket.id, proposal.sql, {
        humanDecision: true,
        destructiveConfirmation: destructive && state.dbDestructiveConfirmed,
        recoveryEvidence: state.dbRecoveryEvidence
      });
      state.result = { ...state.result, status: 'completed', databaseExecution: execution };
      state.phase = 'completed';
""",
"""      if (state.result?.mixed) {
        const execution = await api().approveMixedDatabase(state.result.changeTransactionId, {
          humanDecision: true,
          destructiveConfirmation: destructive && state.dbDestructiveConfirmed,
          recoveryEvidence: state.dbRecoveryEvidence
        });
        await processBuildResult(execution);
      } else {
        const execution = await api().approveDatabase(ticket.id, proposal.sql, {
          humanDecision: true,
          destructiveConfirmation: destructive && state.dbDestructiveConfirmed,
          recoveryEvidence: state.dbRecoveryEvidence
        });
        state.result = { ...state.result, status: 'completed', databaseExecution: execution };
        state.phase = 'completed';
      }
""", 'mixed db approval')

source = replace_once(source,
"""      state.dbVerification = await api().verifyDatabase(ticketId);
      state.phase = 'database_verified';
""",
"""      if (state.result?.mixed) {
        const verified = await api().verifyMixedDatabase(state.result.changeTransactionId);
        state.dbVerification = verified?.verification || verified;
        state.phase = 'mixed_verification_review';
      } else {
        state.dbVerification = await api().verifyDatabase(ticketId);
        state.phase = 'database_verified';
      }
""", 'mixed db verify')

source = replace_once(source,
"""  function reset() {
    if (state.busy) return;
    Object.assign(state, { command:'', phase:'idle', result:null, diff:null, error:'', taskId:'', dbRecoveryEvidence:'', dbDestructiveConfirmed:false, dbVerification:null }); render();
  }
""",
"""  function reset() {
    if (state.busy) return;
    const mixedId = state.result?.mixed ? state.result?.changeTransactionId : '';
    if (mixedId) { try { api()?.dropMixed?.(mixedId); } catch (_) {} }
    Object.assign(state, { command:'', phase:'idle', result:null, diff:null, error:'', taskId:'', dbRecoveryEvidence:'', dbDestructiveConfirmed:false, dbVerification:null }); render();
  }
""", 'mixed reset')

source = replace_once(source,
"""        const pending = state.phase === 'waiting_approval' || state.phase === 'waiting_database_approval' || state.phase === 'database_ambiguous';
""",
"""        const pending = ['waiting_approval','waiting_mixed_code_approval','waiting_database_approval','waiting_mixed_database_approval','database_ambiguous','mixed_verification_review'].includes(state.phase);
""", 'mixed pending click')

path.write_text(source)
