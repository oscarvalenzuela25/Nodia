// Refresh the current AST snapshot only. Never edits historical AI-17 evidence.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),ts=require('../nodia-server/node_modules/typescript');
const destination='docs/mvp/nodia-ai-current-endpoints.json';
const inv=JSON.parse(fs.readFileSync(destination,'utf8'));
const decorators=n=>ts.canHaveDecorators(n)?ts.getDecorators(n)||[]:[];
const decorator=(n,name,sf)=>decorators(n).find(d=>ts.isCallExpression(d.expression)&&d.expression.expression.getText(sf)===name)?.expression;
const values=(n,sf)=>n.arguments.map(a=>ts.isStringLiteralLike(a)?a.text:a.getText(sf));
const literals=n=>!n?['']:ts.isStringLiteralLike(n)?[n.text]:ts.isArrayLiteralExpression(n)?n.elements.flatMap(literals):(()=>{throw Error('Unresolved literal '+n.getText());})();
const kinds=new Map(['Get','Post','Put','Patch','Delete','Options','Head'].map(name=>[name,name.toUpperCase()]));
const controllers=[['nodia-server/src/nodia-ai-confirmation/nodia-ai-operation.controller.ts','NodiaAiOperationController']];
for(const [file,name]of controllers){
 const sf=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
 const c=sf.statements.find(n=>ts.isClassDeclaration(n)&&n.name?.text===name),line=n=>sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1;
 if(!c)throw Error('Missing controller '+name);
 const bases=literals(decorator(c,'Controller',sf).arguments[0]);
 const constructor=c.members.find(ts.isConstructorDeclaration);
 const imports=new Map();
 for(const item of sf.statements.filter(ts.isImportDeclaration))for(const e of item.importClause?.namedBindings?.elements??[])imports.set(e.name.text,item.moduleSpecifier.text);
 const dependencies=new Map((constructor?.parameters??[]).map(p=>[p.name.getText(sf),p.type.getText(sf)]));
 const operations=[];
 for(const method of c.members.filter(ts.isMethodDeclaration))for(const dec of decorators(method)){
  if(!ts.isCallExpression(dec.expression)||!kinds.has(dec.expression.expression.getText(sf)))continue;
  const kind=kinds.get(dec.expression.expression.getText(sf));
  const calls=[];
  const scan=n=>{
   if(ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&ts.isPropertyAccessExpression(n.expression.expression)&&n.expression.expression.expression.kind===ts.SyntaxKind.ThisKeyword){
    const property=n.expression.expression.name.text,type=dependencies.get(property),source=imports.get(type);
    if(type&&source)calls.push({property,method:n.expression.name.text,dependency:{type,file:path.posix.normalize(path.posix.join(path.posix.dirname(file),source.replace(/\.js$/,'.ts')))},line:line(n)});
   }
   ts.forEachChild(n,scan);
  };scan(method);
  operations.push({operationId:name+'.'+method.name.getText(sf),method:kind,handler:method.name.getText(sf),line:line(dec),paths:literals(dec.expression.arguments[0]).flatMap(route=>bases.map(base=>('/'+[inv.prefix,base,route].join('/')).replace(/\/+/g,'/').replace(/\/$/,''))),summary:null,public:false,requireAction:null,metadata:decorators(method).filter(d=>ts.isCallExpression(d.expression)&&!kinds.has(d.expression.expression.getText(sf))).map(d=>({name:d.expression.expression.getText(sf),args:values(d.expression,sf)})),inputs:method.parameters.map(p=>({name:p.name.getText(sf),type:p.type?.getText(sf)||'unknown',optional:!!p.questionToken,decorators:decorators(p).map(d=>({name:d.expression.expression.getText(sf),args:values(d.expression,sf)})),references:[]})),calls,nodiaAiProposal:{category:'A',mutates:kind!=='GET',reason:'Human execution observation, cancellation and explicit resume; native effect runs only in its fenced worker.',implementedInNodiaAi:true,implementationStage:'AI-20'}});
 }
 const tags=decorator(c,'ApiTags',sf);
 const result={name,file,line:line(c),registered:true,bases,tags:tags?values(tags,sf):[],classMetadata:[],operations,family:'NodiaAI — coordinación conversacional',proposedTargetModuleRoute:'/tools/nodia-ai'};
 inv.controllers=inv.controllers.filter(item=>item.name!==name);inv.controllers.push(result);
}
for(const [file,name]of [
 ['nodia-server/src/nodia-ai-confirmation/nodia-ai-confirmation.module.ts','NodiaAiConfirmationModule'],
 ['nodia-server/src/nodia-ai-proposal-review/nodia-ai-proposal-review.module.ts','NodiaAiProposalReviewModule'],
 ['nodia-server/src/nodia-ai/nodia-ai.module.ts','NodiaAiModule'],
 ['nodia-server/src/nodia-ai-proposal/nodia-ai-proposal.module.ts','NodiaAiProposalModule'],
 ['nodia-server/src/nodia-ai-execution/nodia-ai-execution.module.ts','NodiaAiExecutionModule'],
 ['nodia-server/src/nodia-ai-worker.module.ts','NodiaAiWorkerModule'],
 ['nodia-server/src/nodia-ai-runtime/nodia-ai-runtime.module.ts','NodiaAiRuntimeModule'],
]){
 const sf=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true),c=sf.statements.find(n=>ts.isClassDeclaration(n)&&n.name?.text===name);
 const argument=decorator(c,'Module',sf).arguments[0];
 const property=key=>argument.properties.find(p=>p.name?.getText(sf)===key)?.initializer;
 const refs=key=>{const value=property(key);return value&&ts.isArrayLiteralExpression(value)?value.elements.filter(ts.isIdentifier).map(n=>n.text):[];};
 const previous=inv.modules.find(item=>item.module===name);
 const result={...previous,module:name,file,line:sf.getLineAndCharacterOfPosition(c.getStart(sf)).line+1,controllers:refs('controllers'),imports:refs('imports')};
 inv.modules=inv.modules.filter(item=>item.module!==name);inv.modules.push(result);
}
inv.controllers.sort((a,b)=>a.name.localeCompare(b.name));inv.modules.sort((a,b)=>a.module.localeCompare(b.module));
const handlers=inv.controllers.flatMap(c=>c.operations);
Object.assign(inv.counts,{controllerFiles:inv.controllers.length,registeredControllers:inv.controllers.filter(c=>c.registered).length,unregisteredControllers:inv.controllers.filter(c=>!c.registered).length,handlerOperations:handlers.length,httpMethodPathPairs:handlers.flatMap(h=>h.paths).length,localModules:inv.modules.length,staticallyComposedModules:inv.modules.filter(m=>!m.conditional).length,conditionalModules:inv.modules.filter(m=>m.conditional).length});
inv.categoryCounts={};for(const h of handlers){const category=h.nodiaAiProposal.category;inv.categoryCounts[category]=(inv.categoryCounts[category]||0)+1;}
const files=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(dir+'/'+entry.name):[dir+'/'+entry.name]);
const added=[...files('nodia-server/src/nodia-ai-confirmation'),...files('nodia-server/src/nodia-ai-proposal-review'),...files('nodia-server/src/nodia-ai-execution')].filter(file=>file.endsWith('.ts')&&!file.endsWith('.spec.ts'));
added.push('nodia-server/src/nodia-ai-run/event-journal.ts','nodia-server/src/nodia-ai-run/entities/nodia-ai-event.entity.ts','nodia-server/src/nodia-ai-runtime/entities/nodia-ai-job.entity.ts','nodia-server/src/nodia-ai-runtime/entities/nodia-ai-execution-grant.entity.ts','nodia-server/src/migrations/1792500000000-CreateNodiaAiConfirmationPersistence.ts');
inv.sourceChecksums=[...new Set([...inv.sourceChecksums.map(s=>s.file),...added])].sort().map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
inv.ai20={date:'2026-10-17',scope:'Current AST local execution worker and human controls; runtime evidence separate',newControllers:controllers.map(([_,name])=>name),newHandlers:inv.controllers.filter(c=>controllers.some(([_,name])=>name===c.name)).flatMap(c=>c.operations.map(o=>o.operationId))};
fs.writeFileSync(destination,JSON.stringify(inv,null,2)+'\n');
console.log(JSON.stringify({counts:inv.counts,checksums:inv.sourceChecksums.length,ai18:inv.ai20}));
