// Local Docker quarantine only. Never connects production, imports AppModule or copies the RSA key into a file/container layer.
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validateFingerprint } from './fingerprint-backend-public.mjs';

export const PINS = Object.freeze({
  source: 'f01b493336883403a84b1c80759ce4fc43cbd370',
  package: 'b8ac639b2cc032839dd17769b81f1da85cb16263f39594230e06ed2e1f1b7f38',
  node: '42470e1e3abab4adb85eb4681189e1872aa24362b2a35bffb8b4ef56b68cde2d',
  fingerprint: 'f05df5ed5cd41afab5cbc696d1029812d2dac0f58318332ef90c56a2f41f446e',
  postgres: 'sha256:75f5a96988cdf694a215073c3e9c001b706b371e2f94df3967f2efdec2787f6b',
  runner: 'sha256:60ce2f4bb2920909e5abf19f515c41fc38b59f26ef69a61498e28c67322db5fd',
});
const LABEL = 'nodia.production.restore';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u;
const HEX = /^[a-f0-9]{64}$/u;
const ensure = (condition, code) => { if (!condition) throw Object.assign(new Error('Local restore rejected'), { safeCode: code }); };
const closed = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));

export function hashFile(filename) {
  const descriptor = fs.openSync(filename, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
  const hash = createHash('sha256'), buffer = Buffer.alloc(1024 * 1024);
  try { let bytes; while ((bytes = fs.readSync(descriptor, buffer, 0, buffer.length, null)) > 0) hash.update(buffer.subarray(0, bytes)); }
  finally { fs.closeSync(descriptor); }
  return hash.digest('hex');
}
export function localDockerEndpoint(value) {
  return typeof value === 'string' && (/^npipe:\/\/\/\/\.\/pipe\/[A-Za-z0-9_.-]+$/u.test(value) || value === 'unix:///var/run/docker.sock');
}
export function argumentPairs(argv) {
  const allowed = ['cipher-file', 'cipher-sha256', 'backup-id', 'private-key-file', 'journal-directory',
    'journal-metadata-sha256', 'journal-manifest-sha256', 'journal-head-sha256', 'fingerprint-file', 'fingerprint-sha256',
    'package-archive', 'node-archive', 'output'];
  ensure(Array.isArray(argv) && argv.length === allowed.length * 2, 'restore_arguments_invalid');
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index]?.slice(2);
    ensure(argv[index]?.startsWith('--') && allowed.includes(key) && typeof argv[index + 1] === 'string' &&
      argv[index + 1].length > 0 && !Object.hasOwn(result, key), 'restore_arguments_invalid');
    result[key] = argv[index + 1];
  }
  ensure(UUID.test(result['backup-id']) && ['cipher-sha256', 'journal-metadata-sha256', 'journal-manifest-sha256',
    'journal-head-sha256', 'fingerprint-sha256'].every(key => HEX.test(result[key])), 'restore_identity_invalid');
  return result;
}
function regular(filename, maximum) {
  const absolute = path.resolve(filename), canonical = fs.realpathSync(absolute), info = fs.lstatSync(absolute);
  ensure(canonical === absolute && info.isFile() && !info.isSymbolicLink() && info.nlink === 1 && info.size > 0 && info.size <= maximum,
    'restore_input_not_regular_or_bounded');
  return absolute;
}
export function parseArguments(argv) {
  const options = argumentPairs(argv);
  for (const [field, maximum] of [['cipher-file', 1024 ** 3 + 8220], ['private-key-file', 16384],
    ['fingerprint-file', 65536], ['package-archive', 512 * 1024 ** 2], ['node-archive', 128 * 1024 ** 2]])
    options[field] = regular(options[field], maximum);
  const repository = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
  const relative = path.relative(repository, options['private-key-file']);
  ensure(relative.startsWith('..') || path.isAbsolute(relative), 'private_key_must_remain_outside_repository');
  ensure(!/obsidian/iu.test(options['private-key-file']), 'private_key_vault_path_denied');
  options['journal-directory'] = fs.realpathSync(options['journal-directory']);
  const inputHashes = [['cipher-file', options['cipher-sha256']], ['package-archive', PINS.package],
    ['node-archive', PINS.node], ['fingerprint-file', options['fingerprint-sha256']]];
  options.journal = {};
  for (const [name, key, maximum] of [['metadata.json', 'journal-metadata-sha256', 16384],
    ['manifest.json', 'journal-manifest-sha256', 8 * 1024 * 1024], ['external-head.json', 'journal-head-sha256', 16384]]) {
    const filename = regular(path.join(options['journal-directory'], name), maximum);
    options.journal[name] = filename; inputHashes.push([null, options[key], filename]);
  }
  for (const [field, expected, filename] of inputHashes)
    ensure(hashFile(filename ?? options[field]) === expected, 'restore_input_digest_mismatch');
  const fingerprint = validateFingerprint(JSON.parse(fs.readFileSync(options['fingerprint-file'], 'utf8')));
  const metadata = JSON.parse(fs.readFileSync(options.journal['metadata.json'], 'utf8'));
  const head = JSON.parse(fs.readFileSync(options.journal['external-head.json'], 'utf8'));
  ensure(closed(metadata, ['backup', 'quarantined_at']) && closed(metadata.backup, ['id', 'captured_at']) &&
    metadata.backup.id === options['backup-id'] && closed(head, ['sha256', 'last_sequence']) &&
    head.sha256 === options['journal-manifest-sha256'] && Number.isSafeInteger(head.last_sequence) && head.last_sequence >= 0,
  'trusted_journal_identity_invalid');
  options.sourceFingerprint = fingerprint;
  options.fingerprintHelper = regular(path.join(path.dirname(fileURLToPath(import.meta.url)), 'fingerprint-backend-public.mjs'), 65536);
  ensure(hashFile(options.fingerprintHelper) === PINS.fingerprint, 'fingerprint_helper_pin_mismatch');
  options.output = path.resolve(options.output);
  ensure(!fs.existsSync(options.output), 'restore_receipt_already_exists');
  return options;
}

