from pathlib import Path
root=Path(__file__).resolve().parents[1]
s=(root/'docs/evidence/scripts/reconcile-nodia-ai-ai26.cjs').read_text(encoding='utf-8')
s=s.replace("const controllers=[['nodia-server/src/nodia-ai-confirmation/nodia-ai-operation.controller.ts','NodiaAiOperationController']];", "const controllers=[['nodia-server/src/nodia-ai-confirmation/nodia-ai-operation.controller.ts','NodiaAiOperationController'],['nodia-server/src/business-action/business-action.controller.ts','BusinessActionController']];")
s=s.replace(" const sf=ts.createSourceFile(file,", " const priorController=inv.controllers.find(item=>item.name===name);\n const sf=ts.createSourceFile(file,",1)
needle=" const tags=decorator(c,'ApiTags',sf);"
s=s.replace(needle," for(const op of operations){const previous=priorController?.operations.find(item=>item.operationId===op.operationId);if(name==='BusinessActionController'&&previous)op.nodiaAiProposal=previous.nodiaAiProposal;}\n"+needle)
s=s.replace("family:'NodiaAI — coordinación conversacional',proposedTargetModuleRoute:'/tools/nodia-ai'", "family:priorController?.family??'NodiaAI — coordinación conversacional',proposedTargetModuleRoute:priorController?.proposedTargetModuleRoute??'/tools/nodia-ai'")
s=s.replace(" ['nodia-server/src/nodia-ai-rental-operations/nodia-ai-rental-operations.module.ts','NodiaAiRentalOperationsModule'],", " ['nodia-server/src/nodia-ai-rental-operations/nodia-ai-rental-operations.module.ts','NodiaAiRentalOperationsModule'],\n ['nodia-server/src/nodia-ai-core-operations/nodia-ai-core-operations.module.ts','NodiaAiCoreOperationsModule'],\n ['nodia-server/src/business-action/business-action.module.ts','BusinessActionModule'],")
s=s.replace("'nodia-ai-native-effect','nodia-ai-business-catalog'", "'authorization','user','role','action','module','module-group','business-action','nodia-ai-core-operations','nodia-ai-native-effect','nodia-ai-business-catalog'")
s=s.replace('newControllers:controllers.map(([_,name])=>name)',"newControllers:['NodiaAiOperationController']").replace('controllers.some(([_,name])=>name===c.name)',"c.name==='NodiaAiOperationController'")
s=s.replace("fs.writeFileSync(destination,JSON.stringify(inv,null,2)+'\\n');", """inv.ai27={date:'2026-10-17',scope:'Seventeen internal native Core operations under a selected exclusive authority frontier; exact confirmation and atomic minimal receipts; MCP writes unpublished',newControllers:[],newHandlers:[],nativeCoreOperations:17,nativeOperations:65,databaseMigrations:0,newTables:0,newColumns:[],newModules:['NodiaAiCoreOperationsModule']};
const catPath='docs/mvp/nodia-ai-v1-tool-catalog.json',cat=JSON.parse(fs.readFileSync(catPath,'utf8'));
for(const tool of cat.domainTools)for(const binding of tool.backendBindings){const handler=handlers.find(item=>item.operationId===binding.operationId);if(handler)binding.controllerLine=handler.line;}
fs.writeFileSync(catPath,JSON.stringify(cat,null,2)+'\\n');
fs.writeFileSync(destination,JSON.stringify(inv,null,2)+'\\n');""")
s=s.replace('ai26:inv.ai26}));','ai27:inv.ai27}));')
(root/'docs/evidence/scripts/reconcile-nodia-ai-ai27.cjs').write_text(s,encoding='utf-8')
print('Reconciler AI27 generated; preserves original native treatment and publication state')
