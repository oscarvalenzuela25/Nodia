// Disposable Docker rehearsal of a shipped Linux package; never loads workspace .env.
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const LABEL = 'nodia.production.first-install';
const ensure = (condition, code) => { if (!condition) throw new Error(code); };

export function parseArguments(argv) {
  const allowed = new Set(['package-archive', 'package-sha256', 'node-archive', 'node-sha256',
    'postgres-image', 'redis-image', 'runner-image', 'output', 'node-source-archive', 'node-source-sha256']);
  const result = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.slice(2);
    ensure(argv[i]?.startsWith('--') && allowed.has(key) && argv[i + 1] && !result[key], 'invalid_rehearsal_argument');
    result[key] = argv[i + 1];
  }
  ensure([...allowed].filter(key => !key.startsWith('node-source-')).every(key => result[key]), 'missing_rehearsal_argument');
  ensure(Boolean(result['node-source-archive']) === Boolean(result['node-source-sha256']), 'node_source_pair_required');
  for (const key of ['package-sha256', 'node-sha256']) ensure(/^[a-f0-9]{64}$/.test(result[key]), 'invalid_archive_digest');
  for (const key of ['postgres-image', 'redis-image', 'runner-image']) ensure(/^sha256:[a-f0-9]{64}$/.test(result[key]), 'immutable_image_id_required');
  for (const key of ['package-archive', 'node-archive']) {
    result[key] = fs.realpathSync(result[key]);
    ensure(fs.lstatSync(result[key]).isFile(), 'archive_regular_file_required');
    ensure(digest(fs.readFileSync(result[key])) === result[key.replace('archive', 'sha256')], 'archive_digest_mismatch');
  }
  if (result['node-source-archive']) {
    ensure(/^[a-f0-9]{64}$/.test(result['node-source-sha256']), 'invalid_node_source_digest');
    result['node-source-archive'] = fs.realpathSync(result['node-source-archive']);
    ensure(fs.lstatSync(result['node-source-archive']).isFile() &&
      digest(fs.readFileSync(result['node-source-archive'])) === result['node-source-sha256'], 'node_source_digest_mismatch');
  }
  result.output = path.resolve(result.output);
  ensure(!fs.existsSync(result.output), 'receipt_already_exists');
  return result;
}

