// Reviewed AI-09 module-only reconciliation. Dry-run by default; no tool publication.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..');
process.chdir(root);
const ts = require(root + '/nodia-server/node_modules/typescript');
const read = p => fs.readFileSync(p, 'utf8');
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const inventoryPath = 'docs/mvp/nodia-ai-current-endpoints.json';
const notePath = 'docs/mvp/39-nodia-ai-current-capabilities-inventory.md';
const inventory = JSON.parse(read(inventoryPath));
const additions = [
  ['NodiaAiAuthorizationModule', 'nodia-server/src/nodia-ai/nodia-ai-authorization.module.ts'],
  ['NodiaAiConversationModule', 'nodia-server/src/nodia-ai-conversation/nodia-ai-conversation.module.ts'],
  ['NodiaAiRunModule', 'nodia-server/src/nodia-ai-run/nodia-ai-run.module.ts'],
  ['NodiaAiRuntimeModule', 'nodia-server/src/nodia-ai-runtime/nodia-ai-runtime.module.ts'],
];
const decorators = n => ts.canHaveDecorators(n) ? ts.getDecorators(n) || [] : [];
const sources = new Map();
function source(file) {
  if (!sources.has(file)) sources.set(file, ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true));
  return sources.get(file);
}
function localImports(file, sf) {
  const result = new Map();
  for (const node of sf.statements.filter(ts.isImportDeclaration)) {
    const location = node.moduleSpecifier.text;
    if (!location.startsWith('.')) continue;
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), location.replace(/\.js$/, '.ts')));
    for (const item of node.importClause?.namedBindings?.elements || []) {
      result.set(item.name.text, { file: target, name: item.propertyName?.text || item.name.text });
    }
  }
  return result;
}
const modules = new Map();
const registeredControllers = new Set();
function visit(file, name) {
  if (modules.has(name)) return;
  const sf = source(file);
  const cls = sf.statements.find(n => ts.isClassDeclaration(n) && n.name?.text === name);
  assert(cls, 'Missing class ' + name);
  const moduleDecorator = decorators(cls).find(d => ts.isCallExpression(d.expression) && d.expression.expression.getText(sf) === 'Module');
  assert(moduleDecorator, 'Not a Nest module ' + name);
  const metadata = moduleDecorator.expression.arguments[0];
  assert(ts.isObjectLiteralExpression(metadata), 'Unsupported module metadata ' + name);
  const fields = new Map(metadata.properties.filter(ts.isPropertyAssignment).map(p => [p.name.getText(sf), p.initializer]));
  const imported = localImports(file, sf);
  const record = { module: name, file, line: sf.getLineAndCharacterOfPosition(cls.getStart(sf)).line + 1, controllers: [], imports: [] };
  modules.set(name, record);
  for (const field of ['controllers', 'imports']) {
    const values = fields.get(field);
    if (!values) continue;
    assert(ts.isArrayLiteralExpression(values), 'Unsupported module array ' + name + '.' + field);
    for (const item of values.elements) {
      // forRoot/forFeature belongs to library composition, not a local Nest module.
      if (ts.isCallExpression(item)) continue;
      assert(ts.isIdentifier(item), 'Unsupported module member ' + item.getText(sf));
      if (field === 'controllers') {
        assert(imported.has(item.text), 'Missing local controller import ' + item.text);
        record.controllers.push(item.text);
        registeredControllers.add(item.text);
      } else if (imported.has(item.text)) {
        record.imports.push(item.text);
        const target = imported.get(item.text);
        visit(target.file, target.name);
      }
    }
  }
}
visit('nodia-server/src/app.module.ts', 'AppModule');
assert.equal(modules.size, 42, 'Unexpected reachable module count');
assert.deepEqual([...registeredControllers].sort(), inventory.controllers.map(c => c.name).sort());
for (const [name, file] of additions) {
  assert.equal(modules.get(name)?.file, file);
  assert.equal(modules.get(name).controllers.length, 0, 'AI-09 must not expose a controller');
}
assert.deepEqual(modules.get('NodiaAiModule').imports.sort(), additions.map(a => a[0]).sort());

// Re-read every controller route from AST: a module-only change cannot hide a new endpoint.
const methods = new Map(['Get','Post','Put','Patch','Delete','Options','Head'].map(k => [k, k.toUpperCase()]));
const literal = node => !node ? [''] : ts.isStringLiteralLike(node) ? [node.text]
  : ts.isArrayLiteralExpression(node) ? node.elements.flatMap(literal)
    : (() => { throw Error('Nonliteral route ' + node.getText()); })();
