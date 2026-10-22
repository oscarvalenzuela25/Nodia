from pathlib import Path
r=Path.cwd()
p=r/'nodia-server/src/nodia-ai-confirmation/use-case/get-nodia-ai-execution.use-case.spec.ts';s=p.read_text(encoding='utf-8');anchor='  async function businessReceipt('
block='''  async function aiProviderReceipt(catalog: boolean, operation: string) {
    const resource = catalog ? 'ai_provider_catalog' : 'ai_providers';
    const f = await coreReceipt(resource, operation);
    f.step.tool_name = `nodia_ai_providers_prepare_${catalog ? 'catalog_' : ''}${operation}`;
    f.executionStep.tool_name = f.step.tool_name;
    f.executionStep.bound_command_hash = f.validate.hash(nodiaAiBoundExecutionBinding(f.step));
    f.execution.minimal_scope.steps[0].tool_name = f.step.tool_name;
    return f;
  }
  it.each([false, true].flatMap(catalog => ['create', 'update'].map(operation => ({catalog, operation}))))('projects historical non-secret provider receipt catalog=$catalog/$operation without re-reading provider configuration', async ({catalog, operation}) => {
    const f = await aiProviderReceipt(catalog, operation);
    const result = await f.useCase.execute(f.identity, f.execution.id);
    expect(result.steps[0].result_refs).toEqual([{resource_key: catalog ? 'ai_provider_catalog' : 'ai_providers', id: '9007199254740993'}]);
    expect(f.preparer.prepare).not.toHaveBeenCalled();
    expect(f.store.create).not.toHaveBeenCalled();
  });
  it.each([{resource_id:'7'},{resource_id:Number.MAX_SAFE_INTEGER+1},{resource_key:'ai_provider_catalog'},{operation:'delete'},{api_key:'synthetic-forbidden'},{command:{is_default:true}},{fields:{selected_model:'synthetic-forbidden'}}])('rejects corrupt or excessive non-secret provider receipt %j', async delta => {
    const f = await aiProviderReceipt(false, 'update');
    Object.assign(f.executionStep.minimal_receipt!, delta);
    await expect(f.useCase.execute(f.identity,f.execution.id)).rejects.toThrow('invalid_persisted_state');
  });
'''
assert anchor in s;s=s.replace(anchor,block+anchor,1);p.write_text(s,encoding='utf-8')
p=r/'nodia-server/src/nodia-ai-native-effect/use-case/execute-nodia-ai-local-effect.use-case.spec.ts';s=p.read_text(encoding='utf-8');s="import type { NodiaAiProviderOperation } from '../../nodia-ai-provider-operations/types/provider-operation.types.js';\n"+s
s+='''
describe('Non-secret provider exact dispatch', () => {
  const cases = [false,true].flatMap(catalog => (['create','update'] as const).map(operation => ({catalog,operation})));
  it.each(cases)('dispatches only catalog=$catalog/$operation and preserves the transaction context', async ({catalog,operation}) => {
    const f=fixture(), execute=vi.fn(async()=>({id:'9007199254740993'}));
    const port={...f.businessPort,toolName:`nodia_ai_providers_prepare_${catalog?'catalog_':''}${operation}`,resourceKey:catalog?'ai_provider_catalog':'ai_providers',operation,executeConfirmed:execute} as unknown as NodiaAiProviderOperation;
    const local=new ExecuteNodiaAiLocalEffectUseCase(f.finance,[],[],[],[],[],[],undefined,[port]);
    const source=step(port.toolName);
    await expect(local.execute(source,f.context)).resolves.toEqual({id:'9007199254740993'});
    expect(execute).toHaveBeenCalledExactlyOnceWith(source,f.context);
    expect(()=>local.execute({...source,contractHash:'b'.repeat(64)},f.context)).toThrow('catalog_changed');
    expect(f.executeLegacy).not.toHaveBeenCalled();
    expect(f.executeBusiness).not.toHaveBeenCalled();
  });
  it.each(['nodia_ai_providers_prepare_delete','nodia_ai_providers_prepare_sync_models','nodia_ai_providers_prepare_codex_logout','nodia_ai_providers_prepare_gemini_web_logout'])('does not execute unregistered local/external provider operation %s', name => {
    const f=fixture();
    expect(()=>f.local.execute(step(name),f.context)).toThrow('catalog_changed');
    expect(f.executeLegacy).not.toHaveBeenCalled();
    expect(f.executeBusiness).not.toHaveBeenCalled();
  });
  it('rejects a provider registration with mismatched identity and duplicate registrations',()=>{
    const f=fixture();
    const port={...f.businessPort,toolName:'nodia_ai_providers_prepare_update',resourceKey:'ai_providers',operation:'update'} as unknown as NodiaAiProviderOperation;
    expect(()=>new ExecuteNodiaAiLocalEffectUseCase(f.finance,[],[],[],[],[],[],undefined,[{...port,resourceKey:'ai_provider_catalog'}])).toThrow('invalid_native_operation');
    expect(()=>new ExecuteNodiaAiLocalEffectUseCase(f.finance,[],[],[],[],[],[],undefined,[port,port])).toThrow('invalid_native_operation');
  });
});
''';p.write_text(s,encoding='utf-8')
p=r/'docs/evidence/scripts/validate-nodia-ai-catalog-contracts.cjs';s=p.read_text(encoding='utf-8');anchor="check('FinancialMovementReceipt',";i=s.index(anchor)
block="""for(const resource_key of ['ai_providers','ai_provider_catalog'])for(const operation of ['create','update'])
 check('AiProviderEffectReceipt',{schema_version:1,resource_key,operation,resource_id:'9007199254740993'},true,`non-secret AI ${resource_key} ${operation} witness`);
for(const delta of [{operation:'delete'},{resource_key:'users'},{resource_id:1},{resource_id:'0'},{api_key:'synthetic-forbidden'},{fields:{}},{command:{is_default:true}},{subject_user_id:'1'}])
 check('AiProviderEffectReceipt',{schema_version:1,resource_key:'ai_providers',operation:'update',resource_id:'1',...delta},false,'AI configuration receipt excludes unrelated identity and data '+JSON.stringify(delta));
"""
s=s[:i]+block+s[i:];s=s.replace("reconciledThrough:'AI-27'","reconciledThrough:'AI-28'").replace('coreAdministration:inv.ai27,','coreAdministration:inv.ai27,aiProviderConfiguration:inv.ai28,');p.write_text(s,encoding='utf-8')
print('20 coordinator unit regressions and12 schema fixtures added')