// Serialized and executed by the Linux Node inside a read-only, internal-network runner.
async function insideRunner() {
  const fs = await import('node:fs');
  const { createHash } = await import('node:crypto');
  const { createRequire } = await import('node:module');
  const { spawnSync } = await import('node:child_process');
  const assert = (await import('node:assert/strict')).default;
  const sha = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  const checks = [];
  const check = (value, name) => { assert.ok(value, name); checks.push(name); };
  const manifest = JSON.parse(fs.readFileSync('/package/release-manifest.json', 'utf8'));
  check(process.version === 'v24.22.2', 'linux_node_version');
  const nodeExecutableSha256 = createHash('sha256').update(fs.readFileSync(process.execPath)).digest('hex');
  check(nodeExecutableSha256 === manifest.runtime.executable_sha256, 'node_executable_matches_package_provenance');
  check(process.env.POSTGRES_HOST === 'pg' && process.env.POSTGRES_DB === 'install_test' &&
    process.env.POSTGRES_USER === 'install_test' && process.env.REDIS_HOST === 'redis' &&
    process.env.DOTENV_CONFIG_PATH === '/dev/null', 'disposable_connections_only');
  check(!Object.keys(process.env).some(key => /^(R2_|GOOGLE_|NODIA_AI_|JWT_|OPENAI_|GEMINI_)/.test(key)), 'no_production_or_provider_configuration');
  await import('/package/node_modules/reflect-metadata/Reflect.js');
  const { default: db } = await import('/package/dist/config/data-source.js');
  const connections = [db];
  const environment = { ...process.env };
  const run = (email = environment.BOOTSTRAP_SUPER_ADMIN_EMAIL, database = 'install_test') => spawnSync(
    process.execPath, ['/package/scripts/seed-core.mjs', '--migrate'], {
      cwd: '/package', env: { ...environment, BOOTSTRAP_SUPER_ADMIN_EMAIL: email, POSTGRES_DB: database },
      encoding: 'utf8', timeout: 90_000, maxBuffer: 2 * 1024 * 1024,
    });
  const runOK = () => {
    const result = run();
    if (result.status !== 0) throw new Error(`compiled_cli_failed: ${result.error?.code ?? result.status}: ${result.stderr}`);
  };
  try {
    check(db.options.synchronize === false, 'synchronize_disabled');
    // TypeORM initialize may install uuid-ossp from entity metadata. Inventory first with pg only.
    const { Client } = createRequire('/package/package.json')('pg');
    const preflight = new Client({ host: 'pg', port: 5432, database: 'install_test', user: 'install_test',
      password: process.env.POSTGRES_PASSWORD, connectionTimeoutMillis: 5000, query_timeout: 5000 });
    let initial;
    try {
      await preflight.connect();
      ({ rows: [initial] } = await preflight.query(`SELECT current_database() AS database,
      current_schema() AS schema, current_setting('server_version_num')::int AS version,
      (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema') AS relations,
      (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema') AS routines`));
    } finally { await preflight.end(); }
    check(initial.database === 'install_test' && initial.schema === 'public' && initial.version >= 160000 && initial.version < 170000,
      'postgres16_expected_database_schema');
    check(initial.relations === 0 && initial.routines === 0, 'destination_initially_empty');
    // The shipped CLI is the first initializer; do not preinstall extensions on its behalf.
    runOK();
    await db.initialize();
    const expectedMigrations = db.migrations.map(value => value.name ?? value.constructor.name).sort();
    const declaredMigrations = manifest.files.filter(value => value.path.startsWith('dist/migrations/') && value.path.endsWith('.js'));
    check(expectedMigrations.length === declaredMigrations.length && expectedMigrations.length > 0, 'compiled_migration_inventory_loaded');
    const ledger = await db.query('SELECT name FROM migrations ORDER BY name');
    assert.deepEqual(ledger.map(value => value.name), expectedMigrations);
    checks.push('exact_migration_ledger');
    check(!(await db.showMigrations()), 'no_pending_migrations');
    const columns = await db.query(`SELECT table_schema,table_name,column_name FROM information_schema.columns`);
    const available = new Set(columns.map(value => `${value.table_schema}.${value.table_name}.${value.column_name}`));
    for (const entity of db.entityMetadatas) for (const column of entity.columns)
      assert.ok(available.has(`${entity.schema ?? 'public'}.${entity.tableName}.${column.databaseName}`), 'missing_entity_column');
    check(db.entityMetadatas.length > 0, 'all_entity_tables_and_columns_present');
    const extensions = await db.query(`SELECT e.extname,n.nspname FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace`);
    check(['uuid-ossp', 'pg_trgm'].every(name => extensions.some(value => value.extname === name && value.nspname === 'public')), 'required_extensions_in_public');
    const [counts] = await db.query(`SELECT
      (SELECT count(*)::int FROM users) AS users,
      (SELECT count(*)::int FROM user_roles) AS user_roles,
      (SELECT count(*)::int FROM user_modules) AS user_modules,
      (SELECT count(*)::int FROM ai_providers) AS ai_providers,
      (SELECT count(*)::int FROM ai_api_keys) AS ai_keys`);
    check(counts.users === 1 && counts.user_roles === 1 && counts.user_modules === 4 && counts.ai_providers === 0 && counts.ai_keys === 0,
      'one_admin_four_assignments_no_provider_credentials');
    const accounts = await db.query('SELECT email,is_active FROM users');
    check(accounts[0].email === 'synthetic-owner@example.com' && accounts[0].is_active, 'synthetic_identity_normalized');
    const roles = await db.query(`SELECT r.key,r.is_active,ur.is_active AS assignment_active FROM roles r JOIN user_roles ur ON ur.role_id=r.id`);
    check(roles.length === 1 && roles[0].key === 'super_admin' && roles[0].is_active && roles[0].assignment_active, 'active_super_admin_role');
    const modules = await db.query(`SELECT m.key,m.link,m.is_active,um.is_active AS assignment_active,g.key AS group_key,g.is_active AS group_active
      FROM modules m JOIN user_modules um ON um.module_id=m.id JOIN module_groups g ON g.id=m.module_group_id ORDER BY m.key`);
    assert.deepEqual(modules.map(value => value.key), ['actions', 'modules', 'roles', 'users']);
    check(modules.every(value => value.link === `/${value.key}` && value.group_key === 'general_settings' &&
      value.is_active && value.assignment_active && value.group_active), 'four_canonical_core_accesses');
    const fingerprints = async () => {
      const result = {};
      for (const table of ['users', 'roles', 'user_roles', 'module_groups', 'modules', 'user_modules', 'translations', 'migrations']) {
        const rows = await db.query(`SELECT to_jsonb(t) AS row FROM ${table} t ORDER BY to_jsonb(t)::text`);
        result[table] = sha(rows);
      }
      return result;
    };
    const beforeRepeat = await fingerprints();
    runOK();
    assert.deepEqual(await fingerprints(), beforeRepeat);
    checks.push('repeat_preserves_core_rows_and_ledger');
    const changed = run('changed-owner@example.com');
    check(changed.status !== 0 && changed.stderr.includes('cannot replace or promote'), 'different_bootstrap_identity_rejected');
    assert.deepEqual(await fingerprints(), beforeRepeat);
    checks.push('identity_rejection_preserves_rows');
    const invalid = run('');
    check(invalid.status !== 0 && invalid.stderr.includes('Configure a valid BOOTSTRAP_SUPER_ADMIN_EMAIL'), 'missing_identity_rejected');
    assert.deepEqual(await fingerprints(), beforeRepeat);
    checks.push('invalid_identity_preserves_rows');
    // Independent negative fixture; never corrupt the successful ledger to test refusal.
    await db.query('CREATE DATABASE partial_install');
    const { DataSource } = await import('/package/node_modules/typeorm/index.mjs');
    const partial = new DataSource({ ...db.options, database: 'partial_install' });
    connections.push(partial);
    await partial.initialize();
    await partial.query('CREATE TABLE preserved_fixture(id integer PRIMARY KEY,marker text NOT NULL)');
    await partial.query("INSERT INTO preserved_fixture VALUES(1,'preserve-me')");
    const refused = run('synthetic-owner@example.com', 'partial_install');
    check(refused.status !== 0 && refused.stderr.includes('Reconcile existing migration history'), 'existing_partial_schema_rejected');
    assert.deepEqual(await partial.query('SELECT * FROM preserved_fixture'), [{ id: 1, marker: 'preserve-me' }]);
    check((await partial.query(`SELECT count(*)::int AS count FROM pg_tables WHERE schemaname='public' AND tablename<>'migrations'`))[0].count === 1 &&
      (await partial.query('SELECT count(*)::int AS count FROM migrations'))[0].count === 0,
      'partial_fixture_preserved_no_migrations_executed');
    process.stdout.write(JSON.stringify({ schema_version: 1, status: 'passed', source_sha: manifest.source_sha,
      release_id: manifest.release_id, deployment_eligible: manifest.deployment_eligible,
      node_executable_sha256: nodeExecutableSha256,
      postgres_version_num: initial.version, migrations_verified: ledger.length, entity_tables_verified: db.entityMetadatas.length,
      checks, application_started: false, worker_started: false, journal_initialized: false,
      production_connections_requested: false, provider_inference_requested: false }) + '\n');
  } finally {
    for (const connection of connections.reverse()) if (connection.isInitialized) await connection.destroy();
  }
}

