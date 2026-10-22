// Disposable PostgreSQL only. No configured database, provider, prompt or object storage.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Test } from '@nestjs/testing';
import { createNodiaAiIntegrationFixture, loadAi } from './nodia-ai.integration.fixture.mjs';
import { createNodiaAiUnpublishedFixture } from './nodia-ai-unpublished.fixture.mjs';

const fixture = await createNodiaAiIntegrationFixture('ai37');
const { db } = fixture;
const checks = [];
const check = (name, condition) => { assert.ok(condition, name); checks.push(name); };
let workerContext;
let unpublished;
try {
  const Service = await loadAi('nodia-ai-operations/nodia-ai-operations.service', 'NodiaAiOperationsService');
  const Observe = await loadAi('nodia-ai-operations/use-case/observe-nodia-ai-operations.use-case', 'ObserveNodiaAiOperationsUseCase');
  const ValidatePolicy = await loadAi('nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case', 'ValidateNodiaAiRuntimePolicyUseCase');
  const policy = new ValidatePolicy().execute(JSON.parse(readFileSync(new URL('../dist/nodia-ai-runtime/config/runtime-policy.json', import.meta.url), 'utf8')));
  const observer = new Observe(new Service(db), policy);
  const before = await observer.execute();
  check('empty database has actual zero counters', Object.values(before.counters).every(value => value === 0));
  check('empty ages and remote readiness/cost remain unknown', Object.values(before.ages).every(value => value === null) && before.provider_ready === null && before.external_cost === null);
  const job = async ({ kind = 'reconcile', state = 'waiting', stage = 'reconcile_ack', attempts = 0, descriptor = { cleanup_attempts: 0 }, deadline = 3600, updated = 0, created = 10, lease = 60 } = {}) => {
    const id = randomUUID();
    await db.query(`INSERT INTO nodia_ai_jobs(id,kind,dedup_key,state,available_at,deadline_at,stage_key,attempt_count,recovery_descriptor,storage_key,storage_generation,lease_owner,lease_until,fence,created_at,updated_at)
      VALUES($1::uuid,$2,$1::uuid::text,$3,clock_timestamp(),clock_timestamp()+$4*interval '1 second',$5,$6,$7,$8,$9,$10,$11,1,clock_timestamp()-$12*interval '1 second',clock_timestamp()-$13*interval '1 second')`,
    [id, kind, state, deadline, stage, attempts, descriptor,
      kind === 'delete_blob' ? 'nodia-ai/synthetic-private-object' : null, kind === 'delete_blob' ? randomUUID() : null,
      state === 'leased' ? randomUUID() : null, state === 'leased' ? new Date(Date.now() + lease * 1000) : null, created, updated]);
    return id;
  };
  const restored = await job({ state: 'failed', stage: 'restored_terminal', descriptor: { restore_quarantined: true } });
  const restoredOnly = await observer.execute();
  check('restored failed job alerts without unknown jobs or slots', restoredOnly.counters.restore_quarantined_jobs === 1 && restoredOnly.counters.unknown_jobs === 0 && restoredOnly.counters.unknown_slots === 0 && JSON.stringify(restoredOnly.alerts) === JSON.stringify(['restore_quarantine_pending']));
  await db.query('DELETE FROM nodia_ai_jobs WHERE id=$1::uuid', [restored]);
  await job({ kind: 'turn', state: 'unknown', stage: 'inference', descriptor: { reason: 'chat_expired' }, updated: 30 });
  await db.query("INSERT INTO nodia_ai_runtime_slots(resource_key,state) VALUES('synthetic-sensitive-profile','unknown')");
  await job({ state: 'failed', descriptor: { cleanup_attempts: policy.retry.cleanup_attempts } });
  await job({ attempts: 99, descriptor: { cleanup_attempts: 1 } });
  await job({ kind: 'delete_blob', stage: 'attachment_cleanup', attempts: policy.retry.cleanup_attempts, state: 'leased' });
  await job({ kind: 'delete_blob', stage: 'attachment_cleanup', attempts: policy.retry.cleanup_attempts, state: 'failed', deadline: -1 });
  await job({ kind: 'reconcile', stage: 'different_stage', state: 'leased', lease: -1 });
  const observed = await observer.execute();
  check('unknown jobs and orphan slots counted independently', observed.counters.unknown_jobs === 1 && observed.counters.unknown_slots === 1);
  check('only supported cleanup stages counted', observed.counters.cleanup_pending === 4);
  check('proof attempts read descriptor; leased final blob attempt is not exhausted', observed.counters.cleanup_exhausted === 2);
  check('persisted blob cleanup target is overdue without resetting retry deadlines', observed.counters.blob_cleanup_overdue === 1);
  check('expired leases are visible', observed.counters.lease_expired === 1);
  check('unknown age uses persisted state observation time', observed.ages.oldest_unknown_job_seconds >= 30);
  check('aggregate output contains no payload or identity', !JSON.stringify(observed).includes('synthetic-sensitive') && !JSON.stringify(observed).includes('private-object') && !JSON.stringify(observed).includes('chat_expired'));
  const hash = async () => (await db.query("SELECT md5(string_agg(to_jsonb(j)::text,'' ORDER BY id)) AS hash FROM nodia_ai_jobs j"))[0].hash;
  const firstHash = await hash(); await observer.execute();
  check('observation cannot release unknown or mutate pending cleanup', firstHash === await hash());
  await db.query(`INSERT INTO nodia_ai_jobs(id,kind,dedup_key,state,available_at,deadline_at,stage_key,recovery_descriptor)
    SELECT gen_random_uuid(),'reconcile','synthetic-volume-'||n,'waiting',clock_timestamp(),clock_timestamp()+interval '1 hour','reconcile_ack','{"cleanup_attempts":0}'::jsonb FROM generate_series(1,1000) n`);
  const queries = [];
  const originalQuery = db.logger.logQuery.bind(db.logger);
  db.logger.logQuery = (sql, parameters, runner) => { queries.push(sql); originalQuery(sql, parameters, runner); };
  const start = performance.now();
  const volume = await observer.execute();
  const elapsed = performance.now() - start;
  const aggregate = queries.filter(sql => sql.includes('WITH instant AS MATERIALIZED'));
  check('volume uses one aggregate statement with no N+1', aggregate.length === 1 && queries.length === 4);
  check('volume returns aggregate instead of materializing individual jobs', volume.counters.cleanup_pending === 1004);
  db.logger.logQuery = originalQuery;
  // Compile the actual standalone graph with synthetic transport/Redis and disabled bootstrap.
  // No init/start/listen call; the operations module itself and its policy/SQL remain real.
  const config = await loadAi('config/db.config', 'postgresConfig');
  Object.assign(config, { ...fixture.options, entities: [], autoLoadEntities: true });
  const WorkerModule = await loadAi('nodia-ai-worker.module', 'NodiaAiWorkerModule');
  const Worker = await loadAi('nodia-ai-runtime/nodia-ai.worker', 'NodiaAiWorker');
  const RunWorker = await loadAi('nodia-ai-runtime/use-case/run-nodia-ai-worker.use-case', 'RunNodiaAiWorkerUseCase');
  const Report = await loadAi('nodia-ai-operations/use-case/report-nodia-ai-operations.use-case', 'ReportNodiaAiOperationsUseCase');
  const Adapter = await loadAi('nodia-ai-adapter/types/nodia-ai-adapter.types', 'NodiaAiAdapterPort');
  const Families = await loadAi('nodia-ai-tools/types/tool-registry.types', 'NODIA_AI_TOOL_FAMILIES');
  const Redis = await loadAi('common/redis/redis.service', 'RedisService');
  let externalCalls = 0;
  const rejectExternal = async () => { externalCalls++; throw Error('Unexpected synthetic external call'); };
  const noExternal = { measureContext: rejectExternal, observe: rejectExternal, verifyConfiguration: rejectExternal, execute: rejectExternal };
  const beforeCompositionHash = await hash();
  unpublished = await createNodiaAiUnpublishedFixture();
  workerContext = await unpublished.override(Test.createTestingModule({ imports: [WorkerModule] }))
    .overrideProvider(Families).useValue([])
    .overrideProvider(Worker).useValue({})
    .overrideProvider(Adapter).useValue(noExternal)
    .overrideProvider(Redis).useValue({ get: async () => null, set: async () => undefined, del: async () => undefined, keys: async () => [] })
    .compile();
  check('real worker DI resolves required operations dependency without starting loops', !!workerContext.get(RunWorker) && !!workerContext.get(Report));
  const composed = await workerContext.get(Observe).execute();
  check('worker composition uses actual aggregate SQL and validated runtime policy', composed.policy_version === policy.policyVersion && composed.counters.cleanup_pending === 1004);
  check('composition and observation invoke no external provider', externalCalls === 0);
  check('composition cannot autoenqueue, lease or release existing unknown records', beforeCompositionHash === await hash() && composed.counters.unknown_jobs === 1 && composed.counters.unknown_slots === 1);
  console.log(JSON.stringify({ stage: 'AI-37', scope: 'isolated_postgresql_synthetic', checks,
    measured: { pending_jobs: Number((await db.query('SELECT count(*) FROM nodia_ai_jobs'))[0].count), aggregate_statements: aggregate.length, total_statements_including_begin_commit: queries.length, elapsed_ms: elapsed },
    provider_inferences: 0, operational_database_touched: false, tables_added: 0, indexes_added: 0 }, null, 2));
} finally {
  try { await workerContext?.close(); } finally {
    try { unpublished?.close(); } finally { await fixture.close(); }
  }
}
