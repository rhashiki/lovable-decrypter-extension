# Lovable Decrypter v2.6 — Canonical Local-First AI Roadmap

Canonical rebaseline: 2026-09-04.

Current engineering baseline: **Build 92 — Canonical Command Composer**. Builds 60→75 remain the preserved modern engine foundation; Builds 76→82 were the stabilization/diagnostic/canonical-UI sequence; Builds 83→92 have now reattached the preserved modern engines to the single canonical launcher with dedicated CI gates. Build 93 is the current implementation target.

> Historical note: the repository did not contain a previously canonicalized Build 83→116 roadmap. This document established that remaining sequence on 2026-09-04 from the verified Build 82 state; no number below is retroactively claimed as an older committed roadmap.

## Product invariants

1. **One visual authority.** `launcher/launcher-runtime.js` is the only extension-owned launcher/UI authority. Legacy `ui/`, diagnostic shells, fallback mounts and guardians must never return.
2. **Local-first AI.** No paid GPU server is required; local inference remains the default path.
3. **No commercial-token dependency.** Remote AI providers remain explicit opt-in only; no automatic paid fallback.
4. **Continuity is outside model reasoning.** Tasks, leases, checkpoints and recovery survive model/runtime interruption.
5. **Human edits outrank AI edits.** `USER_EDIT > AI_EDIT`; Scope Intelligence and Human Intent are authoritative.
6. **Writes fail closed.** Approval, Tool Runtime, Continuity, Account Integration Gate and Guarded Commit remain mandatory for mutation.
7. **Least privilege.** GitHub App + authorized repository and Supabase OAuth + authorized project are required for remote mutation.
8. **External agents are proposal-only.** They never become authoritative writers.
9. **Credentials are not durable project state.** Provider/runtime credentials remain server-side or session-only according to the existing Vault/security model.
10. **No feature may restore legacy visual files merely to satisfy an old test.** CI must be reconciled to the canonical architecture instead.
11. **Security and production claims require executable adversarial CI plus browser/provider homologation.**
12. **No build below authorizes merge to `main`, OTA metadata, GitHub Release, Chrome Store publication or production rollout.** Those require separate explicit authorization.

## Implemented modern foundation

### Build 60 — Local Model Runtime ✅
Ollama/vLLM + local model routing, health/pool contract and zero paid/remote fallback by default.

### Build 61 — Tool Runtime / Coding Tools ✅
Provider-neutral repository/file tools, patch engine, grep/glob, Git diff, diagnostics and Operation Journal.

### Build 62 — MCP Core + Trust Gateway ✅
MCP authentication, allowlists, Scope Lock, explicit write approval and Operation Journal integration.

### Build 63 — Curated MCP Marketplace ✅
Controlled MCP catalog with provenance, permissions, trust/write capabilities and revocation state.

### Build 64 — Context Engine v2 ✅
Budgeted Context Packs from code, Git history, schemas/signals, Rules, Skills, Impact Maps, docs, diagnostics and manual edits.

### Build 65 — Scope Intelligence v2 + Human Intent ✅
Request → plan → diff checks, unauthorized-file/action detection, broad rewrite detection and user-edit protection.

### Build 66 — Smart Undo/Redo + Reversible Operations ✅
Three-way preservation of later user edits, symmetric Redo and explicit destructive modes.

### Build 67 — Continuity Engine ✅
Durable tasks/steps with leases, idempotency keys and checkpoints; ambiguous writes require verification before retry.

### Build 68 — Local Agent Orchestrator + Model Router ✅
Local coding loop with model degradation, proposal digest, approval, Scope Intelligence, Tool Runtime, Continuity, diff and diagnostics/repair.

### Build 69 — DecrypterBench v2 / Hardening ✅
Adversarial gates for path safety, stale/ambiguous patches, scope creep, Human Intent, Undo/Redo, proposal tampering, MCP trust and Continuity.

### Build 70 — Account Integration Gate ✅
GitHub App + Supabase OAuth readiness, project mappings, remote-write revalidation and callback bridge.

### Build 71 — Universal Agent Runtime Registry ✅
Proposal-only runtime registry for local/external agents with bounded transports, session-only credentials and watchdogs.

### Build 72 — Portable Skills v2 ✅
Portable local-first `SKILL.md` packages with provenance/hash, bounded imports and immutable per-run staging.

### Build 73 — Agent Sandbox / Shadow Worktree ✅
Sandbox identity, sensitive-path protection, bounded imported diffs and fresh Scope/Human-Intent validation before write.

### Build 74 — Multi-Agent Runtime + Native Sessions ✅
Runtime/session continuity, proposal generation binding, runtime switching invalidation and replay protection.

### Build 75 — Universal Agent Bench / External-Agent Hardening ✅
Final automated adversarial bench for the Build 65→74 authority model; external agents remain non-authoritative.

## Stabilization and canonical-UI sequence

### Build 76 — Lovable Load Stability Hotfix ✅
Reduced page-load instability while preserving the then-current functional stack.

### Build 77 — Emergency Safe Mode ✅
Introduced emergency isolation to stop extension-owned layers from destabilizing Lovable.

