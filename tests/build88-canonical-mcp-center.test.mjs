import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(path, 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const pkg = JSON.parse(read('release/runtime-package.json'));
const settings = read('settings/config.js');
const runtimeClient = read('content/mcp-runtime-client.js');
const marketplaceClient = read('content/mcp-marketplace-client.js');
const canonicalClient = read('content/canonical-mcp-center-client.js');
const canonicalUi = read('launcher/canonical-mcp-center.js');
const runtime = read('background/mcp-runtime.js');
const marketplaceRuntime = read('background/mcp-marketplace-runtime.js');
const trust = read('core/mcp-trust-gateway.js');
const marketplace = read('core/mcp-marketplace.js');
const client = read('core/mcp-client.js');
const wiring = read('launcher/canonical-runtime-wiring.js');

assert.equal(manifest.version, '2.6.88');
assert.match(manifest.version_name, /Build 88\b/);
assert.equal(pkg.candidate, manifest.version);
assert.ok(settings.startsWith("export const VERSION = '2.6.88';"));

const scripts = (manifest.content_scripts || []).flatMap(entry => entry.js || []);
for (const required of [
  'content/mcp-runtime-client.js',
  'content/mcp-marketplace-client.js',
  'content/canonical-mcp-center-client.js',
  'launcher/canonical-mcp-center.js',
  'launcher/canonical-runtime-wiring.js'
]) assert.ok(scripts.includes(required), `Build88 active script missing: ${required}`);

assert.ok(runtimeClient.includes("const PORT_NAME = 'ld2-mcp-runtime'"));
assert.ok(marketplaceClient.includes("const PORT_NAME = 'ld2-mcp-marketplace'"));
assert.ok(runtime.includes("authority: 'trust-gateway'"));
assert.ok(runtime.includes('unknownToolsDefaultDeny: true'));
assert.ok(runtime.includes('serverAnnotationsTrustedForSecurity: false'));
assert.ok(runtime.includes('writesRequireHumanApproval: true'));
assert.ok(runtime.includes('secretPersistence: false'));
assert.ok(runtime.includes("writePolicy: 'explicit-tool-allowlist+scope-lock+one-time-human-approval'"));

for (const token of [
  'MCP_SERVER_NOT_TRUSTED',
  'MCP_WRITE_POLICY_REQUIRED',
  'MCP_HUMAN_APPROVAL_REQUIRED',
  'MCP_WRITE_APPROVAL_REQUIRED',
  'MCP_APPROVAL_BINDING_MISMATCH',
  'MCP_SCOPE_LOCK_ARGUMENT_REJECTED',
  'MCP_SCOPE_LOCK_VALUE_REJECTED',
  'MCP_SCOPE_LOCK_PREFIX_REJECTED'
]) assert.ok(trust.includes(token), `MCP Trust Gateway invariant missing: ${token}`);
assert.ok(trust.includes("chrome.storage.session.set({ [AUTH_KEY]: map })"));
assert.ok(trust.includes("status: 'prepared'"));
assert.ok(trust.includes("status = 'approved'"));
assert.ok(trust.includes('await chrome.storage.session.remove(key)'));

assert.ok(client.includes("securityAuthority: 'local-trust-gateway'"));
assert.ok(client.includes('MCP annotations are hints from the remote server, never local security authority.'));
assert.ok(marketplaceRuntime.includes('writeToolsAutoEnabled: false'));
assert.ok(marketplaceRuntime.includes('arbitraryRemoteCatalog: false'));
assert.ok(marketplaceRuntime.includes('remoteCodeExecution: false'));
assert.ok(marketplace.includes('Curated installation never auto-enables write tools'));
assert.ok(marketplace.includes("id: 'github-official-remote'"));
assert.ok(marketplace.includes("id: 'supabase-official-remote'"));
assert.ok(marketplace.includes('verifiedDomain'));
assert.ok(marketplace.includes('provenance'));

assert.ok(canonicalClient.includes("const SCHEMA = 'ld-canonical-mcp-center/1'"));
assert.ok(canonicalClient.includes('marketplace().catalog()'));
assert.ok(canonicalClient.includes('mcp().permissionStatus(server.id)'));
assert.ok(canonicalClient.includes('mcp().setTrust(serverId, trust)'));
assert.ok(canonicalClient.includes('mcp().requestHostPermission(serverId)'));
assert.ok(canonicalClient.includes('mcp().listTools(serverId'));
assert.ok(canonicalClient.includes("mode: 'read'"));
assert.ok(canonicalClient.includes('Unknown tools default deny.'));
assert.ok(canonicalClient.includes('remoteAnnotationsTrustedForSecurity: false'));
assert.ok(canonicalClient.includes('directToolCallsFromCanonicalUi: false'));
assert.ok(canonicalClient.includes("writeApprovalAuthority: 'mcp-trust-gateway-one-time-human-approval'"));
assert.ok(!canonicalClient.includes('.callTool('), 'canonical MCP client must not directly call tools');
assert.ok(!canonicalClient.includes('.prepareWrite('), 'canonical MCP client must not prepare writes');
assert.ok(!canonicalClient.includes('.approveWrite('), 'canonical MCP client must not approve writes');

assert.ok(canonicalUi.includes("const MODULE_ID = 'mcp-runtime'"));
assert.ok(canonicalUi.includes('MCP Center'));
assert.ok(canonicalUi.includes('Marketplace curado'));
assert.ok(canonicalUi.includes('Provenance:'));
assert.ok(canonicalUi.includes('HOST PERMISSION'));
assert.ok(canonicalUi.includes('WRITE DEFAULT DENY'));
assert.ok(canonicalUi.includes('Habilitar READ'));
assert.ok(canonicalUi.includes('Esta UI não executa tools MCP diretamente e não aprova writes.'));
assert.ok(!canonicalUi.includes('Habilitar WRITE'));
assert.ok(!canonicalUi.includes('callTool('));
assert.ok(!canonicalUi.includes('prepareWrite('));
assert.ok(!canonicalUi.includes('approveWrite('));
assert.ok(!canonicalUi.includes('innerHTML'));
assert.ok(!canonicalUi.includes('setInterval('));
assert.ok(!canonicalUi.includes('MutationObserver'));

assert.ok(wiring.includes('LovableDecrypterCanonicalMcpCenter?.handles'));
assert.ok(wiring.includes('canonicalMcp: Boolean(window.LovableDecrypterCanonicalMcpApi)'));

for (const forbidden of ['ui/', 'diagnostic/']) assert.ok(!JSON.stringify(manifest).includes(forbidden), `forbidden active path: ${forbidden}`);
assert.ok(pkg.paths.includes('content/canonical-mcp-center-client.js'));
assert.ok(pkg.forbidden_roots.includes('ui'));
assert.ok(pkg.forbidden_roots.includes('diagnostic'));

console.log(JSON.stringify({
  ok: true,
  schema: 'ld-build88-canonical-mcp-center/1',
  version: manifest.version,
  curatedMarketplace: true,
  provenanceVisible: true,
  hostPermissionExplicit: true,
  unknownToolsDefaultDeny: true,
  canonicalReadEnablementOnly: true,
  directMcpToolExecution: false,
  writeAuthority: 'one-time human approval bound to exact call'
}, null, 2));
