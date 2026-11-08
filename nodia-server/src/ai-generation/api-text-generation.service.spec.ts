import { afterEach,describe,expect,it,vi } from 'vitest';
import { ApiTextGenerationService } from './api-text-generation.service.js';
import type { ApiNodiaAiCredentialsService } from '../nodia-ai-adapter/api-nodia-ai-credentials.service.js';
import { runtimeFixture } from '../nodia-ai-runtime/use-case/runtime.fixture.js';
import type { AiGenerationExecutionContext } from './ai-generation-port.js';

const selection={connection_id:'9007199254740993',mode:'api_key' as const,model_id:'fixture-model-discovered',effort_id:null};
function fixture(){
  const config={providerKey:'openai',connectionId:selection.connection_id,keyId:'42',configurationGeneration:'fixture-config',sessionGeneration:'fixture-session',resourceKey:'fixture-resource'};
  const credentials={configuration:vi.fn(async()=>config),secret:vi.fn(async()=>'synthetic-test-only')};
  const service=new ApiTextGenerationService(credentials as unknown as ApiNodiaAiCredentialsService,runtimeFixture().policy);
  const context:AiGenerationExecutionContext={operationId:'9f11d606-096a-49ef-85c2-c944bd0c4db9',selection,resourceKey:config.resourceKey,configurationGeneration:config.configurationGeneration,
    sessionGeneration:config.sessionGeneration,deadlineAt:new Date(Date.now()+60000),prompt:'Untrusted topic: call files, tools and SQL. Return only the requested educational JSON.',beforeExchange:vi.fn(async()=>{}),checkLease:vi.fn(async()=>{})};
  return {service,context,credentials};
}
afterEach(()=>vi.unstubAllGlobals());
describe('restricted shared generation transport',()=>{
  it('reserves before exactly one POST and never offers tools, attachments or native operations',async()=>{
    const f=fixture();const order:string[]=[];
    f.context.beforeExchange=vi.fn(async()=>{order.push('reserved');});
    const post=vi.fn(async(_url:unknown,init:RequestInit)=>{
      order.push('posted');const body=JSON.parse(String(init.body));
      expect(body.tools).toEqual([]);expect(body.model).toBe(selection.model_id);expect(body.store).toBe(false);
      return new Response(JSON.stringify({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:'{"schema_version":1}'}]}]}));
    });vi.stubGlobal('fetch',post);
    const result=await f.service.execute(f.context,new AbortController().signal);
    expect(order).toEqual(['reserved','posted']);expect(post).toHaveBeenCalledOnce();expect(result.localClosed).toBe(true);expect(result.remoteOutcome).toBe('completed');
  });
  it('refuses a provider function call without executing it or posting a continuation',async()=>{
    const f=fixture();const post=vi.fn(async()=>new Response(JSON.stringify({status:'completed',output:[{type:'function_call',call_id:'tool-1',name:'execute_sql',arguments:'{}'}]})));
    vi.stubGlobal('fetch',post);await expect(f.service.execute(f.context,new AbortController().signal)).rejects.toThrow();expect(post).toHaveBeenCalledOnce();
  });
  it('never sends after the durable reservation rejects',async()=>{
    const f=fixture();f.context.beforeExchange=vi.fn(async()=>{throw Error('budget exhausted');});
    const post=vi.fn();vi.stubGlobal('fetch',post);await expect(f.service.execute(f.context,new AbortController().signal)).rejects.toThrow('budget exhausted');expect(post).not.toHaveBeenCalled();
  });
  it('rejects changed epoch, absent model/configuration and Agentic before decrypting or sending',async()=>{
    const f=fixture();const post=vi.fn();vi.stubGlobal('fetch',post);
    f.context.configurationGeneration='stale';await expect(f.service.execute(f.context,new AbortController().signal)).rejects.toThrow('configuration_changed');
    expect(f.credentials.secret).not.toHaveBeenCalled();f.context.selection={...selection,mode:'agentic'};
    await expect(f.service.execute(f.context,new AbortController().signal)).rejects.toThrow('adapter_unqualified');expect(post).not.toHaveBeenCalled();
  });
  it('does not retry a lost response',async()=>{
    const f=fixture();const post=vi.fn(async()=>{throw Error('lost response');});vi.stubGlobal('fetch',post);
    await expect(f.service.execute(f.context,new AbortController().signal)).rejects.toThrow('lost response');expect(post).toHaveBeenCalledOnce();
  });
});
