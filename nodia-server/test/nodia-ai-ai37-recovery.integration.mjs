// Compiled cases, real PostgreSQL16, SIGKILL, pg_dump/pg_restore. Provider/objects are synthetic.
// Never reads .env, configured DB or native profile. Every container is disposable template_ai37_*.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync, fork, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { DataSource } from 'typeorm';
import { createNodiaAiIntegrationFixture, loadAi } from './nodia-ai.integration.fixture.mjs';

const fixture = await createNodiaAiIntegrationFixture('ai37');
const { db, options, identities } = fixture;
const checks = [], children = new Set(), started = Date.now();
let restored, folder;
const check = (name, value = true) => { assert.ok(value, name); checks.push(name); };
try {
const classes = [
  ['nodia-ai-runtime/nodia-ai-runtime.service', 'NodiaAiRuntimeService'],
  ['nodia-ai/nodia-ai-authorization.service', 'NodiaAiAuthorizationService'],
  ['nodia-ai/use-case/authorize-nodia-ai.use-case', 'AuthorizeNodiaAiUseCase'],
  ['nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case', 'ValidateNodiaAiRuntimePolicyUseCase'],
  ['nodia-ai-runtime/use-case/claim-nodia-ai-job.use-case', 'ClaimNodiaAiJobUseCase'],
  ['nodia-ai-runtime/use-case/checkpoint-nodia-ai-job.use-case', 'CheckpointNodiaAiJobUseCase'],
  ['nodia-ai-runtime/use-case/recover-nodia-ai-jobs.use-case', 'RecoverNodiaAiJobsUseCase'],
  ['nodia-ai-recovery/use-case/prepare-nodia-ai-restore.use-case', 'PrepareNodiaAiRestoreUseCase'],
  ['nodia-ai-recovery/use-case/validate-nodia-ai-restore.use-case', 'ValidateNodiaAiRestoreUseCase'],
  ['nodia-ai-conversation/use-case/expire-nodia-ai-conversations.use-case', 'ExpireNodiaAiConversationsUseCase'],
  ['nodia-ai-conversation/nodia-ai-conversation.service', 'NodiaAiConversationService'],
  ['nodia-ai-attachment/nodia-ai-attachment.service', 'NodiaAiAttachmentService'],
  ['nodia-ai-runtime/use-case/cleanup-nodia-ai-attachments.use-case', 'CleanupNodiaAiAttachmentsUseCase'],
  ['nodia-ai-execution/nodia-ai-execution.service', 'NodiaAiExecutionService'],
  ['nodia-ai-execution/use-case/recover-nodia-ai-executions.use-case', 'RecoverNodiaAiExecutionsUseCase'],
];
const [Runtime, AuthStore, Authorize, ValidatePolicy, Claim, Checkpoint, Recover, Prepare, ValidateRestore, Expire, Conversations, Attachments, Cleanup, Executions, RecoverExecutions] = await Promise.all(classes.map(([file, name]) => loadAi(file, name)));
const policy = new ValidatePolicy().execute(JSON.parse(await readFile(new URL('../dist/nodia-ai-runtime/config/runtime-policy.json', import.meta.url), 'utf8')));
const runtime = new Runtime(db), authorize = new Authorize(new AuthStore(db));
const claim = new Claim(runtime, authorize, policy), recover = new Recover(runtime, policy);
const catalog = 'synthetic-ai37-catalog/1', resourceKey = 'gemini-profile:' + 'a'.repeat(64);
const hash = value => createHash('sha256').update(value).digest('hex');
const row = async (source, table, id) => (await source.query(`SELECT * FROM ${table} WHERE id=$1`, [id]))[0];
async function reset() { await db.query('TRUNCATE nodia_ai_conversations,nodia_ai_jobs,nodia_ai_runtime_slots CASCADE'); }
async function seed(owner = '1', selectedCatalog = catalog) {
  const chat = randomUUID(), message = randomUUID(), run = randomUUID(), job = randomUUID();
  const selection = { connection_id: '1', mode: 'agentic', model_id: 'synthetic-ai37-model', effort_id: null };
  const budget = { schema_version: 1, tool_calls: policy.budget.tool_calls_per_run, mcp_rpc_messages: policy.budget.mcp_rpc_messages_per_run, provider_dispatches: policy.budget.provider_dispatches_per_run, compactions: policy.budget.compactions_per_run, delegations: policy.budget.delegations_per_run };
  await db.transaction(async manager => {
    await manager.query("INSERT INTO nodia_ai_conversations(id,owner_id,client_request_id,title,creation_request_hash,expires_at,next_message_seq) VALUES($1,$2,$3,'Synthetic recovery',$4,clock_timestamp()+interval '1 day',1)", [chat, owner, randomUUID(), 'a'.repeat(64)]);
    await manager.query("INSERT INTO nodia_ai_messages(id,conversation_id,seq,role,author_id,client_message_id,status,source_scope_manifest,sealed_at,input_hash) VALUES($1,$2,1,'user',$3,$4,'sealed','{}',clock_timestamp(),$5)", [message, chat, owner, randomUUID(), 'b'.repeat(64)]);
    await manager.query("INSERT INTO nodia_ai_message_parts(message_id,conversation_id,part_index,kind,text) VALUES($1,$2,0,'text','Synthetic input')", [message, chat]);
    await manager.query(`INSERT INTO nodia_ai_runs(id,conversation_id,actor_id,user_message_id,selection_snapshot,catalog_version,policy_version,policy_hash,routing_snapshot,budget_snapshot,input_through_seq,state,phase,deadline_at,retention_epoch,context_manifest) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'{"schema_version":1,"enabled":false,"revision":1,"target":null}',$9,1,'queued','inference',clock_timestamp()+interval '10 minutes',1,'{}')`, [run, chat, owner, message, selection, selectedCatalog, policy.policyVersion, policy.policyHash, budget]);
    await manager.query(`INSERT INTO nodia_ai_execution_grants(id,actor_id,session_public_id,run_id,allowed_modules,allowed_operations,allowed_scope,policy_version,expires_at) VALUES($1,$2,$3,$4,'[]','["chat:respond"]','{}',$5,clock_timestamp()+interval '10 minutes')`, [randomUUID(), owner, identities.get(owner).sessionId, run, policy.policyVersion]);
    await manager.query("INSERT INTO nodia_ai_jobs(id,kind,dedup_key,conversation_id,run_id,state,available_at,deadline_at,stage_key) VALUES($1,'turn',$2,$3,$4,'ready',clock_timestamp(),clock_timestamp()+interval '10 minutes','inference')", [job, 'turn:' + run, chat, run]);
    await manager.query('UPDATE nodia_ai_conversations SET active_job_id=$2 WHERE id=$1', [chat, job]);
    await manager.query("UPDATE nodia_ai_runs SET context_manifest=$2 WHERE id=$1", [run, { session_generation: 'c'.repeat(32) }]);
  });
  return { chat, message, run, job };
}
async function startChild(arm) {
  const child = fork(fileURLToPath(new URL('./nodia-ai-ai11-process.fixture.mjs', import.meta.url)), [], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
  children.add(child);
  await once(child, 'message');
  const response = once(child, 'message');
  child.send({ command: 'start', database: options, workerId: randomUUID(), catalog, arm, resourceKey });
  const [message] = await response;
  assert.equal(message.event, 'claimed'); assert.ok(message.claim);
  return { child, claim: message.claim };
}
async function kill(child) { const exited = once(child, 'exit'); child.kill('SIGKILL'); await exited; children.delete(child); }
  const first = await seed();
  const killed = await startChild(false);
  const oldJob = await row(db, 'nodia_ai_jobs', first.job), oldRun = await row(db, 'nodia_ai_runs', first.run), oldAttempt = await row(db, 'nodia_ai_job_attempts', killed.claim.attemptId);
  await kill(killed.child);
  await db.query("UPDATE nodia_ai_jobs SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1", [first.job]);
  check('SIGKILL before dispatch permits recovery under a newer fence', await recover.execute() === 1 && (await row(db, 'nodia_ai_jobs', first.job)).state === 'ready');
  const replacement = await claim.execute(randomUUID(), [catalog]);
  check('restarted worker creates a new durable attempt and monotonic fence', replacement.attempt.id !== oldAttempt.id && BigInt(replacement.job.fence) > BigInt(oldJob.fence));
  let staleEffect = false;
  await assert.rejects(() => new Checkpoint(runtime, authorize, policy).execute({ job: oldJob, run: oldRun, attempt: oldAttempt, identity: identities.get('1') }, async () => { staleEffect = true; }), /lease_lost/);
  check('old worker cannot commit after restart', !staleEffect);
  await reset();
  const armed = await seed(), active = await startChild(true);
  await kill(active.child);
  await db.query("UPDATE nodia_ai_jobs SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1", [armed.job]);
  await recover.execute();
  const held = (await db.query('SELECT * FROM nodia_ai_runtime_slots'))[0];
  check('SIGKILL after arming preserves unknown and the exact remote identity', (await row(db, 'nodia_ai_jobs', armed.job)).state === 'unknown' && held.state === 'unknown' && held.external_operation_ref === active.claim.attemptId);
  check('normal recovery and a new process cannot claim an unknown inference', await recover.execute() === 0 && await claim.execute(randomUUID(), [catalog]) === null);
  await reset();
  const next = await seed('1', catalog + '-next');
  check('rolling old worker leaves unsupported catalog queued', await claim.execute(randomUUID(), [catalog]) === null && (await row(db, 'nodia_ai_jobs', next.job)).fence === '0');
  check('compatible worker can claim the frozen next catalog', (await claim.execute(randomUUID(), [catalog + '-next'])).run.catalog_version === catalog + '-next');
  await reset();

  // Capture a real database backup, then delete one still-live chat in the source.
  const live = await seed('1'), manuallyDeleted = await seed('2'), expiring = await seed('3'), executionChat = await seed('2');
  await db.query("INSERT INTO nodia_ai_runtime_slots(resource_key,state,fence) VALUES($1,'free',0)", [resourceKey]);
  const generation = randomUUID(), attachment = randomUUID(), storageKey = `nodia-ai/${manuallyDeleted.chat}/${attachment}/${generation}`;
  await db.query("INSERT INTO nodia_ai_attachments(id,conversation_id,client_request_id,request_hash,retention_epoch,kind,state,file_name,storage_key,generation,reserved_bytes,byte_count,media_type,content_hash,expires_at) VALUES($1,$2,$3,$4,1,'audio','ready','synthetic.ogg',$5,$6,4,4,'audio/ogg',$4,clock_timestamp()+interval '1 day')", [attachment, manuallyDeleted.chat, randomUUID(), 'a'.repeat(64), storageKey, generation]);
  const [category] = await db.query("INSERT INTO finance_categories(user_id,name,key) VALUES(1,'Recovery synthetic','recovery_synthetic') RETURNING id");
  await db.query("INSERT INTO finance_movements(user_id,category_id,name,amount,type,status) VALUES(1,$1,'Synthetic existing effect',1234,'expense','paid')", [category.id]);
  const proposal = randomUUID();
  await db.transaction(async manager => {
    await manager.query('INSERT INTO nodia_ai_proposals(id,conversation_id,actor_id,current_revision) VALUES($1,$2,1,1)', [proposal, live.chat]);
    await manager.query("INSERT INTO nodia_ai_proposal_revisions(proposal_id,revision,state,hash,catalog_version,canonicalization_version,created_at,expires_at) VALUES($1,1,'ready',$2,$3,'jcs-rfc8785/1',clock_timestamp(),clock_timestamp()+interval '1 hour')", [proposal, 'c'.repeat(64), catalog]);
    await manager.query("INSERT INTO nodia_ai_confirmation_challenges(id,proposal_id,proposal_revision,actor_id,session_public_id,expected_hash,token_hash,expires_at,created_at) VALUES($1,$2,1,1,$3,$4,$4,clock_timestamp()+interval '1 hour',clock_timestamp())", [randomUUID(), proposal, identities.get('1').sessionId, 'c'.repeat(64)]);
  });
  const execution = randomUUID(), executionJob = randomUUID(), executionProposal = randomUUID(), completedStep = randomUUID(), pendingStep = randomUUID();
  const syntheticReceipt = { schema_version: 1, resource_key: 'finance_movements', operation: 'create', fixture: 'synthetic-receipt-preservation-only' };
  await db.transaction(async manager => {
    await manager.query('UPDATE nodia_ai_conversations SET active_job_id=NULL WHERE id=$1', [executionChat.chat]);
    await manager.query('DELETE FROM nodia_ai_jobs WHERE id=$1', [executionChat.job]);
    await manager.query('DELETE FROM nodia_ai_runs WHERE id=$1', [executionChat.run]);
    await manager.query('INSERT INTO nodia_ai_proposals(id,conversation_id,actor_id,current_revision) VALUES($1,$2,2,1)', [executionProposal, executionChat.chat]);
    await manager.query("INSERT INTO nodia_ai_proposal_revisions(proposal_id,revision,state,hash,catalog_version,canonicalization_version,created_at,expires_at) VALUES($1,1,'draft',$2,$3,'jcs-rfc8785/1',clock_timestamp(),clock_timestamp()+interval '1 hour')", [executionProposal, 'd'.repeat(64), catalog]);
    for (const [index, step] of [completedStep, pendingStep].entries()) await manager.query("INSERT INTO nodia_ai_proposal_steps(id,proposal_id,proposal_revision,position,tool_name,contract_hash,kind,effect_key,scope,command_template,public_step,output_bindings,preconditions) VALUES($1,$2,1,$3,'nodia_finance_movements_prepare_create',$4,'domain_change','synthetic.restore','{}','{}','{}','[]','{}')", [step, executionProposal, index + 1, 'a'.repeat(64)]);
    await manager.query("UPDATE nodia_ai_proposal_revisions SET state='confirmed' WHERE proposal_id=$1", [executionProposal]);
    await manager.query("INSERT INTO nodia_ai_executions(id,conversation_id,proposal_id,origin_conversation_id,origin_proposal_id,origin_proposal_revision,proposal_hash,actor_id,chat_owner_id,client_request_id,catalog_version,revision,state,minimal_scope,created_at,retention_epoch) VALUES($1,$2,$3,$2,$3,1,$4,2,2,$5,$6,1,'partially_completed','{}',clock_timestamp(),1)", [execution, executionChat.chat, executionProposal, 'd'.repeat(64), randomUUID(), catalog]);
    await manager.query("INSERT INTO nodia_ai_execution_steps(id,source_step_id,execution_id,position,tool_name,template_hash,bound_command_hash,native_request_key,state,minimal_scope,minimal_receipt,lease_fence,dispatched_at,completed_at) VALUES($1,$1,$2,1,'nodia_finance_movements_prepare_create',$3,$3,$4,'completed','{}',$5,1,clock_timestamp(),clock_timestamp())", [completedStep, execution, 'a'.repeat(64), randomUUID(), syntheticReceipt]);
    await manager.query("INSERT INTO nodia_ai_execution_steps(id,source_step_id,execution_id,position,tool_name,template_hash,native_request_key,state,minimal_scope,lease_fence,recovery_descriptor) VALUES($1,$1,$2,2,'nodia_finance_movements_prepare_create',$3,$4,'failed','{}',0,'{\"schema_version\":1,\"kind\":\"local_transaction_rolled_back\"}')", [pendingStep, execution, 'b'.repeat(64), randomUUID()]);
    await manager.query("INSERT INTO nodia_ai_jobs(id,kind,dedup_key,conversation_id,execution_id,state,available_at,deadline_at,stage_key,stage_seq) VALUES($1,'execution',$2,$3,$4,'failed',clock_timestamp(),clock_timestamp()+interval '10 minutes','execution_step',2)", [executionJob, 'execution:' + execution, executionChat.chat, execution]);
    await manager.query('UPDATE nodia_ai_conversations SET active_job_id=$2 WHERE id=$1', [executionChat.chat, executionJob]);
  });
  const currentExecution = randomUUID(), currentProposal = randomUUID(), currentStep = randomUUID(), currentJob = randomUUID();
  await db.transaction(async manager => {
    await manager.query('INSERT INTO nodia_ai_proposals(id,conversation_id,actor_id,current_revision) VALUES($1,$2,2,1)', [currentProposal, executionChat.chat]);
    await manager.query("INSERT INTO nodia_ai_proposal_revisions(proposal_id,revision,state,hash,catalog_version,canonicalization_version,created_at,expires_at) VALUES($1,1,'draft',$2,$3,'jcs-rfc8785/1',clock_timestamp(),clock_timestamp()+interval '1 hour')", [currentProposal, 'e'.repeat(64), catalog]);
    await manager.query("INSERT INTO nodia_ai_proposal_steps(id,proposal_id,proposal_revision,position,tool_name,contract_hash,kind,effect_key,scope,command_template,public_step,output_bindings,preconditions) VALUES($1,$2,1,1,'nodia_finance_movements_prepare_create',$3,'domain_change','synthetic.restore.current','{}','{}','{}','[]','{}')", [currentStep, currentProposal, 'a'.repeat(64)]);
    await manager.query("UPDATE nodia_ai_proposal_revisions SET state='confirmed' WHERE proposal_id=$1", [currentProposal]);
    await manager.query("INSERT INTO nodia_ai_executions(id,conversation_id,proposal_id,origin_conversation_id,origin_proposal_id,origin_proposal_revision,proposal_hash,actor_id,chat_owner_id,client_request_id,catalog_version,revision,state,minimal_scope,created_at,retention_epoch) VALUES($1,$2,$3,$2,$3,1,$4,2,2,$5,$6,1,'queued','{}',clock_timestamp(),1)", [currentExecution, executionChat.chat, currentProposal, 'e'.repeat(64), randomUUID(), catalog]);
    await manager.query("INSERT INTO nodia_ai_execution_steps(id,source_step_id,execution_id,position,tool_name,template_hash,native_request_key,state,minimal_scope,lease_fence) VALUES($1,$1,$2,1,'nodia_finance_movements_prepare_create',$3,$4,'ready','{}',0)", [currentStep, currentExecution, 'a'.repeat(64), randomUUID()]);
    await manager.query("INSERT INTO nodia_ai_jobs(id,kind,dedup_key,conversation_id,execution_id,state,available_at,deadline_at,stage_key,stage_seq) VALUES($1,'execution',$2,$3,$4,'ready',clock_timestamp(),clock_timestamp()+interval '10 minutes','execution_step',1)", [currentJob, 'execution:' + currentExecution, executionChat.chat, currentExecution]);
    await manager.query('UPDATE nodia_ai_conversations SET active_job_id=$2 WHERE id=$1', [executionChat.chat, currentJob]);
  });
  const canResume = await loadAi('nodia-ai-confirmation/use-case/get-nodia-ai-execution.use-case', 'canResumeLocalExecution');
  const sourceSteps = [{ tool_name: 'nodia_finance_movements_prepare_create' }, { tool_name: 'nodia_finance_movements_prepare_create' }];
  const stepsOf = source => source.query('SELECT * FROM nodia_ai_execution_steps WHERE execution_id=$1 ORDER BY position', [execution]);
  check('source fixture contains a resumable failed second step and completed prefix', canResume(await row(db, 'nodia_ai_executions', execution), await stepsOf(db), sourceSteps));
  const container = execFileSync('docker', ['ps', '--format', '{{.Names}}'], { encoding: 'utf8' }).trim().split('\n').find(name => name.startsWith(`template_ai37_${process.pid}_`));
  assert.ok(container);
  await db.query("UPDATE nodia_ai_conversations SET expires_at=clock_timestamp()+interval '1200 milliseconds' WHERE id=$1", [expiring.chat]);
  const captured = (await db.query('SELECT clock_timestamp() AS now'))[0].now.toISOString();
  assert.ok((await row(db, 'nodia_ai_conversations', expiring.chat)).expires_at > new Date(captured));
  const dump = execFileSync('docker', ['exec', container, 'pg_dump', '-U', 'ai37', '-d', 'ai37', '--format=c', '--no-owner'], { maxBuffer: 64 * 1024 * 1024 });
  await db.query('UPDATE nodia_ai_conversations SET active_job_id=NULL WHERE id=$1', [manuallyDeleted.chat]);
  await db.query('DELETE FROM nodia_ai_jobs WHERE conversation_id=$1', [manuallyDeleted.chat]);
  await db.query('DELETE FROM nodia_ai_conversations WHERE id=$1', [manuallyDeleted.chat]);
  await delay(1300);
  const targetName = 'nodia_restore_ai37_' + randomUUID().replaceAll('-', '');
  await db.query(`CREATE DATABASE ${targetName}`);
  const restore = spawnSync('docker', ['exec', '-i', container, 'pg_restore', '-U', 'ai37', '-d', targetName, '--no-owner', '--exit-on-error'], { input: dump, maxBuffer: 1024 * 1024 });
  assert.equal(restore.status, 0, restore.stderr.toString());
  restored = await new DataSource({ ...options, database: targetName }).initialize();
  const quarantined = (await restored.query('SELECT clock_timestamp() AS now'))[0].now.toISOString();
  const backup = { id: randomUUID(), captured_at: captured };
  const manifestObject = { schema_version: 1, backup_id: backup.id, coverage_from: captured, coverage_through: quarantined, first_sequence: 41, entries: [{ sequence: 41, conversation_id: manuallyDeleted.chat, deleted_at: quarantined, storage_generations: [generation] }] };
  const manifest = JSON.stringify(manifestObject);
  const input = { operationMode: 'quarantine', backup, quarantined_at: quarantined, journalHead: { sha256: hash(manifest), last_sequence: 41 }, manifest };
  const prepare = new Prepare(restored, policy, new Expire(new Conversations(restored), policy, new Attachments(restored, policy)), new ValidateRestore());
  await assert.rejects(() => restored.transaction(async manager => {
    await manager.query("UPDATE nodia_ai_executions SET state='unknown',revision=revision+1 WHERE state IN ('queued','running','cancel_requested','waiting_for_user','failed','partially_completed')");
  }), error => error.code === '23505' && error.constraint === 'uq_nodia_ai_execution_active_chat');
  check('counterexample proves promoting every historical failure violates PostgreSQL active-chat uniqueness', (await row(restored, 'nodia_ai_executions', execution)).state === 'partially_completed' && (await row(restored, 'nodia_ai_executions', currentExecution)).state === 'queued');
  const before = (await restored.query('SELECT count(*)::int n FROM nodia_ai_conversations'))[0].n;
  for (const rejected of [{ ...input, operationMode: 'normal' }, { ...input, journalHead: { ...input.journalHead, last_sequence: 42 } }, { ...input, backup: { ...backup, captured_at: new Date(Date.now() - 8 * 86_400_000).toISOString() } }]) {
    await assert.rejects(() => prepare.execute(rejected));
  }
  check('missing external tail, wrong mode and expired backup fail before mutations', (await restored.query('SELECT count(*)::int n FROM nodia_ai_conversations'))[0].n === before && (await restored.query('SELECT count(*)::int n FROM nodia_ai_confirmation_challenges'))[0].n === 1);
  await restored.query("UPDATE nodia_ai_jobs SET recovery_descriptor=jsonb_build_object('padding',repeat('x',8177)) WHERE id=$1", [live.job]);
  assert.equal((await restored.query('SELECT octet_length(recovery_descriptor::text)::int n FROM nodia_ai_jobs WHERE id=$1', [live.job]))[0].n, 8192);
  await assert.rejects(() => prepare.execute(input), error => error.code === '23514');
  check('maximal legacy descriptor fails closed and rolls back challenge/grant invalidation without truncation', (await restored.query('SELECT count(*)::int n FROM nodia_ai_confirmation_challenges'))[0].n === 1 && (await restored.query('SELECT count(*)::int n FROM nodia_ai_execution_grants WHERE revoked_at IS NULL'))[0].n > 0 && (await restored.query('SELECT octet_length(recovery_descriptor::text)::int n FROM nodia_ai_jobs WHERE id=$1', [live.job]))[0].n === 8192);
  await restored.query('UPDATE nodia_ai_jobs SET recovery_descriptor=NULL WHERE id=$1', [live.job]);
  const prepared = await prepare.execute(input);
  check('real pg_restore purges current-clock expiry and recent manual deletion', prepared.purged_chats === 2 && !(await row(restored, 'nodia_ai_conversations', manuallyDeleted.chat)) && !(await row(restored, 'nodia_ai_conversations', expiring.chat)));
  check('preparation never authorizes automatic release or dispatch', prepared.release_authorized === false && prepared.dispatches === 0);
  check('restored ready job becomes durably quarantined unknown', (await row(restored, 'nodia_ai_jobs', live.job)).state === 'unknown' && (await row(restored, 'nodia_ai_jobs', live.job)).recovery_descriptor.restore_quarantined === true);
  check('a free slot in a backup cannot attest current remote quiet', (await restored.query('SELECT state FROM nodia_ai_runtime_slots WHERE resource_key=$1', [resourceKey]))[0].state === 'unknown');
  check('restored grants and exact confirmation tokens cannot authorize replay', (await restored.query('SELECT count(*)::int n FROM nodia_ai_execution_grants WHERE revoked_at IS NULL'))[0].n === 0 && (await restored.query('SELECT count(*)::int n FROM nodia_ai_confirmation_challenges'))[0].n === 0 && (await restored.query('SELECT state FROM nodia_ai_proposal_revisions WHERE proposal_id=$1', [proposal]))[0].state === 'expired');
  check('business effect remains a single exact financial record', (await restored.query('SELECT count(*)::int n,sum(amount)::text total FROM finance_movements'))[0].total === '1234');
  const restoredRuntime = new Runtime(restored), restoredAuth = new Authorize(new AuthStore(restored));
  await new Recover(restoredRuntime, policy).execute();
  await new RecoverExecutions(new Executions(restored), policy).execute();
  check('ordinary recovery cannot downgrade restore unknown to ready/rollback', await new Claim(restoredRuntime, restoredAuth, policy).execute(randomUUID(), [catalog]) === null && (await row(restored, 'nodia_ai_jobs', live.job)).state === 'unknown');
  check('SQL execution recovery preserves current backup uncertainty without inventing a rollback', (await row(restored, 'nodia_ai_executions', currentExecution)).state === 'unknown' && (await row(restored, 'nodia_ai_execution_steps', currentStep)).state === 'unknown' && (await row(restored, 'nodia_ai_execution_steps', currentStep)).recovery_descriptor === null);
  check('valid historical partial failure and newer active execution share a chat without violating active uniqueness', (await row(restored, 'nodia_ai_executions', execution)).state === 'partially_completed' && (await row(restored, 'nodia_ai_jobs', executionJob)).state === 'unknown' && (await restored.query("SELECT count(*)::int n FROM nodia_ai_executions WHERE conversation_id=$1 AND state IN ('queued','running','waiting_for_user','cancel_requested','unknown')", [executionChat.chat]))[0].n === 1);
  check('restored failure cannot advertise can_resume from a stale rollback witness', !canResume(await row(restored, 'nodia_ai_executions', execution), await stepsOf(restored), sourceSteps));
  check('completed prefix receipt is byte-equivalent and never replayed', JSON.stringify((await row(restored, 'nodia_ai_execution_steps', completedStep)).minimal_receipt) === JSON.stringify((await row(db, 'nodia_ai_execution_steps', completedStep)).minimal_receipt));
  const [Reconcile, CleanupProofs] = await Promise.all([
    loadAi('nodia-ai-runtime/use-case/reconcile-nodia-ai-runtime.use-case', 'ReconcileNodiaAiRuntimeUseCase'),
    loadAi('nodia-ai-runtime/use-case/cleanup-nodia-ai-runtime-proofs.use-case', 'CleanupNodiaAiRuntimeProofsUseCase'),
  ]);
  let nativeCalls = 0;
  const native = { async reconcile() { nativeCalls++; throw Error('synthetic native access forbidden'); }, async acknowledge() { nativeCalls++; throw Error('synthetic native access forbidden'); } };
  const cleanupProofs = new CleanupProofs(restoredRuntime, native, policy);
  await assert.rejects(() => new Reconcile(restoredRuntime, restoredAuth, native, cleanupProofs, policy).execute(identities.get('3'), live.job), /restore_reconciliation_required/);
  const proofJob = randomUUID();
  await restored.query("INSERT INTO nodia_ai_jobs(id,kind,dedup_key,recovery_descriptor,state,available_at,deadline_at,stage_key) VALUES($1,'reconcile',$2,'{\"restore_quarantined\":true}','waiting',clock_timestamp(),clock_timestamp()+interval '10 minutes','reconcile_ack')", [proofJob, 'reconcile:' + proofJob]);
  check('restored proof cannot invoke native reconciliation or ACK', (await cleanupProofs.execute(proofJob, true)).processed === 0 && nativeCalls === 0);

  let deletes = 0;
  const cleanup = new Cleanup(restoredRuntime, { async delete(key) { assert.equal(key, storageKey); deletes++; if (deletes <= policy.retry.cleanup_attempts) throw Error('synthetic storage outage'); } }, policy);
  for (let i = 0; i < policy.retry.cleanup_attempts; i++) {
    const result = await cleanup.execute();
    check(`failed cleanup attempt ${i + 1} retains the generation witness`, result.processed === 1 && result.settled === 0 && (await restored.query("SELECT storage_generation FROM nodia_ai_jobs WHERE kind='delete_blob'"))[0].storage_generation === generation);
    await restored.query("UPDATE nodia_ai_jobs SET available_at=clock_timestamp()-interval '1 second' WHERE kind='delete_blob'");
  }
  const [pendingCleanup] = await restored.query("SELECT id,state FROM nodia_ai_jobs WHERE kind='delete_blob'");
  check('retry exhaustion is a durable failed cleanup, not a fictitious deletion', pendingCleanup.state === 'failed');
  check('explicit repaired cleanup acknowledges deletion and removes minimal witness', (await cleanup.execute(pendingCleanup.id, true)).settled === 1 && (await restored.query("SELECT count(*)::int n FROM nodia_ai_jobs WHERE kind='delete_blob'"))[0].n === 0);

  // Repeat through the separate CLI process: no application listeners or workers are booted.
  folder = await mkdtemp(join(tmpdir(), 'nodia-ai37-restore-'));
  const files = ['target.json', 'metadata.json', 'manifest.json', 'external-head.json'].map(name => join(folder, name));
  const target = { host: options.host, port: options.port, username: options.username, password: options.password, database: targetName };
  await Promise.all([target, { backup, quarantined_at: quarantined }, manifestObject, input.journalHead].map((value, index) => writeFile(files[index], index === 2 ? manifest : JSON.stringify(value), { mode: 0o600 })));
  const cli = spawnSync(process.execPath, ['scripts/prepare-nodia-ai-restore.mjs', '--execute', ...files], { env: { ...process.env, NODIA_AI_OPERATION_MODE: 'quarantine' }, encoding: 'utf8', maxBuffer: 1024 * 1024 });
  assert.equal(cli.status, 0, cli.stderr);
  check('separate operator process preserves quarantine across restart without replay', JSON.parse(cli.stdout).release_authorized === false && (await row(restored, 'nodia_ai_jobs', live.job)).recovery_descriptor.restore_quarantined === true && (await restored.query('SELECT sum(amount)::text total FROM finance_movements'))[0].total === '1234');
  await restored.query("UPDATE nodia_ai_conversations SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1", [executionChat.chat]);
  const purged = await new Expire(new Conversations(restored), policy, new Attachments(restored, policy)).execute();
  const detached = await restored.query('SELECT id,state,conversation_id,execution_id,recovery_descriptor FROM nodia_ai_jobs WHERE id=ANY($1::uuid[]) ORDER BY id', [[executionJob, currentJob]]);
  check('purging historical failure plus active execution retains two detached quarantined unknown witnesses', purged.purged_chats === 1 && detached.length === 2 && detached.every(job => job.state === 'unknown' && job.conversation_id === null && job.execution_id === null && job.recovery_descriptor.restore_quarantined === true && [execution, currentExecution].includes(job.recovery_descriptor.execution_id)));
  await new RecoverExecutions(new Executions(restored), policy).execute();
  check('ordinary orphan recovery cannot erase restored uncertainty after chat purge', (await restored.query('SELECT count(*)::int n FROM nodia_ai_jobs WHERE id=ANY($1::uuid[])', [[executionJob, currentJob]]))[0].n === 2 && JSON.stringify((await row(restored, 'nodia_ai_execution_steps', completedStep)).minimal_receipt) === JSON.stringify((await row(db, 'nodia_ai_execution_steps', completedStep)).minimal_receipt) && (await restored.query('SELECT sum(amount)::text total FROM finance_movements'))[0].total === '1234');
  process.stdout.write(JSON.stringify({ stage: 'AI-37-recovery', passed: checks.length, checks, duration_ms: Date.now() - started, postgres: '16-alpine', real_process_sigkill: true, real_pg_dump_restore: true, backup_sha256: hash(dump), backup_bytes: dump.byteLength, provider_calls: 0, storage: 'synthetic deletion port with real SQL witness', scope: 'disposable PostgreSQL; no operational migration, provider, profile or R2 access' }) + '\n');
} finally {
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit');
      child.kill('SIGKILL');
      await exited.catch(() => {});
    }
  }
  if (restored?.isInitialized) await restored.destroy();
  if (folder) {
    assert.equal(dirname(resolve(folder)), resolve(tmpdir()));
    assert.ok(basename(folder).startsWith('nodia-ai37-restore-'));
    await rm(folder, { recursive: true, force: true });
  }
  await fixture.close();
}
