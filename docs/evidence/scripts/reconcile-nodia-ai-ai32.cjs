// AI-32 current inventory reconciliation; historical stage facts remain immutable.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../..');process.chdir(root);
const ts=require(path.join(root,'nodia-server/node_modules/typescript'));
const destination='docs/mvp/nodia-ai-current-endpoints.json';
const inv=JSON.parse(fs.readFileSync(destination,'utf8'));
const decorators=n=>ts.canHaveDecorators(n)?ts.getDecorators(n)||[]:[];
const decorator=(n,name,sf)=>decorators(n).find(d=>ts.isCallExpression(d.expression)&&d.expression.expression.getText(sf)===name)?.expression;
const values=(n,sf)=>n.arguments.map(a=>ts.isStringLiteralLike(a)?a.text:a.getText(sf));
const literals=n=>!n?['']:ts.isStringLiteralLike(n)?[n.text]:ts.isArrayLiteralExpression(n)?n.elements.flatMap(literals):(()=>{throw Error('Unresolved literal '+n.getText());})();
const kinds=new Map(['Get','Post','Put','Patch','Delete','Options','Head'].map(name=>[name,name.toUpperCase()]));
const controllers=[['nodia-server/src/nodia-ai-attachment/nodia-ai-attachment.controller.ts','NodiaAiAttachmentController']];
const historical=JSON.stringify(Object.fromEntries(Object.entries(inv).filter(([key])=>/^ai\d/.test(key)&&key!=='ai32')));
for(const [file,name]of controllers){
 const priorController=inv.controllers.find(item=>item.name===name);
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
  operations.push({operationId:name+'.'+method.name.getText(sf),method:kind,handler:method.name.getText(sf),line:line(dec),paths:bases.flatMap(base=>literals(dec.expression.arguments[0]).map(route=>('/'+[inv.prefix,base,route].join('/')).replace(/\/+/g,'/').replace(/\/$/,''))),summary:null,public:false,requireAction:null,metadata:decorators(method).filter(d=>ts.isCallExpression(d.expression)&&!kinds.has(d.expression.expression.getText(sf))).map(d=>({name:d.expression.expression.getText(sf),args:values(d.expression,sf)})),inputs:method.parameters.map(p=>({name:p.name.getText(sf),type:p.type?.getText(sf)||'unknown',optional:!!p.questionToken,decorators:decorators(p).map(d=>({name:d.expression.expression.getText(sf),args:values(d.expression,sf)})),references:[]})),calls,nodiaAiProposal:{category:'A',mutates:kind!=='GET',reason:'Authenticated private attachment coordination; never a model-facing MCP domain writer.',implementedInNodiaAi:true,implementationStage:'AI-32'}});
 }
 for(const op of operations){const previous=priorController?.operations.find(item=>item.operationId===op.operationId);if(previous)op.nodiaAiProposal=previous.nodiaAiProposal;}
 const tags=decorator(c,'ApiTags',sf);
 const result={name,file,line:line(c),registered:true,bases,tags:tags?values(tags,sf):[],classMetadata:decorators(c).filter(d=>ts.isCallExpression(d.expression)&&!['Controller','ApiTags'].includes(d.expression.expression.getText(sf))).map(d=>({name:d.expression.expression.getText(sf),args:values(d.expression,sf)})),operations,family:priorController?.family??'NodiaAI — coordinación conversacional',proposedTargetModuleRoute:priorController?.proposedTargetModuleRoute??'/tools/nodia-ai'};
 inv.controllers=inv.controllers.filter(item=>item.name!==name);inv.controllers.push(result);
}

const walk=folder=>fs.readdirSync(folder,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(folder+'/'+entry.name):[folder+'/'+entry.name]);
const production=walk('nodia-server/src').filter(file=>file.endsWith('.ts')&&!file.endsWith('.spec.ts'));
for(const file of production.filter(file=>file.endsWith('.module.ts'))){
 const sf=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
 for(const c of sf.statements.filter(ts.isClassDeclaration)){
  const d=decorator(c,'Module',sf);if(!d||!c.name)continue;const name=c.name.text;
  const previous=inv.modules.find(item=>item.module===name);
  if(!previous&&!name.startsWith('NodiaAi'))continue;
  const argument=d.arguments[0];
  const refs=key=>{const value=argument.properties.find(p=>p.name?.getText(sf)===key)?.initializer;return value&&ts.isArrayLiteralExpression(value)?value.elements.filter(ts.isIdentifier).map(n=>n.text):[];};
  inv.modules=inv.modules.filter(item=>item.module!==name);inv.modules.push({...previous,module:name,file,line:sf.getLineAndCharacterOfPosition(c.getStart(sf)).line+1,controllers:refs('controllers'),imports:refs('imports')});
 }
}
inv.controllers.sort((a,b)=>a.name.localeCompare(b.name));inv.modules.sort((a,b)=>a.module.localeCompare(b.module));
const handlers=inv.controllers.flatMap(c=>c.operations);
Object.assign(inv.counts,{controllerFiles:inv.controllers.length,registeredControllers:inv.controllers.filter(c=>c.registered).length,unregisteredControllers:inv.controllers.filter(c=>!c.registered).length,handlerOperations:handlers.length,httpMethodPathPairs:handlers.flatMap(h=>h.paths).length,localModules:inv.modules.length,staticallyComposedModules:inv.modules.filter(m=>!m.conditional).length,conditionalModules:inv.modules.filter(m=>m.conditional).length});
inv.categoryCounts={};for(const h of handlers){const category=h.nodiaAiProposal.category;inv.categoryCounts[category]=(inv.categoryCounts[category]||0)+1;}
const added=production.filter(file=>file.includes('/nodia-ai-')||file.includes('/common/storage/')||file.includes('/migrations/1792800000000-'));
added.push('nodia-server/src/nodia-ai-attachment/config/attachment-contract.schema.json');
inv.sourceChecksums=[...new Set([...inv.sourceChecksums.map(s=>s.file),...added])].sort().map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
inv.ai32={date:'2026-10-17',scope:'Private durable attachments, reviewed interpretation/native modality gates, local voice capture, generation-owned cleanup and independent invoice file staging; runtime proof separate',newControllers:['NodiaAiAttachmentController'],newHandlers:handlers.filter(h=>h.operationId.startsWith('NodiaAiAttachmentController.')).map(h=>h.operationId),databaseMigrations:1,newTables:['nodia_ai_attachments'],newColumns:['nodia_ai_message_parts.attachment_id'],changedColumns:['nodia_ai_message_parts.text nullable with reviewed snapshot'],mcpCatalogCeiling:74,publishedBusinessToolsAdded:0};
if(historical!==JSON.stringify(Object.fromEntries(Object.entries(inv).filter(([key])=>/^ai\d/.test(key)&&key!=='ai32'))))throw Error('Historical stage inventory changed');
fs.writeFileSync(destination,JSON.stringify(inv,null,2)+'\n');
console.log(JSON.stringify({counts:inv.counts,checksums:inv.sourceChecksums.length,ai32:inv.ai32}));
