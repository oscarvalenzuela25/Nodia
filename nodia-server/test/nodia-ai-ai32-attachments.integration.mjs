// Real compiled Nest/TypeORM + disposable PostgreSQL. Storage and decoding are explicitly synthetic ports.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createNodiaAiIntegrationFixture, loadAi } from './nodia-ai.integration.fixture.mjs';

const fixture=await createNodiaAiIntegrationFixture('ai32');
const {db,options,identities}=fixture;
const checks=[];
const check=(name,condition=true)=>{assert.ok(condition,name);checks.push(name);};
let compiled,failure,schemaProof;
const start=Date.now();
try {
  const [Module,Create,Upload,Manage,Service,Storage,Inspector,Policy,Conversations,Expire,RuntimeService,Cleanup]=await Promise.all([
    loadAi('nodia-ai-attachment/nodia-ai-attachment.module','NodiaAiAttachmentModule'),
    loadAi('nodia-ai-attachment/use-case/create-nodia-ai-attachment.use-case','CreateNodiaAiAttachmentUseCase'),
    loadAi('nodia-ai-attachment/use-case/upload-nodia-ai-attachment.use-case','UploadNodiaAiAttachmentUseCase'),
    loadAi('nodia-ai-attachment/use-case/manage-nodia-ai-attachment.use-case','ManageNodiaAiAttachmentUseCase'),
    loadAi('nodia-ai-attachment/nodia-ai-attachment.service','NodiaAiAttachmentService'),
    loadAi('nodia-ai-attachment/types/attachment-ports','NodiaAiAttachmentStorage'),
    loadAi('nodia-ai-attachment/types/attachment-ports','NodiaAiAttachmentInspector'),
    loadAi('nodia-ai-runtime/config/runtime-policy','NODIA_AI_RUNTIME_POLICY'),
    loadAi('nodia-ai-conversation/nodia-ai-conversation.service','NodiaAiConversationService'),
    loadAi('nodia-ai-conversation/use-case/expire-nodia-ai-conversations.use-case','ExpireNodiaAiConversationsUseCase'),
    loadAi('nodia-ai-runtime/nodia-ai-runtime.service','NodiaAiRuntimeService'),
    loadAi('nodia-ai-runtime/use-case/cleanup-nodia-ai-attachments.use-case','CleanupNodiaAiAttachmentsUseCase'),
  ]);
  const objects=new Map();let puts=0,decodeResult={mediaType:'image/png',pageCount:null,durationSeconds:null,extractedText:null};
  let onPut=async()=>{},deletes=0,failDelete=false;
  const storage={async put(key,path,_mime,signal){puts++;const bytes=await readFile(path);await onPut();signal.throwIfAborted();objects.set(key,bytes);},
    async get(key,maxBytes){const data=objects.get(key);assert.ok(data);assert.ok(data.byteLength<=maxBytes);return data;},
    async delete(key){deletes++;if(failDelete)throw Error('Synthetic delete unavailable');objects.delete(key);}};
  compiled=await Test.createTestingModule({imports:[TypeOrmModule.forRoot(options),Module]})
    .overrideProvider(Storage).useValue(storage).overrideProvider(Inspector).useValue({async inspect(){return decodeResult;}}).compile();
  await compiled.init();
  const create=compiled.get(Create),upload=compiled.get(Upload),manage=compiled.get(Manage),service=compiled.get(Service),policy=compiled.get(Policy);
  const expire=new Expire(compiled.get(Conversations),policy,service);
  const janitor=new Cleanup(new RuntimeService(db),storage,policy);
  check('actual Nest module resolves all attachment providers without ConversationModule cycle');
  check('all 26 migrations execute on empty PostgreSQL',(await db.query('SELECT count(*)::int n FROM migrations'))[0].n===26);
  const columns=await db.query("SELECT column_name FROM information_schema.columns WHERE table_name='nodia_ai_attachments'");
  check('M3 adds only one attachment table with 25 operational columns',columns.length===25);
  const schema=await db.query("SELECT count(*)::int n FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'nodia_ai_%'");
  check('NodiaAI table count is 19',schema[0].n===19);
  schemaProof={migrations:26,nodia_ai_tables:schema[0].n,attachment_columns:columns.length};
  async function chat(owner='1') {
    const id=randomUUID();
    await db.query(`INSERT INTO nodia_ai_conversations(id,owner_id,client_request_id,creation_request_hash,expires_at)
      VALUES($1,$2,$3,$4,now()+interval '90 days')`,[id,owner,randomUUID(),'a'.repeat(64)]);
    return id;
  }
  const intent=(conversation_id,changes={})=>({conversation_id,client_request_id:randomUUID(),kind:'image',byte_count:4,file_name:'synthetic.png',...changes});
  const identity=id=>identities.get(id);
  const cleanup=async()=>{await db.query("DELETE FROM nodia_ai_jobs WHERE kind='delete_blob'");await db.query('DELETE FROM nodia_ai_message_parts WHERE attachment_id IS NOT NULL');await db.query('DELETE FROM nodia_ai_attachments');objects.clear();onPut=async()=>{};decodeResult={mediaType:'image/png',pageCount:null,durationSeconds:null,extractedText:null};};
  const rejects=async(name,work,pattern)=>{await assert.rejects(work,pattern);check(name);};

  let chat1=await chat(),command=intent(chat1);
  const concurrent=await Promise.all([create.execute(identity('1'),command),create.execute(identity('1'),command)]);
  check('concurrent duplicate intents return one attachment',concurrent[0].attachment.attachment_id===concurrent[1].attachment.attachment_id);
  check('one durable intent row exists',(await db.query('SELECT count(*)::int n FROM nodia_ai_attachments'))[0].n===1);
  check('cleanup job exists before the first PUT',(await db.query("SELECT count(*)::int n FROM nodia_ai_jobs WHERE kind='delete_blob'"))[0].n===1&&puts===0);
  check('intent metadata does not disclose storage key or hash',!JSON.stringify(concurrent[0]).includes('storage_key')&&!JSON.stringify(concurrent[0]).includes('request_hash'));
  await rejects('same request changed payload conflicts',()=>create.execute(identity('1'),{...command,file_name:'other.png'}),/request_conflict/);
  await rejects('one pending upload per owner across chats',()=>create.execute(identity('1'),intent(chat1)),/execution_limit/);
  const chat2=await chat('2'),chat3=await chat('3');
  await create.execute(identity('2'),intent(chat2));
  await rejects('global two upload reservations include different owners',()=>create.execute(identity('3'),intent(chat3)),/execution_limit/);
  await cleanup();
  const raced=await Promise.allSettled([create.execute(identity('1'),intent(chat1)),create.execute(identity('1'),intent(await chat()))]);
  check('different-chat same-owner race admits exactly one reservation',raced.filter(x=>x.status==='fulfilled').length===1);
  await cleanup();

  const uploaded=await create.execute(identity('1'),intent(chat1));const aid=uploaded.attachment.attachment_id;
  const ready=await upload.execute(identity('1'),aid,Readable.from([Buffer.from('test')]),'application/octet-stream','4');
  check('bounded synthetic upload is ready with inspected MIME',ready.state==='ready'&&ready.byte_count===4&&ready.media_type==='image/png');
  check('ready commit removes orphan cleanup job',(await db.query("SELECT count(*)::int n FROM nodia_ai_jobs WHERE kind='delete_blob'"))[0].n===0);
  check('ready upload releases its active reservation',(await db.query('SELECT processing_started_at,write_until_at FROM nodia_ai_attachments WHERE id=$1',[aid]))[0].write_until_at===null);
  check('private content proxy returns exact checked bytes',(await manage.content(identity('1'),aid)).buffer.toString()==='test');
  await rejects('other user cannot read attachment',()=>manage.get(identity('2'),aid),/conversation_not_found/);
  check('super_admin may inspect attachment',(await manage.get(identity('3'),aid)).attachment_id===aid);
  await rejects('super_admin may not compose into another owner chat',()=>manage.review(identity('3'),aid,{text:'other',expected_revision:0}),/capability_denied/);
  const projection=await manage.review(identity('1'),aid,{text:'Contenido revisado por humano',expected_revision:0});
  check('human interpretation is versioned and reviewed',projection.interpretation.reviewed===true&&projection.interpretation.revision===1);
  await rejects('stale interpretation revision rejected',()=>manage.review(identity('1'),aid,{text:'rewrite',expected_revision:0}),/revision_conflict/);
  const chatRow=(await db.query('SELECT * FROM nodia_ai_conversations WHERE id=$1',[chat1]))[0];
  const bindActual=refs=>db.transaction(manager=>manage.bindForMessage(manager,identity('1'),chatRow,refs));
  check('message binding resolves reviewed text only',(await bindActual([{kind:'image',attachment_id:aid}]))[0].text==='Contenido revisado por humano');
  await rejects('wrong attachment kind rejected',()=>bindActual([{kind:'pdf',attachment_id:aid}]),/attachment_not_ready/);
  await rejects('same attachment duplicated in one message rejected',()=>bindActual([{kind:'image',attachment_id:aid},{kind:'image',attachment_id:aid}]),/invalid_input/);
  const mid=randomUUID();
  await db.query(`INSERT INTO nodia_ai_messages(id,conversation_id,seq,role,author_id,client_message_id,status,source_scope_manifest,sealed_at,input_hash)
    VALUES($1,$2,1,'user',1,$3,'sealed','{"schema_version":1,"module_routes":[]}',now(),$4)`,[mid,chat1,randomUUID(),'b'.repeat(64)]);
  await db.query("INSERT INTO nodia_ai_message_parts(message_id,conversation_id,part_index,kind,text,attachment_id) VALUES($1,$2,0,'image','Contenido revisado por humano',$3)",[mid,chat1,aid]);
  await rejects('bound interpretation cannot change past message context',()=>manage.review(identity('1'),aid,{text:'rewrite',expected_revision:1}),/attachment_already_bound/);
  await rejects('bound file cannot be discarded independently',()=>manage.discard(identity('1'),aid),/attachment_already_bound/);
  const mid2=randomUUID();
  await db.query(`INSERT INTO nodia_ai_messages(id,conversation_id,seq,role,author_id,client_message_id,status,source_scope_manifest,sealed_at,input_hash) VALUES($1,$2,1,'user',2,$3,'sealed','{"schema_version":1,"module_routes":[]}',now(),$4)`,[mid2,chat2,randomUUID(),'b'.repeat(64)]);
  await rejects('database composite FK rejects cross-chat attachment',()=>db.query("INSERT INTO nodia_ai_message_parts(message_id,conversation_id,part_index,kind,text,attachment_id) VALUES($1,$2,0,'image',NULL,$3)",[mid2,chat2,aid]),/fk_nodia_ai_message_part_attachment/);
  await db.query("UPDATE user_modules SET is_active=false WHERE user_id=1 AND module_id IN(SELECT id FROM modules WHERE key='nodia_ai')");
  await rejects('current module revocation blocks previously ready content',()=>manage.content(identity('1'),aid),/capability_denied/);
  await db.query("UPDATE user_modules SET is_active=true WHERE user_id=1 AND module_id IN(SELECT id FROM modules WHERE key='nodia_ai')");
  await cleanup();

  const wrong=await create.execute(identity('1'),intent(chat1));const beforePuts=puts;
  await rejects('actual over-size bytes rejected',()=>upload.execute(identity('1'),wrong.attachment.attachment_id,Readable.from([Buffer.from('test!')]),'application/octet-stream'),/invalid_input/);
  check('oversize stream never reaches external storage',puts===beforePuts);
  check('failed upload remains rejected with cleanup identity',(await manage.get(identity('1'),wrong.attachment.attachment_id)).state==='rejected'&&(await db.query("SELECT count(*)::int n FROM nodia_ai_jobs WHERE kind='delete_blob'"))[0].n===1);
  await rejects('unknown or rejected upload is not resent',()=>upload.execute(identity('1'),wrong.attachment.attachment_id,Readable.from([Buffer.from('test')]),'application/octet-stream'),/attachment_not_ready/);
  await cleanup();

  const pdf=await create.execute(identity('1'),intent(chat1,{kind:'pdf',file_name:'synthetic.pdf'}));
  decodeResult={mediaType:'application/pdf',pageCount:2,durationSeconds:null,extractedText:'Texto extraído del PDF sintético'};
  const pdfReady=await upload.execute(identity('1'),pdf.attachment.attachment_id,Readable.from([Buffer.from('test')]),'application/octet-stream');
  check('real extraction port text is stored unreviewed',pdfReady.interpretation.origin==='extracted'&&pdfReady.interpretation.reviewed===false);
  await rejects('extracted instructions are not automatically admitted as a command',()=>bindActual([{kind:'pdf',attachment_id:pdf.attachment.attachment_id}]),/attachment_review_required/);
  await cleanup();

  const [Admit,ProjectChat,ProjectRun,ValidateSnapshots,AuthorizeChat]=await Promise.all([
    loadAi('nodia-ai-conversation/use-case/admit-nodia-ai-message.use-case','AdmitNodiaAiMessageUseCase'),
    loadAi('nodia-ai-conversation/use-case/project-nodia-ai-conversation.use-case','ProjectNodiaAiConversationUseCase'),
    loadAi('nodia-ai-conversation/use-case/project-nodia-ai-run.use-case','ProjectNodiaAiRunUseCase'),
    loadAi('nodia-ai-conversation/use-case/validate-nodia-ai-snapshots.use-case','ValidateNodiaAiSnapshotsUseCase'),
    loadAi('nodia-ai-conversation/use-case/authorize-nodia-ai-conversation.use-case','AuthorizeNodiaAiConversationUseCase'),
  ]);
  const [connection]=await db.query("INSERT INTO ai_providers(name,fields) VALUES('Synthetic AI32 admission only','{}') RETURNING id");
  const selection={connection_id:connection.id,mode:'token_plan_web',model_id:'synthetic-ai32-admission-model',effort_id:null};
  let trustedModalities=[];
  const syntheticAdmission={async observe(){return {synthetic:true};},async prepare(_manager,actor,chat){return {
    selection,catalogVersion:'synthetic-ai32-admission/1',contextManifest:{schema_version:1,verified_modalities:trustedModalities,verified_attachment_media_types:trustedModalities.includes('pdf')?['application/pdf']:[]},
    grantScope:{conversation_id:chat.id},allowedModules:actor.modules.map(m=>m.route),allowedOperations:[]};}};
  const admit=new Admit(compiled.get(Conversations),compiled.get(AuthorizeChat),new ProjectChat(),new ProjectRun(new ValidateSnapshots()),syntheticAdmission,policy,manage);
  const admissionChats=[];
  async function admissionPdf(reviewed){const id=await chat();admissionChats.push(id);await db.query("UPDATE nodia_ai_conversations SET selected_connection_id=$2,selected_mode=$3,selected_model_id=$4 WHERE id=$1",[id,selection.connection_id,selection.mode,selection.model_id]);
    const intentResult=await create.execute(identity('1'),intent(id,{kind:'pdf',file_name:'admission.pdf'}));
    decodeResult={mediaType:'application/pdf',pageCount:1,durationSeconds:null,extractedText:null};
    await upload.execute(identity('1'),intentResult.attachment.attachment_id,Readable.from([Buffer.from('test')]),'application/octet-stream');
    if(reviewed)await manage.review(identity('1'),intentResult.attachment.attachment_id,{text:'Snapshot humano del PDF',expected_revision:0});
    return {chat:id,id:intentResult.attachment.attachment_id};}
  const reviewedInput=await admissionPdf(true);
  const reviewedAdmitted=await admit.execute(identity('1'),reviewedInput.chat,{client_message_id:randomUUID(),expected_conversation_revision:1,parts:[{kind:'pdf',attachment_id:reviewedInput.id}]});
  const reviewedPart=(await db.query('SELECT * FROM nodia_ai_message_parts WHERE message_id=$1',[reviewedAdmitted.message_id]))[0];
  check('actual message admission persists reviewed PDF text snapshot with its same-chat FK',reviewedPart.kind==='pdf'&&reviewedPart.attachment_id===reviewedInput.id&&reviewedPart.text==='Snapshot humano del PDF');
  const noProofInput=await admissionPdf(false),runCount=(await db.query('SELECT count(*)::int n FROM nodia_ai_runs'))[0].n;
  await rejects('actual admission rejects an unreviewed PDF without trusted modality proof',()=>admit.execute(identity('1'),noProofInput.chat,{client_message_id:randomUUID(),expected_conversation_revision:1,parts:[{kind:'pdf',attachment_id:noProofInput.id}]}),/attachment_review_required/);
  check('failed native admission creates no run or message',(await db.query('SELECT count(*)::int n FROM nodia_ai_runs'))[0].n===runCount&&(await db.query('SELECT count(*)::int n FROM nodia_ai_messages WHERE conversation_id=$1',[noProofInput.chat]))[0].n===0);
  trustedModalities=['pdf'];
  const nativeAdmitted=await admit.execute(identity('1'),noProofInput.chat,{client_message_id:randomUUID(),expected_conversation_revision:1,parts:[{kind:'pdf',attachment_id:noProofInput.id}]});
  const nativePart=(await db.query('SELECT * FROM nodia_ai_message_parts WHERE message_id=$1',[nativeAdmitted.message_id]))[0];
  check('trusted synthetic native proof admits PDF reference with text null',nativePart.kind==='pdf'&&nativePart.text===null&&nativePart.attachment_id===noProofInput.id);
  const reserveUsage=await db.transaction(manager=>service.usage(manager,noProofInput.chat,'1',new Date()));
  check('queued native and reviewed runs reserve bounded assistant response bytes',BigInt(reserveUsage.owner_bytes)>=BigInt(policy.results.assistant_text_utf8_bytes*2));
  await db.transaction(async manager=>{await manager.query('UPDATE nodia_ai_conversations SET active_job_id=NULL WHERE id=ANY($1::uuid[])',[admissionChats]);await manager.query('DELETE FROM nodia_ai_jobs WHERE conversation_id=ANY($1::uuid[])',[admissionChats]);await manager.query('DELETE FROM nodia_ai_conversations WHERE id=ANY($1::uuid[])',[admissionChats]);});
  await cleanup();

  async function seedReady(conversationId,count,bytes) {
    for(let i=0;i<count;i++) {const id=randomUUID(),generation=randomUUID();await db.query(`INSERT INTO nodia_ai_attachments
      (id,conversation_id,client_request_id,request_hash,retention_epoch,kind,state,file_name,storage_key,generation,reserved_bytes,byte_count,media_type,content_hash,expires_at)
      VALUES($1,$2,$3,$4,1,'image','ready','synthetic.png',$5,$6,$7,$7,'image/png',$4,now()+interval '1 day')`,[id,conversationId,randomUUID(),'c'.repeat(64),`nodia-ai/${conversationId}/${id}/${generation}`,generation,String(bytes)]);}
  }
  await seedReady(chat1,100,1);
  await rejects('100 attachment records exhaust the chat count',()=>create.execute(identity('1'),intent(chat1)),/attachment_quota/);
  await cleanup();await seedReady(chat1,5,20*1024*1024);
  await rejects('100 MiB of original objects exhaust chat storage',()=>create.execute(identity('1'),intent(chat1)),/attachment_quota/);
  await cleanup();
  for(let i=0;i<5;i++)await seedReady(await chat(),5,20*1024*1024);
  await rejects('500 MiB across chats exhaust owner storage',()=>create.execute(identity('1'),intent(chat1)),/attachment_quota/);
  await cleanup();
  await seedReady(chat1,4,20*1024*1024);await seedReady(chat1,1,20*1024*1024-1);
  const one=(await db.query('SELECT id FROM nodia_ai_attachments WHERE conversation_id=$1 LIMIT 1',[chat1]))[0].id;
  await rejects('UTF8 derivative bytes share the storage budget',()=>manage.review(identity('1'),one,{text:'á',expected_revision:0}),/attachment_quota/);
  await cleanup();
  await seedReady(chat1,4,20*1024*1024);await seedReady(chat1,1,20*1024*1024-4);
  const textMessage=randomUUID();
  await db.query(`INSERT INTO nodia_ai_messages(id,conversation_id,seq,role,author_id,client_message_id,status,source_scope_manifest,sealed_at,input_hash) VALUES($1,$2,2,'user',1,$3,'sealed','{"schema_version":1,"module_routes":[]}',now(),$4)`,[textMessage,chat1,randomUUID(),'d'.repeat(64)]);
  await db.query("INSERT INTO nodia_ai_message_parts(message_id,conversation_id,part_index,kind,text) VALUES($1,$2,0,'text','five!')",[textMessage,chat1]);
  await rejects('sealed message text and file reservations share the chat quota',()=>create.execute(identity('1'),intent(chat1)),/attachment_quota/);
  await db.query('DELETE FROM nodia_ai_messages WHERE id=$1',[textMessage]);
  await cleanup();

  let entered,release;const began=new Promise(resolve=>entered=resolve),gate=new Promise(resolve=>release=resolve);
  onPut=async()=>{entered();await gate;};
  const late=await create.execute(identity('1'),intent(chat1));
  const latePromise=upload.execute(identity('1'),late.attachment.attachment_id,Readable.from([Buffer.from('test')]),'application/octet-stream').then(()=>null,error=>error);
  await began;await manage.discard(identity('1'),late.attachment.attachment_id);release();
  const lateError=await latePromise;
  check('discard during PUT fences late ready publication',lateError?.message.includes('attachment_not_ready'));
  check('late successful object still has a durable cleanup job',objects.size===1&&(await db.query("SELECT count(*)::int n FROM nodia_ai_jobs WHERE kind='delete_blob'"))[0].n===1);
  const pending=(await db.query("SELECT * FROM nodia_ai_jobs WHERE kind='delete_blob'"))[0];
  const deletesBefore=deletes;
  check('janitor refuses DELETE before bounded write deadline',(await janitor.execute(pending.id,true)).processed===0&&deletes===deletesBefore);
  await db.query("UPDATE nodia_ai_attachments SET write_until_at=now()-interval '1 second' WHERE id=$1",[late.attachment.attachment_id]);
  await db.query("UPDATE nodia_ai_jobs SET available_at=now()-interval '1 second',recovery_descriptor=jsonb_set(recovery_descriptor,'{write_deadline_until}',to_jsonb((now()-interval '1 second')::text)) WHERE id=$1",[pending.id]);
  failDelete=true;
  check('failed DELETE remains unresolved',(await janitor.execute(pending.id,true)).settled===0);
  check('failed DELETE retains row and quota',(await db.query('SELECT count(*)::int n FROM nodia_ai_attachments'))[0].n===1&&(await db.transaction(m=>service.usage(m,chat1,'1',new Date()))).owner_bytes==='4');
  failDelete=false;
  check('manual retry after DELETE acknowledgement settles generation',(await janitor.execute(pending.id,true)).settled===1);
  check('acknowledged DELETE releases object and row',objects.size===0&&(await db.query('SELECT count(*)::int n FROM nodia_ai_attachments'))[0].n===0);
  await cleanup();

  const toPurge=await create.execute(identity('1'),intent(chat1));
  await upload.execute(identity('1'),toPurge.attachment.attachment_id,Readable.from([Buffer.from('test')]),'application/octet-stream');
  await manage.review(identity('1'),toPurge.attachment.attachment_id,{text:'Private test description',expected_revision:0});
  await db.query("UPDATE nodia_ai_conversations SET expires_at=now()-interval '1 second' WHERE id=$1",[chat1]);
  await expire.execute();
  check('chat expiry purges its attachment text and row',(await db.query('SELECT count(*)::int n FROM nodia_ai_attachments WHERE conversation_id=$1',[chat1]))[0].n===0);
  const detached=(await db.query("SELECT * FROM nodia_ai_jobs WHERE kind='delete_blob'"))[0];
  check('expiry preserves only detached object cleanup witness',detached.conversation_id===null&&detached.storage_key&&detached.storage_generation&&detached.recovery_descriptor.owner_id==='1');
  check('cleanup witness carries no filename or interpretation',!JSON.stringify(detached.recovery_descriptor).includes('Private test')&&!JSON.stringify(detached.recovery_descriptor).includes('synthetic.png'));
  const afterPurgeUsage=await db.transaction(manager=>service.usage(manager,chat2,'1',new Date()));
  check('pending detached object still counts against owner bytes',afterPurgeUsage.owner_bytes==='4');
  check('detached generation is deleted without recreating chat content',(await janitor.execute(detached.id,true)).settled===1&&objects.size===0);
  check('cleanup removes detached operational witness',(await db.query("SELECT count(*)::int n FROM nodia_ai_jobs WHERE kind='delete_blob'"))[0].n===0);
  await cleanup();
  check('no synthetic object remains after explicit cleanup',objects.size===0);
} catch(error) {failure=error;}
finally {
  await compiled?.close();await fixture.close();
}
console.log(JSON.stringify({stage:'AI-32-attachments',status:failure?'failed':'passed',configured_database_used:false,
  storage:'synthetic_in_memory_port',parser:'synthetic_metadata_port',checks:checks.length,check_names:checks,
  elapsed_ms:Date.now()-start,schema:schemaProof,cleanup_complete:true,...(failure?{error:{name:failure.name,message:failure.message}}:{})},null,2));
if(failure)throw failure;
