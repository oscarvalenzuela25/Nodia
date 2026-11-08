// OPERATOR ONLY. R08 readonly continuity inspection, no SDK, replay or writes.
// Database options arrive by private stdin; runtime descriptors are technical,
// non-auth witnesses for the separate native reader and stay in private receipts.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual as equal } from 'node:util';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const ROOT = '/opt/nodia/releases/nodia-server-ai40-r08';
const RELEASE = '08145edaefff382ba2ccbbf8d51c325de630feeef5b67a1834651b1cdd6577bc';
const CHAT = 'ec626b72-1f32-4486-9f3a-8263cffce267';
const OWNER = '1';
const AUTHORITY = '8e4c0db1-6b07-4524-a1cf-f33d09210766';
const MARKERS = { gemini: 'AI40-CONTINUITY-GEMINI-R01', codex: 'AI40-CONTINUITY-CODEX-R01' };
const sha = value => createHash('sha256').update(value).digest('hex');
const exact = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && equal(Object.keys(value).sort(), [...keys].sort());
const id = value => typeof value === 'string' && /^[1-9]\d{0,18}$/u.test(value) && BigInt(value) <= 9223372036854775807n;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const selectionValid = value => exact(value, ['connection_id', 'mode', 'model_id', 'effort_id']) && id(value.connection_id)
  && ['token_plan_web', 'token_plan_agentic'].includes(value.mode)
  && typeof value.model_id === 'string' && value.model_id.trim() !== '' && Buffer.byteLength(value.model_id) <= 1024
  && (value.effort_id === null || typeof value.effort_id === 'string' && value.effort_id.trim() !== '' && Buffer.byteLength(value.effort_id) <= 256);
const refs = values => [...values].sort((a, b) => a.preference_id.localeCompare(b.preference_id));
let phase = 'input_contract', db;
const report = { schema: 'nodia-ai-ai40-provider-continuity-readonly-v1', status: 'not_started',
  SQL_writes: 0, SDK_requests: 0, provider_observations: 0, provider_generations: 0,
  profile_accessed_by_script: false, physical_native_ACK_verified_by_this_script: false,
  credentials_or_raw_messages_emitted: false, runtime_descriptors_private_receipt_only: true };
