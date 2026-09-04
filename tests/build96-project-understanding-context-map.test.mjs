import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildProjectUnderstandingMap, safeProjectPath, expectedMigrationVersions, expectedEdgeFunctionSlugs } from '../core/project-understanding-map.js';

const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const runtimeSource = fs.readFileSync('background/project-understanding-runtime.js', 'utf8');
const clientSource = fs.readFileSync('content/canonical-project-understanding-client.js', 'utf8');
const uiSource = fs.readFileSync('launcher/canonical-project-understanding.js', 'utf8');
const serviceWorkerSource = fs.readFileSync('background/service-worker-entry.js', 'utf8');

assert.equal(manifest.version, '2.6.96');
const scripts = manifest.content_scripts.flatMap(item => item.js || []);
assert.ok(scripts.includes('content/canonical-project-understanding-client.js'));
assert.ok(scripts.includes('launcher/canonical-project-understanding.js'));
assert.ok(scripts.indexOf('content/canonical-project-understanding-client.js') < scripts.indexOf('launcher/canonical-project-understanding.js'));
assert.match(serviceWorkerSource, /installProjectUnderstandingRuntime/);

assert.equal(safeProjectPath('../.env'), '');
assert.equal(safeProjectPath('.env'), '');
assert.equal(safeProjectPath('src/App.tsx'), 'src/App.tsx');
assert.deepEqual(expectedMigrationVersions(['supabase/migrations/20260904120000_create_users.sql']), ['20260904120000']);
assert.deepEqual(expectedEdgeFunctionSlugs(['supabase/functions/send-email/index.ts']), ['send-email']);

const tree = [
  { path: 'package.json', type: 'blob', sha: 'a'.repeat(40) },
  { path: 'src/App.tsx', type: 'blob', sha: 'b'.repeat(40) },
  { path: 'src/components/UserCard.tsx', type: 'blob', sha: 'c'.repeat(40) },
  { path: 'src/lib/api.ts', type: 'blob', sha: 'd'.repeat(40) },
  { path: 'supabase/migrations/20260904120000_create_users.sql', type: 'blob', sha: 'e'.repeat(40) },
  { path: 'supabase/functions/send-email/index.ts', type: 'blob', sha: 'f'.repeat(40) }
];

const files = [
  { path: 'package.json', sha: 'a'.repeat(40), content: JSON.stringify({ dependencies: { react: '^19.0.0', '@supabase/supabase-js': '^2.0.0' } }) },
  { path: 'src/App.tsx', sha: 'b'.repeat(40), content: `
    import React from 'react';
    import { UserCard } from './components/UserCard';
    import { createBrowserRouter } from 'react-router-dom';
    export const App = () => <UserCard />;
    export const router = createBrowserRouter([{ path: '/users', element: <App /> }]);
  ` },
  { path: 'src/components/UserCard.tsx', sha: 'c'.repeat(40), content: `
    import { supabase } from '../lib/api';
    export function UserCard(){
      const load = () => supabase.from('users').select('*');
      return <button onClick={load}>Load</button>;
    }
  ` },
  { path: 'src/lib/api.ts', sha: 'd'.repeat(40), content: `
    import { createClient } from '@supabase/supabase-js';
    export const ping = () => fetch('/api/ping');
    export const send = () => supabase.functions.invoke('send-email');
  ` }
];

const map = buildProjectUnderstandingMap({
  files,
  tree,
  project: { id: 'lovable-1', github: 'owner/repo', branch: 'main', supabaseProjectRef: 'abcdefgh' },
  databaseSchema: [
    { table_schema: 'public', table_name: 'users', column_name: 'id' },
    { table_schema: 'public', table_name: 'users', column_name: 'email' }
  ],
  collectedAt: '2026-09-04T12:00:00.000Z',
  headSha: '1'.repeat(40)
});

assert.equal(map.schema, 'ld-project-understanding-map/1');
assert.equal(map.build, 96);
assert.equal(map.provenance.modelInferenceUsed, false);
assert.equal(map.provenance.rawSourcePersistedInMap, false);
assert.equal(map.provenance.authoritativeForWrites, false);
assert.equal(map.freshness.headSha, '1'.repeat(40));

const by = (type, label) => map.nodes.find(node => node.type === type && node.label === label);
assert.ok(by('route', '/users'), 'route should be detected from router object');
assert.ok(by('component', 'App'), 'App component should be detected');
assert.ok(by('component', 'UserCard'), 'UserCard component should be detected');
assert.ok(by('dependency', 'react'), 'React dependency should be detected');
assert.ok(by('dependency', '@supabase/supabase-js'), 'scoped package dependency should be detected');
assert.ok(by('api', '/api/ping'), 'fetch endpoint should be detected');
assert.ok(by('api', 'send-email'), 'Supabase function should be detected');
assert.ok(by('database_table', 'users'), 'code database table reference should be detected');
assert.ok(by('database_table', 'public.users'), 'introspected database table should be detected');
assert.ok(by('migration', '20260904120000'), 'migration version should be represented');

const appFile = by('file', 'src/App.tsx');
const cardFile = by('file', 'src/components/UserCard.tsx');
assert.ok(map.edges.some(edge => edge.type === 'imports' && edge.from === appFile.id && edge.to === cardFile.id), 'relative import edge should resolve deterministically');
assert.ok(map.edges.some(edge => edge.type === 'calls_api'), 'API relation should exist');
assert.ok(map.edges.some(edge => edge.type === 'reads_table'), 'database read relation should exist');
assert.ok(map.edges.some(edge => edge.type === 'matches_schema'), 'code table should reconcile with introspected schema');

const serialized = JSON.stringify(map);
assert.ok(!serialized.includes("select('*')"), 'raw source must not be persisted into map');
assert.ok(!serialized.includes('createBrowserRouter([{'), 'raw source must not be persisted into map');
assert.ok(map.nodes.every(node => Number(node.confidence) >= 0 && Number(node.confidence) <= 1));
assert.ok(map.nodes.every(node => Array.isArray(node.evidence) && node.evidence.length <= 6));

const targeted = buildProjectUnderstandingMap({
  files,
  tree,
  project: { id: 'lovable-1', github: 'owner/repo', branch: 'main' },
  target: { path: 'src/components/UserCard.tsx' }
});
assert.equal(targeted.limits.analyzedFiles, 1);
assert.ok(targeted.nodes.some(node => node.type === 'file' && node.label === 'src/components/UserCard.tsx'));
assert.ok(!targeted.nodes.some(node => node.type === 'file' && node.label === 'src/App.tsx'));

assert.match(runtimeSource, /MAX_ANALYZED_FILES = 240/);
assert.match(runtimeSource, /MAX_TOTAL_SOURCE_CHARS = 3_000_000/);
assert.match(runtimeSource, /action === 'refresh_target'/);
assert.match(runtimeSource, /targetedRefresh: Boolean\(targeted && target\?\.path\)/);
assert.match(runtimeSource, /writeAuthority: false/);
assert.match(runtimeSource, /polling: false/);
assert.doesNotMatch(runtimeSource, /setInterval\s*\(/);
assert.doesNotMatch(runtimeSource, /MutationObserver/);
assert.doesNotMatch(clientSource, /chrome\.storage/);
assert.match(clientSource, /readOnly: true/);
assert.match(clientSource, /writeAuthority: false/);
assert.match(clientSource, /rawSourceExposed: false/);
assert.match(uiSource, /BUILD 96 · READ ONLY/);
assert.match(uiSource, /confidence é baseada em evidência estática/);

console.log('Build 96 Project Understanding / Context Map contract: OK');
