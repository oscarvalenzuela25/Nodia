// Compiled native contracts, human confirmation HTTP, real PostgreSQL and worker processes.
// Synthetic disposable records only. Preparation is an internal port, never a published MCP assertion.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createNodiaAiIntegrationFixture, loadAi } from './nodia-ai.integration.fixture.mjs';

const fixture = await createNodiaAiIntegrationFixture('ai27');
const { db, options, identities } = fixture;
const checks = [], children = new Set(), exercised = new Set();
const check = (name, condition = true) => { assert.ok(condition, name); checks.push(name); };
let app, compiled, base, prepare, execute, claimer, recovery, worker, providerCalls = 0;
const kill = async child => {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const ended = new Promise(resolve => child.once('exit', resolve));
  child.kill('SIGKILL');
  await ended;
};
try {
  const [Confirmation, Execution, Conversation, Overview, Prepare, Execute, Claim, Recover, Run, Redis, Adapter] = await Promise.all([
    loadAi('nodia-ai-confirmation/nodia-ai-confirmation.module', 'NodiaAiConfirmationModule'),
    loadAi('nodia-ai-execution/nodia-ai-execution.module', 'NodiaAiExecutionModule'),
    loadAi('nodia-ai-conversation/nodia-ai-conversation.module', 'NodiaAiConversationModule'),
    loadAi('finance-overview/finance-overview.module', 'FinanceOverviewModule'),
    loadAi('nodia-ai-proposal/use-case/prepare-nodia-ai-proposal.use-case', 'PrepareNodiaAiProposalUseCase'),
    loadAi('nodia-ai-execution/use-case/execute-nodia-ai-local-execution.use-case', 'ExecuteNodiaAiLocalExecutionUseCase'),
    loadAi('nodia-ai-execution/use-case/claim-nodia-ai-execution.use-case', 'ClaimNodiaAiExecutionUseCase'),
    loadAi('nodia-ai-execution/use-case/recover-nodia-ai-executions.use-case', 'RecoverNodiaAiExecutionsUseCase'),
    loadAi('nodia-ai-execution/use-case/run-nodia-ai-execution.use-case', 'RunNodiaAiExecutionUseCase'),
    loadAi('common/redis/redis.service', 'RedisService'),
    loadAi('nodia-ai-adapter/types/nodia-ai-adapter.types', 'NodiaAiAdapterPort'),
  ]);
  const nativeModules = await Promise.all(['user', 'role', 'action', 'business-action', 'module', 'module-group'].map(async name => loadAi(`${name}/${name}.module`, name.split('-').map(part => part[0].toUpperCase()+part.slice(1)).join('')+'Module')));
  const builder = Test.createTestingModule({ imports: [
    TypeOrmModule.forRootAsync({ useFactory: () => options, dataSourceFactory: async () => db }),
    Confirmation, Execution, Conversation, Overview, ...nativeModules,
  ] });
  builder.overrideProvider(Redis).useValue({ get: async () => null, set: async () => {}, del: async () => {}, keys: async () => [], delByPattern: async () => {} });
  builder.overrideProvider(Adapter).useValue(Object.fromEntries(['observe', 'execute', 'verifyConfiguration'].map(name => [name, async () => {
    providerCalls++; throw Error('Forbidden AI27 provider');
  }])));
  compiled = await builder.compile();
  prepare = compiled.get(Prepare); execute = compiled.get(Execute);
  claimer = compiled.get(Claim); recovery = compiled.get(Recover); worker = compiled.get(Run);
  const Policy = await loadAi('nodia-ai-runtime/config/runtime-policy', 'NODIA_AI_RUNTIME_POLICY');
  const parser = await loadAi('nodia-ai-conversation/nodia-ai-conversation-body-parser', 'createNodiaAiConversationBodyParser');
  const Filter = await loadAi('common/filters/all-exceptions.filter', 'AllExceptionsFilter');
  app = compiled.createNestApplication({ logger: false });
  app.setGlobalPrefix('api/v1');
  app.use('/api/v1/nodia-ai', parser(compiled.get(Policy).admission.http_json_bytes));
  app.useGlobalFilters(new Filter());
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  app.useGlobalGuards({ canActivate(context) {
    const request = context.switchToHttp().getRequest();
    const identity = identities.get(request.headers['x-fixture-actor']);
    if (!identity) throw new UnauthorizedException();
    request.auth = { user: { id: identity.userId }, sessionId: identity.sessionId };
    return true;
  } });
  await app.listen(0, '127.0.0.1');
  base = `${await app.getUrl()}/api/v1`;
  async function request(path, { actor = '1', method = 'GET', body, status = 200, key = randomUUID() } = {}) {
    const response = await fetch(base + path, { method,
      headers: { 'content-type': 'application/json', 'x-fixture-actor': actor, 'idempotency-key': key },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    const value = response.status === 204 ? null : response.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text;
    assert.ok((Array.isArray(status) ? status : [status]).includes(response.status), `${method} ${path}: ${response.status} ${JSON.stringify(value)}`);
    return value;
  }
  // Destination catalogs are synthetic. A configured Core catalog is not touched.
  await db.query("SELECT setval(pg_get_serial_sequence('users','id'),(SELECT max(id) FROM users))");
  const [group] = await db.query("SELECT module_group_id AS id FROM modules WHERE key='nodia_ai'");
  const destinations = new Map();
  for (const [key, route] of [['users','/users'],['roles','/roles'],['actions','/actions'],['modules','/modules']]) {
    let [row] = await db.query('SELECT id::text FROM modules WHERE link=$1',[route]);
    if (!row) [row] = await db.query('INSERT INTO modules(key,link,module_group_id,sort_order) VALUES($1,$2,$3,(SELECT COALESCE(MAX(sort_order),-1)+1 FROM modules WHERE module_group_id=$3)) RETURNING id::text',['synthetic_ai27_'+key,route,group.id]);
    destinations.set(key,row.id);
    await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(1,$1),(2,$1) ON CONFLICT DO NOTHING',[row.id]);
  }
  const toolName = (resource, operation) => `nodia_${resource}_prepare_${operation}`;
  async function proposal(resource, operation, partial, actor='1', expectedStatus='ready') {
    const chat=randomUUID(),identity=identities.get(actor);
    await db.query("INSERT INTO nodia_ai_conversations(id,owner_id,client_request_id,creation_request_hash,title,expires_at) VALUES($1,$2,$3,$4,'Synthetic AI27 only',clock_timestamp()+interval '90 days')",[chat,identity.userId,randomUUID(),'a'.repeat(64)]);
    const result=await db.transaction(manager=>prepare.execute(manager,identity,{conversationId:chat,toolName:toolName(resource,operation),partial}));
    assert.equal(result.status,expectedStatus,JSON.stringify(result));return {chat,result,...result.proposal};
  }
  async function admit(p,actor='1',expectedStatus=202) {
    const challenge=await request(`/nodia-ai/proposals/${p.proposal_id}/confirmation-challenge`,{actor,method:'POST',body:{proposal_revision:p.revision,expected_hash:p.hash}});
    const value=await request(`/nodia-ai/proposals/${p.proposal_id}/confirm`,{actor,method:'POST',status:expectedStatus,body:{client_request_id:randomUUID(),proposal_revision:p.revision,expected_hash:p.hash,confirmation_token:challenge.confirmation_token}});return value.execution;
  }
  const claim=()=>claimer.execute(randomUUID());
  const status=(id,actor='1')=>request(`/nodia-ai/operations/${id}`,{actor});
  const count=async(table,where='true',values=[])=>(await db.query(`SELECT count(*)::int n FROM ${table} WHERE ${where}`,values))[0].n;
  const row=async(table,id)=>(await db.query(`SELECT * FROM ${table} WHERE id=$1`,[id]))[0];
  const drive=async id=>{for(let n=0;n<12;n++){if(!['queued','running'].includes((await row('nodia_ai_executions',id)).state))return;await worker.execute(randomUUID(),new AbortController().signal);}throw Error('Synthetic execution did not finish: '+id);};
  const translations=label=>[{key:'name',es:label+' ES',en:label+' EN'}];
  async function perform(resource,operation,partial,actor='1') {
    const p=await proposal(resource,operation,partial,actor),admitted=await admit(p,actor),acquired=await claim();
    assert.equal(acquired.executionId,admitted.execution_id);
    const result=await execute.execute(identities.get(actor),admitted.execution_id,acquired);
    assert.equal(result.state,'completed');assert.equal(result.steps.length,1);
    const [step]=await db.query('SELECT * FROM nodia_ai_execution_steps WHERE execution_id=$1',[admitted.execution_id]);
    const receipt=step.minimal_receipt;assert.equal(receipt.resource_key,resource);assert.equal(receipt.operation,operation);
    assert.equal(receipt.schema_version,1);assert.equal(Object.hasOwn(receipt,'property_id'),false);
    if(operation!=='create')assert.equal(receipt.resource_id,partial.id);
    assert.equal(result.steps[0].result_refs[0].id,receipt.resource_id);
    await execute.execute(identities.get(actor),admitted.execution_id,acquired);
    assert.equal((await status(admitted.execution_id,actor)).state,'completed');
    exercised.add(`${resource}/${operation}`);return {id:receipt.resource_id,execution:result,proposal:p,claim:acquired,step};
  }
  const rejection=async(resource,operation,partial,actor='1',expected=[400,403,404,409])=>assert.rejects(proposal(resource,operation,partial,actor),error=>expected.includes(error.getStatus?.()));
  const g=await perform('module_groups','create',{key:'synthetic_ai27_group',icon:'tools',translates:translations('Synthetic group')});
  await perform('module_groups','update',{id:g.id,icon:null,translates:translations('Changed group')});
  check('group creation and editing persist native translations atomically',await count('translations','source_entity=$1 AND source_id=$2',['module_groups',g.id])===2&&(await row('module_groups',g.id)).icon===null);
  const m=await perform('modules','create',{key:'synthetic_ai27_module',module_group_id:g.id,link:'/synthetic/ai27',icon:null,translates:translations('Synthetic module')});
  await perform('modules','update',{id:m.id,link:'/synthetic/ai27-updated',is_active:false});
  await rejection('modules','update',{id:m.id,key:'rewritten_identity'});
  check('module identity is immutable while destination metadata and activity remain editable',(await row('modules',m.id)).key==='synthetic_ai27_module'&&(await row('modules',m.id)).is_active===false);
  const a=await perform('actions','create',{key:'synthetic_ai27_action',description:'Synthetic description',translates:translations('Synthetic action')});
  await perform('actions','update',{id:a.id,description:null,is_active:false});
  check('action null description and explicit inactive state are preserved',(await row('actions',a.id)).description===null&&(await row('actions',a.id)).is_active===false);
  const role=await perform('roles','create',{key:'synthetic_ai27_role',actions:[a.id,a.id],translates:translations('Synthetic role')});
  await perform('roles','update',{id:role.id,actions:[a.id],is_active:false});
  check('role action associations are exact deduplicated and atomic',await count('role_actions','role_id=$1',[role.id])===1&&(await row('roles',role.id)).is_active===false);
  const ba=await perform('business_actions','create',{key:'synthetic_ai27_business_action',has_description:true,is_active:false,translates:translations('Synthetic BA')});
  await perform('business_actions','update',{id:ba.id,has_description:false});
  check('business-action partial edit cannot reactivate an inactive row',(await row('business_actions',ba.id)).is_active===false);
  const baUpsert=await perform('business_actions','create',{key:'synthetic_ai27_business_action'});
  check('business-action create upsert previews existing identity without applying new-record defaults',baUpsert.id===ba.id&&(await row('business_actions',ba.id)).is_active===false);
  await perform('business_actions','delete',{id:ba.id});
  check('business-action DELETE deactivates and keeps row translations and historical receipt',!!await row('business_actions',ba.id)&&await count('translations','source_entity=$1 AND source_id=$2',['business_actions',ba.id])===2);
  const user=await perform('users','create',{email:'  AI27.Synthetic@Example.Invalid  ',name:'Synthetic managed user',roles:[role.id],modules:[m.id,m.id]});
  await perform('users','update',{id:user.id,name:'Synthetic changed user',is_active:false,roles:[],modules:[]});
  check('user email normalization associations and activity use the native writer',(await row('users',user.id)).email==='ai27.synthetic@example.invalid'&&await count('user_roles','user_id=$1',[user.id])===0&&await count('user_modules','user_id=$1',[user.id])===0);
  const upsert=await perform('users','create',{email:'AI27.SYNTHETIC@EXAMPLE.INVALID',name:'Synthetic upsert keeps inactivity'});
  check('user create upsert preserves existing inactive state and exact identity',upsert.id===user.id&&(await row('users',user.id)).is_active===false);
  const roleUpsert=await perform('roles','create',{key:'synthetic_ai27_role'});
  check('role create upsert preserves existing inactive state and action assignments',roleUpsert.id===role.id&&(await row('roles',role.id)).is_active===false&&await count('role_actions','role_id=$1',[role.id])===1);
  const roleDelete=await perform('roles','delete',{id:role.id});
  check('role deletion removes native associations translations and leaves recoverable receipt',!await row('roles',role.id)&&await count('role_actions','role_id=$1',[role.id])===0&&await count('translations','source_entity=$1 AND source_id=$2',['roles',role.id])===0&&(await status(roleDelete.execution.execution_id)).state==='completed');
  await perform('actions','delete',{id:a.id});
  await perform('modules','delete',{id:m.id});
  await perform('module_groups','delete',{id:g.id});
  check('action module and group deletion preserve completed historical receipts after records disappear',!await row('actions',a.id)&&!await row('modules',m.id)&&!await row('module_groups',g.id));
  check('all seventeen native administration operations execute with exact receipt recovery',exercised.size===17);

  const TraceStore=await loadAi('nodia-ai-execution/nodia-ai-execution.service','NodiaAiExecutionService'),traceStore=compiled.get(TraceStore),traceTransaction=traceStore.transaction.bind(traceStore),statements=[];
  const traced=await admit(await proposal('actions','create',{key:'synthetic_ai27_exclusive_frontier'})),tracedClaim=await claim();
  traceStore.transaction=work=>traceTransaction(async manager=>{
    const original=manager.query;manager.query=function(sql,...args){statements.push(sql);return original.call(this,sql,...args);};
    try{return await work(manager);}finally{manager.query=original;}
  });
  try{await execute.execute(identities.get('1'),traced.execution_id,tracedClaim);}finally{traceStore.transaction=traceTransaction;}
  const authorityLocks=statements.filter(sql=>sql.startsWith('LOCK TABLE actions,'));
  check('compiled Core execution takes one exclusive authority frontier before its first read without lock upgrade or native timeout reset',authorityLocks.length===1&&authorityLocks[0].includes('SHARE ROW EXCLUSIVE')&&statements[0].startsWith('SET LOCAL lock_timeout')&&statements[1].startsWith('SET LOCAL statement_timeout')&&statements[2]===authorityLocks[0]&&statements.filter(sql=>sql.startsWith('SET LOCAL statement_timeout')).length===1);

  const [sa]=await db.query("SELECT id::text FROM roles WHERE key='super_admin'");
  await rejection('roles','delete',{id:sa.id});await rejection('roles','update',{id:sa.id,is_active:false});await rejection('roles','update',{id:sa.id,key:'ordinary'});
  await rejection('users','update',{id:'3',is_active:false});
  check('reserved super-admin identity and the last active super-admin reject unsafe previews',(await row('roles',sa.id)).is_active&&(await row('users','3')).is_active);
  for (const [resource,input] of [['users',{id:user.id,roles:['9223372036854775807']}],['roles',{key:'synthetic_ai27_invalid_role',actions:['unknown:synthetic:action']}],['modules',{key:'synthetic_ai27_orphan',module_group_id:'9223372036854775807',link:'/synthetic/orphan'}]])await rejection(resource,resource==='users'?'update':'create',input);
  check('unknown user role action and module group associations reject before native mutation',await count('roles',"key='synthetic_ai27_invalid_role'")===0&&await count('modules',"key='synthetic_ai27_orphan'")===0);
  await rejection('users','update',{id:user.id,google_sub:'forged'});await rejection('actions','delete',{id:'01'});
  check('closed schemas reject internal identity fields and imprecise catalog IDs');

  const stale=await proposal('users','update',{id:user.id,name:'Do not overwrite concurrent changes'});
  await request(`/users/${user.id}`,{method:'PUT',body:{name:'Native concurrent correction'}});
  await admit(stale,'1',409);
  check('material native user edits invalidate an exact confirmed snapshot',(await row('users',user.id)).name==='Native concurrent correction');
  const targetRole=(await request('/roles',{method:'POST',status:201,body:{key:'synthetic_ai27_snapshot_role'}})).id;
  await db.query("INSERT INTO actions(id,key) VALUES(900001,'synthetic_ai27_numeric_target'),(900002,'900001')");
  await db.query("SELECT setval(pg_get_serial_sequence('actions','id'),(SELECT max(id) FROM actions))");
  await perform('roles','update',{id:targetRole,actions:['900001','900002']});
  check('numeric action keys cannot alias or replace canonical action IDs in the native writer',await count('role_actions','role_id=$1 AND action_id=ANY($2::bigint[])',[targetRole,['900001','900002']])===2);
  const staleAssociations=await proposal('users','update',{id:user.id,roles:[targetRole]});
  await request(`/roles/${targetRole}`,{method:'PUT',body:{key:'synthetic_ai27_changed_role'}});
  await admit(staleAssociations,'1',409);
  check('association labels and activity are material even when the intended IDs are unchanged',await count('user_roles','user_id=$1 AND role_id=$2',[user.id,targetRole])===0);
  const occupiedGroup=(await request('/module-groups',{method:'POST',status:201,body:{key:'synthetic_ai27_occupied_group'}})).id;
  const occupiedModule=(await request('/modules',{method:'POST',status:201,body:{key:'synthetic_ai27_occupied_module',module_group_id:occupiedGroup,link:'/synthetic/occupied'}})).id;
  await rejection('module_groups','delete',{id:occupiedGroup});
  check('group deletion retains the native child-module invariant',!!await row('modules',occupiedModule));

  // NI-13 is exercised both through Core proposals and competing native roots.
  await request('/users/2',{method:'PUT',body:{roles:[sa.id]}});
  const pSa2=await proposal('users','update',{id:'2',is_active:false}),pSa3=await proposal('users','update',{id:'3',is_active:false});
  const eSa2=await admit(pSa2),eSa3=await admit(pSa3),cSa2=await claim(),cSa3=await claim();
  const saOutcomes=await Promise.allSettled([execute.execute(identities.get('1'),eSa2.execution_id,cSa2),execute.execute(identities.get('1'),eSa3.execution_id,cSa3)]);
  for(const [index,outcome] of saOutcomes.entries())if(outcome.status==='rejected')await recovery.execute([cSa2,cSa3][index],'nodia_ai:preconditions_changed');
  const adminCount=(await db.query("SELECT count(DISTINCT u.id)::int n FROM users u JOIN user_roles ur ON ur.user_id=u.id AND ur.is_active JOIN roles r ON r.id=ur.role_id AND r.is_active AND r.key='super_admin' WHERE u.is_active"))[0].n;
  check('two concurrently confirmed last-admin changes serialize and retain exactly one active super-admin',adminCount===1);
  await request('/users/2',{method:'PUT',body:{is_active:true,roles:[sa.id]}});await request('/users/3',{method:'PUT',body:{is_active:true,roles:[sa.id]}});
  const nativeAdmins=await Promise.all([request('/users/2',{method:'PUT',body:{is_active:false},status:[200,403]}),request('/users/3',{method:'PUT',body:{is_active:false},status:[200,403]})]);
  check('native concurrent writers preserve NI-13 under the same exclusive frontier',nativeAdmins.filter(value=>value?.statusCode===403).length===1);
  await request('/users/3',{method:'PUT',body:{is_active:true,roles:[sa.id]}});await request('/users/2',{method:'PUT',body:{is_active:true,roles:[]}});

  const revoked=await admit(await proposal('users','update',{id:user.id,name:'Forbidden revoked destination'},'2'),'2');
  await db.query('DELETE FROM user_modules WHERE user_id=2 AND module_id=$1',[destinations.get('users')]);await drive(revoked.execution_id);
  await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(2,$1)',[destinations.get('users')]);
  check('destination module revocation before execution blocks the admitted Core mutation',(await status(revoked.execution_id,'2')).state==='failed'&&(await row('users',user.id)).name!=='Forbidden revoked destination');
  const revokedSession=await admit(await proposal('actions','create',{key:'synthetic_ai27_revoked_session'},'2'),'2');
  await db.query('UPDATE auth_sessions SET revoked_at=clock_timestamp() WHERE public_id=$1',[identities.get('2').sessionId]);await drive(revokedSession.execution_id);
  await db.query('UPDATE auth_sessions SET revoked_at=NULL WHERE public_id=$1',[identities.get('2').sessionId]);
  check('session revocation before execution prevents a confirmed administrative write',(await status(revokedSession.execution_id,'2')).state==='failed'&&await count('actions',"key='synthetic_ai27_revoked_session'")===0);

  const precedingRevocation=await admit(await proposal('actions','create',{key:'synthetic_ai27_waited_revocation'},'2'),'2'),precedingClaim=await claim();
  const gate=db.createQueryRunner();await gate.connect();await gate.startTransaction();
  await gate.query('LOCK TABLE actions, auth_sessions, module_groups, modules, role_actions, roles, user_modules, user_roles, users IN SHARE ROW EXCLUSIVE MODE');
  await gate.query('DELETE FROM user_modules WHERE user_id=2 AND module_id=$1',[destinations.get('actions')]);
  const pendingEffect=execute.execute(identities.get('2'),precedingRevocation.execution_id,precedingClaim).then(value=>({value}),error=>({error}));
  let waited=false;
  for(let attempt=0;attempt<30;attempt++) {
    waited=(await db.query("SELECT EXISTS(SELECT 1 FROM pg_locks l JOIN pg_class c ON c.oid=l.relation WHERE c.relname='actions' AND NOT l.granted AND l.mode='ShareRowExclusiveLock') AS waiting"))[0].waiting;
    if(waited)break;await delay(20);
  }
  await gate.commitTransaction();await gate.release();const deniedAfterWait=await pendingEffect;
  assert.ok(deniedAfterWait.error,'revocation preceding the effect must reject');await recovery.execute(precedingClaim,'nodia_ai:capability_denied');
  await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(2,$1)',[destinations.get('actions')]);
  check('exclusive effect waiting behind an uncommitted native revocation reads the subsequent authority snapshot',waited&&await count('actions',"key='synthetic_ai27_waited_revocation'")===0&&(await status(precedingRevocation.execution_id,'2')).state==='failed');

  const selfRemoval=await proposal('users','update',{id:'2',modules:[...destinations.values()].filter(id=>id!==destinations.get('users'))},'2');
  const impact=selfRemoval.steps[0].changes.find(change=>change.field_key==='access_impact');
  check('self access-loss preview includes affected users and removed destination assignments',impact&&JSON.stringify(impact).includes('2')&&JSON.stringify(impact).includes(destinations.get('users')));
  const removed=await admit(selfRemoval,'2'),removedClaim=await claim();
  await execute.execute(identities.get('2'),removed.execution_id,removedClaim);
  await request('/users/2',{method:'PUT',body:{modules:[...(await db.query("SELECT id::text FROM modules WHERE key='nodia_ai'")).map(value=>value.id),...destinations.values()]}});
  const removalState=await status(removed.execution_id,'2');
  check('a confirmed self-removal commits exactly and its receipt survives loss and restoration of access',removalState.state==='completed'&&removalState.steps[0].result_refs[0].id==='2');

  // Receipt failure must unwind every field association and translation in the same native transaction.
  const receiptFailure=async work=>{
    await db.query("CREATE FUNCTION synthetic_ai27_receipt_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.state='completed' THEN RAISE EXCEPTION 'synthetic_ai27_receipt_failure' USING ERRCODE='P0001'; END IF; RETURN NEW; END $$; CREATE TRIGGER synthetic_ai27_receipt_failure BEFORE UPDATE ON nodia_ai_execution_steps FOR EACH ROW EXECUTE FUNCTION synthetic_ai27_receipt_failure()");
    try{await assert.rejects(work);}finally{await db.query('DROP TRIGGER synthetic_ai27_receipt_failure ON nodia_ai_execution_steps;DROP FUNCTION synthetic_ai27_receipt_failure()');}
  };
  const atomicUser=await admit(await proposal('users','update',{id:user.id,name:'Must roll back',roles:[targetRole],modules:[destinations.get('users')]})),atomicUserClaim=await claim();
  const beforeUser=await row('users',user.id),beforeRoles=await count('user_roles','user_id=$1',[user.id]),beforeModules=await count('user_modules','user_id=$1',[user.id]);
  await receiptFailure(()=>execute.execute(identities.get('1'),atomicUser.execution_id,atomicUserClaim));await recovery.execute(atomicUserClaim,'nodia_ai:execution_conflict');
  check('receipt failure rolls back user fields roles and module replacements atomically',(await row('users',user.id)).name===beforeUser.name&&await count('user_roles','user_id=$1',[user.id])===beforeRoles&&await count('user_modules','user_id=$1',[user.id])===beforeModules);
  const atomicRole=await admit(await proposal('roles','update',{id:targetRole,key:'synthetic_ai27_receipt_role',translates:translations('Must rollback translation')})),atomicRoleClaim=await claim();
  const beforeRole=await row('roles',targetRole),beforeTranslations=await count('translations');
  await receiptFailure(()=>execute.execute(identities.get('1'),atomicRole.execution_id,atomicRoleClaim));await recovery.execute(atomicRoleClaim,'nodia_ai:execution_conflict');
  check('receipt failure rolls back native role metadata and translations with no independent commit',(await row('roles',targetRole)).key===beforeRole.key&&await count('translations')===beforeTranslations);

  // Native bridge rejects a transaction that only holds the shared domain frontier.
  const SaveUser=await loadAi('user/use-case/save-user.use-case','SaveUserUseCase'),saveUser=compiled.get(SaveUser);
  await assert.rejects(db.transaction(manager=>saveUser.execute(user.id,{name:'Forbidden weak transaction'},{...identities.get('1'),transaction:manager})),error=>error.getStatus?.()===403);
  check('native inherited Core writer rejects an active manager without exclusive proof',(await row('users',user.id)).name===beforeUser.name);

  const waitFor=async(read,predicate,description,timeout=20000)=>{const deadline=Date.now()+timeout;while(Date.now()<deadline){const value=await read();if(predicate(value))return value;await delay(30);}throw Error('Timed out: '+description);};
  const childWorker=async()=>{
    const child=fork(fileURLToPath(new URL('./nodia-ai-ai27-worker.fixture.mjs',import.meta.url)),[],{cwd:fileURLToPath(new URL('..',import.meta.url)),windowsHide:true,silent:true,env:{...process.env,DOTENV_CONFIG_PATH:process.platform==='win32'?'NUL':'/dev/null',NODIA_AI27_FIXTURE_DB:JSON.stringify(options)}});
    children.add(child);const messages=[];let output='',exited;
    child.on('message',message=>messages.push(message));child.on('exit',(code,signal)=>{exited={code,signal};children.delete(child);});child.on('error',error=>{exited={message:error.message};});
    for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{output=(output+chunk.toString()).slice(-32768);});
    const next=async type=>waitFor(async()=>{const message=messages.find(value=>value.type===type||value.type==='error');if(message?.type==='error')throw Error(JSON.stringify(message));if(exited)throw Error(`Child exited ${JSON.stringify(exited)} ${output}`);return message;},Boolean,'child '+type);
    await next('ready');return {child,next};
  };
  const crashed=await admit(await proposal('actions','create',{key:'synthetic_ai27_crash_resume'}));
  const crashing=await childWorker();crashing.child.send({type:'claim',workerId:randomUUID()});assert.equal((await crashing.next('claimed')).claim.executionId,crashed.execution_id);await kill(crashing.child);
  await db.query("UPDATE nodia_ai_jobs SET lease_until=clock_timestamp()-interval '1 second' WHERE execution_id=$1",[crashed.execution_id]);await recovery.execute();const crashResult=await status(crashed.execution_id);
  check('real child death after claim leaves no administrative mutation and permits explicit recovery',crashResult.state==='failed'&&crashResult.can_resume&&await count('actions',"key='synthetic_ai27_crash_resume'")===0);
  const resumeBody={client_request_id:randomUUID(),expected_execution_revision:crashResult.revision};
  await request(`/nodia-ai/operations/${crashed.execution_id}/resume`,{method:'POST',status:202,body:resumeBody});await request(`/nodia-ai/operations/${crashed.execution_id}/resume`,{method:'POST',status:202,body:resumeBody});
  await drive(crashed.execution_id);
  check('duplicate human resume commits one Core catalog row and its exact receipt',(await status(crashed.execution_id)).state==='completed'&&await count('actions',"key='synthetic_ai27_crash_resume'")===1);
  const lost=await admit(await proposal('actions','create',{key:'synthetic_ai27_lost_commit'})),lostClaim=await claim();
  const Store=await loadAi('nodia-ai-execution/nodia-ai-execution.service','NodiaAiExecutionService'),store=compiled.get(Store),transaction=store.transaction.bind(store);
  store.transaction=async work=>{await transaction(work);throw Error('synthetic_ai27_post_commit_response_lost');};
  try{await assert.rejects(execute.execute(identities.get('1'),lost.execution_id,lostClaim),error=>error.getStatus?.()===503);}finally{store.transaction=transaction;}
  await recovery.execute();const recovered=await execute.execute(identities.get('1'),lost.execution_id,lostClaim);
  check('lost Core COMMIT response recovers historical receipt without replaying native creation',recovered.state==='completed'&&await count('actions',"key='synthetic_ai27_lost_commit'")===1);
  check('administrative effects never invoke providers or inference slots',providerCalls===0&&await count('nodia_ai_runtime_slots')===0);
  check('execution attempts and leases finish without orphaned jobs',await count('nodia_ai_job_attempts','ended_at IS NULL')===0&&await count('nodia_ai_jobs',"state='leased'")===0);
  console.log(JSON.stringify({stage:'AI-27',scope:'compiled_http_confirmation_worker_disposable_postgresql_seventeen_core_operations_no_provider',checks:checks.length,exercised_operations:[...exercised].sort(),passed:checks},null,2));
}catch(error){console.error(JSON.stringify({stage:'AI-27',completed_checks:checks.length,last_checks:checks.slice(-4)}));throw error;}
finally{for(const child of children)await kill(child);if(app)await app.close();await fixture.close();}
