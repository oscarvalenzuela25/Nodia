// Local-only Teacher adoption drill: exact current-release database equality, before prepare.
// Reuses the existing encrypted-backup protocol; never authorizes runtime recovery or dispatch.
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { hashFile, localDockerEndpoint, PINS as HISTORICAL_PINS } from './restore-production-backup.mjs';
import { validateFingerprint } from './fingerprint-teacher-restore.mjs';

export const PINS = Object.freeze({ postgres: HISTORICAL_PINS.postgres, runner: HISTORICAL_PINS.runner,
  fingerprint: 'e4d899a31df33ca40f3e663369d7b3419577c530779cdb54c318f82ac9acf191',
  inventory: '0c63a501e61f31ecc350ec8a3d82b54a9fcb9c201c149edf7b1feb0432e66a1a' });
const LABEL = 'nodia.teacher.database.restore';
const ensure = (condition, code) => { if (!condition) throw Object.assign(new Error('Teacher restore rejected'), { safeCode: code }); };
const HEX = /^[a-f0-9]{64}$/u;
const FIELDS = ['cipher-file', 'cipher-sha256', 'backup-id', 'private-key-file', 'fingerprint-file', 'fingerprint-sha256',
  'package-archive', 'package-sha256', 'node-archive', 'node-sha256', 'manifest-sha256', 'source-sha', 'release-id', 'tree-sha256', 'output'];

export function argumentPairs(argv) {
  ensure(Array.isArray(argv) && argv.length === FIELDS.length * 2, 'restore_arguments_invalid');
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index]?.slice(2), value = argv[index + 1];
    ensure(argv[index]?.startsWith('--') && FIELDS.includes(key) && typeof value === 'string' && value.length > 0 && !Object.hasOwn(result, key), 'restore_arguments_invalid');
    result[key] = value;
  }
  for (const key of ['cipher-sha256', 'fingerprint-sha256', 'package-sha256', 'node-sha256', 'manifest-sha256', 'tree-sha256'])
    ensure(HEX.test(result[key]), 'restore_digest_invalid');
  ensure(/^[a-f0-9]{40}$/u.test(result['source-sha']) && result['release-id'] === `backend-${result['source-sha'].slice(0, 12)}-${result['tree-sha256'].slice(0, 12)}` &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(result['backup-id']), 'restore_identity_invalid');
  return result;
}

export function validateRelease(value, digest, expected) {
  // Self-contained because the same policy runs in the isolated verification container.
  const check = (condition) => { if (!condition) throw Object.assign(new Error('Release identity rejected'), { safeCode: 'restore_release_identity_invalid' }); };
  check(digest === expected.manifest_sha256 && value?.schema_version === 1 && value.source_provenance === 'git_archive' && value.deployment_eligible === true &&
    value.source_sha === expected.source_sha && value.release_id === expected.release_id && value.package_tree_sha256 === expected.tree_sha256 &&
    value.release_id === `backend-${value.source_sha.slice(0, 12)}-${value.package_tree_sha256.slice(0, 12)}` &&
    value.runtime?.node === 'v24.22.2' && value.runtime?.platform === 'linux' && value.runtime?.arch === 'x64' && /^[a-f0-9]{64}$/u.test(value.runtime?.executable_sha256 ?? '') && Array.isArray(value.files));
  return value;
}

/** Inputs have already passed the closed fingerprint contract. Key insertion order
 * differs between Python sort_keys and JavaScript; table order and every value remain exact. */
export function sameFingerprintData(left, right) {
  const canonical = value => JSON.stringify([value.aggregate_sha256,
    value.tables.map(row => [row.name, row.rows, row.md5])]);
  return canonical(left) === canonical(right);
}

