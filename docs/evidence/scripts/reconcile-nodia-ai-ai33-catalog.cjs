// Additive AI-33 inventory reconciliation; does not rewrite historical stage facts.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..'); process.chdir(root);
const ts = require(path.join(root, 'nodia-server/node_modules/typescript'));
const inventoryPath = 'docs/mvp/nodia-ai-current-endpoints.json', apiPath = 'docs/mvp/nodia-ai-v1-coordination-api.json';
const deltaPath = 'docs/evidence/nodia-ai-ai33-catalog-delta.json';
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const bytes = value => JSON.stringify(value, null, 2) + '\n';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const mode = process.argv[2] ?? '--check'; assert(['--write', '--check'].includes(mode));
const decorators = node => ts.canHaveDecorators(node) ? ts.getDecorators(node) || [] : [];
const decorator = (node, name, sf) => decorators(node).find(d => ts.isCallExpression(d.expression) && d.expression.expression.getText(sf) === name)?.expression;
const values = (node, sf) => node.arguments.map(a => ts.isStringLiteralLike(a) ? a.text : a.getText(sf));
const literal = node => !node ? [''] : ts.isStringLiteralLike(node) ? [node.text] : ts.isArrayLiteralExpression(node) ? node.elements.flatMap(literal) : (() => { throw Error('Nonliteral route'); })();
const kinds = new Map(['Get', 'Post', 'Put', 'Patch', 'Delete', 'Options', 'Head'].map(k => [k, k.toUpperCase()]));
const walk = folder => fs.readdirSync(folder, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(folder + '/' + e.name) : [folder + '/' + e.name]);
const production = walk('nodia-server/src').filter(f => f.endsWith('.ts') && !f.endsWith('.spec.ts'));
const historical = inv => Object.fromEntries(Object.entries(inv).filter(([key]) => /^ai\d/.test(key) && key !== 'ai33'));
function scanController(file, prefix, full = false) {
  const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const line = node => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
  return sf.statements.filter(ts.isClassDeclaration).flatMap(c => {
    const cd = decorator(c, 'Controller', sf); if (!cd) return [];
    const bases = literal(cd.arguments[0]), ctor = c.members.find(ts.isConstructorDeclaration), imports = new Map();
    for (const item of sf.statements.filter(ts.isImportDeclaration)) for (const e of item.importClause?.namedBindings?.elements ?? []) imports.set(e.name.text, item.moduleSpecifier.text);
    const dependencies = new Map((ctor?.parameters ?? []).map(p => [p.name.getText(sf), p.type.getText(sf)]));
    const operations = [];
    for (const method of c.members.filter(ts.isMethodDeclaration)) for (const dec of decorators(method)) {
      if (!ts.isCallExpression(dec.expression)) continue;
      const kind = kinds.get(dec.expression.expression.getText(sf)); if (!kind) continue;
      const operation = { operationId: c.name.text + '.' + method.name.getText(sf), method: kind, handler: method.name.getText(sf), line: line(dec), paths: bases.flatMap(base => literal(dec.expression.arguments[0]).map(route => ('/' + [prefix, base, route].join('/')).replace(/\/+/g, '/').replace(/\/$/, ''))) };
      if (full) {
        const calls = [], scan = node => {
          if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && ts.isPropertyAccessExpression(node.expression.expression) && node.expression.expression.expression.kind === ts.SyntaxKind.ThisKeyword) {
            const property = node.expression.expression.name.text, type = dependencies.get(property), source = imports.get(type);
            if (type && source) calls.push({ property, method: node.expression.name.text, dependency: { type, file: path.posix.normalize(path.posix.join(path.posix.dirname(file), source.replace(/\.js$/, '.ts'))) }, line: line(node) });
          }
          ts.forEachChild(node, scan);
        }; scan(method);
        Object.assign(operation, { summary: null, public: false, requireAction: null,
          metadata: decorators(method).filter(d => ts.isCallExpression(d.expression) && !kinds.has(d.expression.expression.getText(sf))).map(d => ({ name: d.expression.expression.getText(sf), args: values(d.expression, sf) })),
          inputs: method.parameters.map(p => ({ name: p.name.getText(sf), type: p.type?.getText(sf) || 'unknown', optional: !!p.questionToken, decorators: decorators(p).map(d => ({ name: d.expression.expression.getText(sf), args: values(d.expression, sf) })), references: [] })), calls,
          nodiaAiProposal: { category: 'A', mutates: kind !== 'GET', reason: 'Private owner preference coordination; prepare stores a proposal only. Human confirmation remains separate; not a model-facing MCP domain writer.', implementedInNodiaAi: true, implementationStage: 'AI-33' } });
      }
      operations.push(operation);
    }
    const tags = decorator(c, 'ApiTags', sf);
    return [{ name: c.name.text, file, line: line(c), registered: true, bases, tags: tags ? values(tags, sf) : [], classMetadata: decorators(c).filter(d => ts.isCallExpression(d.expression) && !['Controller', 'ApiTags'].includes(d.expression.expression.getText(sf))).map(d => ({ name: d.expression.expression.getText(sf), args: values(d.expression, sf) })), operations, family: 'NodiaAI — coordinación conversacional', proposedTargetModuleRoute: '/tools/nodia-ai' }];
  });
}
function verify(inv, api) {
  const current = production.filter(f => f.endsWith('.controller.ts')).flatMap(f => scanController(f, inv.prefix));
  const indexed = new Map(inv.controllers.flatMap(c => c.operations).map(o => [o.operationId, o]));
  assert.equal(current.length, inv.counts.controllerFiles);
  for (const c of current) for (const operation of c.operations) {
    const item = indexed.get(operation.operationId); assert(item, operation.operationId);
    assert.equal(item.method, operation.method); assert.deepEqual(item.paths, operation.paths);
  }
  assert.equal(current.flatMap(c => c.operations).length, inv.counts.handlerOperations);
  assert.equal(current.flatMap(c => c.operations.flatMap(o => o.paths)).length, inv.counts.httpMethodPathPairs);
  for (const item of inv.sourceChecksums) assert.equal(hash(fs.readFileSync(item.file)), item.sha256, item.file);
  assert.equal(new Set(inv.sourceChecksums.map(s => s.file)).size, inv.sourceChecksums.length);
  assert.equal(inv.sourceChecksums.filter(s => s.file.endsWith('.spec.ts')).length, 0);
  assert.equal(api.routes.length, 41); assert.equal(new Set(api.routes.map(r => r.method + ' ' + r.path)).size, 41);
  const pref = inv.controllers.find(c => c.name === 'NodiaAiPreferenceController'); assert.equal(pref.operations.length, 4);
  for (const op of pref.operations) for (const p of op.paths) assert(api.routes.some(r => r.path === p && r.method === op.method && r.implemented && r.implementationPhase === 'AI-33'));
}
if (mode === '--write' && !read(inventoryPath).ai33) {
  const inv = read(inventoryPath), api = read(apiPath), before = structuredClone(inv), beforeApi = structuredClone(api);
  const [controller] = scanController('nodia-server/src/nodia-ai-preference/nodia-ai-preference.controller.ts', inv.prefix, true);
  assert(!inv.controllers.some(c => c.name === controller.name)); inv.controllers.push(controller);
  for (const file of production.filter(f => f.endsWith('.module.ts'))) {
    const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    for (const c of sf.statements.filter(ts.isClassDeclaration)) {
      const dec = decorator(c, 'Module', sf); if (!dec || !c.name) continue;
      const name = c.name.text, previous = inv.modules.find(m => m.module === name);
      if (!previous && !name.startsWith('NodiaAi')) continue;
      const refs = key => { const value = dec.arguments[0].properties.find(p => p.name?.getText(sf) === key)?.initializer; return value && ts.isArrayLiteralExpression(value) ? value.elements.filter(ts.isIdentifier).map(n => n.text) : []; };
      inv.modules = inv.modules.filter(m => m.module !== name);
      inv.modules.push({ ...previous, module: name, file, line: sf.getLineAndCharacterOfPosition(c.getStart(sf)).line + 1, controllers: refs('controllers'), imports: refs('imports') });
    }
  }
  inv.controllers.sort((a, b) => a.name.localeCompare(b.name)); inv.modules.sort((a, b) => a.module.localeCompare(b.module));
  const handlers = inv.controllers.flatMap(c => c.operations);
  Object.assign(inv.counts, { controllerFiles: inv.controllers.length, registeredControllers: inv.controllers.filter(c => c.registered).length, unregisteredControllers: inv.controllers.filter(c => !c.registered).length, handlerOperations: handlers.length, httpMethodPathPairs: handlers.flatMap(o => o.paths).length, localModules: inv.modules.length, staticallyComposedModules: inv.modules.filter(m => !m.conditional).length, conditionalModules: inv.modules.filter(m => m.conditional).length });
  inv.categoryCounts = {}; for (const h of handlers) inv.categoryCounts[h.nodiaAiProposal.category] = (inv.categoryCounts[h.nodiaAiProposal.category] || 0) + 1;
  const addedSources = production.filter(f => f.includes('/nodia-ai-') || f.includes('/migrations/1792900000000-'));
  inv.sourceChecksums = [...new Set([...inv.sourceChecksums.map(s => s.file), ...addedSources])].sort().map(file => ({ file, sha256: hash(fs.readFileSync(file)) }));
  inv.ai33 = { date: '2026-10-18', scope: 'Closed typed owner-only accepted preferences; exact proposal confirmation, CAS, atomic receipt, current product authority and context revalidation; structural provenance does not prove deployment', newControllers: [controller.name], newHandlers: controller.operations.map(o => o.operationId), newHttpRoutes: 4, newCoordinationDefinitions: 3, databaseMigrations: 1, newTables: ['nodia_ai_preferences'], preferenceKeys: 5, internalPreparers: 3, publishedMcpToolsAdded: 0 };
  api.dates['AI-33'] = '2026-10-18';
  const routes = [['GET', '', 'PreferencePageQuery', 'PreferencePage'], ['GET', '/catalog', null, 'PreferenceCatalog'], ['GET', '/options', 'PreferenceOptionsQuery', 'PreferenceOptionsPage'], ['POST', '/prepare', 'PreferencePrepareRequest', 'PreparationResult']];
  for (const [method, suffix, inputContract, outputContract] of routes) {
    const route = { method, path: '/api/v1/nodia-ai/preferences' + suffix, channel: 'app', inputContract, outputContract, implemented: true, implementationPhase: 'AI-33', implementationScope: 'local_typed_owner_preference_coordination; writes_require_separate_exact_human_confirmation', cacheControl: 'no-store' };
    const old = api.routes.findIndex(r => r.path === route.path && r.method === method); if (old < 0) api.routes.push(route); else api.routes[old] = route;
  }
  assert.deepEqual(historical(inv), historical(before));
  assert.deepEqual(before.controllers.flatMap(c => c.operations), inv.controllers.filter(c => c.name !== controller.name).flatMap(c => c.operations));
  verify(inv, api);
  const oldHashes = new Map(before.sourceChecksums.map(s => [s.file, s.sha256]));
  const changes = inv.sourceChecksums.filter(s => oldHashes.get(s.file) !== s.sha256).map(s => ({ file: s.file, before_sha256: oldHashes.get(s.file) ?? null, after_sha256: s.sha256, provenance: /common\/storage\/storage.service|nodia-ai-attachment\/adapters\/storage-nodia-ai-attachment/.test(s.file) ? 'AI-32-R05 already activated; source provenance only' : 'AI-33' }));
  const delta = { schema_version: 1, stage: 'AI-33', before_inventory_sha256: hash(bytes(before)), after_inventory_sha256: hash(bytes(inv)), before_coordination_sha256: hash(bytes(beforeApi)), after_coordination_sha256: hash(bytes(api)), historical_stage_metadata_sha256: hash(bytes(historical(inv))), before_counts: before.counts, after_counts: inv.counts, before_source_count: before.sourceChecksums.length, after_source_count: inv.sourceChecksums.length, source_hash_changes: changes, new_controller: controller.name, new_handlers: controller.operations.map(o => o.operationId), unchanged_prior_handler_operations: before.counts.handlerOperations, domain_handler_coverage_unchanged: 177, coordination_routes: api.routes.length, runtime_verified: false, database_applied: false, provider_generations: 0, limitations: ['AST and source provenance only; no operational database, inference, deployment or document approval', 'Historical domain catalog and coverage are preserved; preference operations use internal preparers and the existing human proposal channel'] };
  fs.writeFileSync(inventoryPath, bytes(inv)); fs.writeFileSync(apiPath, bytes(api)); fs.writeFileSync(deltaPath, bytes(delta));
}
if (mode === '--write' && read(inventoryPath).ai33 && fs.existsSync(deltaPath)) {
  const current = read(inventoryPath), delta = read(deltaPath);
  assert.equal(hash(fs.readFileSync(inventoryPath)), delta.after_inventory_sha256, 'Unexpected inventory edit before refresh');
  assert.equal(hash(fs.readFileSync(apiPath)), delta.after_coordination_sha256, 'Unexpected coordination edit before refresh');
  const priorChanges = new Map(delta.source_hash_changes.map(change => [change.file, change]));
  const changes = [];
  for (const source of current.sourceChecksums) {
    const before = priorChanges.get(source.file)?.before_sha256 ?? (priorChanges.has(source.file) ? null : source.sha256);
    const after = hash(fs.readFileSync(source.file));
    if (after !== source.sha256) assert(source.file.includes('/nodia-ai-'), 'Unrelated source drift ' + source.file);
    source.sha256 = after;
    if (before !== after) changes.push({ file: source.file, before_sha256: before, after_sha256: after, provenance: /common\/storage\/storage.service|nodia-ai-attachment\/adapters\/storage-nodia-ai-attachment/.test(source.file) ? 'AI-32-R05 already activated; source provenance only' : 'AI-33' });
  }
  delta.source_hash_changes = changes;
  delta.after_inventory_sha256 = hash(bytes(current));
  verify(current, read(apiPath));
  fs.writeFileSync(inventoryPath, bytes(current)); fs.writeFileSync(deltaPath, bytes(delta));
}
const inv = read(inventoryPath), api = read(apiPath), delta = read(deltaPath); verify(inv, api);
assert.equal(hash(fs.readFileSync(inventoryPath)), delta.after_inventory_sha256);
assert.equal(hash(fs.readFileSync(apiPath)), delta.after_coordination_sha256);
assert.equal(hash(bytes(historical(inv))), delta.historical_stage_metadata_sha256);
console.log(JSON.stringify({ stage: 'AI-33', mode, status: 'passed', counts: inv.counts, source_hashes: inv.sourceChecksums.length, coordination_routes: api.routes.length, domain_handler_coverage: 177, runtime_verified: false }));
