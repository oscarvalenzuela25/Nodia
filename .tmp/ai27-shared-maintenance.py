from pathlib import Path
import json
root=Path(__file__).resolve().parents[1]
for rel in ['nodia-server/src/nodia-ai-proposal/nodia-ai-proposal.module.ts','nodia-server/src/nodia-ai-confirmation/nodia-ai-confirmation.module.ts']:
 p=root/rel;s=p.read_text(encoding='utf-8')
 imports="import { NODIA_AI_CORE_OPERATIONS, type NodiaAiCoreOperation } from '../nodia-ai-core-operations/types/core-operation.types.js';\n"
 if '/nodia-ai-proposal/' in rel:
  imports+="import { NodiaAiCoreOperationsModule } from '../nodia-ai-core-operations/nodia-ai-core-operations.module.js';\n"
  s=s.replace('    NodiaAiRentalOperationsModule,','    NodiaAiRentalOperationsModule,\n    NodiaAiCoreOperationsModule,')
 s=imports+s
 s=s.replace('        NODIA_AI_RENTAL_OPERATIONS,','        NODIA_AI_RENTAL_OPERATIONS,\n        NODIA_AI_CORE_OPERATIONS,')
 s=s.replace('        rentalOperations: readonly NodiaAiRentalOperation[],','        rentalOperations: readonly NodiaAiRentalOperation[],\n        core: readonly NodiaAiCoreOperation[],')
 s=s.replace('...money, ...rentalOperations]', '...money, ...rentalOperations, ...core]')
 p.write_text(s,encoding='utf-8')
p=root/'nodia-server/src/nodia-ai-native-effect/use-case/execute-nodia-ai-local-effect.use-case.ts';s=p.read_text(encoding='utf-8')
s="import { NODIA_AI_CORE_OPERATIONS, type NodiaAiCoreOperation } from '../../nodia-ai-core-operations/types/core-operation.types.js';\n"+s
s=s.replace('nodiaAiBusinessOperationIdentity, nodiaAiRentalOperationIdentity','nodiaAiBusinessOperationIdentity, nodiaAiRentalOperationIdentity, nodiaAiCoreOperationIdentity')
s=s.replace('  private readonly rentalPorts:', '  private readonly corePorts: ReadonlyMap<string, NodiaAiCoreOperation>;\n  private readonly rentalPorts:')
s=s.replace('    calendarOperations: readonly NodiaAiRentalOperation[] = [],','    calendarOperations: readonly NodiaAiRentalOperation[] = [],\n    @Inject(NODIA_AI_CORE_OPERATIONS)\n    coreOperations: readonly NodiaAiCoreOperation[] = [],')
s=s.replace('    this.rentalPorts = rental;','''    this.rentalPorts = rental;
    const core = new Map<string, NodiaAiCoreOperation>();
    for (const port of coreOperations) {
      const identity = nodiaAiCoreOperationIdentity(port.toolName);
      if (!identity || identity.resourceKey !== port.resourceKey || identity.operation !== port.operation || core.has(port.toolName))
        throw new Error('nodia_ai:invalid_native_operation');
      core.set(port.toolName, port);
    }
    this.corePorts = core;''')
s=s.replace('?? this.rentalPorts.get(step.toolName);','?? this.rentalPorts.get(step.toolName) ?? this.corePorts.get(step.toolName);')
p.write_text(s,encoding='utf-8')
p=root/'docs/mvp/nodia-ai-v1-common-contracts.schema.json';s=json.loads(p.read_text(encoding='utf-8'))
s['$defs']['ProposalEditableField']['properties']['kind']['enum']+=['core_id_list','core_translations']
s['$defs']['CoreEffectReceipt']={
 'type':'object','additionalProperties':False,'required':['schema_version','resource_key','operation','resource_id'],
 'properties':{'schema_version':{'const':1},'resource_key':{'enum':['users','roles','actions','business_actions','modules','module_groups']},'operation':{'enum':['create','update','delete']},'resource_id':{'$ref':'#/$defs/BigintId'}},
 'allOf':[{'if':{'properties':{'resource_key':{'const':'users'}},'required':['resource_key']},'then':{'properties':{'operation':{'enum':['create','update']}}}}]}
p.write_text(json.dumps(s,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Shared DI, dispatch, receipt and typed review contracts wired for seventeen Core operations')
