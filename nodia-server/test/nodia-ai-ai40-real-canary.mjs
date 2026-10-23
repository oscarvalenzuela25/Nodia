// OPERATOR ONLY: one real Codex tool generation, disposable PostgreSQL, real Nodia account profile.
// Never run as an automated unit/integration suite. Requires an explicit JSON authorization on stdin.
// No configured database is loaded; no executable, readiness, gateway or publication override exists.
// The diagnostic inference handler delegates the versioned ProcessNodiaAiStageUseCase lease/progress
// methods (TypeScript-private, callable in emitted JS). This is not autonomous worker/UI acceptance.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { createNodiaAiIntegrationFixture, loadAi } from './nodia-ai.integration.fixture.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
const checks = [];
const check = (name, condition) => { assert.ok(condition, name); checks.push(name); };
const exact = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const safeError = error => {
  const response = error?.getResponse?.();
  const code = typeof error?.code === 'string' ? error.code : typeof response?.code === 'string' ? response.code : error?.message;
  return {
    name: /^[A-Za-z0-9_]{1,64}$/.test(error?.name ?? '') ? error.name : 'Error',
    code: typeof code === 'string' && /^(nodia_ai:|codex_)[a-z0-9_:]{1,128}$/.test(code) ? code : null,
  };
};

async function input() {
  let bytes = 0; const chunks = [];
  for await (const chunk of process.stdin) {
    bytes += chunk.length; assert.ok(bytes <= 1024 * 1024, 'Operator input exceeds one MiB'); chunks.push(chunk);
  }
  const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  const keys = ['schema_version', 'authorize_one_real_generation', 'selection', 'provider', 'expected_binary_sha256'];
  assert.ok(exact(value, keys) || exact(value, [...keys, 'provided_fixture']));
  assert.equal(value.schema_version, 1); assert.equal(value.authorize_one_real_generation, true);
  assert.ok(exact(value.selection, ['connection_id', 'mode', 'model_id', 'effort_id']));
  assert.match(value.selection.connection_id, /^[1-9]\d{0,18}$/u);
  assert.ok(BigInt(value.selection.connection_id) <= 9223372036854775807n);
  assert.equal(value.selection.mode, 'token_plan_agentic');
  assert.ok(typeof value.selection.model_id === 'string' && value.selection.model_id.trim() &&
    Buffer.byteLength(value.selection.model_id) <= 1024);
  assert.ok(value.selection.effort_id === null || typeof value.selection.effort_id === 'string' &&
    /^[a-z][a-z0-9_-]{0,31}$/u.test(value.selection.effort_id));
  assert.ok(exact(value.provider, ['is_active', 'catalog_active', 'use_token_plan_agentic', 'can_use_token_plan_agentic', 'updated_at', 'agentic_fields']));
  for (const key of ['is_active', 'catalog_active', 'use_token_plan_agentic', 'can_use_token_plan_agentic'])
    assert.equal(value.provider[key], true);
  assert.ok(typeof value.provider.updated_at === 'string' && Number.isFinite(Date.parse(value.provider.updated_at)));
  assert.ok(value.provider.agentic_fields !== null && typeof value.provider.agentic_fields === 'object' && !Array.isArray(value.provider.agentic_fields));
  assert.match(value.expected_binary_sha256, /^[a-f0-9]{64}$/u);
  if (value.provided_fixture !== undefined) {
    const supplied = value.provided_fixture;
    assert.ok(exact(supplied, ['schema_version', 'container_name', 'options', 'identities']));
    assert.equal(supplied.schema_version, 1);
    assert.match(supplied.container_name, /^template_ai40_[1-9]\d*_[a-f0-9]{8}$/u);
    const options = supplied.options;
    assert.ok(exact(options, ['type', 'host', 'port', 'username', 'password', 'database', 'synchronize', 'entities', 'migrations']));
    assert.equal(options.type, 'postgres'); assert.equal(options.host, '127.0.0.1');
    assert.equal(options.database, 'ai40'); assert.equal(options.username, 'ai40');
    assert.match(options.password, /^[a-f0-9]{40}$/u);
    assert.ok(Number.isSafeInteger(options.port) && options.port > 1024 && options.port <= 65535 && options.port !== 5432);
    assert.equal(options.synchronize, false);
    assert.deepEqual(options.entities, [fileURLToPath(new URL('../dist/**/*.entity.js', import.meta.url))]);
    assert.deepEqual(options.migrations, [fileURLToPath(new URL('../dist/migrations/*.js', import.meta.url))]);
    assert.ok(Array.isArray(supplied.identities) && supplied.identities.length === 3);
    for (const [index, identity] of supplied.identities.entries()) {
      assert.ok(exact(identity, ['userId', 'sessionId']));
      assert.equal(identity.userId, String(index + 1));
      assert.match(identity.sessionId, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u);
    }
  }
  assert.equal(process.platform, 'linux'); assert.equal(process.env.NODIA_CODEX_ENABLED, 'true');
  const root = process.env.NODIA_CODEX_PROFILE_ROOT;
  assert.ok(root && resolve(root) === root && await realpath(root) === root);
  for (const path of [root, join(root, value.selection.connection_id)]) {
    const st = await lstat(path);
    assert.ok(st.isDirectory() && !st.isSymbolicLink() && st.uid === process.getuid() && (st.mode & 0o077) === 0,
      'Existing operational profile must belong to this process user');
  }
  // Presence metadata only. No credential bytes or profile configuration are read or copied.
  assert.equal(await lstat(join(root, value.selection.connection_id, 'auth.json')).then(() => true, error => {
    if (error.code === 'ENOENT') return false; throw error;
  }), false, 'Plain auth.json is not accepted');
  return value;
}

