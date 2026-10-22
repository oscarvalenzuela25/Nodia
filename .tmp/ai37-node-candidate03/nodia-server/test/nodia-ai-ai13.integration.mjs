// Compiled Nest HTTP + disposable PostgreSQL. All adapter observations are explicitly synthetic; no account/inference.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ValidationPipe, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createNodiaAiIntegrationFixture, loadAi } from './nodia-ai.integration.fixture.mjs';

const fixture = await createNodiaAiIntegrationFixture('ai13');
const { db, options, identities } = fixture;
const checks = [];
const check = (name, value) => { assert.ok(value, name); checks.push(name); };
let app;
try {
  const module = await loadAi('nodia-ai-conversation/nodia-ai-conversation.module', 'NodiaAiConversationModule');
  const adapterToken = await loadAi('nodia-ai-adapter/types/nodia-ai-adapter.types', 'NodiaAiAdapterPort');
  let observeCount = 0, supportsMcp = false, observeEffect = async () => {};
  const builder = Test.createTestingModule({imports:[TypeOrmModule.forRootAsync({useFactory:()=>options,dataSourceFactory:async()=>db}),module]});
  builder.overrideProvider(adapterToken).useValue({
    async observe(selection) {
      observeCount++;
      await observeEffect(selection);
      return { available:true, observedAt:new Date(), source:'gemini_live_session_and_catalog',
        resourceKey:'gemini-profile:'+'a'.repeat(64),configurationGeneration:'b'.repeat(64),sessionGeneration:'c'.repeat(32),
        adapterContractVersion:'nodia-ai-gemini-chat/1',supportsMcp:selection.mode==='token_plan_agentic'&&supportsMcp,reason:null };
    },
    async verifyConfiguration(){},
    async execute(){throw new Error('AI13 read preflights must never infer');},
  });
  app = (await builder.compile()).createNestApplication({logger:false});
  app.useGlobalGuards({canActivate(ctx){const req=ctx.switchToHttp().getRequest(), identity=identities.get(req.headers['x-fixture-actor']);if(!identity)throw new UnauthorizedException();req.auth={user:{id:identity.userId},sessionId:identity.sessionId};return true;}});
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({transform:true,whitelist:true,forbidNonWhitelisted:true}));
  await app.listen(0,'127.0.0.1');
  const base=(await app.getUrl())+'/api/v1/nodia-ai';
  async function request(path,{actor='1',status=200,method='GET',body}={}){
    const response=await fetch(base+path,{method,headers:{'content-type':'application/json','x-fixture-actor':actor},...(body?{body:JSON.stringify(body)}:{})});
    const result=await response.json();assert.equal(response.status,status,JSON.stringify(result));return result;
  }
  const fields={token_plan_web:{selected_model:'synthetic-web',available_models:[{id:'synthetic-web',displayName:'Synthetic Web',secret:'synthetic-private-marker'}]},token_plan_agentic:{selected_model:'synthetic-agentic',thinking_levels:{'synthetic-agentic':'synthetic-effort'},available_models:[{id:'synthetic-agentic'}]},api_key:{selected_model:'synthetic-api'}};
  const [connection]=await db.query(`INSERT INTO ai_providers(catalog_id,name,fields,use_api_key,use_token_plan_web,use_token_plan_agentic) SELECT id,'Synthetic AI13 connection',$1,true,true,true FROM ai_provider_catalog WHERE key='gemini' RETURNING id`,[fields]);
  const [second]=await db.query(`INSERT INTO ai_providers(catalog_id,name,fields,use_token_plan_web) SELECT id,'Synthetic second connection',$1,true FROM ai_provider_catalog WHERE key='gemini' RETURNING id`,[fields]);
  const page=await request('/connections?page_limit=1');
  check('assigned NodiaAI without Settings/ai:manage can read the runtime catalog',page.items[0].connection_id===connection.id);
  check('configuration never claims live authentication or inference',page.items[0].modes.every(mode=>mode.authentication==='unknown'&&mode.inference==='unknown'&&mode.observed_at===null));
  check('no private JSON field or connection fields escape the allowlist',!JSON.stringify(page).includes('synthetic-private-marker')&&!('fields' in page.items[0]));
  check('catalog GET has no adapter calls',observeCount===0);
  const next=await request('/connections?page_limit=1&cursor='+encodeURIComponent(page.next_cursor));
  check('bigint cursor enumerates the next connection without duplicates',next.items[0].connection_id===second.id&&next.next_cursor===null);
  await request('/connections?cursor='+encodeURIComponent(page.next_cursor),{actor:'2',status:400});check('catalog cursor cannot be reused by another actor',true);
  await request('/connections?all=true',{status:400});check('catalog rejects unbounded unknown query',true);
  await request('/connections',{actor:'missing',status:401});check('catalog rejects unauthenticated callers',true);
  const path=`/connections/${connection.id}/eligibility?mode=token_plan_web&model_id=synthetic-web`;
  const eligibility=await request(path);
  check('exact Web eligibility remains conversational',eligibility.available&&!eligibility.supports_mcp&&eligibility.routing_target===null);
  check('unverified Agentic does not enable routing from session observation',observeCount===2);
  supportsMcp=true;
  const verified=await request(path);
  check('verified target is same connection configured Agentic model and effort',verified.routing_target?.selection.connection_id===connection.id&&verified.routing_target.selection.model_id==='synthetic-agentic'&&verified.routing_target.selection.effort_id==='synthetic-effort');
  check('public eligibility does not expose physical profile identity',!JSON.stringify(verified).includes('gemini-profile'));
  const beforeApi=observeCount;
  const api=await request(`/connections/${connection.id}/eligibility?mode=api_key&model_id=synthetic-api`);
  check('API remains explicitly deferred without observing or inferring',!api.available&&api.reason==='nodia_ai:adapter_mode_unsupported'&&observeCount===beforeApi);
  await request(path+'&actor=2',{status:400});check('eligibility rejects impersonation/unknown query',true);
  await request(path.replace('synthetic-web','unknown-synthetic'),{status:400});check('eligibility rejects unknown model before observing',observeCount===beforeApi);
  observeEffect=async()=>{await db.query(`DELETE FROM user_modules WHERE user_id=1 AND module_id=(SELECT id FROM modules WHERE key='nodia_ai')`);};
  await request(path,{status:403});check('revocation during external observation denies the final response',true);
  observeEffect=async()=>{};
  await db.query(`INSERT INTO user_modules(user_id,module_id) SELECT 1,id FROM modules WHERE key='nodia_ai'`);
  observeEffect=async()=>{await db.query('UPDATE ai_providers SET use_token_plan_web=false WHERE id=$1',[connection.id]);};
  await request(path,{status:409});check('configuration change during observation is an explicit conflict',true);
  observeEffect=async()=>{};
  await db.query('UPDATE ai_providers SET use_token_plan_web=true WHERE id=$1',[connection.id]);

  const selection={connection_id:connection.id,mode:'token_plan_web',model_id:'synthetic-web',effort_id:null};
  const chat=await request('/conversations',{method:'POST',status:201,body:{client_request_id:randomUUID(),selection}});
  for(const seq of ['9007199254740993','9007199254740994','9007199254740995']) {
    const id=randomUUID();
    await db.query(`INSERT INTO nodia_ai_messages(id,conversation_id,seq,role,author_id,client_message_id,status,source_scope_manifest,sealed_at,input_hash) VALUES($1,$2,$3,'user',1,$4,'sealed','{"schema_version":1,"module_routes":[]}',clock_timestamp(),$5)`,[id,chat.conversation_id,seq,randomUUID(),'d'.repeat(64)]);
    await db.query(`INSERT INTO nodia_ai_message_parts(message_id,conversation_id,part_index,kind,text) VALUES($1,$2,0,'text',$3)`,[id,chat.conversation_id,'Synthetic '+seq]);
  }
  const last=await request(`/conversations/${chat.conversation_id}/messages?direction=backward&page_limit=2`);
  check('latest message window returns chronological order preserving bigint precision',last.items.map(item=>item.seq).join(',')==='9007199254740994,9007199254740995');
  const older=await request(`/conversations/${chat.conversation_id}/messages?direction=backward&page_limit=2&cursor=${encodeURIComponent(last.next_cursor)}`);
  check('backward cursor loads earlier messages without overlap',older.items.length===1&&older.items[0].seq==='9007199254740993');
  await request(`/conversations/${chat.conversation_id}/messages?cursor=${encodeURIComponent(last.next_cursor)}`,{status:400});check('backward cursor cannot be reused forward',true);
  await request(`/conversations/${chat.conversation_id}/messages?direction=backward`,{actor:'2',status:404});check('latest windows preserve ownership authorization',true);
  console.log(JSON.stringify({stage:'AI-13',scope:'compiled_http_postgresql_synthetic_adapter_only',checks:checks.length,passed:checks},null,2));
} finally {
  if(app)await app.close();
  await fixture.close();
}