const controllers = [];
function scan(folder) {
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const file = path.posix.join(folder, entry.name);
    if (entry.isDirectory()) scan(file);
    else if (file.endsWith('.controller.ts')) {
      const sf = source(file);
      for (const cls of sf.statements.filter(ts.isClassDeclaration)) {
        const decorator = decorators(cls).find(d => ts.isCallExpression(d.expression) && d.expression.expression.getText(sf) === 'Controller');
        if (!decorator) continue;
        const bases = literal(decorator.expression.arguments[0]);
        const operations = [];
        for (const method of cls.members.filter(ts.isMethodDeclaration)) for (const d of decorators(method)) {
          if (!ts.isCallExpression(d.expression)) continue;
          const kind = methods.get(d.expression.expression.getText(sf));
          if (!kind) continue;
          operations.push({ operationId: cls.name.text + '.' + method.name.getText(sf), method: kind,
            paths: literal(d.expression.arguments[0]).flatMap(p => bases.map(b => ('/' + [inventory.prefix,b,p].join('/')).replace(/\/+/g, '/').replace(/\/$/, ''))) });
        }
        controllers.push({ name: cls.name.text, operations });
      }
    }
  }
}
scan('nodia-server/src');
assert.equal(controllers.length, 34);
const operations = controllers.flatMap(c => c.operations);
assert.equal(operations.length, 177);
assert.equal(operations.flatMap(o => o.paths).length, 296);
const oldOperations = new Map(inventory.controllers.flatMap(c => c.operations).map(o => [o.operationId, o]));
for (const operation of operations) {
  const previous = oldOperations.get(operation.operationId);
  assert(previous, 'New handler ' + operation.operationId);
  assert.equal(operation.method, previous.method);
  assert.deepEqual([...operation.paths].sort(), [...previous.paths].sort());
}
const changes = inventory.sourceChecksums.flatMap(s => hash(s.file) === s.sha256 ? [] : [{file:s.file,previousSha256:s.sha256,sha256:hash(s.file)}]);
for (const change of changes) assert.equal(change.file, 'nodia-server/src/nodia-ai/nodia-ai.module.ts', 'Unreviewed inventory drift ' + change.file);
const prior = inventory.reconciliations.find(r => r.task === 'AI-09');
if (prior) {
  assert.equal(changes.length, 0, 'AI-09 source changed after reconciliation');
  for (const [, file] of additions) assert(inventory.sourceChecksums.some(s => s.file === file && s.sha256 === hash(file)));
  console.log(JSON.stringify({task:'AI-09',status:'already_reconciled',modules:modules.size,sources:inventory.sourceChecksums.length}));
  process.exit(0);
}
const summary = {task:'AI-09',status:process.argv.includes('--write')?'reconciled':'review_only',modules:modules.size,
  controllers:controllers.length,handlers:operations.length,routes:296,changedSources:changes,
  addedSources:additions.map(([module,file]) => ({module,file,line:modules.get(module).line,sha256:hash(file)})),
  moduleChanges:[...modules.values()].filter(m => !inventory.modules.some(p => p.module === m.module && JSON.stringify(p) === JSON.stringify(m)))};
if (process.argv.includes('--write')) {
  for (const change of changes) inventory.sourceChecksums.find(s => s.file === change.file).sha256 = change.sha256;
  for (const [, file] of additions) inventory.sourceChecksums.push({file,sha256:hash(file)});
  inventory.sourceChecksums.sort((a,b) => a.file.localeCompare(b.file));
  inventory.modules = [...modules.values()].sort((a,b) => a.module.localeCompare(b.module));
  inventory.counts.localModules = modules.size;
  inventory.reconciliations.push({date:'2026-10-15',task:'AI-09',description:'Four controller-free local modules separate shared authorization, conversation, run and runtime persistence. Existing 34 controllers, 177 handlers and 296 routes unchanged; no chat endpoint, assignment, inference or MCP tool published.',
    changedSources:changes,addedSources:summary.addedSources,moduleChanges:summary.moduleChanges});
  const note = `Actualización AI-09 del 2026-10-15: [persistencia55](55-nodia-ai-ai09-conversation-persistence.md) incorpora cuatro módulos internos sin controlador —autorización compartida, conversación, run y runtime—, alcanzables desde AppModule mediante el host NodiaAI. La revisión AST registra **42 módulos locales y ${inventory.sourceChecksums.length} fuentes comprobadas**, con imports, líneas y hashes anteriores/nuevos; conserva **34 controladores, 177 handlers y 296 rutas**. No añade endpoints de chat ni publica herramientas MCP. Las estructuras M1 son soporte interno; admisión y consulta HTTP continúan en AI-10.\n\n`;
  const original = read(notePath);
  assert(!original.includes('Actualización AI-09'), 'Duplicate AI-09 inventory note');
  fs.writeFileSync(notePath, original.replace('Nodia Server declara', note + 'Nodia Server declara'));
  fs.writeFileSync(inventoryPath, JSON.stringify(inventory,null,2) + '\n');
}
console.log(JSON.stringify(summary,null,2));
