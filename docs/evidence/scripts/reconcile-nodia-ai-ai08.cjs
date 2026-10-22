// One-time, reviewed AI-08 source/signature reconciliation; does not publish tools.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..'); process.chdir(root);
const ts = require(root + '/nodia-server/node_modules/typescript');
const read = p => fs.readFileSync(p, 'utf8'), json = p => JSON.parse(read(p));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const inventoryPath = 'docs/mvp/nodia-ai-current-endpoints.json', catalogPath = 'docs/mvp/nodia-ai-v1-tool-catalog.json';
const inventory = json(inventoryPath), catalog = json(catalogPath);
if (inventory.reconciliations.some(r => r.task === 'AI-08')) {
  for (const source of inventory.sourceChecksums) assert.equal(hash(source.file), source.sha256, source.file);
  console.log(JSON.stringify({task:'AI-08',status:'already_reconciled',sources:inventory.sourceChecksums.length}));
  process.exit(0);
}
assert(process.argv.includes('--write'), 'Review AI-08 changes before --write');
const decorators = n => ts.canHaveDecorators(n) ? ts.getDecorators(n) || [] : [];
const dec = (n, sf) => decorators(n).map(d => ({name:d.expression.expression?.getText(sf), args:[...(d.expression.arguments || [])].map(a => ts.isStringLiteralLike(a) ? a.text : a.getText(sf))}));
const literal = n => !n ? [''] : ts.isStringLiteralLike(n) ? [n.text] : ts.isArrayLiteralExpression(n) ? n.elements.flatMap(literal) : (()=>{throw Error('Nonliteral route')})();
const changes = [], lines = new Map(), byId = new Map();
for (const controller of inventory.controllers) {
  const sf = ts.createSourceFile(controller.file, read(controller.file), ts.ScriptTarget.Latest, true);
  const cls = sf.statements.find(n => ts.isClassDeclaration(n) && n.name.text === controller.name); assert(cls);
  controller.line = sf.getLineAndCharacterOfPosition(cls.getStart(sf)).line + 1;
  const imports = new Map();
  for (const n of sf.statements.filter(ts.isImportDeclaration)) for (const e of n.importClause?.namedBindings?.elements || []) {
    const f = path.posix.normalize(path.posix.join(path.posix.dirname(controller.file), n.moduleSpecifier.text.replace(/\.js$/, '.ts')));
    if (fs.existsSync(f)) imports.set(e.name.text, f);
  }
  const dependencies = new Map();
  for (const ctor of cls.members.filter(ts.isConstructorDeclaration)) for (const p of ctor.parameters) {
    const type = p.type?.getText(sf); dependencies.set(p.name.getText(sf), {type, ...(imports.has(type) ? {file:imports.get(type)} : {})});
  }
  const methods = cls.members.filter(ts.isMethodDeclaration);
  assert.equal(methods.filter(n => dec(n,sf).some(d => ['Get','Post','Put','Patch','Delete','Head','Options'].includes(d.name))).length, controller.operations.length);
  for (const op of controller.operations) {
    const node = methods.find(n => n.name.getText(sf) === op.handler); assert(node);
    const route = decorators(node).find(d => d.expression.expression?.getText(sf).toUpperCase() === op.method); assert(route);
    const paths = controller.bases.flatMap(base => literal(route.expression.arguments[0]).map(segment => ['/api/v1',base,segment].filter(Boolean).join('/')));
    assert.deepEqual(paths.sort(), [...op.paths].sort(), op.operationId);
    const old = op.line; op.line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
    lines.set(controller.file + '#L' + old, controller.file + '#L' + op.line);
    op.inputs = node.parameters.map(p => {
      const type = p.type?.getText(sf) || 'any', refs = [...new Set([...type.matchAll(/\b[A-Z][A-Za-z0-9_]*\b/g)].map(m=>m[0]))].filter(n=>imports.has(n));
      return {name:p.name.getText(sf),type,optional:!!p.questionToken,decorators:dec(p,sf),references:refs.map(name=>({name,file:imports.get(name)}))};
    });
    op.calls = [];
    function walk(n) { if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
      const a = n.expression.expression;
      if (ts.isPropertyAccessExpression(a) && a.expression.kind === ts.SyntaxKind.ThisKeyword && dependencies.has(a.name.text)) op.calls.push({property:a.name.text,method:n.expression.name.text,dependency:dependencies.get(a.name.text),line:sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1});
    } ts.forEachChild(n,walk); } walk(node);
    byId.set(op.operationId, op);
  }
}
assert.equal(byId.size,177);
for (const mod of inventory.modules) {
  const sf=ts.createSourceFile(mod.file,read(mod.file),ts.ScriptTarget.Latest,true), node=sf.statements.find(n=>ts.isClassDeclaration(n)&&n.name?.text===mod.module); assert(node);
  mod.line=sf.getLineAndCharacterOfPosition(node.getStart(sf)).line+1;
}
for (const t of catalog.domainTools) for (const b of t.backendBindings) {const op=byId.get(b.operationId); b.controllerLine=op.line;b.delegates=op.calls;}
const allowed=/^nodia-server\/src\/(action|module|module-group|role|user|auth|finance-[^/]+|rental-[^/]+|nodia-ai|authorization)\//;
for (const s of inventory.sourceChecksums) {const next=hash(s.file); if(next!==s.sha256) {assert(allowed.test(s.file), 'Unreviewed source '+s.file); changes.push({file:s.file,previousSha256:s.sha256,sha256:next});s.sha256=next;}}
const added = ['nodia-server/src/authorization/authority-transaction.ts','nodia-server/src/finance-common/dto/finance-owner-query.dto.ts','nodia-server/src/nodia-ai/use-case/execute-authorized-nodia-ai.use-case.ts',...['user','role','module','module-group','action'].map(p=>`nodia-server/src/${p}/use-case/save-${p}.use-case.ts`)];
for(const file of added) if(!inventory.sourceChecksums.some(s=>s.file===file)) inventory.sourceChecksums.push({file,sha256:hash(file)});
inventory.sourceChecksums.sort((a,b)=>a.file.localeCompare(b.file));
for(const c of inventory.controllers) for(const op of c.operations) for(const input of op.inputs) for(const ref of input.references) if(!inventory.referencedInputFiles.includes(ref.file)) inventory.referencedInputFiles.push(ref.file);
inventory.referencedInputFiles.sort();
inventory.reconciliations.push({date:'2026-10-15',task:'AI-08',description:'Reviewed actor/session propagation, explicit owner query/body for create-property, shared transactional invariants and module providers. Same 34 controllers, 177 handlers, 296 routes and 38 modules; no tool publication. Signature/delegate lines refreshed from AST.',changedSources:changes,addedSources:added});
for(const p of ['docs/mvp/39-nodia-ai-current-capabilities-inventory.md','docs/mvp/40-nodia-ai-tool-catalog-v1.md']){let s=read(p);s=s.replace(/nodia-server\/src\/[^\s)]+\.ts#L\d+/g,m=>lines.get(m)||m);fs.writeFileSync(p,s);}
fs.writeFileSync(inventoryPath,JSON.stringify(inventory,null,2)+'\n');fs.writeFileSync(catalogPath,JSON.stringify(catalog,null,2)+'\n');
console.log(JSON.stringify({task:'AI-08',reviewedChangedSources:changes.length,sources:inventory.sourceChecksums.length,handlers:byId.size}));
