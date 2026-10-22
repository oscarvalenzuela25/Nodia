// Human-confirmed invoice promotion, real compiled worker/SQL; private storage and parser ports are synthetic.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createNodiaAiIntegrationFixture,loadAi } from './nodia-ai.integration.fixture.mjs';
const fixture=await createNodiaAiIntegrationFixture('ai32');
const {db,options,identities}=fixture,checks=[];let compiled,failure;
const check=(name,value=true)=>{assert.ok(value,name);checks.push(name);};
const count=async(table,where='true',params=[])=>(await db.query(`SELECT count(*)::int n FROM ${table} WHERE ${where}`,params))[0].n;
try {
  const [Execution,Attachment,Prepare,Challenge,Confirm,Run,Get,CreateFile,UploadFile,Storage,Inspector,Redis,Policy,Expire,ConversationService,AttachmentService,Cleanup,RuntimeService,InvoiceRecovery,StorageService,Stage,Claim]=await Promise.all([
    loadAi('nodia-ai-execution/nodia-ai-execution.module','NodiaAiExecutionModule'),
    loadAi('nodia-ai-attachment/nodia-ai-attachment.module','NodiaAiAttachmentModule'),
    loadAi('nodia-ai-proposal/use-case/prepare-nodia-ai-proposal.use-case','PrepareNodiaAiProposalUseCase'),
    loadAi('nodia-ai-confirmation/use-case/create-nodia-ai-confirmation-challenge.use-case','CreateNodiaAiConfirmationChallengeUseCase'),
    loadAi('nodia-ai-confirmation/use-case/confirm-nodia-ai-proposal.use-case','ConfirmNodiaAiProposalUseCase'),
    loadAi('nodia-ai-execution/use-case/run-nodia-ai-execution.use-case','RunNodiaAiExecutionUseCase'),
    loadAi('nodia-ai-confirmation/use-case/get-nodia-ai-execution.use-case','GetNodiaAiExecutionUseCase'),
    loadAi('nodia-ai-attachment/use-case/create-nodia-ai-attachment.use-case','CreateNodiaAiAttachmentUseCase'),
    loadAi('nodia-ai-attachment/use-case/upload-nodia-ai-attachment.use-case','UploadNodiaAiAttachmentUseCase'),
    loadAi('nodia-ai-attachment/types/attachment-ports','NodiaAiAttachmentStorage'),
    loadAi('nodia-ai-attachment/types/attachment-ports','NodiaAiAttachmentInspector'),
    loadAi('common/redis/redis.service','RedisService'),
    loadAi('nodia-ai-runtime/config/runtime-policy','NODIA_AI_RUNTIME_POLICY'),
    loadAi('nodia-ai-conversation/use-case/expire-nodia-ai-conversations.use-case','ExpireNodiaAiConversationsUseCase'),
    loadAi('nodia-ai-conversation/nodia-ai-conversation.service','NodiaAiConversationService'),
    loadAi('nodia-ai-attachment/nodia-ai-attachment.service','NodiaAiAttachmentService'),
    loadAi('nodia-ai-runtime/use-case/cleanup-nodia-ai-attachments.use-case','CleanupNodiaAiAttachmentsUseCase'),
    loadAi('nodia-ai-runtime/nodia-ai-runtime.service','NodiaAiRuntimeService'),
    loadAi('invoice/use-case/recover-invoice-uploads.use-case','RecoverInvoiceUploadsUseCase'),
    loadAi('common/storage/storage.service','StorageService'),
    loadAi('nodia-ai-invoice-attachment/use-case/stage-nodia-ai-invoice-attachment.use-case','StageNodiaAiInvoiceAttachmentUseCase'),
    loadAi('nodia-ai-execution/use-case/claim-nodia-ai-execution.use-case','ClaimNodiaAiExecutionUseCase'),
  ]);
  const objects=new Map();let copies=0,uncertain=false,watchedKey=null,afterCopy=async()=>{};
  const storage={async get(key,max){const b=objects.get(key);assert.ok(b);assert.ok(b.length<=max);return b;},
    async put(key,path,_mime,signal){const b=await readFile(path);signal.throwIfAborted();objects.set(key,b);if(key.startsWith('invoices/')){
      copies++;watchedKey=key;
      check('domain copy starts after its durable native upload intent',await count('invoice_uploads','storage_key=$1',[key])===1);
      await afterCopy();
      if(uncertain)throw Error('Synthetic PUT acknowledgement lost');
    }},async delete(key){objects.delete(key);}};
  compiled=await Test.createTestingModule({imports:[TypeOrmModule.forRootAsync({useFactory:()=>options,dataSourceFactory:async()=>db}),Execution,Attachment]})
    .overrideProvider(Storage).useValue(storage)
    .overrideProvider(Inspector).useValue({async inspect(){return {mediaType:'image/png',pageCount:null,durationSeconds:null,extractedText:null};}})
    .overrideProvider(StorageService).useValue({async deleteFile(key){objects.delete(key);}})
    .overrideProvider(Redis).useValue({get:async()=>null,set:async()=>{},del:async()=>{},keys:async()=>[]}).compile();
  await compiled.init();
  check('compiled invoice stage resolves beside confirmation and native execution without DI cycle');
  const prepare=compiled.get(Prepare),challenge=compiled.get(Challenge),confirm=compiled.get(Confirm),worker=compiled.get(Run),get=compiled.get(Get);
  const stage=compiled.get(Stage),claim=compiled.get(Claim),policy=compiled.get(Policy);
  const identity=identities.get('1');
  let [module]=await db.query("SELECT id FROM modules WHERE link='/tools/business'");
  if(!module)[module]=await db.query("INSERT INTO modules(module_group_id,link,key) SELECT module_group_id,'/tools/business','synthetic_ai32_business' FROM modules WHERE key='nodia_ai' RETURNING id");
  await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(1,$1) ON CONFLICT DO NOTHING',[module.id]);
  const business=randomUUID();await db.query("INSERT INTO businesses(id,owner_id,name) VALUES($1,1,'Synthetic AI32 invoices')",[business]);
  const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO/a4WQAAAAASUVORK5CYII=','base64');
  async function newChat(){const id=randomUUID();await db.query("INSERT INTO nodia_ai_conversations(id,owner_id,client_request_id,creation_request_hash,expires_at) VALUES($1,1,$2,$3,now()+interval '90 days')",[id,randomUUID(),'a'.repeat(64)]);return id;}
  async function attachment(chat){const intent=await compiled.get(CreateFile).execute(identity,{conversation_id:chat,client_request_id:randomUUID(),kind:'image',byte_count:bytes.length,file_name:'receipt.png'});return compiled.get(UploadFile).execute(identity,intent.attachment.attachment_id,Readable.from([bytes]),'application/octet-stream',String(bytes.length));}
  async function proposal(chat,aid,code,extra={}){const result=await db.transaction(manager=>prepare.execute(manager,identity,{conversationId:chat,toolName:`nodia_invoices_prepare_${extra.id?'update':'create'}`,partial:{business_id:business,attachment_id:aid,code,...extra}}));assert.equal(result.status,'ready');return result.proposal;}
  async function admit(p){const token=await challenge.execute(identity,p.proposal_id,{proposal_revision:p.revision,expected_hash:p.hash});return (await confirm.execute(identity,p.proposal_id,{client_request_id:randomUUID(),proposal_revision:p.revision,expected_hash:p.hash,confirmation_token:token.confirmation_token})).execution;}
  const chat=await newChat(),file=await attachment(chat);
  check('upload alone never creates an invoice',await count('invoices')===0);
  const p=await proposal(chat,file.attachment_id,'SYN-AI32-CREATE');
  check('exact preview includes the selected attachment and inspected hash',p.steps[0].changes.some(c=>c.field_key==='attachment_id'&&c.after===file.attachment_id)&&p.steps[0].changes.some(c=>c.field_key==='attachment_content_hash'&&typeof c.after==='string'));
  check('public preview contains no private source or destination storage key',!JSON.stringify(p).includes('nodia-ai/')&&!JSON.stringify(p).includes('invoices/'));
  check('preparation performs no external copy',copies===0&&await count('invoices')===0);
  const accepted=await admit(p);
  check('human confirmation admits an effect without writing invoice yet',accepted.state==='queued'&&await count('invoices')===0&&copies===0);
  await worker.execute(randomUUID(),new AbortController().signal);
  let result=await get.execute(identity,accepted.execution_id),invoice=(await db.query("SELECT * FROM invoices WHERE code='SYN-AI32-CREATE'"))[0];
  check('worker commits one invoice and exact receipt',result.state==='completed'&&invoice&&await count('invoices')===1);
  const sourceKey=(await db.query('SELECT storage_key FROM nodia_ai_attachments WHERE id=$1',[file.attachment_id]))[0].storage_key;
  check('invoice owns an independent domain key',invoice.path_storage.startsWith(`invoices/${business}/`)&&invoice.path_storage!==sourceKey&&objects.has(invoice.path_storage));
  check('source chat still owns its original attachment',objects.has(sourceKey)&&await count('nodia_ai_attachments','id=$1',[file.attachment_id])===1);
  check('invoice intent is removed atomically with committed invoice',await count('invoice_uploads','storage_key=$1',[invoice.path_storage])===0);
  check('private stage descriptor is cleared in the effect commit',(await db.query('SELECT recovery_descriptor FROM nodia_ai_execution_steps WHERE execution_id=$1',[accepted.execution_id]))[0].recovery_descriptor===null);
  const beforeCopies=copies;
  check('idle worker does not repeat confirmed invoice copy',await worker.execute(randomUUID(),new AbortController().signal)===false&&copies===beforeCopies);
  const originalDomainKey=invoice.path_storage;
  const fileTwo=await attachment(chat),p2=await proposal(chat,fileTwo.attachment_id,'SYN-AI32-UPDATED',{id:invoice.id});
  const acceptedTwo=await admit(p2),secondClaim=await claim.execute(randomUUID());
  await stage.execute(secondClaim,new AbortController().signal);const readyCopies=copies;
  await stage.execute(secondClaim,new AbortController().signal);check('ready staged acknowledgement is reused without a second PUT',copies===readyCopies);
  const Effect=await loadAi('nodia-ai-execution/use-case/execute-nodia-ai-local-execution.use-case','ExecuteNodiaAiLocalExecutionUseCase');
  await compiled.get(Effect).execute(identity,acceptedTwo.execution_id,secondClaim);
  invoice=(await db.query('SELECT * FROM invoices WHERE id=$1',[invoice.id]))[0];
  check('replacement worker completes its independently confirmed execution',(await get.execute(identity,acceptedTwo.execution_id)).state==='completed');
  check('confirmed replacement preserves invoice identity with a new independent key',invoice.code==='SYN-AI32-UPDATED'&&invoice.path_storage!==originalDomainKey&&await count('invoices')===1);
  check('superseded domain file enters native recovery',await count('invoice_uploads','storage_key=$1',[originalDomainKey])===1);
  await compiled.get(InvoiceRecovery).execute(originalDomainKey);
  check('native recovery removes only superseded unreferenced file',!objects.has(originalDomainKey)&&objects.has(invoice.path_storage));

  const brokenChat=await newChat(),brokenFile=await attachment(brokenChat),broken=await admit(await proposal(brokenChat,brokenFile.attachment_id,'SYN-AI32-ROLLBACK'));
  await db.query("CREATE FUNCTION synthetic_ai32_invoice_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.code='SYN-AI32-ROLLBACK' THEN RAISE EXCEPTION 'synthetic_ai32_invoice_failure' USING ERRCODE='P0001'; END IF; RETURN NEW; END $$; CREATE TRIGGER synthetic_ai32_invoice_failure BEFORE INSERT ON invoices FOR EACH ROW EXECUTE FUNCTION synthetic_ai32_invoice_failure()");
  try {await worker.execute(randomUUID(),new AbortController().signal);} finally {await db.query('DROP TRIGGER synthetic_ai32_invoice_failure ON invoices;DROP FUNCTION synthetic_ai32_invoice_failure()');}
  const rolledKey=watchedKey;
  check('SQL failure after staged PUT creates no invoice or receipt',(await get.execute(identity,broken.execution_id)).state==='failed'&&await count('invoices',"code='SYN-AI32-ROLLBACK'")===0&&await count('nodia_ai_execution_steps','execution_id=$1 AND minimal_receipt IS NOT NULL',[broken.execution_id])===0);
  check('SQL rollback preserves chat file and domain compensation intent',objects.has(rolledKey)&&await count('invoice_uploads','storage_key=$1',[rolledKey])===1&&await count('nodia_ai_attachments','id=$1',[brokenFile.attachment_id])===1);
  await db.query("UPDATE invoice_uploads SET cleanup_after=now()-interval '1 second',retry_after=now()-interval '1 second' WHERE storage_key=$1",[rolledKey]);
  await compiled.get(InvoiceRecovery).execute(rolledKey);
  check('native orphan recovery cleans rolled-back domain copy',!objects.has(rolledKey)&&await count('invoice_uploads','storage_key=$1',[rolledKey])===0);

  const ResumeControl=await loadAi('nodia-ai-confirmation/use-case/control-nodia-ai-execution.use-case','ControlNodiaAiExecutionUseCase');
  const failedStatus=await get.execute(identity,broken.execution_id);
  await compiled.get(ResumeControl).execute(identity,broken.execution_id,{client_request_id:randomUUID(),expected_execution_revision:failedStatus.revision},'resume');
  await worker.execute(randomUUID(),new AbortController().signal);
  check('human resume after known SQL rollback commits one invoice effect',(await get.execute(identity,broken.execution_id)).state==='completed'&&await count('invoices',"code='SYN-AI32-ROLLBACK'")===1);
  check('human resume stages a fresh object generation instead of replaying the old uncertain key',watchedKey!==rolledKey);

  const uncertainChat=await newChat(),uncertainFile=await attachment(uncertainChat),uncertainAccepted=await admit(await proposal(uncertainChat,uncertainFile.attachment_id,'SYN-AI32-UNCERTAIN'));
  const acquired=await claim.execute(randomUUID());assert.equal(acquired.executionId,uncertainAccepted.execution_id);uncertain=true;
  await assert.rejects(()=>stage.execute(acquired,new AbortController().signal),/acknowledgement lost/);uncertain=false;
  const uncertainKey=watchedKey,once=copies;
  await assert.rejects(()=>stage.execute(acquired,new AbortController().signal),/invoice_attachment_not_staged/);
  check('uncertain PUT is never repeated for the same delivery generation',copies===once&&await count('invoices',"code='SYN-AI32-UNCERTAIN'")===0);
  check('uncertain copy retains native recovery intent',objects.has(uncertainKey)&&await count('invoice_uploads','storage_key=$1',[uncertainKey])===1);
  const Recover=await loadAi('nodia-ai-execution/use-case/recover-nodia-ai-executions.use-case','RecoverNodiaAiExecutionsUseCase');
  await compiled.get(Recover).execute(acquired,'nodia_ai:execution_conflict');
  await db.query("UPDATE invoice_uploads SET cleanup_after=now()-interval '1 second',retry_after=now()-interval '1 second' WHERE storage_key=$1",[uncertainKey]);await compiled.get(InvoiceRecovery).execute(uncertainKey);
  check('uncertain copy can be reconciled without any invoice replay',!objects.has(uncertainKey));

  const expiredLeaseChat=await newChat(),expiredLeaseFile=await attachment(expiredLeaseChat),expiredLease=await admit(await proposal(expiredLeaseChat,expiredLeaseFile.attachment_id,'SYN-AI32-LEASE'));
  const leaseClaim=await claim.execute(randomUUID());assert.equal(leaseClaim.executionId,expiredLease.execution_id);
  afterCopy=async()=>{await db.query("UPDATE nodia_ai_jobs SET lease_until=now()-interval '1 second' WHERE id=$1",[leaseClaim.jobId]);};
  await assert.rejects(()=>stage.execute(leaseClaim,new AbortController().signal),/execution_conflict/);afterCopy=async()=>{};
  await compiled.get(Recover).execute(leaseClaim,'nodia_ai:lease_lost');
  check('lease expiry after copied bytes prevents invoice association',await count('invoices',"code='SYN-AI32-LEASE'")===0&&(await get.execute(identity,expiredLease.execution_id)).state==='failed');
  check('lease expiry retains compensation for the unassociated domain object',await count('invoice_uploads','storage_key=$1',[watchedKey])===1);
  const cancelChat=await newChat(),cancelFile=await attachment(cancelChat),canceled=await admit(await proposal(cancelChat,cancelFile.attachment_id,'SYN-AI32-CANCEL'));
  const Control=await loadAi('nodia-ai-confirmation/use-case/control-nodia-ai-execution.use-case','ControlNodiaAiExecutionUseCase');
  afterCopy=async()=>{const current=await get.execute(identity,canceled.execution_id);await compiled.get(Control).execute(identity,canceled.execution_id,{client_request_id:randomUUID(),expected_execution_revision:current.revision},'cancel');};
  await worker.execute(randomUUID(),new AbortController().signal);afterCopy=async()=>{};
  check('human cancellation during copy creates no financial record before reconciliation',await count('invoices',"code='SYN-AI32-CANCEL'")===0);
  await compiled.get(Recover).execute();
  check('maintenance reconciles human cancellation after external copy',(await get.execute(identity,canceled.execution_id)).state==='cancelled'&&await count('invoices',"code='SYN-AI32-CANCEL'")===0);
  check('cancelled copy retains native object cleanup intent',await count('invoice_uploads','storage_key=$1',[watchedKey])===1);
  const receiptChat=await newChat(),receiptFile=await attachment(receiptChat),receiptFailure=await admit(await proposal(receiptChat,receiptFile.attachment_id,'SYN-AI32-RECEIPT-ROLLBACK'));
  await db.query(`CREATE FUNCTION synthetic_ai32_receipt_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.execution_id='${receiptFailure.execution_id}'::uuid AND NEW.state='completed' THEN RAISE EXCEPTION 'synthetic_ai32_receipt_failure' USING ERRCODE='P0001'; END IF; RETURN NEW; END $$; CREATE TRIGGER synthetic_ai32_receipt_failure BEFORE UPDATE ON nodia_ai_execution_steps FOR EACH ROW EXECUTE FUNCTION synthetic_ai32_receipt_failure()`);
  try{await worker.execute(randomUUID(),new AbortController().signal);}finally{await db.query('DROP TRIGGER synthetic_ai32_receipt_failure ON nodia_ai_execution_steps;DROP FUNCTION synthetic_ai32_receipt_failure()');}
  check('failure while writing receipt rolls back invoice and intent removal together',await count('invoices',"code='SYN-AI32-RECEIPT-ROLLBACK'")===0&&await count('invoice_uploads','storage_key=$1',[watchedKey])===1);
  check('failed receipt transaction has no durable successful result',await count('nodia_ai_execution_steps','execution_id=$1 AND minimal_receipt IS NOT NULL',[receiptFailure.execution_id])===0);

  const staleChat=await newChat(),staleFile=await attachment(staleChat),staleProposal=await proposal(staleChat,staleFile.attachment_id,'SYN-AI32-STALE');
  await db.query('UPDATE nodia_ai_attachments SET content_hash=$2 WHERE id=$1',[staleFile.attachment_id,'e'.repeat(64)]);
  await assert.rejects(()=>admit(staleProposal),/preconditions_changed/);
  check('material file mutation invalidates exact human confirmation',await count('invoices',"code='SYN-AI32-STALE'")===0);
  const expiry=new Expire(compiled.get(ConversationService),policy,compiled.get(AttachmentService));
  await db.query("UPDATE nodia_ai_conversations SET expires_at=now()-interval '1 second' WHERE id=$1",[chat]);await expiry.execute();
  const janitor=new Cleanup(new RuntimeService(db),storage,policy);
  const jobs=await db.query("SELECT id FROM nodia_ai_jobs WHERE kind='delete_blob' AND stage_key='attachment_cleanup'");for(const job of jobs)await janitor.execute(job.id,true);
  check('expiry removes original chat copies and all interpretation',!objects.has(sourceKey)&&await count('nodia_ai_attachments','conversation_id=$1',[chat])===0);
  check('expiry preserves independently owned invoice file and business record',objects.has(invoice.path_storage)&&await count('invoices','id=$1',[invoice.id])===1);
  check('no invoice was created from uncertain or expired staging',await count('invoices')===2);
} catch(error){failure=error;} finally {await compiled?.close();await fixture.close();}
console.log(JSON.stringify({stage:'AI-32-invoice-attachments',status:failure?'failed':'passed',configured_database_used:false,storage:'synthetic_private_port',parser:'synthetic_metadata_port',checks:checks.length,check_names:checks,cleanup_complete:true,...(failure?{error:{name:failure.name,message:failure.message}}:{})},null,2));
if(failure)throw failure;
