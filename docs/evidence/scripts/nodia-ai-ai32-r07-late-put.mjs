// Synthetic one-object experiment; the coordinator supplies private stdin/env.
// Two separate OS invocations are required. No business DB, inference or PUT replay.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { chmod, lstat, open, readFile, rename, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
const digest=value=>createHash('sha256').update(value).digest('hex');
export async function assertFreshLedger(file){
  try{await lstat(file);}catch(cause){if(cause?.code==='ENOENT')return;throw cause;}
  throw new Error('R07 upload ledger already exists; cleanup phase is the only recovery');
}
export function assertOwnedKey(ledger,key){
  assert(uuid(ledger.chat_id)&&uuid(ledger.attachment_id)&&uuid(ledger.generation));
  assert.equal(key,`nodia-ai/${ledger.chat_id}/${ledger.attachment_id}/${ledger.generation}`);
  assert.equal(ledger.object.key,key);
}
export function cleanupMayDelete(ledger,key){
  assertOwnedKey(ledger,key);
  return ['put_attempted','put_acknowledged','deleted_and_get_404'].includes(ledger.object.state);
}
export async function guardedLatePut({ledger,key,persist,absent,waitForPurge,put}){
  assertOwnedKey(ledger,key);assert.equal(ledger.object.state,'no_write_attempted');
  await persist();
  if(!await absent(key)){
    ledger.object.state='preexisting_do_not_delete';await persist();throw new Error('Synthetic key collision prevented');
  }
  await waitForPurge();
  ledger.object.state='put_attempted';await persist();
  await put();
  ledger.object.state='put_acknowledged';await persist();
}
async function persistPrivate(file,value){
  const temporary=file+'.pending',handle=await open(temporary,'wx',0o600);
  try{await handle.chmod(0o600);await handle.writeFile(JSON.stringify(value,null,2)+'\n');await handle.sync();}finally{await handle.close();}
  await rename(temporary,file);await chmod(file,0o600);
  const directory=await open(dirname(file),'r');try{await directory.sync();}finally{await directory.close();}
}

