// R02 isolated SQL integration: compiled production use cases, disposable PostgreSQL,
// synthetic invoice objects. Reuses the shared AI fixture; never loads operational env.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const serverRoot = resolve(process.env.NODIA_AI_VERIFY_SERVER_ROOT ?? fileURLToPath(new URL('../../../nodia-server', import.meta.url)));
const require = createRequire(resolve(serverRoot, 'package.json'));
const { Test } = require('@nestjs/testing');
const { TypeOrmModule } = require('@nestjs/typeorm');
const { createNodiaAiIntegrationFixture, loadAi } = await import(pathToFileURL(resolve(serverRoot, 'test/nodia-ai.integration.fixture.mjs')).href);
console.log(JSON.stringify({ verification_runner_pid: process.pid }));
const fixture = await createNodiaAiIntegrationFixture('ai32');
const { db, options, identities } = fixture;
const checks = [], objects = new Map();
const check = (name, value = true) => { assert.ok(value, name); checks.push(name); };
const count = async (table, where = 'true', params = []) => (await db.query(`SELECT count(*)::int n FROM ${table} WHERE ${where}`, params))[0].n;
let compiled, failure, gets = 0, puts = 0, deletes = 0, lastKey, uncertain = false;
let afterGet = async () => {}, afterPut = async () => {};
const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO/a4WQAAAAASUVORK5CYII=', 'base64');
const expectedHash = createHash('sha256').update(bytes).digest('hex');
try {
  const names = [
    ['nodia-ai-execution/nodia-ai-execution.module', 'NodiaAiExecutionModule'],
    ['nodia-ai-attachment/nodia-ai-attachment.module', 'NodiaAiAttachmentModule'],
    ['nodia-ai-proposal/use-case/prepare-nodia-ai-proposal.use-case', 'PrepareNodiaAiProposalUseCase'],
    ['nodia-ai-confirmation/use-case/create-nodia-ai-confirmation-challenge.use-case', 'CreateNodiaAiConfirmationChallengeUseCase'],
    ['nodia-ai-confirmation/use-case/confirm-nodia-ai-proposal.use-case', 'ConfirmNodiaAiProposalUseCase'],
    ['nodia-ai-execution/use-case/run-nodia-ai-execution.use-case', 'RunNodiaAiExecutionUseCase'],
    ['nodia-ai-confirmation/use-case/get-nodia-ai-execution.use-case', 'GetNodiaAiExecutionUseCase'],
    ['nodia-ai-attachment/types/attachment-ports', 'NodiaAiAttachmentStorage'],
    ['nodia-ai-attachment/types/attachment-ports', 'NodiaAiAttachmentInspector'],
    ['common/redis/redis.service', 'RedisService'],
    ['common/storage/storage.service', 'StorageService'],
    ['nodia-ai-invoice-attachment/use-case/stage-nodia-ai-invoice-attachment.use-case', 'StageNodiaAiInvoiceAttachmentUseCase'],
    ['nodia-ai-execution/use-case/claim-nodia-ai-execution.use-case', 'ClaimNodiaAiExecutionUseCase'],
    ['nodia-ai-execution/use-case/execute-nodia-ai-local-execution.use-case', 'ExecuteNodiaAiLocalExecutionUseCase'],
    ['nodia-ai-execution/use-case/recover-nodia-ai-executions.use-case', 'RecoverNodiaAiExecutionsUseCase'],
    ['nodia-ai-confirmation/use-case/control-nodia-ai-execution.use-case', 'ControlNodiaAiExecutionUseCase'],
    ['invoice/use-case/recover-invoice-uploads.use-case', 'RecoverInvoiceUploadsUseCase'],
    ['nodia-ai-execution/nodia-ai-execution.service', 'NodiaAiExecutionService'],
  ];
  const [Execution, Attachment, Prepare, Challenge, Confirm, Run, Get, Storage, Inspector, Redis, StorageService, Stage, Claim, Effect, Recover, Control, InvoiceRecovery, Store] = await Promise.all(names.map(([file, name]) => loadAi(file, name)));
  const storage = {
    async get(key, max, signal) {
      signal?.throwIfAborted(); gets++;
      assert.equal(max, 10 * 1024 * 1024, 'legacy GET uses native invoice limit, not invented metadata');
      const value = objects.get(key);
      assert.ok(value, 'synthetic legacy object exists');
      assert.ok(value.length <= max, 'bounded private GET');
      await afterGet(key);
      return value;
    },
    async put(key, path, mime, signal) {
      signal.throwIfAborted();
      assert.equal(mime, 'image/png');
      assert.equal(await count('invoice_uploads', 'storage_key=$1', [key]), 1, 'durable intent precedes PUT');
      const value = await readFile(path);
      assert.equal(createHash('sha256').update(value).digest('hex'), expectedHash);
      assert.ok(!objects.has(key), 'a staged generation must never overwrite another object');
      objects.set(key, value); puts++; lastKey = key;
      await afterPut(key);
      if (uncertain) throw Error('synthetic_r02_put_acknowledgement_lost');
    },
    async delete(key) { deletes++; objects.delete(key); },
  };
  compiled = await Test.createTestingModule({ imports: [TypeOrmModule.forRootAsync({ useFactory: () => options, dataSourceFactory: async () => db }), Execution, Attachment] })
    .overrideProvider(Storage).useValue(storage)
    .overrideProvider(Inspector).useValue({ async inspect() { throw Error('legacy transfer must not invent a chat attachment or call its inspector'); } })
    .overrideProvider(StorageService).useValue({ async deleteFile(key) { deletes++; objects.delete(key); } })
    .overrideProvider(Redis).useValue({ get: async () => null, set: async () => {}, del: async () => {}, keys: async () => [] }).compile();
  await compiled.init();
  const prepare = compiled.get(Prepare), challenge = compiled.get(Challenge), confirm = compiled.get(Confirm), worker = compiled.get(Run), get = compiled.get(Get);
  const stage = compiled.get(Stage), claim = compiled.get(Claim), effect = compiled.get(Effect), recover = compiled.get(Recover), control = compiled.get(Control), nativeRecovery = compiled.get(InvoiceRecovery);
  const identity = identities.get('1');
  let [module] = await db.query("SELECT id FROM modules WHERE link='/tools/business'");
  if (!module) [module] = await db.query("INSERT INTO modules(module_group_id,link,key) SELECT module_group_id,'/tools/business','synthetic_r02_business' FROM modules WHERE key='nodia_ai' RETURNING id");
  await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(1,$1) ON CONFLICT DO NOTHING', [module.id]);
  const source = randomUUID(), destination = randomUUID();
  for (const id of [source, destination]) await db.query("INSERT INTO businesses(id,owner_id,name) VALUES($1,1,'Synthetic R02 legacy')", [id]);
  const row = async id => (await db.query('SELECT * FROM invoices WHERE id=$1', [id]))[0];
  async function newInvoice(suffix, key = `invoices/${source}/${randomUUID()}.png`) {
    const [invoice] = await db.query('INSERT INTO invoices(business_id,code,path_storage) VALUES($1,$2,$3) RETURNING *', [source, `SYN-R02-${suffix}`, key]);
    objects.set(key, Buffer.from(bytes)); return invoice;
  }
  async function proposal(invoice, target = destination, extra = {}, actor = identity) {
    const chat = randomUUID();
    await db.query("INSERT INTO nodia_ai_conversations(id,owner_id,client_request_id,creation_request_hash,expires_at) VALUES($1,$2,$3,$4,now()+interval '90 days')", [chat, actor.userId, randomUUID(), 'a'.repeat(64)]);
    const result = await db.transaction(manager => prepare.execute(manager, actor, { conversationId: chat, toolName: 'nodia_invoices_prepare_update', partial: { id: invoice.id, business_id: invoice.business_id, ...(target === invoice.business_id ? {} : { destination_business_id: target }), ...extra } }));
    assert.equal(result.status, 'ready'); return result.proposal;
  }
  async function admit(p, actor = identity) {
    const token = await challenge.execute(actor, p.proposal_id, { proposal_revision: p.revision, expected_hash: p.hash });
    return (await confirm.execute(actor, p.proposal_id, { client_request_id: randomUUID(), proposal_revision: p.revision, expected_hash: p.hash, confirmation_token: token.confirmation_token })).execution;
  }
  const status = execution => get.execute(identity, execution.execution_id);
  async function acquired(execution) { const value = await claim.execute(randomUUID()); assert.equal(value?.executionId, execution.execution_id); return value; }
  async function clean(key) { await db.query("UPDATE invoice_uploads SET cleanup_after=clock_timestamp()-interval '1 second',retry_after=clock_timestamp()-interval '1 second' WHERE storage_key=$1", [key]); await nativeRecovery.execute(key); }
  async function resume(execution) { const current = await status(execution); await control.execute(identity, execution.execution_id, { client_request_id: randomUUID(), expected_execution_revision: current.revision }, 'resume'); }

  const same = await newInvoice('SAME');
  const sameExecution = await admit(await proposal(same, source, { code: 'SYN-R02-SAME-EDIT' }));
  await worker.execute(randomUUID(), new AbortController().signal);
  check('same-business metadata edit preserves its original legacy key without external I/O', (await row(same.id)).path_storage === same.path_storage && gets === 0 && puts === 0 && (await status(sameExecution)).state === 'completed');

  const invoice = await newInvoice('MOVE'), p = await proposal(invoice);
  check('legacy preview is ready without attachment_id and exposes no private keys', !JSON.stringify(p).includes(invoice.path_storage) && !JSON.stringify(p).includes('invoices/') && await count('nodia_ai_attachments') === 0 && puts === 0);
  const accepted = await admit(p);
  check('exact human confirmation admits transfer before any copy or business change', puts === 0 && (await row(invoice.id)).business_id === source);
  const claims = await Promise.all([claim.execute(randomUUID()), claim.execute(randomUUID())]);
  const selected = claims.filter(Boolean);
  check('concurrent workers claim the legacy transfer once', selected.length === 1 && selected[0].executionId === accepted.execution_id);
  await stage.execute(selected[0], new AbortController().signal);
  const stagedKey = lastKey, copies = puts;
  const [staged] = await db.query('SELECT recovery_descriptor FROM nodia_ai_execution_steps WHERE execution_id=$1', [accepted.execution_id]);
  check('ready legacy descriptor binds observed digest and byte count', staged.recovery_descriptor.schema_version === 2 && staged.recovery_descriptor.status === 'ready' && staged.recovery_descriptor.content_hash === expectedHash && String(staged.recovery_descriptor.byte_count) === String(bytes.length));
  check('copy does not change invoice or consume native intent before SQL effect', (await row(invoice.id)).path_storage === invoice.path_storage && objects.has(stagedKey) && await count('invoice_uploads', 'storage_key=$1', [stagedKey]) === 1);
  await stage.execute(selected[0], new AbortController().signal);
  check('ready staged transfer reuses acknowledgement without a second PUT', puts === copies);
  await effect.execute(identity, accepted.execution_id, selected[0]);
  const moved = await row(invoice.id), result = await status(accepted);
  check('transfer atomically commits the existing invoice to a new key and destination', result.state === 'completed' && moved.business_id === destination && moved.path_storage === stagedKey && moved.path_storage.startsWith(`invoices/${destination}/`) && moved.id === invoice.id);
  const [committedStep] = await db.query('SELECT minimal_receipt FROM nodia_ai_execution_steps WHERE execution_id=$1', [accepted.execution_id]);
  check('committed receipt binds destination and consumes only its staging intent', committedStep.minimal_receipt.business_id === destination && await count('invoice_uploads', 'storage_key=$1', [stagedKey]) === 0);
  check('old object is retained until independent native cleanup', objects.has(invoice.path_storage) && await count('invoice_uploads', 'storage_key=$1', [invoice.path_storage]) === 1);
  await clean(invoice.path_storage);
  check('native cleanup deletes only superseded old file and preserves new invoice object', !objects.has(invoice.path_storage) && objects.has(stagedKey));
  const replay = await effect.execute(identity, accepted.execution_id, selected[0]);
  check('completed receipt replay does not copy or duplicate an invoice', replay.state === 'completed' && puts === copies && await count('invoices', 'id=$1', [invoice.id]) === 1);
  await db.query('DELETE FROM nodia_ai_conversations WHERE id=$1', [p.conversation_id]);
  check('deleting origin chat preserves transferred business file and invoice', objects.has(stagedKey) && (await row(invoice.id)).path_storage === stagedKey);

  const shared = await newInvoice('SHARED'), sibling = await newInvoice('SHARED-SIBLING', shared.path_storage);
  const sharedExecution = await admit(await proposal(shared));
  await worker.execute(randomUUID(), new AbortController().signal);
  await clean(shared.path_storage);
  check('old file still referenced by a sibling invoice is retained by native recovery', (await status(sharedExecution)).state === 'completed' && objects.has(shared.path_storage) && (await row(sibling.id)).path_storage === shared.path_storage && await count('invoice_uploads', 'storage_key=$1', [shared.path_storage]) === 0);

  const stale = await newInvoice('STALE'), staleProposal = await proposal(stale);
  const putsBeforeStale = puts, [timestampBeforeStale] = await db.query('SELECT updated_at::text exact_time FROM invoices WHERE id=$1', [stale.id]);
  await db.query('UPDATE invoices SET path_storage=$2 WHERE id=$1', [stale.id, `invoices/${source}/${randomUUID()}.png`]);
  await assert.rejects(() => admit(staleProposal), /preconditions_changed/);
  const [timestampAfterStale] = await db.query('SELECT updated_at::text exact_time FROM invoices WHERE id=$1', [stale.id]);
  check('changed private source key invalidates confirmation even with unchanged timestamp', (await row(stale.id)).business_id === source && puts === putsBeforeStale && timestampBeforeStale.exact_time === timestampAfterStale.exact_time);

  const forbidden = await newInvoice('AUTH'), forbiddenProposal = await proposal(forbidden), forbiddenExecution = await admit(forbiddenProposal), forbiddenClaim = await acquired(forbiddenExecution);
  await db.query('DELETE FROM user_modules WHERE user_id=1 AND module_id=$1', [module.id]);
  const beforeDenied = gets;
  await assert.rejects(() => stage.execute(forbiddenClaim, new AbortController().signal));
  check('revoked destination module blocks file GET before any external I/O', gets === beforeDenied && (await row(forbidden.id)).business_id === source);
  await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(1,$1)', [module.id]);
  await recover.execute(forbiddenClaim, 'nodia_ai:execution_conflict');

  const malformed = await newInvoice('MALFORMED', `invoices/${destination}/${randomUUID()}.png`);
  const beforeMalformed = gets;
  await assert.rejects(() => proposal(malformed), /invoice_file_move_requires_staging/);
  check('legacy source key under another business is rejected before GET or confirmation', gets === beforeMalformed && (await row(malformed.id)).business_id === source);

  const wrongBytes = await newInvoice('SIGNATURE'), wrongExecution = await admit(await proposal(wrongBytes)), wrongClaim = await acquired(wrongExecution);
  objects.set(wrongBytes.path_storage, Buffer.from('synthetic bytes that are not a PNG'));
  const beforeWrong = puts;
  await assert.rejects(() => stage.execute(wrongClaim, new AbortController().signal));
  await recover.execute(wrongClaim, 'nodia_ai:execution_conflict');
  check('invalid source signature is rejected without PUT or changing invoice', puts === beforeWrong && (await row(wrongBytes.id)).path_storage === wrongBytes.path_storage && (await status(wrongExecution)).state === 'failed');

  const duplicate = await newInvoice('DUPLICATE-STAGE'), duplicateExecution = await admit(await proposal(duplicate)), duplicateClaim = await acquired(duplicateExecution);
  const beforeDuplicate = puts;
  let notifyGet, releaseGet;
  const getEntered = new Promise(resolve => { notifyGet = resolve; });
  const getReleased = new Promise(resolve => { releaseGet = resolve; });
  afterGet = async () => { notifyGet(); await getReleased; };
  const firstDelivery = stage.execute(duplicateClaim, new AbortController().signal);
  try {
    await Promise.race([getEntered, firstDelivery.then(() => { throw Error('first delivery did not enter GET'); })]);
    await assert.rejects(() => stage.execute(duplicateClaim, new AbortController().signal), /invoice_attachment_not_staged/);
  } finally { releaseGet(); afterGet = async () => {}; await firstDelivery; }
  check('concurrent stage delivery rejects the preparing generation and issues one PUT', puts === beforeDuplicate + 1);
  await effect.execute(identity, duplicateExecution.execution_id, duplicateClaim);
  check('the winning concurrent stage commits exactly one invoice transfer', (await status(duplicateExecution)).state === 'completed' && (await row(duplicate.id)).business_id === destination);

  const race = await newInvoice('RACE'), raceExecution = await admit(await proposal(race)), raceClaim = await acquired(raceExecution);
  afterGet = async () => { await db.query("UPDATE invoices SET code='SYN-R02-RACED' WHERE id=$1", [race.id]); };
  try { await assert.rejects(() => stage.execute(raceClaim, new AbortController().signal), /preconditions_changed/); } finally { afterGet = async () => {}; }
  const raceKey = lastKey; await recover.execute(raceClaim, 'nodia_ai:preconditions_changed');
  check('native SQL mutation during GET prevents association after PUT', (await row(race.id)).path_storage === race.path_storage && (await status(raceExecution)).state === 'failed' && await count('invoice_uploads', 'storage_key=$1', [raceKey]) === 1);
  await clean(raceKey);
  check('race compensation removes destination orphan and keeps original legacy file', !objects.has(raceKey) && objects.has(race.path_storage));

  const revoke = await newInvoice('REVOKE-AFTER-PUT'), revokeExecution = await admit(await proposal(revoke)), revokeClaim = await acquired(revokeExecution);
  afterPut = async () => { await db.query('DELETE FROM user_modules WHERE user_id=1 AND module_id=$1', [module.id]); };
  try { await assert.rejects(() => stage.execute(revokeClaim, new AbortController().signal)); } finally { afterPut = async () => {}; await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(1,$1)', [module.id]); }
  const revokeKey = lastKey; await recover.execute(revokeClaim, 'nodia_ai:execution_conflict');
  check('module revocation during PUT prevents association and keeps recovery intent', (await row(revoke.id)).path_storage === revoke.path_storage && await count('invoice_uploads', 'storage_key=$1', [revokeKey]) === 1 && (await status(revokeExecution)).state === 'failed');
  await clean(revokeKey);

  const lost = await newInvoice('UNCERTAIN'), lostExecution = await admit(await proposal(lost)), lostClaim = await acquired(lostExecution);
  uncertain = true;
  try { await assert.rejects(() => stage.execute(lostClaim, new AbortController().signal), /acknowledgement_lost/); } finally { uncertain = false; }
  const lostKey = lastKey, afterLost = puts;
  await assert.rejects(() => stage.execute(lostClaim, new AbortController().signal), /invoice_attachment_not_staged/);
  check('lost PUT acknowledgement is never replayed automatically in the same generation', puts === afterLost && (await row(lost.id)).path_storage === lost.path_storage);
  await recover.execute(lostClaim, 'nodia_ai:execution_conflict'); await clean(lostKey);
  check('uncertain generation reconciles independently without modifying invoice', !objects.has(lostKey) && objects.has(lost.path_storage));
  await resume(lostExecution); await worker.execute(randomUUID(), new AbortController().signal);
  check('explicit human resume uses fresh fence/key and commits one transfer', (await status(lostExecution)).state === 'completed' && (await row(lost.id)).business_id === destination && lastKey !== lostKey && puts === afterLost + 1);

  const rollback = await newInvoice('ROLLBACK'), rollbackExecution = await admit(await proposal(rollback)), rollbackClaim = await acquired(rollbackExecution);
  await stage.execute(rollbackClaim, new AbortController().signal); const rollbackKey = lastKey;
  await db.query(`CREATE FUNCTION synthetic_r02_receipt_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.execution_id='${rollbackExecution.execution_id}'::uuid AND NEW.state='completed' THEN RAISE EXCEPTION 'synthetic_r02_receipt_failure' USING ERRCODE='P0001'; END IF; RETURN NEW; END $$; CREATE TRIGGER synthetic_r02_receipt_failure BEFORE UPDATE ON nodia_ai_execution_steps FOR EACH ROW EXECUTE FUNCTION synthetic_r02_receipt_failure()`);
  try { await assert.rejects(() => effect.execute(identity, rollbackExecution.execution_id, rollbackClaim)); } finally { await db.query('DROP TRIGGER synthetic_r02_receipt_failure ON nodia_ai_execution_steps; DROP FUNCTION synthetic_r02_receipt_failure()'); }
  await recover.execute(rollbackClaim, 'nodia_ai:execution_conflict');
  check('receipt failure rolls back invoice destination/key and staged intent consumption together', (await row(rollback.id)).business_id === source && (await row(rollback.id)).path_storage === rollback.path_storage && await count('invoice_uploads', 'storage_key=$1', [rollbackKey]) === 1 && await count('nodia_ai_execution_steps', 'execution_id=$1 AND minimal_receipt IS NOT NULL', [rollbackExecution.execution_id]) === 0);
  check('rolled-back old file is never queued for deletion', await count('invoice_uploads', 'storage_key=$1', [rollback.path_storage]) === 0 && objects.has(rollback.path_storage));
  await clean(rollbackKey);

  const committed = await newInvoice('COMMIT-LOST'), commitExecution = await admit(await proposal(committed)), commitClaim = await acquired(commitExecution);
  await stage.execute(commitClaim, new AbortController().signal); const beforeCommitLost = puts;
  const store = compiled.get(Store), transaction = store.transaction.bind(store);
  store.transaction = async work => { await transaction(work); throw Error('synthetic_r02_commit_response_lost'); };
  try { await assert.rejects(() => effect.execute(identity, commitExecution.execution_id, commitClaim)); } finally { store.transaction = transaction; }
  await recover.execute(); const recovered = await effect.execute(identity, commitExecution.execution_id, commitClaim);
  check('lost COMMIT acknowledgement recovers atomic receipt without another transfer or PUT', recovered.state === 'completed' && (await row(committed.id)).business_id === destination && puts === beforeCommitLost);

  const cancelled = await newInvoice('CANCEL'), cancelExecution = await admit(await proposal(cancelled));
  afterPut = async () => { const current = await status(cancelExecution); await control.execute(identity, cancelExecution.execution_id, { client_request_id: randomUUID(), expected_execution_revision: current.revision }, 'cancel'); };
  try { await worker.execute(randomUUID(), new AbortController().signal); } finally { afterPut = async () => {}; }
  const cancelledKey = lastKey; await recover.execute();
  check('human cancellation during copy reconciles without changing invoice key or destination', (await status(cancelExecution)).state === 'cancelled' && (await row(cancelled.id)).business_id === source && (await row(cancelled.id)).path_storage === cancelled.path_storage && await count('invoice_uploads', 'storage_key=$1', [cancelledKey]) === 1);
  await clean(cancelledKey);

  const lease = await newInvoice('LEASE'), leaseExecution = await admit(await proposal(lease)), leaseClaim = await acquired(leaseExecution);
  afterPut = async () => { await db.query("UPDATE nodia_ai_jobs SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1", [leaseClaim.jobId]); };
  try { await assert.rejects(() => stage.execute(leaseClaim, new AbortController().signal), /execution_conflict/); } finally { afterPut = async () => {}; }
  const leaseKey = lastKey; await recover.execute(leaseClaim, 'nodia_ai:lease_lost');
  check('lease expiry after PUT fences the transfer and preserves its compensation', (await row(lease.id)).business_id === source && (await status(leaseExecution)).state === 'failed' && await count('invoice_uploads', 'storage_key=$1', [leaseKey]) === 1);
  await clean(leaseKey);

  check('legacy transfer creates no chat attachment and uses independent native compensation', await count('nodia_ai_attachments') === 0 && deletes > 0);
  check('all execution attempts are terminal after reconciliation', await count('nodia_ai_jobs', "kind='execution' AND state IN ('queued','leased','unknown')") === 0);
} catch (error) { failure = error; }
finally { await compiled?.close(); await fixture.close(); }
console.log(JSON.stringify({ stage: 'AI-32-R02-legacy-invoice-transfer', status: failure ? 'failed' : 'passed', configured_database_used: false, database: 'disposable_postgres_16', storage: 'synthetic_private_port', provider_inference: false, cloud_storage_used: false, checks: checks.length, check_names: checks, counters: { gets, puts, deletes }, cleanup_complete: true, ...(failure ? { error: { name: failure.name, message: failure.message } } : {}) }, null, 2));
if (failure) throw failure;
