// Paired index-presence experiment using the compiled query and an isolated synthetic database.
// DROP INDEX is rolled back in each no-index sample: no rebuild/cache churn between paired states.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createNodiaAiIntegrationFixture, loadAi } from './nodia-ai.integration.fixture.mjs';

const fixture = await createNodiaAiIntegrationFixture('ai35');
const { db, identities } = fixture;
let report;
try {
  const [Store, AuthorizationStore, Authorize, Project, List, SearchMigration] = await Promise.all([
    ['nodia-ai-conversation/nodia-ai-conversation.service', 'NodiaAiConversationService'],
    ['nodia-ai/nodia-ai-authorization.service', 'NodiaAiAuthorizationService'],
    ['nodia-ai/use-case/authorize-nodia-ai.use-case', 'AuthorizeNodiaAiUseCase'],
    ['nodia-ai-conversation/use-case/project-nodia-ai-conversation.use-case', 'ProjectNodiaAiConversationUseCase'],
    ['nodia-ai-conversation/use-case/list-nodia-ai-conversations.use-case', 'ListNodiaAiConversationsUseCase'],
    ['migrations/1793100000000-AddNodiaAiTextSearchIndex', 'AddNodiaAiTextSearchIndex1793100000000'],
  ].map(([file, name]) => loadAi(file, name)));
  const policy = JSON.parse(readFileSync(new URL('../dist/nodia-ai-runtime/config/runtime-policy.json', import.meta.url), 'utf8')).policy;
  const list = new List(new Store(db), new Authorize(new AuthorizationStore(db)), new Project(), policy);
  const migration = new SearchMigration();
  await db.transaction(manager => migration.down(manager.queryRunner));
  await db.query(`INSERT INTO nodia_ai_conversations(id,owner_id,client_request_id,title,expires_at,creation_request_hash,updated_at,is_archived,is_pinned)
    SELECT md5('ai35-chat-'||n)::uuid,CASE WHEN n<=10000 THEN 1 ELSE 2 END,md5('ai35-request-'||n)::uuid,
      CASE WHEN n=9123 THEN 'RareTitleBenchmark' ELSE 'Synthetic volume conversation '||n END,
      clock_timestamp()+interval '30 days',repeat('d',64),clock_timestamp()-(n * interval '1 microsecond'),n%5=0,n%7=0
    FROM generate_series(1,20000) n`);
  await db.query(`INSERT INTO nodia_ai_messages(id,conversation_id,seq,role,status,source_scope_manifest,sealed_at)
    SELECT md5('ai35-message-'||n)::uuid,md5('ai35-chat-'||((n-1)/10+1))::uuid,(n-1)%10+1,'assistant','sealed',
      '{"schema_version":1,"module_routes":[]}'::jsonb,clock_timestamp() FROM generate_series(1,200000) n`);
  await db.query(`INSERT INTO nodia_ai_message_parts(message_id,conversation_id,part_index,kind,text)
    SELECT id,conversation_id,0,'text',CASE WHEN seq=7 AND conversation_id=md5('ai35-chat-9123')::uuid THEN 'RareBodyBenchmark ' ELSE '' END ||
      repeat('Synthetic searchable message body with product information. ',7) FROM nodia_ai_messages`);
  await db.transaction(manager => migration.up(manager.queryRunner));
  await db.query('ANALYZE nodia_ai_conversations; ANALYZE nodia_ai_messages; ANALYZE nodia_ai_message_parts');
  let captured;
  const original = db.logger.logQuery.bind(db.logger);
  db.logger.logQuery = (query, parameters, runner) => {
    if (query.startsWith('SELECT') && query.includes('FROM "nodia_ai_conversations" "c"')) captured = { query, parameters: [...parameters] };
    original(query, parameters, runner);
  };
  const shape = node => ({ node: node['Node Type'], relation: node['Relation Name'] ?? null, index: node['Index Name'] ?? null,
    ...(node.Plans ? { plans: node.Plans.map(shape) } : {}) });
  const sample = async withIndex => {
    const runner = db.createQueryRunner();
    await runner.connect();
    try {
      await runner.startTransaction();
      await runner.query("SET LOCAL statement_timeout='5s'");
      if (!withIndex) await migration.down(runner);
      const [row] = await runner.query('EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) ' + captured.query, captured.parameters);
      return row['QUERY PLAN'][0];
    } finally {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      await runner.release();
    }
  };
  const profiles = {};
  for (const query of ['Synthetic', 'searchable message body']) {
    await list.execute(identities.get('1'), { search: query });
    const queryHash = createHash('sha256').update(captured.query).digest('hex');
    // Equal warm-up in both states, then AB/BA alternation to expose temporal drift.
    await sample(false); await sample(true);
    const samples = [];
    for (let pair = 0; pair < 5; pair++) {
      for (const withIndex of pair % 2 === 0 ? [false, true] : [true, false]) {
        const value = await sample(withIndex);
        samples.push({ pair, with_index: withIndex, execution_ms: value['Execution Time'], planning_ms: value['Planning Time'],
          shared_hit_blocks: value.Plan['Shared Hit Blocks'] ?? 0, shared_read_blocks: value.Plan['Shared Read Blocks'] ?? 0,
          plan: shape(value.Plan) });
      }
    }
    const median = selected => selected.map(s => s.execution_ms).sort((a, b) => a - b)[2];
    const before = median(samples.filter(s => !s.with_index)), after = median(samples.filter(s => s.with_index));
    const planHashes = new Set(samples.map(s => createHash('sha256').update(JSON.stringify(s.plan)).digest('hex')));
    assert.equal(planHashes.size, 1, 'wide-query plan changed with index presence');
    const plan = JSON.stringify(samples[0].plan);
    assert.equal(plan.includes('ix_nodia_ai_message_parts_text_search'), false);
    profiles[query] = { query_sha256: queryHash, samples, before_ms: before, after_ms: after, ratio: after / before,
      same_plan_all_samples: true, gin_index_used: false, plan_sha256: [...planHashes][0] };
  }
  const [volume] = await db.query(`SELECT (SELECT count(*)::int FROM nodia_ai_conversations) conversations,(SELECT count(*)::int FROM nodia_ai_messages) messages,
    (SELECT count(*)::int FROM nodia_ai_message_parts) parts,(SELECT sum(octet_length(text))::bigint::text FROM nodia_ai_message_parts) text_bytes,
    pg_relation_size('public.ix_nodia_ai_message_parts_text_search')::text gin_index_bytes`);
  report = { task: 'AI-35', status: 'passed', scope: 'compiled_wide_search_paired_postgresql16_synthetic_content', volume, profiles,
    method: '5 paired warm EXPLAIN ANALYZE BUFFERS samples per profile; AB/BA alternating index presence; no-index DROP INDEX rolled back; no rebuild between paired samples.',
    configured_database_touched: false, providers_called: false, r2_called: false, services_restarted: false,
    cleanup: { disposable_postgresql_removed: false }, limitations: ['Synthetic warm-cache timings; these are not production percentiles.', 'This experiment isolates index presence in wide-query reads; index creation, storage and write costs remain separate.'] };
} finally {
  await fixture.close();
}
report.cleanup.disposable_postgresql_removed = true;
console.log(JSON.stringify(report));
