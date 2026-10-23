// AI39: compiled Nest/SQL/router/journal/gateway with a synthetic JSONL subprocess.
// No operational account, configured database, credentials or provider inference is used.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, mkdir, writeFile, rm, readFile, readdir, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { createNodiaAiIntegrationFixture, loadAi } from './nodia-ai.integration.fixture.mjs';
import { createNodiaAiUnpublishedFixture } from './nodia-ai-unpublished.fixture.mjs';

assert.equal(process.platform, 'linux', 'Native ownership integration requires Linux');
const childMode = process.argv.includes('--synthetic-child');
let childInitializationStage = 'framework_imports';
function safeDiagnostic(error) {
  const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
  const compiledFrames = typeof error?.stack === 'string' ? error.stack.split('\n').slice(1).flatMap(line => {
    if (!line.includes(root + sep)) return [];
    const match = line.match(/\/(dist|test)\/([A-Za-z0-9_./-]{1,220}\.(?:mjs|js)):(\d{1,8}):(\d{1,6})/);
    return match ? [{ source: `${match[1]}/${match[2]}`, line: Number(match[3]), column: Number(match[4]) }] : [];
  }).slice(0, 8) : [];
  const response = error?.getResponse?.();
  const rawCode = typeof error?.code === 'string' ? error.code : typeof response?.code === 'string' ? response.code : error?.message;
  return { name: /^[A-Za-z0-9_]{1,64}$/.test(error?.name ?? '') ? error.name : 'Error',
    code: typeof rawCode === 'string' && /^(nodia_ai:|codex_)[a-z0-9_:]{1,128}$/.test(rawCode) ? rawCode : null,
    source_frames: compiledFrames };
}
const childTypes = [
  ['nodia-ai-conversation/nodia-ai-conversation.module', 'NodiaAiConversationModule'],
  ['nodia-ai-context/nodia-ai-processing.module', 'NodiaAiProcessingModule'],
  ['nodia-ai-runtime/nodia-ai-runtime.module', 'NodiaAiRuntimeModule'],
  ['nodia-ai-runtime/use-case/run-nodia-ai-stage.use-case', 'RunNodiaAiStageUseCase'],
  ['nodia-ai-conversation/use-case/create-nodia-ai-conversation.use-case', 'CreateNodiaAiConversationUseCase'],
  ['nodia-ai-conversation/use-case/admit-nodia-ai-message.use-case', 'AdmitNodiaAiMessageUseCase'],
  ['nodia-ai-runtime/use-case/recover-nodia-ai-jobs.use-case', 'RecoverNodiaAiJobsUseCase'],
  ['nodia-ai-runtime/use-case/reconcile-nodia-ai-runtime.use-case', 'ReconcileNodiaAiRuntimeUseCase'],
  ['nodia-ai-runtime/use-case/cleanup-nodia-ai-runtime-proofs.use-case', 'CleanupNodiaAiRuntimeProofsUseCase'],
  ['nodia-ai-runtime/types/reconciliation.types', 'NodiaAiRuntimeReconciliationPort'],
  ['nodia-ai-adapter/use-case/codex-nodia-ai-adapter.use-case', 'CodexNodiaAiAdapterUseCase'],
  ['common/ai/codex/codex-runtime.service', 'CodexRuntimeService'],
  ['common/redis/redis.service', 'RedisService'],
  ['common/ai/codex/codex-chat-runtime', 'CodexChatRuntime'],
];

