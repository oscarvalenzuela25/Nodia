// Real compiled use cases and PostgreSQL16; synthetic content only, no configured DB/provider/R2.
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createNodiaAiIntegrationFixture, loadAi } from './nodia-ai.integration.fixture.mjs';

const fixture = await createNodiaAiIntegrationFixture('ai35');
const { db, identities } = fixture;
const checks = [];
const check = (name, condition = true) => { assert.ok(condition, name); checks.push(name); };
const actualQueries = [];
const originalLogger = db.logger.logQuery.bind(db.logger);
db.logger.logQuery = (query, parameters, runner) => {
  if (query.startsWith('SELECT') && query.includes('FROM "nodia_ai_conversations" "c"'))
    actualQueries.push({ query, parameters: [...(parameters ?? [])] });
  originalLogger(query, parameters, runner);
};
let report;
try {
  const [Store, AuthorizationStore, Authorize, Project, List, Access, Update, SearchMigration] = await Promise.all([
    ['nodia-ai-conversation/nodia-ai-conversation.service', 'NodiaAiConversationService'],
    ['nodia-ai/nodia-ai-authorization.service', 'NodiaAiAuthorizationService'],
    ['nodia-ai/use-case/authorize-nodia-ai.use-case', 'AuthorizeNodiaAiUseCase'],
    ['nodia-ai-conversation/use-case/project-nodia-ai-conversation.use-case', 'ProjectNodiaAiConversationUseCase'],
    ['nodia-ai-conversation/use-case/list-nodia-ai-conversations.use-case', 'ListNodiaAiConversationsUseCase'],
    ['nodia-ai-conversation/use-case/authorize-nodia-ai-conversation.use-case', 'AuthorizeNodiaAiConversationUseCase'],
    ['nodia-ai-conversation/use-case/update-nodia-ai-conversation.use-case', 'UpdateNodiaAiConversationUseCase'],
    ['migrations/1793100000000-AddNodiaAiTextSearchIndex', 'AddNodiaAiTextSearchIndex1793100000000'],
  ].map(([file, name]) => loadAi(file, name)));
  const store = new Store(db), authorize = new Authorize(new AuthorizationStore(db)), project = new Project();
  const policy = JSON.parse(readFileSync(new URL('../dist/nodia-ai-runtime/config/runtime-policy.json', import.meta.url), 'utf8')).policy;
  const list = new List(store, authorize, project, policy);
  const update = new Update(store, new Access(store, authorize), project);
  const identity = identities.get('1'), foreign = identities.get('2'), admin = identities.get('3');
  const ownSearch = (search, extra = {}) => list.execute(identity, { search, ...extra });
  const ids = (page) => page.items.map(item => item.conversation_id);
  const chat = async (owner = '1', title = 'Synthetic conversation', values = {}) => {
    const id = randomUUID();
    await db.query(`INSERT INTO nodia_ai_conversations(id,owner_id,client_request_id,title,expires_at,creation_request_hash,is_archived,is_pinned)
      VALUES($1,$2,$3,$4,clock_timestamp()+interval '30 days',$5,$6,$7)`,
    [id, owner, randomUUID(), title, 'a'.repeat(64), values.archived ?? false, values.pinned ?? false]);
    return id;
  };
  const text = async (conversation, value, { role = 'user', author = '1', scope = { schema_version: 1, module_routes: [] }, kind = 'text' } = {}) => {
    const id = randomUUID();
    const [{ seq }] = await db.query('SELECT COALESCE(max(seq),0)+1 AS seq FROM nodia_ai_messages WHERE conversation_id=$1', [conversation]);
    await db.query(`INSERT INTO nodia_ai_messages(id,conversation_id,seq,role,author_id,client_message_id,status,source_scope_manifest,sealed_at,input_hash)
      VALUES($1,$2,$3,$4,$5,$6,'sealed',$7,clock_timestamp(),$8)`, [id, conversation, seq, role, role === 'assistant' ? null : author, role === 'assistant' ? null : randomUUID(), scope, role === 'assistant' ? null : 'b'.repeat(64)]);
    let attachment = null;
    if (kind !== 'text') {
      attachment = randomUUID();
      const generation = randomUUID();
      await db.query(`INSERT INTO nodia_ai_attachments(id,conversation_id,client_request_id,request_hash,retention_epoch,kind,state,file_name,storage_key,generation,reserved_bytes,expires_at)
        VALUES($1,$2,$3,$4,1,$5,'uploading','synthetic',$7,$6,1,clock_timestamp()+interval '30 days')`,
      [attachment, conversation, randomUUID(), 'c'.repeat(64), kind, generation, `nodia-ai/${conversation}/${attachment}/${generation}`]);
    }
    await db.query('INSERT INTO nodia_ai_message_parts(message_id,conversation_id,part_index,kind,text,attachment_id) VALUES($1,$2,0,$3,$4,$5)', [id, conversation, kind, value, attachment]);
    return id;
  };
  const title = await chat('1', 'Compra café %_\\ literal'), ownerText = await chat(), assistantText = await chat();
  await text(ownerText, 'Mercurio café reservado');
  await text(assistantText, 'Respuesta de Saturno', { role: 'assistant' });
  check('title search is case insensitive and preserves Unicode', ids(await ownSearch('CAFÉ')).includes(title));
  check('owner text is searchable', ids(await ownSearch('Mercurio')).includes(ownerText));
  check('assistant text is searchable', ids(await ownSearch('Saturno')).includes(assistantText));
  check('SQL wildcard and escape metacharacters stay literal', ids(await ownSearch('%_\\')).length === 1 && ids(await ownSearch('%_\\'))[0] === title);
  check('SQL-looking text does not alter the query', (await ownSearch("%' OR TRUE --")).items.length === 0);
  for (const kind of ['image', 'pdf', 'audio']) {
    const attachmentChat = await chat();
    await text(attachmentChat, 'OnlyAttachment' + kind, { kind });
    check(kind + ' interpretation text is excluded from search', (await ownSearch('OnlyAttachment' + kind)).items.length === 0);
  }
  const mismatchedAuthor = await chat();
  await text(mismatchedAuthor, 'WrongHumanAuthor', { author: '2' });
  check('a user message authored by somebody other than the chat owner is excluded', (await ownSearch('WrongHumanAuthor')).items.length === 0);
  const revoked = await chat();
  await text(revoked, 'ModuleProtected', { scope: { schema_version: 1, module_routes: ['/ai35-search-domain'] } });
  check('module-restricted message text is absent without current assignment', (await ownSearch('ModuleProtected')).items.length === 0);
  await db.query("INSERT INTO modules(key,link,module_group_id) SELECT 'ai35_scope_fixture','/ai35-search-domain',id FROM module_groups ORDER BY id LIMIT 1 ON CONFLICT DO NOTHING");
  await db.query("INSERT INTO user_modules(user_id,module_id) SELECT 1,id FROM modules WHERE key='ai35_scope_fixture'");
  check('a current destination module assignment enables its text', ids(await ownSearch('ModuleProtected')).includes(revoked));
  await db.query("UPDATE user_modules SET is_active=false WHERE user_id=1 AND module_id=(SELECT id FROM modules WHERE key='ai35_scope_fixture')");
  check('revocation removes search matches immediately on the next page request', (await ownSearch('ModuleProtected')).items.length === 0);
  for (const [label, scope] of [
    ['extra_key', { schema_version: 1, module_routes: [], extra: true }],
    ['wrong_version', { schema_version: 2, module_routes: [] }],
    ['string_routes', { schema_version: 1, module_routes: '/finance' }],
    ['object_routes', { schema_version: 1, module_routes: {} }],
    ['null_routes', { schema_version: 1, module_routes: null }],
    ['non_string_route', { schema_version: 1, module_routes: [1] }],
    ['overlong_routes', { schema_version: 1, module_routes: Array(65).fill('/nodia-ai') }],
  ]) {
    const invalid = await chat();
    await text(invalid, 'MalformedScope' + label, { scope });
    check('malformed source manifest is excluded without SQL failure: ' + label, (await ownSearch('MalformedScope' + label)).items.length === 0);
  }
  const another = await chat('2', 'ForeignOnlyMarker');
  await text(another, 'ForeignMessageMarker', { author: '2' });
  check('ordinary search excludes foreign titles and messages', (await ownSearch('Foreign')).items.length === 0);
  await assert.rejects(list.execute(identity, { view: 'all' }), /capability_denied/);
  check('ordinary all scope is rejected');
  check('super_admin still defaults to own conversations', (await list.execute(admin, { search: 'Foreign' })).items.length === 0);
  const inspected = await list.execute(admin, { view: 'all', owner_user_id: '2', search: 'Foreign' });
  check('explicit super_admin foreign search remains read-only', inspected.items.length === 1 && inspected.items[0].read_only);
  check('foreign inspection is audited without message content', (await db.query("SELECT count(*)::int n FROM nodia_ai_audit_events WHERE conversation_id=$1 AND event_key='conversation.inspected'", [another]))[0].n > 0);
  const expired = await chat('1', 'ExpiredMarker'), expiring = await chat('1', 'ExpiringMarker');
  await text(expired, 'ExpiredBody'); await text(expiring, 'ExpiringBody');
  await db.query("UPDATE nodia_ai_conversations SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1", [expired]);
  await db.query("UPDATE nodia_ai_conversations SET lifecycle='expiring' WHERE id=$1", [expiring]);
  check('expired title and body disappear before a scheduler purge', (await ownSearch('Expired')).items.length === 0);
  check('expiring title and body disappear before a scheduler purge', (await ownSearch('Expiring')).items.length === 0);
  const organized = await chat('1', 'OrganizedMarker');
  const before = (await db.query('SELECT expires_at,last_owner_message_at FROM nodia_ai_conversations WHERE id=$1', [organized]))[0];
  const changed = await update.execute(identity, organized, { expected_conversation_revision: 1, title: 'RenamedMarker', is_archived: true, is_pinned: true });
  check('rename, pin and archive share one optimistic revision', changed.title === 'RenamedMarker' && changed.is_archived && changed.is_pinned && changed.revision === 2);
  check('archived false filter excludes archived matches', (await ownSearch('RenamedMarker', { is_archived: false })).items.length === 0);
  check('explicit archived and pinned filters include the changed chat', ids(await ownSearch('RenamedMarker', { is_archived: true, is_pinned: true })).includes(organized));
  const after = (await db.query('SELECT expires_at,last_owner_message_at FROM nodia_ai_conversations WHERE id=$1', [organized]))[0];
  check('organization never renews retention', after.expires_at.getTime() === before.expires_at.getTime() && after.last_owner_message_at === null);
  await assert.rejects(update.execute(identity, organized, { expected_conversation_revision: 1, title: 'Stale' }), /revision_conflict/);
  check('stale organization revision is rejected');
  await assert.rejects(update.execute(admin, organized, { expected_conversation_revision: 2, title: 'Impersonation' }), /capability_denied/);
  check('super_admin inspection does not impersonate the owner for organization');
  await assert.rejects(update.execute(identity, expired, { expected_conversation_revision: 1, title: 'Expired mutation' }), /conversation_expired/);
  check('expired chat organization is rejected');
  const tieIds = [];
  for (let i = 0; i < 4; i++) {
    const id = await chat('1', 'CursorMarker ' + i); tieIds.push(id);
    await db.query("UPDATE nodia_ai_conversations SET updated_at='2026-10-15T10:00:00.123456Z'::timestamptz + ($2::int * interval '1 microsecond') WHERE id=$1", [id, i % 2]);
  }
  const expected = (await db.query("SELECT id FROM nodia_ai_conversations WHERE id=ANY($1::uuid[]) ORDER BY updated_at DESC,id DESC", [tieIds])).map(row => row.id);
  const all = []; let cursor;
  do { const page = await ownSearch('CursorMarker', { page_limit: 1, ...(cursor ? { cursor } : {}) }); all.push(...ids(page)); cursor = page.next_cursor; } while (cursor);
  check('cursor pagination preserves microseconds and UUID ties without duplicates', JSON.stringify(all) === JSON.stringify(expected));
  const first = await ownSearch('CursorMarker', { page_limit: 1 });
  const forged = JSON.parse(Buffer.from(first.next_cursor, 'base64url').toString('utf8'));
  forged.position[0] = '2026-02-31T10:00:00.123456Z';
  await assert.rejects(ownSearch('CursorMarker', { cursor: Buffer.from(JSON.stringify(forged)).toString('base64url') }), /invalid_cursor/);
  check('an impossible calendar date is rejected before PostgreSQL casting');
  for (const query of [{ search: 'RenamedMarker' }, { search: 'CursorMarker', is_archived: false }, { search: 'CursorMarker', is_pinned: true }]) {
    await assert.rejects(list.execute(identity, { ...query, cursor: first.next_cursor }), /invalid_cursor/);
  }
  check('a cursor is bound to search and organization filters');
  await assert.rejects(list.execute(foreign, { search: 'CursorMarker', cursor: first.next_cursor }), /invalid_cursor/);
  check('a cursor cannot be reused by a different actor');
  await db.query('UPDATE auth_sessions SET revoked_at=clock_timestamp() WHERE public_id=$1', [identity.sessionId]);
  await assert.rejects(ownSearch('CursorMarker', { cursor: first.next_cursor }), /session_expired/);
  check('current session revocation is checked before cursor results');
  await db.query('UPDATE auth_sessions SET revoked_at=NULL WHERE public_id=$1', [identity.sessionId]);

  const migration = new SearchMigration();
  check('the AI35 migration installs its text index in public', (await db.query("SELECT to_regclass('public.ix_nodia_ai_message_parts_text_search')::text name"))[0].name !== null);
  check('the available pg_trgm extension is trusted', (await db.query("SELECT bool_and(trusted) trusted FROM pg_available_extension_versions WHERE name='pg_trgm'"))[0].trusted === true);
  await db.transaction(manager => migration.down(manager.queryRunner));
  check('down removes only its index and retains the shared extension', (await db.query("SELECT to_regclass('public.ix_nodia_ai_message_parts_text_search')::text index,(SELECT count(*)::int FROM pg_extension WHERE extname='pg_trgm') extensions"))[0].index === null && (await db.query("SELECT count(*)::int n FROM pg_extension WHERE extname='pg_trgm'"))[0].n === 1);
  // The disposable DB has no other extension consumers; verify a least-privilege extension installation.
  await db.query('DROP EXTENSION pg_trgm');
  await db.query('CREATE ROLE ai35_extension_owner NOSUPERUSER NOCREATEDB NOCREATEROLE');
  await db.query('GRANT CREATE ON DATABASE ai35 TO ai35_extension_owner');
  await db.transaction(async manager => {
    await manager.query('SET LOCAL ROLE ai35_extension_owner');
    await manager.query('CREATE EXTENSION pg_trgm WITH SCHEMA public');
  });
  const [installer] = await db.query("SELECT r.rolsuper,e.extowner=r.oid owned FROM pg_extension e JOIN pg_roles r ON r.rolname='ai35_extension_owner' WHERE e.extname='pg_trgm'");
  check('a nonsuperuser with database CREATE can install trusted pg_trgm', installer.owned === true && installer.rolsuper === false);
  await db.query('CREATE SCHEMA ai35_extension_namespace');
  await db.query('ALTER EXTENSION pg_trgm SET SCHEMA ai35_extension_namespace');
  await assert.rejects(db.transaction(manager => migration.up(manager.queryRunner)), /requires pg_trgm installed in schema public/);
  check('a shared extension in another schema is rejected without moving it', (await db.query("SELECT n.nspname FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='pg_trgm'"))[0].nspname === 'ai35_extension_namespace');
  await db.query('ALTER EXTENSION pg_trgm SET SCHEMA public');

  // 20k conversations / 200k text parts: roughly 80MiB searchable synthetic text, below one-owner 500MiB quota.
  await db.query(`INSERT INTO nodia_ai_conversations(id,owner_id,client_request_id,title,expires_at,creation_request_hash,updated_at,is_archived,is_pinned)
    SELECT md5('ai35-chat-'||n)::uuid,CASE WHEN n<=10000 THEN 1 ELSE 2 END,md5('ai35-request-'||n)::uuid,
      CASE WHEN n=9123 THEN 'RareTitleBenchmark' ELSE 'Synthetic volume conversation '||n END,
      clock_timestamp()+interval '30 days',repeat('d',64),clock_timestamp()-(n * interval '1 microsecond'),n%5=0,n%7=0
    FROM generate_series(1,20000) n`);
  await db.query(`INSERT INTO nodia_ai_messages(id,conversation_id,seq,role,status,source_scope_manifest,sealed_at)
    SELECT md5('ai35-message-'||n)::uuid,md5('ai35-chat-'||((n-1)/10+1))::uuid,(n-1)%10+1,'assistant','sealed',
      '{"schema_version":1,"module_routes":[]}'::jsonb,clock_timestamp()
    FROM generate_series(1,200000) n`);
  await db.query(`INSERT INTO nodia_ai_message_parts(message_id,conversation_id,part_index,kind,text)
    SELECT id,conversation_id,0,'text',CASE WHEN seq=7 AND conversation_id=md5('ai35-chat-9123')::uuid THEN 'RareBodyBenchmark ' ELSE '' END ||
      repeat('Synthetic searchable message body with product information. ',7) FROM nodia_ai_messages WHERE id IN (SELECT md5('ai35-message-'||n)::uuid FROM generate_series(1,200000) n)`);
  await db.query('ANALYZE nodia_ai_conversations; ANALYZE nodia_ai_messages; ANALYZE nodia_ai_message_parts');
  const volume = (await db.query(`SELECT (SELECT count(*)::int FROM nodia_ai_conversations) conversations,(SELECT count(*)::int FROM nodia_ai_messages) messages,
    (SELECT count(*)::int FROM nodia_ai_message_parts) parts,(SELECT sum(octet_length(text))::bigint::text FROM nodia_ai_message_parts WHERE kind='text') text_bytes`))[0];
  const extractPlan = node => ({ node: node['Node Type'], relation: node['Relation Name'] ?? null, index: node['Index Name'] ?? null,
    rows: node['Actual Rows'], loops: node['Actual Loops'], shared_hit_blocks: node['Shared Hit Blocks'] ?? 0, shared_read_blocks: node['Shared Read Blocks'] ?? 0,
    ...(node.Plans ? { plans: node.Plans.map(extractPlan) } : {}) });
  const measure = async (query, correlated = false) => {
    await ownSearch(query); const captured = actualQueries.at(-1);
    if (correlated) {
      const previous = captured.query;
      captured.query = captured.query.replace('OR "c"."id" IN (', 'OR EXISTS (').replace("WHERE p.kind='text'", 'WHERE m.conversation_id="c"."id" AND p.kind=\'text\'');
      assert.notEqual(captured.query, previous);
    }
    const samples = [];
    for (let i = 0; i < 5; i++) {
      const [row] = await db.transaction(manager => manager.query('EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) ' + captured.query, captured.parameters));
      samples.push(row['QUERY PLAN'][0]);
    }
    const sorted = [...samples].sort((a, b) => a['Execution Time'] - b['Execution Time']);
    return { query_sha256: createHash('sha256').update(captured.query).digest('hex'), samples: samples.map(s => s['Execution Time']),
      median_execution_ms: sorted[2]['Execution Time'], planning_ms: sorted[2]['Planning Time'], plan: extractPlan(sorted[2].Plan) };
  };
  const profiles = ['RareBodyBenchmark', 'RareTitleBenchmark', 'AbsentBenchmarkPhrase', 'Synthetic', 'searchable message body', 'xy'];
  const beforeIndex = {};
  for (const query of profiles) beforeIndex[query] = await measure(query);
  await db.transaction(manager => migration.up(manager.queryRunner));
  await db.query('ANALYZE nodia_ai_message_parts');
  const afterIndex = {};
  for (const query of profiles) afterIndex[query] = await measure(query);
  const correlatedAfterIndex = {};
  for (const query of profiles) correlatedAfterIndex[query] = await measure(query, true);
  const [index] = await db.query("SELECT pg_relation_size('ix_nodia_ai_message_parts_text_search')::text bytes");
  const summary = Object.fromEntries(profiles.map(query => [query, { before_ms: beforeIndex[query].median_execution_ms, after_ms: afterIndex[query].median_execution_ms, ratio: afterIndex[query].median_execution_ms / beforeIndex[query].median_execution_ms }]));
  check('text search candidate index reduces rare body search median by at least half', summary.RareBodyBenchmark.ratio < 0.5);
  check('indexed search returns the real expected body match', (await ownSearch('RareBodyBenchmark')).items.length === 1);
  const [beforeRollback] = await db.query('SELECT count(*)::int parts FROM nodia_ai_message_parts');
  await db.transaction(manager => migration.down(manager.queryRunner));
  check('a populated index rollback preserves every message part', (await db.query('SELECT count(*)::int parts FROM nodia_ai_message_parts'))[0].parts === beforeRollback.parts);
  await db.transaction(manager => migration.up(manager.queryRunner));
  check('a populated index can be installed again with the shared extension intact', (await ownSearch('RareBodyBenchmark')).items.length === 1);
  const [database] = await db.query(`SELECT (SELECT count(*)::int FROM migrations) migrations,
    (SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'nodia_ai_%') nodia_ai_tables,
    (SELECT count(*)::int FROM information_schema.columns WHERE table_schema='public' AND table_name LIKE 'nodia_ai_%') nodia_ai_columns`);
  report = { task: 'AI-35', status: 'passed', scope: 'compiled_use_cases_disposable_postgresql16_synthetic_content', checks: checks.length, passed: checks, database,
    volume, measurements: { method: '5 warm EXPLAIN ANALYZE BUFFERS samples, planner defaults, actual compiled list query', before_index: beforeIndex, after_index: afterIndex, correlated_after_index: correlatedAfterIndex, summary,
      candidate_index: { name: 'ix_nodia_ai_message_parts_text_search', kind: 'partial_gin_pg_trgm_on_text', bytes: index.bytes } },
    configured_database_touched: false, providers_called: false, r2_called: false, services_restarted: false,
    cleanup: { disposable_postgresql_removed: false }, limitations: ['Synthetic laboratory corpus and warm-cache timings; no production percentiles or cold-disk guarantee.', 'Queries shorter than three characters have fewer useful trigrams and remain bounded by existing statement timeout.', 'Cursor order reflects current metadata; concurrent rename/pin/archive can move a chat between pages.'] };
} finally {
  await fixture.close();
}
report.cleanup.disposable_postgresql_removed = true;
console.log(JSON.stringify(report));
