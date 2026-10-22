/** Exact synthetic-chat attachment discovery. Read-only SQL, no storage or app. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const input = JSON.parse(readFileSync(0, 'utf8'));
assert.equal(input.stage, 'AI-38-proxy-attachments');
assert.equal(input.server_root, '/opt/nodia/releases/nodia-server-ai15-20261016');
assert.ok(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(input.conversation_id));
assert.ok(/^AI-38.{0,120}$/u.test(input.expected_title));
assert.ok(['ai38-boundary-exact20MiB.pdf', 'ai38-boundary-over20MiB.pdf', 'ai38-small-synthetic.png', 'ai38-synthetic-silence.wav'].includes(input.expected_file_name));
const require = createRequire(input.server_root + '/package.json');
const env = require('dotenv').parse(await readFile(input.server_root + '/.env'));
const { Client } = require('pg');
const db = new Client({ host: env.POSTGRES_HOST || 'localhost', port: Number(env.POSTGRES_PORT || 5432),
  database: env.POSTGRES_DB, user: env.POSTGRES_USER, password: env.POSTGRES_PASSWORD,
  connectionTimeoutMillis: 5000, application_name: 'ai38_owned_attachment_discover',
  options: '-c default_transaction_read_only=on -c statement_timeout=10000' });
const report = { stage: input.stage, action: 'discover', status: 'running', observed_at_utc: new Date().toISOString(),
  source_sha256: createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex'),
  conversation_id: input.conversation_id, expected_file_name: input.expected_file_name,
  sql_read_only: true, configured_sql_writes: 0, provider_requests: 0, storage_operations: 0,
  storage_keys_or_secrets_emitted: false };
try {
  await db.connect();
  assert.equal((await db.query('SHOW transaction_read_only')).rows[0].transaction_read_only, 'on');
  const chats = (await db.query('SELECT title FROM nodia_ai_conversations WHERE id=$1', [input.conversation_id])).rows;
  assert.equal(chats.length, 1); assert.equal(chats[0].title, input.expected_title);
  const all = (await db.query('SELECT count(*)::int AS n FROM nodia_ai_attachments WHERE conversation_id=$1', [input.conversation_id])).rows[0].n;
  assert.ok(all <= 8, 'Synthetic drill scope exceeded');
  const rows = (await db.query(`SELECT id AS attachment_id,state,reserved_bytes::text,byte_count::text,content_hash,
      media_type,page_count,duration_seconds,interpretation_origin,interpretation_revision,interpretation_reviewed
    FROM nodia_ai_attachments WHERE conversation_id=$1 AND file_name=$2 ORDER BY created_at,id LIMIT 9`,
  [input.conversation_id, input.expected_file_name])).rows;
  assert.ok(rows.length <= 8);
  report.chat_attachment_count = all; report.matching_attachment_count = rows.length; report.attachments = rows;
  report.status = 'passed';
} catch {
  report.status = 'failed'; report.safe_failure_category = 'metadata_input_or_database_unavailable'; process.exitCode = 1;
} finally { await db.end().catch(() => undefined); }
console.log(JSON.stringify(report, null, 2));
