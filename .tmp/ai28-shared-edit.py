from pathlib import Path
import json
r=Path.cwd()
p=r/'nodia-server/src/nodia-ai-proposal/types/local-operation.types.ts';s=p.read_text(encoding='utf-8');anchor='export function nodiaAiLocalOperationIdentity(name: string) {'
new='''type AiProviderIdentity = Readonly<{
  family: 'ai_provider';
  resourceKey: 'ai_providers' | 'ai_provider_catalog';
  operation: 'create' | 'update';
  idKind: 'bigint';
}>;
const aiProviderIdentities: Readonly<Record<string, AiProviderIdentity>> = Object.freeze({
  nodia_ai_providers_prepare_create: { family: 'ai_provider', resourceKey: 'ai_providers', operation: 'create', idKind: 'bigint' },
  nodia_ai_providers_prepare_update: { family: 'ai_provider', resourceKey: 'ai_providers', operation: 'update', idKind: 'bigint' },
  nodia_ai_providers_prepare_catalog_create: { family: 'ai_provider', resourceKey: 'ai_provider_catalog', operation: 'create', idKind: 'bigint' },
  nodia_ai_providers_prepare_catalog_update: { family: 'ai_provider', resourceKey: 'ai_provider_catalog', operation: 'update', idKind: 'bigint' },
});
export function nodiaAiProviderOperationIdentity(name: string) {
  return Object.hasOwn(aiProviderIdentities, name) ? aiProviderIdentities[name] : null;
}
'''
assert anchor in s;s=s.replace(anchor,new+anchor,1).replace('nodiaAiCoreOperationIdentity(name));','nodiaAiCoreOperationIdentity(name) ?? nodiaAiProviderOperationIdentity(name));')
s=s.replace("identity.family === 'core'\n      ? 'CoreEffectReceipt'", "identity.family === 'ai_provider'\n      ? 'AiProviderEffectReceipt'\n      : identity.family === 'core'\n        ? 'CoreEffectReceipt'")
s=s.replace("} else if (identity.family === 'core') {","} else if (identity.family === 'core' || identity.family === 'ai_provider') {")
s=s.replace("...(identity.family === 'core'\n      ? {}", "...(identity.family === 'core' || identity.family === 'ai_provider'\n      ? {}")
p.write_text(s,encoding='utf-8')
p=r/'docs/mvp/nodia-ai-v1-common-contracts.schema.json';d=json.loads(p.read_text(encoding='utf-8'));d['$defs']['AiProviderEffectReceipt']={'type':'object','additionalProperties':False,'required':['schema_version','resource_key','operation','resource_id'],'properties':{'schema_version':{'const':1},'resource_key':{'enum':['ai_providers','ai_provider_catalog']},'operation':{'enum':['create','update']},'resource_id':{'$ref':'#/$defs/BigintId'}}};p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
for name in ['nodia-ai-proposal/use-case/validate-nodia-ai-proposal.use-case.ts','nodia-ai-confirmation/use-case/validate-nodia-ai-confirmation.use-case.ts']:
 p=r/'nodia-server/src'/name;s=p.read_text(encoding='utf-8');s=s.replace("      'CoreEffectReceipt',","      'CoreEffectReceipt',\n      'AiProviderEffectReceipt',",1);p.write_text(s,encoding='utf-8')
for name in ['nodia-ai-proposal/nodia-ai-proposal.module.ts','nodia-ai-confirmation/nodia-ai-confirmation.module.ts']:
 p=r/'nodia-server/src'/name;s=p.read_text(encoding='utf-8');s="import { NODIA_AI_PROVIDER_OPERATIONS, type NodiaAiProviderOperation } from '../nodia-ai-provider-operations/types/provider-operation.types.js';\n"+s
 if name.startswith('nodia-ai-proposal/'):
  s="import { NodiaAiProviderOperationsModule } from '../nodia-ai-provider-operations/nodia-ai-provider-operations.module.js';\n"+s
  s=s.replace('    NodiaAiCoreOperationsModule,','    NodiaAiCoreOperationsModule,\n    NodiaAiProviderOperationsModule,')
 s=s.replace('        NODIA_AI_CORE_OPERATIONS,','        NODIA_AI_CORE_OPERATIONS,\n        NODIA_AI_PROVIDER_OPERATIONS,')
 s=s.replace('        core: readonly NodiaAiCoreOperation[],','        core: readonly NodiaAiCoreOperation[],\n        providers: readonly NodiaAiProviderOperation[],')
 indent='        ' if name.startswith('nodia-ai-proposal/') else '            '
 s=s.replace(indent+'...core,',indent+'...core,\n'+indent+'...providers,')
 p.write_text(s,encoding='utf-8')
p=r/'nodia-server/src/nodia-ai-native-effect/use-case/execute-nodia-ai-local-effect.use-case.ts';s=p.read_text(encoding='utf-8');s="import { NODIA_AI_PROVIDER_OPERATIONS, type NodiaAiProviderOperation } from '../../nodia-ai-provider-operations/types/provider-operation.types.js';\n"+s
s=s.replace('  nodiaAiCoreOperationIdentity,','  nodiaAiCoreOperationIdentity,\n  nodiaAiProviderOperationIdentity,',1)
s=s.replace('  private readonly corePorts:', '  private readonly providerPorts: ReadonlyMap<string, NodiaAiProviderOperation>;\n  private readonly corePorts:',1)
s=s.replace('    @Inject(RedisService) private readonly cache?: RedisService,','    @Inject(RedisService) private readonly cache?: RedisService,\n    @Inject(NODIA_AI_PROVIDER_OPERATIONS) providerOperations: readonly NodiaAiProviderOperation[] = [],',1)
s=s.replace('    this.corePorts = core;','''    this.corePorts = core;
    const providers = new Map<string, NodiaAiProviderOperation>();
    for (const port of providerOperations) {
      const identity = nodiaAiProviderOperationIdentity(port.toolName);
      if (!identity || identity.resourceKey !== port.resourceKey || identity.operation !== port.operation || providers.has(port.toolName))
        throw new Error('nodia_ai:invalid_native_operation');
      providers.set(port.toolName, port);
    }
    this.providerPorts = providers;''',1)
s=s.replace('      this.corePorts.get(step.toolName);','      this.corePorts.get(step.toolName) ??\n      this.providerPorts.get(step.toolName);',1);p.write_text(s,encoding='utf-8')
print('4 provider identities, schema and DI registries integrated; awaiting new vertical module')
