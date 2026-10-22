// Read-only operational SQL after disposable real-provider work; no inference.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const runtime = process.argv[2];
assert.ok(runtime && path.isAbsolute(runtime));
const require = createRequire(path.join(runtime, 'package.json'));
const { parse } = require('dotenv'), { DataSource } = require('typeorm');
const config = parse(fs.readFileSync(path.join(runtime, '.env')));
const source = new DataSource({ type: 'postgres', host: config.POSTGRES_HOST,
  port: Number(config.POSTGRES_PORT), database: config.POSTGRES_DB,
  username: config.POSTGRES_USER, password: config.POSTGRES_PASSWORD,
  ssl: config.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  synchronize: false, migrationsRun: false });
await source.initialize();
const manager = source.createQueryRunner();
try {
  await manager.connect(); await manager.startTransaction();
  await manager.query('SET TRANSACTION READ ONLY');
  const [value] = await manager.query(`SELECT
    (SELECT count(*)::int FROM nodia_ai_jobs WHERE state IN ('ready','leased','waiting','unknown')) pending_jobs,
    (SELECT count(*)::int FROM nodia_ai_job_attempts WHERE ended_at IS NULL) open_attempts,
    (SELECT count(*)::int FROM nodia_ai_runtime_slots WHERE state IN ('held','unknown')) retained_slots,
    (SELECT count(*)::int FROM nodia_ai_conversations WHERE id='33d6c32d-19a3-4533-8077-3ca7299d30cb') preserved_r05_chat`);
  await manager.commitTransaction();
  assert.equal(value.pending_jobs, 0); assert.equal(value.open_attempts, 0);
  assert.equal(value.retained_slots, 0); assert.equal(value.preserved_r05_chat, 1);
  console.log(JSON.stringify({ stage: 'AI-36-C05', scope: 'post_disposable_live_read_only_operational_quiescence',
    status: 'passed', observed_at_utc: new Date().toISOString(), ...value,
    configured_SQL_writes: 0, provider_requests: 0, storage_operations: 0, services_restarted: false,
    source_sha256: createHash('sha256').update(fs.readFileSync(fileURLToPath(import.meta.url))).digest('hex') }, null, 2));
} finally {
  if (manager.isTransactionActive) await manager.rollbackTransaction();
  await manager.release(); await source.destroy();
}
