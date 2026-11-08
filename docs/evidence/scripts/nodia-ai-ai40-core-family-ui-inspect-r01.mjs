// Operator-only aggregate Core oracle and own-run receipt projection. No SDK, profile, R2 or mutation.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const digest = value => createHash('sha256').update(value).digest('hex');
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(value);
const expectedArguments = Object.freeze({ page: 1, limit: 1, active: 'all', q: { s: 'id asc' } });
let db, phase = 'input';
let report = { schema: 'nodia-ai-ai40-core-family-inspection-v1', status: 'not_started',
  sql_read_only: true, configured_sql_writes: 0, provider_requests: 0, profile_accessed: false,
  private_content_emitted: false, credentials_or_storage_keys_emitted: false };
try {
  let bytes = 0; const chunks = [];
  for await (const chunk of process.stdin) { bytes += chunk.length; assert.ok(bytes <= 4096); chunks.push(chunk); }
  const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  const fields = ['schema_version', 'conversation_id', 'expected_owner_id', 'authority_run_id', 'run_id', 'after_user_seq'];
  assert.ok(input && !Array.isArray(input) && Object.keys(input).sort().join(',') === fields.sort().join(','));
  assert.equal(input.schema_version, 1); assert.ok(uuid(input.conversation_id) && uuid(input.authority_run_id));
  assert.ok(typeof input.expected_owner_id === 'string' && /^[1-9]\d{0,18}$/u.test(input.expected_owner_id) && BigInt(input.expected_owner_id) <= 9223372036854775807n);
  assert.ok(input.run_id === null || uuid(input.run_id));
  assert.ok(typeof input.after_user_seq === 'string' && /^(0|[1-9]\d{0,18})$/u.test(input.after_user_seq) && BigInt(input.after_user_seq) <= 9223372036854775807n);
  report = { ...report, source_sha256: digest(await readFile(new URL(import.meta.url))),
    conversation_id: input.conversation_id, run_id: input.run_id, authority_run_id: input.authority_run_id };
  phase = 'publication_schema';
  const server = resolve(process.cwd()), require = createRequire(join(server, 'package.json'));
  assert.ok(process.env.DOTENV_CONFIG_PATH);
  const env = { ...require('dotenv').parse(await readFile(process.env.DOTENV_CONFIG_PATH)), ...process.env };
  const manifest = JSON.parse(await readFile(join(server, 'dist/nodia-ai/knowledge/manifest.json'), 'utf8'));
  const contracts = manifest.capability_contracts.filter(cap => cap.capability_id === 'nodia_modules_list');
  assert.equal(contracts.length, 1); const capability = contracts[0];
  assert.equal(capability.publication, 'published'); assert.equal(capability.kind, 'read');
  assert.deepEqual(capability.required_module_routes, ['/settings/modules']);
  assert.equal(capability.input_schema.definition, 'ModuleQuery');
  assert.equal(capability.output_schema.definition, 'ModulePage');
  const schemaBytes = await readFile(join(server, 'dist/nodia-ai-products/contracts/core-settings.schema.json'));
  assert.equal(digest(schemaBytes), capability.input_schema.sha256);
  assert.equal(digest(schemaBytes), capability.output_schema.sha256);
  const schema = JSON.parse(schemaBytes);
  const { Ajv2020 } = require('ajv/dist/2020.js'), addFormats = require('ajv-formats');
  const ajv = new Ajv2020({ strict: true, allErrors: true }); addFormats(ajv); ajv.addSchema(schema);
  const validateInput = ajv.compile({ $ref: schema.$id + '#/$defs/ModuleQuery' });
  const validateMeta = ajv.compile({ $ref: schema.$id + '#/$defs/Meta' });
  assert.equal(validateInput(expectedArguments), true);
  report.publication = { knowledge_release: manifest.release_id, capability_id: capability.capability_id,
    revision: capability.revision, kind: capability.kind, required_module_routes: capability.required_module_routes,
    input_schema_sha256: digest(schemaBytes), input_definition: 'ModuleQuery', output_definition: 'ModulePage',
    validated_expected_arguments: expectedArguments };
  const { DataSource } = require('typeorm');
  db = new DataSource({ type: 'postgres', host: env.POSTGRES_HOST, port: Number(env.POSTGRES_PORT), database: env.POSTGRES_DB,
    username: env.POSTGRES_USER, password: env.POSTGRES_PASSWORD, ssl: env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    synchronize: false, migrationsRun: false, installExtensions: false, logging: false,
    extra: { connectionTimeoutMillis: 5000, statement_timeout: 5000, options: '-c default_transaction_read_only=on' } });
  const { NodiaAiAuthorizationService } = await import(pathToFileURL(join(server, 'dist/nodia-ai/nodia-ai-authorization.service.js')));
  const { AuthorizeNodiaAiUseCase } = await import(pathToFileURL(join(server, 'dist/nodia-ai/use-case/authorize-nodia-ai.use-case.js')));
  phase = 'authority'; await db.initialize();
  const snapshot = await db.transaction('REPEATABLE READ', async manager => {
    await manager.query('SET TRANSACTION READ ONLY');
    const [mode] = await manager.query('SHOW transaction_read_only'); assert.equal(mode.transaction_read_only, 'on');
    const [chat] = await manager.query('SELECT id,owner_id::text,revision,active_job_id,lifecycle,next_message_seq::text FROM nodia_ai_conversations WHERE id=$1', [input.conversation_id]);
    assert.ok(chat && chat.owner_id === input.expected_owner_id);
    assert.equal(chat.lifecycle, 'active');
    const identities = await manager.query(`SELECT g.session_public_id::text FROM nodia_ai_execution_grants g
      JOIN nodia_ai_runs run ON run.id=g.run_id
      WHERE run.id=$1 AND run.conversation_id=$2 AND run.actor_id=$3 AND g.actor_id=$3 LIMIT 2`,
    [input.authority_run_id, input.conversation_id, input.expected_owner_id]);
    assert.equal(identities.length, 1); assert.ok(uuid(identities[0].session_public_id));
    const identity = { userId: input.expected_owner_id, sessionId: identities[0].session_public_id };
    const authorizer = new AuthorizeNodiaAiUseCase(new NodiaAiAuthorizationService(db));
    phase = 'authority';
    // Revalidate this exact historical session. Never discover another/latest session on failure.
    const actor = await authorizer.execute(identity, {}, manager); assert.equal(actor.isSuperAdmin, true);
    phase = 'target_module';
    const route = '/settings/modules';
    const [moduleState] = await manager.query(`SELECT count(*)::integer matching_rows,
      bool_and(module.is_active) AS module_active,bool_and(grp.is_active) AS group_active
      FROM modules module JOIN module_groups grp ON grp.id=module.module_group_id WHERE module.link=$1`, [route]);
    const allowed = actor.modules.some(module => module.route === route);
    const module_state = { route, ...moduleState, authorized_by_current_backend: allowed };
    const blockers = allowed ? [] : [{ route, reason: moduleState.matching_rows === 0 ? 'module_missing' : 'module_inactive_ambiguous_or_not_authorized' }];
    let module_total = null, catalog_metadata_sha256 = null;
    if (allowed) {
      await authorizer.execute(identity, { moduleRoutes: [route] }, manager);
      phase = 'oracle';
      const [oracle] = await manager.query(`SELECT count(*)::integer total,
        encode(sha256(convert_to(COALESCE(string_agg(id::text||':'||is_active::text||':'||updated_at::text,E'\n' ORDER BY id),''),'UTF8')),'hex') AS metadata_sha256 FROM modules`);
      module_total = oracle.total; catalog_metadata_sha256 = oracle.metadata_sha256;
    }
    phase = 'run_receipts';
    if (input.run_id === null) {
      const runs = await manager.query(`SELECT run.id FROM nodia_ai_runs run JOIN nodia_ai_messages message ON message.id=run.user_message_id
        WHERE run.conversation_id=$1 AND run.actor_id=$2 AND message.conversation_id=$1
        AND message.author_id=$2 AND message.role='user' AND message.seq>$3::bigint ORDER BY message.seq LIMIT 2`,
      [input.conversation_id, input.expected_owner_id, input.after_user_seq]);
      assert.ok(runs.length <= 1, 'More than one later own run; supply exact ID');
      if (runs.length === 1) input.run_id = runs[0].id;
    }
    let run = null, attempts = [], tools = [], core_receipts = [], assistant_answer = null;
    if (input.run_id) {
      phase = 'run_receipts';
      [run] = await manager.query(`SELECT run.id,run.state,run.phase,run.error_code,run.provider_dispatches_used,run.tool_calls_used,
        run.mcp_rpc_messages_used,run.compactions_used,run.user_message_id,run.assistant_message_id,run.created_at,run.completed_at,message.seq::text AS user_seq
        FROM nodia_ai_runs run JOIN nodia_ai_messages message ON message.id=run.user_message_id
        WHERE run.id=$1 AND run.conversation_id=$2 AND run.actor_id=$3 AND message.conversation_id=$2
        AND message.author_id=$3 AND message.role='user' AND message.seq>$4::bigint`,
      [input.run_id, input.conversation_id, input.expected_owner_id, input.after_user_seq]); assert.ok(run);
      attempts = await manager.query(`SELECT attempt.id,attempt.job_id,attempt.stage_key,attempt.stage_seq,attempt.phase,attempt.external_operation_ref,
        attempt.runtime_fence,attempt.error_code,attempt.started_at,attempt.ended_at FROM nodia_ai_job_attempts attempt
        JOIN nodia_ai_jobs job ON job.id=attempt.job_id WHERE job.run_id=$1 AND job.conversation_id=$2 ORDER BY attempt.started_at,attempt.id LIMIT 32`, [run.id, input.conversation_id]);
      tools = await manager.query(`SELECT id,tool_name,state,contract_hash,arguments_hash,created_at,completed_at,
        CASE WHEN tool_name='nodia_capabilities_select' THEN (arguments->'capability_ids') @> '["nodia_modules_list"]'::jsonb ELSE NULL END AS selects_expected_capability
        FROM nodia_ai_tool_calls WHERE run_id=$1 AND conversation_id=$2 ORDER BY created_at,id LIMIT 16`, [run.id, input.conversation_id]);
      const receipts = await manager.query(`SELECT id,state,arguments=$3::jsonb AS exact_expected_arguments,public_result->'meta' AS meta,
        CASE WHEN jsonb_typeof(public_result->'data')='array' THEN jsonb_array_length(public_result->'data') ELSE NULL END AS page_rows,
        CASE WHEN public_result IS NULL THEN NULL ELSE encode(sha256(convert_to(public_result::text,'UTF8')),'hex') END AS result_sha256
        FROM nodia_ai_tool_calls WHERE run_id=$1 AND conversation_id=$2 AND tool_name='nodia_modules_list' ORDER BY created_at,id LIMIT 8`,
      [run.id, input.conversation_id, expectedArguments]);
      core_receipts = receipts.map(({ meta, ...entry }) => ({ ...entry,
        output_meta_schema_valid: validateMeta(meta) === true,
        meta: Object.fromEntries(['page', 'limit', 'total_items', 'total_pages'].map(key => [key, Number.isSafeInteger(meta?.[key]) ? meta[key] : null])),
        total_matches_authorized_sql: module_total === null ? null : meta?.total_items === module_total,
        page_rows_within_limit: Number.isSafeInteger(entry.page_rows) && entry.page_rows >= 0 && entry.page_rows <= 1 }));
      if (run.assistant_message_id) {
        const [answer] = await manager.query(`SELECT COALESCE(string_agg(text,E'\n' ORDER BY part_index),'') AS text
          FROM nodia_ai_message_parts WHERE message_id=$1 AND conversation_id=$2 AND kind='text'`, [run.assistant_message_id, input.conversation_id]);
        const numeric = /^[0-9]+$/u.test(answer.text.trim());
        assistant_answer = { sha256: digest(answer.text), utf8_bytes: Buffer.byteLength(answer.text),
          numeric_only_total_matches: module_total === null ? null : numeric && BigInt(answer.text.trim()) === BigInt(module_total) };
      }
    }
    const [counts] = await manager.query(`SELECT (SELECT count(*)::int FROM nodia_ai_messages WHERE conversation_id=$1) messages,
      (SELECT count(*)::int FROM nodia_ai_runs WHERE conversation_id=$1) runs,
      (SELECT COALESCE(sum(provider_dispatches_used),0)::int FROM nodia_ai_runs WHERE conversation_id=$1) dispatches,
      (SELECT count(*)::int FROM nodia_ai_attachments WHERE conversation_id=$1) attachments,
      (SELECT count(*)::int FROM nodia_ai_executions WHERE origin_conversation_id=$1) executions,
      (SELECT count(*)::int FROM nodia_ai_execution_steps step JOIN nodia_ai_executions execution ON execution.id=step.execution_id
        WHERE execution.origin_conversation_id=$1 AND step.minimal_receipt IS NOT NULL) effect_receipts`, [input.conversation_id]);
    const [pending] = await manager.query(`SELECT (SELECT count(*)::int FROM nodia_ai_jobs WHERE state IN ('ready','leased','unknown','waiting')) pending_jobs,
      (SELECT count(*)::int FROM nodia_ai_job_attempts WHERE ended_at IS NULL) open_attempts,
      (SELECT count(*)::int FROM nodia_ai_runtime_slots WHERE state<>'free') retained_slots`);
    return { chat, current_actor: { id: actor.actorId, active_session_revalidated: true, is_super_admin: true, session_identifier_emitted: false },
      module_state, oracle: { module_total, catalog_metadata_sha256, scope: 'global catalog, all activity, only after exact current super_admin and target module authorization; no rows emitted' },
      blockers, counts, pending, run, attempts, tools, core_receipts, assistant_answer };
  });
  report = { ...report, ...snapshot, run_id: input.run_id, status: snapshot.blockers.length ? 'blocked_by_target_module' : 'observed_read_only' };
} catch (error) {
  const response = typeof error?.getResponse === 'function' ? error.getResponse() : null;
  const code = typeof response?.message === 'string' ? response.message : null;
  report.status = code === 'auth:session_expired' ? 'blocked_by_historical_session' : 'inspection_failed';
  report.safe_failure_phase = ['input', 'publication_schema', 'authority', 'target_module', 'oracle', 'run_receipts'].includes(phase) ? phase : 'input';
  report.safe_failure_code = ['auth:session_expired', 'nodia_ai:capability_denied'].includes(code) ? code : null;
  report.safe_http_status = [401, 403].includes(error?.getStatus?.()) ? error.getStatus() : null;
  report.safe_failure_category = code === 'auth:session_expired' ? 'historical_session_unavailable' : error?.code === 'ERR_ASSERTION' ? 'scope_or_contract_mismatch' : 'dependency_or_input_error';
  process.exitCode = 1;
} finally { if (db?.isInitialized) await db.destroy().catch(() => {}); }
process.stdout.write(JSON.stringify(report) + '\n');