export function rehearse(options) {
  const session = randomBytes(8).toString('hex');
  const prefix = `nodia_first_install_${session}`;
  const created = { containers: [], volumes: [], networks: [] };
  const environment = Object.fromEntries(['PATH', 'SystemRoot', 'HOME', 'USERPROFILE', 'DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_CONFIG']
    .filter(key => process.env[key]).map(key => [key, process.env[key]]));
  const docker = (...args) => execFileSync('docker', args, { env: environment, encoding: 'utf8', timeout: 120_000,
    maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const labels = ['--label', `${LABEL}=${session}`];
  const createContainer = (...args) => {
    const id = docker('create', ...labels, ...args); created.containers.push(id); return id;
  };
  const createVolume = name => { docker('volume', 'create', ...labels, name); created.volumes.push(name); return name; };
  let receipt = { schema_version: 1, status: 'failed', session, started_at_utc: new Date().toISOString(),
    package_sha256: options['package-sha256'], node_archive_sha256: options['node-sha256'],
    node_original_archive_sha256: options['node-source-sha256'] ?? null,
    images: { postgres: options['postgres-image'], redis: options['redis-image'], runner: options['runner-image'] } };
  try {
    for (const image of Object.values(receipt.images)) ensure(docker('image', 'inspect', image, '--format', '{{.Id}}') === image, 'image_id_mismatch');
    const packageVolume = createVolume(`${prefix}_package`), nodeVolume = createVolume(`${prefix}_node`);
    const stage = createContainer('--name', `${prefix}_stage`, '--network', 'none',
      '--mount', `type=volume,src=${packageVolume},dst=/package`, '--mount', `type=volume,src=${nodeVolume},dst=/node`,
      '--entrypoint', '/bin/sh', options['runner-image'], '-c', 'sleep 600');
    docker('cp', options['package-archive'], `${stage}:/tmp/package.tar.gz`);
    docker('cp', options['node-archive'], `${stage}:/tmp/node.tar.xz`);
    docker('start', stage);
    for (const [filename, expected] of [['/tmp/package.tar.gz', options['package-sha256']], ['/tmp/node.tar.xz', options['node-sha256']]])
      ensure(docker('exec', stage, '/usr/bin/sha256sum', filename).split(/\s+/)[0] === expected, 'transferred_archive_digest_mismatch');
    receipt.transferred_archive_digests_verified = true;
    docker('exec', stage, '/bin/tar', '-xzf', '/tmp/package.tar.gz', '-C', '/package');
    docker('exec', stage, '/bin/tar', '-xaf', '/tmp/node.tar.xz', '--strip-components=1', '-C', '/node');
    docker('stop', stage);
    const network = `${prefix}_internal`;
    docker('network', 'create', '--internal', ...labels, network); created.networks.push(network);
    const password = randomBytes(20).toString('hex');
    const redisPassword = randomBytes(20).toString('hex');
    const pg = createContainer('--name', `${prefix}_pg`, '--network', network, '--network-alias', 'pg',
      '-e', 'POSTGRES_USER=install_test', '-e', 'POSTGRES_DB=install_test', '-e', `POSTGRES_PASSWORD=${password}`,
      '--memory', '512m', '--cpus', '1', options['postgres-image']);
    const redis = createContainer('--name', `${prefix}_redis`, '--network', network, '--network-alias', 'redis',
      '--memory', '128m', '--cpus', '0.5', options['redis-image'], 'redis-server', '--save', '', '--appendonly', 'no', '--requirepass', redisPassword);
    docker('start', pg, redis);
    let ready = false;
    for (let i = 0; i < 80; i++) {
      try { docker('exec', pg, 'pg_isready', '-h', '127.0.0.1', '-U', 'install_test', '-d', 'install_test'); ready = true; break; }
      catch { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250); }
    }
    ensure(ready, 'postgres_readiness_timeout');
    docker('exec', redis, 'redis-cli', '-a', redisPassword, '--no-auth-warning', 'PING');
    const runner = createContainer('-i', '--name', `${prefix}_runner`, '--network', network, '--read-only',
      '--mount', `type=volume,src=${packageVolume},dst=/package,readonly`, '--mount', `type=volume,src=${nodeVolume},dst=/node,readonly`,
      '--tmpfs', '/tmp:rw,noexec,nosuid,size=32m', '--memory', '1g', '--cpus', '2', '--workdir', '/package',
      '--entrypoint', '/usr/bin/env', options['runner-image'], '-i', 'PATH=/node/bin:/usr/bin:/bin',
      'HOME=/tmp', 'LANG=C.UTF-8', 'TZ=UTC', 'DOTENV_CONFIG_PATH=/dev/null', 'NODE_ENV=test', 'RATE_LIMIT_STORAGE=memory',
      'POSTGRES_HOST=pg', 'POSTGRES_PORT=5432', 'POSTGRES_DB=install_test', 'POSTGRES_USER=install_test',
      `POSTGRES_PASSWORD=${password}`, 'PGSSLMODE=disable', 'REDIS_HOST=redis', 'REDIS_PORT=6379', `REDIS_PASSWORD=${redisPassword}`,
      'BOOTSTRAP_SUPER_ADMIN_EMAIL=Synthetic-Owner@example.com', '/node/bin/node', '--input-type=module', '-');
    const result = spawnSync('docker', ['start', '-a', '-i', runner], {
      env: environment, input: `(${insideRunner.toString()})().catch(error => { process.stderr.write(String(error.stack) + '\\n'); process.exitCode = 1; });\n`,
      encoding: 'utf8', timeout: 240_000, maxBuffer: 8 * 1024 * 1024,
    });
    fs.mkdirSync(path.dirname(options.output), { recursive: true });
    fs.writeFileSync(options.output + '.runner.log', result.stdout + '\n' + result.stderr, { mode: 0o600 });
    ensure(result.status === 0 && docker('inspect', runner, '--format', '{{.State.ExitCode}}') === '0', 'rehearsal_runner_failed');
    const output = result.stdout.trim().split(/\r?\n/).filter(line => line.startsWith('{')).at(-1);
    const probe = JSON.parse(output);
    ensure(probe.status === 'passed', 'rehearsal_probe_failed');
    receipt = { ...receipt, status: 'passed', probe };
  } catch (error) {
    receipt.error_code = /^[a-z_]+$/.test(error.message) ? error.message : 'rehearsal_operation_failed';
    fs.mkdirSync(path.dirname(options.output), { recursive: true });
    // Synthetic environment only; preserve operator diagnostics outside versioned evidence.
    fs.writeFileSync(options.output + '.operator.log', String(error.stack) + '\n' + String(error.stderr ?? ''), { mode: 0o600 });
  } finally {
    const errors = [];
    for (const [kind, names] of [['container', created.containers], ['network', created.networks], ['volume', created.volumes]])
      for (const id of names.reverse()) {
        try {
          const inspect = kind === 'container' ? JSON.parse(docker('inspect', id))[0].Config.Labels : JSON.parse(docker(kind, 'inspect', id))[0].Labels;
          ensure(inspect?.[LABEL] === session, 'cleanup_ownership_mismatch');
          if (kind === 'container') docker('rm', '--force', '--volumes', id);
          else docker(kind, 'rm', id);
        } catch { errors.push(`${kind}:${id}`); }
      }
    receipt.cleanup = { containers: created.containers.length, networks: created.networks.length, volumes: created.volumes.length, errors };
    receipt.finished_at_utc = new Date().toISOString();
    if (errors.length) receipt.status = 'failed';
    fs.mkdirSync(path.dirname(options.output), { recursive: true });
    fs.writeFileSync(options.output, JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600 });
  }
  return receipt;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    const result = rehearse(parseArguments(process.argv.slice(2)));
    console.log(JSON.stringify({ status: result.status, receipt: result.status === 'passed' ? result.probe : undefined, cleanup: result.cleanup }));
    if (result.status !== 'passed') process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