### Build 78 — Emergency Kill Switch ✅
Added hard shutdown/isolation capability for extension-owned execution during diagnosis.

### Build 79 — Diagnostic Minimal Runtime ✅
Reduced the active surface to establish the minimum stable runtime.

### Build 80 — Diagnostic FAB Injection ✅
Validated isolated launcher/FAB injection independent of the legacy UI stack.

### Build 81 — Diagnostic UI Shell ✅
Validated the replacement visual shell before permanent structural purge.

### Build 82 — Canonical Launcher / Legacy UI Purge ✅
Established `launcher/launcher-runtime.js` as the single visual authority and physically removed legacy visual layers, diagnostic shells, fallback mounts and guardians from the active package. Builds 60→75 engines were deliberately kept source-only for controlled future reattachment.

---

# Canonical functional reattachment

## Phase A — Make the canonical product functional

### Build 83 — Canonical Runtime Wiring + CI Reconciliation ✅
- Re-enabled `background/service-worker-entry.js` without restoring legacy UI.
- Re-enabled only non-visual modern clients required by the canonical launcher.
- Added canonical runtime bridge and Build83 CI contract.

### Build 84 — Canonical Integrations Center ✅
- GitHub App, Supabase OAuth, Lovable mappings and Gemini readiness are wired into the canonical launcher.
- Connect/disconnect/map/test flows use existing secure runtimes; no PAT regression.
- Event-driven integration UX; old integration overlay/polling remains absent.

### Build 85 — Canonical Project State ✅
- On-demand canonical snapshot for Lovable identity, GitHub repository/branch/HEAD and Supabase mapping/inspection.
- Secrets are sanitized before UI exposure.
- Old 30-second project polling remains inactive.

### Build 86 — Canonical Tool Runtime ✅
- Real Tool Runtime registry and Operation Journal visible in canonical UI.
- Safe real read smoke test via `repo.list_files`.
- Direct canonical writes are blocked; validated transaction + Scope/Continuity remains mandatory.

### Build 87 — Canonical Context + Scope ✅
- Context Engine v2 and Scope Intelligence v2 exposed as one understandable surface.
- Real Context Pack generation, selected file paths, context sources and Human Intent Locks.
- Visual preflight is explicitly distinct from formal request→plan→diff validation before write.

### Build 88 — Canonical MCP Center ✅
- MCP Runtime, Trust Gateway and curated Marketplace exposed through the canonical launcher.
- Provenance, publisher/domain, trust, host permission, tool discovery and local policy are visible.
- Unknown tools default deny; canonical enablement is READ-only; MCP writes retain exact-call one-time human approval.

### Build 89 — Canonical Agent Center ✅
- Local Agent Orchestrator, Runtime Registry, Portable Skills, Sandbox and Native Sessions are exposed through one canonical control surface.
- External runtimes remain proposal-only and credentials remain session-only.
- Agent Center is management/observability only; it cannot execute or approve commands.

### Build 90 — Canonical Continuity + Recovery ✅
- Continuity tasks, checkpoints and Smart Undo/Redo are unified under the canonical launcher.
- Recovery Doctor behavior is reconstructed canonically from Continuity + Operation Journal + checkpoints instead of restoring legacy UI.
- Ambiguous writes require verification before resume/retry; Smart Undo/Redo is Preview → explicit confirmation with `preserve` default and no exposed cascade path.

### Build 91 — Canonical Activity + Audit ✅
- Operation Journal, approval history, Continuity events, commits/reversals and Local Agent run metadata are normalized into one chronological read-only timeline.
- Raw prompts, raw model output, raw file contents and credentials are omitted from the audit surface.
- Legacy Activity UI and polling remain absent.

### Build 92 — Canonical Command Composer ✅
- One canonical command surface now provides PLAN and BUILD modes without reviving legacy chat.
- PLAN uses the Local Agent in no-write mode.
- BUILD allows automatic READ tools but stops at `waiting_approval` before every write proposal.
- Each write receives a read-only stale-aware diff preview and requires explicit `taskId + proposalDigest + humanDecision` approval.
- No `LD2_BUILD_EXECUTE`, `LD2_PLAN_APPLY`, direct Tool Runtime write or automatic approval path is exposed.

### Build 93 — Attachments + Voice Input 🚧 CURRENT
- Attach images/documents/audio to commands using existing backend limits and validation.
- Add browser-safe voice dictation as an input convenience, never as autonomous execution authority.

## Phase B — Shark Git learnings generalized for Lovable Decrypter

### Build 94 — Intent & Capability Router
- Classify each request into CODE, DATABASE, GIT, CONTEXT, TEST, RUNTIME, DEPLOY or MIXED capabilities.
- Generate an explainable capability plan before execution.
- Never let routing expand user intent.

### Build 95 — Safe Database Plan → Review → Run
- Add provider-neutral database planning with Supabase first.
- Introspect schema, generate proposed SQL/migrations and classify SAFE / CAUTION / DESTRUCTIVE.
- Destructive operations always require explicit approval and recovery/backup evidence where available.