async function childMain() {
  const { Test } = await import('@nestjs/testing');
  const { TypeOrmModule } = await import('@nestjs/typeorm');
  const { DataSource } = await import('typeorm');
  childInitializationStage = 'fixture_options';
  const options = JSON.parse(process.env.NODIA_AI39_FIXTURE_DB);
  assert.equal(options.host, '127.0.0.1'); assert.equal(options.database, 'ai39'); assert.notEqual(options.port, 5432);
  childInitializationStage = 'application_imports';
  const [Conversation, Processing, Runtime, RunStage, Create, Admit, Recover, Reconcile, Cleanup, NativePort, CodexAdapter, CodexRuntime, Redis, CodexChatRuntime] =
    await Promise.all(childTypes.map(([path, name]) => loadAi(path, name).catch(error => {
      if (error && typeof error === 'object') error.syntheticImport = path;
      throw error;
    })));
  childInitializationStage = 'disposable_datasource';
  const db = await new DataSource(options).initialize();
  childInitializationStage = 'unpublished_fixture';
  const unpublished = await createNodiaAiUnpublishedFixture();
  childInitializationStage = 'nest_compile';
  const compiled = await unpublished.override(Test.createTestingModule({ imports: [
    TypeOrmModule.forRootAsync({ useFactory: () => options, dataSourceFactory: async () => db }), Conversation, Processing, Runtime,
  ], providers: [RunStage] })).overrideProvider(Redis).useValue({ get: async () => null, set: async () => {}, del: async () => {}, keys: async () => [] }).compile();
  // The sole executable override is private to this synthetic fixture instance.
  // It still uses CodexRpc, native start gate, profile exclusion and process certificates.
  childInitializationStage = 'private_peer_override';
  compiled.get(CodexRuntime).executable = () => process.env.NODIA_AI39_FIXTURE_PEER;
  const adapter = compiled.get(CodexAdapter), observe = adapter.observe.bind(adapter);
  let syntheticReadiness = 0;
  adapter.observe = async (...args) => {
    const result = await observe(...args);
    assert.equal(result.supportsMcp, false, 'Production Codex MCP readiness gate is retained');
    assert.equal(result.available, true, 'Synthetic account/catalog still requires real adapter validation');
    syntheticReadiness++;
    return { ...result, supportsMcp: true }; // Explicit synthetic readiness, never production availability.
  };
  let currentStop;
  const respond = (id, value) => process.send?.({ id, ok: true, value });
  process.on('message', async message => {
    try {
      if (message.command === 'prepare') {
        const chat = await compiled.get(Create).execute(message.identity, { client_request_id: randomUUID(), selection: message.selection });
        const admission = await compiled.get(Admit).execute(message.identity, chat.conversation_id, {
          client_message_id: randomUUID(), expected_conversation_revision: chat.revision,
          parts: [{ kind: 'text', text: message.marker }],
        });
        respond(message.id, { conversationId: chat.conversation_id, runId: admission.run.run_id, syntheticReadiness });
      } else if (message.command === 'stage') {
        currentStop = new AbortController();
        const result = await compiled.get(RunStage).execute(randomUUID(), currentStop.signal);
        respond(message.id, { result, syntheticReadiness });
      } else if (message.command === 'recover') {
        respond(message.id, await compiled.get(Recover).execute());
      } else if (message.command === 'reconcile') {
        respond(message.id, await compiled.get(Reconcile).execute(message.identity, message.jobId));
      } else if (message.command === 'cleanup') {
        respond(message.id, await compiled.get(Cleanup).execute());
      } else if (message.command === 'prune_at_original_deadline') {
        const nativeJournal = compiled.get(CodexChatRuntime).journal;
        const record = await nativeJournal.read(message.attemptId);
        assert.equal(record.acknowledged, true, 'Only the already acknowledged synthetic receipt may be expired');
        const actualNow = Date.now, originalDeadline = Date.parse(record.expiresAt);
        // Fixture-only clock injection; preserve the original record and production retention policy.
        // No worker/provider operation runs in this API process while pruning is awaited.
        Date.now = () => originalDeadline + 1;
        try { await nativeJournal.prune(); } finally { Date.now = actualNow; }
        respond(message.id, { absent: await nativeJournal.read(message.attemptId) === null,
          original_deadline_preserved: true, fixture_clock_only: true });
      } else if (message.command === 'cancel_native') {
        const { readRuntimeProofRequest } = await import('../dist/nodia-ai-runtime/use-case/runtime-reconciliation-descriptor.js');
        const [job] = await db.query('SELECT recovery_descriptor FROM nodia_ai_jobs WHERE id=$1', [message.jobId]);
        const proof = await compiled.get(NativePort).reconcile(readRuntimeProofRequest(job.recovery_descriptor), AbortSignal.timeout(15000));
        respond(message.id, { outcome: proof.outcome, processClosed: proof.processClosed });
      } else if (message.command === 'stop_stage') {
        currentStop?.abort(new Error('Synthetic fixture shutdown')); respond(message.id, true);
      } else if (message.command === 'close') {
        await compiled.close(); unpublished.close(); respond(message.id, true); process.disconnect();
      } else throw Error('Invalid synthetic command');
    } catch (error) {
      const code = typeof error?.message === 'string' && /^(nodia_ai:|codex_)[a-z0-9_:]+$/.test(error.message) ? error.message : 'synthetic_fixture_error';
      process.send?.({ id: message.id, ok: false, code, status: error?.getStatus?.() ?? null, diagnostic: safeDiagnostic(error) });
    }
  });
  childInitializationStage = 'ready';
  process.send?.({ kind: 'ready', pid: process.pid });
}

