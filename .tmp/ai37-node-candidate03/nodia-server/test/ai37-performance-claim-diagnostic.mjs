// Isolates the actual candidate SQL on migrated disposable PostgreSQL. No dispatch.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createNodiaAiIntegrationFixture, loadAi } from './nodia-ai.integration.fixture.mjs';
import { seedAi37Performance } from './ai37-performance.fixture.mjs';
const sha = text => createHash('sha256').update(text).digest('hex');
const Validate = await loadAi('nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case', 'ValidateNodiaAiRuntimePolicyUseCase');
const policy = new Validate().execute(JSON.parse(readFileSync(new URL('../dist/nodia-ai-runtime/config/runtime-policy.json', import.meta.url))));
const fixture = await createNodiaAiIntegrationFixture('ai37');
let report;
try {
  const { db } = fixture;
  await seedAi37Performance(db, policy, { queueOnly: true });
  const Runtime = await loadAi('nodia-ai-runtime/nodia-ai-runtime.service', 'NodiaAiRuntimeService');
  let captured;
  await new Runtime(db).candidate({ query: async (query, parameters) => { captured = { query, parameters }; return []; } },
    policy.policyHash, ['ai37-synthetic-catalog'], policy.queue.foreground_workers, policy.queue.active_per_owner, policy.queue.wait_seconds);
  const correlated = "AND (SELECT COUNT(*) FROM nodia_ai_jobs active JOIN nodia_ai_conversations owner ON owner.id=active.conversation_id WHERE active.kind IN ('turn','execution') AND active.state IN ('leased','unknown') AND owner.owner_id=c.owner_id)<$4";
  assert.ok(captured.query.includes(correlated));
  const candidate = `WITH active_owner_counts AS MATERIALIZED (
    SELECT owner.owner_id,COUNT(*) AS active_count
    FROM nodia_ai_jobs active JOIN nodia_ai_conversations owner ON owner.id=active.conversation_id
    WHERE active.kind IN ('turn','execution') AND active.state IN ('leased','unknown')
    GROUP BY owner.owner_id
  ) ` + captured.query.replace('JOIN nodia_ai_jobs j ON j.id=c.active_job_id',
    'JOIN nodia_ai_jobs j ON j.id=c.active_job_id LEFT JOIN active_owner_counts ON active_owner_counts.owner_id=c.owner_id')
    .replace(correlated, 'AND COALESCE(active_owner_counts.active_count,0)<$4');
  const execute = async (query, analyze) => {
    const runner = db.createQueryRunner(); await runner.connect();
    try {
      await runner.startTransaction(); await runner.query("SET LOCAL statement_timeout='10s'");
      const [row] = await runner.query(`EXPLAIN (${analyze ? 'ANALYZE,BUFFERS,' : ''}FORMAT JSON) ` + query, captured.parameters);
      return row['QUERY PLAN'][0];
    } catch (error) { if (error.code !== '57014') throw error; return { status: 'statement_timeout', limit_seconds: 10 }; }
    finally { if (runner.isTransactionActive) await runner.rollbackTransaction(); await runner.release(); }
  };
  const baselineEstimate = await execute(captured.query, false);
  const candidateEstimate = await execute(candidate, false);
  const baseline = await execute(captured.query, true);
  const after = [];
  for (let sample = 0; sample < 5; sample++) after.push(await execute(candidate, true));
  report = { stage: 'AI-37', scope: 'isolated_candidate_owner_count_diagnostic',
    baseline_sql_sha256: sha(captured.query), candidate_sql_sha256: sha(candidate), baseline_estimate: baselineEstimate,
    candidate_estimate: candidateEstimate, baseline, candidate_samples: after,
    production_source_modified: false, configured_database_touched: false, providers_called: false, cleanup_complete: false };
} finally { await fixture.close(); }
report.cleanup_complete = true;
console.log(JSON.stringify(report));
