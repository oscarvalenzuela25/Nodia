import assert from 'node:assert/strict';
import { mkdtemp, writeFile, chmod, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { validateNodiaAiBackupDatabase, validateNodiaAiBackupDatabaseCertificate, nodiaAiBackupDumpEnvironment, nodiaAiBackupNodeDatabaseOptions } from '../scripts/nodia-ai-backup-database.mjs';

const database = () => ({ host: 'db.example.test', port: 5432, username: 'fixture', password: 'synthetic-secret', database: 'fixture database' });
const secured = () => ({ ...database(), tls: { mode: 'verify-full', root_cert_file: '/etc/ssl/certs/ca-certificates.crt' } });
const invalid = /nodia_ai:backup_database_invalid/u;

test('legacy five-field configuration remains valid without inheriting libpq environment', () => {
  const input = database();
  assert.equal(validateNodiaAiBackupDatabase(input), input);
  const previous = process.env.PGSSLMODE;
  process.env.PGSSLMODE = 'disable';
  try {
    assert.deepEqual(nodiaAiBackupDumpEnvironment(input, 60), {
      PATH: '/usr/bin:/bin', LANG: 'C', PGPASSWORD: 'synthetic-secret',
      PGCONNECT_TIMEOUT: '30', PGAPPNAME: 'nodia-ai-encrypted-backup',
    });
  } finally {
    if (previous === undefined) delete process.env.PGSSLMODE;
    else process.env.PGSSLMODE = previous;
  }
});

test('explicit verified TLS propagates exact CA and excludes ambient libpq settings', () => {
  const input = secured();
  const env = nodiaAiBackupDumpEnvironment(input, 5);
  assert.equal(env.PGSSLMODE, 'verify-full');
  assert.equal(env.PGSSLROOTCERT, input.tls.root_cert_file);
  assert.equal(env.PGGSSENCMODE, 'disable');
  assert.equal(env.PGCONNECT_TIMEOUT, '5');
  assert.equal(env.PGSERVICE, undefined);
  assert.equal(env.PGOPTIONS, undefined);
  assert.equal(env.NODE_EXTRA_CA_CERTS, undefined);
});

test('TLS refuses weaker modes, absent CA and open-ended configuration', () => {
  for (const tls of [null, {}, [], { mode: 'require', root_cert_file: '/ca.pem' },
    { mode: 'verify-full' }, { mode: 'verify-full', root_cert_file: 'relative.pem' },
    { mode: 'verify-full', root_cert_file: '/ca.pem\0' },
    { mode: 'verify-full', root_cert_file: '/ca.pem', rejectUnauthorized: false }]) {
    assert.throws(() => validateNodiaAiBackupDatabase({ ...database(), tls }), invalid);
  }
});

test('connection URI and conninfo cannot override --dbname TLS or credentials', () => {
  for (const name of ['postgresql://fixture@localhost/db?sslmode=disable', 'postgres://localhost/db', 'dbname=fixture sslmode=disable']) {
    assert.throws(() => validateNodiaAiBackupDatabase({ ...secured(), database: name }), invalid);
    assert.throws(() => validateNodiaAiBackupDatabase({ ...database(), database: name }), invalid);
  }
  for (const host of ['/tmp', '@socket', 'one.test,two.test', 'db.test\n']) {
    assert.throws(() => validateNodiaAiBackupDatabase({ ...secured(), host }), invalid);
  }
});

test('database remains closed and timeout/port values must be bounded integers', () => {
  for (const input of [null, [], { ...database(), sslmode: 'disable' }, { ...database(), port: 0 },
    { ...database(), port: '5432' }, { ...database(), password: '' }, { ...database(), host: 'bad\0host' }]) {
    assert.throws(() => validateNodiaAiBackupDatabase(input), invalid);
  }
  for (const timeout of [0, 3601, 1.5, NaN, '30']) assert.throws(() => nodiaAiBackupDumpEnvironment(database(), timeout), invalid);
});

test('CA must be canonical, regular, nonempty and protected from group/other writes', { skip: process.platform !== 'linux' }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'nodia-backup-ca-'));
  const ca = join(directory, 'ca.pem');
  const input = { ...database(), tls: { mode: 'verify-full', root_cert_file: ca } };
  try {
    await writeFile(ca, 'synthetic CA; libpq validates PEM on connection', { mode: 0o644 });
    await validateNodiaAiBackupDatabaseCertificate(input);
    const options = await nodiaAiBackupNodeDatabaseOptions(input);
    assert.equal(options.ssl.rejectUnauthorized, true);
    assert.equal(options.ssl.ca, 'synthetic CA; libpq validates PEM on connection');
    assert.equal(options.host, input.host);
    assert.equal((await nodiaAiBackupNodeDatabaseOptions(database())).ssl, undefined);
    await chmod(ca, 0o666);
    await assert.rejects(validateNodiaAiBackupDatabaseCertificate(input), invalid);
    await chmod(ca, 0o644);
    const link = join(directory, 'link.pem');
    await symlink(ca, link);
    await assert.rejects(validateNodiaAiBackupDatabaseCertificate({ ...input, tls: { ...input.tls, root_cert_file: link } }), invalid);
    await writeFile(ca, '');
    await assert.rejects(validateNodiaAiBackupDatabaseCertificate(input), invalid);
    await assert.rejects(validateNodiaAiBackupDatabaseCertificate({ ...input, tls: { ...input.tls, root_cert_file: join(directory, 'missing.pem') } }), invalid);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
