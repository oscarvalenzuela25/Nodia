from pathlib import Path
root=Path(__file__).resolve().parents[1]
p=root/'nodia-server/src/nodia-ai-native-effect/use-case/execute-nodia-ai-local-effect.use-case.spec.ts';s=p.read_text(encoding='utf-8')
s+='''
describe('Core exact executor dispatch', () => {
  const cases = (['users','roles','actions','business_actions','modules','module_groups'] as const)
    .flatMap(resource => (resource === 'users' ? ['create','update'] as const : ['create','update','delete'] as const).map(operation=>({resource,operation})));
  it.each(cases)('dispatches only the registered $resource/$operation contract', async ({resource,operation}) => {
    const f=fixture(), execute=vi.fn(async()=>({id:'9007199254740993'}));
    const port={...f.businessPort,toolName:`nodia_${resource}_prepare_${operation}`,resourceKey:resource,operation,executeConfirmed:execute} as unknown as NodiaAiCoreOperation;
    const local=new ExecuteNodiaAiLocalEffectUseCase(f.finance,[],[],[],[],[],[port]);
    const source=step(port.toolName);
    await expect(local.execute(source,f.context)).resolves.toEqual({id:'9007199254740993'});
    expect(execute).toHaveBeenCalledExactlyOnceWith(source,f.context);
    expect(()=>local.execute({...source,contractHash:'b'.repeat(64)},f.context)).toThrow('catalog_changed');
    expect(execute).toHaveBeenCalledTimes(1);
    expect(f.executeBusiness).not.toHaveBeenCalled();
  });
  it.each(['nodia_users_prepare_delete','nodia_roles_prepare_set_active','nodia_modules_prepare_patch'])('rejects invented Core action %s',toolName=>{
    const f=fixture(),port={...f.businessPort,toolName,resourceKey:'users',operation:'update'} as unknown as NodiaAiCoreOperation;
    expect(()=>new ExecuteNodiaAiLocalEffectUseCase(f.finance,[],[],[],[],[],[port])).toThrow('invalid_native_operation');
  });
});
'''
p.write_text(s,encoding='utf-8')
p=root/'nodia-server/src/nodia-ai-confirmation/use-case/get-nodia-ai-execution.use-case.spec.ts';s=p.read_text(encoding='utf-8')
marker='  async function businessReceipt('
block='''  async function coreReceipt(resource: string, operation: string) {
    const f=await completed();
    f.step.tool_name=`nodia_${resource}_prepare_${operation}`;
    f.step.scope={};f.step.preconditions={target:operation==='create'?null:{id:'9007199254740993'}};
    f.step.command_template={schema_version:1,...(operation==='create'?{}:{id:'9007199254740993'}),command:{},origins:{}};
    f.executionStep.tool_name=f.step.tool_name;f.executionStep.minimal_scope={};
    f.executionStep.template_hash=f.validate.hash({command_template:f.step.command_template,output_bindings:f.step.output_bindings,preconditions:f.step.preconditions});
    f.executionStep.bound_command_hash=f.validate.hash(nodiaAiBoundExecutionBinding(f.step));
    f.executionStep.minimal_receipt={schema_version:1,resource_key:resource,operation,resource_id:'9007199254740993'};
    f.execution.minimal_scope.steps[0].tool_name=f.step.tool_name;
    f.execution.minimal_scope.steps[0].scope={};
    return f;
  }
  it.each((['users','roles','actions','business_actions','modules','module_groups'] as const).flatMap(resource=>(resource==='users'?['create','update']:['create','update','delete']).map(operation=>({resource,operation}))))('projects historical Core $resource/$operation without requiring the current record',async({resource,operation})=>{
    const f=await coreReceipt(resource,operation);
    const result=await f.useCase.execute(f.identity,f.execution.id);
    expect(result.steps[0].result_refs).toEqual([{resource_key:resource,id:'9007199254740993'}]);
    expect(f.preparer.prepare).not.toHaveBeenCalled();expect(f.store.create).not.toHaveBeenCalled();
  });
  it.each([{resource_id:'7'},{resource_id:9007199254740993},{resource_key:'users'},{operation:'create'},{subject_user_id:'1'},{command:{roles:[]}}])('rejects a corrupt Core receipt %j',async delta=>{
    const f=await coreReceipt('roles','delete');Object.assign(f.executionStep.minimal_receipt!,delta);
    await expect(f.useCase.execute(f.identity,f.execution.id)).rejects.toThrow('invalid_persisted_state');
  });
  it('does not relabel an existing upsert result as another resource',async()=>{
    const f=await coreReceipt('users','create');f.step.preconditions={target:{id:'7'}};
    f.executionStep.template_hash=f.validate.hash({command_template:f.step.command_template,output_bindings:f.step.output_bindings,preconditions:f.step.preconditions});
    f.executionStep.bound_command_hash=f.validate.hash(nodiaAiBoundExecutionBinding(f.step));
    await expect(f.useCase.execute(f.identity,f.execution.id)).rejects.toThrow('invalid_persisted_state');
  });
'''
assert marker in s;s=s.replace(marker,block+marker,1);p.write_text(s,encoding='utf-8')
print('Root dispatch, historical Core receipt and stale-hint regressions written')
