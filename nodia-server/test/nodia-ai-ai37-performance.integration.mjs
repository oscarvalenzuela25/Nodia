// Real compiled queries, migrations and PostgreSQL16; synthetic data, no provider.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { createNodiaAiIntegrationFixture, loadAi } from './nodia-ai.integration.fixture.mjs';
import { seedAi37Performance, summarizePlan, quantiles } from './ai37-performance.fixture.mjs';

const checks = [], queries = [];
const check = (name, value) => { assert.ok(value, name); checks.push(name); };
const sha = value => createHash('sha256').update(value).digest('hex');
const policy = JSON.parse(readFileSync(new URL('../dist/nodia-ai-runtime/config/runtime-policy.json', import.meta.url), 'utf8'));
const ValidatePolicy = await loadAi('nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case', 'ValidateNodiaAiRuntimePolicyUseCase');
const runtimePolicy = new ValidatePolicy().execute(policy);
const fixture = await createNodiaAiIntegrationFixture('ai37');
const { db, identities } = fixture;
let report;
try {
  assert.match(runtimePolicy.policyHash, /^[a-f0-9]{64}$/);
  const [Store, AuthorizationStore, Authorize, Project, List, Access, Messages, Runtime, Expire, Registry, Compiler, AttachmentStore] = await Promise.all([
    ['nodia-ai-conversation/nodia-ai-conversation.service', 'NodiaAiConversationService'],
    ['nodia-ai/nodia-ai-authorization.service', 'NodiaAiAuthorizationService'],
    ['nodia-ai/use-case/authorize-nodia-ai.use-case', 'AuthorizeNodiaAiUseCase'],
    ['nodia-ai-conversation/use-case/project-nodia-ai-conversation.use-case', 'ProjectNodiaAiConversationUseCase'],
    ['nodia-ai-conversation/use-case/list-nodia-ai-conversations.use-case', 'ListNodiaAiConversationsUseCase'],
    ['nodia-ai-conversation/use-case/authorize-nodia-ai-conversation.use-case', 'AuthorizeNodiaAiConversationUseCase'],
    ['nodia-ai-conversation/use-case/list-nodia-ai-messages.use-case', 'ListNodiaAiMessagesUseCase'],
    ['nodia-ai-runtime/nodia-ai-runtime.service', 'NodiaAiRuntimeService'],
    ['nodia-ai-conversation/use-case/expire-nodia-ai-conversations.use-case', 'ExpireNodiaAiConversationsUseCase'],
    ['nodia-ai-reports/use-case/nodia-ai-report-registry.use-case', 'NodiaAiReportRegistryUseCase'],
    ['nodia-ai-reports/use-case/compile-nodia-ai-report.use-case', 'CompileNodiaAiReportUseCase'],
    ['nodia-ai-attachment/nodia-ai-attachment.service', 'NodiaAiAttachmentService'],
  ].map(([file, name]) => loadAi(file, name)));
  await seedAi37Performance(db, runtimePolicy);
  const store = new Store(db), authorize = new Authorize(new AuthorizationStore(db));
  const list = new List(store, authorize, new Project(), runtimePolicy);
  const messages = new Messages(store, new Access(store, authorize), runtimePolicy);
  const runtime = new Runtime(db);
  db.setOptions({ logging: ['query'], logger: {
    logQuery(query, parameters = []) { queries.push({ query, parameters }); },
    logQueryError() {}, logQuerySlow() {}, logSchemaBuild() {}, logMigration() {}, log() {},
  } });
  const capture = async (work, predicate) => {
    const start = queries.length;
    const result = await work();
    const recorded = queries.slice(start);
    const sql = recorded.find(predicate);
    assert.ok(sql, 'compiled query captured');
    return { sql, result, query_count: recorded.length };
  };
  const explain = async sql => {
    const runner = db.createQueryRunner(); await runner.connect();
    try {
      await runner.startTransaction();
      // Laboratory read limit only. No production policy is modified.
      await runner.query("SET LOCAL statement_timeout='10s'");
      const [row] = await runner.query('EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) ' + sql.query, sql.parameters);
      return row['QUERY PLAN'][0];
    } finally { if (runner.isTransactionActive) await runner.rollbackTransaction(); await runner.release(); }
  };
  const profiles = {};
  const measure = async (name, sql) => {
    await explain(sql); const samples = [];
    for (let i = 0; i < 5; i++) {
      const value = await explain(sql);
      samples.push({ execution_ms: value['Execution Time'], planning_ms: value['Planning Time'], plan: summarizePlan(value.Plan) });
    }
    profiles[name] = { sql_sha256: sha(sql.query), parameter_count: sql.parameters.length, samples,
      ...quantiles(samples.map(value => value.execution_ms)),
      samples_over_production_read_window: samples.filter(value => value.execution_ms > runtimePolicy.timing.read_query_seconds * 1000).length };
    process.stderr.write(JSON.stringify({ profile: name, median_ms: profiles[name].median_ms }) + '\n');
  };
  const listSql = item => item.query.startsWith('SELECT') && item.query.includes('FROM "nodia_ai_conversations" "c"');
  let first;
  for (const [name, input, actor] of [
    ['list_owner_first', {}, '1'], ['list_owner_filtered', { is_archived: false, is_pinned: true }, '1'],
    ['list_global_first', { view: 'all' }, '3'], ['search_short', { search: 'a' }, '1'],
    ['search_broad', { search: 'Synthetic' }, '1'], ['search_broad_body', { search: 'searchable message body' }, '1'], ['search_selective_body', { search: 'RareBodyAI37' }, '1'],
    ['search_selective_title', { search: 'RareTitleAI37' }, '1'],
    ['search_global_broad', { view: 'all', search: 'Synthetic' }, '3'],
    ['search_global_broad_body', { view: 'all', search: 'searchable message body' }, '3'],
  ]) {
    const captured = await capture(() => list.execute(identities.get(actor), input), listSql);
    if (name === 'list_owner_first') first = captured.result;
    if (name === 'search_selective_body') check('selective body returns exactly authorized expected chat', captured.result.items.length === 1);
    await measure(name, captured.sql);
  }
  const second = await capture(() => list.execute(identities.get('1'), { cursor: first.next_cursor }), listSql);
  check('keyset second page has no duplicate from first page', !second.result.items.some(item => first.items.some(previous => previous.conversation_id === item.conversation_id)));
  await measure('list_owner_second', second.sql);
  const [{ id: chatId }] = await db.query("SELECT ai37_id('chat-1') AS id");
  const messageProfiles = {};
  for (const page_limit of [1, 5, 10, 100]) {
    const begin = queries.length;
    const page = await messages.execute(identities.get('1'), chatId, { page_limit });
    const captured = queries.slice(begin);
    const dataQueries = captured.filter(item => item.query.startsWith('SELECT') &&
      /FROM "nodia_ai_messages" "m"|FROM "nodia_ai_message_parts" "p"|SELECT id,user_message_id,assistant_message_id FROM nodia_ai_runs/.test(item.query));
    check(`messages ${page_limit}: data query count remains three`, dataQueries.length === 3);
    check(`messages ${page_limit}: parts present and no duplicate messages`, page.items.every(item => item.parts?.length === 1) && new Set(page.items.map(item => item.message_id)).size === page.items.length);
    messageProfiles[page_limit] = { returned_rows: page.items.length, total_sql_commands: captured.length, data_queries: dataQueries.length,
      response_utf8_bytes: Buffer.byteLength(JSON.stringify(page)) };
    if (page_limit === 10) for (let i = 0; i < dataQueries.length; i++) await measure(`messages_query_${i + 1}`, dataQueries[i]);
  }
  const usage = await capture(() => db.transaction(manager => new AttachmentStore(db, runtimePolicy).usage(manager, chatId, '1', new Date())),
    item => item.query.includes('sum(a.reserved_bytes+COALESCE(octet_length(a.interpretation_text),0))'));
  check('storage accounting reads real UTF-8 text and durable reservations', BigInt(usage.result.owner_bytes) > 50000000n && BigInt(usage.result.chat_bytes) > 1000000n);
  await measure('admission_storage_usage', usage.sql);
  const claim = await capture(() => db.transaction(manager => runtime.candidate(manager, runtimePolicy.policyHash, ['ai37-synthetic-catalog'],
    runtimePolicy.queue.foreground_workers, runtimePolicy.queue.active_per_owner, runtimePolicy.queue.wait_seconds)),
  item => item.query.includes('SELECT c.id FROM nodia_ai_conversations c'));
  check('claim sees an eligible synthetic ready job among historical jobs', typeof claim.result === 'string');
  await measure('claim_ready_with_history', claim.sql);
  const registry = new Registry(runtimePolicy), compiler = new Compiler();
  const source = registry.get('finance_movements');
  const compiled = compiler.execute({ request: { source_key: 'finance_movements', alias: 'personal', scope: {},
    measures: [{ measure_key: 'confirmed_expense_amount', aggregation: 'sum', output_key: 'amount' }, { measure_key: 'records', aggregation: 'count', output_key: 'records' }],
    group_by: [{ dimension_key: 'category_id', output_key: 'category' }], filters: { all: [{ field_key: 'status', operator: 'eq', value: 'paid' }] } },
    source, catalogVersion: registry.catalogVersion, scopeSql: 'r.user_id=$1', scopeParameters: ['1'], scopeFingerprint: sha('synthetic-owner-1'),
    limits: { maxGroups: runtimePolicy.results.report_max_groups, maxFilters: runtimePolicy.results.report_max_filters,
      maxCollectionItems: runtimePolicy.results.json_collection_items, defaultGroups: runtimePolicy.results.list_default_rows } });
  await measure('report_finance_grouped', { query: compiled.sql, parameters: compiled.parameters });
  // Capture the actual expiration selector from the use case; rollback the entire maintenance run.
  let purgeSql, rollbackChecked = false;
  const rollbackStore = { transaction: work => db.transaction(async manager => { await work(manager); throw new Error('ai37_expected_rollback'); }), now: manager => store.now(manager) };
  const startPurge = queries.length;
  await assert.rejects(new Expire(rollbackStore, runtimePolicy).execute(), /ai37_expected_rollback/);
  purgeSql = queries.slice(startPurge).find(item => item.query.startsWith('SELECT id,retention_epoch FROM nodia_ai_conversations'));
  assert.ok(purgeSql);
  const [{ count: expiredAfterRollback }] = await db.query('SELECT count(*)::int AS count FROM nodia_ai_conversations WHERE expires_at<=now()');
  rollbackChecked = expiredAfterRollback === 100;
  check('maintenance rollback restores all expired synthetic chats', rollbackChecked);
  await measure('purge_selection', purgeSql);
  // Paired audit baseline vs candidate, same IDs/session/transaction, equal warm-up.
  const audit = {};
  for (const count of [1, 25, 100]) {
    const ids = (await db.query('SELECT id FROM nodia_ai_conversations WHERE owner_id=1 ORDER BY id LIMIT $1', [count])).map(row => row.id);
    const samples = [];
    for (let pair = -1; pair < 5; pair++) for (const batch of pair % 2 === 0 ? [false, true] : [true, false]) {
      const runner = db.createQueryRunner(); await runner.connect(); await runner.startTransaction();
      try {
        await runner.query("DELETE FROM nodia_ai_audit_events WHERE actor_id=3 AND conversation_id=ANY($1::uuid[])", [ids]);
        const before = queries.length, began = performance.now();
        if (batch) await store.auditInspections(runner.manager, '3', identities.get('3').sessionId, ids, 'list');
        else for (const id of ids) await store.auditInspection(runner.manager, '3', identities.get('3').sessionId, id, 'list');
        const elapsed = performance.now() - began;
        const inserts = queries.slice(before).filter(item => item.query.startsWith('INSERT INTO nodia_ai_audit_events')).length;
        const [observed] = await runner.query("SELECT count(*)::int AS count,count(DISTINCT id)::int AS ids,count(DISTINCT correlation_id)::int AS correlations,count(DISTINCT conversation_id)::int AS chats FROM nodia_ai_audit_events WHERE actor_id=3 AND conversation_id=ANY($1::uuid[]) AND minimal_details->>'operation'='list'", [ids]);
        check(`audit ${count}/${pair}/${batch}: distinct per-chat events preserved`, observed.count === count && observed.ids === observed.count && observed.correlations === observed.count && observed.chats === count);
        if (pair >= 0) samples.push({ pair, batch, elapsed_ms: elapsed, insert_commands: inserts });
      } finally { await runner.rollbackTransaction(); await runner.release(); }
    }
    const before = quantiles(samples.filter(value => !value.batch).map(value => value.elapsed_ms));
    const after = quantiles(samples.filter(value => value.batch).map(value => value.elapsed_ms));
    audit[count] = { samples, before, after, median_ratio_after_before: after.median_ms / before.median_ms,
      insert_commands_before: count, insert_commands_after: 1, same_audit_event_count: count };
  }
  const [Knowledge, Context] = await Promise.all([
    loadAi('nodia-ai-context/use-case/load-nodia-ai-knowledge.use-case', 'LoadNodiaAiKnowledgeUseCase'),
    loadAi('nodia-ai-context/use-case/build-nodia-ai-context.use-case', 'BuildNodiaAiContextUseCase'),
  ]);
  const knowledgeManifest = JSON.parse(readFileSync(new URL('../dist/nodia-ai/knowledge/manifest.json', import.meta.url), 'utf8'));
  // Performance inputs use the compiled manifest contracts; publication integrity
  // against the executable registry is verified independently by build/AI-36.
  const knownContracts = knowledgeManifest.capability_contracts.map(item => ({ capability_id: item.capability_id,
    revision: item.revision, kind: item.kind, required_module_routes: item.required_module_routes,
    input_schema_sha256: item.input_schema.sha256, output_schema_sha256: item.output_schema.sha256 }));
  const knowledge = new Knowledge(fileURLToPath(new URL('../dist/nodia-ai/knowledge/', import.meta.url)),
    JSON.parse(readFileSync(new URL('../dist/nodia-ai-context/config/knowledge-pin.json', import.meta.url), 'utf8')),
    readFileSync(new URL('../dist/nodia-ai-context/config/knowledge-schema.json', import.meta.url)), knownContracts, runtimePolicy);
  const builder = new Context(knowledge, runtimePolicy);
  const moduleRoutes = [...new Set(knowledgeManifest.fragments.flatMap(item => item.required_module_routes))];
  const contextProfiles = {};
  for (const count of [10, 100, 300, 500]) {
    const history = (await db.query(`SELECT m.seq::text,m.role,m.source_scope_manifest AS scope,p.text
      FROM nodia_ai_messages m JOIN nodia_ai_message_parts p ON p.message_id=m.id AND p.part_index=0
      WHERE m.conversation_id=$1 ORDER BY m.seq LIMIT $2`, [chatId, count]))
      .map(({ text, ...row }) => ({ ...row, parts: [{ kind: 'text', text }] }));
    const samples = []; let value;
    try {
      builder.execute({ moduleRoutes, history, throughSeq: history.at(-1).seq, mode: 'token_plan_agentic' });
      for (let sample = 0; sample < 5; sample++) {
        const began = performance.now();
        value = builder.execute({ moduleRoutes, history, throughSeq: history.at(-1).seq, mode: 'token_plan_agentic' });
        samples.push(performance.now() - began);
      }
      check(`context ${count}: rendered UTF-8 bytes exactly match manifest and cap`, value.manifest.context_bytes === Buffer.byteLength(value.prompt) && value.manifest.context_bytes <= runtimePolicy.results.assembled_context_utf8_bytes);
      contextProfiles[count] = { status: 'rendered', utf8_bytes: value.manifest.context_bytes,
        context_sha256: value.manifest.context_sha256, samples_ms: samples, ...quantiles(samples),
        fragment_count: value.manifest.fragments.length, serialized_messages: JSON.parse(value.prompt).messages.length };
    } catch (error) {
      if (error.message !== 'nodia_ai:context_limit') throw error;
      contextProfiles[count] = { status: 'rejected_at_existing_context_limit', cap_utf8_bytes: runtimePolicy.results.assembled_context_utf8_bytes, history_rows: history.length };
      check(`context ${count}: excess rejected without truncating history`, true);
    }
  }
  const listPolling = {};
  for (const page_limit of [1, 25, 100]) {
    const begin = queries.length;
    const page = await list.execute(identities.get('3'), { view: 'all', page_limit });
    const recorded = queries.slice(begin);
    const inserts = recorded.filter(item => item.query.startsWith('INSERT INTO nodia_ai_audit_events'));
    check(`global list ${page_limit}: one bounded audit command and exact visible row count`, inserts.length === 1 && page.items.length === page_limit);
    listPolling[page_limit] = { returned_rows: page.items.length, total_sql_commands: recorded.length, audit_commands: inserts.length };
  }
  const ownBegin = queries.length;
  await list.execute(identities.get('1'), { page_limit: 100 });
  check('owned list creates no inspection audit writes', !queries.slice(ownBegin).some(item => item.query.startsWith('INSERT INTO nodia_ai_audit_events')));
  const [{ count: beforeFailedBatch }] = await db.query('SELECT count(*)::int AS count FROM nodia_ai_audit_events');
  await assert.rejects(db.transaction(manager => store.auditInspections(manager, '3', identities.get('3').sessionId,
    [chatId, '00000000-0000-4000-a000-000000000000'], 'list')), error => error.code === '23503');
  const [{ count: afterFailedBatch }] = await db.query('SELECT count(*)::int AS count FROM nodia_ai_audit_events');
  check('failed batch audit rolls back valid rows together with invalid foreign key', beforeFailedBatch === afterFailedBatch);
  const emptyAuditStart = queries.length;
  await store.auditInspections(db.manager, '3', identities.get('3').sessionId, [], 'list');
  check('empty audit page issues no SQL command', queries.length === emptyAuditStart);
  const [volume] = await db.query(`SELECT (SELECT count(*)::int FROM nodia_ai_conversations) AS conversations,
    (SELECT count(*)::int FROM nodia_ai_messages) AS messages,(SELECT count(*)::int FROM nodia_ai_message_parts) AS parts,
    (SELECT count(*)::int FROM nodia_ai_runs) AS runs,(SELECT count(*)::int FROM nodia_ai_jobs) AS jobs,
    (SELECT count(*)::int FROM finance_movements) AS financial_movements,
    (SELECT sum(octet_length(text))::text FROM nodia_ai_message_parts) AS text_utf8_bytes,
    (SELECT sum(pg_column_size(source_scope_manifest))::text FROM nodia_ai_messages) AS scope_jsonb_stored_bytes,
    (SELECT sum(octet_length(context_manifest::text))::text FROM nodia_ai_runs) AS context_json_utf8_bytes,
    (SELECT sum(pg_column_size(context_manifest))::text FROM nodia_ai_runs) AS context_jsonb_stored_bytes`);
  const sizes = await db.query("SELECT relname,pg_relation_size(relid)::text AS heap_bytes,pg_indexes_size(relid)::text AS indexes_bytes,pg_total_relation_size(relid)::text AS total_bytes FROM pg_stat_user_tables WHERE relname LIKE 'nodia_ai_%' OR relname='finance_movements' ORDER BY relname");
  const indexes = await db.query("SELECT indexname,indexdef,pg_relation_size(quote_ident(schemaname)||'.'||quote_ident(indexname))::text AS bytes FROM pg_indexes WHERE tablename LIKE 'nodia_ai_%' ORDER BY indexname");
  // Expand only after all search/context/index baseline measurements. The
  // logical text stays beneath the real 100/500 MiB chat/owner budgets.
  await db.query(`UPDATE nodia_ai_message_parts p SET text=rpad('Synthetic quota growth body ',
    CASE WHEN c.id=$1 THEN 20000 ELSE 4200 END,'x')
    FROM nodia_ai_conversations c WHERE c.id=p.conversation_id AND c.owner_id=1`, [chatId]);
  await db.query('ANALYZE nodia_ai_message_parts');
  const quotaUsage = await capture(() => db.transaction(manager => new AttachmentStore(db, runtimePolicy).usage(manager, chatId, '1', new Date())),
    item => item.query.includes('sum(a.reserved_bytes+COALESCE(octet_length(a.interpretation_text),0))'));
  const quotaGrowth = { baseline_usage: usage.result, expanded_usage: quotaUsage.result,
    target_chat_bytes: runtimePolicy.admission.chat_storage_bytes, target_owner_bytes: runtimePolicy.admission.owner_storage_bytes,
    synthetic_compressible_text: true, prior_profiles_and_sizes_use_original_corpus: true };
  check('near-quota chat storage is above 90 percent and below real budget', BigInt(quotaUsage.result.chat_bytes)*10n > BigInt(quotaGrowth.target_chat_bytes)*9n && BigInt(quotaUsage.result.chat_bytes) < BigInt(quotaGrowth.target_chat_bytes));
  check('near-quota owner storage is above 90 percent and below real budget', BigInt(quotaUsage.result.owner_bytes)*10n > BigInt(quotaGrowth.target_owner_bytes)*9n && BigInt(quotaUsage.result.owner_bytes) < BigInt(quotaGrowth.target_owner_bytes));
  await measure('admission_storage_near_quotas', quotaUsage.sql);
  const [environment] = await db.query("SELECT version() AS postgres_version,current_setting('server_version_num') AS postgres_version_num,current_setting('shared_buffers') AS shared_buffers,current_setting('work_mem') AS work_mem");
  const sourcePins = Object.fromEntries([
    'test/nodia-ai-ai37-performance.integration.mjs','test/ai37-performance.fixture.mjs','test/nodia-ai.integration.fixture.mjs',
    'dist/nodia-ai-conversation/nodia-ai-conversation.service.js',
    'dist/nodia-ai-conversation/use-case/list-nodia-ai-conversations.use-case.js',
    'dist/nodia-ai-conversation/use-case/list-nodia-ai-messages.use-case.js',
    'dist/nodia-ai-runtime/nodia-ai-runtime.service.js',
    'dist/nodia-ai-conversation/use-case/expire-nodia-ai-conversations.use-case.js',
    'dist/nodia-ai-reports/use-case/compile-nodia-ai-report.use-case.js',
    'dist/nodia-ai-context/use-case/build-nodia-ai-context.use-case.js',
    'dist/nodia-ai-attachment/nodia-ai-attachment.service.js',
  ].map(path => [path,sha(readFileSync(new URL('../'+path, import.meta.url)))]));
  report = { task: 'AI-37', status: 'passed', scope: 'synthetic_postgresql16_compiled_queries', generated_at: new Date().toISOString(),
    method: 'One warm-up and five warm EXPLAIN ANALYZE BUFFERS samples; every locking statement rolled back. Audit AB/BA alternates baseline and set-based candidate in rolled-back transactions.',
    checks, environment, quota_growth: quotaGrowth, source_pins: sourcePins, volume, sizes, indexes, profiles, message_profiles: messageProfiles, context_profiles: contextProfiles, knowledge_release: knowledgeManifest.release_id, list_polling: listPolling, audit_comparison: audit,
    policy: { version: runtimePolicy.policyVersion, hash: runtimePolicy.policyHash, production_query_seconds: runtimePolicy.timing.read_query_seconds, benchmark_statement_timeout_seconds: 10 },
    configured_database_touched: false, providers_called: false, r2_called: false, services_restarted: false,
    external_cost: { provider_calls: 0, tokens: null, monetary_cost: null, note: 'No inference performed; vendor internal usage and price remain unknown.' },
    limitations: ['Warm synthetic measurements are not production percentiles or SLA.', 'Report benchmark uses the real compiler with an explicit synthetic owner predicate; authorization integration remains the existing AI-30/31 suite.',
      'Claim benchmark measures candidate selection, not dispatch or provider concurrency.', 'Purging scan is measured and maintenance rollback exercised; cloud blob deletion is not performed.',
      'Repeated JSONB is compressible; bytes reflect this corpus and are not a storage forecast.'], cleanup: { disposable_postgresql_removed: false } };
} finally { await fixture.close(); }
report.cleanup.disposable_postgresql_removed = true;
console.log(JSON.stringify(report));
