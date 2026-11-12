import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { errorCode, postgresMetadata } from '../probe-backend-dependencies.mjs';

test('errors disclose only fixed categories even when providers embed credentials', () => {
  const message = 'SYNTHETIC_PASSWORD_MUST_NOT_APPEAR postgresql://fixture:secret@example.invalid';
  const cases = [['configuration', { code: 'ANY', message }, 'configuration_invalid'],
    ['postgres', { code: '28P01', message }, 'authentication_error'],
    ['postgres', { code: 'ERR_TLS_CERT_ALTNAME_INVALID', message }, 'tls_error'],
    ['postgres', { code: 'EAI_AGAIN', message }, 'dns_error'],
    ['redis', { code: 'ECONNREFUSED', message }, 'connection_error'],
    ['redis', { message: 'WRONGPASS ' + message }, 'authentication_error'],
    ['r2', { name: 'TimeoutError', message }, 'timeout'], ['r2', { message }, 'head_bucket_error']];
  for (const [component, error, expected] of cases) {
    assert.equal(errorCode(component, error), expected);
    assert.equal(errorCode(component, error).includes(message), false);
  }
});

const row = { database_matched: true, server_version_num: '160014', transaction_read_only: 'on', backend_tls: true };
const stream = { encrypted: true, authorized: true, getProtocol: () => 'TLSv1.3' };

test('metadata requires an authorized TLS socket, expected database and read-only transaction', () => {
  assert.deepEqual(postgresMetadata(row, stream), { status: 'passed', database_matched: true,
    server_version_num: 160014, transaction_read_only: true, client_tls_authorized: true,
    client_tls_protocol: 'TLSv1.3', backend_tls: true });
  assert.throws(() => postgresMetadata(row, { ...stream, authorized: false }), { code: 'NODIA_TLS_INVALID' });
  assert.throws(() => postgresMetadata({ ...row, database_matched: false }, stream), { code: 'NODIA_QUERY_INVALID' });
  assert.throws(() => postgresMetadata({ ...row, transaction_read_only: 'off' }, stream), { code: 'NODIA_QUERY_INVALID' });
  assert.throws(() => postgresMetadata({ ...row, server_version_num: 'secret-provider-payload' }, stream), { code: 'NODIA_QUERY_INVALID' });
});

test('backend TLS remains separate from client authorization and never invents a missing value', () => {
  assert.equal(postgresMetadata({ ...row, backend_tls: null }, stream).backend_tls, null);
  assert.equal(postgresMetadata({ ...row, backend_tls: false }, stream).backend_tls, false);
});

test('CLI configuration failure emits one fixed JSON record and no raw exception', () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../probe-backend-dependencies.mjs', import.meta.url))],
    { encoding: 'utf8', env: { PATH: process.env.PATH, NODE_ENV: 'test' }, timeout: 5000 });
  assert.equal(result.status, 1);
  assert.equal(result.stderr, '');
  assert.deepEqual(JSON.parse(result.stdout), { schema_version: 1, status: 'failed',
    checks: { local_configuration: 'not_run', postgres: { status: 'not_run' },
      redis: { status: 'not_run' }, r2: { status: 'not_run' } },
    application_started: false, migrations_executed: false, mutations_requested: false,
    failed_component: 'configuration', error_code: 'configuration_invalid' });
});
