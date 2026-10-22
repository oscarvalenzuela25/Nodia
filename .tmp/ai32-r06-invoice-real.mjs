// Run only through the R06 VM coordinator: private descriptor on stdin and
// allowlisted R2/inspector environment in memory. No configured SQL or inference.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { chmod, open, readFile, rename, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';

process.env.DOTENV_CONFIG_PATH = '/dev/null';
process.env.NODE_ENV = 'test';
process.env.RATE_LIMIT_STORAGE = 'memory';
let input = '';
for await (const chunk of process.stdin) { input += chunk; assert(Buffer.byteLength(input) <= 32768); }
let descriptor;
try { descriptor = JSON.parse(input); } catch { throw new Error('Invalid private R06 descriptor'); }
input = '';
assert.equal(descriptor.stage, 'AI-32-R06'); assert.equal(descriptor.purpose, 'invoice');
assert.equal(descriptor.migrations_applied, 26);
assert.equal(descriptor.sandbox.host, '127.0.0.1');
assert.equal(descriptor.sandbox.username, 'ai32_r06_invoice');
assert.equal(descriptor.sandbox.database, 'ai32_r06_invoice');
assert(Number.isInteger(descriptor.sandbox.port) && descriptor.sandbox.port > 1024 && descriptor.sandbox.port <= 65535);
assert(typeof descriptor.sandbox.password === 'string' && descriptor.sandbox.password.length >= 20);
for (const name of ['server_root', 'dependency_root', 'ledger_path']) assert(isAbsolute(descriptor[name]));
assert(/^ai32-r06-invoice[^/]*\.json$/.test(descriptor.ledger_path.split('/').at(-1)));
for (const name of ['R2_ACCOUNT_ID','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','R2_BUCKET_NAME','GEMINI_MICROSERVICE_URL','GEMINI_SERVICE_TOKEN']) assert(process.env[name]);