let phase = 'operator_input', fixture, compiled, adapter, runtime, cleanup, reconcile, nativePort;
let runId, jobId, attemptId, reply, selection, nativeRequest;
let safeToDrop = false, failed = null, fixtureContainer = null, finalState = null;
let parentManaged = false;
let providerDispatches = 0, gatewayCalls = 0, initialObservation = null, finalObservation = null;
let adapterFailure = null;
const startedAt = new Date().toISOString();
try {
  const config = await input(); selection = config.selection;
  // AuthModule startup validation only; calls below use fixture-authenticated identities directly.
  // Do not inherit an operational dotenv file or replace the real native profile/keyring environment.
  process.env.AUTH_JWT_SECRET = randomUUID() + randomUUID();
  process.env.GOOGLE_CLIENT_ID = 'synthetic-ai40.apps.googleusercontent.com';
  process.env.AUTH_ALLOWED_ORIGINS = 'http://127.0.0.1';
  phase = 'disposable_postgres';
  if (config.provided_fixture) {
    parentManaged = true;
    const { DataSource } = await import('typeorm');
    const db = await new DataSource(config.provided_fixture.options).initialize();
    fixtureContainer = config.provided_fixture.container_name;
    fixture = {
      db, options: config.provided_fixture.options,
      identities: new Map(config.provided_fixture.identities.map(identity => [identity.userId, identity])),
      // Docker lifecycle remains exclusively with the root operator parent.
      close: async () => { if (db.isInitialized) await db.destroy(); },
    };
  } else {
    fixture = await createNodiaAiIntegrationFixture('ai40');
    fixtureContainer = execFileSync('docker', ['ps', '--filter', `name=^template_ai40_${process.pid}_`, '--format', '{{.Names}}'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    assert.match(fixtureContainer, new RegExp(`^template_ai40_${process.pid}_[a-f0-9]{8}$`, 'u'));
  }
  assert.equal(fixture.options.database, 'ai40'); assert.equal(fixture.options.host, '127.0.0.1');
  assert.notEqual(fixture.options.port, 5432);
  const { db } = fixture;
  phase = 'mirror_public_configuration';
  const [provider] = await db.query(`INSERT INTO ai_providers
    (id,catalog_id,name,is_active,use_token_plan_agentic,fields,updated_at)
    SELECT $1::bigint,id,'AI40 operator canary public configuration mirror',true,true,$2::jsonb,$3::timestamp
    FROM ai_provider_catalog WHERE key='openai' RETURNING id`,
  [selection.connection_id, JSON.stringify({ token_plan_agentic: config.provider.agentic_fields }), config.provider.updated_at]);
  assert.equal(provider?.id, selection.connection_id);
  await db.query("UPDATE ai_provider_catalog SET is_active=true,can_use_token_plan_agentic=true WHERE key='openai'");

  phase = 'compiled_application';
  const { Test } = await import('@nestjs/testing');
  const { TypeOrmModule } = await import('@nestjs/typeorm');
  const names = [
    ['nodia-ai-conversation/nodia-ai-conversation.module', 'NodiaAiConversationModule'],
    ['nodia-ai-context/nodia-ai-processing.module', 'NodiaAiProcessingModule'],
    ['nodia-ai-runtime/nodia-ai-runtime.module', 'NodiaAiRuntimeModule'],
    ['nodia-ai-runtime/use-case/run-nodia-ai-stage.use-case', 'RunNodiaAiStageUseCase'],
    ['nodia-ai-conversation/use-case/create-nodia-ai-conversation.use-case', 'CreateNodiaAiConversationUseCase'],
    ['nodia-ai-conversation/use-case/admit-nodia-ai-message.use-case', 'AdmitNodiaAiMessageUseCase'],
    ['nodia-ai-context/use-case/process-nodia-ai-stage.use-case', 'ProcessNodiaAiStageUseCase'],
    ['nodia-ai-adapter/use-case/codex-nodia-ai-adapter.use-case', 'CodexNodiaAiAdapterUseCase'],
    ['common/ai/codex/codex-runtime.service', 'CodexRuntimeService'],
    ['common/redis/redis.service', 'RedisService'],
    ['nodia-ai-tools/use-case/execute-nodia-ai-tool.use-case', 'ExecuteNodiaAiToolUseCase'],
    ['nodia-ai-runtime/use-case/reserve-nodia-ai-runtime-slot.use-case', 'ReserveNodiaAiRuntimeSlotUseCase'],
    ['nodia-ai-runtime/use-case/release-nodia-ai-runtime-slot.use-case', 'ReleaseNodiaAiRuntimeSlotUseCase'],
    ['nodia-ai-runtime/use-case/cleanup-nodia-ai-runtime-proofs.use-case', 'CleanupNodiaAiRuntimeProofsUseCase'],
    ['nodia-ai-runtime/use-case/reconcile-nodia-ai-runtime.use-case', 'ReconcileNodiaAiRuntimeUseCase'],
    ['nodia-ai-runtime/types/reconciliation.types', 'NodiaAiRuntimeReconciliationPort'],
  ];
  const [Conversation, Processing, Runtime, RunStage, Create, Admit, ProcessStage, CodexAdapter, CodexRuntime, Redis,
    Tools, Reserve, Release, Cleanup, Reconcile, NativePort] = await Promise.all(names.map(([file, name]) => loadAi(file, name)));
  const { NODIA_AI_STAGE_HANDLER } = await import('../dist/nodia-ai-runtime/types/worker.types.js');
  const { bindObservationReservation, observationMatchesManifest } = await import('../dist/nodia-ai-context/use-case/nodia-ai-observation-identity.js');
  const { readRuntimeProofRequest } = await import('../dist/nodia-ai-runtime/use-case/runtime-reconciliation-descriptor.js');
  let processStage, gateway, reserve, release;
  const diagnosticHandler = {
    get catalogVersions() { return processStage.catalogVersions; },
    async execute(claim, context) {
      if (claim.job.stage_key === 'context') return processStage.execute(claim, context);
      assert.equal(claim.job.stage_key, 'inference'); attemptId = claim.attempt.id; jobId = claim.job.id;
      const observed = await adapter.observe(selection, context.signal);
      assert.equal(observed.available, true); assert.equal(observationMatchesManifest(selection, observed, claim.run.context_manifest), true);
      const descriptors = await gateway.descriptors(claim, context);
      const tools = descriptors.filter(tool => tool.name === 'nodia_knowledge_index');
      assert.equal(tools.length, 1, 'Exact knowledge descriptor must be authorized by the real grant/catalog');
      const reservation = bindObservationReservation(selection, observed,
        await reserve.execute(claim, observed.resourceKey, claim.attempt.id), claim.attempt.id);
      const deadlineAt = await context.armDispatch(selection, reservation, manager =>
        adapter.verifyConfiguration(selection, observed.configurationGeneration, manager));
      const [armed] = await db.query('SELECT recovery_descriptor FROM nodia_ai_jobs WHERE id=$1', [jobId]);
      nativeRequest = readRuntimeProofRequest(armed.recovery_descriptor);
      check('Codex schema2 descriptor is durable before the real generation', armed.recovery_descriptor.schema_version === 2 &&
        nativeRequest.attemptId === attemptId && nativeRequest.adapterIdentity.connectionId === selection.connection_id);
      providerDispatches++;
      reply = await adapter.probeMcp({
        attemptId, selection,
        canonicalPrompt: 'This is an authorized NodiaAI operator transport canary. Use only the supplied published read tool. No business change is requested.',
        deadlineAt, resourceKey: observed.resourceKey, configurationGeneration: observed.configurationGeneration,
        sessionGeneration: observed.sessionGeneration, tools,
        onLeaseCheck: signal => processStage.assertRuntimeLease(claim, context, reservation, signal),
        onProtocolProgress: (total, signal, unforwarded = 0) => processStage.protocolProgress(claim, context, total, signal, unforwarded),
        onToolCall: async (call, signal) => {
          assert.equal(signal.aborted, false); assert.equal(call.name, 'nodia_knowledge_index'); gatewayCalls++;
          return gateway.execute(claim, context, call);
        },
      }, context.signal).catch(error => { adapterFailure = safeError(error); throw error; });
      check('Real provider returns a completed terminal response with one hidden-nonce callback', reply.kind === 'answer' &&
        reply.terminalProof.outcome === 'completed' && gatewayCalls === 1);
      // The nonce-bearing diagnostic response is deliberately not sealed as a human chat message.
      return { status: 'completed', terminalProof: reply.terminalProof,
        persist: manager => release.execute(claim, reservation, reply.terminalProof, manager) };
    },
  };
  compiled = await Test.createTestingModule({ imports: [
    TypeOrmModule.forRootAsync({ useFactory: () => fixture.options, dataSourceFactory: async () => db }),
    Conversation, Processing, Runtime,
  ], providers: [RunStage] }).overrideProvider(Redis).useValue({
    get: async () => null, set: async () => {}, del: async () => {}, keys: async () => [],
  }).overrideProvider(NODIA_AI_STAGE_HANDLER).useValue(diagnosticHandler).setLogger(false).compile();
  processStage = compiled.get(ProcessStage); gateway = compiled.get(Tools); reserve = compiled.get(Reserve); release = compiled.get(Release);
  adapter = compiled.get(CodexAdapter); runtime = compiled.get(CodexRuntime); cleanup = compiled.get(Cleanup);
  reconcile = compiled.get(Reconcile); nativePort = compiled.get(NativePort);
  phase = 'real_binary_identity';
  const binary = await runtime.executable();
  const binaryInfo = await lstat(binary);
  assert.ok(binaryInfo.isFile() && !binaryInfo.isSymbolicLink());
  check('Installed real Codex executable matches the operator pin', sha(await readFile(binary)) === config.expected_binary_sha256);
  phase = 'live_account_and_catalog';
  initialObservation = await adapter.observe(selection, AbortSignal.timeout(30000));
  check('Actual account, model and effort are available without a readiness override', initialObservation.available === true &&
    initialObservation.adapterIdentity.providerKey === 'openai' && initialObservation.adapterIdentity.connectionId === selection.connection_id);
  check('No native attachment format is enabled by account discovery', initialObservation.verifiedModalities.length === 0 &&
    initialObservation.verifiedAttachmentMediaTypes.length === 0);
  phase = 'admission_and_context';
  const identity = fixture.identities.get('1');
  const chat = await compiled.get(Create).execute(identity, { client_request_id: randomUUID(), selection });
  const admission = await compiled.get(Admit).execute(identity, chat.conversation_id, {
    client_message_id: randomUUID(), expected_conversation_revision: chat.revision,
    parts: [{ kind: 'text', text: 'AI40 operator canary: read the published Nodia knowledge index once; do not change business data.' }],
  });
  runId = admission.run.run_id;
  const stop = AbortSignal.timeout(180000);
  assert.equal(await compiled.get(RunStage).execute(randomUUID(), stop), true);
  const [contextRun] = await db.query('SELECT state,phase FROM nodia_ai_runs WHERE id=$1', [runId]);
  check('Unmodified production context stage prepares the admitted run', contextRun.state === 'queued' && contextRun.phase === 'inference');
  phase = 'one_real_mcp_generation';
  assert.equal(await compiled.get(RunStage).execute(randomUUID(), stop), true);
  const [run] = await db.query('SELECT state,provider_dispatches_used,tool_calls_used,mcp_rpc_messages_used,assistant_message_id FROM nodia_ai_runs WHERE id=$1', [runId]);
  finalState = run.state;
  check('SQL completion accounts for exactly one native dispatch and one real gateway call', run.state === 'completed' &&
    run.provider_dispatches_used === 1 && run.tool_calls_used === 1 && run.mcp_rpc_messages_used >= 1 && providerDispatches === 1);
  const receipts = await db.query('SELECT id,tool_name,state FROM nodia_ai_tool_calls WHERE run_id=$1', [runId]);
  check('Real gateway commits one completed published technical tool receipt', receipts.length === 1 &&
    receipts[0].tool_name === 'nodia_knowledge_index' && receipts[0].state === 'completed');
  check('Diagnostic nonce response is not stored as a human assistant message', run.assistant_message_id === null);
  phase = 'sql_cleanup_and_exact_native_ack';
  const cleaned = await cleanup.execute();
  check('Production SQL cleanup acknowledges the exact completed native receipt', cleaned.processed === 1 && cleaned.settled === 1);
  phase = 'certify_scoped_mcp_acceptance';
  await adapter.acceptMcpProbe(reply.terminalProof, AbortSignal.timeout(30000));
  finalObservation = await adapter.observe(selection, AbortSignal.timeout(30000));
  check('Scoped real MCP acceptance is observed after the journal ACK', finalObservation.available === true &&
    finalObservation.supportsMcp === true && finalObservation.resourceKey === initialObservation.resourceKey &&
    finalObservation.sessionGeneration === initialObservation.sessionGeneration &&
    finalObservation.configurationGeneration === initialObservation.configurationGeneration);
  const [pending] = await db.query(`SELECT
    (SELECT count(*)::integer FROM nodia_ai_jobs WHERE state IN ('ready','leased','unknown','waiting')) jobs,
    (SELECT count(*)::integer FROM nodia_ai_runtime_slots WHERE state<>'free') slots,
    (SELECT count(*)::integer FROM nodia_ai_executions) business_executions`);
  check('No pending fixture jobs, retained slots or confirmed business effects remain', pending.jobs === 0 && pending.slots === 0 && pending.business_executions === 0);
  safeToDrop = true; phase = 'complete';
} catch (error) {
  failed = safeError(error);
} finally {
  if (!safeToDrop && fixture && runId) {
    try {
      // No retry of generation: close/reconcile only the exact armed attempt owned by this canary.
      if (nativeRequest && nativePort) await nativePort.reconcile(nativeRequest, AbortSignal.timeout(20000));
      const [job] = jobId ? await fixture.db.query('SELECT state FROM nodia_ai_jobs WHERE id=$1', [jobId]) : [];
      if (job?.state === 'unknown' && reconcile)
        await reconcile.execute(fixture.identities.get('3'), jobId);
      if (cleanup) await cleanup.execute();
      const [pending] = await fixture.db.query(`SELECT
        (SELECT count(*)::integer FROM nodia_ai_jobs WHERE state IN ('leased','unknown') OR kind='reconcile') jobs,
        (SELECT count(*)::integer FROM nodia_ai_runtime_slots WHERE state<>'free') slots`);
      safeToDrop = pending.jobs === 0 && pending.slots === 0;
      if (runId) {
        const [run] = await fixture.db.query('SELECT state FROM nodia_ai_runs WHERE id=$1', [runId]);
        finalState = run?.state ?? null;
      }
    } catch { safeToDrop = false; }
  } else if (fixture && !runId) safeToDrop = true;
  await compiled?.close().catch(() => { safeToDrop = false; });
  // If closure/SQL reconciliation cannot be proved, retain the disposable DB container for the operator.
  // Never remove or scan the real account profile, its journal, or the new scoped acceptance record.
  if (fixture && safeToDrop) await fixture.close().catch(() => { safeToDrop = false; });
  else if (fixture?.db.isInitialized) await fixture.db.destroy().catch(() => {});
  await delay(10);
}

console.log(JSON.stringify({
  schema: 'nodia-ai-ai40-real-canary-v1', status: failed || !safeToDrop ? 'failed' : 'passed', phase,
  started_at_utc: startedAt, finished_at_utc: new Date().toISOString(), error: failed, adapter_error: adapterFailure,
  checks: checks.length, passed: checks, selection,
  provider_dispatches_armed: providerDispatches, gateway_callbacks: gatewayCalls,
  operational_database_accessed: false, disposable_sql_real: true,
  readiness_overridden: false, executable_overridden: false, publication_overridden: false,
  live_account_observation_received: initialObservation !== null, credential_bytes_read_or_copied: false,
  initial_mcp_accepted: initialObservation?.supportsMcp ?? null,
  final_mcp_accepted: finalObservation?.supportsMcp ?? null,
  run_state: finalState, assistant_message_sealed: false,
  terminal_proof_id: reply?.terminalProof?.terminalProofId ?? null,
  response_sha256: reply?.kind === 'answer' ? sha(reply.text) : null,
  disposable_lifecycle: parentManaged ? 'root_operator_parent' : 'this_process',
  fixture_sql_safe_to_remove: !!fixture && safeToDrop,
  fixture_resources_removed: !!fixture && safeToDrop && !parentManaged,
  retained_disposable_container: fixture && !safeToDrop ? fixtureContainer : null,
  operational_profile_removed: false,
  limits: [
    'Exactly one explicitly authorized generation; failures are reconciled, never retried.',
    'Real account/native binary and PostgreSQL gateway with fixture actor/grant and mirrored public configuration.',
    'Operator-only inference handler reuses compiled production lease/progress methods; not UI or autonomous worker acceptance.',
    'No business write, payment, confirmation gesture or attachment modality is accepted by this canary.',
    'Scoped MCP acceptance persists only after the production journal ACK; operational SQL was not accessed.',
  ],
}, null, 2));
if (failed || !safeToDrop) process.exitCode = 1;
