const fs=require('node:fs'), crypto=require('node:crypto'), ts=require('../nodia-server/node_modules/typescript');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const write=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const common='docs/mvp/nodia-ai-v1-common-contracts.schema.json';
const schema=read(common);
schema.$defs.ProposalVersionQuery={type:'object',additionalProperties:false,properties:{revision:{$ref:'#/$defs/PositiveRevision'}}};
write(common,schema);
const apiPath='docs/mvp/nodia-ai-v1-coordination-api.json',api=read(apiPath);
api.dates.ai17='2026-10-16';
for(const route of api.routes.filter(r=>['GET','PATCH','POST'].includes(r.method)&&/^\/api\/v1\/nodia-ai\/proposals\/:id(?:\/cancel)?$/.test(r.path))){
  route.implemented=true;route.implementationPhase='AI-17';route.implementationScope='M2 native preparation and immutable revisions; human GET/PATCH/cancel only; no MCP prepare publication, confirmation or business execution';
  if(route.method==='GET')route.inputContract='ProposalVersionQuery';
}
write(apiPath,api);
const target='docs/mvp/nodia-ai-current-endpoints.json',inv=read(target);
const file='nodia-server/src/nodia-ai-proposal/nodia-ai-proposal.controller.ts',sf=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
const decs=n=>ts.canHaveDecorators(n)?ts.getDecorators(n)||[]:[], line=n=>sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1;
const vals=n=>n.arguments.map(a=>ts.isStringLiteral(a)?a.text:a.getText(sf));
const c=sf.statements.find(n=>ts.isClassDeclaration(n)&&n.name?.text==='NodiaAiProposalController');
const operations=c.members.filter(ts.isMethodDeclaration).map(m=>{
 const d=decs(m).find(d=>ts.isCallExpression(d.expression)&&['Get','Patch','Post'].includes(d.expression.expression.getText(sf)));
 const method=d.expression.expression.getText(sf).toUpperCase(),handler=m.name.getText(sf);
 return {operationId:c.name.text+'.'+handler,method,handler,line:line(d),paths:['/api/v1/nodia-ai/proposals/'+vals(d.expression)[0]],summary:null,public:false,requireAction:null,metadata:[{name:'Header',args:['Cache-Control','no-store']}],inputs:m.parameters.map(p=>({name:p.name.getText(sf),type:p.type?.getText(sf)||'unknown',optional:!!p.questionToken,decorators:decs(p).map(d=>({name:d.expression.expression.getText(sf),args:vals(d.expression)})),references:[]})),calls:[],nodiaAiProposal:{category:'A',mutates:method!=='GET',reason:'Human proposal coordination only, never confirms or executes business changes.',implementedInNodiaAi:true,implementationStage:'AI-17'}};
});
const controller={name:c.name.text,file,line:line(c),registered:true,bases:['nodia-ai/proposals'],tags:['NodiaAI proposals'],classMetadata:[],operations,family:'NodiaAI — coordinación conversacional',proposedTargetModuleRoute:'/tools/nodia-ai'};
inv.controllers=inv.controllers.filter(c=>c.name!==controller.name);inv.controllers.push(controller);inv.controllers.sort((a,b)=>a.name.localeCompare(b.name));
const moduleFile='nodia-server/src/nodia-ai-proposal/nodia-ai-proposal.module.ts';
inv.modules=inv.modules.filter(m=>m.module!=='NodiaAiProposalModule');
inv.modules.push({module:'NodiaAiProposalModule',file:moduleFile,line:30,controllers:[controller.name],imports:['NodiaAiAuthorizationModule','NodiaAiRuntimePolicyModule']});
for(const name of ['NodiaAiModule','NodiaAiObservationModule']){const m=inv.modules.find(m=>m.module===name);if(!m.imports.includes('NodiaAiProposalModule'))m.imports.push('NodiaAiProposalModule');}
Object.assign(inv.counts,{controllerFiles:inv.controllers.length,registeredControllers:inv.controllers.filter(c=>c.registered).length,handlerOperations:inv.controllers.flatMap(c=>c.operations).length,httpMethodPathPairs:inv.controllers.flatMap(c=>c.operations.flatMap(o=>o.paths)).length,localModules:inv.modules.length,staticallyComposedModules:inv.modules.filter(m=>!m.conditional).length});
for(const p of [file,moduleFile,...fs.readdirSync('nodia-server/src/nodia-ai-proposal/use-case').filter(f=>f.endsWith('.use-case.ts')).map(f=>'nodia-server/src/nodia-ai-proposal/use-case/'+f)])if(!inv.sourceChecksums.some(s=>s.file===p))inv.sourceChecksums.push({file:p,sha256:''});
for(const s of inv.sourceChecksums)s.sha256=crypto.createHash('sha256').update(fs.readFileSync(s.file)).digest('hex');
inv.ai17={date:'2026-10-16',scope:'AST current source M2 delta; runtime verification separate',newController:controller.name,newHandlers:operations.map(o=>o.operationId)};
write(target,inv);
console.log(JSON.stringify({counts:inv.counts,checksums:inv.sourceChecksums.length}));
