// OPERATOR ONLY. One real provider callback, then native cancellation OR fixture-only Core revocation.
// The diagnostic inference handler delegates real authorization/fencing/progress/gateway; it is not the production handler.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { RECOVERY_RELEASE as RELEASE, RECOVERY_RELEASE_SHA as RELEASE_SHA, RECOVERY_REQUEST,
  RECOVERY_CONTENDER_CASES, validateRecoveryInput, sha256, safeRecoveryError, settledWithin,
  waitForNativeAbort, inspectRecoveryAck } from './nodia-ai-ai40-recovery-sources-r01.mjs';

const load = async (file, name) => (await import(pathToFileURL(join(RELEASE, 'dist', file + '.js'))))[name];
const BOOTSTRAP = Symbol('bootstrap_before_any_account_method');
const started = new Date().toISOString(), assertions = {}, contenders = [], receipts = [];
let config, compiled, db, profileRoot, phase = 'operator_input', error = null, safe = false, contextUsed = false;
let adapterOperation, cancellationOperation, adapterSettled = false, callbacks = 0, gatewayCalls = 0;
let nativeRequest, jobId = null, runId = null, chatId = null, dispatched = 0, applicationReady = false;
let finalSql = null, nativeFailure = null, gatewayDenial = null, reconciliation = null, bootstrapComplete = false;
let contenderClosureConfirmed = false, capturedClaim, capturedContext;
const yes = (name, condition) => { assert.equal(condition, true, name); assertions[name] = true; };

async function denied(work) {
  let rejection;
  try { await work(); } catch (cause) { rejection = cause; }
  assert.ok(rejection);
  assert.equal(rejection.getStatus?.(), 403);
  assert.equal(rejection.getResponse?.()?.message ?? rejection.message, 'nodia_ai:capability_denied');
  return { status: 403, code: 'nodia_ai:capability_denied' };
}

async function contender(caseName) {
  const descriptor = { schema_version: 1, release_root: RELEASE, case: caseName,
    selection: config.selection, provider: config.provider, owner_identity: nativeRequest,
    provided_fixture: config.provided_fixture,
    ...(caseName === 'login_start' ? { login_request_id: config.blocked_login_request_id } : {}) };
  const child = spawn(process.execPath, [fileURLToPath(new URL('./nodia-ai-ai40-recovery-contenders-r01.mjs', import.meta.url))],
    { cwd: RELEASE, env: process.env, stdio: ['pipe', 'pipe', 'pipe'] });
  let output = '', outputBytes = 0, stderrBytes = 0;
  const stderrHash = (await import('node:crypto')).createHash('sha256');
  child.stdout.on('data', bytes => { outputBytes += bytes.length; if (outputBytes <= 256 * 1024) output += bytes.toString('utf8'); else child.kill('SIGTERM'); });
  child.stderr.on('data', bytes => { stderrBytes += bytes.length; stderrHash.update(bytes); });
  child.stdin.on('error', () => {}); child.stdin.end(JSON.stringify(descriptor));
  let forceStop;
  const timer = setTimeout(() => { child.kill('SIGTERM'); forceStop = setTimeout(() => child.kill('SIGKILL'), 2000).unref(); }, 45000).unref();
  let code, signal;
  try { [code, signal] = await once(child, 'close'); }
  finally { clearTimeout(timer); clearTimeout(forceStop); }
  assert.ok(outputBytes <= 256 * 1024);
  const result = JSON.parse(output);
  contenders.push({ case: caseName, exit_code: code, exit_signal: signal,
    stderr_bytes: stderrBytes, stderr_sha256: stderrHash.digest('hex'), stderr_withheld: true, result });
  assert.equal(code, 0); assert.equal(signal, null); assert.equal(result.status, 'passed');
  assert.equal(result.schema, 'nodia-ai-ai40-recovery-contender-v1'); assert.equal(result.case, caseName);
  assert.equal(result.owner_unchanged, true); assert.equal(result.physical_lock_witness_preserved, true);
  assert.equal(result.provider_generations, 0); assert.equal(result.account_or_credential_mutations, 0);
  assert.equal(result.business_writes, 0);
  if (caseName === 'login_start') {
    assert.equal(result.login_result.request_id, config.blocked_login_request_id);
    assert.equal(result.login_result.state, 'failed'); assert.equal(result.login_result.acknowledged, true);
    assert.equal(result.login_result.native, null); assert.equal(result.login_result.supervisor_process_absent, true);
    assert.equal(result.login_result.supervisor_group_empty, true); assert.equal(result.login_result.socket_absent, true);
    assert.equal(result.login_result.user_code_and_verification_url_null, true);
  }
}

