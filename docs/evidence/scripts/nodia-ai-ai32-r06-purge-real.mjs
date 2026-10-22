/** Actual compiled retention + janitor against an owned disposable DB and private R2 objects. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
import {Readable} from 'node:stream';
import {setTimeout as delay} from 'node:timers/promises';
const descriptor=JSON.parse(readFileSync(0,'utf8'));
const resumeUploaded=process.argv.includes('--resume-uploaded');
assert.equal(descriptor.stage,'AI-32-R06');assert.equal(descriptor.purpose,'purge');
assert.equal(descriptor.server_root,'/opt/nodia/verification/ai32-r06-compiled');
assert.equal(descriptor.sandbox.host,'127.0.0.1');assert.equal(descriptor.sandbox.database,'ai32_r06_purge');
assert.equal(descriptor.sandbox.username,'ai32_r06_purge');
assert.ok(/^\/opt\/nodia\/verification-backups\/ai32-r06-purge-[a-f0-9]{16}\/owned-r2\.json$/.test(descriptor.ledger_path));
const root=descriptor.server_root,require=createRequire(root+'/package.json');
const env=require('dotenv').parse(await fs.readFile(descriptor.runtime_source_root+'/.env'));
for(const key of ['R2_ACCOUNT_ID','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','R2_BUCKET_NAME','R2_ENDPOINT','GEMINI_MICROSERVICE_URL','GEMINI_SERVICE_TOKEN'])process.env[key]=env[key]??'';
process.env.DOTENV_CONFIG_PATH='/dev/null';process.env.NODE_ENV='test';process.env.AWS_EC2_METADATA_DISABLED='true';delete process.env.AWS_MAX_ATTEMPTS;
require('reflect-metadata');
const {DataSource}=require('typeorm'),{Test}=require('@nestjs/testing'),{TypeOrmModule}=require('@nestjs/typeorm');
const load=async(file,name)=>(await import(pathToFileURL(root+'/dist/'+file+'.js').href))[name];
const hash=data=>createHash('sha256').update(data).digest('hex');
const report={stage:'AI-32-R06',scope:'real_compiled_retention_and_r2_janitor_isolated_database',status:'running',
 observed_at_utc:new Date().toISOString(),configured_database_used:false,configured_database_modified:false,
 provider_generations:0,production_services_restarted:false,signed_urls_generated:false,object_listing_requested:false,
 raw_text_keys_credentials_exported:false,synthetic_objects_budget:2,checks:[],snapshots:[],cloud_operations:[]};
const check=(name,value=true)=>{assert.ok(value,name);report.checks.push(name);};
const ownedChats=new Set();let db,module,storage,adapter,phase='connect',deleteMode='normal',injected=false;
let ledger=JSON.parse(await fs.readFile(descriptor.ledger_path));
assert.equal(ledger.objects.length,resumeUploaded?2:0);
const saveLedger=async()=>{const temporary=descriptor.ledger_path+'.new';const handle=await fs.open(temporary,'wx',0o600);try{await handle.writeFile(JSON.stringify(ledger));await handle.sync();}finally{await handle.close();}await fs.rename(temporary,descriptor.ledger_path);};
const assertKey=key=>{const match=/^nodia-ai\/([a-f0-9-]{36})\/([a-f0-9-]{36})\/([a-f0-9-]{36})$/.exec(key);assert.ok(match&&ownedChats.has(match[1]));};
const isGone=error=>error?.$metadata?.httpStatusCode===404&&error?.name==='NoSuchKey';
const snapshot=async label=>{
 const result={label,
  chats:(await db.query('SELECT count(*)::int AS n FROM nodia_ai_conversations'))[0].n,
  attachments:(await db.query('SELECT count(*)::int AS n FROM nodia_ai_attachments'))[0].n,
  messages:(await db.query('SELECT count(*)::int AS n FROM nodia_ai_messages'))[0].n,
  parts:(await db.query('SELECT count(*)::int AS n FROM nodia_ai_message_parts'))[0].n,
  jobs:await db.query("SELECT kind,state,stage_key,count(*)::int AS count,min(attempt_count)::int AS min_attempt_count,max(attempt_count)::int AS max_attempt_count,count(*) FILTER(WHERE conversation_id IS NULL)::int AS detached_count,count(*) FILTER(WHERE storage_key IS NOT NULL AND storage_generation IS NOT NULL)::int AS generation_witnesses FROM nodia_ai_jobs GROUP BY kind,state,stage_key ORDER BY kind,state,stage_key")};
 report.snapshots.push(result);return result;
};
try{
 const options={type:'postgres',...descriptor.sandbox,synchronize:false,migrationsRun:false,logging:false,
  entities:[root+'/dist/**/*.entity.js'],extra:{max:3,connectionTimeoutMillis:5000,statement_timeout:10000}};
 db=await new DataSource(options).initialize();
 const [identity]=await db.query('SELECT current_database() AS database,current_user AS username');
 assert.equal(identity.database,'ai32_r06_purge');assert.equal(identity.username,'ai32_r06_purge');
 check('disposable database identity and26 actual migrations verified',(await db.query('SELECT count(*)::int AS n FROM migrations'))[0].n===26);
 check(resumeUploaded?'resume owns exactly one synthetic chat':'sandbox contains no prior conversations',(await snapshot(resumeUploaded?'resume_baseline':'empty_baseline')).chats===(resumeUploaded?1:0));
 phase='compiled_module';
 const [AttachmentModule,Create,Upload,StoragePort,StorageService,StorageAdapter,Policy,ConversationService,AttachmentService,Expire,Runtime,Cleanup]=await Promise.all([
  load('nodia-ai-attachment/nodia-ai-attachment.module','NodiaAiAttachmentModule'),
  load('nodia-ai-attachment/use-case/create-nodia-ai-attachment.use-case','CreateNodiaAiAttachmentUseCase'),
  load('nodia-ai-attachment/use-case/upload-nodia-ai-attachment.use-case','UploadNodiaAiAttachmentUseCase'),
  load('nodia-ai-attachment/types/attachment-ports','NodiaAiAttachmentStorage'),
  load('common/storage/storage.service','StorageService'),
  load('nodia-ai-attachment/adapters/storage-nodia-ai-attachment','StorageNodiaAiAttachment'),
  load('nodia-ai-runtime/config/runtime-policy','NODIA_AI_RUNTIME_POLICY'),
  load('nodia-ai-conversation/nodia-ai-conversation.service','NodiaAiConversationService'),
  load('nodia-ai-attachment/nodia-ai-attachment.service','NodiaAiAttachmentService'),
  load('nodia-ai-conversation/use-case/expire-nodia-ai-conversations.use-case','ExpireNodiaAiConversationsUseCase'),
  load('nodia-ai-runtime/nodia-ai-runtime.service','NodiaAiRuntimeService'),
  load('nodia-ai-runtime/use-case/cleanup-nodia-ai-attachments.use-case','CleanupNodiaAiAttachmentsUseCase')]);
 storage=new StorageService();adapter=new StorageAdapter(storage);
 assert.ok(storage.s3Client&&storage.singleAttemptS3Client);
 report.sdk_max_attempts={native:await storage.s3Client.config.maxAttempts(),nodia_ai_put:await storage.singleAttemptS3Client.config.maxAttempts()};
 assert.equal(report.sdk_max_attempts.nodia_ai_put,1);
 for(const client of [storage.s3Client,storage.singleAttemptS3Client])client.middlewareStack.addRelativeTo((next,context)=>async args=>{
  assert.ok(['PutObjectCommand','GetObjectCommand','DeleteObjectCommand'].includes(context.commandName));
  const item={command:context.commandName,phase,http_status:null};report.cloud_operations.push(item);assert.ok(report.cloud_operations.length<=24);
  try{const result=await next(args);item.http_status=result.output?.$metadata?.httpStatusCode??null;return result;}
  catch(error){item.http_status=error?.$metadata?.httpStatusCode??null;item.safe_error_category=isGone(error)?'NoSuchKey':'storage_error';throw error;}
 },{relation:'after',toMiddleware:'retryMiddleware',name:'R06OwnedObjectObservation'});
 const observedStorage={
  async put(key,path,mime,signal){assertKey(key);assert.ok(ledger.objects.length<2&&!ledger.objects.some(item=>item.key===key));
   const bytes=await fs.readFile(path);ledger.objects.push({key,sha256:hash(bytes),bytes:bytes.length,state:'put_intent'});await saveLedger();
   await adapter.put(key,path,mime,signal);ledger.objects.at(-1).state='uploaded';await saveLedger();},
  async get(key,max,signal){assertKey(key);return adapter.get(key,max,signal);},
  async delete(key){assertKey(key);await adapter.delete(key);if(deleteMode==='lose_ack_after_real_delete'&&!injected){injected=true;throw Error('local_injected_delete_acknowledgement_loss');}}
 };
 module=await Test.createTestingModule({imports:[TypeOrmModule.forRootAsync({useFactory:()=>options,dataSourceFactory:async()=>db}),AttachmentModule]})
  .overrideProvider(StorageService).useValue(storage).overrideProvider(StoragePort).useValue(observedStorage).compile();
 await module.init();const policy=module.get(Policy),create=module.get(Create),upload=module.get(Upload);
 const expire=new Expire(module.get(ConversationService),policy,module.get(AttachmentService));
 const janitor=new Cleanup(new Runtime(db),observedStorage,policy);
 check('actual validated runtime policy retains90 day owner message basis',policy.retention.chat_days===90);
 phase='owned_uploads';
 const png=await fs.readFile('/tmp/ai32-r06-synthetic.png');assert.equal(png.length,29076);assert.equal(hash(png),'e66411ae91976c0626a45a1b5e151cb49e76b0b60aac135a59395bccf20d78d7');
 const chat=resumeUploaded?(await db.query('SELECT id FROM nodia_ai_conversations'))[0].id:randomUUID();ownedChats.add(chat);
 if(!resumeUploaded)await db.query("INSERT INTO nodia_ai_conversations(id,owner_id,client_request_id,creation_request_hash,expires_at) VALUES($1,1,$2,$3,clock_timestamp()+interval '90 days')",[chat,randomUUID(),'a'.repeat(64)]);
 const rows=[];
 if(resumeUploaded){
  report.resumed_from='nodia-ai-ai32-r06-purge-real-attempt02.json';report.additional_puts_during_resume=0;
  for(const entry of ledger.objects){
   assertKey(entry.key);assert.equal(entry.state,'uploaded');
   const [row]=await db.query('SELECT id,generation,storage_key,content_hash,byte_count::text FROM nodia_ai_attachments WHERE storage_key=$1 AND conversation_id=$2',[entry.key,chat]);
   assert.ok(row&&row.content_hash===entry.sha256&&Number(row.byte_count)===entry.bytes);rows.push(row);
  }
  // Confirm the former fixture fault precisely without modifying the row.
  try{await db.query("UPDATE nodia_ai_attachments SET write_until_at=clock_timestamp()+interval '2 seconds' WHERE id=$1",[rows[1].id]);throw Error('expected_fixture_constraint');}
  catch(error){assert.equal(error?.driverError?.code??error?.code,'23514');report.previous_fixture_failure={sqlstate:'23514',constraint:error?.driverError?.constraint??error?.constraint,reason:'synthetic write deadline requires matching processing timestamp'};}
 }else for(let index=0;index<2;index++){
  const intent=await create.execute(descriptor.identities['1'],{conversation_id:chat,client_request_id:randomUUID(),kind:'image',byte_count:png.length,file_name:'synthetic-r06.png'});
  const ready=await upload.execute(descriptor.identities['1'],intent.attachment.attachment_id,Readable.from([png]),'application/octet-stream',String(png.length));
  check(`owned PNG${index+1} actual upload and HTTP inspector ready`,ready.state==='ready'&&ready.media_type==='image/png');
  const [row]=await db.query('SELECT id,generation,storage_key,content_hash,byte_count::text FROM nodia_ai_attachments WHERE id=$1',[intent.attachment.attachment_id]);
  rows.push(row);const content=await observedStorage.get(row.storage_key,png.length,AbortSignal.timeout(15000));
  check(`owned PNG${index+1} real R2 GET digest matches`,content.length===png.length&&hash(content)===row.content_hash);
 }
 let message=(await db.query('SELECT id FROM nodia_ai_messages WHERE conversation_id=$1',[chat]))[0]?.id;
 if(!message){message=randomUUID();await db.query("INSERT INTO nodia_ai_messages(id,conversation_id,seq,role,author_id,client_message_id,status,source_scope_manifest,sealed_at,input_hash) VALUES($1,$2,1,'user',1,$3,'sealed','{\"schema_version\":1,\"module_routes\":[]}',clock_timestamp(),$4)",[message,chat,randomUUID(),'b'.repeat(64)]);}
 await db.query("INSERT INTO nodia_ai_message_parts(message_id,conversation_id,part_index,kind,text) VALUES($1,$2,0,'text','synthetic retention fixture') ON CONFLICT DO NOTHING",[message,chat]);
 for(let index=0;index<rows.length;index++)await db.query("INSERT INTO nodia_ai_message_parts(message_id,conversation_id,part_index,kind,text,attachment_id) VALUES($1,$2,$3,'image',NULL,$4) ON CONFLICT DO NOTHING",[message,chat,index+1,rows[index].id]);
 await db.query("UPDATE nodia_ai_attachments SET interpretation_text='synthetic reviewed fixture',interpretation_origin='user_reviewed',interpretation_reviewed=true,interpretation_revision=1 WHERE conversation_id=$1",[chat]);
 await db.query("UPDATE nodia_ai_attachments SET processing_started_at=clock_timestamp(),write_until_at=clock_timestamp()+interval '2 seconds' WHERE id=$1",[rows[1].id]);
 // Only the disposable synthetic chat is aged: the configured DB is never connected.
 await db.query("UPDATE nodia_ai_conversations SET last_owner_message_at=clock_timestamp()-interval '91 days',expires_at=clock_timestamp()-interval '1 day' WHERE id=$1",[chat]);
 report.retention_fixture={last_owner_message_age_days:91,expiry_seeded_only_in_disposable_database:true,synthetic_future_write_window_seconds:2};
 await snapshot('ready_before_retention');phase='retention';
 const expired=await expire.execute();report.expiry_result=expired;check('actual expiry purges exactly one synthetic chat',expired.purged_chats===1);
 const detached=await snapshot('after_retention_before_cloud_delete');
 check('chat messages parts and attachment metadata cascade away',detached.chats===0&&detached.messages===0&&detached.parts===0&&detached.attachments===0);
 const jobs=await db.query("SELECT id,storage_generation,conversation_id,state,attempt_count,(recovery_descriptor->>'write_deadline_until')::timestamptz AS write_deadline FROM nodia_ai_jobs WHERE kind='delete_blob'");
 check('two generation owned deletion witnesses survive detached',jobs.length===2&&jobs.every(job=>job.conversation_id===null&&job.state==='ready'));
 const first=jobs.find(job=>job.storage_generation===rows[0].generation),second=jobs.find(job=>job.storage_generation===rows[1].generation);assert.ok(first&&second);
 const deleteCount=()=>report.cloud_operations.filter(item=>item.command==='DeleteObjectCommand').length;
 phase='write_window_guard';let before=deleteCount();const gated=await janitor.execute(second.id,true);
 check('manual cleanup respects future PUT write deadline without DELETE',gated.processed===0&&deleteCount()===before);
 phase='janitor_normal';report.normal_cleanup_result=await janitor.execute(first.id);
 check('actual janitor settles normal cloud deletion',report.normal_cleanup_result.processed===1&&report.normal_cleanup_result.settled===1);
 try{await observedStorage.get(rows[0].storage_key,png.length,AbortSignal.timeout(15000));throw Error('object_remains');}
 catch(error){check('normal janitor deletion proven by404 NoSuchKey',isGone(error));ledger.objects[0].state='verified_absent';await saveLedger();}
 await snapshot('after_normal_delete');
 await delay(Math.max(0,new Date(second.write_deadline).getTime()-Date.now()+100));
 phase='delete_ack_loss';deleteMode='lose_ack_after_real_delete';report.injected_fault={kind:'local_lost_ack_after_successful_real_DELETE',r2_outage_claimed:false};
 report.lost_ack_cleanup_result=await janitor.execute(second.id);
 check('lost DELETE acknowledgement does not settle durable witness',report.lost_ack_cleanup_result.processed===1&&report.lost_ack_cleanup_result.settled===0&&injected);
 const [waiting]=await db.query('SELECT state,attempt_count,(storage_key IS NOT NULL AND storage_generation IS NOT NULL) AS has_witness FROM nodia_ai_jobs WHERE id=$1',[second.id]);
 check('failed acknowledgement retains waiting witness and reserved ownership',waiting?.state==='waiting'&&waiting.attempt_count===1&&waiting.has_witness);
 try{await observedStorage.get(rows[1].storage_key,png.length,AbortSignal.timeout(15000));throw Error('object_remains');}
 catch(error){check('cloud effect happened despite locally lost ACK via404 NoSuchKey',isGone(error));}
 await snapshot('after_lost_ack_before_recovery');
 phase='manual_recovery';deleteMode='normal';report.manual_recovery_result=await janitor.execute(second.id,true);
 check('manual idempotent DELETE reconciles existing generation',report.manual_recovery_result.processed===1&&report.manual_recovery_result.settled===1);
 try{await observedStorage.get(rows[1].storage_key,png.length,AbortSignal.timeout(15000));throw Error('object_remains');}
 catch(error){check('recovered deletion confirmed404 NoSuchKey',isGone(error));ledger.objects[1].state='verified_absent';await saveLedger();}
 before=deleteCount();const again=await janitor.execute(second.id,true),sweep=await expire.execute();
 check('settled cleanup and expiry replay perform no additional cloud DELETE',again.processed===0&&sweep.purged_chats===0&&deleteCount()===before);
 const final=await snapshot('fully_settled');check('no content metadata or cleanup jobs survive settled purge',final.chats===0&&final.attachments===0&&final.messages===0&&final.parts===0&&final.jobs.length===0);
 report.actual_cloud_delete_operations=deleteCount();report.objects_verified_absent=ledger.objects.filter(item=>item.state==='verified_absent').length;
 report.original_payload_bytes=png.length;report.original_payload_sha256=hash(png);report.status='passed';
}catch(error){report.status='failed';report.safe_failure_phase=phase;report.safe_failure_code=/^[A-Za-z_]{1,80}$/.test(error?.code??'')?error.code:null;
 // Keep DB, descriptor and key ledger on failure. Never erase unresolved ownership.
 report.private_witnesses_retained=true;
}finally{
 if(module)await module.close();else{storage?.onModuleDestroy();if(db?.isInitialized)await db.destroy();}
}
report.completed_at_utc=new Date().toISOString();console.log(JSON.stringify(report,null,2));
if(report.status!=='passed')process.exitCode=1;
