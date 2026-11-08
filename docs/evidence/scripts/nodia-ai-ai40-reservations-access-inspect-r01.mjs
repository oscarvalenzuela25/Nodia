// OPERATOR ONLY. Read-only R07 authority/catalog inspection; no provider, seed or domain handler.
// Database options arrive through a private root-to-nodia stdin pipe and are never emitted.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = '/opt/nodia/releases/nodia-server-ai40-r07';
const RELEASE_SHA = '1799e821e6c2f668989a972fde26b162772e02e821ce9744fbe431894dfce476';
const ROUTE = '/tools/reservations';
const MODULE_KEY = 'rental_reservations';
const CAPABILITY = 'nodia_rental_properties_list';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const exact = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(value);
const catalogId = value => typeof value === 'string' && /^[1-9]\d{0,18}$/u.test(value)
  && BigInt(value) <= 9223372036854775807n;
let phase = 'input_contract', db, compiled;
const report = { schema: 'nodia-ai-ai40-reservations-access-inspection-v1', status: 'not_started',
  SQL_read_only: true, SQL_writes: 0, provider_requests: 0, provider_methods_invoked: [],
  domain_handler_invoked: false, profile_accessed_by_script: false, seed_executed: false,
  modules_permissions_or_configuration_changed: false, credentials_or_private_content_emitted: false };

