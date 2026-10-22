// Compares compiled before/after SQL with real constraints and competing row locks.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createNodiaAiIntegrationFixture, loadAi } from './nodia-ai.integration.fixture.mjs';
import { seedAi37Performance } from './ai37-performance.fixture.mjs';
const sha = text => createHash('sha256').update(text).digest('hex');
const baselineRoot = process.argv[2], baselineManifestHash = process.argv[3];
assert.ok(typeof baselineRoot === 'string' && isAbsolute(baselineRoot));
assert.match(baselineManifestHash, /^[a-f0-9]{64}$/);
const manifestBytes = readFileSync(baselineRoot + '/manifest.json');
assert.equal(sha(manifestBytes), baselineManifestHash);
const manifest = JSON.parse(manifestBytes);
const runtimeRelative = 'dist/nodia-ai-runtime/nodia-ai-runtime.service.js';
assert.equal(sha(readFileSync(baselineRoot + '/' + runtimeRelative)), manifest.files[runtimeRelative]);
const Before = (await import(pathToFileURL(baselineRoot + '/' + runtimeRelative))).NodiaAiRuntimeService;
const After = await loadAi('nodia-ai-runtime/nodia-ai-runtime.service', 'NodiaAiRuntimeService');
const Validate = await loadAi('nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case', 'ValidateNodiaAiRuntimePolicyUseCase');
const policy = new Validate().execute(JSON.parse(readFileSync(new URL('../dist/nodia-ai-runtime/config/runtime-policy.json', import.meta.url))));
const fixture = await createNodiaAiIntegrationFixture('ai37');
const checks = [];
let report;
try {
  const { db } = fixture;
  await seedAi37Performance(db, policy, { queueOnly: true });
  // Full-history performance is measured separately. Semantic cases retain 32
  // queued jobs and their relational graph, making exhaustive comparisons cheap.
  await db.query("DELETE FROM nodia_ai_jobs WHERE state='done'");
  await db.query('DELETE FROM nodia_ai_conversations WHERE active_job_id IS NULL');
  await db.query("UPDATE nodia_ai_jobs SET deadline_at=now()+interval '1 hour'");
  await db.query("UPDATE nodia_ai_runs SET deadline_at=now()+interval '1 hour'");
  const capture = async Type => {
    let captured;
    await new Type(db).candidate({ query: async (query, parameters) => { captured = { query, parameters }; return []; } },
      policy.policyHash, ['ai37-synthetic-catalog'], policy.queue.foreground_workers, policy.queue.active_per_owner, policy.queue.wait_seconds);
    return captured;
  };
  const before = await capture(Before), after = await capture(After);
  assert.ok(before.query.includes('AND owner.owner_id=c.owner_id'));
  assert.ok(after.query.includes('WITH active_owner_counts AS MATERIALIZED'));
  assert.deepEqual(before.parameters, after.parameters);
  const execute = async (name, prepare = async () => {}, expected = 'eligible', heldId) => {
    const runner = db.createQueryRunner(); await runner.connect(); await runner.startTransaction();
    try {
      await runner.query("SET LOCAL statement_timeout='3s'");
      await prepare(runner);
      await runner.query('SET CONSTRAINTS ALL IMMEDIATE');
      const oldRows = await runner.query(before.query, before.parameters);
      const newRows = await runner.query(after.query, after.parameters);
      assert.deepEqual(newRows, oldRows, name);
      if (expected === 'empty') assert.equal(newRows.length, 0, name);
      else assert.equal(newRows.length, 1, name);
      if (heldId) assert.notEqual(newRows[0]?.id, heldId, name);
      checks.push({ name, selected_id_equal: true, returned_rows: newRows.length });
      return newRows[0]?.id;
    } finally { await runner.rollbackTransaction(); await runner.release(); }
  };
  const selected = await execute('baseline ordering and limits preserved');
  const [{ active_job_id: selectedJob, owner_id: selectedOwner }] = await db.query('SELECT active_job_id,owner_id FROM nodia_ai_conversations WHERE id=$1', [selected]);
  const [{ id: partnerJob }] = await db.query('SELECT j.id FROM nodia_ai_jobs j JOIN nodia_ai_conversations c ON c.id=j.conversation_id WHERE c.owner_id=$1 AND j.id<>$2', [selectedOwner, selectedJob]);
  const lease = (runner, ids) => runner.query("UPDATE nodia_ai_jobs SET state='leased',lease_owner='00000000-0000-4000-a000-000000000001',lease_until=now()+interval '1 minute',fence=1 WHERE id=ANY($1::uuid[])", [ids]);
  await execute('one active owner blocks only that owner', runner => lease(runner, [partnerJob]));
  await execute('unknown owner counts against owner capacity', runner => runner.query("UPDATE nodia_ai_jobs SET state='unknown' WHERE id=$1", [partnerJob]));
  const [{ id: otherJob }] = await db.query('SELECT j.id FROM nodia_ai_jobs j JOIN nodia_ai_conversations c ON c.id=j.conversation_id WHERE c.owner_id<>$1 LIMIT 1', [selectedOwner]);
  await execute('global leased capacity blocks every owner', runner => lease(runner, [partnerJob, otherJob]), 'empty');
  for (const value of [true, false]) await execute(`restore marker presence remains excluded with value ${value}`, runner => runner.query('UPDATE nodia_ai_jobs SET recovery_descriptor=$2 WHERE id=$1', [selectedJob, { restore_quarantined: value }]));
  await execute('expired job cannot become eligible', runner => runner.query("UPDATE nodia_ai_jobs SET deadline_at=now()-interval '1 second' WHERE id=$1", [selectedJob]));
  await execute('blocked physical profile is unchanged for inference', async runner => {
    await runner.query("UPDATE nodia_ai_jobs SET stage_key='inference' WHERE id=$1", [selectedJob]);
    await runner.query("INSERT INTO nodia_ai_runtime_slots(resource_key,state) VALUES('synthetic-ai37-profile','unknown')");
  });
  await execute('unknown orphan does not invent an owner count', async runner => {
    await runner.query('UPDATE nodia_ai_conversations SET active_job_id=NULL WHERE active_job_id=$1', [partnerJob]);
    await runner.query("UPDATE nodia_ai_jobs SET state='unknown',run_id=NULL,conversation_id=NULL,recovery_descriptor='{}' WHERE id=$1", [partnerJob]);
  });
  const holder = db.createQueryRunner(); await holder.connect(); await holder.startTransaction();
  try {
    await holder.query('SELECT id FROM nodia_ai_conversations WHERE id=$1 FOR UPDATE', [selected]);
    await execute('another transaction row lock is skipped with identical next selection', async () => {}, 'eligible', selected);
    await holder.query('SELECT id FROM nodia_ai_conversations FOR UPDATE');
    await execute('all competing row locks produce empty without blocking', async () => {}, 'empty');
  } finally { await holder.rollbackTransaction(); await holder.release(); }
  report = { stage: 'AI-37', scope: 'compiled_candidate_sql_equivalence_postgresql16', checks,
    baseline_manifest_sha256: baselineManifestHash, baseline_sql_sha256: sha(before.query), candidate_sql_sha256: sha(after.query),
    baseline_compiled_service_sha256: sha(readFileSync(baselineRoot + '/' + runtimeRelative)),
    candidate_compiled_service_sha256: sha(readFileSync(new URL('../' + runtimeRelative, import.meta.url))),
    configured_database_touched: false, provider_calls: 0, indexes_added: 0, cleanup_complete: false,
    limitations: ['Actual candidate SQL and PostgreSQL locks are exercised; this is not provider or end-to-end dispatch acceptance.'] };
} finally { await fixture.close(); }
report.cleanup_complete = true;
console.log(JSON.stringify(report));
