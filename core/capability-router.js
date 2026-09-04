export const CAPABILITY_ROUTER_SCHEMA = 'ld-capability-router/1';
export const CAPABILITIES = Object.freeze(['CODE','DATABASE','GIT','CONTEXT','TEST','RUNTIME','DEPLOY']);

const DEFINITIONS = Object.freeze({
  CODE: Object.freeze({
    label: 'Código',
    explicit: /\b(c[oó]digo|arquivo|componente|react|tsx|jsx|typescript|javascript|css|html|frontend|backend|api|endpoint|fun[cç][aã]o|classe|m[oó]dulo|rota|route|p[aá]gina|tela|modal|bot[aã]o|formul[aá]rio|layout|ui|ux|hook|service|controller)\b/i,
    implied: /\b(cria(?:r|e)|adiciona(?:r|e)|altera(?:r|e)|edita(?:r|e)|corrig(?:ir|e)|refatora(?:r|e)|implementa(?:r|e)|muda(?:r|e))\b/i
  }),
  DATABASE: Object.freeze({
    label: 'Banco de dados',
    explicit: /\b(banco(?: de dados)?|database|supabase|sql|tabela|table|coluna|column|schema|migration|migra[cç][aã]o|rls|row level security|postgres|query|consulta sql|registro(?:s)?|foreign key|primary key|index|[ií]ndice)\b/i,
    implied: /\b(cadastro|cadastrar|salvar|persistir|persist[eê]ncia|armazenar|dados do usu[aá]rio|clientes?|pedidos?)\b/i
  }),
  GIT: Object.freeze({
    label: 'Git',
    explicit: /\b(git|github|commit|branch|checkout|merge|pull request|\bpr\b|rebase|revert|tag|diff do git|hist[oó]rico de commits?)\b/i,
    implied: /\b(versionar|vers[aã]o do reposit[oó]rio|comparar branches?)\b/i
  }),
  CONTEXT: Object.freeze({
    label: 'Contexto',
    explicit: /\b(contexto|context pack|analisa(?:r|e)|entenda|entender|explica(?:r|e)|arquitetura|depend[eê]ncia|mapa do projeto|onde fica|localiza(?:r|e)|investiga(?:r|e)|audita(?:r|e)|revis[aã]o de c[oó]digo)\b/i,
    implied: /\b(como funciona|por que|qual arquivo|quais arquivos|impacto|rela[cç][aã]o entre)\b/i
  }),
  TEST: Object.freeze({
    label: 'Testes',
    explicit: /\b(teste(?:s)?|test|unit[aá]rio|unit test|integra[cç][aã]o|e2e|playwright|vitest|jest|coverage|cobertura|smoke test|regress[aã]o)\b/i,
    implied: /\b(valida(?:r|e)|verifica(?:r|e) se funciona|garanta que funciona)\b/i
  }),
  RUNTIME: Object.freeze({
    label: 'Runtime',
    explicit: /\b(runtime|servidor local|localhost|ollama|vllm|node runtime|npm run|pnpm|yarn|processo|porta \d+|console|terminal|shell|dev server|servidor de desenvolvimento|crash|travando ao executar)\b/i,
    implied: /\b(rodar local|executar local|iniciar servidor|subir servidor)\b/i
  }),
  DEPLOY: Object.freeze({
    label: 'Deploy',
    explicit: /\b(deploy|publicar|publica[cç][aã]o|produ[cç][aã]o|production|vercel|netlify|cloudflare pages|github pages|lovable publish|dom[ií]nio|hosting|hospedagem|release para produ[cç][aã]o)\b/i,
    implied: /\b(colocar no ar|ir para produ[cç][aã]o|site ao vivo)\b/i
  })
});

const WRITE_HINT = /\b(cria(?:r|e)|adiciona(?:r|e)|altera(?:r|e)|edita(?:r|e)|corrig(?:ir|e)|refatora(?:r|e)|remove(?:r|a)|exclu(?:ir|a)|deleta(?:r|e)|commit|merge|deploy|publicar|migration|migra[cç][aã]o)\b/i;
const text = (value, max = 60000) => String(value ?? '').trim().slice(0, max);

function firstEvidence(source, rx) {
  const match = source.match(rx);
  return match?.[0] ? text(match[0], 160) : '';
}

function publicCapability(id, status, evidence = '', reason = '') {
  return Object.freeze({
    id,
    label: DEFINITIONS[id].label,
    status,
    evidence: evidence || null,
    reason: reason || null,
    executableWithoutConfirmation: false,
    expandsIntent: false
  });
}

