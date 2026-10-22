// Disposable compiled coordinator process. The native transport is an isolated synthetic HTTP service.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

process.env.DOTENV_CONFIG_PATH = process.platform === 'win32' ? 'NUL' : '/dev/null';
process.env.NODE_ENV = 'test';
process.env.RATE_LIMIT_STORAGE = 'memory';
const options=JSON.parse(process.env.NODIA_AI29_R01_FIXTURE_DB);
assert.equal(options.host,'127.0.0.1');assert.equal(options.database,'ai29');assert.notEqual(options.port,5432);
options.extra={application_name:'nodia_ai29_r01_disposable_coordinator'};
const load=async(file,name)=>(await import('../dist/'+file+'.js'))[name];
const [Execution,Redis,Manage,Run,Recover]=await Promise.all([
  load('nodia-ai-execution/nodia-ai-execution.module','NodiaAiExecutionModule'),load('common/redis/redis.service','RedisService'),
  load('nodia-ai-secure-flow/use-case/manage-nodia-ai-secure-flow.use-case','ManageNodiaAiSecureFlowUseCase'),
  load('nodia-ai-execution/use-case/run-nodia-ai-execution.use-case','RunNodiaAiExecutionUseCase'),
  load('nodia-ai-secure-flow/use-case/recover-nodia-ai-secure-flows.use-case','RecoverNodiaAiSecureFlowsUseCase'),
]);
const db=await new DataSource(options).initialize();
const compiled=await Test.createTestingModule({imports:[TypeOrmModule.forRootAsync({useFactory:()=>options,dataSourceFactory:async()=>db}),Execution]})
  .overrideProvider(Redis).useValue({get:async()=>null,set:async()=>{},del:async()=>{},keys:async()=>[],delByPattern:async()=>{}}).compile();
process.on('message',async message=>{
  try {
    let result;
    if(message.type==='run')result=await compiled.get(Run).execute(message.workerId,new AbortController().signal);
    else if(message.type==='action')result=await compiled.get(Manage).execute(message.identity,message.executionId,message.reference,message.action,message.input);
    else if(message.type==='recover')result=await compiled.get(Recover).execute();
    else if(message.type==='close'){await compiled.close();process.disconnect();return;}
    else throw Error('Unknown fixture action');
    process.send({id:message.id,type:'result',result});
  }catch(error){process.send({id:message.id,type:'error',status:error.getStatus?.()??null,message:error.message});}
});
process.send({type:'ready'});
