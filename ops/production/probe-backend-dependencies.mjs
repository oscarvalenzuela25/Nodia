#!/usr/bin/env node
// Run only through the operator's private oneshot, as nodia, in the candidate package.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function errorCode(component, error) {
  if (component === 'configuration') return 'configuration_invalid';
  const code = error?.code;
  if (['ENOTFOUND', 'EAI_AGAIN', 'ESERVFAIL'].includes(code)) return 'dns_error';
  if (['ETIMEDOUT', 'NODIA_TIMEOUT'].includes(code) || ['AbortError', 'TimeoutError'].includes(error?.name)) return 'timeout';
  if (typeof code === 'string' && (code.startsWith('ERR_TLS_') || code.startsWith('ERR_SSL_') ||
      ['CERT_HAS_EXPIRED', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN',
        'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'NODIA_TLS_INVALID'].includes(code))) return 'tls_error';
  if (['28P01', '28000'].includes(code) || (typeof error?.message === 'string' &&
      /^(WRONGPASS|NOAUTH)\b/.test(error.message))) return 'authentication_error';
  if (['ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH', 'EPIPE'].includes(code)) return 'connection_error';
  return component === 'r2' ? 'head_bucket_error' : component === 'postgres' ? 'query_error' : 'unknown';
}

const failure = (code) => Object.assign(new Error('Dependency check failed'), { code });

export function postgresMetadata(row, stream) {
  const protocol = stream?.getProtocol?.();
  if (stream?.encrypted !== true || stream?.authorized !== true || !['TLSv1.2', 'TLSv1.3'].includes(protocol)) {
    throw failure('NODIA_TLS_INVALID');
  }
  const version = Number(row?.server_version_num);
  if (row?.database_matched !== true || row.transaction_read_only !== 'on' ||
      !Number.isSafeInteger(version) || version < 1 || version > 99_999_999) throw failure('NODIA_QUERY_INVALID');
  return { status: 'passed', database_matched: true, server_version_num: version, transaction_read_only: true,
    client_tls_authorized: true, client_tls_protocol: protocol,
    backend_tls: typeof row.backend_tls === 'boolean' ? row.backend_tls : null };
}

async function closeClient(action, destroy) {
  let timer;
  try {
    await Promise.race([Promise.resolve().then(action), new Promise((_, reject) => {
      timer = setTimeout(() => reject(failure('NODIA_TIMEOUT')), 2000);
    })]);
  } catch { /* Always destroy locally; never log a client exception or retry. */ }
  finally { clearTimeout(timer); try { destroy(); } catch { /* Already closed. */ } }
}

async function postgres(require, environment) {
  const { Client } = require('pg');
  const client = new Client({ host: environment.POSTGRES_HOST, port: Number(environment.POSTGRES_PORT),
    database: environment.POSTGRES_DB, user: environment.POSTGRES_USER, password: environment.POSTGRES_PASSWORD,
    // Deliberately leave ssl undefined: use PGSSLMODE=verify-full, as the actual backend does.
    sslnegotiation: 'postgres', application_name: 'nodia-production-dependency-probe',
    connectionTimeoutMillis: 10_000, query_timeout: 10_000, statement_timeout: 10_000,
    options: '-c default_transaction_read_only=on -c lock_timeout=3000' });
  client.on('error', () => {});
  let transaction = false;
  try {
    await client.connect();
    await client.query('BEGIN READ ONLY');
    transaction = true;
    const result = await client.query(`SELECT current_database() = $1 AS database_matched,
      current_setting('server_version_num') AS server_version_num,
      current_setting('transaction_read_only') AS transaction_read_only,
      tls.ssl AS backend_tls FROM (SELECT 1) AS probe
      LEFT JOIN pg_stat_ssl AS tls ON tls.pid = pg_backend_pid()`, [environment.POSTGRES_DB]);
    const metadata = postgresMetadata(result.rows[0], client.connection.stream);
    transaction = false;
    await client.query('ROLLBACK');
    return metadata;
  } finally {
    if (transaction) await client.query('ROLLBACK').catch(() => {});
    await closeClient(() => client.end(), () => client.connection?.stream?.destroy());
  }
}

async function redis(require, environment) {
  const { Redis } = require('ioredis');
  const client = new Redis({ host: environment.REDIS_HOST, port: Number(environment.REDIS_PORT),
    lazyConnect: true, enableOfflineQueue: false, disableClientInfo: true,
    enableReadyCheck: false, connectTimeout: 4000, commandTimeout: 3000,
    maxRetriesPerRequest: 1, retryStrategy: () => null });
  client.on('error', () => {});
  try {
    await client.connect();
    // Explicit AUTH once: ioredis auto-auth otherwise tolerates a password-less server with a warning.
    if (await client.auth(environment.REDIS_PASSWORD) !== 'OK') throw failure('NODIA_REDIS_INVALID');
    if (await client.ping() !== 'PONG') throw failure('NODIA_REDIS_INVALID');
    return { status: 'passed', authenticated_ping: true };
  } finally { await closeClient(() => client.quit(), () => client.disconnect()); }
}

async function r2(require, environment) {
  const { S3Client, HeadBucketCommand } = require('@aws-sdk/client-s3');
  const client = new S3Client({ region: 'auto', endpoint: environment.R2_ENDPOINT, maxAttempts: 1,
    credentials: { accessKeyId: environment.R2_ACCESS_KEY_ID, secretAccessKey: environment.R2_SECRET_ACCESS_KEY },
    requestHandler: { connectionTimeout: 1000, requestTimeout: 4500 },
    requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED' });
  try {
    const response = await client.send(new HeadBucketCommand({ Bucket: environment.R2_BUCKET_NAME }),
      { abortSignal: AbortSignal.timeout(5000) });
    if (response.$metadata?.httpStatusCode !== 200) throw failure('NODIA_HEAD_BUCKET_INVALID');
    return { status: 'passed', head_bucket: true };
  } finally { client.destroy(); }
}

export async function probeDependencies() {
  const result = { schema_version: 1, status: 'failed', checks: { local_configuration: 'not_run',
    postgres: { status: 'not_run' }, redis: { status: 'not_run' }, r2: { status: 'not_run' } },
  application_started: false, migrations_executed: false, mutations_requested: false };
  let component = 'configuration';
  try {
    const { validateRuntimeEnvironment } = await import('/usr/local/lib/nodia/validate-runtime-env.mjs');
    await validateRuntimeEnvironment();
    result.checks.local_configuration = 'passed';
    const require = createRequire(resolve(process.cwd(), 'package.json'));
    for (const [name, operation] of [['postgres', postgres], ['redis', redis], ['r2', r2]]) {
      component = name;
      result.checks[name] = await operation(require, process.env);
    }
    result.status = 'verified';
  } catch (error) {
    result.failed_component = component;
    result.error_code = errorCode(component, error);
  }
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await probeDependencies();
  process.stdout.write(JSON.stringify(result) + '\n');
  process.exitCode = result.status === 'verified' ? 0 : 1;
}