export function validatePrepareResult(value) {
  const keys = ['prepared', 'purged_chats', 'deletion_entries', 'external_generations_requiring_inventory',
    'attachment_tombstones_applied', 'preference_tombstones_applied', 'dispatches', 'release_authorized', 'next_action'];
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length ||
    !keys.every(key => Object.hasOwn(value, key)) || value.prepared !== true || value.dispatches !== 0 ||
    value.release_authorized !== false || value.next_action !== 'reconcile_current_domain_and_native_runtimes' ||
    !keys.filter(key => !['prepared', 'dispatches', 'release_authorized', 'next_action'].includes(key))
      .every(key => Number.isSafeInteger(value[key]) && value[key] >= 0)) throw Error('restore_prepare_result_invalid');
  return value;
}

// Serialized into an immutable local helper volume; RSA bytes arrive only on stdin of decrypt.
async function insideRunner(mode) {
  const fs = await import('node:fs');
  const { createHash } = await import('node:crypto');
  const { createRequire } = await import('node:module');
  const { spawnSync } = await import('node:child_process');
  const ensure = (condition, code) => { if (!condition) throw Object.assign(new Error('Restore check rejected'), { safeCode: code }); };
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  const configuration = JSON.parse(fs.readFileSync('/quarantine/control.json', 'utf8'));
  const manifest = JSON.parse(fs.readFileSync('/package/release-manifest.json', 'utf8'));
  ensure(manifest.source_sha === configuration.source_sha && manifest.deployment_eligible === true &&
    manifest.source_provenance === 'git_archive' && process.version === 'v24.22.2' &&
    hash(fs.readFileSync(process.execPath)) === manifest.runtime.executable_sha256, 'restore_package_identity_invalid');
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
  if (mode === 'prepare') {
    const child = spawnSync(process.execPath, ['/package/scripts/prepare-nodia-ai-restore.mjs', '--execute',
      '/quarantine/target.json', '/quarantine/metadata.json', '/quarantine/manifest.json', '/quarantine/external-head.json'],
    { cwd: '/package', env: process.env, encoding: 'utf8', timeout: 180000, maxBuffer: 65536 });
    ensure(child.status === 0, 'restore_prepare_failed');
    const result = validatePrepareResult(JSON.parse(child.stdout));
    process.stdout.write(JSON.stringify({ status: 'prepared', result }) + '\n'); return;
  }
  ensure(['verify', 'post-prepare'].includes(mode), 'restore_mode_invalid');
  const { Client } = createRequire('/package/package.json')('pg');
  const { default: dataSource } = await import('/package/dist/config/data-source.js');
  ensure(dataSource.options.synchronize === false, 'restore_synchronize_not_disabled');
  await dataSource.buildMetadatas();
  const expectedMigrations = dataSource.migrations.map(value => value.name ?? value.constructor.name).sort();
  ensure(expectedMigrations.length === 45 && dataSource.entityMetadatas.length === 68 &&
    dataSource.entityMetadatas.every(value => !value.schema || value.schema === 'public'), 'restore_schema_inventory_invalid');
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
    const { fingerprintPublicSchema, validateFingerprint } = await import('/harness/fingerprint-backend-public.mjs');
    const source = validateFingerprint(JSON.parse(fs.readFileSync('/quarantine/source-fingerprint.json', 'utf8')));
    const fingerprint = await fingerprintPublicSchema(client);
    if (mode === 'verify') {
      ensure(JSON.stringify(fingerprint) === JSON.stringify(source), 'restore_source_content_mismatch');
      fs.writeFileSync('/quarantine/restored-before-prepare.json', JSON.stringify(fingerprint), { flag: 'wx', mode: 0o600 });
    } else {
      const before = JSON.parse(fs.readFileSync('/quarantine/restored-before-prepare.json', 'utf8'));
      const core = ['users', 'roles', 'user_roles', 'user_modules', 'module_groups', 'modules', 'translations', 'migrations'];
      ensure(core.every(name => { const original = before.tables.find(value => value.name === name), current = fingerprint.tables.find(value => value.name === name);
        return original && current && JSON.stringify(original) === JSON.stringify(current); }), 'restore_prepare_changed_core_data');
      const row = (await client.query(`SELECT
        (SELECT count(*)::int FROM public.nodia_ai_execution_grants WHERE revoked_at IS NULL) AS grants,
        (SELECT count(*)::int FROM public.nodia_ai_confirmation_challenges) AS challenges,
        (SELECT count(*)::int FROM public.nodia_ai_proposal_revisions WHERE state IN ('draft','ready')) AS proposals,
        (SELECT count(*)::int FROM public.nodia_ai_drafts WHERE state IN ('incomplete','ready','claimed')) AS drafts,
        (SELECT count(*)::int FROM public.nodia_ai_runtime_slots WHERE state<>'unknown') AS slots,
        (SELECT count(*)::int FROM public.nodia_ai_jobs WHERE kind IN ('turn','execution','reconcile') AND
          COALESCE(recovery_descriptor->>'restore_quarantined','false')<>'true') AS markers`)).rows[0];
      ensure(Object.values(row).every(value => value === 0), 'restore_quarantine_invariants_failed');
    }
    await client.query('ROLLBACK');
    process.stdout.write(JSON.stringify({ status: mode === 'verify' ? 'verified' : 'post-prepare-verified',
      migrations_verified: 45, entity_tables_verified: 68, public_tables_verified: fingerprint.tables.length,
      fingerprint_sha256: fingerprint.aggregate_sha256, source_content_verified_before_prepare: true,
      app_or_worker_started: false, production_connections_requested: false, provider_inference_requested: false }) + '\n');
  } finally { await client.end().catch(() => {}); client.connection?.stream?.destroy(); }
}