async function parentMain() {
  const fixture = await createNodiaAiIntegrationFixture('ai39');
  const root = await mkdtemp(join(tmpdir(), 'nodia-ai39-process-'));
  const profileRoot = join(root, 'profiles'), home = join(root, 'home');
  await mkdir(profileRoot, { mode: 0o700 }); await mkdir(home, { mode: 0o700 });
  const executable = join(root, 'synthetic-codex');
  const quote = value => `'${value.replaceAll("'", "'\\''")}'`;
  await writeFile(executable, `#!/bin/sh\nexec ${quote(process.execPath)} ${quote(fileURLToPath(new URL('./fixtures/codex-chat-peer.mjs', import.meta.url)))} "$@"\n`, { mode: 0o700 });
  const children = new Set(), checks = [], scenarios = [];
  let activeScenario = null, activeRunId = null;
  const check = (name, condition) => { assert.ok(condition, name); checks.push(name); };
  const { db } = fixture;
  async function start() {
    const child = fork(fileURLToPath(import.meta.url), ['--synthetic-child'], { cwd: process.cwd(),
      env: { PATH: process.env.PATH, HOME: home, NODE_ENV: 'test', RATE_LIMIT_STORAGE: 'memory', DOTENV_CONFIG_PATH: '/dev/null',
        // Imported AuthModule validates startup config even though this fixture calls authenticated use cases directly.
        // These values belong only to the disposable process; no real Google login or token validation occurs.
        AUTH_JWT_SECRET: randomUUID() + randomUUID(), GOOGLE_CLIENT_ID: 'synthetic-ai39.apps.googleusercontent.com',
        AUTH_ALLOWED_ORIGINS: 'http://127.0.0.1',
        NODIA_CODEX_ENABLED: 'true', NODIA_CODEX_PROFILE_ROOT: profileRoot, NODIA_AI39_FIXTURE_PEER: executable,
        NODIA_AI39_FIXTURE_DB: JSON.stringify(fixture.options) }, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
    children.add(child);
    const ready = await Promise.race([once(child, 'message').then(([v]) => v), once(child, 'exit').then(() => { throw Error('Synthetic child initialization failed'); }), delay(30000, undefined, { ref: false }).then(() => { throw Error('Synthetic child initialization timeout'); })]);
    if (ready.kind !== 'ready') throw Object.assign(Error('synthetic_initialization_error'), { cause: ready });
    let sequence = 0; const pending = new Map();
    child.on('message', value => { const p = pending.get(value.id); if (p) { pending.delete(value.id); clearTimeout(p.timer); if (value.ok) p.resolve(value.value); else p.reject(Object.assign(Error(value.code), { cause: { kind: 'command_error', diagnostic: value.diagnostic } })); } });
    child.on('exit', () => { for (const p of pending.values()) { clearTimeout(p.timer); p.reject(Error('Synthetic child exited')); } pending.clear(); children.delete(child); });
    const command = (command, input = {}) => new Promise((resolveCommand, reject) => {
      const id = ++sequence, timer = setTimeout(() => { pending.delete(id); reject(Error('Synthetic command timeout')); }, 90000).unref();
      pending.set(id, { resolve: resolveCommand, reject, timer }); child.send({ id, command, ...input });
    });
    return { child, command, async close() { const exited = once(child, 'exit'); await command('close'); await exited; } };
  }
  async function waitFor(work, label, timeout = 20000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) { const value = await work(); if (value) return value; await delay(40); }
    throw Error(`Synthetic timeout: ${label}`);
  }
  async function snapshot(runId) {
    const [run] = await db.query('SELECT * FROM nodia_ai_runs WHERE id=$1', [runId]);
    const jobs = await db.query('SELECT * FROM nodia_ai_jobs WHERE run_id=$1', [runId]);
    const receipts = await db.query('SELECT * FROM nodia_ai_tool_calls WHERE run_id=$1', [runId]);
    const attempts = await db.query('SELECT a.* FROM nodia_ai_job_attempts a JOIN nodia_ai_jobs j ON j.id=a.job_id WHERE j.run_id=$1 ORDER BY a.attempt_no', [runId]);
    return { run, jobs, receipts, attempts };
  }
  async function journal(attemptId) { return JSON.parse(await readFile(join(profileRoot, 'chat-jobs', `${attemptId}.json`), 'utf8')); }
  try {
    const [provider] = await db.query(`INSERT INTO ai_providers(catalog_id,name,is_active,use_token_plan_agentic,fields)
      SELECT id,'Synthetic AI39 only',true,true,$1::jsonb FROM ai_provider_catalog WHERE key='openai' RETURNING id`,
    [JSON.stringify({ token_plan_agentic: { selected_model: 'synthetic-ai39-model', thinking_level: 'high' } })]);
    assert.ok(provider?.id, 'Disposable OpenAI catalog connection exists');
    const selection = { connection_id: provider.id, mode: 'token_plan_agentic', model_id: 'synthetic-ai39-model', effort_id: 'high' };
    const api = await start(); let worker = await start();
    check('API and worker have distinct process identities', api.child.pid !== worker.child.pid);
    for (const scenario of ['success', 'peer_crash', 'cancel', 'supervisor_crash', 'ack_cleanup_rollback_after_native_ack']) {
      activeScenario = scenario;
      const marker = scenario === 'peer_crash' ? 'AI39_CRASH_AFTER_TOOL' : ['cancel', 'supervisor_crash'].includes(scenario) ? 'AI39_HANG_AFTER_TOOL' : 'AI39_TOOL';
      const created = await api.command('prepare', { identity: fixture.identities.get('1'), selection, marker });
      activeRunId = created.runId;
      check(`${scenario}: synthetic observation still validates selected account/model and preserves explicit readiness gate`, created.syntheticReadiness > 0);
      assert.equal((await worker.command('stage')).result, true); // Context only.
      const running = worker.command('stage');
      // Attach rejection now: the supervisor crash intentionally drops this IPC response.
      const settled = running.then(value => ({ value }), error => ({ error }));
      const receipt = await waitFor(async () => (await snapshot(created.runId)).receipts.find(value => value.state === 'completed'), `${scenario} tool receipt`);
      const before = await snapshot(created.runId);
      const job = before.jobs.find(value => value.kind === 'turn');
      const inference = before.attempts.find(value => value.stage_key === 'inference');
      check(`${scenario}: real gateway creates one completed technical receipt`, before.receipts.length === 1 && receipt.tool_name === 'nodia_knowledge_index');
      check(`${scenario}: private Codex identity is armed in schema2 before gateway`, job.recovery_descriptor.schema_version === 2 &&
        job.recovery_descriptor.runtime.provider_key === 'openai' && job.recovery_descriptor.runtime.connection_id === provider.id &&
        job.recovery_descriptor.runtime.attempt_id === inference.id && inference.external_operation_ref === inference.id);
      check(`${scenario}: SQL budgets count one provider dispatch and one gateway call`, before.run.provider_dispatches_used === 1 && before.run.tool_calls_used === 1 && before.run.mcp_rpc_messages_used >= 1);
      const nativeBefore = await journal(inference.id);
      check(`${scenario}: durable native journal has process certificate and protocol measurements`, nativeBefore.native !== null && nativeBefore.frames >= 1 && nativeBefore.rpcCount >= 1 && nativeBefore.bytes > 0);
      if (scenario === 'cancel') {
        const cancelled = await api.command('cancel_native', { jobId: job.id });
        check('cancel: another process requests native cancellation and receives a closure proof', cancelled.processClosed && cancelled.outcome === 'abandoned_unknown');
      } else if (scenario === 'supervisor_crash') {
        const exited = once(worker.child, 'exit'); worker.child.kill('SIGKILL'); await exited; await settled;
        await db.query("UPDATE nodia_ai_jobs SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1", [job.id]);
        check('supervisor crash: another process recovers the expired armed SQL lease', await api.command('recover') === 1);
      }
      if (scenario !== 'supervisor_crash') { const value = await settled; if (value.error) throw value.error; }
      let after = await snapshot(created.runId);
      let nativeAckBeforePurge = null;
      if (scenario === 'success' || scenario === 'ack_cleanup_rollback_after_native_ack') {
        check('success: worker seals one assistant response and releases its runtime slot', after.run.state === 'completed' && after.run.assistant_message_id !== null);
        if (scenario === 'ack_cleanup_rollback_after_native_ack') {
          const [ackJob] = await db.query("SELECT * FROM nodia_ai_jobs WHERE kind='reconcile' AND dedup_key=$1", ['ack:' + inference.id]);
          assert.ok(ackJob, 'The exact ACK cleanup job exists before the injected fault');
          // A nontransactional sequence makes this a one-shot SQL failure, after the native ACK
          // has really persisted. The failed cleanup transaction rolls back without mutating proof.
          await db.query('CREATE TABLE ai39_cleanup_fault(job_id uuid PRIMARY KEY)');
          await db.query('INSERT INTO ai39_cleanup_fault(job_id) VALUES($1)', [ackJob.id]);
          await db.query('CREATE SEQUENCE ai39_cleanup_delete_attempt_seq');
          await db.query(`CREATE FUNCTION ai39_reject_first_ack_cleanup() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN
              IF EXISTS(SELECT 1 FROM ai39_cleanup_fault WHERE job_id=OLD.id)
                AND nextval('ai39_cleanup_delete_attempt_seq')=1 THEN
                RAISE EXCEPTION 'Synthetic post-ACK cleanup SQL rollback' USING ERRCODE='P0001';
              END IF;
              RETURN OLD;
            END $$`);
          await db.query('CREATE TRIGGER ai39_ack_cleanup_fault BEFORE DELETE ON nodia_ai_jobs FOR EACH ROW EXECUTE FUNCTION ai39_reject_first_ack_cleanup()');
          const failure = await api.command('cleanup').then(() => null, error => error);
          check('ACK rollback: a real SQL fault prevents cleanup commit after native ACK', failure instanceof Error);
          nativeAckBeforePurge = await journal(inference.id);
          const [retained] = await db.query('SELECT * FROM nodia_ai_jobs WHERE id=$1', [ackJob.id]);
          check('ACK rollback: the native receipt is acknowledged while exact SQL proof remains leased', nativeAckBeforePurge.acknowledged &&
            retained.state === 'leased' && retained.recovery_descriptor.terminal_proof.id === nativeAckBeforePurge.terminalProofId &&
            retained.recovery_descriptor.runtime.attempt_id === inference.id);
          const pruned = await api.command('prune_at_original_deadline', { attemptId: inference.id });
          check('ACK rollback: pruning at the unchanged original deadline removes the acknowledged native receipt', pruned.absent &&
            pruned.original_deadline_preserved && pruned.fixture_clock_only);
          await db.query("UPDATE nodia_ai_jobs SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1", [ackJob.id]);
          const retry = await api.command('cleanup');
          check('ACK rollback: retry succeeds from the exact leased SQL proof after native receipt removal', retry.processed === 1 && retry.settled === 1);
          const [fault] = await db.query('SELECT last_value::integer AS attempts FROM ai39_cleanup_delete_attempt_seq');
          check('ACK rollback: exactly two cleanup deletion attempts prove rollback followed by recovery', fault.attempts === 2);
          await db.query('DROP TRIGGER ai39_ack_cleanup_fault ON nodia_ai_jobs');
          await db.query('DROP FUNCTION ai39_reject_first_ack_cleanup()');
          await db.query('DROP SEQUENCE ai39_cleanup_delete_attempt_seq');
          await db.query('DROP TABLE ai39_cleanup_fault');
        } else {
          const cleaned = await api.command('cleanup'); check('success: another process acknowledges the exact durable proof', cleaned.settled === 1);
        }
      } else {
        await waitFor(async () => (await snapshot(created.runId)).run.state === 'unknown', `${scenario} SQL unknown`);
        // Recovery must route by persisted identity even if current configuration no longer permits execution.
        await db.query('UPDATE ai_providers SET is_active=false WHERE id=$1', [provider.id]);
        const reconciled = await api.command('reconcile', { identity: fixture.identities.get('3'), jobId: job.id });
        check(`${scenario}: another process reconciles and acknowledges without mutable connection eligibility`, reconciled.resolved && !reconciled.cleanup_pending);
        await db.query('UPDATE ai_providers SET is_active=true WHERE id=$1', [provider.id]);
      }
      after = await snapshot(created.runId);
      const [slot] = await db.query('SELECT * FROM nodia_ai_runtime_slots WHERE resource_key=$1', [job.recovery_descriptor.runtime.resource_key]);
      const nativeAfter = await journal(inference.id).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
      check(`${scenario}: no replay or duplicate gateway receipt after reconciliation`, after.receipts.length === 1 && after.receipts[0].id === receipt.id && after.run.provider_dispatches_used === 1 && after.run.tool_calls_used === 1);
      check(`${scenario}: durable proof is acknowledged only after native closure`, nativeAfter ? nativeAfter.acknowledged && ['completed', 'abandoned_unknown'].includes(nativeAfter.state)
        : nativeAckBeforePurge?.acknowledged && ['completed', 'abandoned_unknown'].includes(nativeAckBeforePurge.state));
      if (scenario === 'ack_cleanup_rollback_after_native_ack')
        check('ACK rollback: SQL recovery does not recreate a pruned native operation or change the completed run', nativeAfter === null && after.run.state === 'completed');
      check(`${scenario}: physical and SQL slots are released with no pending acknowledgement`, slot.state === 'free' && !after.jobs.some(value => value.state === 'unknown') &&
        !(await db.query("SELECT 1 FROM nodia_ai_jobs WHERE kind='reconcile'")).length);
      const profileNames = await readdir(join(profileRoot, provider.id));
      check(`${scenario}: private native profile has no remaining lock or imported credentials`, !profileNames.includes('nodia.lock') && !profileNames.includes('auth.json'));
      scenarios.push({ scenario, state: after.run.state, provider_dispatches: after.run.provider_dispatches_used, rpc_messages: after.run.mcp_rpc_messages_used,
        completed_tool_receipts: after.receipts.length, journal_record_present: nativeAfter !== null,
        journal_state: nativeAfter?.state ?? 'purged_after_ack', acknowledged: nativeAfter?.acknowledged ?? nativeAckBeforePurge?.acknowledged,
        ...(nativeAckBeforePurge ? { native_ack_observed_before_purge: true, sql_failure: 'explicit_post_ack_transaction_rollback' } : {}) });
      if (scenario === 'supervisor_crash') worker = await start();
    }
    await worker.close(); await api.close();
    check('all fixture supervisors are collected', children.size === 0);
    const [business] = await db.query('SELECT count(*)::integer AS count FROM nodia_ai_executions');
    check('no confirmed business execution or external provider inference is performed', business.count === 0);
    console.log(JSON.stringify({ stage: 'AI39 compiled integration', checks: checks.length, passed: checks, scenarios,
      synthetic_readiness_override: true, jsonl_peer: 'synthetic fixture only', account_requests: 'synthetic peer only', provider_inferences: 0, operational_configuration_changed: false }, null, 2));
  } catch (error) {
    const active = activeRunId ? await snapshot(activeRunId).catch(() => null) : null;
    const activeNative = active ? await Promise.all(active.attempts.map(async attempt => {
      const value = await journal(attempt.id).catch(() => null);
      return value ? { state: value.state, native_certificate_present: value.native !== null,
        frames: value.frames, rpc_messages: value.rpcCount, unforwarded_requests: value.unforwardedRequests,
        acknowledged: value.acknowledged } : null;
    })) : [];
    console.log(JSON.stringify({ stage: 'AI39 compiled integration', failed: true, checks: checks.length, passed: checks, scenarios,
      error: { name: error?.name ?? 'Error', code: typeof error?.message === 'string' &&
        /^(nodia_ai:|codex_|synthetic_)[a-z0-9_:]+$/.test(error.message) ? error.message : null,
        initialization: error?.cause?.kind === 'initialization_error' ? error.cause : null,
        command_diagnostic: error?.cause?.kind === 'command_error' ? error.cause.diagnostic : null },
      active_scenario: activeScenario, sql_diagnostic: active ? {
        run: { state: active.run.state, phase: active.run.phase, error_code: active.run.error_code,
          provider_dispatches: active.run.provider_dispatches_used, tool_calls: active.run.tool_calls_used,
          rpc_messages: active.run.mcp_rpc_messages_used },
        jobs: active.jobs.map(value => ({ kind: value.kind, state: value.state, stage: value.stage_key,
          descriptor_schema: value.recovery_descriptor?.schema_version ?? null })),
        attempts: active.attempts.map(value => ({ stage: value.stage_key, phase: value.phase, error_code: value.error_code })),
        completed_receipts: active.receipts.filter(value => value.state === 'completed').length,
        native_operations: activeNative.filter(Boolean),
      } : null,
      provider_inferences: 0, synthetic_readiness_override: true }, null, 2));
    throw error;
  } finally {
    const exits = [...children].map(child => once(child, 'exit'));
    for (const child of children) child.kill('SIGKILL');
    await Promise.allSettled(exits);
    // Even a failing assertion cannot leave a detached synthetic native group running.
    const { stopCodexGroup } = await import('../dist/common/ai/codex/codex-process-ownership.js');
    const files = await readdir(join(profileRoot, 'chat-jobs')).catch(() => []);
    for (const name of files.filter(value => /^[a-f0-9-]{36}\.json$/.test(value))) {
      const value = JSON.parse(await readFile(join(profileRoot, 'chat-jobs', name), 'utf8'));
      if (value.native) await stopCodexGroup(value.native, true);
    }
    await fixture.close();
    const absolute = await realpath(root);
    assert.ok(absolute.startsWith(resolve(tmpdir()) + sep + 'nodia-ai39-process-'));
    await rm(absolute, { recursive: true, force: true });
  }
}

if (childMode) {
  try { await childMain(); }
  catch (error) {
    const component = typeof error?.context?.name === 'string' && /^[A-Za-z0-9_]{1,128}$/.test(error.context.name) ? error.context.name : null;
    process.send?.({ kind: 'initialization_error', ...safeDiagnostic(error), component,
      stage: childInitializationStage, import_path: typeof error?.syntheticImport === 'string' && childTypes.some(([path]) => path === error.syntheticImport) ? error.syntheticImport : null,
      index: Number.isSafeInteger(error?.context?.index) ? error.context.index : null });
    process.disconnect(); process.exitCode = 1;
  }
} else await parentMain();