try {
  const chunks = []; let size = 0;
  for await (const chunk of process.stdin) { size += chunk.length; assert.ok(size <= 16384); chunks.push(chunk); }
  const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  assert.ok(exact(input, ['schema_version', 'conversation_id', 'expected_owner_id', 'authority_run_id', 'expected_runs', 'selections', 'database']));
  assert.equal(input.schema_version, 1); assert.equal(input.conversation_id, CHAT);
  assert.equal(input.expected_owner_id, OWNER); assert.equal(input.authority_run_id, AUTHORITY);
  assert.ok(['gemini', 'both'].includes(input.expected_runs));
  assert.ok(exact(input.selections, ['gemini', 'codex']) && selectionValid(input.selections.gemini) && selectionValid(input.selections.codex));
  assert.equal(input.selections.codex.mode, 'token_plan_agentic');
  assert.ok(exact(input.database, ['host', 'port', 'database', 'username', 'password', 'ssl']));
  assert.equal(input.database.host, '127.0.0.1'); assert.equal(typeof input.database.ssl, 'boolean');
  assert.ok(Number.isSafeInteger(input.database.port) && input.database.port > 0 && input.database.port <= 65535);
  for (const key of ['database', 'username', 'password']) assert.ok(typeof input.database[key] === 'string'
    && input.database[key].length > 0 && Buffer.byteLength(input.database[key]) <= 4096 && !/[\0\r\n]/u.test(input.database[key]));
  phase = 'execution_environment';
  assert.equal(process.platform, 'linux'); assert.equal(process.getuid(), 10000);
  assert.equal(process.env.NODE_ENV, 'test'); assert.equal(process.env.DOTENV_CONFIG_PATH, '/dev/null');
  assert.equal(process.env.RATE_LIMIT_STORAGE, 'memory');
  const require = createRequire(ROOT + '/package.json'); require('reflect-metadata');
  const bytes = await readFile(ROOT + '/release-manifest.json'); assert.equal(sha(bytes), RELEASE);
  const manifest = JSON.parse(bytes);
  const load = async (path, name) => {
    const file = 'dist/' + path + '.js'; assert.equal(sha(await readFile(ROOT + '/' + file)), manifest.files[file]);
    return (await import(pathToFileURL(ROOT + '/' + file)))[name];
  };
  const [Store, Authorize, Preferences, Reader, fingerprint, runtimeDescriptor, readRuntimeRequest] = await Promise.all([
    ['nodia-ai/nodia-ai-authorization.service', 'NodiaAiAuthorizationService'],
    ['nodia-ai/use-case/authorize-nodia-ai.use-case', 'AuthorizeNodiaAiUseCase'],
    ['nodia-ai-preference/nodia-ai-preference.service', 'NodiaAiPreferenceService'],
    ['nodia-ai-preference/use-case/nodia-ai-preference-reader.use-case', 'NodiaAiPreferenceReaderUseCase'],
    ['nodia-ai-preference/types/preference.types', 'preferenceFingerprint'],
    ['nodia-ai-runtime/use-case/runtime-reconciliation-descriptor', 'runtimeProofDescriptor'],
    ['nodia-ai-runtime/use-case/runtime-reconciliation-descriptor', 'readRuntimeProofRequest'],
  ].map(([path, name]) => load(path, name)));
  const { DataSource } = require('typeorm');
  db = await new DataSource({ type: 'postgres', ...input.database,
    ssl: input.database.ssl ? { rejectUnauthorized: false } : undefined,
    synchronize: false, migrationsRun: false, installExtensions: false, logging: false,
    entities: [ROOT + '/dist/**/*.entity.js'], extra: { max: 2, connectionTimeoutMillis: 5000,
      statement_timeout: 5000, options: '-c default_transaction_read_only=on' } }).initialize();
  const authorize = new Authorize(new Store(db)), preferences = new Preferences(db), reader = new Reader(preferences, authorize);
  phase = 'readonly_authority_and_context';
  const snapshot = await db.transaction('REPEATABLE READ', async manager => {
    await manager.query('SET TRANSACTION READ ONLY');
    const [readonly] = await manager.query('SHOW transaction_read_only'); assert.equal(readonly.transaction_read_only, 'on');
    const grants = await manager.query(`SELECT g.session_public_id::text FROM nodia_ai_execution_grants g
      JOIN nodia_ai_runs r ON r.id=g.run_id WHERE r.id=$1 AND r.conversation_id=$2
      AND r.actor_id=$3 AND g.actor_id=$3 LIMIT 2`, [AUTHORITY, CHAT, OWNER]);
    assert.equal(grants.length, 1);
    const identity = { userId: OWNER, sessionId: grants[0].session_public_id };
    const actor = await authorize.execute(identity, { moduleRoutes: ['/tools/finances-personal'] }, manager);
    assert.equal(actor.actorId, OWNER);
    const [chat] = await manager.query(`SELECT id,owner_id::text,revision,retention_epoch::text,lifecycle,
      selected_connection_id::text,selected_mode,selected_model_id,selected_effort_id,routing_enabled,routing_revision,
      next_message_seq::text,active_job_id FROM nodia_ai_conversations WHERE id=$1 AND owner_id=$2`, [CHAT, OWNER]);
    assert.ok(chat && chat.lifecycle === 'active');
    const rows = await preferences.list(manager, OWNER); assert.equal(rows.length, 2);
    const currentRoutes = actor.modules.map(module => module.route);
    const project = async routes => (await reader.project(manager, actor, rows, routes)).filter(item => item.available);
    const current = await project(currentRoutes); assert.equal(current.length, 2);
    assert.deepEqual(current.map(item => item.key).sort(), ['expense_category_id', 'income_category_id']);
    const expectedAnswer = Object.fromEntries(current.map(item => [item.key, item.value]));
    const results = [];
    for (const label of input.expected_runs === 'both' ? ['gemini', 'codex'] : ['gemini']) {
      phase = 'readonly_' + label + '_run';
      const selection = input.selections[label], marker = MARKERS[label];
      const [connection] = await manager.query(`SELECT c.key provider_key,p.is_active,c.is_active catalog_active,
        p.use_token_plan_web,p.use_token_plan_agentic,c.can_use_token_plan_web,c.can_use_token_plan_agentic
        FROM ai_providers p JOIN ai_provider_catalog c ON c.id=p.catalog_id WHERE p.id=$1`, [selection.connection_id]);
      assert.equal(connection?.provider_key, label === 'codex' ? 'openai' : 'gemini');
      assert.ok(connection.is_active && connection.catalog_active && connection['use_' + selection.mode] && connection['can_use_' + selection.mode]);
      const matches = await manager.query(`SELECT r.*,m.seq::text user_seq FROM nodia_ai_runs r
        JOIN nodia_ai_messages m ON m.id=r.user_message_id AND m.conversation_id=r.conversation_id
        WHERE r.conversation_id=$1 AND r.actor_id=$2 AND m.role='user' AND m.author_id=$2
        AND EXISTS(SELECT 1 FROM nodia_ai_message_parts p WHERE p.message_id=m.id AND p.conversation_id=m.conversation_id
          AND p.kind='text' AND left(p.text,length($3))=$3 AND substring(p.text,length($3)+1,1)=E'\n') LIMIT 2`, [CHAT, OWNER, marker]);
      assert.equal(matches.length, 1); const run = matches[0], context = run.context_manifest;
      assert.ok(record(context) && Array.isArray(context.module_routes));
      const [grant] = await manager.query('SELECT actor_id::text,session_public_id::text,allowed_modules,allowed_scope,allowed_operations,policy_version FROM nodia_ai_execution_grants WHERE run_id=$1', [run.id]);
      assert.ok(grant && Array.isArray(grant.allowed_modules));
      const allowedRoutes = currentRoutes.filter(route => context.module_routes.includes(route) && grant.allowed_modules.includes(route));
      const projected = await project(allowedRoutes);
      const expected = refs(projected.map(item => ({ preference_id: item.preference_id, revision: item.revision,
        sha256: fingerprint([{ ...item, id: item.preference_id }]) })));
      const stageContexts = record(context.stage_contexts) ? context.stage_contexts : {};
      const attempts = await manager.query(`SELECT a.id,a.job_id,a.fence::text,a.runtime_fence::text,a.phase,a.stage_key,a.stage_seq,
        a.selection_snapshot,a.routing_phase,a.runtime_resource_key,a.external_operation_ref,a.started_at,a.ended_at
        FROM nodia_ai_job_attempts a JOIN nodia_ai_jobs j ON j.id=a.job_id
        WHERE j.run_id=$1 AND j.conversation_id=$2 ORDER BY a.started_at,a.id LIMIT 129`, [run.id, CHAT]);
      assert.ok(attempts.length <= 128);
      // A reservation can exist before arming; only a completed native stage is
      // used here. Other attempts remain counted separately, never called ACKs.
      const native = attempts.filter(attempt => attempt.external_operation_ref !== null && attempt.phase === 'completed');
      const typed = native.map(attempt => {
        const privateIdentity = context.adapter_identity;
        if (label === 'codex') {
          assert.ok(exact(privateIdentity, ['provider_key', 'contract_version', 'connection_id']));
          assert.equal(privateIdentity.provider_key, 'openai'); assert.equal(privateIdentity.connection_id, selection.connection_id);
        } else assert.equal(privateIdentity, undefined);
        const adapterIdentity = privateIdentity === undefined ? undefined : {
          providerKey: privateIdentity.provider_key, contractVersion: privateIdentity.contract_version, connectionId: privateIdentity.connection_id,
        };
        const descriptor = runtimeDescriptor({ engine: selection.mode === 'token_plan_web' ? 'web' : 'agentic',
          attemptId: attempt.id, operationRef: attempt.external_operation_ref, resourceKey: attempt.runtime_resource_key,
          sessionGeneration: context.session_generation, ...(adapterIdentity ? { adapterIdentity } : {}) });
        // The historical Gemini constructor does not validate schema1 itself.
        // Decode both versions through the compiled closed runtime contract.
        const decoded = readRuntimeRequest(descriptor);
        assert.equal(decoded.attemptId, attempt.id);
        assert.ok(id(attempt.fence) && id(attempt.runtime_fence) && Number.isSafeInteger(attempt.stage_seq) && attempt.stage_seq > 0);
        return { attempt_id: attempt.id, job_id: attempt.job_id, job_fence: attempt.fence,
          runtime_fence: attempt.runtime_fence, phase: attempt.phase, stage_key: attempt.stage_key, stage_seq: attempt.stage_seq,
          selection_matches: equal(attempt.selection_snapshot, selection), descriptor,
          descriptor_sha256: sha(JSON.stringify(descriptor)), ended_at: attempt.ended_at?.toISOString() ?? null };
      });
      const [answer] = await manager.query(`SELECT COALESCE(string_agg(text,E'\n' ORDER BY part_index),'') text
        FROM nodia_ai_message_parts WHERE conversation_id=$1 AND message_id=$2 AND kind='text'`, [CHAT, run.assistant_message_id]);
      let parsed; try { parsed = JSON.parse(answer.text); } catch { parsed = null; }
      const inference = native.filter(attempt => ['inference', 'delegated_inference'].includes(attempt.stage_key));
      const manifestRefs = context.accepted_preferences;
      const checks = {
        completed: run.state === 'completed' && run.assistant_message_id !== null,
        own_frozen_selection_epoch: equal(run.selection_snapshot, selection) && run.connection_id === selection.connection_id && run.retention_epoch === chat.retention_epoch,
        grant_identity_and_routes: grant.actor_id === OWNER && grant.session_public_id === identity.sessionId && grant.policy_version === run.policy_version
          && grant.allowed_operations.includes('chat:respond') && allowedRoutes.includes('/tools/finances-personal'),
        input_seq_exact: run.input_through_seq === run.user_seq,
        frozen_configuration_identity_present: typeof context.configuration_generation === 'string' && context.configuration_generation.length > 0
          && typeof context.session_generation === 'string' && context.session_generation.length > 0,
        two_current_available_preferences: projected.length === 2,
        accepted_preferences_match_compiled_projection: Array.isArray(manifestRefs) && equal(refs(manifestRefs), expected),
        all_stored_stage_preferences_match: Object.values(stageContexts).every(stage => record(stage) && Array.isArray(stage.accepted_preferences) && equal(refs(stage.accepted_preferences), expected)),
        every_native_inference_has_typed_context: inference.length > 0 && inference.every(attempt => record(stageContexts[attempt.id])
          && stageContexts[attempt.id].through_seq === run.input_through_seq && /^[a-f0-9]{64}$/u.test(stageContexts[attempt.id].context_sha256)),
        native_dispatches_match: native.length === run.provider_dispatches_used && native.length > 0 && typed.every(attempt => attempt.selection_matches && attempt.phase === 'completed' && attempt.ended_at !== null),
        no_tools_or_effect_intent: run.tool_calls_used === 0 && run.mcp_rpc_messages_used === 0 && run.delegations_used === 0,
        exact_answer_from_current_preference_oracle: equal(parsed, expectedAnswer),
      };
      results.push({ label, marker, run_id: run.id, user_message_id: run.user_message_id, user_seq: run.user_seq,
        assistant_message_id: run.assistant_message_id, state: run.state, phase: run.phase, selection,
        provider_dispatches: run.provider_dispatches_used, compactions: run.compactions_used,
        configuration_generation_sha256: typeof context.configuration_generation === 'string' ? sha(context.configuration_generation) : null,
        session_generation_sha256: typeof context.session_generation === 'string' ? sha(context.session_generation) : null,
        accepted_preferences: manifestRefs, expected_preference_fingerprints: expected,
        stage_contexts: Object.fromEntries(Object.entries(stageContexts).map(([key, stage]) => [key, {
          through_seq: stage.through_seq, context_sha256: stage.context_sha256, context_bytes: stage.context_bytes,
          accepted_preferences: stage.accepted_preferences, native_context_budget: stage.native_context_budget,
        }])), SQL_attempts: attempts.length, noncompleted_reserved_attempts: attempts.filter(attempt => attempt.external_operation_ref !== null && attempt.phase !== 'completed').length,
        native_attempts: typed, assistant_sha256: sha(answer.text), assistant_utf8_bytes: Buffer.byteLength(answer.text), checks });
    }
    const [counts] = await manager.query(`SELECT
      (SELECT count(*)::int FROM nodia_ai_messages WHERE conversation_id=$1) messages,
      (SELECT count(*)::int FROM nodia_ai_runs WHERE conversation_id=$1) runs,
      (SELECT COALESCE(sum(provider_dispatches_used),0)::int FROM nodia_ai_runs WHERE conversation_id=$1) dispatches,
      (SELECT count(*)::int FROM nodia_ai_attachments WHERE conversation_id=$1) attachments,
      (SELECT count(*)::int FROM nodia_ai_executions WHERE origin_conversation_id=$1) executions,
      (SELECT count(*)::int FROM nodia_ai_execution_steps s JOIN nodia_ai_executions e ON e.id=s.execution_id WHERE e.origin_conversation_id=$1 AND s.minimal_receipt IS NOT NULL) effect_receipts,
      (SELECT count(*)::int FROM nodia_ai_jobs WHERE state IN ('ready','leased','unknown','waiting')) pending_jobs,
      (SELECT count(*)::int FROM nodia_ai_runtime_slots WHERE state<>'free') pending_slots`, [CHAT]);
    const [finance] = await manager.query(`SELECT count(*)::int total,encode(sha256(convert_to(COALESCE(jsonb_agg(to_jsonb(f) ORDER BY id)::text,'[]'),'UTF8')),'hex') sha256 FROM finance_movements f`);
    const [preferenceMetadata] = await manager.query(`SELECT count(*)::int total,encode(sha256(convert_to(COALESCE(jsonb_agg(to_jsonb(p) ORDER BY id)::text,'[]'),'UTF8')),'hex') sha256 FROM nodia_ai_preferences p WHERE owner_id=$1`, [OWNER]);
    return { chat, counts, finance, preferences: { count: rows.length,
      metadata_sha256: preferenceMetadata.sha256, projection_sha256: sha(JSON.stringify(current)),
      accepted: current.map(item => ({ preference_id: item.preference_id, key: item.key, revision: item.revision })) },
      current_authority_verified: true, actor_is_super_admin: actor.isSuperAdmin, results };
  });
  const valid = snapshot.results.every(result => Object.values(result.checks).every(Boolean));
  Object.assign(report, snapshot, { status: valid ? 'validated_read_only' : 'validation_failed',
    release_manifest_sha256: RELEASE, expected_runs: input.expected_runs, baseline_invariance_requires_external_comparison: true,
    typed_descriptors_are_not_native_terminal_proofs: true });
  if (!valid) process.exitCode = 1;
} catch (error) {
  Object.assign(report, { status: 'inspection_failed', failure_phase: phase,
    error_class: ['AssertionError', 'Error', 'ForbiddenException', 'UnauthorizedException', 'QueryFailedError', 'TypeError', 'SyntaxError'].includes(error?.name) ? error.name : 'unclassified',
    error_code: ['nodia_ai:capability_denied', 'auth:session_expired'].includes(error?.message) ? error.message : null });
  process.exitCode = 1;
} finally {
  if (db?.isInitialized) await db.destroy().catch(() => {});
}
console.log(JSON.stringify(report));
