// Operator-only, bounded READ ONLY evidence for one explicitly known chat.
// No Nodia application imports, HTTP, provider dispatch or plaintext message output.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const sha = value => createHash('sha256').update(value).digest('hex');
let phase = 'arguments';
let source;
let runner;
try {
  const { values, positionals } = parseArgs({ options: {
    runtime: { type: 'string' },
    'conversation-id': { type: 'string' },
    'expected-nonce': { type: 'string' },
  }, strict: true, allowPositionals: false });
  assert.equal(positionals.length, 0);
  const runtime = values.runtime;
  const id = values['conversation-id'];
  const nonce = values['expected-nonce'];
  assert.ok(runtime && path.isAbsolute(runtime));
  assert.match(id ?? '', /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
  if (nonce !== undefined) assert.match(nonce, /^[A-Za-z0-9_-]{8,128}$/u);
  const require = createRequire(path.join(runtime, 'package.json'));
  const { parse } = require('dotenv');
  const { DataSource } = require('typeorm');
  const envBytes = fs.readFileSync(path.join(runtime, '.env'));
  const config = parse(envBytes);
  const entityPaths = [
    'nodia-ai-conversation/entities/nodia-ai-conversation.entity.js',
    'nodia-ai-conversation/entities/nodia-ai-message.entity.js',
    'nodia-ai-conversation/entities/nodia-ai-message-part.entity.js',
    'nodia-ai-run/entities/nodia-ai-run.entity.js',
    'nodia-ai-runtime/entities/nodia-ai-job.entity.js',
    'nodia-ai-runtime/entities/nodia-ai-job-attempt.entity.js',
    'nodia-ai-runtime/entities/nodia-ai-runtime-slot.entity.js',
  ];
  const entityPins = entityPaths.map(relative => ({
    path: `dist/${relative}`, sha256: sha(fs.readFileSync(path.join(runtime, 'dist', relative))),
  }));
  phase = 'connection';
  source = new DataSource({ type: 'postgres', host: config.POSTGRES_HOST,
    port: Number(config.POSTGRES_PORT), database: config.POSTGRES_DB,
    username: config.POSTGRES_USER, password: config.POSTGRES_PASSWORD,
    ssl: config.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    synchronize: false, migrationsRun: false, logging: false,
    extra: { connectionTimeoutMillis: 5000, statement_timeout: 5000, idle_in_transaction_session_timeout: 15000 } });
  await source.initialize();
  runner = source.createQueryRunner();
  await runner.connect();
  await runner.startTransaction('REPEATABLE READ');
  await runner.query('SET TRANSACTION READ ONLY');
  const [tx] = await runner.query("SELECT current_setting('transaction_read_only') read_only, current_setting('transaction_isolation') isolation, now() observed_at_utc");
  assert.equal(tx.read_only, 'on');
  assert.equal(tx.isolation, 'repeatable read');
  phase = 'bounded_counts';
  const [counts] = await runner.query(`SELECT
    (SELECT count(*)::int FROM nodia_ai_conversations WHERE id=$1) conversations,
    (SELECT count(*)::int FROM nodia_ai_messages WHERE conversation_id=$1) messages,
    (SELECT count(*)::int FROM nodia_ai_message_parts WHERE conversation_id=$1) parts,
    (SELECT count(*)::int FROM nodia_ai_runs WHERE conversation_id=$1) runs,
    (SELECT count(*)::int FROM nodia_ai_jobs WHERE conversation_id=$1) jobs,
    (SELECT count(*)::int FROM nodia_ai_job_attempts a JOIN nodia_ai_jobs j ON j.id=a.job_id WHERE j.conversation_id=$1) attempts`, [id]);
  assert.equal(counts.conversations, 1);
  for (const [name, cap] of Object.entries({ messages: 200, parts: 1600, runs: 100, jobs: 500, attempts: 1000 })) {
    assert.ok(Number.isInteger(counts[name]) && counts[name] >= 0 && counts[name] <= cap, 'observation_cap_exceeded');
  }
  phase = 'projections';
  const [conversation] = await runner.query(`SELECT id, revision, lifecycle,
    selected_connection_id, selected_mode, selected_model_id, selected_effort_id,
    routing_enabled, routing_revision, routing_target_selection, active_job_id,
    next_message_seq, next_event_seq, last_owner_message_at, expires_at
    FROM nodia_ai_conversations WHERE id=$1`, [id]);
  const messages = await runner.query(`SELECT id, seq, role, client_message_id, status, sealed_at
    FROM nodia_ai_messages WHERE conversation_id=$1 ORDER BY seq, id`, [id]);
  // PostgreSQL's built-in sha256(bytea), not a pgcrypto extension or new function.
  const parts = await runner.query(`SELECT message_id, part_index, kind, attachment_id,
    CASE WHEN text IS NULL THEN NULL ELSE octet_length(text) END text_bytes,
    CASE WHEN text IS NULL THEN NULL ELSE encode(sha256(convert_to(text,'UTF8')),'hex') END text_sha256
    FROM nodia_ai_message_parts WHERE conversation_id=$1 ORDER BY message_id, part_index`, [id]);
  const runs = await runner.query(`SELECT id, user_message_id, assistant_message_id, state, phase,
    revision, completed_at, selection_snapshot, provider_dispatches_used, tool_calls_used,
    mcp_rpc_messages_used, compactions_used, delegations_used
    FROM nodia_ai_runs WHERE conversation_id=$1 ORDER BY id`, [id]);
  const jobs = await runner.query(`SELECT id, run_id, kind, state, stage_key, stage_seq, attempt_count, fence
    FROM nodia_ai_jobs WHERE conversation_id=$1 ORDER BY id`, [id]);
  const attempts = await runner.query(`SELECT a.id, a.job_id, a.attempt_no, a.fence, a.phase,
    a.stage_key, a.stage_seq, a.started_at, a.ended_at
    FROM nodia_ai_job_attempts a JOIN nodia_ai_jobs j ON j.id=a.job_id
    WHERE j.conversation_id=$1 ORDER BY a.id`, [id]);
  const [quiet] = await runner.query(`SELECT
    (SELECT count(*)::int FROM nodia_ai_jobs WHERE state IN ('ready','leased','waiting','unknown')) pending_jobs,
    (SELECT count(*)::int FROM nodia_ai_job_attempts WHERE ended_at IS NULL) open_attempts,
    (SELECT count(*)::int FROM nodia_ai_runtime_slots WHERE state IN ('held','unknown')) retained_slots`);
  const semantic = nonce === undefined ? null : (await runner.query(`SELECT
    count(DISTINCT m.id)::int assistant_messages,
    count(DISTINCT m.id) FILTER (WHERE position($2 in p.text)>0)::int assistant_messages_containing_nonce,
    count(DISTINCT m.id) FILTER (WHERE btrim(p.text)=$2)::int assistant_messages_exact_nonce
    FROM nodia_ai_messages m LEFT JOIN nodia_ai_message_parts p ON p.message_id=m.id AND p.conversation_id=m.conversation_id
    WHERE m.conversation_id=$1 AND m.role='assistant'`, [id, nonce]))[0];
  await runner.commitTransaction();
  const snapshot = { conversation, counts, messages, parts, runs, jobs, attempts };
  const record = { schema: 'ai38-ui-chat-snapshot-v1', status: 'observed_not_provider_or_UI_acceptance',
    observed_at_utc: tx.observed_at_utc, transaction: { read_only: true, isolation: tx.isolation },
    source_sha256: sha(fs.readFileSync(fileURLToPath(import.meta.url))),
    connection_method_reference: 'nodia-ai-ai36-c05-live-health.mjs',
    connection_method_reference_sha256: 'e4f32a756acbd2ab1ae15056352eca4429a59cb780a2ab8dfe861f9d2287f395',
    private_config_sha256: sha(envBytes), package_json_sha256: sha(fs.readFileSync(path.join(runtime, 'package.json'))),
    connection_runtime_root: runtime, entity_source_pins: entityPins,
    snapshot_sha256: sha(JSON.stringify(snapshot)), snapshot, global_quiet: quiet,
    nonce_requested: nonce !== undefined, expected_nonce_sha256: nonce === undefined ? null : sha(nonce),
    semantic, configured_SQL_writes: 0, provider_requests: 0, plaintext_parts_emitted: false,
    limits: ['Known chat only; operator evidence does not replace application authorization.',
      'No native ACK attestation; completed SQL state alone does not prove provider ACK.',
      'No HTTP requests or browser action attribution; correlate with bounded nginx observer and actual DOM.',
      'Same snapshot hash proves equality of these projected fields, not every database column.'] };
  console.log(JSON.stringify(record, null, 2));
} catch {
  // Never serialize PostgreSQL/configuration errors or command-line nonce values.
  console.error(JSON.stringify({ schema: 'ai38-ui-chat-snapshot-v1', status: 'failed', phase, diagnostic_details_withheld: true }));
  process.exitCode = 1;
} finally {
  if (runner?.isTransactionActive) await runner.rollbackTransaction().catch(() => {});
  if (runner) await runner.release().catch(() => {});
  if (source?.isInitialized) await source.destroy().catch(() => {});
}