function attachmentSignals(attachments = []) {
  const rows = Array.isArray(attachments) ? attachments : [];
  if (!rows.length) return [];
  return rows.map(item => ({
    kind: text(item?.kind, 40).toLowerCase(),
    name: text(item?.name, 240),
    mimeType: text(item?.mimeType, 160)
  })).slice(0, 8);
}

function orderedPlan(required = []) {
  const set = new Set(required);
  const order = ['CONTEXT','DATABASE','CODE','TEST','RUNTIME','GIT','DEPLOY'];
  return order.filter(id => set.has(id)).map((id, index) => Object.freeze({
    index: index + 1,
    capability: id,
    label: DEFINITIONS[id].label,
    authority: id === 'CONTEXT' || id === 'TEST' ? 'read-or-gated-tooling' : 'capability-specific-gates-required',
    autoExecute: false,
    scopeSource: 'user-request-only'
  }));
}

export function routeIntentCapabilities(command = '', options = {}) {
  const request = text(command);
  const attachments = attachmentSignals(options?.attachments);
  const required = [];
  const candidates = [];
  const details = [];

  for (const id of CAPABILITIES) {
    const def = DEFINITIONS[id];
    const explicitEvidence = firstEvidence(request, def.explicit);
    const impliedEvidence = explicitEvidence ? '' : firstEvidence(request, def.implied);
    if (explicitEvidence) {
      required.push(id);
      details.push(publicCapability(id, 'required', explicitEvidence, 'Capacidade explicitamente indicada pelo pedido.'));
    } else if (impliedEvidence) {
      candidates.push(id);
      details.push(publicCapability(id, 'candidate', impliedEvidence, 'Sinal implícito; exige confirmação antes de entrar no escopo efetivo.'));
    } else {
      details.push(publicCapability(id, 'not-requested'));
    }
  }

  if (attachments.length && !required.includes('CONTEXT')) {
    const index = details.findIndex(item => item.id === 'CONTEXT');
    const promoted = publicCapability('CONTEXT', 'required', 'user attachment', 'Anexo fornecido explicitamente pelo usuário é contexto do pedido atual.');
    if (index >= 0) details[index] = promoted;
    if (!required.includes('CONTEXT')) required.push('CONTEXT');
    const candidateIndex = candidates.indexOf('CONTEXT');
    if (candidateIndex >= 0) candidates.splice(candidateIndex, 1);
  }

  const uniqueRequired = [...new Set(required)];
  const uniqueCandidates = [...new Set(candidates.filter(id => !uniqueRequired.includes(id)))];
  const activeCount = uniqueRequired.length;
  const route = activeCount > 1 ? 'MIXED' : activeCount === 1 ? uniqueRequired[0] : 'UNRESOLVED';
  const writeRequested = WRITE_HINT.test(request);
  const plan = orderedPlan(uniqueRequired);

  return Object.freeze({
    schema: CAPABILITY_ROUTER_SCHEMA,
    route,
    resolved: route !== 'UNRESOLVED',
    mixed: route === 'MIXED',
    requiredCapabilities: Object.freeze(uniqueRequired),
    candidateCapabilities: Object.freeze(uniqueCandidates),
    capabilities: Object.freeze(details),
    capabilityPlan: Object.freeze(plan),
    writeRequested,
    attachmentSignals: Object.freeze(attachments),
    scopeExpansionAllowed: false,
    candidateRequiresConfirmation: true,
    automaticExecutionAllowed: false,
    automaticApprovalAllowed: false,
    routerAuthority: 'classification-only',
    notes: Object.freeze([
      'Somente sinais explícitos entram no escopo efetivo.',
      'Sinais implícitos são candidatos e nunca são autoativados.',
      'O roteador não executa ferramentas nem substitui Approval, Scope Intelligence, Human Intent ou Continuity.'
    ])
  });
}

export function assertCapabilitySubset(report = {}, allowed = []) {
  const allow = new Set((Array.isArray(allowed) ? allowed : []).map(value => String(value || '').toUpperCase()));
  const required = Array.isArray(report?.requiredCapabilities) ? report.requiredCapabilities : [];
  const rejected = required.filter(id => !allow.has(id));
  if (rejected.length) {
    const error = new Error(`CAPABILITY_EXECUTION_NOT_AVAILABLE:${rejected.join(',')}`);
    error.code = 'CAPABILITY_EXECUTION_NOT_AVAILABLE';
    error.capabilities = rejected;
    throw error;
  }
  return report;
}
