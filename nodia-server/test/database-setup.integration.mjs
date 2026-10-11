// Real compiled cases and PostgreSQL16; no configured DB, Redis, AI accounts or storage.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { DataSource } from 'typeorm';

// Isolate config before compiled application imports; never load the workspace .env.
process.env.DOTENV_CONFIG_PATH =
  process.platform === 'win32' ? 'NUL' : '/dev/null';
process.env.NODE_ENV = 'test';
process.env.RATE_LIMIT_STORAGE = 'memory';
process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL = 'synthetic-owner@example.com';
const { SeedAuthUseCase } =
  await import('../dist/auth/use-case/seed-auth.use-case.js');
const { TranslationService } =
  await import('../dist/translation/translation.service.js');
const { Translation } =
  await import('../dist/translation/entities/translation.entity.js');
const { envs } = await import('../dist/config/envs.config.js');
const { InitialCoreSchema1789257400000 } =
  await import('../dist/migrations/1789257400000-InitialCoreSchema.js');
const { InitialBusinessAiSchema1789257500000 } =
  await import('../dist/migrations/1789257500000-InitialBusinessAiSchema.js');

const container = `nodia_database_setup_${process.pid}_${randomBytes(4).toString('hex')}`;
const password = randomBytes(20).toString('hex');
const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
const connections = [];
let started = false,
  checks = 0;
function check(value, message) {
  assert.ok(value, message);
  checks++;
}
const noCache = { async delByPattern() {} };

