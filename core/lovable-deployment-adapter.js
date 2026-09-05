export const LOVABLE_DEPLOYMENT_SCHEMA = 'ld-lovable-deployment/1';
export const LOVABLE_DEPLOYMENT_BUILD = 100;
export const LOVABLE_DEPLOYMENT_TRANSPORT = Symbol.for('ld2.lovableDeployment.transport');
export const LOVABLE_DEPLOYMENT_TICKET_PREFIX = 'ld100_lovable_deploy_ticket_v1_';
export const LOVABLE_DEPLOYMENT_RECEIPTS_KEY = 'ld100_lovable_deploy_receipts_v1';

const text = (value, max = 1200) => String(value ?? '').trim().slice(0, max);
const bool = value => value === true;

export function sanitizeDeploymentTransport(raw = {}) {
  const id = text(raw?.id, 120);
  const provider = text(raw?.provider || 'lovable', 120).toLowerCase();
  const homologated = raw?.homologated === true;
  return Object.freeze({
    schema: 'ld-deployment-transport/1',
    id,
    provider,
    available: Boolean(id && raw && typeof raw === 'object'),
    homologated,
    capabilities: Object.freeze({
      publish: typeof raw?.publish === 'function',
      verify: typeof raw?.verify === 'function',
      rollback: typeof raw?.rollback === 'function',
      redeploy: typeof raw?.redeploy === 'function'
    }),
    undocumentedEndpointUsed: false
  });
}

export function deploymentPreflightFingerprint(value = {}) {
  return Object.freeze({
    schema: LOVABLE_DEPLOYMENT_SCHEMA,
    projectId: text(value?.projectId, 160),
    provider: 'lovable',
    transportId: text(value?.transportId, 120),
    transportHomologated: bool(value?.transportHomologated),
    git: Object.freeze({
      owner: text(value?.git?.owner, 180),
      repo: text(value?.git?.repo, 220),
      branch: text(value?.git?.branch, 220),
      headSha: text(value?.git?.headSha, 128).toLowerCase()
    }),
    lovable: Object.freeze({
      detected: bool(value?.lovable?.detected),
      contextProjectId: text(value?.lovable?.contextProjectId, 160),
      gitSyncFullName: text(value?.lovable?.gitSyncFullName, 420),
      gitSyncBranch: text(value?.lovable?.gitSyncBranch, 220),
      sessionAvailable: bool(value?.lovable?.sessionAvailable)
    }),
    blockers: Object.freeze((Array.isArray(value?.blockers) ? value.blockers : []).map(item => text(item, 180)).filter(Boolean).sort()),
    activeTransactionCount: Math.max(0, Number(value?.activeTransactionCount || 0) || 0)
  });
}

export function publicDeploymentReceipt(raw = {}) {
  return Object.freeze({
    schema: 'ld-lovable-deployment-receipt/1',
    id: text(raw?.id, 180),
    projectId: text(raw?.projectId, 160),
    provider: 'lovable',
    transportId: text(raw?.transportId, 120),
    status: text(raw?.status, 80),
    sourceHeadSha: text(raw?.sourceHeadSha, 128),
    deploymentId: text(raw?.deploymentId, 220),
    deploymentUrl: text(raw?.deploymentUrl, 1200),
    createdAt: text(raw?.createdAt, 80),
    updatedAt: text(raw?.updatedAt, 80),
    verifiedAt: text(raw?.verifiedAt, 80),
    verification: Object.freeze({
      verified: bool(raw?.verification?.verified),
      observable: bool(raw?.verification?.observable),
      reason: text(raw?.verification?.reason, 180)
    }),
    rollbackAvailable: bool(raw?.rollbackAvailable),
    redeployAvailable: bool(raw?.redeployAvailable),
    rawProviderPayloadPersisted: false,
    credentialsPersisted: false
  });
}

export function deploymentSafetyContract() {
  return Object.freeze({
    schema: LOVABLE_DEPLOYMENT_SCHEMA,
    build: LOVABLE_DEPLOYMENT_BUILD,
    explicitCapability: 'DEPLOY',
    automaticPublish: false,
    publishAfterCommit: false,
    publishAfterBuild: false,
    humanConfirmationRequired: true,
    preflightRequired: true,
    headLockRequired: true,
    projectLockRequired: true,
    oneShotTicketRequired: true,
    providerVerificationRequired: true,
    ambiguousPublishRetryAllowed: false,
    undocumentedEndpointAllowed: false,
    rollbackIsSeparateHumanAction: true,
    redeployIsSeparateHumanAction: true,
    writer: false,
    approvalAuthority: false
  });
}
