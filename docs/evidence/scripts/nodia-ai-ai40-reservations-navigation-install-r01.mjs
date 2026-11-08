// OPERATOR ONLY: one compiled R07 navigation seed, never a migration, SDK or application bootstrap.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const ROOT = '/opt/nodia/releases/nodia-server-ai40-r07';
const MANIFEST = '1799e821e6c2f668989a972fde26b162772e02e821ce9744fbe431894dfce476';
const ROUTE = '/tools/reservations', KEY = 'rental_reservations';
const sha = value => createHash('sha256').update(value).digest('hex');
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(value);
const id = value => typeof value === 'string' && /^[1-9]\d{0,18}$/u.test(value) && BigInt(value) <= 9223372036854775807n;
const domains = ['rental_properties', 'rental_collaborators', 'rental_cancellation_policies', 'rental_cancellation_rules',
  'rental_reservations', 'rental_payments', 'rental_expenses', 'rental_blocks', 'rental_turnovers', 'rental_audit_events', 'rental_operations'];
let db, phase = 'input', seedInvocations = 0;
const report = { schema: 'nodia-ai-ai40-reservations-navigation-install-child-v1', status: 'failed',
  provider_requests: 0, SDK_methods: 0, migrations_executed: false, automatic_retry_allowed: false,
  services_changed_by_child: false, private_content_emitted: false };
