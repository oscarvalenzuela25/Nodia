// OPERATOR ONLY. Disposable PostgreSQL + one owned real R2 object. No AI/provider or operational DB/journal.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const SOURCE='/opt/nodia/releases/nodia-server-image-generation-r02';
export const MANIFEST='bd7ae69a32effe00321226619428eeda6d468fb4cf693ca80d540abe7d081e53';
const sha=v=>createHash('sha256').update(v).digest('hex');
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X2ioAAAAASUVORK5CYII=','base64');
export function assertTarget(target,key){
  assert.ok(target&&uuid(target.chat_id)&&uuid(target.attachment_id)&&uuid(target.generation));
  assert.equal(key,`nodia-ai/${target.chat_id}/${target.attachment_id}/${target.generation}`);
}
export function assertOperation(target,command,input){
  assert.ok(['PutObjectCommand','HeadObjectCommand','GetObjectCommand','DeleteObjectCommand'].includes(command));
  assertTarget(target,input.Key);
}
function persist(file,value){
  const fd=fs.openSync(file,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_NOFOLLOW,0o600);
  try{fs.fchmodSync(fd,0o600);fs.writeFileSync(fd,typeof value==='string'?value:JSON.stringify(value)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  const d=fs.openSync(path.dirname(file),fs.constants.O_RDONLY|fs.constants.O_DIRECTORY);try{fs.fsyncSync(d);}finally{fs.closeSync(d);}
}
function source(){
  assert.equal(fs.realpathSync(SOURCE),SOURCE);const raw=fs.readFileSync(SOURCE+'/release-manifest.json');assert.equal(sha(raw),MANIFEST);
  for(const [rel,pin]of Object.entries(JSON.parse(raw).files)){
    assert.ok(!rel.startsWith('/')&&!rel.includes('..')&&!rel.includes('\\'));const f=SOURCE+'/'+rel,st=fs.lstatSync(f);
    assert.ok(st.isFile()&&!st.isSymbolicLink());assert.equal(sha(fs.readFileSync(f)),typeof pin==='string'?pin:pin.sha256);
  }
}
const safeError=e=>({error_type:/^[A-Za-z]{1,64}$/.test(e?.constructor?.name??'')?e.constructor.name:'Error',
  sql_state:typeof e?.code==='string'&&/^[0-9A-Z]{5}$/.test(e.code)?e.code:null});
async function child(input){
  assert.equal(process.getuid(),10000);assert.equal(process.getgid(),987);source();
  const target=JSON.parse(fs.readFileSync(input.work+'/target.json'));assertTarget(target,target.key);
  const require=createRequire(SOURCE+'/package.json');require('reflect-metadata');require('@nestjs/common').Logger.overrideLogger(false);
  const envFile='/opt/nodia/releases/nodia-server-ai15-20261016/.env';const envRaw=fs.readFileSync(envFile);
  assert.equal(sha(envRaw),'63bc843ea102795ffee40cf5d3a7bbe42bb71ea40795b30897c10872ca129105');
  const apiEnv=Object.fromEntries(fs.readFileSync(`/proc/${input.api_pid}/environ`,'utf8').split('\0').filter(v=>v.includes('=')).map(v=>{const n=v.indexOf('=');return[v.slice(0,n),v.slice(n+1)];}));
  assert.equal(apiEnv.DOTENV_CONFIG_PATH,envFile);assert.equal(fs.realpathSync(`/proc/${input.api_pid}/cwd`),SOURCE);
  const current={...require('dotenv').parse(envRaw),...apiEnv};assert.notEqual(input.options.database,current.POSTGRES_DB);
  Object.assign(process.env,current);process.env.DOTENV_CONFIG_PATH='/dev/null';process.env.NODE_ENV='test';
  const load=(file,name)=>import(pathToFileURL(SOURCE+'/dist/'+file+'.js').href).then(m=>m[name]);
  const {DataSource}=require('typeorm');const {HeadObjectCommand}=require('@aws-sdk/client-s3');
  const [Storage,Conversations,Attachments,Runtime,Expire,Cleanup,External,Validate]=await Promise.all([
    ['common/storage/storage.service','StorageService'],['nodia-ai-conversation/nodia-ai-conversation.service','NodiaAiConversationService'],
    ['nodia-ai-attachment/nodia-ai-attachment.service','NodiaAiAttachmentService'],['nodia-ai-runtime/nodia-ai-runtime.service','NodiaAiRuntimeService'],
    ['nodia-ai-conversation/use-case/expire-nodia-ai-conversations.use-case','ExpireNodiaAiConversationsUseCase'],
    ['nodia-ai-runtime/use-case/cleanup-nodia-ai-attachments.use-case','CleanupNodiaAiAttachmentsUseCase'],
    ['nodia-ai-recovery/use-case/update-nodia-ai-external-state.use-case','UpdateNodiaAiExternalStateUseCase'],
    ['nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case','ValidateNodiaAiRuntimePolicyUseCase'],
  ].map(([f,n])=>load(f,n)));
  const policy=new Validate().execute(JSON.parse(fs.readFileSync(SOURCE+'/dist/nodia-ai-runtime/config/runtime-policy.json')));
  let db,storage,phase='fixture',portDeletes=0;const checks=[],commands={};let absent=false;
  try{
    assert.equal(input.options.database,'ai43');assert.equal(input.options.username,'ai43');assert.equal(input.options.host,'127.0.0.1');assert.notEqual(input.options.port,5432);
    db=await new DataSource({...input.options,entities:[SOURCE+'/dist/**/*.entity.js'],migrations:[],synchronize:false,migrationsRun:false,logging:false}).initialize();
    const [identity]=await db.query('SELECT current_database() database,current_user username');assert.deepEqual(identity,{database:'ai43',username:'ai43'});
    const [baseline]=await db.query('SELECT (SELECT count(*)::int FROM nodia_ai_conversations) chats,(SELECT count(*)::int FROM nodia_ai_attachments) attachments,(SELECT count(*)::int FROM nodia_ai_jobs) jobs');
    assert.ok(Object.values(baseline).every(n=>n===0));checks.push('isolated fixture baseline zero and distinct from configured database');
    const at=new Date((await db.query('SELECT clock_timestamp() now'))[0].now);
    const fixtureNow=async()=>new Date(at); // Only these fixture UC instances; no OS/DB clock changes.
    const conversations=new Conversations(db),attachments=new Attachments(db,policy),runtime=new Runtime(db);
    conversations.now=fixtureNow;runtime.now=fixtureNow;
    let state=null,etag=null,seq=0;
    const journal=new External({read:async()=>state===null?null:{bytes:Buffer.from(state),etag},compareAndSwap:async(bytes,prior)=>{
      if(prior!==etag)return false;
      persist(input.work+`/journal-fixture-${++seq}.json`,bytes.toString('utf8'));
      state=Buffer.from(bytes);etag=`fixture-${seq}`;return true;
    }},randomUUID(),'nodia-ai-recovery/ai41-fixture-only',()=>new Date(at));
    await journal.initialize();
    const journalPort={enabled:true,recordDeletions:v=>journal.recordDeletions(v),recordResources:v=>journal.recordResources(v),
      assertResourcesRecorded:v=>journal.assertResourcesRecorded(v),confirmResources:v=>journal.confirmResources(v)};
    storage=new Storage();assert.ok(storage.s3Client&&storage.singleAttemptS3Client,'real R2 configuration required');
    for(const c of [storage.s3Client,storage.singleAttemptS3Client])c.middlewareStack.add((next,ctx)=>async args=>{
      assertOperation(target,ctx.commandName,args.input);commands[ctx.commandName]=(commands[ctx.commandName]??0)+1;
      assert.ok(commands[ctx.commandName]<=({PutObjectCommand:1,GetObjectCommand:1,HeadObjectCommand:4,DeleteObjectCommand:1}[ctx.commandName]));
      if(ctx.commandName==='PutObjectCommand')args.input.IfNoneMatch='*';
      return next(args);
    },{step:'initialize',name:'ExactOwnedFixtureOnly'});
    const head=async()=>{try{return await storage.singleAttemptS3Client.send(new HeadObjectCommand({Bucket:current.R2_BUCKET_NAME,Key:target.key}),{abortSignal:AbortSignal.timeout(15000)});}
      catch(e){if(e?.$metadata?.httpStatusCode===404&&['NotFound','NoSuchKey'].includes(e?.name))return null;throw e;}};
    phase='baseline_HEAD';assert.equal(await head(),null);checks.push('fresh exact object HEAD 404 before any PUT');
    await db.query(`INSERT INTO nodia_ai_conversations(id,owner_id,client_request_id,title,creation_request_hash,created_at,expires_at)
      VALUES($1,1,$2,'AI41 disposable real R2 cleanup',$3,$4,$5)`,[target.chat_id,randomUUID(),sha(target.chat_id),new Date(at.getTime()-90*86400000-1000),new Date(at.getTime()-1)]);
    await db.query(`INSERT INTO nodia_ai_attachments(id,conversation_id,client_request_id,request_hash,retention_epoch,kind,state,file_name,storage_key,generation,reserved_bytes,byte_count,media_type,content_hash,interpretation_revision,interpretation_reviewed,expires_at)
      VALUES($1,$2,$3,$4,1,'image','ready','synthetic-cleanup.png',$5,$6,$7,$7,'image/png',$8,0,false,$9)`,
      [target.attachment_id,target.chat_id,randomUUID(),sha(target.attachment_id),target.key,target.generation,PNG.length,sha(PNG),new Date(at.getTime()+3600000)]);
    persist(input.work+'/PUT-intent.json',{target,bytes:PNG.length,sha256:sha(PNG),maximum_PUTs:1});phase='PUT';
    await storage.uploadFileOnce(target.key,PNG,'image/png',AbortSignal.timeout(45000));
    const present=await head();assert.ok(present);assert.equal(present.ContentLength,PNG.length);assert.equal(present.ContentType,'image/png');assert.equal(present.VersionId??null,null);
    assert.equal(sha(await storage.downloadFile(target.key,PNG.length,AbortSignal.timeout(15000))),sha(PNG));checks.push('one real conditional PUT and HEAD/GET exact fixture bytes');
    const ownedStorage={delete:async key=>{assertTarget(target,key);assert.equal(++portDeletes,1);persist(input.work+'/DELETE-intent.json',{target,bytes:PNG.length,sha256:sha(PNG),maximum_delete_calls:1});await storage.deleteFile(key);}};
    const expire=new Expire(conversations,policy,attachments,journalPort),cleanup=new Cleanup(runtime,ownedStorage,policy,journalPort);
    phase='expiry';assert.equal((await expire.execute()).purged_chats,1);
    const jobs=await db.query("SELECT id,storage_key,storage_generation FROM nodia_ai_jobs WHERE kind='delete_blob' AND stage_key='attachment_cleanup'");assert.equal(jobs.length,1);assertTarget(target,jobs[0].storage_key);assert.equal(jobs[0].storage_generation,target.generation);
    phase='cleanup';assert.deepEqual(await cleanup.execute(jobs[0].id,true),{processed:1,settled:1});
    phase='HEAD_absent';assert.equal(await head(),null);absent=true;checks.push('real compiled expiry and cleanup remove exact R2 object; HEAD 404');
    assert.deepEqual(await cleanup.execute(jobs[0].id,true),{processed:0,settled:0});assert.equal(portDeletes,1);assert.equal(await head(),null);
    checks.push('duplicate cleanup is inert and performs no second DELETE');
    const [after]=await db.query('SELECT (SELECT count(*)::int FROM nodia_ai_conversations) chats,(SELECT count(*)::int FROM nodia_ai_attachments) attachments,(SELECT count(*)::int FROM nodia_ai_jobs) jobs');assert.ok(Object.values(after).every(n=>n===0));
    const js=(await journal.snapshot()).state;assert.equal(js.backups.length,0);assert.ok(js.entries.length>=1&&js.entries.every(e=>e.confirmed_at!==null));
    checks.push('fixture SQL purged, journal confirmed, no backup entries or operational journal');
    persist(input.work+'/absence-and-journal.json',{object_absent:true,target,journal:js,after});
    return{status:'passed',checks,object_absent_proven:true,port_DELETE_calls:portDeletes,R2_commands:commands,configured_database_used:false,configured_SQL_writes:0,operational_journal_access:false,
      AI_provider_calls:0,real_clock_or_live_TTL_changed:false,fixture_clock_scope:'only fixture UC instances',journal_transport:'owned local fsync CAS fixture',global_7_day_or_24_hour_acceptance:false};
  }catch(e){return{status:'failed',phase,...safeError(e),checks,object_absent_proven:absent,port_DELETE_calls:portDeletes,R2_commands:commands,AI_provider_calls:0,configured_SQL_writes:0,target_ledger_preserved:true};}
  finally{storage?.onModuleDestroy();if(db?.isInitialized)await db.destroy();}
}
async function parent(input){
  assert.equal(process.platform,'linux');assert.equal(process.getuid(),0);source();assert.ok(Number.isSafeInteger(input.api_pid)&&input.api_pid>1);
  if(process.argv.includes('--resume-before-io'))return resumeBeforeIO(input);
  assert.match(input.work,/^\/opt\/nodia\/verification\/ai41-r2-cleanup-[a-z0-9-]+$/);assert.ok(!fs.existsSync(input.work),'fresh work only; existing intent forbids replay');
  fs.mkdirSync(input.work,{mode:0o700});fs.chownSync(input.work,10000,987);
  const parentDirectory=fs.openSync(path.dirname(input.work),fs.constants.O_RDONLY|fs.constants.O_DIRECTORY);try{fs.fsyncSync(parentDirectory);}finally{fs.closeSync(parentDirectory);}
  const target={chat_id:randomUUID(),attachment_id:randomUUID(),generation:randomUUID()};target.key=`nodia-ai/${target.chat_id}/${target.attachment_id}/${target.generation}`;
  persist(input.work+'/target.json',target);
  fs.chownSync(input.work+'/target.json',10000,987);
  const {createNodiaAiIntegrationFixture}=await import(pathToFileURL(SOURCE+'/test/nodia-ai.integration.fixture.mjs').href);
  let fixture,result,cleanup=false;
  try{
    fixture=await createNodiaAiIntegrationFixture('ai43');persist(input.work+'/fixture-options.private.json',fixture.options);
    const childResult=spawnSync('/usr/bin/setpriv',['--reuid=10000','--regid=987','--clear-groups','/usr/local/bin/node',fileURLToPath(import.meta.url),'--child'],
      {input:JSON.stringify({...input,options:fixture.options}),encoding:'utf8',timeout:180000,maxBuffer:262144,env:{PATH:'/usr/local/bin:/usr/bin:/bin',HOME:'/home/nodia',LANG:'C.UTF-8',DOTENV_CONFIG_PATH:'/dev/null'}});
    persist(input.work+'/child-stdout.private.log',childResult.stdout??'');persist(input.work+'/child-stderr.private.log',childResult.stderr??'');
    assert.equal(childResult.status,0);result=JSON.parse(childResult.stdout);assert.equal(result.status,'passed');assert.equal(result.object_absent_proven,true);
  }catch(e){result??={status:'failed',...safeError(e),target_ledger_preserved:true};}
  finally{
    // Keep a failed fixture until the exact durable R2 target has been reconciled; never erase its SQL witness blindly.
    if(fixture&&result?.object_absent_proven===true){await fixture.close();cleanup=true;}
    else if(fixture?.db?.isInitialized)await fixture.db.destroy();
  }
  const report={...result,source_manifest_sha256:MANIFEST,owned_PG_cleanup_complete:cleanup,remaining_fixture_requires_exact_recovery:!cleanup,
    target_sha256:sha(JSON.stringify(target)),operational_services_changed:false};persist(input.work+'/result.json',report);console.log(JSON.stringify(report));if(report.status!=='passed'||!cleanup)process.exitCode=1;
}
async function resumeBeforeIO(input){
  assert.match(input.work,/^\/opt\/nodia\/verification\/ai41-r2-cleanup-[a-z0-9-]+$/);
  assert.equal(fs.realpathSync(input.work),input.work);
  const readOwned=name=>{const p=input.work+'/'+name,st=fs.lstatSync(p);assert.ok(st.isFile()&&!st.isSymbolicLink()&&st.nlink===1&&(st.mode&0o077)===0);return JSON.parse(fs.readFileSync(p));};
  const previous=readOwned('result.json');
  assert.equal(previous.status,'failed');assert.equal(previous.phase,'fixture');
  assert.deepEqual(previous.R2_commands,{});assert.equal(previous.port_DELETE_calls,0);
  assert.equal(previous.source_manifest_sha256,MANIFEST);
  const files=fs.readdirSync(input.work);
  assert.ok(!files.some(n=>n==='PUT-intent.json'||n==='DELETE-intent.json'||n.startsWith('journal-fixture-')||n.startsWith('resume-before-io-')));
  const target=readOwned('target.json');assertTarget(target,target.key);
  assert.equal(sha(JSON.stringify(target)),previous.target_sha256);
  const options=readOwned('fixture-options.private.json');
  persist(input.work+'/resume-before-io-intent.json',{target_sha256:previous.target_sha256,prior_result_sha256:sha(fs.readFileSync(input.work+'/result.json')),fresh_fixture_created:false});
  const r=spawnSync('/usr/bin/setpriv',['--reuid=10000','--regid=987','--clear-groups','/usr/local/bin/node',fileURLToPath(import.meta.url),'--child'],
    {input:JSON.stringify({...input,options}),encoding:'utf8',timeout:180000,maxBuffer:262144,env:{PATH:'/usr/local/bin:/usr/bin:/bin',HOME:'/home/nodia',LANG:'C.UTF-8',DOTENV_CONFIG_PATH:'/dev/null'}});
  persist(input.work+'/resume-before-io-stdout.private.log',r.stdout??'');persist(input.work+'/resume-before-io-stderr.private.log',r.stderr??'');
  let result;try{result=JSON.parse(r.stdout);assert.equal(r.status,0);}catch(e){result={status:'failed',...safeError(e)};}
  const report={...result,source_manifest_sha256:MANIFEST,same_target_and_PG:true,fresh_fixture_created:false,
    owned_PG_cleanup_complete:false,exact_owned_PG_cleanup_required_by_operator:true,original_failure_preserved:true};
  persist(input.work+'/resume-before-io-result.json',report);console.log(JSON.stringify(report));if(report.status!=='passed')process.exitCode=1;
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
  const bytes=fs.readFileSync(0);assert.ok(bytes.length<=65536);const input=JSON.parse(bytes);
  if(process.argv.includes('--child'))console.log(JSON.stringify(await child(input)));else await parent(input);
}