const root = resolve(descriptor.server_root);
const requireRuntime = createRequire(resolve(root, 'package.json'));
const requireTests = createRequire(resolve(descriptor.dependency_root, 'package.json'));
requireRuntime('reflect-metadata');
const { DataSource } = requireRuntime('typeorm');
const { TypeOrmModule } = requireRuntime('@nestjs/typeorm');
const { Logger } = requireRuntime('@nestjs/common'); Logger.overrideLogger(false);
const { Test } = requireTests('@nestjs/testing');
const load = async (file, name) => (await import(pathToFileURL(resolve(root, 'dist', file + '.js')).href))[name];
const hash = value => createHash('sha256').update(value).digest('hex');
const checkNames = []; let phase = 'sandbox_verification';
const check = (name, value = true) => { assert.ok(value, name); checkNames.push(name); };
const chats = new Set(), businesses = new Set(), invoices = new Set();
const ledger = { stage: 'AI-32-R06', purpose: 'invoice', run_id: randomUUID(), records: [] };
let db, compiled, cloud, failure = null, inspections = 0, providerCalls = 0, cleanupComplete = false;
const counts = { puts: 0, domain_puts: 0, original_puts: 0, seed_puts: 0, gets: 0, deletes: 0, verified_404: 0 };
const persistLedger = async () => {
  const temporary = descriptor.ledger_path + '.pending';
  const file = await open(temporary, 'wx', 0o600);
  try { await file.chmod(0o600);await file.writeFile(JSON.stringify(ledger, null, 2) + '\n');await file.sync(); }
  finally { await file.close(); }
  await rename(temporary, descriptor.ledger_path); await chmod(descriptor.ledger_path, 0o600);
  if(process.platform==='linux') {
    const directory=await open(dirname(descriptor.ledger_path),'r');
    try{await directory.sync();}finally{await directory.close();}
  }
};
const ownsNamespace = key => [...chats].some(id => key.startsWith(`nodia-ai/${id}/`)) || [...businesses].some(id => key.startsWith(`invoices/${id}/`));
const recordFor = key => { assert(ownsNamespace(key)); const entry = ledger.records.find(item => item.key === key); assert(entry); return entry; };
const deadline = () => AbortSignal.timeout(15000);
let realAdapter;
const boundedGet = async (key, max, signal = deadline()) => {
  recordFor(key); counts.gets++; return cloud.downloadFile(key, max, signal);
};
const absent = async key => {
  try { await boundedGet(key, 20 * 1024 * 1024); return false; }
  catch (error) {
    if (error?.$metadata?.httpStatusCode === 404 && ['NoSuchKey','NotFound'].includes(error.name)) { counts.verified_404++; return true; }
    throw error;
  }
};
const put = async (key, path, media, signal, kind = key.startsWith('invoices/') ? 'domain' : 'original') => {
  assert(ownsNamespace(key)); assert(!ledger.records.some(item => item.key === key), 'No generation may be PUT twice');
  const buffer = await readFile(path); assert(buffer.length > 0 && buffer.length <= 10 * 1024 * 1024);
  if (kind === 'domain') assert.equal((await db.query('SELECT count(*)::int n FROM invoice_uploads WHERE storage_key=$1',[key]))[0].n, 1);
  ledger.records.push({ key, kind, bytes: buffer.length, sha256: hash(buffer), state: 'no_write_attempted' });
  await persistLedger(); // Includes the unknown-result identity before external mutation.
  if(!await absent(key)) {
    recordFor(key).state='preexisting_do_not_delete';await persistLedger();
    throw new Error('Fixture collision prevented before PUT');
  }
  recordFor(key).state='put_attempted';await persistLedger();
  counts.puts++; counts[kind + '_puts']++;
  await realAdapter.put(key, path, media, signal);
  recordFor(key).state = 'put_acknowledged'; await persistLedger();
};
const storage = { get: boundedGet, put, async delete(key) {
  assert(['put_attempted','put_acknowledged','deleted_and_get_404'].includes(recordFor(key).state), 'Never delete a key without this run owning a write attempt');
  counts.deletes++; await cloud.deleteFile(key);
  assert.equal(await absent(key), true, 'DELETE acknowledgement must be followed by object absence');
  recordFor(key).state = 'deleted_and_get_404'; await persistLedger();
} };
// Previously decoded synthetic R05 PNG only; never open user audio/objects.
const firstBytes = await readFile('/tmp/ai32-r06-synthetic.png');
assert.equal(firstBytes.length,29076);
assert.equal(hash(firstBytes),'e66411ae91976c0626a45a1b5e151cb49e76b0b60aac135a59395bccf20d78d7');
// A distinct validated PDF proves replacement did not recopy the old PNG.
const secondBytes = await readFile('/tmp/ai32-r06-synthetic.pdf');
assert.equal(secondBytes.length,765);
assert.equal(hash(secondBytes),'3597b3465cad3b2770a88929eb5b39366aa0b324c7283de84ebc56501157485d');
const sourceFiles = [
  ['nodia-ai-execution/nodia-ai-execution.module','NodiaAiExecutionModule'], ['nodia-ai-attachment/nodia-ai-attachment.module','NodiaAiAttachmentModule'],
  ['nodia-ai-proposal/use-case/prepare-nodia-ai-proposal.use-case','PrepareNodiaAiProposalUseCase'], ['nodia-ai-confirmation/use-case/create-nodia-ai-confirmation-challenge.use-case','CreateNodiaAiConfirmationChallengeUseCase'],
  ['nodia-ai-confirmation/use-case/confirm-nodia-ai-proposal.use-case','ConfirmNodiaAiProposalUseCase'], ['nodia-ai-execution/use-case/run-nodia-ai-execution.use-case','RunNodiaAiExecutionUseCase'],
  ['nodia-ai-confirmation/use-case/get-nodia-ai-execution.use-case','GetNodiaAiExecutionUseCase'], ['nodia-ai-attachment/use-case/create-nodia-ai-attachment.use-case','CreateNodiaAiAttachmentUseCase'],
  ['nodia-ai-attachment/use-case/upload-nodia-ai-attachment.use-case','UploadNodiaAiAttachmentUseCase'], ['nodia-ai-attachment/types/attachment-ports','NodiaAiAttachmentStorage'],
  ['nodia-ai-attachment/types/attachment-ports','NodiaAiAttachmentInspector'], ['common/redis/redis.service','RedisService'],
  ['nodia-ai-runtime/config/runtime-policy','NODIA_AI_RUNTIME_POLICY'], ['nodia-ai-conversation/use-case/expire-nodia-ai-conversations.use-case','ExpireNodiaAiConversationsUseCase'],
  ['nodia-ai-conversation/nodia-ai-conversation.service','NodiaAiConversationService'], ['nodia-ai-attachment/nodia-ai-attachment.service','NodiaAiAttachmentService'],
  ['nodia-ai-runtime/use-case/cleanup-nodia-ai-attachments.use-case','CleanupNodiaAiAttachmentsUseCase'], ['nodia-ai-runtime/nodia-ai-runtime.service','NodiaAiRuntimeService'],
  ['invoice/use-case/recover-invoice-uploads.use-case','RecoverInvoiceUploadsUseCase'], ['common/storage/storage.service','StorageService'],
  ['nodia-ai-invoice-attachment/use-case/stage-nodia-ai-invoice-attachment.use-case','StageNodiaAiInvoiceAttachmentUseCase'], ['nodia-ai-execution/use-case/claim-nodia-ai-execution.use-case','ClaimNodiaAiExecutionUseCase'],
  ['nodia-ai-execution/use-case/execute-nodia-ai-local-execution.use-case','ExecuteNodiaAiLocalExecutionUseCase'], ['nodia-ai-attachment/adapters/storage-nodia-ai-attachment','StorageNodiaAiAttachment'],
  ['nodia-ai-attachment/adapters/http-nodia-ai-attachment-inspector','HttpNodiaAiAttachmentInspector'], ['nodia-ai-adapter/types/nodia-ai-adapter.types','NodiaAiAdapterPort'],
];
let sourceReceipts = [];
try {
  const options = { type: 'postgres', host:descriptor.sandbox.host,port:descriptor.sandbox.port,
    username:descriptor.sandbox.username,password:descriptor.sandbox.password,database:descriptor.sandbox.database,
    synchronize: false, logging: false,
    entities: [resolve(root, 'dist/**/*.entity.js')], extra: { max: 6, statement_timeout: 10000, connectionTimeoutMillis: 10000 } };
  db = await new DataSource(options).initialize();
  const [identityProof] = await db.query('SELECT current_database() database,current_user username');
  assert.deepEqual(identityProof, { database: 'ai32_r06_invoice', username: 'ai32_r06_invoice' });
  assert.equal((await db.query('SELECT count(*)::int n FROM migrations'))[0].n, 26);
  for (const table of ['businesses','invoices','nodia_ai_conversations','nodia_ai_attachments']) assert.equal((await db.query(`SELECT count(*)::int n FROM ${table}`))[0].n, 0);
  check('dedicated disposable SQL identity and empty business tables verified before mutations');
  const [Execution, Attachment, Prepare, Challenge, Confirm, Run, Get, CreateFile, UploadFile, Storage, Inspector, Redis, Policy, Expire, Conversations, Attachments, Cleanup, Runtime, InvoiceRecovery, StorageService, Stage, Claim, Effect, Adapter, HttpInspector, ProviderPort] = await Promise.all(sourceFiles.map(([file,name]) => load(file,name)));
  sourceReceipts = await Promise.all([...new Set(sourceFiles.map(([file])=>file))].sort().map(async file => ({ path: 'dist/' + file + '.js', sha256: hash(await readFile(resolve(root,'dist',file+'.js'))) })));
  assert(isAbsolute(descriptor.runtime_source_root));
  for(const receipt of sourceReceipts)assert.equal(hash(await readFile(resolve(descriptor.runtime_source_root,receipt.path))),receipt.sha256);
  cloud = new StorageService(); realAdapter = new Adapter(cloud);
  const inspector = new HttpInspector();
  const forbidProvider = () => { providerCalls++; throw new Error('R06 inference forbidden'); };
  compiled = await Test.createTestingModule({ imports: [TypeOrmModule.forRootAsync({ useFactory:()=>options,dataSourceFactory:async()=>db }),Execution,Attachment] })
    .overrideProvider(Storage).useValue(storage)
    .overrideProvider(Inspector).useValue({ async inspect(value) { inspections++; return inspector.inspect(value); } })
    .overrideProvider(StorageService).useValue({ deleteFile:key=>storage.delete(key) })
    .overrideProvider(ProviderPort).useValue({ observe:forbidProvider,execute:forbidProvider,verifyConfiguration:forbidProvider })
    .overrideProvider(Redis).useValue({get:async()=>null,set:async()=>{},del:async()=>{},keys:async()=>[]}).compile();
  await compiled.init(); phase = 'copy_contracts';
  const identity=descriptor.identities['1']; assert.equal(identity.userId,'1');assert.match(identity.sessionId,/^[0-9a-f-]{36}$/);
  assert.equal((await db.query('SELECT count(*)::int n FROM auth_sessions WHERE public_id=$1 AND user_id=1 AND expires_at>now()',[identity.sessionId]))[0].n,1);
  let [module]=await db.query("SELECT id FROM modules WHERE link='/tools/business'");
  if(!module)[module]=await db.query("INSERT INTO modules(module_group_id,link,key) SELECT module_group_id,'/tools/business','synthetic_r06_business' FROM modules WHERE key='nodia_ai' RETURNING id");
  await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(1,$1) ON CONFLICT DO NOTHING',[module.id]);
  const sourceBusiness=randomUUID(),destinationBusiness=randomUUID();
  for(const id of [sourceBusiness,destinationBusiness]) { businesses.add(id); await db.query("INSERT INTO businesses(id,owner_id,name) VALUES($1,1,'Synthetic R06 invoice verification')",[id]); }
  const prepare=compiled.get(Prepare),challenge=compiled.get(Challenge),confirm=compiled.get(Confirm),worker=compiled.get(Run),get=compiled.get(Get),stage=compiled.get(Stage),claim=compiled.get(Claim),effect=compiled.get(Effect),recovery=compiled.get(InvoiceRecovery),policy=compiled.get(Policy);
  const count=async(table,where='true',values=[])=>(await db.query(`SELECT count(*)::int n FROM ${table} WHERE ${where}`,values))[0].n;
  const invoiceRow=async id=>(await db.query('SELECT * FROM invoices WHERE id=$1',[id]))[0];
  const newChat=async()=>{const id=randomUUID();chats.add(id);await db.query("INSERT INTO nodia_ai_conversations(id,owner_id,client_request_id,creation_request_hash,expires_at) VALUES($1,1,$2,$3,now()+interval '90 days')",[id,randomUUID(),'a'.repeat(64)]);return id;};
  const attachment=async(chat,bytes,kind='image',media='image/png',name='synthetic-r06-receipt.png')=>{
    const intent=await compiled.get(CreateFile).execute(identity,{conversation_id:chat,client_request_id:randomUUID(),kind,byte_count:bytes.length,file_name:name});
    const file=await compiled.get(UploadFile).execute(identity,intent.attachment.attachment_id,Readable.from([bytes]),'application/octet-stream',String(bytes.length));
    assert.equal(file.state,'ready');assert.equal(file.media_type,media);
    const [row]=await db.query('SELECT storage_key,content_hash,byte_count FROM nodia_ai_attachments WHERE id=$1',[file.attachment_id]);
    assert.equal(row.content_hash,hash(bytes));assert.equal(String(row.byte_count),String(bytes.length));assert((await boundedGet(row.storage_key,bytes.length)).equals(bytes));
    return {...file,key:row.storage_key,bytes};
  };
  const proposal=async(chat,partial)=>{const result=await db.transaction(manager=>prepare.execute(manager,identity,{conversationId:chat,toolName:`nodia_invoices_prepare_${partial.id?'update':'create'}`,partial}));assert.equal(result.status,'ready');assert(!JSON.stringify(result.proposal).includes('nodia-ai/')&&!JSON.stringify(result.proposal).includes('invoices/'));return result.proposal;};
  const admit=async p=>{const token=await challenge.execute(identity,p.proposal_id,{proposal_revision:p.revision,expected_hash:p.hash});return(await confirm.execute(identity,p.proposal_id,{client_request_id:randomUUID(),proposal_revision:p.revision,expected_hash:p.hash,confirmation_token:token.confirmation_token})).execution;};
  const acquired=async execution=>{const value=await claim.execute(randomUUID());assert.equal(value?.executionId,execution.execution_id);return value;};
  const verifyCommitted=async(execution,invoice)=>{
    assert.equal((await get.execute(identity,execution.execution_id)).state,'completed');
    const [step]=await db.query('SELECT minimal_receipt,recovery_descriptor FROM nodia_ai_execution_steps WHERE execution_id=$1',[execution.execution_id]);
    assert(step.minimal_receipt);assert.equal(step.recovery_descriptor,null);assert.equal(await count('invoice_uploads','storage_key=$1',[invoice.path_storage]),0);
  };
  const cleanupNative=async key=>{recordFor(key);await db.query("UPDATE invoice_uploads SET cleanup_after=now()-interval '1 second',retry_after=now()-interval '1 second' WHERE storage_key=$1",[key]);await recovery.execute(key);assert.equal(await absent(key),true);};

  const chat=await newChat(),first=await attachment(chat,firstBytes);
  const p=await proposal(chat,{business_id:sourceBusiness,attachment_id:first.attachment_id,code:'SYN-R06-CREATE'});
  check('real inspector and R2 upload produce exact metadata; preview performs no domain PUT',inspections===1&&counts.domain_puts===0&&await count('invoices')===0&&p.steps[0].changes.some(item=>item.field_key==='attachment_content_hash'&&item.after===hash(firstBytes)));
  const created=await admit(p);check('confirmation contract admits before copying or creating invoice',created.state==='queued'&&counts.domain_puts===0&&await count('invoices')===0);
  await worker.execute(randomUUID(),deadline());
  let [invoice]=await db.query("SELECT * FROM invoices WHERE code='SYN-R06-CREATE'");assert(invoice);invoices.add(invoice.id);await verifyCommitted(created,invoice);
  assert(invoice.path_storage!==first.key&&invoice.path_storage.startsWith(`invoices/${sourceBusiness}/`));
  assert((await boundedGet(invoice.path_storage,firstBytes.length)).equals(firstBytes));
  check('create commits one invoice, receipt and consumed intent with an independent real R2 copy',await count('invoices')===1&&counts.domain_puts===1);
  const priorKey=invoice.path_storage,beforeIdle=counts.puts;
  assert.equal(await worker.execute(randomUUID(),deadline()),false);check('idle delivery cannot replay completed copy',counts.puts===beforeIdle);

  const second=await attachment(chat,secondBytes,'pdf','application/pdf','synthetic-r06-replacement.pdf'),updated=await admit(await proposal(chat,{id:invoice.id,business_id:sourceBusiness,attachment_id:second.attachment_id,code:'SYN-R06-UPDATE'}));
  const updateClaim=await acquired(updated);await stage.execute(updateClaim,deadline());
  const stagedPuts=counts.puts;const [staged]=await db.query('SELECT recovery_descriptor FROM nodia_ai_execution_steps WHERE execution_id=$1',[updated.execution_id]);const replacementKey=staged.recovery_descriptor.storage_key;
  assert.equal(await count('invoice_uploads','storage_key=$1',[replacementKey]),1);assert.equal((await invoiceRow(invoice.id)).path_storage,priorKey);
  await stage.execute(updateClaim,deadline());check('ready staging acknowledgement reuses the copied bytes without another PUT',counts.puts===stagedPuts);
  await effect.execute(identity,updated.execution_id,updateClaim);invoice=await invoiceRow(invoice.id);await verifyCommitted(updated,invoice);
  assert.equal(invoice.path_storage,replacementKey);assert((await boundedGet(replacementKey,secondBytes.length)).equals(secondBytes));
  check('replacement retains invoice identity and atomically commits distinct PDF bytes, new key and receipt',invoice.code==='SYN-R06-UPDATE'&&invoice.path_storage.endsWith('.pdf')&&hash(firstBytes)!==hash(secondBytes)&&await count('invoices')===1);
  const replayBefore=counts.puts;assert.equal((await effect.execute(identity,updated.execution_id,updateClaim)).state,'completed');check('completed effect replay has no additional PUT or invoice',counts.puts===replayBefore&&await count('invoices')===1);
  await cleanupNative(priorKey);check('native recovery removes superseded real R2 object and preserves replacement',(await boundedGet(replacementKey,secondBytes.length)).equals(secondBytes));

  phase='legacy_transfer';
  const legacyKey=`invoices/${sourceBusiness}/${randomUUID()}.png`;
  // This fixture seed is a private original, not a claimed application copy.
  const legacyPath=resolve(dirname(descriptor.ledger_path),'ai32-r06-invoice-legacy.png');
  await writeFile(legacyPath,firstBytes,{mode:0o600});
  await put(legacyKey,legacyPath,'image/png',deadline(),'seed');
  const [legacy]=await db.query('INSERT INTO invoices(business_id,code,path_storage) VALUES($1,$2,$3) RETURNING *',[sourceBusiness,'SYN-R06-LEGACY',legacyKey]);invoices.add(legacy.id);
  const legacyChat=await newChat(),beforeLegacy=counts.domain_puts;
  const legacyProposal=await proposal(legacyChat,{id:legacy.id,business_id:sourceBusiness,destination_business_id:destinationBusiness});
  assert.equal(counts.domain_puts,beforeLegacy);
  const legacyExecution=await admit(legacyProposal),legacyClaim=await acquired(legacyExecution);
  await stage.execute(legacyClaim,deadline());const beforeLegacyReplay=counts.puts;
  const [legacyStage]=await db.query('SELECT recovery_descriptor FROM nodia_ai_execution_steps WHERE execution_id=$1',[legacyExecution.execution_id]);
  assert.equal(legacyStage.recovery_descriptor.schema_version,2);assert.equal(legacyStage.recovery_descriptor.content_hash,hash(firstBytes));assert.equal(String(legacyStage.recovery_descriptor.byte_count),String(firstBytes.length));
  await stage.execute(legacyClaim,deadline());assert.equal(counts.puts,beforeLegacyReplay);
  await effect.execute(identity,legacyExecution.execution_id,legacyClaim);const moved=await invoiceRow(legacy.id);await verifyCommitted(legacyExecution,moved);
  check('legacy transfer without a new attachment commits observed digest and independent destination key',moved.business_id===destinationBusiness&&moved.path_storage!==legacyKey&&moved.path_storage.startsWith(`invoices/${destinationBusiness}/`)&&(await boundedGet(moved.path_storage,firstBytes.length)).equals(firstBytes));
  assert.equal((await effect.execute(identity,legacyExecution.execution_id,legacyClaim)).state,'completed');assert.equal(counts.puts,beforeLegacyReplay);
  await cleanupNative(legacyKey);check('legacy native recovery verifies old object absence while destination remains readable',(await boundedGet(moved.path_storage,firstBytes.length)).equals(firstBytes));

  phase='receipt_atomic_rollback';
  const brokenChat=await newChat(),brokenFile=await attachment(brokenChat,firstBytes),broken=await admit(await proposal(brokenChat,{business_id:sourceBusiness,attachment_id:brokenFile.attachment_id,code:'SYN-R06-ROLLBACK'}));
  assert.match(broken.execution_id,/^[0-9a-f-]{36}$/);
  await db.query(`CREATE FUNCTION synthetic_r06_receipt_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.execution_id='${broken.execution_id}'::uuid AND NEW.state='completed' THEN RAISE EXCEPTION 'synthetic_r06_receipt_failure' USING ERRCODE='P0001'; END IF; RETURN NEW; END $$; CREATE TRIGGER synthetic_r06_receipt_failure BEFORE UPDATE ON nodia_ai_execution_steps FOR EACH ROW EXECUTE FUNCTION synthetic_r06_receipt_failure()`);
  const domainBefore=counts.domain_puts;
  try{await worker.execute(randomUUID(),deadline());}finally{await db.query('DROP TRIGGER synthetic_r06_receipt_failure ON nodia_ai_execution_steps;DROP FUNCTION synthetic_r06_receipt_failure()');}
  assert.equal(counts.domain_puts,domainBefore+1);assert.equal((await get.execute(identity,broken.execution_id)).state,'failed');
  const orphan=ledger.records.filter(item=>item.kind==='domain').at(-1).key;
  check('receipt SQL failure rolls back invoice and intent consumption after the real R2 PUT',await count('invoices',"code='SYN-R06-ROLLBACK'")===0&&await count('nodia_ai_execution_steps','execution_id=$1 AND minimal_receipt IS NOT NULL',[broken.execution_id])===0&&await count('invoice_uploads','storage_key=$1',[orphan])===1);
  await cleanupNative(orphan);check('real native compensation removes the rolled-back domain object',(await boundedGet(brokenFile.key,firstBytes.length)).equals(firstBytes));

  phase='origin_expiry';
  const expiry=new Expire(compiled.get(Conversations),policy,compiled.get(Attachments));
  await db.query("UPDATE nodia_ai_conversations SET expires_at=now()-interval '1 second' WHERE id=ANY($1::uuid[])",[[...chats]]);
  const expired=await expiry.execute();assert.equal(expired.purged_chats,chats.size);
  const janitor=new Cleanup(new Runtime(db),storage,policy);
  const cleanupJobs=await db.query("SELECT id FROM nodia_ai_jobs WHERE kind='delete_blob' AND stage_key='attachment_cleanup'");
  for(const job of cleanupJobs){const result=await janitor.execute(job.id,true);assert.equal(result.settled,1);}
  for(const file of [first,second,brokenFile])assert.equal(await absent(file.key),true);
  check('expiry and generation-owned janitor delete original chat objects and private SQL content',await count('nodia_ai_conversations')===0&&await count('nodia_ai_attachments')===0&&await count('nodia_ai_message_parts')===0&&await count('nodia_ai_jobs',"kind='delete_blob' AND stage_key='attachment_cleanup'")===0);
  assert((await boundedGet(invoice.path_storage,secondBytes.length)).equals(secondBytes));assert((await boundedGet(moved.path_storage,firstBytes.length)).equals(firstBytes));
  check('both invoices and their independent copied R2 objects survive origin chat purge',await count('invoices')===2&&(await invoiceRow(invoice.id)).path_storage===invoice.path_storage&&(await invoiceRow(moved.id)).path_storage===moved.path_storage);
  check('no provider or inference was invoked and PNG PDF PNG originals used the real inspector',providerCalls===0&&inspections===3);
} catch(error) {
  failure={phase,category:error?.name==='AssertionError'?'assertion_failed':error?.constructor?.name==='Error'?'runtime_error':'dependency_or_contract_error'};
} finally {
  phase='owned_fixture_teardown';
  try {
    if(db?.isInitialized&&invoices.size)await db.query('DELETE FROM invoices WHERE id=ANY($1::bigint[])',[[...invoices]]);
    if(cloud)for(const entry of ledger.records)if(['put_attempted','put_acknowledged'].includes(entry.state))await storage.delete(entry.key);
    if(cloud)for(const entry of ledger.records)if(entry.state==='deleted_and_get_404')assert.equal(await absent(entry.key),true);
    cleanupComplete=ledger.records.every(entry=>['no_write_attempted','preexisting_do_not_delete','deleted_and_get_404'].includes(entry.state));
    ledger.cleanup_complete=cleanupComplete;await persistLedger();
  } catch { failure??={phase,category:'owned_cleanup_unconfirmed'}; }
  try{await compiled?.close();if(db?.isInitialized)await db.destroy();}catch{failure??={phase,category:'sandbox_connection_close_failed'};}
  cloud?.onModuleDestroy();
}
console.log(JSON.stringify({stage:'AI-32-R06',scope:'real_compiled_invoice_contracts_disposable_sql_and_real_private_r2',status:failure?'failed':'passed',
  configured_database_used:false,configured_business_records_modified:0,sandbox_business_effects:failure?null:3,
  provider_generations:providerCalls,confirmation:'real_contracts_synthetic_actor_no_UI',inspector:'real_private_linux_http',inspector_calls:inspections,
  checks:checkNames.length,check_names:checkNames,counters:counts,
  owned_objects:ledger.records.filter(entry=>!['no_write_attempted','preexisting_do_not_delete'].includes(entry.state)).length,
  preexisting_collision_objects_preserved:ledger.records.filter(entry=>entry.state==='preexisting_do_not_delete').length,cleanup_complete:cleanupComplete,
  storage_counters_scope:'guarded_port_invocations_not_raw_http',expiry_clock:'only_owned_sandbox_chats_backdated_to_due',
  source_receipts:sourceReceipts,fixtures:[{media_type:'image/png',bytes:firstBytes.length,sha256:hash(firstBytes)},{media_type:'application/pdf',bytes:secondBytes.length,sha256:hash(secondBytes)}],
  ledger_contains_only_own_object_keys:true,public_object_keys_stored:false,credentials_or_provider_text_stored:false,...(failure?{error:failure}:{})}));
if(failure)process.exitCode=1;