try {
  let bytes = 0; const chunks = [];
  for await (const chunk of process.stdin) { bytes += chunk.length; assert.ok(bytes <= 16384); chunks.push(chunk); }
  const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  assert.ok(exact(input, ['schema_version', 'conversation_id', 'expected_owner_id', 'authority_run_id', 'database']));
  assert.equal(input.schema_version, 1);
  assert.ok(uuid(input.conversation_id) && uuid(input.authority_run_id) && catalogId(input.expected_owner_id));
  assert.ok(exact(input.database, ['host', 'port', 'database', 'username', 'password', 'ssl']));
  assert.equal(input.database.host, '127.0.0.1');
  assert.ok(Number.isSafeInteger(input.database.port) && input.database.port > 0 && input.database.port <= 65535);
  for (const key of ['database', 'username', 'password'])
    assert.ok(typeof input.database[key] === 'string' && input.database[key].length > 0
      && Buffer.byteLength(input.database[key]) <= 4096 && !/[\0\r\n]/u.test(input.database[key]));
  assert.equal(typeof input.database.ssl, 'boolean');
  phase = 'execution_environment';
  assert.equal(process.platform, 'linux'); assert.equal(process.getuid(), 10000);
  assert.equal(process.env.NODE_ENV, 'test'); assert.equal(process.env.DOTENV_CONFIG_PATH, '/dev/null');
  assert.equal(process.env.RATE_LIMIT_STORAGE, 'memory');
  // Required only for DI configuration. No JWT is minted and no identity is inferred from these values.
  process.env.AUTH_JWT_SECRET = randomUUID() + randomUUID();
  process.env.GOOGLE_CLIENT_ID = 'synthetic-ai40.apps.googleusercontent.com';
  process.env.AUTH_ALLOWED_ORIGINS = 'http://127.0.0.1';
  const require = createRequire(join(ROOT, 'package.json'));
  require('reflect-metadata'); require('@nestjs/common').Logger.overrideLogger(false);
  phase = 'pinned_release_and_publication';
  const releaseBytes = await readFile(join(ROOT, 'release-manifest.json'));
  assert.equal(sha(releaseBytes), RELEASE_SHA);
  const release = JSON.parse(releaseBytes);
  const pinned = async path => {
    const value = await readFile(join(ROOT, path));
    assert.equal(sha(value), release.files[path]);
    return value;
  };
  const load = async (path, name) => {
    await pinned('dist/' + path + '.js');
    return (await import(pathToFileURL(join(ROOT, 'dist', path + '.js'))))[name];
  };
  const knowledgeBytes = await pinned('dist/nodia-ai/knowledge/manifest.json');
  const knowledge = JSON.parse(knowledgeBytes);
  const rentalContracts = knowledge.capability_contracts.filter(cap => cap.required_module_routes.includes(ROUTE));
  const matches = rentalContracts.filter(cap => cap.capability_id === CAPABILITY);
  assert.equal(matches.length, 1);
  const capability = matches[0];
  assert.equal(capability.kind, 'read'); assert.equal(capability.publication, 'published');
  assert.deepEqual(capability.required_module_routes, [ROUTE]);
  const schemaBytes = await pinned('dist/nodia-ai-products/contracts/reservations.schema.json');
  assert.equal(sha(schemaBytes), capability.input_schema.sha256);
  assert.equal(sha(schemaBytes), capability.output_schema.sha256);
  const compileNodiaAiToolSchema = await load('nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case', 'compileNodiaAiToolSchema');
  const candidateArguments = { query: { active: 'all', page: 1, limit: 1 } };
  const validator = compileNodiaAiToolSchema({ sourceJson: schemaBytes.toString('utf8'),
    definition: capability.input_schema.definition, sha256: sha(schemaBytes) });
  assert.equal(validator.validate(candidateArguments), true);
  const { DataSource } = require('typeorm');
  const options = { type: 'postgres', ...input.database, ssl: input.database.ssl ? { rejectUnauthorized: false } : undefined,
    synchronize: false, migrationsRun: false, installExtensions: false, logging: false,
    entities: [ROOT + '/dist/**/*.entity.js'],
    extra: { max: 2, connectionTimeoutMillis: 5000, statement_timeout: 5000,
      options: '-c default_transaction_read_only=on' } };
  phase = 'read_only_database_and_compiled_discovery';
  db = await new DataSource(options).initialize();
  const [Conversation, Processing, Runtime, Users, Redis, Authorize, Discovery] = await Promise.all([
    ['nodia-ai-conversation/nodia-ai-conversation.module', 'NodiaAiConversationModule'],
    ['nodia-ai-context/nodia-ai-processing.module', 'NodiaAiProcessingModule'],
    ['nodia-ai-runtime/nodia-ai-runtime.module', 'NodiaAiRuntimeModule'], ['user/user.module', 'UserModule'],
    ['common/redis/redis.service', 'RedisService'], ['nodia-ai/use-case/authorize-nodia-ai.use-case', 'AuthorizeNodiaAiUseCase'],
    ['nodia-ai-tools/use-case/discover-nodia-ai-tools.use-case', 'DiscoverNodiaAiToolsUseCase'],
  ].map(([path, name]) => load(path, name)));
  const { Test } = require('@nestjs/testing'), { TypeOrmModule } = require('@nestjs/typeorm');
  compiled = await Test.createTestingModule({ imports: [TypeOrmModule.forRootAsync({
    useFactory: () => options, dataSourceFactory: async () => db }), Conversation, Processing, Runtime, Users] })
    .overrideProvider(Redis).useValue({ get: async () => null, set: async () => {}, del: async () => {}, keys: async () => [] })
    .setLogger(false).compile();
  // compile(), not init(): no lifecycle startup, worker, provider observation or socket is requested.
  const authorize = compiled.get(Authorize), discovery = compiled.get(Discovery);
  phase = 'current_authority_route_and_discovery_snapshot';
  const snapshot = await db.transaction('REPEATABLE READ', async manager => {
    await manager.query('SET TRANSACTION READ ONLY');
    const [mode] = await manager.query('SHOW transaction_read_only'); assert.equal(mode.transaction_read_only, 'on');
    const [chat] = await manager.query('SELECT owner_id::text,active_job_id FROM nodia_ai_conversations WHERE id=$1', [input.conversation_id]);
    assert.equal(chat?.owner_id, input.expected_owner_id);
    const identities = await manager.query(`SELECT g.session_public_id::text FROM nodia_ai_execution_grants g
      JOIN nodia_ai_runs r ON r.id=g.run_id WHERE r.id=$1 AND r.conversation_id=$2
      AND r.actor_id=$3 AND g.actor_id=$3 LIMIT 2`, [input.authority_run_id, input.conversation_id, input.expected_owner_id]);
    assert.equal(identities.length, 1); assert.ok(uuid(identities[0].session_public_id));
    const identity = { userId: input.expected_owner_id, sessionId: identities[0].session_public_id };
    const actor = await authorize.execute(identity, {}, manager);
    assert.equal(actor.isSuperAdmin, true, 'This aggregate-only operator requires the current own super_admin actor');
    const moduleRows = await manager.query(`SELECT m.id::text,m.key,m.link,m.is_active,m.module_group_id::text,
      g.key AS group_key,g.is_active AS group_active,
      EXISTS(SELECT 1 FROM user_modules um WHERE um.user_id=$1 AND um.module_id=m.id AND um.is_active) AS explicitly_assigned
      FROM modules m LEFT JOIN module_groups g ON g.id=m.module_group_id
      WHERE m.link=$2 OR m.key=ANY($3::text[]) OR m.link ILIKE '%reservation%' OR m.link ILIKE '%rental%'
      ORDER BY m.id LIMIT 33`, [actor.actorId, ROUTE, [MODULE_KEY, 'reservas', 'reservations']]);
    assert.ok(moduleRows.length <= 32, 'Module candidate metadata exceeded the closed diagnostic bound');
    const exactRows = moduleRows.filter(row => row.link === ROUTE);
    const activeExact = exactRows.filter(row => row.is_active && row.group_active);
    let targetAllowed = false, denial = null;
    try { await authorize.execute(identity, { moduleRoutes: [ROUTE] }, manager); targetAllowed = true; }
    catch (error) {
      assert.equal(error.getStatus?.(), 403);
      assert.equal(error.getResponse?.()?.message ?? error.message, 'nodia_ai:capability_denied');
      denial = { http_status: 403, code: 'nodia_ai:capability_denied' };
    }
    assert.equal(targetAllowed, actor.modules.some(module => module.route === ROUTE));
    const routes = actor.modules.map(module => module.route);
    const visible = await discovery.visible(manager, actor, routes);
    const visibleRental = visible.filter(tool => tool.requiredModuleRoutes.includes(ROUTE));
    const search = await discovery.execute(manager, actor, routes, 'search', { module_key: MODULE_KEY }, undefined, undefined, true);
    assert.ok(Array.isArray(search.items));
    if (!targetAllowed) { assert.equal(visibleRental.length, 0); assert.equal(search.items.length, 0); }
    const [storage] = await manager.query("SELECT to_regclass('public.rental_properties') IS NOT NULL AS rental_properties");
    let propertyCount = null, counted = false;
    // No domain rows or COUNT are read until current destination authority has succeeded.
    if (targetAllowed && storage.rental_properties) {
      await authorize.execute(identity, { moduleRoutes: [ROUTE] }, manager);
      [{ total: propertyCount }] = await manager.query('SELECT count(*)::text AS total FROM rental_properties');
      counted = true;
    }
    const reason = targetAllowed ? (storage.rental_properties ? null : 'rental_storage_missing')
      : exactRows.length === 0 ? (moduleRows.length ? 'route_mismatch_or_related_key_only' : 'module_missing')
        : activeExact.length > 1 ? 'ambiguous_active_route' : activeExact.length === 0 ? 'module_or_group_inactive' : 'current_authority_denied';
    const [pending] = await manager.query(`SELECT
      (SELECT count(*)::int FROM nodia_ai_jobs WHERE state IN ('ready','leased','unknown','waiting')) jobs,
      (SELECT count(*)::int FROM nodia_ai_job_attempts WHERE ended_at IS NULL) open_attempts,
      (SELECT count(*)::int FROM nodia_ai_runtime_slots WHERE state<>'free') retained_slots`);
    return { conversation_id: input.conversation_id, authority_run_id: input.authority_run_id,
      actor: { id: actor.actorId, is_super_admin: true, active_session_revalidated: true, session_identifier_emitted: false },
      module_rows: moduleRows, exact_route_rows: exactRows.length, active_exact_route_rows: activeExact.length,
      allowed_by_current_backend: targetAllowed, denial, blocker: reason,
      discovery: { compiled_real: true, handler_executed: false, published_contracts_for_route: rentalContracts.length,
        visible_registered_rental_tools: visibleRental.map(tool => tool.toolName).sort(),
        catalog_search: { catalog_version: search.catalog_version, items: search.items,
          has_next_page: search.next_cursor !== null, catalog_only: true } },
      storage_exists: storage, rental_properties_total: propertyCount, rental_count_query_executed: counted, pending };
  });
  Object.assign(report, snapshot, { status: 'observed_read_only',
    release_root: ROOT, release_manifest_sha256: RELEASE_SHA,
    publication: { knowledge_release: knowledge.release_id, manifest_sha256: sha(knowledgeBytes),
      capability_id: CAPABILITY, required_module_routes: capability.required_module_routes,
      input_schema_sha256: sha(schemaBytes), input_definition: capability.input_schema.definition,
      candidate_arguments: candidateArguments, candidate_arguments_valid: true },
    seed_contract: { command: 'npm run seed:rental', entrypoint: 'nodia-server/scripts/seed-rental-reservations.mjs',
      use_case: 'nodia-server/src/rental-navigation/use-case/seed-rental-navigation.use-case.ts',
      writer: 'nodia-server/src/rental-navigation/rental-navigation.service.ts', executed: false,
      preserves_existing_different_key_at_route_by_runbook_precondition: true },
    diagnostic_DI_redis_event_bus_synthetic: true, execution_authorization_granted: false,
    limits: ['Read-only point-in-time snapshot, not a persistent grant, real Codex inference or execution acceptance.',
      'Discovery uses the real registry/manifest and current SQL authority; no tool handler, seed or domain writer is invoked.',
      'A physical table or published contract cannot replace the destination module required by AI-07, including for super_admin.',
      'Existing key reservas at the exact route is compatible with the documented installation; do not seed by missing canonical key alone.'] });
} catch (error) {
  const response = typeof error?.getResponse === 'function' ? error.getResponse() : null;
  const code = typeof response?.message === 'string' ? response.message : error?.code ?? error?.message;
  const approved = ['nodia_ai:capability_denied', 'nodia_ai:resource_not_found', 'auth:session_expired'];
  Object.assign(report, { status: 'inspection_failed', failure_phase: phase,
    error_class: ['AssertionError', 'Error', 'ForbiddenException', 'UnauthorizedException', 'QueryFailedError', 'TypeError', 'SyntaxError'].includes(error?.name) ? error.name : 'unclassified',
    error_code: approved.includes(code) ? code : null, generation_retry_allowed: false });
  process.exitCode = 1;
} finally {
  if (compiled) await compiled.close().catch(() => {});
  if (db?.isInitialized) await db.destroy().catch(() => {});
}
console.log(JSON.stringify(report));