function regular(filename, maximum) {
  const absolute = path.resolve(filename), info = fs.lstatSync(absolute);
  ensure(fs.realpathSync(absolute) === absolute && info.isFile() && !info.isSymbolicLink() && info.nlink === 1 && info.size > 0 && info.size <= maximum, 'restore_input_not_regular_or_bounded');
  return absolute;
}
export function privateKeyOutsideRepository(repository, filename) {
  const relative = path.relative(repository, filename);
  return relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative);
}
export function parseArguments(argv) {
  const options = argumentPairs(argv);
  for (const [key, maximum] of [['cipher-file', 1024 ** 3 + 8220], ['private-key-file', 16384], ['fingerprint-file', 65536], ['package-archive', 512 * 1024 ** 2], ['node-archive', 128 * 1024 ** 2]])
    options[key] = regular(options[key], maximum);
  const repository = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
  ensure(privateKeyOutsideRepository(repository, options['private-key-file']), 'private_key_must_remain_outside_repository');
  ensure(!/obsidian/iu.test(options['private-key-file']), 'private_key_vault_path_denied');
  for (const [key, pin] of [['cipher-file', 'cipher-sha256'], ['fingerprint-file', 'fingerprint-sha256'], ['package-archive', 'package-sha256'], ['node-archive', 'node-sha256']])
    ensure(hashFile(options[key]) === options[pin], 'restore_input_digest_mismatch');
  options.sourceFingerprint = validateFingerprint(JSON.parse(fs.readFileSync(options['fingerprint-file'], 'utf8')));
  const here = path.dirname(fileURLToPath(import.meta.url));
  options.fingerprintHelper = regular(path.join(here, 'fingerprint-teacher-restore.mjs'), 65536);
  ensure(hashFile(options.fingerprintHelper) === PINS.fingerprint, 'fingerprint_helper_pin_mismatch');
  options.inventoryHelper = regular(path.join(here, 'update-backend-action.mjs'), 65536);
  options.inventoryHash = hashFile(options.inventoryHelper);
  ensure(options.inventoryHash === PINS.inventory, 'inventory_helper_pin_mismatch');
  options.output = path.resolve(options.output);
  ensure(!fs.existsSync(options.output), 'restore_receipt_already_exists');
  return options;
}

