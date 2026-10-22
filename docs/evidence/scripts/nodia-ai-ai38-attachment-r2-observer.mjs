/** Read-only SQL + exact-key R2 observer. Never uploads, deletes, lists or infers. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { chmod, lstat, mkdir, open, readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';

const descriptor = JSON.parse(readFileSync(0, 'utf8'));
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(value);
assert.equal(descriptor.stage, 'AI-38-proxy-attachments');
assert.ok(['ready', 'absent'].includes(descriptor.phase));
assert.equal(descriptor.server_root, '/opt/nodia/releases/nodia-server-ai15-20261016');
assert.equal(descriptor.env_source, descriptor.server_root + '/.env');
assert.ok(uuid(descriptor.conversation_id) && uuid(descriptor.attachment_id));
assert.ok(/^AI-38.{0,120}$/u.test(descriptor.expected_title));
assert.ok(['ai38-boundary-exact20MiB.pdf', 'ai38-small-synthetic.png', 'ai38-synthetic-silence.wav'].includes(descriptor.expected_file_name));
assert.ok(/^[a-f0-9]{64}$/u.test(descriptor.expected_sha256));
assert.ok(Number.isSafeInteger(descriptor.expected_byte_count) && descriptor.expected_byte_count > 0 && descriptor.expected_byte_count <= 20971520);
assert.equal(descriptor.ledger_path, `/opt/nodia/verification/ai38-proxy-attachments-r01/private-${descriptor.attachment_id}.json`);
const require = createRequire(descriptor.server_root + '/package.json');
const env = require('dotenv').parse(await readFile(descriptor.env_source));
const { Client } = require('pg');
const { S3Client, HeadObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
for (const name of ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME']) assert.ok(env[name]);
const db = new Client({ host: env.POSTGRES_HOST || 'localhost', port: Number(env.POSTGRES_PORT || 5432),
  database: env.POSTGRES_DB, user: env.POSTGRES_USER, password: env.POSTGRES_PASSWORD,
  connectionTimeoutMillis: 5000, application_name: 'ai38_owned_attachment_observer',
  options: '-c default_transaction_read_only=on -c statement_timeout=10000' });
const storage = new S3Client({ region: 'auto', endpoint: env.R2_ENDPOINT || `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY }, maxAttempts: 1,
  requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED' });
const report = { stage: descriptor.stage, phase: descriptor.phase, status: 'running', observed_at_utc: new Date().toISOString(),
  source_sha256: createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex'),
  conversation_id: descriptor.conversation_id, attachment_id: descriptor.attachment_id,
  sql_read_only: true, configured_sql_writes: 0, provider_requests: 0, provider_generations: 0, puts: 0, deletes: 0, listings: 0,
  signed_urls: 0, secret_or_key_or_bucket_exported: false, checks: [], cloud_reads: [] };
const check = (name, condition) => { assert.ok(condition, name); report.checks.push(name); };
const send = async (operation, key) => {
  assert.equal(key, `nodia-ai/${descriptor.conversation_id}/${descriptor.attachment_id}/${ledger.generation}`);
  const record = { operation, status: null }; report.cloud_reads.push(record);
  try {
    const command = operation === 'HEAD' ? new HeadObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key }) : new GetObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key });
    const response = await storage.send(command, { abortSignal: AbortSignal.timeout(30000) });
    record.status = response.$metadata?.httpStatusCode ?? null;
    return response;
  } catch (error) {
    record.status = error?.$metadata?.httpStatusCode ?? null;
    record.not_found = record.status === 404 && ['NotFound', 'NoSuchKey'].includes(error?.name);
    if (descriptor.phase === 'absent' && record.not_found) return null;
    throw error;
  }
};
let ledger;
let phase = 'connect';
try {
  await db.connect();
  const readOnly = (await db.query('SHOW transaction_read_only')).rows[0];
  check('PostgreSQL connection is read only', readOnly.transaction_read_only === 'on');
  const rows = (await db.query(`SELECT a.id,a.conversation_id,a.state,a.file_name,a.reserved_bytes::text,a.byte_count::text,
    a.content_hash,a.media_type,a.storage_key,a.generation,a.page_count,a.duration_seconds,c.title
    FROM nodia_ai_attachments a JOIN nodia_ai_conversations c ON c.id=a.conversation_id
    WHERE a.id=$1 AND a.conversation_id=$2`, [descriptor.attachment_id, descriptor.conversation_id])).rows;
  if (descriptor.phase === 'ready') {
    phase = 'ready_sql';
    assert.equal(rows.length, 1);
    const row = rows[0];
    check('Exact synthetic owned chat title and file name', row.title === descriptor.expected_title && row.file_name === descriptor.expected_file_name);
    check('Ready metadata equals fixture bytes and digest', row.state === 'ready' && row.content_hash === descriptor.expected_sha256 && Number(row.byte_count) === descriptor.expected_byte_count && Number(row.reserved_bytes) === descriptor.expected_byte_count);
    assert.ok(uuid(row.generation));
    assert.equal(row.storage_key, `nodia-ai/${descriptor.conversation_id}/${descriptor.attachment_id}/${row.generation}`);
    ledger = { stage: descriptor.stage, conversation_id: descriptor.conversation_id, attachment_id: descriptor.attachment_id,
      generation: row.generation, key: row.storage_key, expected_sha256: descriptor.expected_sha256,
      expected_byte_count: descriptor.expected_byte_count, expected_title: descriptor.expected_title,
      expected_file_name: descriptor.expected_file_name, media_type: row.media_type };
    await mkdir(dirname(descriptor.ledger_path), { recursive: true, mode: 0o700 });
    const parent = await lstat(dirname(descriptor.ledger_path));
    assert.ok(parent.isDirectory() && !parent.isSymbolicLink() && (parent.mode & 0o077) === 0);
    const file = await open(descriptor.ledger_path, 'wx', 0o600);
    try { await file.writeFile(JSON.stringify(ledger)); await file.sync(); } finally { await file.close(); }
    await chmod(descriptor.ledger_path, 0o600);
    phase = 'ready_cloud';
    const head = await send('HEAD', ledger.key);
    check('Real R2 HEAD confirms exact byte count and media type', head.ContentLength === descriptor.expected_byte_count && head.ContentType === row.media_type);
    const get = await send('GET', ledger.key);
    const digest = createHash('sha256'); let bytes = 0;
    assert.ok(get.Body);
    try {
      for await (const chunk of get.Body) { bytes += chunk.byteLength; assert.ok(bytes <= descriptor.expected_byte_count); digest.update(chunk); }
    } finally { get.Body.destroy?.(); }
    const actual = digest.digest('hex');
    check('Real R2 GET verifies full fixture digest', bytes === descriptor.expected_byte_count && actual === descriptor.expected_sha256);
    report.attachment = { sql_state: row.state, byte_count: bytes, actual_sha256: actual, media_type: row.media_type,
      page_count: row.page_count, duration_seconds: row.duration_seconds, head_status: head.$metadata.httpStatusCode, get_status: get.$metadata.httpStatusCode };
  } else {
    phase = 'absence_ledger';
    const info = await lstat(descriptor.ledger_path);
    assert.ok(info.isFile() && !info.isSymbolicLink() && (info.mode & 0o077) === 0);
    ledger = JSON.parse(await readFile(descriptor.ledger_path, 'utf8'));
    for (const key of ['stage', 'conversation_id', 'attachment_id', 'expected_sha256', 'expected_byte_count', 'expected_title', 'expected_file_name']) assert.equal(ledger[key], descriptor[key]);
    assert.ok(uuid(ledger.generation));
    assert.equal(ledger.key, `nodia-ai/${descriptor.conversation_id}/${descriptor.attachment_id}/${ledger.generation}`);
    check('SQL metadata no longer ready after native discard', rows.length === 0 || (rows.length === 1 && ['expired', 'rejected'].includes(rows[0].state)));
    phase = 'absence_cloud';
    check('Real R2 HEAD404 exact owned key', await send('HEAD', ledger.key) === null);
    check('Real R2 GET404 exact owned key', await send('GET', ledger.key) === null);
    const jobs = (await db.query('SELECT count(*)::int AS n FROM nodia_ai_jobs WHERE kind=$1 AND storage_key=$2 AND storage_generation=$3', ['delete_blob', ledger.key, ledger.generation])).rows[0].n;
    report.remaining_owned_cleanup_jobs = jobs;
    check('Owned deletion witness is fully settled', jobs === 0);
    report.objects_verified_absent = 1;
  }
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.safe_failure_phase = phase;
  report.safe_failure_category = error?.code === 'ERR_ASSERTION' ? 'assertion_failed' : 'dependency_or_input_error';
  process.exitCode = 1;
} finally {
  await db.end().catch(() => undefined); storage.destroy();
}
console.log(JSON.stringify(report, null, 2));
