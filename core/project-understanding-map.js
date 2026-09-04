const SCHEMA = 'ld-project-understanding-map/1';
const MAX_EVIDENCE = 6;
const SOURCE_EXT = /\.(?:[cm]?[jt]sx?|vue|svelte|astro|json|sql)$/i;
const SENSITIVE_PATH = /(^|\/)(?:\.env(?:\..*)?|.*(?:secret|credential|private[-_.]?key).*)(?:\/|$)|\.(?:pem|p12|pfx|key)$/i;

const text = (value, max = 1200) => String(value ?? '').trim().slice(0, max);
const unique = values => [...new Set((values || []).map(v => text(v)).filter(Boolean))];
const cleanSlash = value => text(value).replace(/\\/g, '/').replace(/^\.\//, '');

export function safeProjectPath(value) {
  const path = cleanSlash(value);
  if (!path || path.length > 1200 || path.startsWith('/') || path.includes('\0')) return '';
  const parts = path.split('/');
  if (parts.some(part => !part || part === '.' || part === '..')) return '';
  return SENSITIVE_PATH.test(path) ? '' : path;
}

function hashId(prefix, value) {
  let h = 2166136261;
  const input = `${prefix}:${value}`;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `${prefix}:${(h >>> 0).toString(16).padStart(8, '0')}`;
}

function confidence(value) {
  return Math.max(0, Math.min(1, Number(value || 0)));
}

function evidence(path, reason, detail = '') {
  return Object.freeze({ path: safeProjectPath(path), reason: text(reason, 120), detail: text(detail, 300) });
}

function node(type, key, label, confidenceValue, evidenceItems = [], meta = {}) {
  return Object.freeze({
    id: hashId(type, key),
    type,
    key: text(key, 1000),
    label: text(label, 500),
    confidence: confidence(confidenceValue),
    evidence: Object.freeze(evidenceItems.filter(Boolean).slice(0, MAX_EVIDENCE)),
    meta: Object.freeze({ ...meta })
  });
}

function edge(type, from, to, confidenceValue, evidenceItems = [], meta = {}) {
  return Object.freeze({
    id: hashId('edge', `${type}|${from}|${to}`),
    type,
    from,
    to,
    confidence: confidence(confidenceValue),
    evidence: Object.freeze(evidenceItems.filter(Boolean).slice(0, MAX_EVIDENCE)),
    meta: Object.freeze({ ...meta })
  });
}

function packageRoot(specifier) {
  const value = text(specifier, 500);
  if (!value || value.startsWith('.') || value.startsWith('/') || value.startsWith('#')) return '';
  if (value.startsWith('@')) return value.split('/').slice(0, 2).join('/');
  return value.split('/')[0];
}

function resolveRelativeImport(fromPath, specifier, knownPaths) {
  if (!specifier?.startsWith('.')) return '';
  const baseParts = safeProjectPath(fromPath).split('/');
  baseParts.pop();
  for (const part of specifier.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') baseParts.pop();
    else baseParts.push(part);
  }
  const base = baseParts.join('/');
  const candidates = [
    base,
    `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.jsx`, `${base}.mjs`, `${base}.cjs`,
    `${base}/index.ts`, `${base}/index.tsx`, `${base}/index.js`, `${base}/index.jsx`
  ];
  return candidates.find(candidate => knownPaths.has(candidate)) || '';
}

function collectImports(content) {
  const found = [];
  const patterns = [
    /\bimport\s+(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bexport\s+[^'";]+?\s+from\s+['"]([^'"]+)['"]/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content))) found.push(match[1]);
  }
  return unique(found).slice(0, 120);
}

function componentSymbols(path, content) {
  const symbols = new Map();
  const exported = /\bexport\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var)\s+([A-Z][A-Za-z0-9_]*)/g;
  let match;
  while ((match = exported.exec(content))) symbols.set(match[1], 0.96);
  const named = /\b(?:function|class|const)\s+([A-Z][A-Za-z0-9_]*)\b/g;
  while ((match = named.exec(content))) {
    if (/<[A-Z][A-Za-z0-9_.]*\b|return\s*\(\s*</.test(content.slice(match.index, match.index + 2500))) {
      symbols.set(match[1], Math.max(symbols.get(match[1]) || 0, 0.82));
    }
  }
  const fileBase = path.split('/').pop()?.replace(/\.[^.]+$/, '') || '';
  if (/^[A-Z][A-Za-z0-9_]*$/.test(fileBase) && /<[A-Za-z][^>]*>/.test(content)) {
    symbols.set(fileBase, Math.max(symbols.get(fileBase) || 0, 0.74));
  }
  return [...symbols.entries()].slice(0, 40);
}

function routeSignals(path, content) {
  const routes = [];
  let match;
  const jsx = /<Route\b[^>]*\bpath\s*=\s*["']([^"']+)["']/g;
  while ((match = jsx.exec(content))) routes.push({ path: match[1], confidence: 0.98, reason: 'react-router JSX path' });
  const objects = /\bpath\s*:\s*["'](\/?[^"']*)["']/g;
  while ((match = objects.exec(content))) {
    if (/router|route|children|element|component/i.test(content.slice(Math.max(0, match.index - 600), match.index + 700))) {
      routes.push({ path: match[1], confidence: 0.88, reason: 'router object path' });
    }
  }
  const appMatch = path.match(/(?:^|\/)app\/(.*)\/page\.[cm]?[jt]sx?$/i);
  if (appMatch) {
    const route = '/' + appMatch[1].split('/').filter(part => !/^\(.+\)$/.test(part)).map(part => part.replace(/^\[(?:\.\.\.)?(.+)\]$/, ':$1')).join('/');
    routes.push({ path: route === '/' ? '/' : route.replace(/\/+$/, ''), confidence: 0.96, reason: 'Next.js app route convention' });
  }
  const pageMatch = path.match(/(?:^|\/)pages\/(.*)\.[cm]?[jt]sx?$/i);
  if (pageMatch && !/(?:^|\/)pages\/(?:_app|_document|api\/)/i.test(path)) {
    const route = '/' + pageMatch[1].replace(/\/index$/i, '').split('/').map(part => part.replace(/^\[(?:\.\.\.)?(.+)\]$/, ':$1')).join('/');
    routes.push({ path: route === '' ? '/' : route, confidence: 0.9, reason: 'pages route convention' });
  }
  return routes.filter(item => item.path).slice(0, 60);
}

function apiSignals(content) {
  const out = [];
  let match;
  const fetchPattern = /\bfetch\s*\(\s*([`'"])([^`'"]{1,500})\1/g;
  while ((match = fetchPattern.exec(content))) out.push({ key: match[2], kind: 'http', confidence: 0.94, reason: 'fetch literal' });
  const axiosPattern = /\baxios\.(?:get|post|put|patch|delete)\s*\(\s*([`'"])([^`'"]{1,500})\1/g;
  while ((match = axiosPattern.exec(content))) out.push({ key: match[2], kind: 'http', confidence: 0.92, reason: 'axios literal' });
  const invokePattern = /\.functions\.invoke\s*\(\s*['"]([^'"]+)['"]/g;
  while ((match = invokePattern.exec(content))) out.push({ key: match[1], kind: 'supabase_function', confidence: 0.98, reason: 'Supabase Edge Function invoke' });
  return out.slice(0, 80);
}

function databaseSignals(content) {
  const out = [];
  let match;
  const fromPattern = /\.from\s*\(\s*['"]([A-Za-z0-9_.-]{1,180})['"]\s*\)/g;
  while ((match = fromPattern.exec(content))) {
    const tail = content.slice(match.index, match.index + 900);
    let operation = 'read';
    if (/\.(?:insert|upsert)\s*\(/.test(tail)) operation = 'write';
    else if (/\.update\s*\(/.test(tail)) operation = 'write';
    else if (/\.delete\s*\(/.test(tail)) operation = 'write';
    out.push({ table: match[1], operation, confidence: 0.97, reason: `supabase .from() ${operation}` });
  }
  const rpcPattern = /\.rpc\s*\(\s*['"]([A-Za-z0-9_.-]{1,180})['"]/g;
  while ((match = rpcPattern.exec(content))) out.push({ table: match[1], operation: 'rpc', confidence: 0.96, reason: 'supabase .rpc()' });
  return out.slice(0, 100);
}

function schemaTables(rows = []) {
  const map = new Map();
  const walk = (value, depth = 0) => {
    if (depth > 7 || value == null) return;
    if (Array.isArray(value)) { for (const item of value.slice(0, 5000)) walk(item, depth + 1); return; }
    if (typeof value !== 'object') return;
    const table = text(value.table_name || value.table || value.relname || value.name, 180);
    const schema = text(value.table_schema || value.schema || value.schemaname, 120);
    if (table && /^[A-Za-z_][A-Za-z0-9_$.-]*$/.test(table) && !/^(?:pg_|information_schema)/i.test(schema || table)) {
      const key = schema ? `${schema}.${table}` : table;
      const current = map.get(key) || { key, table, schema, rows: 0, columns: new Set() };
      current.rows++;
      const column = text(value.column_name || value.column || value.attname, 180);
      if (column) current.columns.add(column);
      map.set(key, current);
    }
    for (const item of Object.values(value)) walk(item, depth + 1);
  };
  walk(rows);
  return [...map.values()].map(item => ({ ...item, columns: [...item.columns].slice(0, 120) }));
}

export function expectedMigrationVersions(paths = []) {
  return unique((paths || []).map(path => safeProjectPath(path)?.match(/^supabase\/migrations\/([^/]+)\.sql$/i)?.[1] || '').map(stem => stem.match(/^(\d{8,20})/)?.[1] || stem)).sort();
}

export function expectedEdgeFunctionSlugs(paths = []) {
  return unique((paths || []).map(path => safeProjectPath(path)?.match(/^supabase\/functions\/([^/]+)\//i)?.[1] || '')).sort();
}

function categoryForPath(path) {
  if (/package\.json$/i.test(path)) return 'dependency';
  if (/(?:^|\/)(?:routes?|pages?|app)\//i.test(path)) return 'route';
  if (/(?:^|\/)(?:components?|ui)\//i.test(path)) return 'component';
  if (/supabase\/(?:migrations|functions)\//i.test(path)) return 'database';
  return 'file';
}

function targetAllows(path, target) {
  if (!target) return true;
  if (target.path) return safeProjectPath(target.path) === path;
  const category = text(target.category, 40).toLowerCase();
  if (!category || category === 'all') return true;
  return categoryForPath(path) === category;
}

export function buildProjectUnderstandingMap({
  files = [],
  tree = [],
  project = {},
  databaseSchema = [],
  collectedAt = new Date().toISOString(),
  headSha = '',
  target = null
} = {}) {
  const knownPaths = new Set((tree || []).map(item => safeProjectPath(item?.path || item)).filter(Boolean));
  const records = (files || [])
    .map(item => ({ path: safeProjectPath(item?.path), sha: text(item?.sha, 80), content: String(item?.content ?? '') }))
    .filter(item => item.path && SOURCE_EXT.test(item.path) && targetAllows(item.path, target));

  const nodes = new Map();
  const edges = new Map();
  const addNode = item => { if (!nodes.has(item.id) || (nodes.get(item.id)?.confidence || 0) < item.confidence) nodes.set(item.id, item); return item.id; };
  const addEdge = item => { if (!edges.has(item.id) || (edges.get(item.id)?.confidence || 0) < item.confidence) edges.set(item.id, item); };

  const fileNodeByPath = new Map();
  const dependencyVersions = new Map();

  for (const record of records) {
    const fileId = addNode(node('file', record.path, record.path, 1, [evidence(record.path, 'repository file', record.sha)], { sha: record.sha, category: categoryForPath(record.path) }));
    fileNodeByPath.set(record.path, fileId);

    if (/package\.json$/i.test(record.path)) {
      try {
        const pkg = JSON.parse(record.content);
        for (const [name, version] of Object.entries({ ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) })) dependencyVersions.set(name, String(version));
      } catch (_) {}
    }
  }

  for (const record of records) {
    const fileId = fileNodeByPath.get(record.path);
    if (!fileId) continue;

    for (const specifier of collectImports(record.content)) {
      const resolved = resolveRelativeImport(record.path, specifier, knownPaths);
      if (resolved) {
        const targetFileId = fileNodeByPath.get(resolved) || addNode(node('file', resolved, resolved, 0.96, [evidence(record.path, 'relative import', specifier)], { category: categoryForPath(resolved) }));
        addEdge(edge('imports', fileId, targetFileId, 0.98, [evidence(record.path, 'import', specifier)]));
      } else {
        const dependency = packageRoot(specifier);
        if (dependency) {
          const depId = addNode(node('dependency', dependency, dependency, dependencyVersions.has(dependency) ? 0.99 : 0.86, [evidence(record.path, 'package import', specifier)], { version: dependencyVersions.get(dependency) || '' }));
          addEdge(edge('depends_on', fileId, depId, 0.96, [evidence(record.path, 'package import', specifier)]));
        }
      }
    }

    for (const [symbol, score] of componentSymbols(record.path, record.content)) {
      const componentId = addNode(node('component', `${record.path}#${symbol}`, symbol, score, [evidence(record.path, 'component symbol', symbol)], { path: record.path }));
      addEdge(edge('defined_in', componentId, fileId, score, [evidence(record.path, 'component definition', symbol)]));
    }

    for (const route of routeSignals(record.path, record.content)) {
      const routeId = addNode(node('route', route.path, route.path, route.confidence, [evidence(record.path, route.reason, route.path)], { path: route.path }));
      addEdge(edge('implemented_by', routeId, fileId, route.confidence, [evidence(record.path, route.reason, route.path)]));
    }

    for (const signal of apiSignals(record.content)) {
      const apiId = addNode(node('api', `${signal.kind}:${signal.key}`, signal.key, signal.confidence, [evidence(record.path, signal.reason, signal.key)], { kind: signal.kind }));
      addEdge(edge('calls_api', fileId, apiId, signal.confidence, [evidence(record.path, signal.reason, signal.key)]));
    }

    for (const signal of databaseSignals(record.content)) {
      const type = signal.operation === 'rpc' ? 'database_rpc' : 'database_table';
      const dbId = addNode(node(type, signal.table, signal.table, signal.confidence, [evidence(record.path, signal.reason, signal.table)], { source: 'code-reference' }));
      addEdge(edge(signal.operation === 'read' ? 'reads_table' : signal.operation === 'rpc' ? 'calls_rpc' : 'writes_table', fileId, dbId, signal.confidence, [evidence(record.path, signal.reason, signal.table)]));
    }
  }

  for (const item of schemaTables(databaseSchema)) {
    const dbId = addNode(node('database_table', item.key, item.key, 1, [evidence('', 'Supabase schema introspection', `${item.columns.length} column(s)`)], { source: 'supabase-schema', schema: item.schema, table: item.table, columns: item.columns }));
    for (const [nodeId, existing] of nodes) {
      if (nodeId === dbId || existing.type !== 'database_table') continue;
      const codeTable = String(existing.key || '').split('.').pop();
      if (codeTable === item.table && existing.meta?.source === 'code-reference') {
        addEdge(edge('matches_schema', existing.id, dbId, 0.99, [evidence('', 'code/database name match', item.key)]));
      }
    }
  }

  for (const [name, version] of dependencyVersions) {
    addNode(node('dependency', name, name, 1, [evidence('package.json', 'declared dependency', version)], { version }));
  }

  const allTreePaths = [...knownPaths];
  for (const version of expectedMigrationVersions(allTreePaths)) {
    addNode(node('migration', version, version, 0.99, [evidence(`supabase/migrations/${version}`, 'migration discovered by path convention')], {}));
  }
  for (const slug of expectedEdgeFunctionSlugs(allTreePaths)) {
    addNode(node('api', `supabase_function:${slug}`, slug, 0.99, [evidence(`supabase/functions/${slug}`, 'Edge Function discovered by path convention')], { kind: 'supabase_function', declared: true }));
  }

  const nodeList = [...nodes.values()];
  const edgeList = [...edges.values()];
  const counts = {};
  for (const item of nodeList) counts[item.type] = (counts[item.type] || 0) + 1;
  const freshness = Object.freeze({
    collectedAt: text(collectedAt, 80),
    headSha: text(headSha, 80),
    target: target ? Object.freeze({ path: safeProjectPath(target.path), category: text(target.category, 40) }) : null,
    stale: false
  });

  return Object.freeze({
    schema: SCHEMA,
    build: 96,
    project: Object.freeze({
      id: text(project.id, 160),
      github: text(project.github, 400),
      branch: text(project.branch || 'main', 200),
      supabaseProjectRef: text(project.supabaseProjectRef, 80)
    }),
    freshness,
    limits: Object.freeze({ analyzedFiles: records.length, treeFiles: knownPaths.size, evidencePerItem: MAX_EVIDENCE }),
    counts: Object.freeze(counts),
    nodes: Object.freeze(nodeList),
    edges: Object.freeze(edgeList),
    provenance: Object.freeze({
      deterministicStaticAnalysis: true,
      contextEngineCompatible: true,
      legacyProjectStateGraphConcepts: Object.freeze(['safe-path', 'migration-version', 'edge-function-slug', 'state-reconciliation']),
      modelInferenceUsed: false,
      rawSourcePersistedInMap: false,
      authoritativeForWrites: false
    })
  });
}

export const PROJECT_UNDERSTANDING_SCHEMA = SCHEMA;
