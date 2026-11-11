// Explicit disposable PostgreSQL/libpq TLS fixture; no operational DB, R2 or app.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nodiaAiBackupDumpEnvironment, validateNodiaAiBackupDatabaseCertificate } from '../scripts/nodia-ai-backup-database.mjs';

assert.equal(process.env.NODIA_AI_BACKUP_TLS_FIXTURE, '1', 'Explicit fixture opt-in required');
const image = process.env.NODIA_AI_POSTGRES_IMAGE;
assert.match(image ?? '', /^sha256:[a-f0-9]{64}$/u, 'Pin an already local image ID');
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'] });
const root = mkdtempSync(join(tmpdir(), 'nodia-backup-tls-'));
const container = `nodia_tls_contract_${randomUUID().replaceAll('-', '')}`;
let created = false;
const checks = [];
let result;
try {
  for (const name of ['server', 'foreign']) {
    execFileSync(process.env.NODIA_AI_OPENSSL_BINARY ?? 'openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
      '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost',
      '-keyout', join(root, `${name}.key`), '-out', join(root, `${name}.crt`)], { stdio: 'ignore', timeout: 30000 });
    chmodSync(join(root, `${name}.crt`), 0o644);
  }
  if (process.platform === 'linux') {
    await validateNodiaAiBackupDatabaseCertificate({ host: 'localhost', port: 5432, username: 'backup_tls_fixture', password: 'synthetic', database: 'backup_tls_fixture',
      tls: { mode: 'verify-full', root_cert_file: join(root, 'server.crt') } });
  }
  docker('create', '--network', 'none', '--label', 'nodia.production.tls-fixture=1', '--name', container,
    '--env', 'POSTGRES_USER=backup_tls_fixture', '--env', 'POSTGRES_DB=backup_tls_fixture', '--env', 'POSTGRES_HOST_AUTH_METHOD=trust',
    '--entrypoint', '/bin/sh', image, '-ec',
    'chown postgres:postgres /tls/server.key; chmod 0600 /tls/server.key; exec docker-entrypoint.sh postgres -c ssl=on -c ssl_cert_file=/tls/server.crt -c ssl_key_file=/tls/server.key');
  created = true;
  docker('cp', root, `${container}:/tls`);
  docker('start', container);
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    const probe = spawnSync('docker', ['exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'backup_tls_fixture', '-d', 'backup_tls_fixture'], { timeout: 3000, stdio: 'ignore' });
    if (probe.status === 0) { ready = true; break; }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.ok(ready, 'Disposable PostgreSQL did not become ready');
  docker('exec', container, 'psql', '-U', 'backup_tls_fixture', '-d', 'backup_tls_fixture', '-v', 'ON_ERROR_STOP=1', '-c',
    'CREATE TABLE tls_fixture(id integer PRIMARY KEY); INSERT INTO tls_fixture VALUES (1);');
  const dump = (host, ca) => {
    const db = { host, port: 5432, username: 'backup_tls_fixture', password: 'synthetic', database: 'backup_tls_fixture', tls: { mode: 'verify-full', root_cert_file: ca } };
    const env = nodiaAiBackupDumpEnvironment(db, 10);
    return spawnSync('docker', ['exec', ...Object.entries(env).flatMap(([key, value]) => ['--env', `${key}=${value}`]), container,
      '/usr/local/bin/pg_dump', '--format=custom', '--no-owner', '--no-acl', '--compress=0', '--no-password', '--host', db.host, '--port', String(db.port), '--username', db.username, '--dbname', db.database],
    { timeout: 15000, maxBuffer: 1024 * 1024, encoding: null });
  };
  const good = dump('localhost', '/tls/server.crt');
  assert.equal(good.status, 0, 'Verified TLS pg_dump failed');
  assert.equal(good.stdout.subarray(0, 5).toString('ascii'), 'PGDMP');
  checks.push('real_pg_dump_succeeds_with_matching_CA_and_hostname');
  const wrongCA = dump('localhost', '/tls/foreign.crt');
  assert.notEqual(wrongCA.status, 0);
  assert.match(wrongCA.stderr.toString('utf8'), /certificate verify failed/iu);
  checks.push('real_pg_dump_rejects_foreign_CA');
  const wrongHost = dump('127.0.0.1', '/tls/server.crt');
  assert.notEqual(wrongHost.status, 0);
  assert.match(wrongHost.stderr.toString('utf8'), /does not match host name/iu);
  checks.push('real_pg_dump_rejects_hostname_mismatch');
  result = { schema_version: 1, scope: 'disposable_postgresql16_libpq_TLS_only', checks,
    image_id: image, pg_dump_version: docker('exec', container, 'pg_dump', '--version').trim(),
    dump_bytes: good.stdout.length, dump_sha256: createHash('sha256').update(good.stdout).digest('hex'),
    operational_database_access: false, provider_calls: 0, r2_access: false, published_ports: 0 };
} finally {
  if (created) docker('rm', '--force', '--volumes', container);
  rmSync(root, { recursive: true, force: true });
}
process.stdout.write(JSON.stringify({ ...result, fixture_resources_removed: true }) + '\n');