### Build 96 — Project Understanding / Context Map
- Turn Context Engine + Project State Graph into a visual, user-readable map of routes, components, files, dependencies, APIs and database relationships.
- Show confidence/freshness and allow targeted refresh.

### Build 97 — Change Transactions
- Represent each requested change as one transaction containing intent, plan, files, diff, database actions, tests, approvals, commit and recovery state.
- Provide Explain / Review / Revert from the same transaction object.

### Build 98 — Guided Autonomy + Policy Engine
- Manual, Guided and Autonomous execution modes.
- Capability-specific policy: edit/create/test may be auto; install/push/deploy/database/destructive actions can remain ASK/ALWAYS ASK.
- Global autonomy must never bypass mandatory safety gates.

### Build 99 — Git Transaction UX
- Commit history cards, branch/head awareness, compare, guarded commit and safe revert integrated with Change Transactions.

### Build 100 — Lovable Publish / Deployment Adapter
- Treat Lovable publication as an explicit deployment capability.
- Preflight, build/publish status, result verification and rollback/redeploy hooks; no silent deploy after code mutation.

## Phase C — Product intelligence and usability

### Build 101 — Mixed Code + Database Orchestration
- Execute a single approved request across code and database capabilities while preserving separate authorization boundaries and one parent Change Transaction.

### Build 102 — Beginner Onboarding
- Guided first-run: project detection, integration readiness, local-runtime readiness and capability explanation.

### Build 103 — Mentor / Explain Layer
- Explain plans, files, database changes, errors, commits and recovery in user-appropriate language without changing execution authority.

### Build 104 — Preview Component Inspector
- Connect visible Lovable preview elements to component/file/context information where deterministically discoverable.
- No fragile broad DOM observer as a permanent mount mechanism.

### Build 105 — Context-to-Preview Navigation
- Navigate Context Map ↔ source file ↔ related route/component ↔ change transaction from the canonical UI.

### Build 106 — Migration Orchestrator
- Re-expose the preserved Cloud/Supabase migration engines under canonical approval, progress, verification and recovery UX.

### Build 107 — Project Workspace
- Recent projects, aliases, mappings and per-project safe state without duplicating credentials into project storage.

### Build 108 — Multi-Project Context Boundaries
- Explicit project switching, context invalidation and prevention of cross-project proposal/approval reuse.

## Phase D — Production hardening

### Build 109 — Production Observability & Supportability
- Structured health/status for launcher, service worker, local runtime, integrations and active transactions.
- Privacy-preserving diagnostics export with secrets redacted.

### Build 110 — Security Hardening v3
- Threat-model refresh for canonical bridge, capability routing, database execution, deployment and multi-project state.
- Adversarial CI for privilege expansion, replay, stale approvals and cross-capability escalation.

### Build 111 — Performance & Lovable Coexistence
- Budget startup/main-thread cost, service-worker wakeups and network/storage use.
- Prove no permanent polling/MutationObserver mount loops and no Lovable interaction degradation.

### Build 112 — Offline / Degraded Runtime
- Graceful local-only/degraded behavior when providers are unavailable.
- Queue only operations that are provably safe to resume; remote writes remain fail-closed.

### Build 113 — Update & Recovery Channel v2
- Canonical update status, integrity checks, rollback/recovery and explicit update controls without legacy updater UI.
- No OTA publication is authorized by implementation alone.

### Build 114 — Full Browser + Provider Homologation
- Real Chrome validation for GitHub, Supabase, Lovable, local runtime, MCP, agents, approval transactions and revoked credentials.
- Inspect local/session storage for credential leakage.

### Build 115 — Release Candidate Hardening
- Full cumulative CI, DecrypterBench, Universal Agent Bench, canonical-UI tests, performance budgets and security gates.
- Freeze candidate only after zero legacy-reference regressions and functional acceptance.

### Build 116 — Deployment Hub / Production Readiness
- Unified explicit deployment/status surface for supported targets with environment/secrets boundaries, preflight, validation and rollback.
- Final production-readiness dossier and release checklist.
- **Still does not authorize merge to `main`, Release, OTA or Chrome Store publication without separate explicit user approval.**

## Shark Git audit adoption rules

Concepts adopted as product lessons, not copied implementation:
- simple CODE/DATABASE/MIXED intent triage generalized into the Capability Router;
- database Plan → Review → Run with destructive confirmation;
- user-visible Project Understanding over the existing Context/State engines;
- commit/revert expressed as understandable Change Transactions;
- clear OAuth/project-selection UX;
- attachments, voice and task cancellation where compatible with the existing safety model.

Explicitly rejected:
- remote storage of broad GitHub PATs as the default trust model;
- hardware/WebGL fingerprinting as a security foundation;
- restoring or wrapping the purged legacy UI;
- obfuscation as a substitute for security;
- gamification unrelated to engineering workflows;
- any external agent/provider becoming authoritative writer.

## Release gate

No build in this roadmap authorizes merge to `main`, OTA metadata, GitHub Release, Chrome Store publication or production rollout. Those actions require Build 114/115 acceptance plus separate explicit user authorization.
