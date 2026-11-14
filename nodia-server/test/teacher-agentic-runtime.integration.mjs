// Isolated PostgreSQL + compiled Teacher owner. Every identity and Native response is synthetic.
// No provider HTTP, profiles, configured database, credentials, VM operations or implicit builds.
// Run after an explicit coordinated Server build: node test/teacher-agentic-runtime.integration.mjs [--ddl-only]
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { access, readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, sep } from 'node:path';
import { DataSource } from 'typeorm';

process.env.DOTENV_CONFIG_PATH = process.platform === 'win32' ? 'NUL' : '/dev/null';
process.env.NODE_ENV = 'test';
process.env.RATE_LIMIT_STORAGE = 'memory';
process.env.AI_SECRET_MASTER_KEY = randomBytes(32).toString('hex');
const originalFetch = globalThis.fetch;
let forbiddenHttp = 0;
globalThis.fetch = async () => { forbiddenHttp++; throw Error('synthetic_agentic_harness_forbids_http'); };

const nonce = `${process.pid}_${randomBytes(6).toString('hex')}`;
const container = `template_teacher_agentic_${nonce}`;
const volume = `template_teacher_agentic_pg_${nonce}`;
const password = randomBytes(20).toString('hex');
const dist = process.env.TEACHER_SERVER_DIST ? pathToFileURL(resolve(process.env.TEACHER_SERVER_DIST) + sep) : new URL('../dist/', import.meta.url);
const compiled = path => new URL(path, dist);
const migrationUrl = compiled('migrations/1793600000000-TeacherAgenticTextOwnership.js');
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const checks = [];
let activeCheck = 'bootstrap';
let source, volumeCreated = false, containerCreated = false;
const docker = (...args) => {
  try { return execFileSync('docker', args, { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).trim(); }
  catch { throw Error('synthetic_disposable_docker_failed'); }
};
async function check(name, fn) { activeCheck = name; await fn(); checks.push(name); activeCheck = 'between_checks'; process.stdout.write(`${JSON.stringify({ check: name, pass: true })}\n`); }
async function sqlReject(operation, code, constraint) {
  await assert.rejects(operation, error => error?.code === code && (!constraint || error.constraint === constraint));
}

async function seedIdentity() {
  const actor = { userId: '9007199254740993', sessionId: randomUUID() };
  const other = { userId: '9007199254740994', sessionId: randomUUID() };
  for (const [index, identity] of [actor, other].entries()) {
    await source.query('INSERT INTO users(id,email,name) VALUES($1,$2,$3)', [identity.userId, `teacher-agentic-${index}@example.invalid`, 'Synthetic Agentic SQL actor']);
    await source.query("INSERT INTO auth_sessions(public_id,user_id,refresh_token_hash,expires_at) VALUES($1,$2,$3,clock_timestamp()+interval '1 hour')", [identity.sessionId, identity.userId, hash(identity.sessionId)]);
  }
  const [{ id: group }] = await source.query("INSERT INTO module_groups(key,sort_order) VALUES('synthetic_teacher_agentic',99) RETURNING id::text");
  const [{ id: moduleId }] = await source.query("INSERT INTO modules(module_group_id,key,link,sort_order) VALUES($1,'nodia_teacher','/nodia-teacher',0) RETURNING id::text", [group]);
  for (const identity of [actor, other]) await source.query('INSERT INTO user_modules(user_id,module_id,is_active) VALUES($1,$2,true)', [identity.userId, moduleId]);
  const [{ id: connectionId }] = await source.query("INSERT INTO ai_providers(catalog_id,name,use_agentic,fields) SELECT id,'Synthetic Teacher Native lane',true,$1::jsonb FROM ai_provider_catalog WHERE key='openai' RETURNING id::text", [JSON.stringify({ agentic: { selected_model: 'fixture-discovered-agentic-model', available_models: [{ id: 'fixture-discovered-agentic-model' }] } })]);
  assert(connectionId);
  return { actor, other, connectionId, moduleId, selection: { connection_id: connectionId, mode: 'agentic', model_id: 'fixture-discovered-agentic-model', effort_id: null } };
}

async function seedTeacherOperation(fixture) {
  const session = randomUUID(), job = randomUUID(), operation = randomUUID(), worker = randomUUID();
  const configuration = 'a'.repeat(64), generation = 'b'.repeat(32), resource = `codex-profile:${'c'.repeat(64)}`;
  await source.transaction(async manager => {
    await manager.query("INSERT INTO teacher_sessions(id,owner_user_id,topic,objective,explanation_language,created_by_actor_id,selection) VALUES($1,$2,'Synthetic DDL','Verify ownership','en',$2,$3::jsonb)", [session, fixture.actor.userId, JSON.stringify(fixture.selection)]);
    await manager.query(`INSERT INTO teacher_generation_jobs(id,session_id,actor_id,auth_session_public_id,purpose,semantic_key,input_snapshot,prompt_snapshot,template_ref,template_version,template_hash,input_hash,selection_snapshot,configuration_generation,session_generation,deadline_at,blocks_duplicate)
      VALUES($1,$2,$3,$4,'setup_reply',$5,'{}','Synthetic DDL only','synthetic/teacher','1',$5,$5,$6::jsonb,$7,$8,clock_timestamp()+interval '1 minute',false)`, [job, session, fixture.actor.userId, fixture.actor.sessionId, hash(job), JSON.stringify(fixture.selection), configuration, generation]);
    await manager.query("INSERT INTO teacher_generation_attempts(id,session_id,job_id,attempt_no,worker_id,fence,phase) VALUES($1,$2,$3,1,$4,1,'claimed')", [operation, session, job, worker]);
    await manager.query(`INSERT INTO ai_generation_operations(id,owner_kind,teacher_attempt_id,teacher_job_id,teacher_session_id,actor_id,auth_session_public_id,connection_id,selection_snapshot,configuration_generation,session_generation,resource_key,worker_id,owner_fence,runtime_fence,phase,request_hash,exchange_limit)
      VALUES($1,'teacher',$1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,1,1,'reserved',$12,1)`, [operation, job, session, fixture.actor.userId, fixture.actor.sessionId, fixture.connectionId, JSON.stringify(fixture.selection), configuration, generation, resource, worker, hash(operation)]);
  });
  const reference = { contract: 'teacher-agentic-text/1', operation_id: operation, session_id: session, job_id: job, attempt_id: operation, actor_id: fixture.actor.userId, connection_id: fixture.connectionId, model_id: fixture.selection.model_id, effort_id: null, resource_key: resource, configuration_generation: configuration, session_generation: generation, runtime_hash: 'd'.repeat(64), policy_hash: 'e'.repeat(64), request_hash: hash(operation) };
  return { session, job, operation, worker, reference, descriptor: { provider: 'openai', reference } };
}

async function seedChatOperation(fixture) {
  const conversation = randomUUID(), job = randomUUID(), operation = randomUUID(), worker = randomUUID();
  await source.transaction(async manager => {
    await manager.query("INSERT INTO nodia_ai_conversations(id,owner_id,client_request_id,title,creation_request_hash,expires_at) VALUES($1,$2,$3,'Synthetic foreign owner',$4,clock_timestamp()+interval '1 hour')", [conversation, fixture.actor.userId, randomUUID(), hash(conversation)]);
    await manager.query("INSERT INTO nodia_ai_jobs(id,kind,dedup_key,conversation_id,state,available_at,deadline_at,stage_key) VALUES($1,'reconcile',$2,$3,'unknown',clock_timestamp(),clock_timestamp()+interval '1 hour','context')", [job, `synthetic:${job}`, conversation]);
    await manager.query("INSERT INTO nodia_ai_job_attempts(id,job_id,attempt_no,fence,worker_id,phase,started_at,stage_key,stage_seq) VALUES($1,$2,1,1,$3,'claimed',clock_timestamp(),'context',1)", [operation, job, worker]);
    await manager.query(`INSERT INTO ai_generation_operations(id,owner_kind,chat_attempt_id,chat_job_id,chat_conversation_id,actor_id,auth_session_public_id,connection_id,selection_snapshot,configuration_generation,session_generation,resource_key,worker_id,owner_fence,runtime_fence,phase,request_hash,exchange_limit)
      VALUES($1,'chat',$1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,1,1,'reserved',$12,1)`, [operation, job, conversation, fixture.actor.userId, fixture.actor.sessionId, fixture.connectionId, JSON.stringify(fixture.selection), 'a'.repeat(64), 'b'.repeat(32), `codex-profile:${hash(operation)}`, worker, hash(operation)]);
  });
  return { conversation, job, operation };
}

async function ddlChecks(fixture) {
  const { TeacherAgenticTextOwnership1793600000000: Migration } = await import(migrationUrl.href);
  const migration = new Migration(), runner = source.createQueryRunner();
  await runner.connect();
  try {
    // Opaque pre-existing API qualification proves the additive Native migration preserves data.
    // This synthetic row is never presented to eligibility or treated as real qualification.
    const apiOwner = await seedTeacherOperation({ ...fixture, selection: { ...fixture.selection, mode: 'api_key' } });
    const apiScope = hash('synthetic-preexisting-api-qualification');
    await source.query("INSERT INTO ai_generation_qualifications(scope_hash,contract_version,operation_id,response_hash,evidence_hash) VALUES($1,'teacher-text/1',$2,$3,$4)", [apiScope, apiOwner.operation, '8'.repeat(64), '9'.repeat(64)]);
    await check('fresh migrations include179356 through179360 exactly once', async () => {
      const rows = await source.query('SELECT timestamp::text FROM migrations WHERE timestamp BETWEEN 1793560000000 AND 1793600000000 ORDER BY timestamp');
      assert.deepEqual(rows.map(row => row.timestamp), ['1793560000000', '1793570000000', '1793580000000', '1793590000000', '1793600000000']);
    });
    await check('Native additive DDL empty down/up preserves API table and old qualifications', async () => {
      const before = await source.query('SELECT * FROM ai_generation_qualifications ORDER BY scope_hash');
      assert.equal(before.length, 1);
      await migration.down(runner);
      assert.equal((await source.query("SELECT to_regclass('public.ai_generation_agentic_qualifications') AS name"))[0].name, null);
      await migration.up(runner);
      assert.deepEqual(await source.query('SELECT * FROM ai_generation_qualifications ORDER BY scope_hash'), before);
    });
    const teacher = await seedTeacherOperation(fixture), foreign = await seedTeacherOperation({ ...fixture, actor: fixture.other });
    const chat = await seedChatOperation(fixture);
    await check('Native descriptor valid exact owner accepted', async () => {
      await source.query('UPDATE ai_generation_operations SET agentic_transport_descriptor=$2::jsonb WHERE id=$1', [teacher.operation, JSON.stringify(teacher.descriptor)]);
    });
    for (const [field, wrong] of [['session_id', foreign.session], ['job_id', foreign.job], ['attempt_id', foreign.operation], ['operation_id', foreign.operation], ['actor_id', fixture.other.userId], ['connection_id', String(BigInt(fixture.connectionId) + 1n)], ['configuration_generation', 'f'.repeat(64)], ['session_generation', 'f'.repeat(32)], ['resource_key', `codex-profile:${'f'.repeat(64)}`], ['model_id', 'fixture-different-model'], ['effort_id', 'fixture-different-effort']]) {
      await check(`Native SQL rejects descriptor mismatch ${field}`, async () => {
        const descriptor = structuredClone(teacher.descriptor); descriptor.reference[field] = wrong;
        await sqlReject(() => source.query('UPDATE ai_generation_operations SET agentic_transport_descriptor=$2::jsonb WHERE id=$1', [teacher.operation, JSON.stringify(descriptor)]), '23514', 'ck_teacher_agentic_descriptor');
      });
    }
    await check('Native SQL requires effort presence while preserving an explicit real null', async () => {
      const missing = structuredClone(teacher.descriptor); delete missing.reference.effort_id;
      await sqlReject(() => source.query('UPDATE ai_generation_operations SET agentic_transport_descriptor=$2::jsonb WHERE id=$1', [teacher.operation, JSON.stringify(missing)]), '23514', 'ck_teacher_agentic_descriptor');
      await source.query('UPDATE ai_generation_operations SET agentic_transport_descriptor=$2::jsonb WHERE id=$1', [teacher.operation, JSON.stringify(teacher.descriptor)]);
    });
    for (const field of ['operation_id', 'session_id', 'actor_id', 'configuration_generation']) {
      await check(`Native SQL rejects missing and JSON null ${field}`, async () => {
        const missing = structuredClone(teacher.descriptor); delete missing.reference[field];
        const empty = structuredClone(teacher.descriptor); empty.reference[field] = null;
        for (const descriptor of [missing, empty]) await sqlReject(() => source.query('UPDATE ai_generation_operations SET agentic_transport_descriptor=$2::jsonb WHERE id=$1', [teacher.operation, JSON.stringify(descriptor)]), '23514', 'ck_teacher_agentic_descriptor');
      });
    }
    await check('Native descriptor cannot attach to a real chat operation', async () => {
      await sqlReject(() => source.query('UPDATE ai_generation_operations SET agentic_transport_descriptor=$2::jsonb WHERE id=$1', [chat.operation, JSON.stringify({ ...teacher.descriptor, reference: { ...teacher.reference, operation_id: chat.operation } })]), '23514', 'ck_teacher_agentic_descriptor');
    });
    const qualify = (operation, owner = 'teacher') => source.query(`INSERT INTO ai_generation_agentic_qualifications(scope_hash,contract_version,owner_kind,operation_id,provider_key,selection_hash,selection_snapshot,configuration_generation,observation_snapshot,response_hash,evidence_hash)
      VALUES($1,'teacher-agentic-text/1',$2,$3,'openai',$4,$5::jsonb,$6,'{}',$7,$8)`, [hash(randomUUID()), owner, operation, hash(fixture.selection), JSON.stringify(fixture.selection), 'a'.repeat(64), 'b'.repeat(64), 'c'.repeat(64)]);
    await check('Native qualification composite FK rejects chat and missing operation owners', async () => {
      await sqlReject(() => qualify(chat.operation), '23503');
      await sqlReject(() => qualify(randomUUID()), '23503');
      await sqlReject(() => qualify(teacher.operation, 'chat'), '23514');
      assert.equal((await source.query('SELECT count(*)::integer AS n FROM ai_generation_agentic_qualifications'))[0].n, 0);
    });
    await check('Native down refuses descriptor before any DDL mutation', async () => {
      await assert.rejects(() => migration.down(runner), /teacher_agentic_rollback_requires_reconciliation/);
      assert.equal((await source.query('SELECT agentic_transport_descriptor FROM ai_generation_operations WHERE id=$1', [teacher.operation]))[0].agentic_transport_descriptor.reference.operation_id, teacher.operation);
    });
    await source.query('UPDATE ai_generation_operations SET agentic_transport_descriptor=NULL WHERE id=$1', [teacher.operation]);
    await check('Native down refuses even qualification-only rows', async () => {
      await qualify(teacher.operation);
      await assert.rejects(() => migration.down(runner), /teacher_agentic_rollback_requires_reconciliation/);
      assert.equal((await source.query('SELECT count(*)::integer AS n FROM ai_generation_agentic_qualifications'))[0].n, 1);
    });
    await source.transaction(async manager => {
      await manager.query('DELETE FROM ai_generation_agentic_qualifications');
      await manager.query('DELETE FROM ai_generation_qualifications WHERE scope_hash=$1', [apiScope]);
      for (const item of [teacher, foreign, chat, apiOwner]) await manager.query('DELETE FROM ai_generation_operations WHERE id=$1', [item.operation]);
      for (const item of [teacher, foreign, apiOwner]) {
        await manager.query('DELETE FROM teacher_generation_attempts WHERE id=$1', [item.operation]);
        await manager.query('DELETE FROM teacher_generation_jobs WHERE id=$1', [item.job]);
        await manager.query('DELETE FROM teacher_sessions WHERE id=$1', [item.session]);
      }
      await manager.query('DELETE FROM nodia_ai_job_attempts WHERE id=$1', [chat.operation]);
      await manager.query('DELETE FROM nodia_ai_jobs WHERE id=$1', [chat.job]);
      await manager.query('DELETE FROM nodia_ai_conversations WHERE id=$1', [chat.conversation]);
    });
  } finally { await runner.release(); }
}

async function runtimeChecks(fixture) {
  const load = async (path, name) => (await import(compiled(`${path}.js`).href))[name];
  const [Runtime, Native, Credentials, Connections, Registry, Access, Validate, Store, Commands, Read, Publisher] = await Promise.all([
    load('ai-generation/teacher-generation-runtime.service', 'TeacherGenerationRuntimeService'),
    load('ai-generation/teacher-agentic-text.service', 'TeacherAgenticTextService'),
    load('nodia-ai-adapter/api-nodia-ai-credentials.service', 'ApiNodiaAiCredentialsService'),
    load('nodia-ai-conversation/nodia-ai-connections.service', 'NodiaAiConnectionsService'),
    load('ai-generation/worker-source-registry', 'GenerationWorkerSourceRegistry'),
    load('authorization/use-case/check-module-access.use-case', 'CheckModuleAccessUseCase'),
    load('nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case', 'ValidateNodiaAiRuntimePolicyUseCase'),
    load('teacher/teacher.service', 'TeacherService'),
    load('teacher/use-case/execute-teacher-command.use-case', 'ExecuteTeacherCommandUseCase'),
    load('teacher/use-case/read-teacher.use-case', 'ReadTeacherUseCase'),
    load('teacher/use-case/publish-teacher.use-case', 'PublishTeacherUseCase'),
  ]);
  const { agenticTextHash, teacherAgenticReference } = await import(compiled('ai-generation/agentic-text-contract.js').href);
  const { API_EXECUTOR_OWNER, isApiExecutorProvenClosed } = await import(compiled('nodia-ai-adapter/api-nodia-ai-runtime-owner.js').href);
  const policy = new Validate().execute(JSON.parse(await readFile(new URL('../src/nodia-ai-runtime/config/runtime-policy.json', import.meta.url), 'utf8')));
  const observation = { contract: 'teacher-agentic-text/1', available: true, reason: null, observed_at: new Date().toISOString(), resource_key: `codex-profile:${'1'.repeat(64)}`, session_generation: '2'.repeat(32), runtime_hash: '3'.repeat(64), binary_sha512: '4'.repeat(128), policy_hash: '5'.repeat(64), tool_policy: 'none', native_io: false };
  const counters = { starts: 0, observations: 0, reconciles: 0, acknowledgements: 0, acknowledgedOperations: 0, api: 0, alternate: 0 };
  const nativeOperations = new Map();
  let nextMode = 'complete', failAcks = 0, observationHook = null;
  function response(entry, mode = entry.mode) {
    const { reference, text, proofId } = entry;
    if (mode === 'unclosed') return { contract: observation.contract, operation_id: reference.operation_id, state: 'unknown', text: null, terminal_proof: null };
    const completed = mode === 'complete';
    const proof = { ...reference, terminal_proof_id: proofId, process_closed: true, remote_outcome: completed || mode === 'counterproof' ? 'completed' : 'unknown', response_hash: completed || mode === 'counterproof' ? agenticTextHash(text) : null, observed_at: entry.observedAt };
    if (mode === 'counterproof') proof.session_id = randomUUID();
    return { contract: observation.contract, operation_id: reference.operation_id, state: completed || mode === 'counterproof' ? 'completed' : 'unknown', text: completed || mode === 'counterproof' ? text : null, terminal_proof: proof };
  }
  const nativePort = {
    observe: async () => {
      counters.observations++;
      const hook = observationHook; observationHook = null;
      if (hook) await hook();
      return { ...observation, observed_at: new Date().toISOString() };
    },
    start: async command => {
      counters.starts++;
      // Assert SQL counters/identity before the simulated provider boundary, not after it.
      const [row] = await source.query('SELECT o.started_exchanges,o.reserved_exchanges,o.agentic_transport_descriptor,j.dispatches_used,j.purpose,j.input_snapshot FROM ai_generation_operations o JOIN teacher_generation_jobs j ON j.id=o.teacher_job_id WHERE o.id=$1', [command.operation_id]);
      assert.equal(row.started_exchanges, 1); assert.equal(row.reserved_exchanges, 1); assert.equal(row.dispatches_used, 1);
      assert.deepEqual(row.agentic_transport_descriptor.reference, teacherAgenticReference(command));
      const nonceText = row.input_snapshot.qualification_probe?.nonce ?? command.prompt.match(/return exactly ([0-9a-f-]{36}) as text/u)?.[1];
      const text = JSON.stringify(row.purpose === 'plan_outline' ? {
        schema_version: 1,
        outline: { schema_version: 1, title: 'First synthetic plan without qualification', topic: row.input_snapshot.session.topic,
          objective: row.input_snapshot.session.objective, explanation_language: 'en', organization: 'topics', day_count: null,
          sections: [{ id: 's1', title: 'Synthetic section', required: true, prerequisite_section_ids: [],
            objectives: [{ id: 'o1', description: 'Understand the isolated fixture rule' }],
            units: [{ id: 'u1', title: 'Synthetic unit', objective_ids: ['o1'], day_start: null, day_end: null }] }],
          assessment_policy: row.input_snapshot.policy },
        guide: { schema_version: 1, strategy: 'balanced', context_notes: '', examples_context: '', prerequisite_knowledge: [], preferred_formats: ['single_choice', 'completion', 'short_text'] },
      } : { schema_version: 1, text: nonceText ?? 'Synthetic native explanation', brief: { topic: 'Text transport verification', objective: 'Verify a structured reply' }, questions: [], organization_options: ['days', 'topics'] });
      const entry = { reference: teacherAgenticReference(command), text, proofId: randomUUID(), observedAt: new Date().toISOString(), mode: nextMode };
      nativeOperations.set(command.operation_id, entry);
      return response(entry);
    },
    status: async reference => response(nativeOperations.get(reference.operation_id)),
    reconcile: async reference => { counters.reconciles++; return response(nativeOperations.get(reference.operation_id)); },
    acknowledge: async (reference, proof) => {
      counters.acknowledgements++;
      const entry = nativeOperations.get(reference.operation_id);
      assert.deepEqual(reference, entry.reference);
      assert.deepEqual(proof, response(entry).terminal_proof);
      const [durable] = await source.query('SELECT phase,acknowledged_at FROM ai_generation_operations WHERE id=$1', [reference.operation_id]);
      assert.equal(durable.phase, 'closed'); assert(durable.acknowledged_at, 'external ACK follows the durable SQL closure commit');
      assert.equal((await source.query('SELECT count(*)::integer AS n FROM nodia_ai_runtime_slots WHERE generation_operation_id=$1', [reference.operation_id]))[0].n, 0);
      if (entry.acceptedAck) assert.deepEqual(proof, entry.acceptedAck);
      else { entry.acceptedAck = structuredClone(proof); counters.acknowledgedOperations++; }
      if (failAcks > 0) { failAcks--; throw Error('synthetic_ack_response_lost'); }
    },
  };
  const neverAlternate = new Proxy({}, { get: () => async () => { counters.alternate++; throw Error('alternate_provider_forbidden'); } });
  const agentic = new Native(source, neverAlternate, nativePort), accessPolicy = new Access(source);
  const router = { measure: prompt => agentic.measure(prompt), execute: (context, signal) => { if (context.selection.mode !== 'agentic') { counters.api++; throw Error('api_lane_forbidden'); } return agentic.execute(context, signal); } };
  const construct = () => {
    const runtime = new Runtime(source, accessPolicy, new Credentials(source), new Connections(source), new Registry(), router, policy, agentic);
    runtime.onModuleInit();
    const publisher = new Publisher(); runtime.setPublisher(publisher.publish.bind(publisher));
    const store = new Store(source, accessPolicy);
    return { runtime, commands: new Commands(store, runtime), read: new Read(store, runtime) };
  };
  let { runtime, commands, read } = construct();
  const create = async topic => commands.execute(fixture.actor, null, randomUUID(), 'create', { topic, objective: 'Verify exact synthetic Native ownership', explanation_language: 'en', organization: 'topics', day_count: null });
  const qualifyDraft = await create('Dedicated synthetic Native qualification');
  // Operator fixture setup only: no key/configuration is mistaken for qualification.
  await source.query('UPDATE teacher_sessions SET selection=$2::jsonb WHERE id=$1', [qualifyDraft.session_id, JSON.stringify(fixture.selection)]);
  await check('Native availability is observed without requiring a prior Teacher canary', async () => {
    const result = await runtime.eligibility(fixture.actor, fixture.connectionId, fixture.selection);
    assert.equal(result.eligible, true); assert.equal(result.reason_code, 'runtime_available');
    const configured = await source.transaction(manager => runtime.verifySelection(manager, fixture.actor, fixture.selection));
    assert.equal(configured.session_generation, null);
    assert.equal((await source.query('SELECT count(*)::integer AS n FROM ai_generation_agentic_qualifications'))[0].n, 0);
    assert.equal(counters.starts, 0);
  });
  await check('First create-plan without any qualification uses one exact dispatch across worker instances', async () => {
    const key = randomUUID();
    const body = { topic: 'First selected AI plan', objective: 'Generate directly without a canary', explanation_language: 'en', organization: 'topics', day_count: null, selection: fixture.selection, start_plan: true };
    const first = await commands.execute(fixture.actor, null, key, 'create', body);
    const repeated = await commands.execute(fixture.actor, null, key, 'create', body);
    assert.deepEqual(repeated, first);
    assert.equal((await source.query('SELECT session_generation FROM teacher_generation_jobs WHERE id=$1', [first.job_id]))[0].session_generation, null);
    for (const table of ['ai_generation_qualifications', 'ai_generation_agentic_qualifications', 'teacher_purpose_qualifications'])
      assert.equal((await source.query(`SELECT count(*)::integer AS n FROM ${table}`))[0].n, 0);
    const starts = counters.starts;
    const otherWorker = construct().runtime;
    const claimed = await Promise.all([runtime.execute(randomUUID(), new AbortController().signal), otherWorker.execute(randomUUID(), new AbortController().signal)]);
    assert.equal(claimed.filter(Boolean).length, 1);
    assert.equal(counters.starts, starts + 1);
    const view = await read.job(fixture.actor, first.job_id);
    assert.equal(view.state, 'ready');
    const [durable] = await source.query('SELECT j.session_generation,o.started_exchanges,o.reserved_exchanges,o.acknowledged_at,o.agentic_acknowledged_at FROM teacher_generation_jobs j JOIN ai_generation_operations o ON o.teacher_job_id=j.id WHERE j.id=$1', [first.job_id]);
    assert.equal(durable.session_generation, observation.session_generation);
    assert.equal(durable.started_exchanges, 1); assert.equal(durable.reserved_exchanges, 1);
    assert(durable.acknowledged_at); assert(durable.agentic_acknowledged_at);
    const [session] = await source.query('SELECT current_plan_revision_id FROM teacher_sessions WHERE id=$1', [first.session_id]);
    assert.equal(session.current_plan_revision_id, null);
    assert.equal((await source.query('SELECT count(*)::integer AS n FROM teacher_plan_revisions WHERE session_id=$1', [first.session_id]))[0].n, 1);
    for (const table of ['ai_generation_qualifications', 'ai_generation_agentic_qualifications', 'teacher_purpose_qualifications'])
      assert.equal((await source.query(`SELECT count(*)::integer AS n FROM ${table}`))[0].n, 0);
  });
  await check('A configuration change during Native observation fails before reservation or dispatch', async () => {
    const job = await enqueue('Configuration changed before claim'); const starts = counters.starts;
    observationHook = async () => { await source.query('UPDATE ai_providers SET updated_at=clock_timestamp() WHERE id=$1', [fixture.connectionId]); };
    assert.equal(await runtime.execute(randomUUID(), new AbortController().signal), false);
    const view = await read.job(fixture.actor, job.job_id);
    assert.equal(view.state, 'failed_known'); assert.equal(view.error_code, 'configuration_changed');
    assert.equal((await source.query('SELECT count(*)::integer AS n FROM ai_generation_operations WHERE teacher_job_id=$1', [job.job_id]))[0].n, 0);
    assert.equal(counters.starts, starts);
  });
  await check('Revoking Teacher during Native observation cannot reserve or dispatch a job', async () => {
    const job = await enqueue('Authority revoked before claim'); const starts = counters.starts;
    observationHook = async () => { await source.query('UPDATE user_modules SET is_active=false WHERE user_id=$1 AND module_id=$2', [fixture.actor.userId, fixture.moduleId]); };
    try { assert.equal(await runtime.execute(randomUUID(), new AbortController().signal), false); }
    finally { await source.query('UPDATE user_modules SET is_active=true WHERE user_id=$1 AND module_id=$2', [fixture.actor.userId, fixture.moduleId]); }
    const view = await read.job(fixture.actor, job.job_id);
    assert.equal(view.state, 'failed_known'); assert.equal(view.error_code, 'authority_changed');
    assert.equal((await source.query('SELECT count(*)::integer AS n FROM ai_generation_operations WHERE teacher_job_id=$1', [job.job_id]))[0].n, 0);
    assert.equal(counters.starts, starts);
  });
  await check('A replaced queued configuration cannot reuse this worker observation with the same fence', async () => {
    const job = await enqueue('Queued intention replaced before claim'); const starts = counters.starts;
    const [before] = await source.query('SELECT configuration_generation FROM teacher_generation_jobs WHERE id=$1', [job.job_id]);
    observationHook = async () => { await source.query('UPDATE teacher_generation_jobs SET configuration_generation=$2 WHERE id=$1', [job.job_id, 'f'.repeat(64)]); };
    assert.equal(await runtime.execute(randomUUID(), new AbortController().signal), false);
    assert.equal((await read.job(fixture.actor, job.job_id)).state, 'queued');
    assert.equal(counters.starts, starts);
    assert.equal((await source.query('SELECT count(*)::integer AS n FROM ai_generation_operations WHERE teacher_job_id=$1', [job.job_id]))[0].n, 0);
    await source.query('UPDATE teacher_generation_jobs SET configuration_generation=$2 WHERE id=$1', [job.job_id, before.configuration_generation]);
    const observations = counters.observations;
    assert.equal(await runtime.execute(randomUUID(), new AbortController().signal), true);
    assert(counters.observations > observations, 'a fresh worker observation is required after an obsolete read');
    assert.equal(counters.starts, starts + 1);
    assert.equal((await read.job(fixture.actor, job.job_id)).state, 'ready');
  });
  await check('Optional Native diagnostic still records one exact Teacher job without API or chat acceptance', async () => {
    const starts = counters.starts;
    const proof = await runtime.qualifyText(fixture.actor, qualifyDraft.session_id, fixture.selection, new AbortController().signal);
    assert.equal(proof.local_closed, true); assert.equal(proof.remote_outcome, 'completed'); assert.equal(counters.starts, starts + 1);
    const [qualified] = await source.query('SELECT q.owner_kind,o.owner_kind AS operation_owner,o.agentic_acknowledged_at FROM ai_generation_agentic_qualifications q JOIN ai_generation_operations o ON o.id=q.operation_id');
    assert.equal(qualified.owner_kind, 'teacher'); assert.equal(qualified.operation_owner, 'teacher'); assert(qualified.agentic_acknowledged_at);
    assert.equal((await source.query('SELECT count(*)::integer AS n FROM ai_generation_qualifications'))[0].n, 0);
    assert.equal((await runtime.eligibility(fixture.actor, fixture.connectionId, fixture.selection)).eligible, true);
  });
  async function enqueue(topic) {
    const draft = await create(topic);
    await commands.execute(fixture.actor, draft.session_id, randomUUID(), 'patch', { expected_session_revision: 1, selection: fixture.selection });
    const job = await commands.execute(fixture.actor, draft.session_id, randomUUID(), 'message', { expected_session_revision: 2, text: 'Synthetic integration intent', generate_reply: true });
    return { ...job, session_id: draft.session_id };
  }
  const operation = async job => (await source.query('SELECT * FROM ai_generation_operations WHERE teacher_job_id=$1', [job.job_id]))[0];
  const expire = async job => { await source.query("UPDATE teacher_generation_jobs SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1", [job.job_id]); await source.query("UPDATE nodia_ai_runtime_slots SET lease_until=clock_timestamp()-interval '1 second' WHERE generation_operation_id=(SELECT id FROM ai_generation_operations WHERE teacher_job_id=$1)", [job.job_id]); };
  const blocked = await enqueue('Native unclosed counterproof');
  nextMode = 'counterproof';
  await runtime.execute(randomUUID(), new AbortController().signal);
  const blockedOp = await operation(blocked);
  await check('Counterproof never closes Native and retains duplicate exclusion and canonical slot', async () => {
    const view = await read.job(fixture.actor, blocked.job_id);
    assert.equal(view.state, 'unknown'); assert.equal(view.local_closed, false);
    const [job] = await source.query('SELECT blocks_duplicate FROM teacher_generation_jobs WHERE id=$1', [blocked.job_id]); assert.equal(job.blocks_duplicate, true);
    const [slot] = await source.query('SELECT state,generation_operation_id FROM nodia_ai_runtime_slots WHERE resource_key=$1', [blockedOp.resource_key]); assert.notEqual(slot.state, 'free'); assert.equal(slot.generation_operation_id, blockedOp.id);
    const waiting = await enqueue('Distinct intent while Native closure is unproven');
    const starts = counters.starts; assert.equal(await runtime.execute(randomUUID(), new AbortController().signal), false); assert.equal(counters.starts, starts);
    assert.equal((await read.job(fixture.actor, waiting.job_id)).state, 'queued');
    await source.query("UPDATE teacher_generation_jobs SET deadline_at=clock_timestamp()-interval '1 second' WHERE id=$1", [waiting.job_id]);
  });
  await check('A dead API owner never releases the armed Native process', async () => {
    const deadApiOwner = { ...API_EXECUTOR_OWNER, pid: 2147483647, birth: '1' };
    assert.equal(isApiExecutorProvenClosed(deadApiOwner), true, 'this would be sufficient for API, but never Native');
    await source.query('UPDATE ai_generation_operations SET api_owner_identity=$2::jsonb WHERE id=$1', [blockedOp.id, JSON.stringify(deadApiOwner)]);
    await expire(blocked); await runtime.recover();
    const op = await operation(blocked); assert.equal(op.acknowledged_at, null); assert.equal(op.agentic_acknowledged_at, null);
    assert.equal((await read.job(fixture.actor, blocked.job_id)).local_closed, false);
    assert.equal((await source.query('SELECT generation_operation_id FROM nodia_ai_runtime_slots WHERE resource_key=$1', [op.resource_key]))[0].generation_operation_id, op.id);
  });
  await check('Exact Native closure releases ownership without changing unknown to completed', async () => {
    nativeOperations.get(blockedOp.id).mode = 'closed_unknown';
    await runtime.recover();
    const view = await read.job(fixture.actor, blocked.job_id); assert.equal(view.state, 'unknown'); assert.equal(view.remote_outcome, 'unknown'); assert.equal(view.local_closed, true);
    const op = await operation(blocked); assert(op.agentic_acknowledged_at); assert(op.acknowledged_at);
    assert.equal((await source.query('SELECT state FROM nodia_ai_runtime_slots WHERE resource_key=$1', [op.resource_key]))[0].state, 'free');
  });
  nextMode = 'complete'; failAcks = 1;
  const ackLost = await enqueue('Recover an exact external ACK');
  await check('Native ACK response loss is recovered with exact proof and never repeats start', async () => {
    const starts = counters.starts, acks = counters.acknowledgements, accepted = counters.acknowledgedOperations;
    try { await runtime.execute(randomUUID(), new AbortController().signal); } catch (error) { assert.match(error.message, /synthetic_ack_response_lost/); }
    const sql = await operation(ackLost); assert(sql.acknowledged_at); assert.equal(sql.agentic_acknowledged_at, null);
    assert.equal((await read.job(fixture.actor, ackLost.job_id)).state, 'ready');
    const waiting = await enqueue('Distinct intent while external Native ACK is pending');
    assert.equal(await runtime.execute(randomUUID(), new AbortController().signal), false);
    assert.equal(counters.starts, starts + 1);
    assert.equal((await read.job(fixture.actor, waiting.job_id)).state, 'queued');
    await source.query("UPDATE teacher_generation_jobs SET deadline_at=clock_timestamp()-interval '1 second' WHERE id=$1", [waiting.job_id]);
    ({ runtime, commands, read } = construct());
    await runtime.recover(); await runtime.recover();
    assert((await operation(ackLost)).agentic_acknowledged_at); assert.equal(counters.starts, starts + 1);
    assert.equal(counters.acknowledgements, acks + 2); assert.equal(counters.acknowledgedOperations, accepted + 1);
  });
  const lost = await enqueue('Parent loss after Native response before SQL closure');
  await check('Lost SQL closure and a new parent preserve unknown and never replay Native', async () => {
    const originalTransaction = source.transaction.bind(source), starts = counters.starts;
    let faulted = false;
    source.transaction = (...args) => originalTransaction(...args.slice(0, -1), async manager => {
      const actual = manager.query.bind(manager);
      manager.query = async (sql, ...parameters) => { if (!faulted && /UPDATE ai_generation_operations SET phase='closed'/u.test(sql)) { faulted = true; throw Error('synthetic_parent_sql_loss'); } return actual(sql, ...parameters); };
      return args.at(-1)(manager);
    });
    try { await assert.rejects(() => runtime.execute(randomUUID(), new AbortController().signal), /synthetic_parent_sql_loss/); } finally { source.transaction = originalTransaction; }
    assert.equal(faulted, true);
    ({ runtime, commands, read } = construct());
    await expire(lost); await runtime.recover(); await runtime.recover(); await runtime.execute(randomUUID(), new AbortController().signal);
    const view = await read.job(fixture.actor, lost.job_id); assert.equal(view.state, 'unknown'); assert.equal(view.remote_outcome, 'completed'); assert.equal(view.local_closed, true);
    assert.equal(view.result_ref, null);
    assert.equal(counters.starts, starts + 1);
  });
  await check('Original Native qualification finalizes after lost ACK and qualification SQL without a new start', async () => {
    const draft = await create('Recover the original bounded Native qualification');
    await source.query('UPDATE teacher_sessions SET selection=$2::jsonb WHERE id=$1', [draft.session_id, JSON.stringify(fixture.selection)]);
    const starts = counters.starts;
    nextMode = 'complete'; failAcks = 2; // Both the run ACK and immediate finalize ACK have lost responses.
    await assert.rejects(() => runtime.qualifyText(fixture.actor, draft.session_id, fixture.selection, new AbortController().signal), /qualification_failed|synthetic_ack_response_lost/);
    const [job] = await source.query('SELECT id FROM teacher_generation_jobs WHERE session_id=$1', [draft.session_id]);
    assert(job);
    const [op] = await source.query('SELECT id,acknowledged_at,agentic_acknowledged_at FROM ai_generation_operations WHERE teacher_job_id=$1', [job.id]);
    assert(op.acknowledged_at); assert.equal(op.agentic_acknowledged_at, null);
    assert.equal(counters.starts, starts + 1);
    ({ runtime, commands, read } = construct());
    const originalTransaction = source.transaction.bind(source);
    let faulted = false;
    source.transaction = (...args) => originalTransaction(...args.slice(0, -1), async manager => {
      const actual = manager.query.bind(manager);
      manager.query = async (sql, ...parameters) => { if (!faulted && /INSERT INTO ai_generation_agentic_qualifications/u.test(sql)) { faulted = true; throw Error('synthetic_qualification_sql_loss'); } return actual(sql, ...parameters); };
      return args.at(-1)(manager);
    });
    try { await assert.rejects(() => runtime.completeTextQualification(fixture.actor, draft.session_id, job.id, new AbortController().signal), /synthetic_qualification_sql_loss/); }
    finally { source.transaction = originalTransaction; }
    assert.equal(faulted, true);
    assert((await source.query('SELECT agentic_acknowledged_at FROM ai_generation_operations WHERE id=$1', [op.id]))[0].agentic_acknowledged_at);
    assert.notEqual((await source.query('SELECT operation_id FROM ai_generation_agentic_qualifications'))[0].operation_id, op.id);
    ({ runtime, commands, read } = construct());
    const completed = await runtime.completeTextQualification(fixture.actor, draft.session_id, job.id, new AbortController().signal);
    assert.equal(completed.job_id, job.id); assert.equal(completed.operation_id, op.id);
    assert.equal((await source.query('SELECT operation_id FROM ai_generation_agentic_qualifications'))[0].operation_id, op.id);
    const observations = counters.observations;
    await assert.rejects(() => runtime.completeTextQualification(fixture.actor, ackLost.session_id, ackLost.job_id, new AbortController().signal), /qualification_session_required/);
    assert.equal(counters.observations, observations, 'arbitrary setup never reaches Native observation');
    assert.equal(counters.starts, starts + 1);
  });
  await check('Native integration uses zero API, alternate providers or phantom chat owners', async () => {
    assert.equal(counters.api, 0); assert.equal(counters.alternate, 0); assert.equal(forbiddenHttp, 0);
    assert.equal((await source.query('SELECT count(*)::integer AS n FROM nodia_ai_conversations'))[0].n, 0);
    assert.equal((await source.query("SELECT count(*)::integer AS n FROM nodia_ai_runtime_slots WHERE state<>'free' OR generation_operation_id IS NOT NULL"))[0].n, 0);
  });
}

try {
  await access(migrationUrl); // Fail before creating Docker state if the coordinated build is missing.
  volumeCreated = true;
  docker('volume', 'create', '--label', 'nodia.teacher.disposable=agentic-integration', volume);
  containerCreated = true; // Cleanup also covers a lost Docker CLI response after creation.
  docker('run', '-d', '--rm', '--pull', 'never', '--name', container, '--label', 'nodia.teacher.disposable=agentic-integration', '--memory', '512m', '--cpus', '1', '--mount', `type=volume,src=${volume},dst=/var/lib/postgresql/data`, '-e', 'POSTGRES_USER=teacher', '-e', `POSTGRES_PASSWORD=${password}`, '-e', 'POSTGRES_DB=teacher', '-p', '127.0.0.1::5432', 'postgres:16-alpine', '-c', 'max_connections=20', '-c', 'shared_buffers=32MB');
  containerCreated = true;
  for (let n = 0; n < 100; n++) {
    try { docker('exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'teacher'); break; }
    catch { if (n === 99) throw Error('disposable_postgres_unavailable'); await delay(200); }
  }
  source = new DataSource({ type: 'postgres', host: '127.0.0.1', port: Number(docker('port', container, '5432/tcp').split(':').at(-1)), username: 'teacher', password, database: 'teacher', synchronize: false, migrations: [fileURLToPath(compiled('migrations/*.js'))], extra: { max: 4 } });
  await source.initialize();
  await source.runMigrations({ transaction: 'all' });
  const fixture = await seedIdentity();
  await ddlChecks(fixture);
  if (!process.argv.includes('--ddl-only')) await runtimeChecks(fixture);
  assert.equal(forbiddenHttp, 0, 'no provider HTTP, including failed attempts');
  process.stdout.write(`${JSON.stringify({ status: 'passed', checks: checks.length, names: checks, ddl_only: process.argv.includes('--ddl-only'), provider_http_attempts: forbiddenHttp, configured_database_touched: false, native_transport: 'synthetic-counterproof-only', explicit_named_volume: true })}\n`);
} catch (error) {
  const sqlShape = typeof error.query === 'string' ? error.query.replace(/'(?:''|[^'])*'/gu, '<literal>').replace(/\s+/gu, ' ').slice(0, 500) : null;
  const sqlTypeError = typeof error.message === 'string' ? error.message.match(/inconsistent types deduced for parameter \$\d+/u)?.[0] ?? null : null;
  process.stderr.write(`${JSON.stringify({ status: 'failed', passed_checks: checks.length, failed_check: activeCheck, next_check: error instanceof assert.AssertionError ? 'assertion_failed' : /^[a-z_]+$/.test(error.message) ? error.message : 'compiled_contract_or_sql_error', domain_code: /^(?:teacher|auth|core):[a-z_]{1,100}$/.test(error.message) ? error.message : null, sql_code: /^[0-9A-Z]{5}$/.test(error?.code ?? '') ? error.code : null, sql_constraint: /^[a-zA-Z0-9_]+$/.test(error?.constraint ?? '') ? error.constraint : null, sql_shape: sqlShape, sql_position: /^\d+$/.test(error.position ?? '') ? error.position : null, sql_type_error: sqlTypeError, compiled_frame: error.stack?.match(/teacher-generation-runtime\.service\.js:\d+:\d+/u)?.[0] ?? null })}\n`);
  process.exitCode = 1;
} finally {
  globalThis.fetch = originalFetch;
  const cleanupErrors = [];
  try { if (source?.isInitialized) await source.destroy(); } catch { cleanupErrors.push('source_close_failed'); }
  if (containerCreated) {
    let present = false;
    try { docker('container', 'inspect', container, '--format', '{{.Id}}'); present = true; } catch { /* Never created, or --rm already removed it. */ }
    if (present) try { docker('rm', '-f', container); } catch { cleanupErrors.push('owned_container_cleanup_failed'); }
  }
  if (volumeCreated) {
    let present = false;
    try { docker('volume', 'inspect', volume, '--format', '{{.Name}}'); present = true; } catch { /* Creation never committed. */ }
    if (present) try { docker('volume', 'rm', volume); } catch { cleanupErrors.push('owned_named_volume_cleanup_failed'); }
  }
  if (cleanupErrors.length) process.exitCode = 1;
  process.stdout.write(`${JSON.stringify({ cleanup: cleanupErrors.length ? 'failed' : 'owned_container_and_named_volume_removed', errors: cleanupErrors, container, volume })}\n`);
}
