// AI-29 refresh of current AST and human flow provenance only. Never edits historical stage evidence.
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
const controllers=[['nodia-server/src/nodia-ai-secure-flow/nodia-ai-secure-flow.controller.ts','NodiaAiSecureFlowController'],['nodia-server/src/ai-provider/ai-api-key.controller.ts','AiApiKeyController'],['nodia-server/src/nodia-ai-confirmation/nodia-ai-operation.controller.ts','NodiaAiOperationController'],['nodia-server/src/business-action/business-action.controller.ts','BusinessActionController'],['nodia-server/src/ai-provider/ai-provider.controller.ts','AiProviderController']];
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
  operations.push({operationId:name+'.'+method.name.getText(sf),method:kind,handler:method.name.getText(sf),line:line(dec),paths:bases.flatMap(base=>literals(dec.expression.arguments[0]).map(route=>('/'+[inv.prefix,base,route].join('/')).replace(/\/+/g,'/').replace(/\/$/,''))),summary:null,public:false,requireAction:null,metadata:decorators(method).filter(d=>ts.isCallExpression(d.expression)&&!kinds.has(d.expression.expression.getText(sf))).map(d=>({name:d.expression.expression.getText(sf),args:values(d.expression,sf)})),inputs:method.parameters.map(p=>({name:p.name.getText(sf),type:p.type?.getText(sf)||'unknown',optional:!!p.questionToken,decorators:decorators(p).map(d=>({name:d.expression.expression.getText(sf),args:values(d.expression,sf)})),references:[]})),calls,nodiaAiProposal:{category:'A',mutates:kind!=='GET',reason:'Human execution observation, cancellation and explicit resume; native effect runs only in its fenced worker.',implementedInNodiaAi:true,implementationStage:'AI-20'}});
 }
 for(const op of operations){const previous=priorController?.operations.find(item=>item.operationId===op.operationId);if(previous)op.nodiaAiProposal=previous.nodiaAiProposal;}
 const tags=decorator(c,'ApiTags',sf);
 const result={name,file,line:line(c),registered:true,bases,tags:tags?values(tags,sf):[],classMetadata:decorators(c).filter(d=>ts.isCallExpression(d.expression)&&!['Controller','ApiTags'].includes(d.expression.expression.getText(sf))).map(d=>({name:d.expression.expression.getText(sf),args:values(d.expression,sf)})),operations,family:priorController?.family??'NodiaAI — coordinación conversacional',proposedTargetModuleRoute:priorController?.proposedTargetModuleRoute??'/tools/nodia-ai'};
 inv.controllers=inv.controllers.filter(item=>item.name!==name);inv.controllers.push(result);
}
for(const [file,name]of [
 ['nodia-server/src/nodia-ai-execution/nodia-ai-execution-store.module.ts','NodiaAiExecutionStoreModule'],
 ['nodia-server/src/nodia-ai-secure-flow/nodia-ai-secure-flow.module.ts','NodiaAiSecureFlowModule'],
 ['nodia-server/src/nodia-ai-secure-preparation/nodia-ai-secure-preparation.module.ts','NodiaAiSecurePreparationModule'],
 ['nodia-server/src/auth/auth-session-revocation.module.ts','AuthSessionRevocationModule'],
 ['nodia-server/src/auth/auth.module.ts','AuthModule'],
 ['nodia-server/src/nodia-ai-native-effect/nodia-ai-native-effect.module.ts','NodiaAiNativeEffectModule'],
 ['nodia-server/src/nodia-ai-business-catalog/nodia-ai-business-catalog.module.ts','NodiaAiBusinessCatalogModule'],
 ['nodia-server/src/nodia-ai-supplier-operations/nodia-ai-supplier-operations.module.ts','NodiaAiSupplierOperationsModule'],
 ['nodia-server/src/nodia-ai-invoice-operations/nodia-ai-invoice-operations.module.ts','NodiaAiInvoiceOperationsModule'],
 ['nodia-server/src/nodia-ai-rental-configuration/nodia-ai-rental-configuration.module.ts','NodiaAiRentalConfigurationModule'],
 ['nodia-server/src/nodia-ai-rental-reservation/nodia-ai-rental-reservation.module.ts','NodiaAiRentalReservationModule'],
 ['nodia-server/src/nodia-ai-rental-money/nodia-ai-rental-money.module.ts','NodiaAiRentalMoneyModule'],
 ['nodia-server/src/nodia-ai-rental-operations/nodia-ai-rental-operations.module.ts','NodiaAiRentalOperationsModule'],
 ['nodia-server/src/nodia-ai-core-operations/nodia-ai-core-operations.module.ts','NodiaAiCoreOperationsModule'],
 ['nodia-server/src/nodia-ai-provider-operations/nodia-ai-provider-operations.module.ts','NodiaAiProviderOperationsModule'],
 ['nodia-server/src/ai-provider/ai-provider.module.ts','AiProviderModule'],
 ['nodia-server/src/business-action/business-action.module.ts','BusinessActionModule'],
 ['nodia-server/src/invoice/invoice-persistence.module.ts','InvoicePersistenceModule'],
 ['nodia-server/src/invoice/invoice.module.ts','InvoiceModule'],
 ['nodia-server/src/nodia-ai-finance-catalog/nodia-ai-finance-catalog.module.ts','NodiaAiFinanceCatalogModule'],
 ['nodia-server/src/nodia-ai-finance-ledger/nodia-ai-finance-ledger.module.ts','NodiaAiFinanceLedgerModule'],
 ['nodia-server/src/nodia-ai-finance-effect/nodia-ai-finance-effect.module.ts','NodiaAiFinanceEffectModule'],
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
const added=[...files('nodia-server/src/nodia-ai-confirmation'),...files('nodia-server/src/nodia-ai-proposal-review'),...files('nodia-server/src/nodia-ai-execution'),...files('nodia-server/src/nodia-ai-finance-catalog'),...files('nodia-server/src/nodia-ai-finance-ledger'),...files('nodia-server/src/nodia-ai-finance-effect')].filter(file=>file.endsWith('.ts')&&!file.endsWith('.spec.ts'));
added.push(...files('nodia-server/src/common/ai/codex').filter(file=>file.endsWith('.ts')&&!file.endsWith('.spec.ts')), 'nodia-server/src/common/ai/gemini.service.ts');
added.push('nodia-server/src/nodia-ai-run/event-journal.ts','nodia-server/src/nodia-ai-run/entities/nodia-ai-event.entity.ts','nodia-server/src/nodia-ai-runtime/entities/nodia-ai-job.entity.ts','nodia-server/src/nodia-ai-runtime/entities/nodia-ai-execution-grant.entity.ts','nodia-server/src/migrations/1792500000000-CreateNodiaAiConfirmationPersistence.ts');
added.push('nodia-server/src/finance-movement/use-case/resolve-finance-movement-update.ts');
added.push('nodia-server/src/migrations/1792700000000-AddNodiaAiWorkflowBindings.ts');
for(const dir of ['nodia-ai-secure-flow','nodia-ai-secure-preparation','auth','ai-provider','nodia-ai-provider-operations','authorization','user','role','action','module','module-group','business-action','nodia-ai-core-operations','nodia-ai-native-effect','nodia-ai-business-catalog','nodia-ai-supplier-operations','nodia-ai-invoice-operations','nodia-ai-proposal','nodia-ai-rental-configuration','nodia-ai-rental-reservation','nodia-ai-rental-money','nodia-ai-rental-operations','rental-payment','rental-expense','rental-block','rental-turnover','rental-reservation','rental-property','rental-collaborator','rental-cancellation-policy','rental-common','business','provider','provider-contact','product','invoice']) added.push(...files('nodia-server/src/'+dir).filter(file=>file.endsWith('.ts')&&!file.endsWith('.spec.ts')));
inv.sourceChecksums=[...new Set([...inv.sourceChecksums.map(s=>s.file),...added])].sort().map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
inv.ai20={date:'2026-10-17',scope:'Current AST local execution worker and human controls; runtime evidence separate',newControllers:['NodiaAiOperationController'],newHandlers:inv.controllers.filter(c=>c.name==='NodiaAiOperationController').flatMap(c=>c.operations.map(o=>o.operationId))};
inv.ai21={date:'2026-10-17',scope:'Twelve registered native financial writes; MCP prepare publication remains gated',newControllers:[],newHandlers:[],nativeFinancialOperations:12,databaseMigrations:0};
inv.ai22={date:'2026-10-17',scope:'Fourteen individual native business operation ports; SQL-only invoice metadata; MCP preparation and new chat attachments remain gated',newControllers:[],newHandlers:[],nativeBusinessOperations:14,databaseMigrations:0,newModules:['NodiaAiNativeEffectModule','NodiaAiBusinessCatalogModule','NodiaAiSupplierOperationsModule','NodiaAiInvoiceOperationsModule','InvoicePersistenceModule']};
const runtimePolicy=JSON.parse(fs.readFileSync('docs/mvp/nodia-ai-v1-runtime-policy.json','utf8'));
inv.ai23={date:'2026-10-17',scope:'Dependent sequential native operation sets from uniquely claimed drafts; immutable typed first-bind, pending-only material correction and local receipt reconciliation; MCP preparation publication remains gated',newControllers:[],newHandlers:[],nativeOperations:inv.ai21.nativeFinancialOperations+inv.ai22.nativeBusinessOperations,maximumStepsPerProposal:runtimePolicy.budget.steps_per_proposal,typedOutputBindings:[{sourceTool:'nodia_providers_prepare_create',outputKey:'id',outputType:'provider_id',targetTool:'nodia_provider_contacts_prepare_create',targetFieldKey:'provider_id'}],databaseMigrations:1,newColumns:[{table:'nodia_ai_execution_steps',column:'bound_command',type:'jsonb',nullable:true},{table:'nodia_ai_proposals',column:'prior_execution_id',type:'uuid',nullable:true}],newTables:0};
inv.ai24={date:'2026-10-17',scope:'Six internal native rental configuration ports sharing the existing journal transaction, exact human confirmation and historical receipts; MCP preparation remains unpublished',newControllers:[],newHandlers:[],nativeRentalConfigurationOperations:6,nativeOperations:32,databaseMigrations:0,newColumns:[],newTables:0,newModules:['NodiaAiRentalConfigurationModule']};
inv.ai25={date:'2026-10-17',scope:'Six internal native reservation lifecycle ports, advisory availability without hold, exact human confirmation and historical receipts; MCP prepare publication remains gated',newControllers:[],newHandlers:[],nativeRentalReservationOperations:6,nativeOperations:38,databaseMigrations:0,newColumns:[],newTables:0,newModules:['NodiaAiRentalReservationModule']};
inv.ai26={date:'2026-10-17',scope:'Ten internal native money, block and turnover ports; atomic receipts and native idempotency recovery; no MCP prepare publication',newControllers:[],newHandlers:[],nativeRentalMoneyOperations:6,nativeRentalCalendarOperations:4,nativeOperations:48,nativeRentalOperations:22,rentalEndpointCoverage:{total:44,publishedReads:21,internalWrites:22,internalRecovery:1},databaseMigrations:0,newColumns:[],newTables:0,newModules:['NodiaAiRentalMoneyModule','NodiaAiRentalOperationsModule']};
inv.ai27={date:'2026-10-17',scope:'Seventeen internal native Core operations under a selected exclusive authority frontier; exact confirmation and atomic minimal receipts; MCP writes unpublished',newControllers:[],newHandlers:[],nativeCoreOperations:17,nativeOperations:65,databaseMigrations:0,newTables:0,newColumns:[],newModules:['NodiaAiCoreOperationsModule']};
const catPath='docs/mvp/nodia-ai-v1-tool-catalog.json',cat=JSON.parse(fs.readFileSync(catPath,'utf8'));
for(const tool of cat.domainTools)for(const binding of tool.backendBindings){const handler=handlers.find(item=>item.operationId===binding.operationId);if(handler)binding.controllerLine=handler.line;}
fs.writeFileSync(catPath,JSON.stringify(cat,null,2)+'\n');
inv.ai28={date:'2026-10-17',scope:'Four internal non-secret AI connection and catalog operation ports; actor ai:manage and exact confirmation, global default and per-mode preferences; no MCP write publication',newControllers:[],newHandlers:[],nativeProviderOperations:4,nativeOperations:69,databaseMigrations:0,newTables:0,newColumns:[],newModules:['NodiaAiProviderOperationsModule']};
fs.writeFileSync(destination,JSON.stringify(inv,null,2)+'\n');
inv.ai29={date:'2026-10-17',scope:'Eight single-step human secure flows with private TTL witness and current-session ownership; model receives no credential/native reference; publication separate',newControllers:['NodiaAiSecureFlowController'],newHandlers:handlers.filter(h=>h.operationId.startsWith('NodiaAiSecureFlowController.')).map(h=>h.operationId),localNativeOperations:69,secureFlowPreparers:8,totalAdmittedPreparers:77,databaseMigrations:0,newTables:0,newColumns:[],newModules:['NodiaAiSecurePreparationModule','NodiaAiSecureFlowModule','NodiaAiExecutionStoreModule','AuthSessionRevocationModule']};
fs.writeFileSync(destination,JSON.stringify(inv,null,2)+'\n');
console.log(JSON.stringify({counts:inv.counts,checksums:inv.sourceChecksums.length,ai29:inv.ai29}));
