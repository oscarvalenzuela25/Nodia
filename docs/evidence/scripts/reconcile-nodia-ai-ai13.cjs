// AI13 reviewed runtime options/read pagination reconciliation; dry-run by default, no MCP publication.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../..');process.chdir(root);
const ts=require(root+'/nodia-server/node_modules/typescript');
const read=p=>fs.readFileSync(p,'utf8'),hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const inventoryPath='docs/mvp/nodia-ai-current-endpoints.json';
const inventory=JSON.parse(read(inventoryPath));
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
const httpKinds=new Map(['Get','Post','Put','Patch','Delete','Options','Head'].map(name=>[name,name.toUpperCase()]));
const literal=node=>!node?['']:ts.isStringLiteralLike(node)?[node.text]:ts.isArrayLiteralExpression(node)?node.elements.flatMap(literal):(()=>{throw Error('Nonliteral route '+node.getText())})();
const describeDecorators=(node,sf)=>decorators(node).filter(d=>ts.isCallExpression(d.expression)).map(d=>({name:d.expression.expression.getText(sf),args:[...d.expression.arguments].map(arg=>ts.isStringLiteralLike(arg)?arg.text:arg.getText(sf))}));
const currentControllers=[];
function scan(folder){for(const entry of fs.readdirSync(folder,{withFileTypes:true})){
  const file=path.posix.join(folder,entry.name);if(entry.isDirectory()){scan(file);continue;}if(!file.endsWith('.controller.ts'))continue;
  const sf=source(file),imports=localImports(file,sf);
  for(const cls of sf.statements.filter(ts.isClassDeclaration)){
    const decorator=decorators(cls).find(d=>ts.isCallExpression(d.expression)&&d.expression.expression.getText(sf)==='Controller');if(!decorator)continue;
    const bases=literal(decorator.expression.arguments[0]),dependencies=new Map(),operations=[];
    for(const ctor of cls.members.filter(ts.isConstructorDeclaration))for(const parameter of ctor.parameters){const type=parameter.type?.getText(sf);dependencies.set(parameter.name.getText(sf),{type,...(imports.has(type)?{file:imports.get(type).file}:{})});}
    for(const method of cls.members.filter(ts.isMethodDeclaration))for(const dec of decorators(method)){
      if(!ts.isCallExpression(dec.expression))continue;const kind=httpKinds.get(dec.expression.expression.getText(sf));if(!kind)continue;
      const operationId=cls.name.text+'.'+method.name.getText(sf);
      const inputs=method.parameters.map(parameter=>{const type=parameter.type?.getText(sf)||'unknown';const refs=[...new Set([...type.matchAll(/\b[A-Z][A-Za-z0-9_]*\b/g)].map(match=>match[0]))].filter(name=>imports.has(name));return {name:parameter.name.getText(sf),type,optional:!!parameter.questionToken,decorators:describeDecorators(parameter,sf),references:refs.map(name=>({name,file:imports.get(name).file}))};});
      const calls=[];function walk(node){if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)){const access=node.expression.expression;if(ts.isPropertyAccessExpression(access)&&access.expression.kind===ts.SyntaxKind.ThisKeyword&&dependencies.has(access.name.text))calls.push({property:access.name.text,method:node.expression.name.text,dependency:dependencies.get(access.name.text),line:sf.getLineAndCharacterOfPosition(node.getStart(sf)).line+1});}ts.forEachChild(node,walk);}walk(method);
      operations.push({operationId,method:kind,handler:method.name.getText(sf),line:sf.getLineAndCharacterOfPosition(method.getStart(sf)).line+1,paths:literal(dec.expression.arguments[0]).flatMap(route=>bases.map(base=>('/'+[inventory.prefix,base,route].join('/')).replace(/\/+/g,'/').replace(/\/$/,''))),summary:null,public:false,requireAction:null,metadata:describeDecorators(method,sf).filter(d=>!httpKinds.has(d.name)),inputs,calls,nodiaAiProposal:{category:'A',mutates:kind!=='GET',reason:'Authenticated conversation coordination; never a model-facing MCP domain tool.',implementedInNodiaAi:true}});
    }
    currentControllers.push({name:cls.name.text,file,line:sf.getLineAndCharacterOfPosition(cls.getStart(sf)).line+1,registered:registeredControllers.has(cls.name.text),bases,tags:['NodiaAI conversations'],classMetadata:[],operations,family:'NodiaAI — coordinación conversacional',proposedTargetModuleRoute:'/tools/nodia-ai'});
  }
}}
scan('nodia-server/src');
assert.equal(currentControllers.length,36);assert.equal(registeredControllers.size,36);
const currentOperations=currentControllers.flatMap(controller=>controller.operations),oldById=new Map(inventory.controllers.flatMap(controller=>controller.operations).map(operation=>[operation.operationId,operation]));
assert.equal(currentOperations.length,187);assert.equal(currentOperations.flatMap(operation=>operation.paths).length,306);
const coordination=currentControllers.find(controller=>controller.name==='NodiaAiConversationController');assert(coordination);assert.equal(coordination.operations.length,8);
for(const current of currentOperations){const old=oldById.get(current.operationId);if(old){assert.equal(current.method,old.method);assert.deepEqual([...current.paths].sort(),[...old.paths].sort());}else assert(current.operationId.startsWith('NodiaAiConnectionsController.'),'Unexpected handler '+current.operationId);}
for(const old of oldById.values())assert(currentOperations.some(current=>current.operationId===old.operationId),'Removed handler '+old.operationId);
const allowedDrift=/^nodia-server\/src\/(?:main\.ts|authorization\/authority-transaction\.ts|common\/filters\/all-exceptions\.filter\.ts|nodia-ai-worker(?:\.module)?\.ts|nodia-ai(?:-[^/]+)?\/)/;
const changes=inventory.sourceChecksums.flatMap(item=>hash(item.file)===item.sha256?[]:[{file:item.file,previousSha256:item.sha256,sha256:hash(item.file)}]);
for(const change of changes)assert(allowedDrift.test(change.file),'Unreviewed source drift '+change.file);
const candidateFiles=new Set([...modules.values()].map(module=>module.file));
for(const controller of coordination.operations){for(const input of controller.inputs)for(const ref of input.references)candidateFiles.add(ref.file);for(const call of controller.calls)if(call.dependency.file)candidateFiles.add(call.dependency.file);}
candidateFiles.add(coordination.file);
for(const file of ['nodia-server/src/common/filters/all-exceptions.filter.ts','nodia-server/src/nodia-ai-worker.ts','nodia-server/src/nodia-ai-worker.module.ts'])candidateFiles.add(file);
for(const folder of ['nodia-ai-conversation','nodia-ai-context','nodia-ai-adapter','nodia-ai-runtime']){
  function files(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.posix.join(dir,entry.name);if(entry.isDirectory())files(file);else if(file.endsWith('.ts')&&!/\.(?:spec|fixture)\.ts$/.test(file))candidateFiles.add(file);}}
  files('nodia-server/src/'+folder);
}
const additions=[...candidateFiles].filter(file=>!inventory.sourceChecksums.some(item=>item.file===file)).sort().map(file=>({file,sha256:hash(file)}));
const summary={task:'AI-13',status:process.argv.includes('--write')?'reconciled':'review_only',modules:modules.size,controllers:currentControllers.length,handlers:currentOperations.length,routes:306,changedSources:changes,addedSources:additions,coordinationOperations:currentControllers.filter(controller=>['NodiaAiConversationController','NodiaAiConnectionsController'].includes(controller.name)).flatMap(controller=>controller.operations.map(operation=>({operationId:operation.operationId,method:operation.method,paths:operation.paths})))};
if(process.argv.includes('--write')){
  for(const change of changes)inventory.sourceChecksums.find(item=>item.file===change.file).sha256=change.sha256;
  inventory.sourceChecksums.push(...additions);inventory.sourceChecksums.sort((left,right)=>left.file.localeCompare(right.file));
  const coordinators=currentControllers.filter(controller=>['NodiaAiConversationController','NodiaAiConnectionsController'].includes(controller.name));
  for(const current of coordinators){const index=inventory.controllers.findIndex(controller=>controller.name===current.name);if(index===-1)inventory.controllers.push(current);else inventory.controllers[index]=current;}
  inventory.controllers.sort((left,right)=>left.name.localeCompare(right.name));
  inventory.modules=[...modules.values()].sort((left,right)=>left.module.localeCompare(right.module));
  inventory.counts={...inventory.counts,controllerFiles:36,registeredControllers:36,unregisteredControllers:0,handlerOperations:187,httpMethodPathPairs:306,localModules:modules.size};
  inventory.familyCounts[coordination.family]={controllers:2,operations:10,httpRoutes:10};inventory.categoryCounts.A=16;
  inventory.referencedInputFiles=[...new Set([...inventory.referencedInputFiles,...coordinators.flatMap(controller=>controller.operations.flatMap(operation=>operation.inputs.flatMap(input=>input.references.map(ref=>ref.file))))])].sort();
  const prior=inventory.reconciliations.find(record=>record.task==='AI-13');
  const record={date:'2026-10-16',task:'AI-13',description:'Authorized configuration catalog and non-generative exact-selection eligibility; backward bounded latest message windows. Ten coordination routes remain separate from unchanged domain tool catalog, no automatic MCP attestation.',changedSources:changes,addedSources:additions};
  if(prior){record.changedSources=[...prior.changedSources.filter(item=>!changes.some(change=>change.file===item.file)),...changes.map(change=>({...change,previousSha256:prior.changedSources.find(item=>item.file===change.file)?.previousSha256??change.previousSha256}))];record.addedSources=[...prior.addedSources.filter(item=>!additions.some(addition=>addition.file===item.file)),...additions].map(item=>({...item,sha256:hash(item.file)}));inventory.reconciliations[inventory.reconciliations.indexOf(prior)]=record;}else inventory.reconciliations.push(record);
  fs.writeFileSync(inventoryPath,JSON.stringify(inventory,null,2)+'\n');
}
console.log(JSON.stringify(summary,null,2));