try {
  assert.equal(process.platform, 'linux'); assert.ok(process.getuid() > 0);
  assert.equal(process.env.NODIA_CODEX_ENABLED, 'true');
  let size = 0; const chunks = [];
  for await (const chunk of process.stdin) { size += chunk.length; assert.ok(size <= 1024 * 1024); chunks.push(chunk); }
  config = validateRecoveryInput(JSON.parse(Buffer.concat(chunks).toString('utf8')), true);
  assert.equal(sha256(await readFile(join(RELEASE, 'release-manifest.json'))), RELEASE_SHA);
  profileRoot = process.env.NODIA_CODEX_PROFILE_ROOT;
  assert.ok(profileRoot && resolve(profileRoot) === profileRoot && await realpath(profileRoot) === profileRoot);
  for (const path of [profileRoot, join(profileRoot, config.selection.connection_id)]) {
    const info = await lstat(path);
    assert.ok(info.isDirectory() && !info.isSymbolicLink() && info.uid === process.getuid() && (info.mode & 0o077) === 0);
  }
  assert.equal(await lstat(join(profileRoot, config.selection.connection_id, 'auth.json')).then(() => true,
    failure => { if (failure.code === 'ENOENT') return false; throw failure; }), false);
  process.env.AUTH_JWT_SECRET = randomUUID() + randomUUID();
  process.env.GOOGLE_CLIENT_ID = 'synthetic-ai40.apps.googleusercontent.com';
  process.env.AUTH_ALLOWED_ORIGINS = 'http://127.0.0.1';
  const require = createRequire(join(RELEASE, 'package.json')); require('reflect-metadata');
  const { DataSource } = require('typeorm');
  db = await new DataSource(config.provided_fixture.options).initialize(); phase = 'fixture_public_configuration';
  const [mirrored] = await db.query(`INSERT INTO ai_providers(id,catalog_id,name,is_active,use_token_plan_agentic,fields,updated_at)
    SELECT $1::bigint,id,'AI40 recovery public configuration mirror',true,true,$2::jsonb,$3::timestamp
    FROM ai_provider_catalog WHERE key='openai' RETURNING id::text`,
  [config.selection.connection_id, JSON.stringify({ token_plan_agentic: config.provider.agentic_fields }), config.provider.updated_at]);
  assert.equal(mirrored?.id, config.selection.connection_id);
  await db.query("UPDATE ai_provider_catalog SET is_active=true,can_use_token_plan_agentic=true WHERE key='openai'");
  const names = [
    ['nodia-ai-conversation/nodia-ai-conversation.module', 'NodiaAiConversationModule'],
    ['nodia-ai-context/nodia-ai-processing.module', 'NodiaAiProcessingModule'],
    ['nodia-ai-runtime/nodia-ai-runtime.module', 'NodiaAiRuntimeModule'],
    ['user/user.module', 'UserModule'],
    ['nodia-ai-runtime/use-case/run-nodia-ai-stage.use-case', 'RunNodiaAiStageUseCase'],
    ['nodia-ai-context/use-case/process-nodia-ai-stage.use-case', 'ProcessNodiaAiStageUseCase'],
    ['nodia-ai-conversation/use-case/create-nodia-ai-conversation.use-case', 'CreateNodiaAiConversationUseCase'],
    ['nodia-ai-conversation/use-case/admit-nodia-ai-message.use-case', 'AdmitNodiaAiMessageUseCase'],
    ['nodia-ai-adapter/use-case/codex-nodia-ai-adapter.use-case', 'CodexNodiaAiAdapterUseCase'],
    ['common/ai/codex/codex-runtime.service', 'CodexRuntimeService'],
    ['common/ai/codex/codex-chat-runtime', 'CodexChatRuntime'],
    ['common/redis/redis.service', 'RedisService'],
    ['nodia-ai-tools/use-case/execute-nodia-ai-tool.use-case', 'ExecuteNodiaAiToolUseCase'],
    ['nodia-ai-runtime/use-case/reserve-nodia-ai-runtime-slot.use-case', 'ReserveNodiaAiRuntimeSlotUseCase'],
    ['nodia-ai-runtime/use-case/checkpoint-nodia-ai-job.use-case', 'CheckpointNodiaAiJobUseCase'],
    ['nodia-ai-runtime/use-case/recover-nodia-ai-jobs.use-case', 'RecoverNodiaAiJobsUseCase'],
    ['nodia-ai-runtime/use-case/reconcile-nodia-ai-runtime.use-case', 'ReconcileNodiaAiRuntimeUseCase'],
    ['nodia-ai-runtime/types/reconciliation.types', 'NodiaAiRuntimeReconciliationPort'],
    ['nodia-ai/use-case/authorize-nodia-ai.use-case', 'AuthorizeNodiaAiUseCase'],
    ['user/use-case/save-user.use-case', 'SaveUserUseCase'],
  ];
  const [Conversation, Processing, Runtime, Users, RunStage, ProcessStage, Create, Admit, Adapter, NativeRuntime,
    ChatRuntime, Redis, Tools, Reserve, Checkpoint, Recover, Reconcile, NativePort, Authorize, SaveUser] =
    await Promise.all(names.map(([file, name]) => load(file, name)));
  const { NODIA_AI_STAGE_HANDLER, NodiaAiLostLeaseError } = await import(pathToFileURL(join(RELEASE, 'dist/nodia-ai-runtime/types/worker.types.js')));
  const { ForbiddenException } = require('@nestjs/common');
  const { NODIA_AI_RUNTIME_POLICY } = await import(pathToFileURL(join(RELEASE, 'dist/nodia-ai-runtime/config/runtime-policy.js')));
  const proofHelpers = await import(pathToFileURL(join(RELEASE, 'dist/nodia-ai-runtime/use-case/runtime-reconciliation-descriptor.js')));
  const { bindObservationReservation, observationMatchesManifest } = await import(pathToFileURL(join(RELEASE, 'dist/nodia-ai-context/use-case/nodia-ai-observation-identity.js')));
  const { sameCodexProcess, assertCodexGroupEmpty } = await import(pathToFileURL(join(RELEASE, 'dist/common/ai/codex/codex-process-ownership.js')));
  let processStage, gateway, reserve, adapter, nativePort, checkpoint, authorize, saveUser;
  const identity = config.provided_fixture.identities[0], admin = config.provided_fixture.identities[2];
  const diagnosticHandler = {
    get catalogVersions() { return processStage.catalogVersions; },
    async execute(claim, context) {
      if (claim.job.stage_key === 'context') { contextUsed = true; return processStage.execute(claim, context); }
      assert.equal(claim.job.stage_key, 'inference'); capturedClaim = claim; capturedContext = context;
      assert.equal(dispatched, 0);
      const observed = await adapter.observe(config.selection, context.signal);
      assert.equal(observed.available, true); assert.equal(observed.supportsMcp, true);
      assert.equal(observationMatchesManifest(config.selection, observed, claim.run.context_manifest), true);
      const tools = (await gateway.descriptors(claim, context)).filter(tool => tool.name === 'nodia_knowledge_index');
      assert.equal(tools.length, 1);
      const reservation = bindObservationReservation(config.selection, observed,
        await reserve.execute(claim, observed.resourceKey, claim.attempt.id), claim.attempt.id);
      const deadlineAt = await context.armDispatch(config.selection, reservation,
        manager => adapter.verifyConfiguration(config.selection, observed.configurationGeneration, manager));
      const [armed] = await db.query('SELECT recovery_descriptor FROM nodia_ai_jobs WHERE id=$1', [claim.job.id]);
      nativeRequest = proofHelpers.readRuntimeProofRequest(armed.recovery_descriptor);
      assert.equal(nativeRequest.attemptId, claim.attempt.id); assert.equal(nativeRequest.adapterIdentity.connectionId, '1');
      dispatched++;
      adapterOperation = adapter.execute({ attemptId: claim.attempt.id, selection: config.selection,
        canonicalPrompt: RECOVERY_REQUEST, deadlineAt, resourceKey: observed.resourceKey,
        configurationGeneration: observed.configurationGeneration, sessionGeneration: observed.sessionGeneration, tools,
        onLeaseCheck: signal => processStage.assertRuntimeLease(claim, context, reservation, signal),
        onProtocolProgress: (total, signal, unforwarded = 0) => processStage.protocolProgress(claim, context, total, signal, unforwarded),
        onToolCall: async (call, signal) => {
          callbacks++; assert.equal(callbacks, 1); assert.equal(call.name, 'nodia_knowledge_index');
          assert.deepEqual(call.arguments, {}); signal.throwIfAborted();
          yes('real_provider_callback_before_gateway', true);
          const owner = await compiled.get(ChatRuntime).journal.read(nativeRequest.attemptId);
          assert.equal(owner.state, 'submitted'); assert.ok(owner.native && owner.rpcCount >= 1);
          if (config.scenario === 'cancel') {
            phase = 'real_callback_exclusion';
            for (const caseName of RECOVERY_CONTENDER_CASES) await contender(caseName);
            contenderClosureConfirmed = true; yes('five_contenders_closed_without_native_inference', contenders.length === 5);
            phase = 'native_cancel_requested';
            cancellationOperation = nativePort.reconcile(nativeRequest, AbortSignal.timeout(12000));
            void cancellationOperation.catch(() => {});
            await waitForNativeAbort(signal, 12000);
            yes('native_signal_aborted_after_real_cancel_request', signal.aborted);
            yes('cancel_did_not_enter_gateway', gatewayCalls === 0);
            throw signal.reason ?? new Error('nodia_ai:cancelled');
          }
          phase = 'fixture_core_revocation';
          await saveUser.execute(identity.userId, { modules: [] }, admin);
          yes('core_save_user_removed_fixture_modules', (await db.query('SELECT count(*)::integer n FROM user_modules WHERE user_id=$1', [identity.userId]))[0].n === 0);
          await denied(() => db.transaction(manager => authorize.execute(identity, {}, manager)));
          yes('current_authorization_rejects_revoked_actor', true);
          const [lease] = await db.query('SELECT lease_until>clock_timestamp() live FROM nodia_ai_jobs WHERE id=$1', [claim.job.id]);
          yes('late_checkpoint_probe_has_live_unmodified_lease', lease.live === true);
          let checkpointWork = false, latePersist = false;
          await denied(() => checkpoint.execute(claim, async () => { checkpointWork = true; }));
          await denied(() => checkpoint.finish(claim, { status: 'completed', persist: async () => { latePersist = true; } }));
          yes('late_callback_work_not_executed', checkpointWork === false);
          yes('late_finish_persist_not_executed', latePersist === false);
          let gatewayRejection;
          try { gatewayCalls++; await gateway.execute(claim, context, call); } catch (failure) { gatewayRejection = failure; }
          assert.ok(gatewayRejection);
          if (gatewayRejection instanceof ForbiddenException) {
            assert.equal(gatewayRejection.getStatus(), 403);
            assert.equal(gatewayRejection.getResponse()?.message, 'nodia_ai:capability_denied');
            gatewayDenial = { kind: 'current_authorization', http_status: 403, code: 'nodia_ai:capability_denied' };
          } else {
            assert.ok(gatewayRejection instanceof NodiaAiLostLeaseError);
            gatewayDenial = { kind: 'worker_lost_lease', http_status: null, code: 'nodia_ai:lease_lost' };
          }
          nativeFailure = safeRecoveryError(gatewayRejection);
          yes('real_gateway_rejects_late_callback', true);
          throw gatewayRejection;
        },
      }, context.signal);
      // Observe the SAME promise even when RunStage returns on its separate abort race.
      void adapterOperation.then(() => { adapterSettled = true; }, () => { adapterSettled = true; });
      const reply = await adapterOperation;
      nativeFailure = { unexpected_answer_kind: reply.kind };
      throw new Error('operator_expected_unknown_after_callback');
    },
  };
  const { Test } = require('@nestjs/testing'), { TypeOrmModule } = require('@nestjs/typeorm');
  phase = 'compiled_application';
  compiled = await Test.createTestingModule({ imports: [TypeOrmModule.forRootAsync({ useFactory: () => config.provided_fixture.options,
    dataSourceFactory: async () => db }), Conversation, Processing, Runtime, Users], providers: [RunStage] })
    .overrideProvider(Redis).useValue({ get: async () => null, set: async () => {}, del: async () => {}, keys: async () => [] })
    .overrideProvider(NODIA_AI_STAGE_HANDLER).useValue(diagnosticHandler).setLogger(false).compile();
  processStage = compiled.get(ProcessStage); gateway = compiled.get(Tools); reserve = compiled.get(Reserve);
  adapter = compiled.get(Adapter); nativePort = compiled.get(NativePort); checkpoint = compiled.get(Checkpoint);
  authorize = compiled.get(Authorize); saveUser = compiled.get(SaveUser); applicationReady = true;
  assert.equal(compiled.get(RunStage).handler, diagnosticHandler);
  assert.equal(adapter.runtime, compiled.get(ChatRuntime));
  const actor = await db.transaction(manager => authorize.execute(identity, {}, manager));
  yes('fixture_actor_is_not_super_admin', actor.isSuperAdmin === false);
  assert.deepEqual(actor.modules.map(module => module.route), ['/tools/nodia-ai']);
  const adminActor = await db.transaction(manager => authorize.execute(admin, {}, manager));
  yes('separate_fixture_admin_is_super_admin', adminActor.isSuperAdmin === true);
  if (config.execution_mode === 'bootstrap') {
    bootstrapComplete = true; safe = true; phase = 'bootstrap_complete'; throw BOOTSTRAP;
  }
  const nativeBinary = await compiled.get(NativeRuntime).executable();
  const binaryInfo = await lstat(nativeBinary); assert.ok(binaryInfo.isFile() && !binaryInfo.isSymbolicLink());
  assert.equal(sha256(await readFile(nativeBinary)), config.expected_binary_sha256);
  phase = 'normal_create_admit';
  const chat = await compiled.get(Create).execute(identity, { client_request_id: randomUUID(), selection: config.selection });
  chatId = chat.conversation_id;
  const [before] = await db.query('SELECT revision FROM nodia_ai_conversations WHERE id=$1', [chatId]);
  const admission = await compiled.get(Admit).execute(identity, chatId, { client_message_id: randomUUID(),
    expected_conversation_revision: before.revision, parts: [{ kind: 'text', text: RECOVERY_REQUEST }] });
  runId = admission.run.run_id;
  const [initial] = await db.query("SELECT id,state,stage_key FROM nodia_ai_jobs WHERE run_id=$1 AND kind='turn'", [runId]);
  jobId = initial.id; assert.equal(initial.state, 'ready'); assert.equal(initial.stage_key, 'context');
  const stage = compiled.get(RunStage), policy = compiled.get(NODIA_AI_RUNTIME_POLICY);
  phase = 'production_context_stage';
  assert.equal(await stage.execute(randomUUID(), AbortSignal.timeout(policy.timing.run_seconds * 1000)), true);
  const [prepared] = await db.query('SELECT state,stage_key FROM nodia_ai_jobs WHERE id=$1', [jobId]);
  assert.equal(prepared.state, 'ready'); assert.equal(prepared.stage_key, 'inference'); assert.equal(dispatched, 0);
  phase = 'diagnostic_inference_stage';
  assert.equal(await stage.execute(randomUUID(), AbortSignal.timeout(policy.timing.run_seconds * 1000)), true);
  assert.ok(adapterOperation && nativeRequest);
  const settlement = await settledWithin(adapterOperation, 15000);
  yes('same_adapter_operation_settled_before_cleanup', adapterSettled && Object.hasOwn(settlement, 'error'));
  nativeFailure ??= safeRecoveryError(settlement.error);
  yes('exactly_one_callback_and_one_armed_dispatch', callbacks === 1 && dispatched === 1);
  if (config.scenario === 'cancel') {
    assert.equal(contenderClosureConfirmed, true);
    const cancelled = await settledWithin(cancellationOperation, 3000);
    assert.ok(cancelled.value); proofHelpers.assertRuntimeTerminalProof(nativeRequest, cancelled.value);
    yes('native_cancel_returns_exact_unknown_terminal', cancelled.value.outcome === 'abandoned_unknown');
  }
  phase = 'natural_lease_recovery';
  let [pending] = await db.query('SELECT state,lease_until FROM nodia_ai_jobs WHERE id=$1', [jobId]);
  if (pending.state === 'leased') {
    const [clock] = await db.query('SELECT clock_timestamp() now');
    const waitMs = pending.lease_until.getTime() - clock.now.getTime() + 200;
    assert.ok(waitMs > 0 && waitMs <= (policy.timing.lease_seconds + 1) * 1000);
    await new Promise(resolveWait => setTimeout(resolveWait, waitMs));
    await compiled.get(Recover).execute();
    [pending] = await db.query('SELECT state FROM nodia_ai_jobs WHERE id=$1', [jobId]);
    yes('expired_armed_lease_recovered_without_replay', pending.state === 'unknown');
  }
  assert.equal(pending.state, 'unknown');
  phase = 'admin_reconciliation_once';
  reconciliation = await compiled.get(Reconcile).execute(admin, jobId);
  assert.equal(reconciliation.resolved, true); assert.equal(reconciliation.cleanup_pending, false);
  assert.equal((await db.query('SELECT id FROM nodia_ai_jobs WHERE id=$1', [jobId])).length, 0);
  receipts.push(await inspectRecoveryAck({ journal: compiled.get(ChatRuntime).journal, request: nativeRequest, profileRoot,
    sameProcess: sameCodexProcess, assertGroupEmpty: assertCodexGroupEmpty }));
  if (config.scenario === 'cancel') yes('durable_native_cancel_requested', receipts[0].cancel_requested === true);
  yes('terminal_ack_and_physical_closure_before_fixture_cleanup', true);
  const [run] = await db.query('SELECT state,error_code,provider_dispatches_used,tool_calls_used,assistant_message_id FROM nodia_ai_runs WHERE id=$1', [runId]);
  assert.equal(run.state, 'failed'); assert.equal(run.error_code, 'nodia_ai:outcome_unknown');
  assert.equal(run.provider_dispatches_used, 1); assert.equal(run.tool_calls_used, 0); assert.equal(run.assistant_message_id, null);
  [finalSql] = await db.query(`SELECT
    (SELECT count(*)::integer FROM nodia_ai_jobs WHERE state IN ('ready','leased','unknown','waiting') OR kind='reconcile') pending_jobs,
    (SELECT count(*)::integer FROM nodia_ai_runtime_slots WHERE state<>'free') retained_slots,
    (SELECT count(*)::integer FROM nodia_ai_executions) business_executions,
    (SELECT count(*)::integer FROM nodia_ai_tool_calls) tool_receipts,
    (SELECT count(*)::integer FROM nodia_ai_messages WHERE role='assistant') assistant_messages`);
  assert.ok(Object.values(finalSql).every(value => value === 0));
  yes('no_late_result_business_effect_or_replay', true); safe = true; phase = 'complete';
} catch (failure) { if (failure !== BOOTSTRAP) error = safeRecoveryError(failure); }
finally {
  // Never reconcile/ACK on a failed contender: an unclosed blocked login must remain fenced by its owner.
  // Never destroy the SQL fixture or DI while the original adapter promise is still unresolved.
  if (adapterOperation && !adapterSettled) {
    try { await settledWithin(adapterOperation, 15000); } catch { /* retained for exact operator recovery */ }
  }
  if (!adapterOperation || adapterSettled) {
    await compiled?.close().catch(() => {});
    if (db?.isInitialized) await db.destroy().catch(() => {});
  }
}
console.log(JSON.stringify({ schema: 'nodia-ai-ai40-recovery-child-v1', status: !error && safe ? 'passed' : 'failed',
  started_at_utc: started, finished_at_utc: new Date().toISOString(), phase, error, scenario: config?.scenario,
  blocked_login_request_id: config?.blocked_login_request_id, selection: config?.selection,
  release: RELEASE, release_manifest_sha256: RELEASE_SHA, run_id: runId, job_id: jobId,
  native_request: nativeRequest ?? null, native_failure: nativeFailure, gateway_rejection: gatewayDenial, reconciliation, final_sql: finalSql,
  scenario_assertions: assertions, contenders, native_terminal_ack_receipts: receipts,
  total_provider_dispatches: dispatched, max_authorized_provider_dispatches: 1,
  production_context_stage_used: contextUsed,
  diagnostic_inference_handler_used: !!capturedClaim, diagnostic_handler_configured: applicationReady,
  dry_bootstrap_complete_before_account_or_dispatch: bootstrapComplete,
  runtime_policy_overridden: false, readiness_overridden: false, executable_overridden: false, publication_overridden: false,
  redis_event_bus_synthetic: true, fixture_sql_safe_to_remove: safe,
  retained_disposable_container: safe ? null : config?.provided_fixture?.container_name,
  operational_database_accessed: false, operational_profile_removed: false, full_C40_09_accepted: false,
  limits: ['Diagnostic inference callback; not a UI Stop endpoint or a daemon interruption.',
    'Fixture actor1 authorization is independent of the operational account; admin3 reconciles only this fixture.',
    'An armed unknown invalidates scoped MCP/MIME qualifications; no proof is restored or provider generation retried.'] }, null, 2));
if (error || !safe) process.exitCode = 1;