async function main(){
  const phase=process.argv[process.argv.indexOf('--phase')+1];assert(['upload','cleanup'].includes(phase));
  process.env.DOTENV_CONFIG_PATH='/dev/null';process.env.NODE_ENV='test';process.env.RATE_LIMIT_STORAGE='memory';
  let raw='';for await(const chunk of process.stdin){raw+=chunk;assert(Buffer.byteLength(raw)<=32768);}
  let input;try{input=JSON.parse(raw);}catch{throw new Error('Invalid private R07 descriptor');}raw='';
  assert.equal(input.stage,'AI-32-R07');assert.equal(input.purpose,'expiry_during_put');assert.equal(input.migrations_applied,26);
  assert.equal(input.sandbox.host,'127.0.0.1');assert.equal(input.sandbox.username,'ai32_r07_purge');assert.equal(input.sandbox.database,'ai32_r07_purge');
  assert(Number.isInteger(input.sandbox.port)&&input.sandbox.port>1024&&input.sandbox.port<=65535);assert(typeof input.sandbox.password==='string'&&input.sandbox.password.length>=20);
  for(const field of ['server_root','dependency_root','runtime_source_root','ledger_path'])assert(isAbsolute(input[field]));
  assert(/^ai32-r07-purge[^/]*\.json$/.test(input.ledger_path.split('/').at(-1)));
  if(phase==='upload')await assertFreshLedger(input.ledger_path);
  for(const name of ['R2_ACCOUNT_ID','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','R2_BUCKET_NAME','GEMINI_MICROSERVICE_URL','GEMINI_SERVICE_TOKEN'])assert(process.env[name]);
  const root=resolve(input.server_root),requireRuntime=createRequire(resolve(root,'package.json')),requireTests=createRequire(resolve(input.dependency_root,'package.json'));
  requireRuntime('reflect-metadata');const{DataSource}=requireRuntime('typeorm');const{TypeOrmModule}=requireRuntime('@nestjs/typeorm');const{Logger}=requireRuntime('@nestjs/common');Logger.overrideLogger(false);const{Test}=requireTests('@nestjs/testing');
  const load=async(file,name)=>(await import(pathToFileURL(resolve(root,'dist',file+'.js')).href))[name];
  const specs=[['nodia-ai-attachment/nodia-ai-attachment.module','NodiaAiAttachmentModule'],['nodia-ai-attachment/use-case/create-nodia-ai-attachment.use-case','CreateNodiaAiAttachmentUseCase'],
    ['nodia-ai-attachment/use-case/upload-nodia-ai-attachment.use-case','UploadNodiaAiAttachmentUseCase'],['nodia-ai-attachment/types/attachment-ports','NodiaAiAttachmentStorage'],
    ['nodia-ai-attachment/types/attachment-ports','NodiaAiAttachmentInspector'],['nodia-ai-attachment/adapters/storage-nodia-ai-attachment','StorageNodiaAiAttachment'],
    ['nodia-ai-attachment/adapters/http-nodia-ai-attachment-inspector','HttpNodiaAiAttachmentInspector'],['common/storage/storage.service','StorageService'],
    ['common/redis/redis.service','RedisService'],['nodia-ai-adapter/types/nodia-ai-adapter.types','NodiaAiAdapterPort'],
    ['nodia-ai-runtime/config/runtime-policy','NODIA_AI_RUNTIME_POLICY'],['nodia-ai-conversation/use-case/expire-nodia-ai-conversations.use-case','ExpireNodiaAiConversationsUseCase'],
    ['nodia-ai-attachment/nodia-ai-attachment.service','NodiaAiAttachmentService'],
    ['nodia-ai-conversation/nodia-ai-conversation.service','NodiaAiConversationService'],['nodia-ai-runtime/use-case/cleanup-nodia-ai-attachments.use-case','CleanupNodiaAiAttachmentsUseCase'],
    ['nodia-ai-runtime/nodia-ai-runtime.service','NodiaAiRuntimeService']];
  const[Attachment,Create,Upload,Storage,Inspector,Adapter,HttpInspector,Cloud,Redis,ProviderPort,Policy,Expire,Attachments,Conversations,Cleanup,Runtime]=await Promise.all(specs.map(([file,name])=>load(file,name)));
  const sourceReceipts=await Promise.all([...new Set(specs.map(([file])=>file))].sort().map(async file=>({path:'dist/'+file+'.js',sha256:digest(await readFile(resolve(root,'dist',file+'.js')))})));
  for(const item of sourceReceipts)assert.equal(digest(await readFile(resolve(input.runtime_source_root,item.path))),item.sha256);
  const bytes=await readFile('/tmp/ai32-r06-synthetic.png');assert.equal(bytes.length,29076);assert.equal(digest(bytes),'e66411ae91976c0626a45a1b5e151cb49e76b0b60aac135a59395bccf20d78d7');
  const boot=(await readFile('/proc/sys/kernel/random/boot_id','utf8')).trim();
  let ledger,db,module,cloud,error=null,providerCalls=0,inspections=0,puts=0,deletes=0,verified404=0,operation='sandbox_connection';
  let reachedGate,releaseGate,rejectGate,uploadSettlement,putReleaseAuthorized=false,resourcesClosed=false;
  const atGate=new Promise(done=>{reachedGate=done;});const gate=new Promise((done,reject)=>{releaseGate=done;rejectGate=reject;});
  gate.catch(()=>undefined); // A failure before Upload starts still closes the unused gate safely.
  const checks=[],result={};const check=(name,value=true)=>{assert.ok(value,name);checks.push(name);};
  const persist=()=>persistPrivate(input.ledger_path,ledger);
  const absent=async key=>{
    assertOwnedKey(ledger,key);
    try{await cloud.downloadFile(key,bytes.length,AbortSignal.timeout(15000));return false;}
    catch(cause){if(cause?.$metadata?.httpStatusCode===404&&['NoSuchKey','NotFound'].includes(cause.name)){verified404++;return true;}throw cause;}
  };
  try{
    const options={type:'postgres',host:input.sandbox.host,port:input.sandbox.port,username:input.sandbox.username,password:input.sandbox.password,database:input.sandbox.database,
      synchronize:false,logging:false,entities:[resolve(root,'dist/**/*.entity.js')],extra:{max:5,statement_timeout:10000,connectionTimeoutMillis:10000}};
    db=await new DataSource(options).initialize();
    const[proof]=await db.query('SELECT current_database() database,current_user username');assert.deepEqual(proof,{database:'ai32_r07_purge',username:'ai32_r07_purge'});
    assert.equal((await db.query('SELECT count(*)::int n FROM migrations'))[0].n,26);
    cloud=new Cloud();const adapter=new Adapter(cloud),inspector=new HttpInspector();
    const storage={get:async(key,max,signal)=>{assertOwnedKey(ledger,key);return cloud.downloadFile(key,max,signal);},
      async put(key,path,media,signal){
        assert.equal(phase,'upload');assert.equal(media,'image/png');assert.equal(digest(await readFile(path)),digest(bytes));
        await guardedLatePut({ledger,key,persist,absent,waitForPurge:async()=>{
          reachedGate();await gate;
          assert.equal(putReleaseAuthorized,true);
          assert(ledger.purge&&ledger.purge_committed===true);
          assert.equal((await db.query('SELECT count(*)::int n FROM nodia_ai_conversations WHERE id=$1',[ledger.chat_id]))[0].n,0);
          ledger.put_started_after_purge=true;
        },put:async()=>{puts++;assert.equal(puts,1);await adapter.put(key,path,media,signal);}});
      },async delete(key){
        assert.equal(phase,'cleanup');assert(cleanupMayDelete(ledger,key));deletes++;await cloud.deleteFile(key);
      }};
    const forbid=()=>{providerCalls++;throw new Error('R07 provider call forbidden');};
    operation='compile_attachment_module';
    module=await Test.createTestingModule({imports:[TypeOrmModule.forRootAsync({useFactory:()=>options,dataSourceFactory:async()=>db}),Attachment]})
      .overrideProvider(Storage).useValue(storage).overrideProvider(Inspector).useValue({async inspect(value){inspections++;return inspector.inspect(value);}})
      .overrideProvider(Cloud).useValue(cloud).overrideProvider(ProviderPort).useValue({observe:forbid,execute:forbid,verifyConfiguration:forbid})
      .overrideProvider(Redis).useValue({get:async()=>null,set:async()=>{},del:async()=>{},keys:async()=>[]}).compile();
    await module.init();const policy=module.get(Policy);
    const expiry=new Expire(module.get(Conversations),policy,module.get(Attachments));
    const janitor=new Cleanup(new Runtime(db),storage,policy);
    if(phase==='upload'){
      operation='prepare_synthetic_upload';
      for(const table of ['businesses','invoices','nodia_ai_conversations','nodia_ai_attachments','nodia_ai_jobs'])assert.equal((await db.query(`SELECT count(*)::int n FROM ${table}`))[0].n,0);
      const identity=input.identities['1'];assert.equal(identity.userId,'1');assert(uuid(identity.sessionId));
      const chat=randomUUID();await db.query("INSERT INTO nodia_ai_conversations(id,owner_id,client_request_id,creation_request_hash,expires_at) VALUES($1,1,$2,$3,now()+interval '90 days')",[chat,randomUUID(),'a'.repeat(64)]);
      const intent=await module.get(Create).execute(identity,{conversation_id:chat,client_request_id:randomUUID(),kind:'image',byte_count:bytes.length,file_name:'synthetic-r07-late-put.png'});
      const[row]=await db.query('SELECT generation,storage_key FROM nodia_ai_attachments WHERE id=$1',[intent.attachment.attachment_id]);
      ledger={schema_version:1,stage:'AI-32-R07',purpose:'expiry_during_put',chat_id:chat,attachment_id:intent.attachment.attachment_id,generation:row.generation,
        upload_pid:process.pid,boot_id:boot,object:{key:row.storage_key,state:'no_write_attempted',bytes:bytes.length,sha256:digest(bytes)}};await persist();
      operation='inspect_and_suspend_upload';
      const upload=module.get(Upload).execute(identity,ledger.attachment_id,Readable.from([bytes]),'application/octet-stream',String(bytes.length));
      const settlement=upload.then(value=>({ok:true,value}),()=>({ok:false}));
      uploadSettlement=settlement;
      let gateDeadline;
      try{await Promise.race([atGate,settlement.then(()=>{throw new Error('Upload ended before late-PUT gate');}),new Promise((_,reject)=>{gateDeadline=setTimeout(()=>reject(new Error('Late-PUT gate deadline exceeded')),30000);})]);}
      finally{clearTimeout(gateDeadline);}
      const[writing]=await db.query('SELECT processing_started_at,write_until_at FROM nodia_ai_attachments WHERE id=$1',[ledger.attachment_id]);
      result.write_window_seconds=(new Date(writing.write_until_at)-new Date(writing.processing_started_at))/1000;
      assert.equal(result.write_window_seconds,policy.admission.upload_seconds+policy.timing.cancellation_seconds);
      check('real upload reserves its unmodified production write window before entering storage');
      // Only this synthetic chat is made due. Never rewrite upload/job deadlines.
      await db.query("UPDATE nodia_ai_conversations SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",[chat]);
      ledger.purge={before_wall_ms:Date.now(),before_monotonic_ns:process.hrtime.bigint().toString()};
      operation='expire_synthetic_chat';const expired=await expiry.execute();
      ledger.purge.after_wall_ms=Date.now();ledger.purge.after_monotonic_ns=process.hrtime.bigint().toString();ledger.purge_committed=true;await persist();assert.equal(expired.purged_chats,1);
      const[job]=await db.query("SELECT id,conversation_id,storage_key,storage_generation,recovery_descriptor,state,available_at FROM nodia_ai_jobs WHERE kind='delete_blob' AND stage_key='attachment_cleanup'");
      assert(job);assert.equal(job.conversation_id,null);assert.equal(job.storage_key,ledger.object.key);assert.equal(job.storage_generation,ledger.generation);
      assert.equal(job.recovery_descriptor.attachment_id,ledger.attachment_id);assert.equal(job.recovery_descriptor.reason,'attachment_cleanup');
      assert.deepEqual(Object.keys(job.recovery_descriptor).sort(),['attachment_id','job_id','owner_id','reason','reserved_bytes','retention_epoch','schema_version','write_deadline_until'].sort());
      ledger.cleanup_job_id=job.id;ledger.write_deadline_until=job.recovery_descriptor.write_deadline_until;await persist();
      result.minimal_witness_verified=true;result.detached_jobs=1;
      check('expiry commits while the upload is suspended and preserves only its detached generation witness',puts===0);
      const premature=await janitor.execute(job.id,true);check('manual janitor cannot delete before the original write deadline',premature.processed===0&&deletes===0);
      operation='release_late_put';putReleaseAuthorized=true;releaseGate();const terminal=await settlement;
      assert.equal(terminal.ok,false);assert.equal(ledger.object.state,'put_acknowledged');assert.equal(ledger.put_started_after_purge,true);
      check('one real R2 PUT creates the object only after chat purge and late upload cannot publish ready',puts===1&&(await db.query('SELECT count(*)::int n FROM nodia_ai_attachments'))[0].n===0);
      const downloaded=await cloud.downloadFile(ledger.object.key,bytes.length,AbortSignal.timeout(15000));assert(downloaded.equals(bytes));
      check('the post-purge cloud object exists with exact synthetic bytes and retained cleanup identity',(await db.query('SELECT count(*)::int n FROM nodia_ai_jobs WHERE id=$1',[job.id]))[0].n===1);
      result.put_started_after_purge=true;result.late_upload_published=false;result.predeadline_delete_calls=0;ledger.upload_phase_verified=true;await persist();
    }else{
      operation='reconstruct_cleanup_identity';
      assert.equal((await stat(input.ledger_path)).mode&0o777,0o600);
      ledger=JSON.parse(await readFile(input.ledger_path,'utf8'));assert.equal(ledger.stage,'AI-32-R07');assert.equal(ledger.purpose,'expiry_during_put');assert.equal(ledger.schema_version,1);
      assertOwnedKey(ledger,ledger.object.key);assert(cleanupMayDelete(ledger,ledger.object.key));assert.equal(ledger.upload_phase_verified,true);assert.equal(ledger.upload_process_closed,true);
      assert.equal(ledger.boot_id,boot);assert.notEqual(ledger.upload_pid,process.pid);assert(uuid(ledger.cleanup_job_id));
      assert.equal(ledger.object.sha256,digest(bytes));assert.equal(ledger.object.bytes,bytes.length);
      result.upload_and_cleanup_pids_differ=true;result.same_boot_monotonic=true;
      check('a different OS process reconstructs Nest janitor and exact private generation identity');
      const[job]=await db.query("SELECT id,conversation_id,storage_key,storage_generation,recovery_descriptor FROM nodia_ai_jobs WHERE id=$1 AND kind='delete_blob' AND stage_key='attachment_cleanup'",[ledger.cleanup_job_id]);
      assert(job);assert.equal(job.conversation_id,null);assert.equal(job.storage_key,ledger.object.key);assert.equal(job.storage_generation,ledger.generation);assert.equal(job.recovery_descriptor.attachment_id,ledger.attachment_id);
      assert.equal(job.recovery_descriptor.write_deadline_until,ledger.write_deadline_until);
      check('the durable SQL witness survived the closed upload process without recreating content');
      const waitStarted=process.hrtime.bigint();
      operation='wait_original_write_deadline';
      for(;;){
        const[clock]=await db.query('SELECT clock_timestamp() now');const remaining=new Date(ledger.write_deadline_until)-new Date(clock.now);
        if(remaining<=0)break;assert(Number(process.hrtime.bigint()-waitStarted)/1e9<100);await delay(Math.min(remaining+25,1000));
      }
      result.waited_real_write_window=true;
      operation='cleanup_late_object';const cleaned=await janitor.execute(ledger.cleanup_job_id,true);assert.equal(cleaned.settled,1);assert.equal(deletes,1);assert.equal(await absent(ledger.object.key),true);
      const finalMono=process.hrtime.bigint(),finalWall=Date.now();
      result.real_purge_to_get404_elapsed_ms=Number(finalMono-BigInt(ledger.purge.before_monotonic_ns))/1e6;
      result.purge_ack_to_get404_lower_elapsed_ms=Number(finalMono-BigInt(ledger.purge.after_monotonic_ns))/1e6;
      result.wall_purge_to_get404_elapsed_ms=finalWall-ledger.purge.before_wall_ms;
      assert(result.purge_ack_to_get404_lower_elapsed_ms>=0&&result.real_purge_to_get404_elapsed_ms>=result.purge_ack_to_get404_lower_elapsed_ms);
      result.elapsed_below_24h_case_observed=result.real_purge_to_get404_elapsed_ms<86400000;assert.equal(result.elapsed_below_24h_case_observed,true);
      check('the restarted janitor deletes the late real object and GET proves absence within the observed real-time bound');
      const beforeReplay=deletes,replay=await janitor.execute(ledger.cleanup_job_id,true);assert.equal(replay.processed,0);result.replay_delete_calls=deletes-beforeReplay;assert.equal(result.replay_delete_calls,0);
      check('settled generation replay cannot DELETE again or resend PUT',puts===0);
      result.final_counts={};for(const table of ['nodia_ai_conversations','nodia_ai_messages','nodia_ai_message_parts','nodia_ai_attachments','nodia_ai_jobs']){const n=(await db.query(`SELECT count(*)::int n FROM ${table}`))[0].n;assert.equal(n,0);result.final_counts[table]=n;}
      check('no private content or operational cleanup witness remains in the disposable SQL');
      ledger.object.state='deleted_and_get_404';ledger.cleanup_complete=true;ledger.cleanup_elapsed_ms=result.real_purge_to_get404_elapsed_ms;await persist();
    }
    assert.equal(providerCalls,0);
  }catch(cause){error={category:cause?.name==='AssertionError'?'assertion_failed':'contract_or_dependency_failure',operation};}
  finally{
    // Never erase an uncertain generation or its witness in upload-phase teardown.
    // Failure must abort a still-suspended PUT, never release it as teardown.
    if(phase==='upload'&&uploadSettlement)rejectGate?.(new Error('R07 suspended PUT cancelled'));
    await uploadSettlement;
    try{await module?.close();if(db?.isInitialized)await db.destroy();cloud?.onModuleDestroy();resourcesClosed=true;}
    catch{error??={category:'process_resource_close_failed'};}
    if(phase==='upload'&&ledger){ledger.upload_process_closed=resourcesClosed;try{await persist();}catch{error??={category:'private_ledger_persist_failed'};}}
  }
  console.log(JSON.stringify({stage:'AI-32-R07',scope:'real_late_PUT_after_chat_expiry_and_reconstructed_janitor',phase,status:error?'failed':'passed',
    configured_database_used:false,configured_business_records_modified:0,synthetic_only:true,provider_generations:providerCalls,put_calls:puts,delete_calls:deletes,verified_get_404:verified404,
    inspector_calls:inspections,checks:checks.length,check_names:checks,cleanup_complete:ledger?.cleanup_complete===true,process_closed:resourcesClosed,
    wallclock_measurement_uses_fixture_expiry_timestamp:false,clock_measurement:'same_boot_hrtime_before_expire_call_to_GET404_conservative_commit_upper_bound',write_deadline_modified:false,
    source_receipts:sourceReceipts,...result,...error?{error}:{}}));
  if(error)process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await main();
