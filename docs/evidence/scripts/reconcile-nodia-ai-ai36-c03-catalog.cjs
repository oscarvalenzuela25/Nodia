// AI-36-C03 provenance refresh only. Historical stage facts and every existing HTTP handler stay intact.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..'); process.chdir(root);
const ts = require(path.join(root, 'nodia-server/node_modules/typescript'));
const inventoryPath = 'docs/mvp/nodia-ai-current-endpoints.json', apiPath = 'docs/mvp/nodia-ai-v1-coordination-api.json', deltaPath = 'docs/evidence/nodia-ai-ai36-c03-catalog-delta.json';
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const bytes = value => JSON.stringify(value, null, 2) + '\n';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const mode = process.argv[2] ?? '--check'; assert(['--write', '--check'].includes(mode));
const walk = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(directory + '/' + entry.name) : [directory + '/' + entry.name]);
const production = walk('nodia-server/src').filter(file => file.endsWith('.ts') && !file.endsWith('.spec.ts'));
const history = inventory => Object.fromEntries(Object.entries(inventory).filter(([key]) => /^ai\d/.test(key) && key !== 'ai36_c03'));
const decorators = node => ts.canHaveDecorators(node) ? ts.getDecorators(node) || [] : [];
const moduleDeclaration = (node, sf) => decorators(node).find(decorator => ts.isCallExpression(decorator.expression) && decorator.expression.expression.getText(sf) === 'Module')?.expression;
const literal = node => !node ? [''] : ts.isStringLiteralLike(node) ? [node.text] : ts.isArrayLiteralExpression(node) ? node.elements.flatMap(literal) : (() => { throw Error('Nonliteral route'); })();
function routeMap() {
  const pairs = [];
  for (const file of production.filter(item => item.endsWith('.controller.ts'))) {
    const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    for (const c of sf.statements.filter(ts.isClassDeclaration)) {
      const controller = decorators(c).find(d => ts.isCallExpression(d.expression) && d.expression.expression.getText(sf) === 'Controller')?.expression;
      if (!controller) continue;
      for (const method of c.members.filter(ts.isMethodDeclaration)) for (const decorator of decorators(method)) {
        const call = decorator.expression;
        if (!ts.isCallExpression(call) || !['Get', 'Post', 'Put', 'Patch', 'Delete', 'Options', 'Head'].includes(call.expression.getText(sf))) continue;
        const paths = literal(controller.arguments[0]).flatMap(base => literal(call.arguments[0]).map(route => ('/api/v1/' + base + '/' + route).replace(/\/+/g, '/').replace(/\/$/, '')));
        pairs.push({ operationId: c.name.text + '.' + method.name.getText(sf), method: call.expression.getText(sf).toUpperCase(), paths });
      }
    }
  }
  return pairs;
}
function verify(inventory, api) {
  const actual = routeMap(), indexed = new Map(inventory.controllers.flatMap(c => c.operations).map(operation => [operation.operationId, operation]));
  assert.equal(actual.length, inventory.counts.handlerOperations);
  for (const operation of actual) {
    assert.equal(indexed.get(operation.operationId)?.method, operation.method, operation.operationId);
    assert.deepEqual(indexed.get(operation.operationId)?.paths, operation.paths, operation.operationId);
  }
  assert.equal(actual.flatMap(operation => operation.paths).length, inventory.counts.httpMethodPathPairs);
  assert.equal(api.routes.length, 41);
  assert.equal(new Set(api.routes.map(route => route.method + ' ' + route.path)).size, 41);
  assert.equal(new Set(inventory.sourceChecksums.map(source => source.file)).size, inventory.sourceChecksums.length);
  for (const source of inventory.sourceChecksums) assert.equal(hash(fs.readFileSync(source.file)), source.sha256, source.file);
}
if (mode === '--write') {
  const inventory = read(inventoryPath), api = read(apiPath), previous = structuredClone(inventory), previousApi = structuredClone(api);
  const oldDelta = fs.existsSync(deltaPath) ? read(deltaPath) : null;
  if (oldDelta) {
    assert.equal(hash(fs.readFileSync(inventoryPath)), oldDelta.after_inventory_sha256, 'Unexpected manual inventory edit');
    assert.equal(hash(fs.readFileSync(apiPath)), oldDelta.after_coordination_sha256, 'Unexpected manual coordination edit');
  }
  for (const file of production.filter(item => item.endsWith('.module.ts'))) {
    const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    for (const c of sf.statements.filter(ts.isClassDeclaration)) {
      const module = moduleDeclaration(c, sf); if (!module || !c.name) continue;
      const prior = inventory.modules.find(item => item.module === c.name.text);
      if (!prior && !c.name.text.startsWith('NodiaAi')) continue;
      const refs = key => {
        const initializer = module.arguments[0]?.properties?.find(item => item.name?.getText(sf) === key)?.initializer;
        return initializer && ts.isArrayLiteralExpression(initializer) ? initializer.elements.filter(ts.isIdentifier).map(item => item.text) : [];
      };
      inventory.modules = inventory.modules.filter(item => item.module !== c.name.text);
      inventory.modules.push({ ...prior, module: c.name.text, file, line: sf.getLineAndCharacterOfPosition(c.getStart(sf)).line + 1, controllers: refs('controllers'), imports: refs('imports') });
    }
  }
  inventory.modules.sort((a, b) => a.module.localeCompare(b.module));
  Object.assign(inventory.counts, { localModules: inventory.modules.length, staticallyComposedModules: inventory.modules.filter(module => !module.conditional).length, conditionalModules: inventory.modules.filter(module => module.conditional).length });
  const additions = production.filter(file => file.includes('/nodia-ai-') || file.includes('/migrations/1793100000000-'));
  inventory.sourceChecksums = [...new Set([...inventory.sourceChecksums.map(source => source.file), ...additions])].sort().map(file => ({ file, sha256: hash(fs.readFileSync(file)) }));
  inventory.ai36_c03 = { date: '2026-10-18', scope: 'One strict active-generation invoice-analysis MCP candidate and publication-gated adapter; source provenance alone does not prove publication, SQL execution or provider acceptance', newHttpRoutes: 0, newCoordinationDefinitions: 0, databaseMigrations: 0, newTables: [], newRunColumns: [], providerContinuationStateAdded: false, publishedMcpToolsAdded: 0 };
  api.dates['AI-36-C03'] = '2026-10-18';
  assert.deepEqual(history(inventory), history(previous));
  assert.deepEqual(inventory.controllers, previous.controllers);
  assert.deepEqual(api.routes, previousApi.routes);
  verify(inventory, api);
  const initial = new Map((oldDelta?.source_hash_changes ?? []).map(change => [change.file, change.before_sha256]));
  const previousHashes = new Map(previous.sourceChecksums.map(source => [source.file, source.sha256]));
  const changes = inventory.sourceChecksums.flatMap(source => {
    const before = initial.has(source.file) ? initial.get(source.file) : previousHashes.get(source.file) ?? null;
    if (source.sha256 === before) return [];
    assert(source.file.includes('/nodia-ai-') || source.file.includes('/migrations/1793100000000-'), 'Unrelated source drift ' + source.file);
    return [{ file: source.file, before_sha256: before, after_sha256: source.sha256, provenance: 'AI-36-C03' }];
  });
  const delta = { schema_version: 1, stage: 'AI-36-C03', before_inventory_sha256: oldDelta?.before_inventory_sha256 ?? hash(bytes(previous)), after_inventory_sha256: hash(bytes(inventory)), before_coordination_sha256: oldDelta?.before_coordination_sha256 ?? hash(bytes(previousApi)), after_coordination_sha256: hash(bytes(api)), historical_stage_metadata_sha256: hash(bytes(history(inventory))), before_counts: oldDelta?.before_counts ?? previous.counts, after_counts: inventory.counts, before_source_count: oldDelta?.before_source_count ?? previous.sourceChecksums.length, after_source_count: inventory.sourceChecksums.length, source_hash_changes: changes, new_controller: null, new_handlers: [], unchanged_prior_handler_operations: 217, domain_handler_coverage_unchanged: 177, coordination_routes: 41, runtime_verified: false, database_applied: false, provider_generations: 0, limitations: ['AST and source provenance only; no operational database write, real inference, deployment or document approval', 'Every previous public/app route, domain handler coverage and historical stage fact is preserved; AI-36-C03 adds one candidate invoice-analysis adapter and a private Python pure parser route but does not publish tools or change HTTP routes'] };
  fs.writeFileSync(inventoryPath, bytes(inventory)); fs.writeFileSync(apiPath, bytes(api)); fs.writeFileSync(deltaPath, bytes(delta));
}
const inventory = read(inventoryPath), api = read(apiPath), delta = read(deltaPath);
verify(inventory, api);
assert.equal(hash(fs.readFileSync(inventoryPath)), delta.after_inventory_sha256);
assert.equal(hash(fs.readFileSync(apiPath)), delta.after_coordination_sha256);
assert.equal(hash(bytes(history(inventory))), delta.historical_stage_metadata_sha256);
console.log(JSON.stringify({ stage: 'AI-36-C03', mode, status: 'passed', counts: inventory.counts, source_hashes: inventory.sourceChecksums.length, coordination_routes: api.routes.length, domain_handler_coverage: 177, runtime_verified: false }));

