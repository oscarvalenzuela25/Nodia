// Real PostgreSQL, human confirmation HTTP and killed/restarted compiled Node processes.
// Only the independent private native transport is simulated; no real credential or account is used.
import assert from 'node:assert/strict';
import { randomBytes,randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UnauthorizedException,ValidationPipe } from '@nestjs/common';
import { createNodiaAiIntegrationFixture,loadAi } from './nodia-ai.integration.fixture.mjs';

const fixture=await createNodiaAiIntegrationFixture('ai29'),{db,options,identities}=fixture;
const checks=[],children=new Set(),nativeRecords=new Map(),heldStarts=[],transportCalls=[];
const check=(name,condition=true)=>{assert.ok(condition,name);checks.push(name);};
const token=randomBytes(32).toString('hex');
let app,nativeTransport,profileStarts=0,hold='none',failNextAck=false;
const waitFor=async(read,predicate,message,timeout=20000)=>{const until=Date.now()+timeout;while(Date.now()<until){const value=await read();if(predicate(value))return value;await delay(25);}throw Error('Timed out: '+message);};
const kill=async child=>{if(child.exitCode!==null||child.signalCode!==null)return;const ended=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGKILL');await ended;};
const nativeView=record=>({id:record.id,state:record.state,...(record.engine==='agentic'?{authorization_url:null,reason:null}:{})});
try {
  nativeTransport=createServer((req,res)=>{
    const match=req.url.match(/^\/(auth\/login|agentic\/auth\/login)\/requests\/([0-9a-f-]{36})(\/(?:cancel|ack))?$/);
    const actor=req.headers['x-nodia-actor-id'],provider=req.headers['x-nodia-provider-id'],authenticated=req.headers['x-nodia-service-token']===token;
    transportCalls.push({method:req.method,path:req.url,actor,provider,authenticated});
    const send=(status,value)=>{if(!res.destroyed){res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(value));}};
    if(!match||!authenticated||!/^\d+$/.test(actor)||!/^\d+$/.test(provider)){send(403,{});return;}
    const engine=match[1].startsWith('agentic')?'agentic':'web',request=match[2],key=engine+':'+request;
    const existing=nativeRecords.get(key);
    if(existing&&(existing.actor!==actor||existing.provider!==provider)){send(404,{});return;}
    if(match[3]==='/ack') {
      if(failNextAck){failNextAck=false;send(503,{});return;}
      if(existing&&!['succeeded','failed','cancelled'].includes(existing.state)){send(409,{});return;}
      if(existing)existing.acknowledged=true;
      send(200,{acknowledged:true});return;
    }
    if(req.method==='GET'){send(200,existing?nativeView(existing):{state:'unknown'});return;}
    if(match[3]) {
      const record=existing??{id:request.replaceAll('-',''),engine,actor,provider,state:'cancelled'};
      if(!['succeeded','failed','cancelled'].includes(record.state))record.state='cancelled';
      nativeRecords.set(key,record);send(200,nativeView(record));return;
    }
    const expires=Date.parse(req.headers['x-nodia-login-expires-at']);
    const admit=()=>{
      const prior=nativeRecords.get(key);
      if(prior){send(200,nativeView(prior));return;}
      if(!Number.isFinite(expires)||expires<=Date.now()){send(409,{});return;}
      const record={id:request.replaceAll('-',''),engine,actor,provider,state:'running'};
      nativeRecords.set(key,record);profileStarts++;send(200,nativeView(record));
    };
    if(hold==='before'){heldStarts.push({key,admit});return;}
    if(hold==='after') {
      if(!existing){nativeRecords.set(key,{id:request.replaceAll('-',''),engine,actor,provider,state:'running'});profileStarts++;}
      heldStarts.push({key,admit});return;
    }
    admit();
  });
  await new Promise(resolve=>nativeTransport.listen(0,'127.0.0.1',resolve));
  const childWorker=async()=>{
    const child=fork(fileURLToPath(new URL('./nodia-ai-ai29-r01-worker.fixture.mjs',import.meta.url)),[],{cwd:fileURLToPath(new URL('..',import.meta.url)),windowsHide:true,silent:true,
      env:{...process.env,DOTENV_CONFIG_PATH:process.platform==='win32'?'NUL':'/dev/null',NODIA_AI29_R01_FIXTURE_DB:JSON.stringify(options),GEMINI_MICROSERVICE_URL:`http://127.0.0.1:${nativeTransport.address().port}`,GEMINI_SERVICE_TOKEN:token}});
    children.add(child);const messages=[];let output='',exited;
    child.on('message',message=>messages.push(message));child.on('exit',(code,signal)=>{exited={code,signal};children.delete(child);});
    for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{output=(output+chunk.toString()).slice(-32768);});
    await waitFor(async()=>messages.find(message=>message.type==='ready'),Boolean,'child ready');
    const send=async(message,{error=false}={})=>{const id=randomUUID();child.send({...message,id});const response=await waitFor(async()=>{if(exited)throw Error(`Child exited ${JSON.stringify(exited)} ${output}`);return messages.find(value=>value.id===id);},Boolean,'child response');if(response.type==='error'&&!error)throw Error(JSON.stringify(response));return response;};
    return {child,send};
  };
  const [Execution,Conversation,Overview,Prepare,Redis,Expire]=await Promise.all([
    loadAi('nodia-ai-execution/nodia-ai-execution.module','NodiaAiExecutionModule'),loadAi('nodia-ai-conversation/nodia-ai-conversation.module','NodiaAiConversationModule'),
    loadAi('finance-overview/finance-overview.module','FinanceOverviewModule'),loadAi('nodia-ai-proposal/use-case/prepare-nodia-ai-proposal.use-case','PrepareNodiaAiProposalUseCase'),
    loadAi('common/redis/redis.service','RedisService'),loadAi('nodia-ai-conversation/use-case/expire-nodia-ai-conversations.use-case','ExpireNodiaAiConversationsUseCase'),
  ]);
  const compiled=await Test.createTestingModule({imports:[TypeOrmModule.forRootAsync({useFactory:()=>options,dataSourceFactory:async()=>db}),Execution,Conversation,Overview]})
    .overrideProvider(Redis).useValue({get:async()=>null,set:async()=>{},del:async()=>{},keys:async()=>[],delByPattern:async()=>{}}).compile();
  app=compiled.createNestApplication({logger:false});app.setGlobalPrefix('api/v1');app.useGlobalPipes(new ValidationPipe({transform:true,whitelist:true,forbidNonWhitelisted:true}));
  app.useGlobalGuards({canActivate(context){const request=context.switchToHttp().getRequest(),identity=identities.get(request.headers['x-fixture-actor']);if(!identity)throw new UnauthorizedException();request.auth={user:{id:identity.userId},sessionId:identity.sessionId};return true;}});
  await app.listen(0,'127.0.0.1');const base=await app.getUrl();
  const request=async(path,body,actor='1')=>{const response=await fetch(base+'/api/v1'+path,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json','x-fixture-actor':actor},...(body===undefined?{}:{body:JSON.stringify(body)})});const value=await response.json();assert.ok(response.ok,JSON.stringify(value));return value;};
  const [group]=await db.query("SELECT module_group_id AS id FROM modules WHERE key='nodia_ai'");
  let [destination]=await db.query("SELECT id::text FROM modules WHERE link='/settings/ai-providers' ORDER BY id LIMIT 1");
  if(!destination)[destination]=await db.query("INSERT INTO modules(key,link,module_group_id) VALUES('synthetic_ai29_r01','/settings/ai-providers',$1) RETURNING id::text",[group.id]);
  await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(1,$1),(2,$1) ON CONFLICT DO NOTHING',[destination.id]);
  let [manage]=await db.query("SELECT id::text FROM actions WHERE key='ai:manage'");if(!manage)[manage]=await db.query("INSERT INTO actions(key) VALUES('ai:manage') RETURNING id::text");
  const [role]=await db.query("INSERT INTO roles(key) VALUES('synthetic_ai29_r01_manager') RETURNING id::text");await db.query('INSERT INTO role_actions(role_id,action_id) VALUES($1,$2)',[role.id,manage.id]);await db.query('INSERT INTO user_roles(user_id,role_id) VALUES(1,$1),(2,$1)',[role.id]);
  const [catalog]=await db.query("INSERT INTO ai_provider_catalog(key,name,can_use_api_key,can_use_token_plan_web,can_use_token_plan_agentic) VALUES('gemini','Synthetic R01',true,true,true) ON CONFLICT(key) DO UPDATE SET is_active=true,can_use_token_plan_web=true,can_use_token_plan_agentic=true RETURNING id::text");
  const [provider]=await db.query("INSERT INTO ai_providers(catalog_id,name,use_api_key,use_token_plan_web,use_token_plan_agentic,default_mode) VALUES($1,'Synthetic R01',true,true,true,'token_plan_web') RETURNING id::text",[catalog.id]);
  let processFixture=await childWorker();
  const detail=async id=>request(`/nodia-ai/operations/${id}/secure-flow`);
  const pause=async(mode='token_plan_web',existingChat)=>{
    const chat=existingChat??randomUUID(),identity=identities.get('1');if(!existingChat)await db.query("INSERT INTO nodia_ai_conversations(id,owner_id,client_request_id,creation_request_hash,title,expires_at) VALUES($1,1,$2,$3,'Synthetic R01',clock_timestamp()+interval '90 days')",[chat,randomUUID(),'a'.repeat(64)]);
    const prepared=await db.transaction(manager=>compiled.get(Prepare).execute(manager,identity,{conversationId:chat,toolName:'nodia_secure_flows_prepare_connection_login',partial:{provider_id:provider.id,mode}}));assert.equal(prepared.status,'ready');const p=prepared.proposal;
    const challenge=await request(`/nodia-ai/proposals/${p.proposal_id}/confirmation-challenge`,{proposal_revision:p.revision,expected_hash:p.hash});
    const accepted=await request(`/nodia-ai/proposals/${p.proposal_id}/confirm`,{client_request_id:randomUUID(),proposal_revision:p.revision,expected_hash:p.hash,confirmation_token:challenge.confirmation_token});
    await processFixture.send({type:'run',workerId:randomUUID()});const id=accepted.execution.execution_id;return {id,chat,...await detail(id)};
  };
  const invoke=(f,action,options={})=>processFixture.send({type:'action',identity:identities.get('1'),executionId:f.id,reference:f.flow.reference,action,input:{expected_execution_revision:f.flow.revision,client_request_id:randomUUID()}},options);
  const step=async id=>(await db.query('SELECT * FROM nodia_ai_execution_steps WHERE execution_id=$1',[id]))[0];
  const count=async(table,id)=>(await db.query(`SELECT count(*)::int n FROM ${table} WHERE id=$1`,[id]))[0].n;
  const loseStart=async(f,point)=>{hold=point;const before=heldStarts.length;void invoke(f,'start',{error:true}).catch(()=>{});await waitFor(async()=>heldStarts.length,value=>value>before,'held native start');const stored=await step(f.id);assert.equal(stored.recovery_descriptor.status,'invoking');assert.equal(stored.recovery_descriptor.native_reference,null);assert.equal(stored.recovery_descriptor.native_request.request_id,stored.native_request_key);await kill(processFixture.child);hold='none';processFixture=await childWorker();return heldStarts.at(-1);};

  const lost=await pause();await loseStart(lost,'after');const startsAfterLoss=profileStarts;await processFixture.send({type:'recover'});
  check('a fresh compiled coordinator recovers a native login after SIGKILL without a second profile start',profileStarts===startsAfterLoss&&(await step(lost.id)).recovery_descriptor.status==='pending');
  check('the immutable native request remains private and independent of the human request ID',(await step(lost.id)).native_request_key!==(await step(lost.id)).recovery_descriptor.request_id&&!JSON.stringify(await detail(lost.id)).includes('native_request'));
  Object.assign(lost,await detail(lost.id));await invoke(lost,'cancel');

  const cancelled=await pause('token_plan_agentic'),delayed=await loseStart(cancelled,'before'),startsBeforeCancel=profileStarts;Object.assign(cancelled,await detail(cancelled.id));await invoke(cancelled,'cancel');delayed.admit();
  check('cancellation by request creates a native tombstone before delayed admission and prevents the profile from starting',profileStarts===startsBeforeCancel&&nativeRecords.get(delayed.key).state==='cancelled');
  check('a cancelled uncertain start releases the SQL owner without fabricating a completed receipt',(await step(cancelled.id)).state==='cancelled'&&(await step(cancelled.id)).minimal_receipt===null&&(await db.query('SELECT active_job_id FROM nodia_ai_conversations WHERE id=$1',[cancelled.chat]))[0].active_job_id===null);

  const expired=await pause(),expiredDelayed=await loseStart(expired,'before'),startsBeforeExpiry=profileStarts;await db.query("UPDATE nodia_ai_execution_steps SET recovery_descriptor=jsonb_set(recovery_descriptor,'{expires_at}',to_jsonb((clock_timestamp()-interval '1 second')::text)) WHERE execution_id=$1",[expired.id]);await processFixture.send({type:'recover'});expiredDelayed.admit();
  check('TTL expiry fences an armed request that never returned a native reference',profileStarts===startsBeforeExpiry&&(await step(expired.id)).state==='failed'&&nativeRecords.get(expiredDelayed.key).state==='cancelled');

  const revoked=await pause('token_plan_agentic'),revokedDelayed=await loseStart(revoked,'before'),startsBeforeRevocation=profileStarts;await db.query('UPDATE role_actions SET is_active=false WHERE role_id=$1 AND action_id=$2',[role.id,manage.id]);await processFixture.send({type:'recover'});revokedDelayed.admit();await db.query('UPDATE role_actions SET is_active=true WHERE role_id=$1 AND action_id=$2',[role.id,manage.id]);
  check('authority revocation cancels only the persisted native request without a new login',profileStarts===startsBeforeRevocation&&(await step(revoked.id)).state==='failed'&&nativeRecords.get(revokedDelayed.key).state==='cancelled');

  const purged=await pause(),purgedDelayed=await loseStart(purged,'after'),startsBeforePurge=profileStarts;await db.query("UPDATE nodia_ai_conversations SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",[purged.chat]);await compiled.get(Expire).execute();
  check('chat purge keeps the minimal durable target even when no native job reference was returned',await count('nodia_ai_conversations',purged.chat)===0&&await count('nodia_ai_executions',purged.id)===1&&(await step(purged.id)).recovery_descriptor.native_request.request_id);
  await processFixture.send({type:'recover'});purgedDelayed.admit();check('post-purge native cancellation proof removes the detached SQL witness and never restarts login',profileStarts===startsBeforePurge&&await count('nodia_ai_executions',purged.id)===0);

  const late=await pause('token_plan_agentic'),lateHeld=await loseStart(late,'after'),startsBeforeLate=profileStarts;nativeRecords.get(lateHeld.key).state='succeeded';failNextAck=true;await processFixture.send({type:'recover'});const lateStep=await step(late.id);
  check('a terminal success from the native request is reconciled atomically after coordinator restart',profileStarts===startsBeforeLate&&lateStep.state==='completed'&&lateStep.minimal_receipt.id===late.flow.reference);
  const nextInSameChat=await pause('token_plan_web',late.chat);await invoke(nextInSameChat,'start');const startsAfterNext=profileStarts;
  await db.query("UPDATE nodia_ai_conversations SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",[late.chat]);await compiled.get(Expire).execute();
  check('lost post-commit ACK preserves only a detached terminal outbox when its chat expires',await count('nodia_ai_conversations',late.chat)===0&&await count('nodia_ai_executions',late.id)===1&&(await step(late.id)).recovery_descriptor.status==='completed');
  // A maintenance pass spends at most one native cleanup. Equal-time UUID ordering
  // may select either of these two detached witnesses first; both settle in two passes.
  await processFixture.send({type:'recover'});
  await processFixture.send({type:'recover'});
  check('maintenance retries the terminal ACK and retires its detached witness without another effect',await count('nodia_ai_executions',late.id)===0&&nativeRecords.get(lateHeld.key).acknowledged===true&&profileStarts===startsAfterNext);
  check('chat purge handles a completed ACK outbox alongside its newer active execution without violating unique admission',await count('nodia_ai_executions',nextInSameChat.id)===0&&profileStarts===startsAfterNext);
  check('all real private HTTP requests kept service authentication and exact actor/provider identity',transportCalls.every(value=>value.authenticated&&value.actor==='1'&&value.provider===provider.id));
  check('completed recovery leaves no leased SQL job, live attempt or nested inference slot',(await db.query("SELECT count(*)::int n FROM nodia_ai_jobs WHERE state='leased'"))[0].n===0&&(await db.query('SELECT count(*)::int n FROM nodia_ai_job_attempts WHERE ended_at IS NULL'))[0].n===0&&(await db.query('SELECT count(*)::int n FROM nodia_ai_runtime_slots'))[0].n===0);
  check('native authorization material is absent from every durable execution witness',!(await db.query('SELECT row_to_json(s)::text data FROM nodia_ai_execution_steps s')).some(value=>value.data.includes('authorization_url')||value.data.includes('access_token')||value.data.includes('refresh_token')));
  console.log(JSON.stringify({stage:'AI-29-R01',scope:'real_postgresql_confirmation_http_sigkill_restarted_node_and_authenticated_private_transport_synthetic_native_journal',checks:checks.length,profile_start_calls:profileStarts,native_private_http_requests:transportCalls.length,passed:checks,limitations:['The HTTP native service is synthetic; durable Python/Codex supervisors and real provider sessions require separate evidence.']},null,2));
}catch(error){console.error(JSON.stringify({stage:'AI-29-R01',completed_checks:checks.length,last_checks:checks.slice(-3)}));throw error;}
finally{for(const child of children)await kill(child);nativeTransport?.closeAllConnections();if(nativeTransport)await new Promise(resolve=>nativeTransport.close(resolve));if(app)await app.close();await fixture.close();}