try {
  let size = 0; const chunks = [];
  for await (const chunk of process.stdin) { size += chunk.length; assert.ok(size <= 16384); chunks.push(chunk); }
  const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  assert.ok(exact(input, ['schema_version', 'mode', 'conversation_id', 'expected_owner_id', 'authority_run_id', 'database']));
  assert.equal(input.schema_version, 1); assert.ok(['preflight', 'install'].includes(input.mode));
  assert.ok(uuid(input.conversation_id) && uuid(input.authority_run_id) && id(input.expected_owner_id));
  assert.ok(exact(input.database, ['host', 'port', 'database', 'username', 'password', 'ssl']));
  assert.equal(input.database.host, '127.0.0.1'); assert.equal(typeof input.database.ssl, 'boolean');
  assert.ok(Number.isInteger(input.database.port) && input.database.port > 0 && input.database.port <= 65535);
  for (const key of ['database', 'username', 'password']) assert.ok(typeof input.database[key] === 'string'
    && input.database[key].length > 0 && Buffer.byteLength(input.database[key]) <= 4096 && !/[\0\r\n]/u.test(input.database[key]));
  assert.equal(process.platform, 'linux'); assert.equal(process.getuid(), 10000);
  assert.equal(process.env.NODE_ENV, 'test'); assert.equal(process.env.DOTENV_CONFIG_PATH, '/dev/null');
  const require = createRequire(ROOT + '/package.json'); require('reflect-metadata');
  require('@nestjs/common').Logger.overrideLogger(false);
  const bytes = await readFile(ROOT + '/release-manifest.json'); assert.equal(sha(bytes), MANIFEST);
  const files = JSON.parse(bytes).files;
  const load = async (path, name) => {
    const file = 'dist/' + path + '.js'; assert.equal(sha(await readFile(ROOT + '/' + file)), files[file]);
    return (await import(pathToFileURL(ROOT + '/' + file)))[name];
  };
  const [Seed, Navigation, Authorization, Authorize] = await Promise.all([
    ['rental-navigation/use-case/seed-rental-navigation.use-case', 'SeedRentalNavigationUseCase'],
    ['rental-navigation/rental-navigation.service', 'RentalNavigationService'],
    ['nodia-ai/nodia-ai-authorization.service', 'NodiaAiAuthorizationService'],
    ['nodia-ai/use-case/authorize-nodia-ai.use-case', 'AuthorizeNodiaAiUseCase'],
  ].map(([path, name]) => load(path, name)));
  const { DataSource } = require('typeorm');
  db = await new DataSource({ type: 'postgres', ...input.database,
    ssl: input.database.ssl ? { rejectUnauthorized: false } : undefined, entities: [],
    synchronize: false, migrationsRun: false, installExtensions: false, logging: false,
    extra: { max: 1, connectionTimeoutMillis: 5000, statement_timeout: 5000,
      ...(input.mode === 'preflight' ? { options: '-c default_transaction_read_only=on' } : {}) } }).initialize();
  const authorize = new Authorize(new Authorization(db));
  const authority = async (moduleRoutes = []) => {
    const rows = await db.query(`SELECT g.session_public_id::text FROM nodia_ai_execution_grants g
      JOIN nodia_ai_runs r ON r.id=g.run_id JOIN nodia_ai_conversations c ON c.id=r.conversation_id
      WHERE r.id=$1 AND c.id=$2 AND c.owner_id=$3 AND r.actor_id=$3 AND g.actor_id=$3 LIMIT 2`,
    [input.authority_run_id, input.conversation_id, input.expected_owner_id]);
    assert.equal(rows.length, 1); assert.ok(uuid(rows[0].session_public_id));
    const actor = await authorize.execute({ userId: input.expected_owner_id, sessionId: rows[0].session_public_id }, { moduleRoutes });
    assert.equal(actor.isSuperAdmin, true); return actor;
  };
  const snapshot = async () => {
    const [modules, groups, translations] = await Promise.all(['modules', 'module_groups', 'translations'].map(async table => {
      const where = table === 'translations' ? " WHERE source_entity IN ('modules','module_groups')" : '';
      const fields = table === 'modules' ? "'id',id::text,'module_group_id',module_group_id::text"
        : table === 'translations' ? "'id',id::text,'source_id',source_id::text" : "'id',id::text";
      const rows = await db.query(`SELECT to_jsonb(t)||jsonb_build_object(${fields}) AS row FROM ${table} t${where} ORDER BY id LIMIT 20001`);
      assert.ok(rows.length <= 20000); return rows.map(value => value.row);
    }));
    const assignments = {};
    for (const table of ['user_modules', 'user_roles', 'role_actions']) {
      const [value] = await db.query(`SELECT count(*)::text AS count,md5(COALESCE(string_agg(to_jsonb(t)::text,E'\\n' ORDER BY id),'')) AS hash FROM ${table} t`);
      assignments[table] = value;
    }
    const counts = {};
    for (const table of domains) [{ count: counts[table] }] = await db.query(`SELECT count(*)::text AS count FROM ${table}`);
    const [pending] = await db.query(`SELECT (SELECT count(*)::int FROM nodia_ai_jobs WHERE state IN ('ready','leased','unknown','waiting')) jobs,
      (SELECT count(*)::int FROM nodia_ai_job_attempts WHERE ended_at IS NULL) attempts,
      (SELECT count(*)::int FROM nodia_ai_runtime_slots WHERE state<>'free') slots`);
    assert.deepEqual(pending, { jobs: 0, attempts: 0, slots: 0 });
    return { modules, groups, translations, assignments, domain_counts: counts, pending };
  };
  phase = 'preconditions'; await authority(); const before = await snapshot();
  assert.equal(before.modules.filter(row => row.link === ROUTE || row.key === KEY).length, 0);
  const groups = before.groups.filter(row => row.key === 'tools'); assert.equal(groups.length, 1); assert.equal(groups[0].is_active, true);
  Object.assign(report, { mode: input.mode, actor_id: input.expected_owner_id, current_super_admin_authority_verified: true,
    before_sha256: sha(JSON.stringify(before)), before_counts: { modules: before.modules.length, groups: before.groups.length,
      translations: before.translations.length }, assignments_before: before.assignments, domain_counts_before: before.domain_counts });
  if (input.mode === 'install') {
    phase = 'compiled_seed'; seedInvocations++; const ids = await new Seed(db, new Navigation()).execute();
    phase = 'postconditions'; const after = await snapshot();
    const added = after.modules.filter(row => !before.modules.some(old => old.id === row.id)); assert.equal(added.length, 1);
    const addedModule = added[0]; assert.equal(String(addedModule.id), String(ids.module_id)); assert.equal(String(ids.group_id), String(groups[0].id));
    assert.equal(addedModule.key, KEY); assert.equal(addedModule.link, ROUTE); assert.equal(addedModule.is_active, true);
    assert.equal(String(addedModule.module_group_id), String(groups[0].id)); assert.equal(addedModule.icon, 'HolidayVillageOutlined');
    assert.deepEqual(after.modules.filter(row => row.id !== addedModule.id), before.modules); assert.deepEqual(after.groups, before.groups);
    assert.deepEqual(after.assignments, before.assignments); assert.deepEqual(after.domain_counts, before.domain_counts);
    const expectedTranslations = [['module_groups', String(groups[0].id), 'Tools', 'Tools'], ['modules', String(ids.module_id), 'Reservas de alojamiento', 'Rental reservations']]
      .flatMap(([entity, source, es, en]) => [['es', es], ['en', en]].map(([locale, value]) => ({ source_entity: entity, source_id: source, source_key: 'key', locale, value, is_active: true })))
      .filter(value => !before.translations.some(old => ['source_entity', 'source_id', 'source_key', 'locale'].every(key => String(old[key]) === String(value[key]))));
    assert.deepEqual(after.translations.filter(row => before.translations.some(old => old.id === row.id)), before.translations);
    const addedTranslations = after.translations.filter(row => !before.translations.some(old => old.id === row.id));
    const project = row => Object.fromEntries(['source_entity', 'source_id', 'source_key', 'locale', 'value', 'is_active'].map(key => [key, key === 'source_id' ? String(row[key]) : row[key]]));
    const sort = rows => rows.map(project).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    assert.deepEqual(sort(addedTranslations), sort(expectedTranslations)); await authority([ROUTE]);
    Object.assign(report, { status: 'installed_verified', ids, after_sha256: sha(JSON.stringify(after)),
      after_counts: { modules: after.modules.length, groups: after.groups.length, translations: after.translations.length },
      new_modules: 1, added_translations: addedTranslations.length, existing_navigation_preserved: true,
      assignments_unchanged: true, domain_counts_unchanged: true, pending: after.pending });
  } else report.status = 'preflight_passed';
} catch (error) {
  Object.assign(report, { failure_phase: phase, error_class: ['AssertionError', 'QueryFailedError', 'ForbiddenException', 'UnauthorizedException'].includes(error?.name) ? error.name : 'unclassified',
    result_uncertain_or_requires_inspection: seedInvocations > 0 }); process.exitCode = 1;
} finally {
  report.compiled_seed_invocations = seedInvocations;
  if (db?.isInitialized) await db.destroy().catch(() => { report.database_cleanup_failed = true; process.exitCode = 1; });
}
console.log(JSON.stringify(report));