export function restoreBackup(options) {
  const session = randomBytes(12).toString('hex'), prefix = 'nodia_restore_' + session;
  const resources = { containers: [], networks: [], volumes: [] };
  const environment = Object.fromEntries(['PATH', 'SystemRoot', 'HOME', 'USERPROFILE', 'DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_CONFIG']
    .filter(key => process.env[key]).map(key => [key, process.env[key]]));
  const call = (args, { input, timeout = 120000, check = true, maximum = 1024 * 1024 } = {}) => {
    const result = spawnSync('docker', args, { env: environment, input, timeout, maxBuffer: maximum });
    if (check) ensure(result.status === 0, 'restore_docker_operation_failed');
    return result;
  };
  const docker = (...args) => call(args).stdout.toString('utf8').trim();
  const labels = ['--label', LABEL + '=' + session];
  const volume = name => { const id = prefix + '_' + name; docker('volume', 'create', ...labels, id); resources.volumes.push(id); return id; };
  const container = (...args) => { const id = docker('create', '--pull=never', ...labels, ...args); resources.containers.push(id); return id; };
  const receipt = { schema_version: 1, status: 'failed', started_at_utc: new Date().toISOString(), session,
    backup_id: options['backup-id'], cipher_sha256: options['cipher-sha256'], package_sha256: PINS.package, node_sha256: PINS.node,
    source_sha: PINS.source, fingerprint_helper_sha256: PINS.fingerprint,
    journal_input_digests: { metadata: options['journal-metadata-sha256'], manifest: options['journal-manifest-sha256'], head: options['journal-head-sha256'] },
    source_fingerprint_file_sha256: options['fingerprint-sha256'], source_fingerprint_sha256: options.sourceFingerprint.aggregate_sha256,
    private_key_copied_to_file_or_vps: false, application_started: false, worker_started: false, provider_inference_requested: false,
    production_connections_requested: false, release_authorized: false, phase: 'validating_local_docker' };
  let secret;
  try {
    ensure(!environment.DOCKER_HOST || localDockerEndpoint(environment.DOCKER_HOST), 'remote_docker_endpoint_denied');
    const endpoint = JSON.parse(docker('context', 'inspect', docker('context', 'show'), '--format', '{{json .Endpoints.docker.Host}}'));
    ensure(localDockerEndpoint(endpoint), 'remote_docker_endpoint_denied');
    for (const image of [PINS.postgres, PINS.runner]) ensure(docker('image', 'inspect', image, '--format', '{{.Id}}') === image, 'restore_image_missing');
    const packageVolume = volume('package'), nodeVolume = volume('node'), helperVolume = volume('helper'), quarantineVolume = volume('quarantine'), dataVolume = volume('database');
    const stage = container('--network', 'none', '--mount', `type=volume,src=${packageVolume},dst=/package`,
      '--mount', `type=volume,src=${nodeVolume},dst=/node`, '--mount', `type=volume,src=${helperVolume},dst=/harness`,
      '--mount', `type=volume,src=${quarantineVolume},dst=/quarantine`, '--entrypoint', '/bin/sh', PINS.runner, '-c', 'sleep 600');
    docker('start', stage);
    for (const [source, target] of [[options['package-archive'], '/tmp/package.tar.gz'], [options['node-archive'], '/tmp/node.tar.gz'],
      [options.fingerprintHelper, '/harness/fingerprint-backend-public.mjs'], [options['cipher-file'], '/quarantine/backup.enc'],
      [options['fingerprint-file'], '/quarantine/source-fingerprint.json'], ...Object.entries(options.journal).map(([name, file]) => [file, '/quarantine/' + name])])
      docker('cp', source, stage + ':' + target);
    for (const [filename, expected] of [['/tmp/package.tar.gz', PINS.package], ['/tmp/node.tar.gz', PINS.node],
      ['/harness/fingerprint-backend-public.mjs', PINS.fingerprint], ['/quarantine/backup.enc', options['cipher-sha256']],
      ['/quarantine/source-fingerprint.json', options['fingerprint-sha256']], ['/quarantine/metadata.json', options['journal-metadata-sha256']],
      ['/quarantine/manifest.json', options['journal-manifest-sha256']], ['/quarantine/external-head.json', options['journal-head-sha256']]])
      ensure(docker('exec', stage, '/usr/bin/sha256sum', filename).split(/\s+/u)[0] === expected, 'restore_transferred_input_digest_mismatch');
    docker('exec', stage, '/bin/tar', '-xzf', '/tmp/package.tar.gz', '-C', '/package');
    docker('exec', stage, '/bin/tar', '-xzf', '/tmp/node.tar.gz', '--strip-components=1', '-C', '/node');
    const password = randomBytes(20).toString('hex'), adminPassword = randomBytes(20).toString('hex');
    const database = 'nodia_restore_' + options['backup-id'].replaceAll('-', '');
    const configuration = { source_sha: PINS.source, backup_id: options['backup-id'], cipher_sha256: options['cipher-sha256'] };
    const target = { host: 'pg', port: 5432, username: 'restore_app', password, database };
    const source = `const validatePrepareResult=${validatePrepareResult.toString()};\n(${insideRunner.toString()})(process.argv[2]).catch(error => {const code=typeof error?.safeCode==='string'&&/^[a-z0-9_]{1,100}$/.test(error.safeCode)?'restore_check_'+error.safeCode:'restore_local_runner_failed';process.stderr.write(code+'\\n');process.exitCode=1;});\n`;
    for (const [filename, contents] of [['/harness/restore.mjs', source], ['/quarantine/control.json', JSON.stringify(configuration)],
      ['/quarantine/target.json', JSON.stringify(target)]])
      call(['exec', '-i', stage, '/bin/sh', '-c', 'cat > ' + filename], { input: contents });
    docker('exec', stage, '/bin/sh', '-c', 'chmod 0755 /package /node /harness; chmod 0644 /harness/*; chown -R 1000:1000 /quarantine; chmod 0700 /quarantine; chmod 0600 /quarantine/*');
    docker('stop', stage);
    const nodeRunner = (mode, network, input) => {
      const id = container('-i', '--network', network, '--read-only', '--user', '1000:1000', '--cap-drop=ALL',
        '--security-opt=no-new-privileges', '--mount', `type=volume,src=${packageVolume},dst=/package,readonly`,
        '--mount', `type=volume,src=${nodeVolume},dst=/node,readonly`, '--mount', `type=volume,src=${helperVolume},dst=/harness,readonly`,
        '--mount', `type=volume,src=${quarantineVolume},dst=/quarantine`, '--tmpfs', '/tmp:rw,noexec,nosuid,size=16m',
        '--memory=1g', '--cpus=2', '--workdir=/package', '--entrypoint=/usr/bin/env', PINS.runner, '-i',
        'PATH=/node/bin:/usr/bin:/bin', 'HOME=/tmp', 'LANG=C.UTF-8', 'TZ=UTC', 'DOTENV_CONFIG_PATH=/dev/null',
        'NODE_ENV=production', 'RATE_LIMIT_STORAGE=redis', 'NODIA_AI_OPERATION_MODE=quarantine', 'PGSSLMODE=disable',
        'POSTGRES_HOST=pg', 'POSTGRES_PORT=5432', 'POSTGRES_DB=' + database, 'POSTGRES_USER=restore_app', 'POSTGRES_PASSWORD=' + password,
        '/node/bin/node', '/harness/restore.mjs', mode);
      const result = call(['start', '-a', '-i', id], { input, timeout: 240000, maximum: 65536, check: false });
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
    try { receipt.decryption = nodeRunner('decrypt', 'none', secret); }
    finally { secret.fill(0); secret = null; }
    ensure(receipt.decryption.status === 'decrypted' && receipt.decryption.gcm_verified === true, 'restore_decryption_not_verified');
    const network = prefix + '_internal'; docker('network', 'create', '--internal', ...labels, network); resources.networks.push(network);
    const pg = container('--network', network, '--network-alias', 'pg', '--mount', `type=volume,src=${dataVolume},dst=/var/lib/postgresql/data`,
      '--mount', `type=volume,src=${quarantineVolume},dst=/quarantine,readonly`, '-e', 'POSTGRES_USER=restore_admin',
      '-e', 'POSTGRES_DB=restore_admin', '-e', 'POSTGRES_PASSWORD=' + adminPassword, '--memory=512m', '--cpus=1', PINS.postgres);
    docker('start', pg);
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      const logs = call(['logs', pg]);
      const initialized = Buffer.concat([logs.stdout, logs.stderr]).includes(Buffer.from('PostgreSQL init process complete; ready for start up.'));
      const probe = call(['exec', pg, 'pg_isready', '-U', 'restore_admin', '-d', 'restore_admin'], { check: false });
      if (initialized && probe.status === 0) { ready = true; break; }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
    }
    ensure(ready, 'restore_postgres_startup_timeout');
    call(['exec', '-i', pg, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'restore_admin', '-d', 'restore_admin'],
      { input: `CREATE ROLE restore_app LOGIN PASSWORD '${password}';\nCREATE DATABASE ${database} OWNER restore_app;\n` });
    call(['exec', '-i', pg, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'restore_admin', '-d', database],
      { input: 'CREATE EXTENSION "uuid-ossp" WITH SCHEMA public;\nCREATE EXTENSION pg_trgm WITH SCHEMA public;\n' });
    receipt.phase = 'restoring_public_schema';
    call(['exec', '-e', 'PGPASSWORD=' + password, pg, 'pg_restore', '-h', '127.0.0.1', '-U', 'restore_app', '-d', database,
      '--schema=public', '--no-owner', '--no-acl', '--exit-on-error', '/quarantine/plaintext.custom'], { timeout: 240000 });
    receipt.phase = 'verifying_restored_contents'; receipt.before_prepare = nodeRunner('verify', network);
    ensure(receipt.before_prepare.status === 'verified', 'restore_initial_verification_failed');
    receipt.phase = 'preparing_quarantine'; receipt.preparation = nodeRunner('prepare', network);
    ensure(receipt.preparation.status === 'prepared', 'restore_quarantine_prepare_failed');
    receipt.phase = 'verifying_quarantine'; receipt.after_prepare = nodeRunner('post-prepare', network);
    ensure(receipt.after_prepare.status === 'post-prepare-verified', 'restore_post_prepare_verification_failed');
    receipt.status = 'verified'; receipt.phase = 'complete';
  } catch (error) {
    receipt.error_code = typeof error?.safeCode === 'string' && /^[a-z0-9_]{1,100}$/u.test(error.safeCode) ? error.safeCode : 'restore_local_operation_failed';
  } finally {
    secret?.fill(0);
    const errors = [];
    for (const [kind, values] of [['container', resources.containers], ['network', resources.networks], ['volume', resources.volumes]]) {
      for (const id of values.reverse()) {
        try {
          const object = JSON.parse(kind === 'container' ? docker('inspect', id) : docker(kind, 'inspect', id))[0];
          const tags = kind === 'container' ? object.Config.Labels : object.Labels;
          ensure(tags?.[LABEL] === session, 'restore_cleanup_ownership_mismatch');
          if (kind === 'container') docker('rm', '--force', '--volumes', id); else docker(kind, 'rm', id);
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
  try {
    const result = restoreBackup(parseArguments(process.argv.slice(2)));
    process.stdout.write(JSON.stringify({ status: result.status, phase: result.phase, error_code: result.error_code,
      source_content_verified: result.before_prepare?.source_content_verified_before_prepare === true,
      quarantine_prepared: result.preparation?.result?.prepared === true, cleanup: result.cleanup, release_authorized: false }) + '\n');
    process.exitCode = result.status === 'verified' ? 0 : 1;
  } catch (error) {
    const code = typeof error?.safeCode === 'string' && /^[a-z0-9_]{1,100}$/u.test(error.safeCode) ? error.safeCode : 'restore_input_invalid';
    process.stderr.write(code + '\n'); process.exitCode = 1;
  }
}
