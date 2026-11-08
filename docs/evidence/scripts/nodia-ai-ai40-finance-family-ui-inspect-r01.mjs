/** Operator only: bounded, exact-chat SQL/R2 reads. No mutations, inference, login,
 * profile access, object listings, signed URLs, message text or tool arguments.
 * Run from the pinned Server release; supply a closed JSON descriptor on stdin.
 * A prior storage_generation witness permits absent-R2 checks after an unbound
 * discard, while the exact owned chat still exists. Full chat purge is separate.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(value);
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const allowed = ['schema_version', 'conversation_id', 'expected_owner_id', 'run_id', 'attachment_id', 'r2_mode',
  'expected_sha256', 'expected_byte_count', 'expected_file_name', 'storage_generation', 'after_user_seq'];
let db, headClient, storage;
let phase = 'input', report = { schema: 'nodia-ai-ai40-finance-family-inspection-v1', status: 'not_started',
  observed_at_server_utc: new Date().toISOString(), sql_read_only: true, configured_sql_writes: 0,
  provider_requests: 0, puts: 0, deletes: 0, listings: 0, signed_urls: 0,
  private_content_emitted: false, credentials_or_storage_keys_emitted: false, native_journal_inspected: false };
try {
  let length = 0; const chunks = [];
  for await (const chunk of process.stdin) {
    length += chunk.length; assert.ok(length <= 8192); chunks.push(chunk);
  }
  const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  assert.ok(input && typeof input === 'object' && !Array.isArray(input));
  assert.ok(Object.keys(input).every(key => allowed.includes(key)));
  for (const name of allowed.slice(0, 6)) assert.ok(Object.hasOwn(input, name));
  assert.equal(input.schema_version, 1); assert.ok(uuid(input.conversation_id));
  assert.ok(typeof input.expected_owner_id === 'string' && /^[1-9]\d{0,18}$/u.test(input.expected_owner_id) && BigInt(input.expected_owner_id) <= 9223372036854775807n);
  assert.ok(input.run_id === null || uuid(input.run_id));
  assert.ok(input.attachment_id === null || uuid(input.attachment_id));
  assert.equal(input.r2_mode, 'none'); assert.equal(input.attachment_id, null);
  assert.ok(input.after_user_seq === undefined || typeof input.after_user_seq === 'string' && /^[0-9]{1,20}$/u.test(input.after_user_seq));
  if (Object.hasOwn(input, 'storage_generation')) assert.ok(uuid(input.storage_generation));
  const discoverAttachment = input.attachment_id === null && input.expected_file_name !== undefined;
  if (input.r2_mode !== 'none' || discoverAttachment) {
    assert.ok((uuid(input.attachment_id) || discoverAttachment) && hash(input.expected_sha256));
    assert.ok(Number.isSafeInteger(input.expected_byte_count) && input.expected_byte_count > 0 && input.expected_byte_count <= 20971520);
    assert.ok(typeof input.expected_file_name === 'string' && input.expected_file_name.length <= 256 && !/[\/\\\x00-\x1f\x7f]/u.test(input.expected_file_name));
    if (input.r2_mode === 'absent') assert.ok(uuid(input.attachment_id) && uuid(input.storage_generation));
  }
  report = { ...report, source_sha256: digest(await readFile(new URL(import.meta.url))),
    conversation_id: input.conversation_id, run_id: input.run_id, attachment_id: input.attachment_id, r2_mode: input.r2_mode };
  phase = 'configuration';
  const server = resolve(process.cwd());
  const require = createRequire(join(server, 'package.json'));
  assert.ok(typeof process.env.DOTENV_CONFIG_PATH === 'string' && process.env.DOTENV_CONFIG_PATH.length > 0);
  const env = { ...require('dotenv').parse(await readFile(process.env.DOTENV_CONFIG_PATH)), ...process.env };
  const { DataSource } = require('typeorm');
  db = new DataSource({ type: 'postgres', host: env.POSTGRES_HOST, port: Number(env.POSTGRES_PORT), database: env.POSTGRES_DB,
    username: env.POSTGRES_USER, password: env.POSTGRES_PASSWORD, ssl: env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    synchronize: false, migrationsRun: false, logging: false,
    extra: { connectionTimeoutMillis: 5000, statement_timeout: 5000, options: '-c default_transaction_read_only=on' } });
  phase = 'sql_snapshot'; await db.initialize();
  const snapshot = await db.transaction('REPEATABLE READ', async manager => {
    await manager.query('SET TRANSACTION READ ONLY');
    const [mode] = await manager.query('SHOW transaction_read_only'); assert.equal(mode.transaction_read_only, 'on');
    const [chat] = await manager.query(`SELECT id,owner_id::text,revision,retention_epoch,selected_connection_id::text,
      selected_mode,selected_model_id,selected_effort_id,active_job_id,next_message_seq::text,lifecycle
      FROM nodia_ai_conversations WHERE id=$1`, [input.conversation_id]);
    assert.ok(chat && chat.owner_id === input.expected_owner_id);
    if (discoverAttachment) {
      const matches = await manager.query(`SELECT id FROM nodia_ai_attachments WHERE conversation_id=$1
        AND file_name=$2 AND content_hash=$3 AND byte_count=$4::bigint ORDER BY id LIMIT 2`,
      [input.conversation_id, input.expected_file_name, input.expected_sha256, input.expected_byte_count]);
      assert.equal(matches.length, 1, 'Exact synthetic upload must resolve uniquely');
      input.attachment_id = matches[0].id;
    }
    let discoveredRun = false;
    if (input.run_id === null && input.after_user_seq !== undefined) {
      const matches = await manager.query(`SELECT r.id FROM nodia_ai_runs r JOIN nodia_ai_messages m ON m.id=r.user_message_id
        WHERE r.conversation_id=$1 AND m.conversation_id=$1 AND m.role='user' AND m.author_id=$2 AND m.seq>$3::bigint
        ORDER BY m.seq LIMIT 2`, [input.conversation_id, input.expected_owner_id, input.after_user_seq]);
      assert.ok(matches.length <= 1, 'More than one later own run; provide exact run ID');
      if (matches.length === 1) { input.run_id = matches[0].id; discoveredRun = true; }
    }
    if (input.run_id === null && input.attachment_id && input.r2_mode !== 'absent') {
      const matches = await manager.query(`SELECT DISTINCT r.id FROM nodia_ai_message_parts p
        JOIN nodia_ai_runs r ON r.user_message_id=p.message_id AND r.conversation_id=p.conversation_id
        WHERE p.conversation_id=$1 AND p.attachment_id=$2 ORDER BY r.id LIMIT 2`, [input.conversation_id, input.attachment_id]);
      assert.ok(matches.length <= 1, 'Attachment belongs to more than one run; provide the exact run ID');
      if (matches.length === 1) { input.run_id = matches[0].id; discoveredRun = true; }
    }
    const [counts] = await manager.query(`SELECT
      (SELECT count(*)::int FROM nodia_ai_messages WHERE conversation_id=$1) messages,
      (SELECT count(*)::int FROM nodia_ai_runs WHERE conversation_id=$1) runs,
      (SELECT COALESCE(sum(provider_dispatches_used),0)::int FROM nodia_ai_runs WHERE conversation_id=$1) dispatches,
      (SELECT count(*)::int FROM nodia_ai_attachments WHERE conversation_id=$1) attachments,
      (SELECT count(*)::int FROM nodia_ai_executions WHERE origin_conversation_id=$1) executions,
      (SELECT count(*)::int FROM nodia_ai_execution_steps s JOIN nodia_ai_executions e ON e.id=s.execution_id
        WHERE e.origin_conversation_id=$1 AND s.minimal_receipt IS NOT NULL) effect_receipts`, [input.conversation_id]);
    let run = null, messages = [], tools = [], attempts = [], stage_contexts = [], knowledge = [];
    if (input.run_id) {
      [run] = await manager.query(`SELECT id,state,phase,error_code,connection_id::text,
        jsonb_build_object('connection_id',selection_snapshot->>'connection_id','mode',selection_snapshot->>'mode',
          'model_id',selection_snapshot->>'model_id','effort_id',selection_snapshot->>'effort_id') AS selection_snapshot,user_message_id,assistant_message_id,
        provider_dispatches_used,tool_calls_used,mcp_rpc_messages_used,compactions_used,delegations_used,created_at,completed_at,
        context_manifest->'adapter_identity' AS adapter_identity,
        context_manifest->'verified_attachment_media_types' AS admitted_media_types,
        context_manifest->'native_context_budget' AS initial_native_budget
        FROM nodia_ai_runs WHERE id=$1 AND conversation_id=$2`, [input.run_id, input.conversation_id]);
      assert.ok(run);
      messages = await manager.query(`SELECT m.id,m.seq::text,m.role,m.status,m.client_message_id,m.sealed_at,
        p.part_index,p.kind,p.attachment_id,(p.text IS NULL) AS text_is_null
        FROM nodia_ai_messages m LEFT JOIN nodia_ai_message_parts p ON p.message_id=m.id
        WHERE m.conversation_id=$1 AND m.id IN ($2,$3) ORDER BY m.seq,p.part_index`,
      [input.conversation_id, run.user_message_id, run.assistant_message_id]);
      tools = await manager.query(`SELECT id,adapter_call_id,tool_name,state,contract_hash,arguments_hash,created_at,completed_at
        FROM nodia_ai_tool_calls WHERE run_id=$1 AND conversation_id=$2 ORDER BY created_at,id LIMIT 64`, [input.run_id, input.conversation_id]);
      attempts = await manager.query(`SELECT a.id,a.job_id,a.stage_key,a.stage_seq,a.attempt_no,a.phase,a.error_code,a.external_operation_ref,
        a.runtime_resource_key,a.runtime_fence,a.started_at,a.ended_at FROM nodia_ai_job_attempts a
        JOIN nodia_ai_jobs j ON j.id=a.job_id WHERE j.run_id=$1 AND j.conversation_id=$2 ORDER BY a.started_at,a.id LIMIT 64`,
      [input.run_id, input.conversation_id]);
      stage_contexts = await manager.query(`SELECT x.key AS attempt_id,x.value->'native_context_budget' AS native_budget,
        x.value->>'context_sha256' AS context_sha256,x.value->>'through_seq' AS through_seq FROM nodia_ai_runs r
        CROSS JOIN LATERAL jsonb_each(COALESCE(r.context_manifest->'stage_contexts','{}'::jsonb)) x
        WHERE r.id=$1 AND r.conversation_id=$2 ORDER BY x.key LIMIT 64`, [input.run_id, input.conversation_id]);
      // Project only technical knowledge identifiers; never fetch result bodies or purpose/text.
      knowledge = await manager.query(`SELECT t.id AS receipt_id,t.state,
        CASE WHEN jsonb_typeof(t.public_result->'items')='array' THEN jsonb_array_length(t.public_result->'items') ELSE NULL END AS item_count,
        (SELECT jsonb_agg(DISTINCT item->>'product_id') FROM jsonb_array_elements(
          CASE WHEN jsonb_typeof(t.public_result->'items')='array' THEN t.public_result->'items' ELSE '[]'::jsonb END) item
          WHERE item->>'product_id' ~ '^[a-z][a-z0-9_.:-]{0,127}$') AS product_ids,
        COALESCE((SELECT jsonb_agg(DISTINCT split_part(item->>'id','.',1)) FROM jsonb_array_elements(
          CASE WHEN jsonb_typeof(t.public_result->'items')='array' THEN t.public_result->'items' ELSE '[]'::jsonb END) item
          WHERE item->>'id' ~ '^[a-z][a-z0-9_-]*[.][a-zA-Z0-9_.:-]+$'), '[]'::jsonb) AS document_domains
        FROM nodia_ai_tool_calls t WHERE t.run_id=$1 AND t.conversation_id=$2 AND t.tool_name='nodia_knowledge_index'
        ORDER BY t.created_at,t.id LIMIT 16`, [input.run_id, input.conversation_id]);
    }
    const rows = input.attachment_id ? await manager.query(`SELECT id,conversation_id,kind,state,file_name,storage_key,generation,
      byte_count::text,reserved_bytes::text,media_type,content_hash,retention_epoch,interpretation_reviewed,
      interpretation_revision,interpretation_origin,(interpretation_text IS NULL) AS interpretation_text_is_null,
      processing_started_at,write_until_at FROM nodia_ai_attachments WHERE id=$1 AND conversation_id=$2`,
    [input.attachment_id, input.conversation_id]) : [];
    assert.ok(rows.length <= 1);
    const privateAttachment = rows[0] ?? null;
    if (input.r2_mode === 'present') {
      assert.ok(privateAttachment && privateAttachment.state === 'ready' && privateAttachment.kind === 'image');
      assert.equal(privateAttachment.file_name, input.expected_file_name);
      assert.equal(privateAttachment.content_hash, input.expected_sha256);
      assert.equal(Number(privateAttachment.byte_count), input.expected_byte_count);
      assert.equal(privateAttachment.retention_epoch, chat.retention_epoch);
      assert.ok(['image/png', 'image/jpeg', 'image/webp'].includes(privateAttachment.media_type));
    }
    if (input.r2_mode === 'absent') assert.ok(privateAttachment === null);
    const jobs = await manager.query(`SELECT id,run_id,kind,state,stage_key,stage_seq,fence,attempt_count,lease_until,storage_generation,
      recovery_descriptor->>'schema_version' AS descriptor_schema,
      recovery_descriptor->'runtime'->>'attempt_id' AS runtime_attempt_id,
      recovery_descriptor->'runtime'->>'connection_id' AS runtime_connection_id,
      recovery_descriptor->'runtime'->>'session_generation' AS runtime_session_generation,
      recovery_descriptor->'terminal_proof'->>'id' AS sql_terminal_proof_id,
      recovery_descriptor->'terminal_proof'->>'outcome' AS sql_terminal_outcome,
      recovery_descriptor->'terminal_proof'->>'observed_at' AS sql_terminal_observed_at FROM nodia_ai_jobs
      WHERE conversation_id=$1 OR ($2::uuid IS NOT NULL AND storage_generation=$2) ORDER BY created_at,id LIMIT 128`,
    [input.conversation_id, privateAttachment?.generation ?? input.storage_generation ?? null]);
    const slots = await manager.query(`SELECT resource_key,state,conversation_id,job_id,fence,external_operation_ref,lease_until
      FROM nodia_ai_runtime_slots WHERE conversation_id=$1 ORDER BY resource_key LIMIT 16`, [input.conversation_id]);
    const [pending] = await manager.query(`SELECT
      (SELECT count(*)::int FROM nodia_ai_jobs WHERE state IN ('ready','leased','unknown','waiting')) pending_jobs,
      (SELECT count(*)::int FROM nodia_ai_job_attempts WHERE ended_at IS NULL) open_attempts,
      (SELECT count(*)::int FROM nodia_ai_runtime_slots WHERE state<>'free') retained_slots`);
    const [historical_financial_test] = await manager.query(`SELECT count(*)::int AS rows,
      count(*) FILTER (WHERE is_active)::int AS active_rows,min(id)::text AS min_id,max(id)::text AS max_id
      FROM finance_movements WHERE id=2 AND user_id=$1 AND name='AI40-UI-CODEX-R01'`, [input.expected_owner_id]);
    // Read exactly the historical synthetic record, never another owner's finances.
    const [privateMovement] = await manager.query(`SELECT id::text,user_id::text,name,amount::text,type,status,is_active
      FROM finance_movements WHERE id=2 AND user_id=$1`, [input.expected_owner_id]);
    assert.ok(privateMovement && privateMovement.name === 'AI40-UI-CODEX-R01', 'Synthetic movement identity changed');
    const finance_fixture = { id: privateMovement.id, owner_id: privateMovement.user_id,
      name_sha256: digest(Buffer.from(privateMovement.name)), amount: privateMovement.amount,
      type: privateMovement.type, status: privateMovement.status, is_active: privateMovement.is_active,
      expected_name_matches: true };
    const assistantParts = run?.assistant_message_id ? await manager.query(`SELECT text FROM nodia_ai_message_parts
      WHERE message_id=$1 AND conversation_id=$2 AND kind='text' ORDER BY part_index LIMIT 8`,
      [run.assistant_message_id, input.conversation_id]) : [];
    const answer = assistantParts.length ? assistantParts.map(part => part.text ?? '').join('\n') : null;
    const assistant_answer = { text_sha256: answer === null ? null : digest(Buffer.from(answer)),
      utf8_bytes: answer === null ? null : Buffer.byteLength(answer), content_emitted: false,
      semantic_comparison: 'root_authenticated_UI_observation_required' };
    const privateReceipts = run ? await manager.query(`SELECT id,tool_name,state,public_result FROM nodia_ai_tool_calls
      WHERE run_id=$1 AND conversation_id=$2 AND tool_name IN ('nodia_finance_movements_list','nodia_finance_movements_get')
      ORDER BY created_at,id LIMIT 16`, [run.id, input.conversation_id]) : [];
    const finance_tool_results = privateReceipts.map(receipt => {
      const result = receipt.public_result;
      const rows = Array.isArray(result?.data) ? result.data : result?.id ? [result] : null;
      const own = rows?.filter(row => row && row.id === privateMovement.id && row.user_id === privateMovement.user_id) ?? [];
      return { receipt_id: receipt.id, tool_name: receipt.tool_name, state: receipt.state,
        public_result_sha256: result === null ? null : digest(Buffer.from(JSON.stringify(result))),
        item_count: rows?.length ?? null, matching_fixture_rows: own.length,
        fixture_fields_match: own.length === 1 && own[0].name === privateMovement.name && String(own[0].amount) === privateMovement.amount &&
          own[0].status === privateMovement.status && own[0].type === privateMovement.type,
        result_text_or_other_finances_emitted: false };
    });
    const binding = input.run_id && input.attachment_id ? messages.filter(part => part.id === run.user_message_id && part.attachment_id === input.attachment_id) : [];
    const attachment = privateAttachment ? Object.fromEntries(Object.entries(privateAttachment).filter(([key]) => !['storage_key', 'file_name'].includes(key))) : null;
    return { chat, counts, run, messages, tools, attempts, stage_contexts, knowledge, attachment, binding,
      discovery: { attachment_id_resolved_from_exact_fixture: discoverAttachment, run_id_resolved_from_unique_binding: discoveredRun, after_user_seq: input.after_user_seq ?? null },
      jobs, slots, pending, historical_financial_test, finance_fixture, assistant_answer, finance_tool_results, privateAttachment };
  });
  const { privateAttachment, ...publicSnapshot } = snapshot;
  report = { ...report, ...publicSnapshot, attachment_id: input.attachment_id, run_id: input.run_id, status: 'observed_read_only', r2: null,
    ack_evidence: 'SQL terminal descriptors are observations only; exact native journal ACK must be checked separately.' };
  if (input.r2_mode !== 'none') {
    phase = 'r2_configuration';
    for (const key of ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME']) assert.ok(env[key]);
    const generation = privateAttachment?.generation ?? input.storage_generation;
    assert.ok(uuid(generation));
    const key = `nodia-ai/${input.conversation_id}/${input.attachment_id}/${generation}`;
    if (privateAttachment) assert.equal(privateAttachment.storage_key, key);
    const { S3Client, HeadObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
    headClient = new S3Client({ region: 'auto', endpoint: env.R2_ENDPOINT || `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY }, maxAttempts: 1,
      requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED' });
    const cloud = { head_calls: 0, get_calls: 0, head_status: null, get_status: null, get_sdk_attempts: null };
    report.r2 = cloud;
    const send = async Command => {
      if (Command === HeadObjectCommand) cloud.head_calls++; else cloud.get_calls++;
      const property = Command === HeadObjectCommand ? 'head_status' : 'get_status';
      try {
        const result = await headClient.send(new Command({ Bucket: env.R2_BUCKET_NAME, Key: key }), { abortSignal: AbortSignal.timeout(30000) });
        cloud[property] = result.$metadata?.httpStatusCode ?? null; return result;
      } catch (error) {
        cloud[property] = error?.$metadata?.httpStatusCode ?? null;
        if (input.r2_mode === 'absent' && cloud[property] === 404 && ['NotFound', 'NoSuchKey'].includes(error?.name)) return null;
        throw error;
      }
    };
    phase = 'r2_head'; const head = await send(HeadObjectCommand);
    if (input.r2_mode === 'absent') {
      assert.equal(head, null); phase = 'r2_get_absence';
      const absent = await send(GetObjectCommand); absent?.Body?.destroy?.(); assert.equal(absent, null);
      assert.ok(!snapshot.jobs.some(job => job.kind === 'delete_blob' && job.storage_generation === generation && job.state !== 'done'));
      cloud.owned_generation_absent = true;
    } else {
      assert.equal(head.ContentLength, input.expected_byte_count); assert.equal(head.ContentType, privateAttachment.media_type);
      // The production GET service only downloads bytes; no Nest module/provider
      // lifecycle, authority mutation, signed URL or inference is bootstrapped.
      for (const name of ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'R2_ENDPOINT'])
        if (env[name] !== undefined) process.env[name] = env[name];
      process.env.DOTENV_CONFIG_QUIET = 'true';
      phase = 'r2_production_get';
      const { StorageService } = await import(pathToFileURL(join(server, 'dist/common/storage/storage.service.js')).href);
      storage = new StorageService(); cloud.get_calls++;
      const bytes = await storage.downloadFile(key, input.expected_byte_count, AbortSignal.timeout(30000));
      cloud.byte_count = bytes.length; cloud.sha256 = digest(bytes);
      assert.equal(cloud.byte_count, input.expected_byte_count); assert.equal(cloud.sha256, input.expected_sha256);
      cloud.production_download_completed = true;
      // GET helper does not expose HTTP metadata or SDK retry count; keep these unknown.
      cloud.original_matches_upload = true;
    }
  }
} catch (error) {
  report.status = 'inspection_failed'; report.safe_failure_phase = phase;
  report.safe_failure_category = error?.code === 'ERR_ASSERTION' ? 'scope_or_contract_mismatch' : 'dependency_or_input_error';
  process.exitCode = 1;
} finally {
  if (db?.isInitialized) await db.destroy().catch(() => {});
  headClient?.destroy(); storage?.onModuleDestroy();
}
console.log(JSON.stringify(report));