try {
  docker(
    'run',
    '-d',
    '--rm',
    '--name',
    container,
    '-e',
    'POSTGRES_USER=install_test',
    '-e',
    `POSTGRES_PASSWORD=${password}`,
    '-e',
    'POSTGRES_DB=install_test',
    '-p',
    '127.0.0.1::5432',
    'postgres:16-alpine',
  );
  started = true;
  for (let attempt = 0; attempt < 80; attempt++) {
    try {
      docker(
        'exec',
        container,
        'pg_isready',
        '-h',
        '127.0.0.1',
        '-U',
        'install_test',
      );
      break;
    } catch (error) {
      if (attempt === 79) throw error;
      await delay(250);
    }
  }
  const options = {
    type: 'postgres',
    host: '127.0.0.1',
    port: Number(docker('port', container, '5432/tcp').split(':').at(-1)),
    username: 'install_test',
    password,
    database: 'install_test',
    synchronize: false,
    logging: false,
    entities: [
      fileURLToPath(new URL('../dist/**/*.entity.js', import.meta.url)),
    ],
    migrations: [
      fileURLToPath(new URL('../dist/migrations/*.js', import.meta.url)),
    ],
  };
  const db = new DataSource(options);
  connections.push(db);
  await db.initialize();
  const executed = await db.runMigrations();
  check(
    executed.length === 18,
    'All18 migrations install on a truly empty database',
  );
  check(
    (await db.runMigrations()).length === 0,
    'A repeated migration run is inert',
  );
  const inspection = db.createQueryRunner();
  let tables;
  try {
    tables = await inspection.getTables();
  } finally {
    await inspection.release();
  }
  for (const metadata of db.entityMetadatas) {
    const table = tables.find((value) => value.name === metadata.tableName);
    assert.ok(table, `Missing entity table: ${metadata.tableName}`);
    for (const column of metadata.columns)
      assert.ok(
        table.columns.find((value) => value.name === column.databaseName),
        `Missing column: ${metadata.tableName}.${column.databaseName}`,
      );
  }
  check(
    db.entityMetadatas.length === 39,
    'All39 entity tables and their columns exist',
  );
  const [initial] =
    await db.query(`SELECT (SELECT count(*)::int FROM roles WHERE key='super_admin') AS roles,
    (SELECT count(*)::int FROM module_groups WHERE key='general_settings') AS groups,
    (SELECT count(*)::int FROM modules) AS modules,(SELECT count(*)::int FROM users) AS users,
    (SELECT count(*)::int FROM ai_api_keys) AS keys,(SELECT count(*)::int FROM ai_providers) AS connections`);
  check(
    initial.roles === 1 &&
      initial.groups === 1 &&
      initial.modules === 4 &&
      initial.users === 0 &&
      initial.keys === 0 &&
      initial.connections === 0,
    'Migrations create Core defaults but never accounts or credentials',
  );
  const catalog = await db.query(
    'SELECT key,can_use_api_key,can_use_token_plan_web,can_use_token_plan_agentic FROM ai_provider_catalog ORDER BY key',
  );
  check(
    catalog.length === 17 &&
      ['gemini', 'openai', 'anthropic', 'mistral', 'moonshot'].every((key) =>
        catalog.some((value) => value.key === key),
      ),
    'Catalog preserves16 providers and adds Kimi',
  );
  const kimi = catalog.find((value) => value.key === 'moonshot');
  const openai = catalog.find((value) => value.key === 'openai');
  check(
    !kimi.can_use_api_key &&
      !kimi.can_use_token_plan_web &&
      !kimi.can_use_token_plan_agentic &&
      openai.can_use_api_key &&
      openai.can_use_token_plan_agentic &&
      !openai.can_use_token_plan_web,
    'Catalog does not invent Kimi integrations or change OpenAI modes',
  );
  const seed = () =>
    new SeedAuthUseCase(
      db,
      new TranslationService(db.getRepository(Translation)),
      noCache,
    );
  const [first, concurrent] = await Promise.all([
    seed().bootstrap(),
    seed().bootstrap(),
  ]);
  check(
    first.super_admin_email === concurrent.super_admin_email,
    'Concurrent bootstrap for the same identity is idempotent',
  );
  const [counts] =
    await db.query(`SELECT (SELECT count(*)::int FROM users) AS users,
    (SELECT count(*)::int FROM user_roles) AS roles,(SELECT count(*)::int FROM user_modules) AS modules`);
  check(
    counts.users === 1 && counts.roles === 1 && counts.modules === 4,
    'Exactly one administrator and its five relationships exist',
  );
  await assert.rejects(
    db.query(
      "INSERT INTO user_roles(user_id,role_id) SELECT -1,id FROM roles WHERE key='super_admin'",
    ),
    (error) => error.code === '23503',
  );
  checks++;
  await assert.rejects(
    db.query(
      'INSERT INTO user_modules(user_id,module_id) SELECT user_id,-1 FROM user_modules LIMIT 1',
    ),
    (error) => error.code === '23503',
  );
  checks++;
  await assert.rejects(
    db.query(
      'INSERT INTO user_modules(user_id,module_id) SELECT user_id,module_id FROM user_modules LIMIT 1',
    ),
    (error) => error.code === '23505',
  );
  checks++;
  check(
    (
      await db.query(`SELECT count(*)::int AS count FROM user_modules um JOIN modules m ON m.id=um.module_id
    JOIN module_groups g ON g.id=m.module_group_id WHERE um.is_active AND m.is_active AND g.key='general_settings'`)
    )[0].count === 4,
    'Assignments target the four active Core modules in the correct group',
  );
  envs.BOOTSTRAP_SUPER_ADMIN_EMAIL = 'another-owner@example.com';
  await assert.rejects(seed().bootstrap(), /cannot replace or promote/);
  checks++;
  check(
    (await db.query('SELECT count(*)::int AS count FROM users'))[0].count === 1,
    'Changing the environment cannot add another administrator',
  );
  envs.BOOTSTRAP_SUPER_ADMIN_EMAIL = '';
  await assert.rejects(seed().bootstrap(), /BOOTSTRAP_SUPER_ADMIN_EMAIL/);
  checks++;

  // Preserve an existing complete schema even when the two initial baselines are unrecorded.
  const before = await db.query(
    'SELECT id::text,email,is_active FROM users ORDER BY id',
  );
  await db.query(
    `DELETE FROM migrations WHERE name IN ('InitialCoreSchema1789257400000','InitialBusinessAiSchema1789257500000')`,
  );
  check(
    (await db.runMigrations()).length === 2,
    'An existing schema records baselines without recreating tables',
  );
  assert.deepEqual(
    await db.query('SELECT id::text,email,is_active FROM users ORDER BY id'),
    before,
  );
  checks++;

  // Core stands on its own, without Business/AI schemas or entities.
  await db.query('CREATE DATABASE core_only');
  const core = new DataSource({
    ...options,
    database: 'core_only',
    entities: [],
    migrations: [],
  });
  connections.push(core);
  await core.initialize();
  const coreRunner = core.createQueryRunner();
  await coreRunner.startTransaction();
  await new InitialCoreSchema1789257400000().up(coreRunner);
  await coreRunner.commitTransaction();
  await coreRunner.release();
  check(
    (
      await core.query(
        `SELECT count(*)::int AS count FROM pg_tables WHERE schemaname='public'`,
      )
    )[0].count === 9,
    'Reusable Core creates only its nine tables',
  );
  check(
    (await core.query('SELECT count(*)::int AS count FROM translations'))[0]
      .count === 12,
    'Core translations initialize both languages',
  );
  await assert.rejects(
    new InitialCoreSchema1789257400000().down(),
    /verified backup/,
  );
  checks++;

  await db.query('CREATE DATABASE rollback_test');
  const rollback = new DataSource({ ...options, database: 'rollback_test' });
  connections.push(rollback);
  await rollback.initialize();
  await rollback.runMigrations();
  await rollback.query(
    "UPDATE translations SET value='synthetic different label' WHERE source_entity='roles'",
  );
  await rollback.query(
    "UPDATE roles SET is_active=false WHERE key='super_admin'",
  );
  await rollback.query(
    `CREATE FUNCTION fail_translation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic translation failure'; END $$`,
  );
  await rollback.query(
    `CREATE TRIGGER fail_translation BEFORE INSERT OR UPDATE ON translations FOR EACH ROW EXECUTE FUNCTION fail_translation()`,
  );
  envs.BOOTSTRAP_SUPER_ADMIN_EMAIL = 'rollback-owner@example.com';
  const failed = new SeedAuthUseCase(
    rollback,
    new TranslationService(rollback.getRepository(Translation)),
    noCache,
  );
  await assert.rejects(failed.bootstrap(), /synthetic translation failure/);
  checks++;
  check(
    (await rollback.query('SELECT count(*)::int AS count FROM users'))[0]
      .count === 0,
    'Translation failure rolls back the whole bootstrap',
  );
  check(
    (
      await rollback.query(
        "SELECT is_active FROM roles WHERE key='super_admin'",
      )
    )[0].is_active === false,
    'Role reactivation is rolled back with failed translations',
  );
  await rollback.query('DROP TRIGGER fail_translation ON translations');
  await rollback.query(
    `CREATE FUNCTION fail_module_assignment() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic assignment failure'; END $$`,
  );
  await rollback.query(
    `CREATE TRIGGER fail_module_assignment BEFORE INSERT ON user_modules FOR EACH ROW EXECUTE FUNCTION fail_module_assignment()`,
  );
  await assert.rejects(failed.bootstrap(), /synthetic assignment failure/);
  checks++;
  check(
    (
      await rollback.query(
        `SELECT (SELECT count(*) FROM users)::int + (SELECT count(*) FROM user_roles)::int + (SELECT count(*) FROM user_modules)::int AS count`,
      )
    )[0].count === 0,
    'Failure after account/role writes rolls them all back',
  );
  await rollback.query('DROP TRIGGER fail_module_assignment ON user_modules');
  envs.BOOTSTRAP_SUPER_ADMIN_EMAIL = 'racing-a@example.com';
  const raceA = failed.bootstrap();
  envs.BOOTSTRAP_SUPER_ADMIN_EMAIL = 'racing-b@example.com';
  const race = await Promise.allSettled([raceA, failed.bootstrap()]);
  check(
    race.filter((value) => value.status === 'fulfilled').length === 1 &&
      race.filter((value) => value.status === 'rejected').length === 1,
    'Two different initial identities cannot both become bootstrap administrator',
  );

  await db.query('CREATE DATABASE partial_core');
  const partial = new DataSource({
    ...options,
    database: 'partial_core',
    entities: [],
    migrations: [],
  });
  connections.push(partial);
  await partial.initialize();
  await partial.query('CREATE TABLE users(id bigint PRIMARY KEY)');
  const partialRunner = partial.createQueryRunner();
  await assert.rejects(
    new InitialCoreSchema1789257400000().up(partialRunner),
    /partial schema/,
  );
  checks++;
  await partialRunner.release();
  check(
    (
      await partial.query(
        `SELECT count(*)::int AS count FROM pg_tables WHERE schemaname='public'`,
      )
    )[0].count === 1,
    'Partial legacy schemas are rejected without rewriting their tables',
  );
  await assert.rejects(
    new InitialBusinessAiSchema1789257500000().down(),
    /verified backup/,
  );
  checks++;

  // Exercise the shipped CLI with synthetic environment variables and loopback only.
  await db.query('CREATE DATABASE cli_setup');
  const cliDb = new DataSource({ ...options, database: 'cli_setup' });
  connections.push(cliDb);
  await cliDb.initialize();
  const cliEnv = {
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    TEMP: process.env.TEMP,
    DOTENV_CONFIG_PATH: process.platform === 'win32' ? 'NUL' : '/dev/null',
    NODE_ENV: 'test',
    RATE_LIMIT_STORAGE: 'memory',
    POSTGRES_HOST: '127.0.0.1',
    POSTGRES_PORT: String(options.port),
    POSTGRES_DB: 'cli_setup',
    POSTGRES_USER: 'install_test',
    POSTGRES_PASSWORD: password,
    REDIS_HOST: '127.0.0.1',
    REDIS_PORT: '1',
    BOOTSTRAP_SUPER_ADMIN_EMAIL: 'CLI-Owner@example.com',
  };
  const runCli = (environment) =>
    promisify(execFile)(
      process.execPath,
      [
        fileURLToPath(new URL('../scripts/seed-core.mjs', import.meta.url)),
        '--migrate',
      ],
      { env: environment, timeout: 20000, maxBuffer: 1024 * 1024 },
    );
  await runCli(cliEnv);
  check(
    (await cliDb.query('SELECT email FROM users'))[0].email ===
      'cli-owner@example.com',
    'Shipped CLI consumes the environment email and installs from scratch',
  );
  await runCli(cliEnv);
  check(
    (await cliDb.query('SELECT count(*)::int AS count FROM users'))[0].count ===
      1,
    'Shipped CLI repeats without duplicating the account',
  );
  await assert.rejects(
    runCli({ ...cliEnv, BOOTSTRAP_SUPER_ADMIN_EMAIL: 'changed@example.com' }),
    (error) => error.stderr.includes('cannot replace or promote'),
  );
  checks++;
  await cliDb.query(
    "DELETE FROM migrations WHERE name='InitialCoreSchema1789257400000'",
  );
  await assert.rejects(runCli(cliEnv), (error) =>
    error.stderr.includes('Reconcile existing migration history'),
  );
  checks++;
  check(
    (await cliDb.query('SELECT count(*)::int AS count FROM migrations'))[0]
      .count === 17,
    'CLI refuses partial history without applying missing migrations',
  );
  await assert.rejects(
    runCli({ ...cliEnv, BOOTSTRAP_SUPER_ADMIN_EMAIL: '', POSTGRES_PORT: '1' }),
    (error) =>
      error.stderr.includes('Configure a valid BOOTSTRAP_SUPER_ADMIN_EMAIL') &&
      !error.stderr.includes('ECONNREFUSED'),
  );
  checks++;
  console.log(
    `Database setup integration: ${checks} checks passed; empty install, reusable Core, legacy preservation, rollback and concurrency verified.`,
  );
} finally {
  for (const connection of connections.reverse())
    if (connection.isInitialized) await connection.destroy();
  if (started) docker('rm', '--force', container);
}