async function insideRunner(mode) {
  const fs = await import('node:fs');
  const { createHash } = await import('node:crypto');
  const { createRequire } = await import('node:module');
  const ensure = (condition, code) => { if (!condition) throw Object.assign(new Error('Restore check rejected'), { safeCode: code }); };
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  const configuration = JSON.parse(fs.readFileSync('/quarantine/control.json', 'utf8'));
  const manifestRaw = fs.readFileSync('/package/release-manifest.json');
  const manifest = JSON.parse(manifestRaw);
  validateRelease(manifest, hash(manifestRaw), configuration);
  ensure(process.version === 'v24.22.2' && hash(fs.readFileSync(process.execPath)) === manifest.runtime.executable_sha256, 'restore_node_identity_invalid');
  ensure(process.env.DOTENV_CONFIG_PATH === '/dev/null' && process.env.NODIA_AI_OPERATION_MODE === 'quarantine' &&
    !Object.keys(process.env).some(name => /^(R2_|GOOGLE_|OPENAI_|JWT_|GEMINI_)/u.test(name)), 'restore_environment_not_quarantined');
  await import('/package/node_modules/reflect-metadata/Reflect.js');
  if (mode === 'decrypt') {
    const chunks = []; let size = 0;
    for await (const chunk of process.stdin) { size += chunk.length; ensure(size <= 16384, 'restore_private_input_too_large'); chunks.push(chunk); }
    const secret = Buffer.concat(chunks);
    const partial = '/quarantine/plaintext.custom.partial', final = '/quarantine/plaintext.custom';
    try {
      const cipherHash = createHash('sha256');
      for await (const chunk of fs.createReadStream('/quarantine/backup.enc')) cipherHash.update(chunk);
      ensure(cipherHash.digest('hex') === configuration.cipher_sha256, 'restore_cipher_digest_invalid');
      const { DecryptNodiaAiBackupUseCase } = await import('/package/dist/nodia-ai-recovery/use-case/encrypt-nodia-ai-backup.use-case.js');
      const result = await new DecryptNodiaAiBackupUseCase().execute({ source: fs.createReadStream('/quarantine/backup.enc'),
        destination: fs.createWriteStream(partial, { flags: 'wx', mode: 0o600 }), private_key_pem: secret.toString('utf8'),
        backup_id: configuration.backup_id, max_cipher_bytes: 1024 ** 3 + 8220, signal: AbortSignal.timeout(120000) });
      const descriptor = fs.openSync(partial, 'r+'); try { fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
      fs.renameSync(partial, final);
      process.stdout.write(JSON.stringify({ status: 'decrypted', backup_id: configuration.backup_id, plain_bytes: result.plain_bytes,
        gcm_verified: true, private_key_file_created: false }) + '\n');
    } catch { fs.rmSync(partial, { force: true }); throw Object.assign(new Error('Restore decryption failed'), { safeCode: 'restore_decryption_failed' }); }
    finally { secret.fill(0); chunks.forEach(chunk => chunk.fill(0)); }
    return;
  }
  const target = JSON.parse(fs.readFileSync('/quarantine/target.json', 'utf8'));
  ensure(target.host === 'pg' && target.port === 5432 && target.username === 'restore_app' &&
    target.database === 'nodia_restore_' + configuration.backup_id.replaceAll('-', ''), 'restore_target_not_disposable');
  ensure(mode === 'verify', 'restore_mode_invalid');
  const { Client } = createRequire('/package/package.json')('pg');
  const { default: dataSource } = await import('/package/dist/config/data-source.js');
  ensure(dataSource.options.synchronize === false, 'restore_synchronize_not_disabled');
  await dataSource.buildMetadatas();
  const { migrationInventory } = await import('/harness/update-backend-action.mjs');
  const expectedMigrations = migrationInventory(manifest).map(item => item.name).sort();
  const actualMigrations = dataSource.migrations.map(item => item.name ?? item.constructor.name).sort();
  ensure(JSON.stringify(actualMigrations) === JSON.stringify(expectedMigrations) && dataSource.entityMetadatas.length > 0 && dataSource.entityMetadatas.every(item => !item.schema || item.schema === 'public'), 'restore_schema_inventory_invalid');
  const client = new Client({ host: target.host, port: target.port, user: target.username, password: target.password, database: target.database,
    connectionTimeoutMillis: 5000, query_timeout: 15000, options: '-c default_transaction_read_only=on' });
  try {
    await client.connect(); await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const ledger = (await client.query('SELECT name FROM public.migrations ORDER BY name')).rows.map(value => value.name);
    ensure(JSON.stringify(ledger) === JSON.stringify(expectedMigrations), 'restore_migration_ledger_mismatch');
    const columns = (await client.query("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public'")).rows;
    const available = new Set(columns.map(value => value.table_name + '.' + value.column_name));
    ensure(dataSource.entityMetadatas.every(entity => entity.columns.every(column => available.has(entity.tableName + '.' + column.databaseName))),
      'restore_entity_columns_missing');
    const extensionState = (await client.query("SELECT extname FROM pg_extension ORDER BY extname")).rows.map(value => value.extname);
    ensure(JSON.stringify(extensionState) === JSON.stringify(['pg_trgm', 'plpgsql', 'uuid-ossp']), 'restore_provider_extensions_recreated');
    ensure((await client.query("SELECT count(*)::int AS count FROM pg_namespace WHERE nspname='pooler'")).rows[0].count === 0,
      'restore_provider_schema_recreated');
    const { fingerprintPublicSchema, validateFingerprint } = await import('/harness/fingerprint-teacher-restore.mjs');
    const source = validateFingerprint(JSON.parse(fs.readFileSync('/quarantine/source-fingerprint.json', 'utf8')));
    const fingerprint = validateFingerprint(await fingerprintPublicSchema(client));
    ensure(sameFingerprintData(fingerprint, source), 'restore_source_content_mismatch');
    await client.query('ROLLBACK');
    process.stdout.write(JSON.stringify({ status: 'verified',
      migrations_verified: expectedMigrations.length, entity_tables_verified: dataSource.entityMetadatas.length, public_tables_verified: fingerprint.tables.length,
      fingerprint_sha256: fingerprint.aggregate_sha256, source_content_verified_before_prepare: true,
      app_or_worker_started: false, production_connections_requested: false, provider_inference_requested: false }) + '\n');
  } finally { await client.end().catch(() => {}); client.connection?.stream?.destroy(); }
}
export function executeDocker(_program, args, { input, timeout, maxBuffer, env, signal }) {
  return new Promise(resolve => {
    const child = execFile('docker', args, { env, timeout, maxBuffer, signal, windowsHide: true, encoding: 'buffer' }, (error, stdout, stderr) => {
      resolve({ status: error ? (Number.isInteger(error.code) ? error.code : 1) : 0, stdout: stdout ?? Buffer.alloc(0), stderr: stderr ?? Buffer.alloc(0) });
    });
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
}
export async function restoreTeacherBackup(options, { spawn = executeDocker, signal } = {}) {
  const session = randomBytes(12).toString('hex'), prefix = 'nodia_teacher_restore_' + session;
  const resources = { containers: [], networks: [], volumes: [] };
  const environment = Object.fromEntries(['PATH', 'SystemRoot', 'HOME', 'USERPROFILE', 'DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_CONFIG']
    .filter(key => process.env[key]).map(key => [key, process.env[key]]));
  let cleaning = false;
  const call = async (args, { input, timeout = 120000, check = true, maximum = 1024 * 1024 } = {}) => {
    if (!cleaning) ensure(!signal?.aborted, 'restore_interrupted');
    const result = await spawn('docker', args, { env: environment, input, timeout, maxBuffer: maximum, signal: cleaning ? undefined : signal });
    if (!cleaning) ensure(!signal?.aborted, 'restore_interrupted');
    if (check) ensure(result.status === 0, 'restore_docker_operation_failed');
    return result;
  };
  const docker = async (...args) => (await call(args)).stdout.toString('utf8').trim();
  const labels = ['--label', LABEL + '=' + session];
  const volume = async name => { const id = prefix + '_' + name; resources.volumes.push(id); await docker('volume', 'create', ...labels, id); return id; };
  const container = async (...args) => { const id = prefix + '_container_' + resources.containers.length; resources.containers.push(id); await docker('create', '--name', id, '--pull=never', ...labels, ...args); return id; };
  const receipt = { schema_version: 1, status: 'failed', started_at_utc: new Date().toISOString(), session,
    backup_id: options['backup-id'], cipher_sha256: options['cipher-sha256'], package_sha256: options['package-sha256'], node_sha256: options['node-sha256'],
    source_sha: options['source-sha'], fingerprint_helper_sha256: PINS.fingerprint,
    release_id: options['release-id'], release_manifest_sha256: options['manifest-sha256'], package_tree_sha256: options['tree-sha256'],
    source_fingerprint_file_sha256: options['fingerprint-sha256'], source_fingerprint_sha256: options.sourceFingerprint.aggregate_sha256,
    private_key_copied_to_file_or_vps: false, application_started: false, worker_started: false, provider_inference_requested: false,
    production_connections_requested: false, release_authorized: false, restore_scope: 'database_equality_only_before_prepare', journal_reconciled: false, runtime_recovery_authorized: false, phase: 'validating_local_docker' };
  let secret;
  try {
    ensure(!environment.DOCKER_HOST || localDockerEndpoint(environment.DOCKER_HOST), 'remote_docker_endpoint_denied');
    const endpoint = JSON.parse(await docker('context', 'inspect', await docker('context', 'show'), '--format', '{{json .Endpoints.docker.Host}}'));
    ensure(localDockerEndpoint(endpoint), 'remote_docker_endpoint_denied');
    for (const image of [PINS.postgres, PINS.runner]) ensure(await docker('image', 'inspect', image, '--format', '{{.Id}}') === image, 'restore_image_missing');
    const packageVolume = await volume('package'), nodeVolume = await volume('node'), helperVolume = await volume('helper'), quarantineVolume = await volume('quarantine'), dataVolume = await volume('database');
    const stage = await container('--network', 'none', '--memory=512m', '--cpus=1', '--pids-limit=128', '--mount', `type=volume,src=${packageVolume},dst=/package`,
      '--mount', `type=volume,src=${nodeVolume},dst=/node`, '--mount', `type=volume,src=${helperVolume},dst=/harness`,
      '--mount', `type=volume,src=${quarantineVolume},dst=/quarantine`, '--entrypoint', '/bin/sh', PINS.runner, '-c', 'sleep 600');
    await docker('start', stage);
    for (const [source, target] of [[options['package-archive'], '/tmp/package.tar.gz'], [options['node-archive'], '/tmp/node.tar.gz'],
      [options.fingerprintHelper, '/harness/fingerprint-teacher-restore.mjs'], [options['cipher-file'], '/quarantine/backup.enc'],
      [options['fingerprint-file'], '/quarantine/source-fingerprint.json'], [options.inventoryHelper, '/harness/update-backend-action.mjs']])
      await docker('cp', source, stage + ':' + target);
    for (const [filename, expected] of [['/tmp/package.tar.gz', options['package-sha256']], ['/tmp/node.tar.gz', options['node-sha256']],
      ['/harness/fingerprint-teacher-restore.mjs', PINS.fingerprint], ['/quarantine/backup.enc', options['cipher-sha256']],
      ['/quarantine/source-fingerprint.json', options['fingerprint-sha256']],
      ['/harness/update-backend-action.mjs', options.inventoryHash]])
      ensure((await docker('exec', stage, '/usr/bin/sha256sum', filename)).split(/\s+/u)[0] === expected, 'restore_transferred_input_digest_mismatch');
    await docker('exec', stage, '/bin/tar', '-xzf', '/tmp/package.tar.gz', '-C', '/package');
    await docker('exec', stage, '/bin/tar', '-xzf', '/tmp/node.tar.gz', '--strip-components=1', '-C', '/node');
    const password = randomBytes(20).toString('hex'), adminPassword = randomBytes(20).toString('hex');
    const database = 'nodia_restore_' + options['backup-id'].replaceAll('-', '');
    const configuration = { source_sha: options['source-sha'], release_id: options['release-id'], tree_sha256: options['tree-sha256'], manifest_sha256: options['manifest-sha256'], backup_id: options['backup-id'], cipher_sha256: options['cipher-sha256'] };
    const target = { host: 'pg', port: 5432, username: 'restore_app', password, database };
    const source = `const validateRelease=${validateRelease.toString()};\nconst sameFingerprintData=${sameFingerprintData.toString()};\n(${insideRunner.toString()})(process.argv[2]).catch(error => {const code=typeof error?.safeCode==='string'&&/^[a-z0-9_]{1,100}$/.test(error.safeCode)?'restore_check_'+error.safeCode:'restore_local_runner_failed';process.stderr.write(code+'\\n');process.exitCode=1;});\n`;
    for (const [filename, contents] of [['/harness/restore.mjs', source], ['/quarantine/control.json', JSON.stringify(configuration)],
      ['/quarantine/target.json', JSON.stringify(target)]])
      await call(['exec', '-i', stage, '/bin/sh', '-c', 'cat > ' + filename], { input: contents });
    await docker('exec', stage, '/bin/sh', '-c', 'chmod 0755 /package /node /harness; chmod 0644 /harness/*; chown -R 1000:1000 /quarantine; chmod 0700 /quarantine; chmod 0600 /quarantine/*');
    await docker('stop', stage);
    const nodeRunner = async (mode, network, input) => {
      const id = await container('-i', '--network', network, '--read-only', '--user', '1000:1000', '--cap-drop=ALL',
        '--security-opt=no-new-privileges', '--mount', `type=volume,src=${packageVolume},dst=/package,readonly`,
        '--mount', `type=volume,src=${nodeVolume},dst=/node,readonly`, '--mount', `type=volume,src=${helperVolume},dst=/harness,readonly`,
        '--mount', `type=volume,src=${quarantineVolume},dst=/quarantine`, '--tmpfs', '/tmp:rw,noexec,nosuid,size=16m',
        '--memory=512m', '--cpus=1', '--pids-limit=128', '--workdir=/package', '--entrypoint=/usr/bin/env', PINS.runner, '-i',
        'PATH=/node/bin:/usr/bin:/bin', 'HOME=/tmp', 'LANG=C.UTF-8', 'TZ=UTC', 'DOTENV_CONFIG_PATH=/dev/null',
        'NODE_ENV=production', 'RATE_LIMIT_STORAGE=redis', 'NODIA_AI_OPERATION_MODE=quarantine', 'PGSSLMODE=disable',
        'POSTGRES_HOST=pg', 'POSTGRES_PORT=5432', 'POSTGRES_DB=' + database, 'POSTGRES_USER=restore_app', 'POSTGRES_PASSWORD=' + password,
        '/node/bin/node', '/harness/restore.mjs', mode);
      const result = await call(['start', '-a', '-i', id], { input, timeout: 240000, maximum: 65536, check: false });
      if (result.status !== 0) {
        const code = result.stderr?.toString('utf8').trim();
        ensure(false, typeof code === 'string' && /^restore_[a-z0-9_]{1,120}$/u.test(code) ? code : 'restore_local_runner_failed');
      }
      const output = result.stdout.toString('utf8').trim();
      ensure(output.startsWith('{') && output.endsWith('}'), 'restore_runner_receipt_invalid');
      return JSON.parse(output);
    };
    receipt.phase = 'decrypting_quarantine';
    const keyFile = fs.openSync(options['private-key-file'], fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
    try {
      const info = fs.fstatSync(keyFile); ensure(info.isFile() && info.nlink === 1 && info.size > 0 && info.size <= 16384, 'restore_private_key_input_invalid');
      secret = fs.readFileSync(keyFile);
    } finally { fs.closeSync(keyFile); }
    try { receipt.decryption = await nodeRunner('decrypt', 'none', secret); }
    finally { secret.fill(0); secret = null; }
    ensure(receipt.decryption.status === 'decrypted' && receipt.decryption.gcm_verified === true, 'restore_decryption_not_verified');
    const network = prefix + '_internal'; resources.networks.push(network); await docker('network', 'create', '--internal', ...labels, network);
    const pg = await container('--network', network, '--network-alias', 'pg', '--mount', `type=volume,src=${dataVolume},dst=/var/lib/postgresql/data`,
      '--mount', `type=volume,src=${quarantineVolume},dst=/quarantine,readonly`, '-e', 'POSTGRES_USER=restore_admin',
      '-e', 'POSTGRES_DB=restore_admin', '-e', 'POSTGRES_PASSWORD=' + adminPassword, '--memory=512m', '--cpus=1', PINS.postgres);
    await docker('start', pg);
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      const logs = await call(['logs', pg]);
      const initialized = Buffer.concat([logs.stdout, logs.stderr]).includes(Buffer.from('PostgreSQL init process complete; ready for start up.'));
      const probe = await call(['exec', pg, 'pg_isready', '-U', 'restore_admin', '-d', 'restore_admin'], { check: false });
      if (initialized && probe.status === 0) { ready = true; break; }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    ensure(ready, 'restore_postgres_startup_timeout');
    await call(['exec', '-i', pg, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'restore_admin', '-d', 'restore_admin'],
      { input: `CREATE ROLE restore_app LOGIN PASSWORD '${password}';\nCREATE DATABASE ${database} OWNER restore_app;\n` });
    await call(['exec', '-i', pg, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'restore_admin', '-d', database],
      { input: 'CREATE EXTENSION "uuid-ossp" WITH SCHEMA public;\nCREATE EXTENSION pg_trgm WITH SCHEMA public;\n' });
    receipt.phase = 'restoring_public_schema';
    await call(['exec', '-e', 'PGPASSWORD=' + password, pg, 'pg_restore', '-h', '127.0.0.1', '-U', 'restore_app', '-d', database,
      '--schema=public', '--no-owner', '--no-acl', '--exit-on-error', '/quarantine/plaintext.custom'], { timeout: 240000 });
    receipt.phase = 'verifying_restored_contents'; receipt.before_prepare = await nodeRunner('verify', network);
    ensure(receipt.before_prepare.status === 'verified', 'restore_initial_verification_failed');
    receipt.status = 'verified'; receipt.phase = 'complete';
  } catch (error) {
    receipt.error_code = typeof error?.safeCode === 'string' && /^[a-z0-9_]{1,100}$/u.test(error.safeCode) ? error.safeCode : 'restore_local_operation_failed';
  } finally {
    cleaning = true;
    secret?.fill(0);
    const errors = [];
    for (const [kind, values] of [['container', resources.containers], ['network', resources.networks], ['volume', resources.volumes]]) {
      for (const id of values.reverse()) {
        try {
          const object = JSON.parse(kind === 'container' ? await docker('inspect', id) : await docker(kind, 'inspect', id))[0];
          const tags = kind === 'container' ? object.Config.Labels : object.Labels;
          ensure(tags?.[LABEL] === session, 'restore_cleanup_ownership_mismatch');
          if (kind === 'container') await docker('rm', '--force', '--volumes', id); else await docker(kind, 'rm', id);
        } catch { errors.push({ kind, id }); }
      }
    }
    receipt.cleanup = { containers: resources.containers.length, networks: resources.networks.length,
      volumes: resources.volumes.length, plaintext_quarantine_volume_removed: !errors.some(value => value.kind === 'volume'), errors };
    if (errors.length) { receipt.status = 'failed'; receipt.error_code = 'restore_cleanup_incomplete'; }
    receipt.finished_at_utc = new Date().toISOString();
    fs.mkdirSync(path.dirname(options.output), { recursive: true });
    fs.writeFileSync(options.output, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  }
  return receipt;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  if (process.argv.length === 2) {
    process.stdout.write(JSON.stringify({ inert: true, private_inputs_read: false, docker_requested: false }) + '\n');
  } else {
    try {
      const controller = new AbortController();
      const interrupt = () => controller.abort();
      process.on('SIGINT', interrupt); process.on('SIGTERM', interrupt);
      let receipt;
      try { receipt = await restoreTeacherBackup(parseArguments(process.argv.slice(2)), { signal: controller.signal }); }
      finally { process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', interrupt); }
      process.stdout.write(JSON.stringify({ status: receipt.status, phase: receipt.phase, error_code: receipt.error_code,
        source_content_verified: receipt.before_prepare?.source_content_verified_before_prepare === true,
        cleanup: receipt.cleanup, release_authorized: false, runtime_recovery_authorized: false }) + '\n');
      process.exitCode = receipt.status === 'verified' ? 0 : 1;
    } catch (error) {
      process.stderr.write((typeof error?.safeCode === 'string' ? error.safeCode : 'restore_input_invalid') + '\n'); process.exitCode = 1;
    }
  }
}
