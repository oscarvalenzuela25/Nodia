// Focused R07 own-run receipt validator. Private stdin; READ ONLY; no SDK/runtime calls.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { isDeepStrictEqual as equal } from 'node:util';
import { pathToFileURL } from 'node:url';
const ROOT = '/opt/nodia/releases/nodia-server-ai40-r07', CHAT = 'ec626b72-1f32-4486-9f3a-8263cffce267', OWNER = '1';
const AUTHORITY = '8e4c0db1-6b07-4524-a1cf-f33d09210766', READS = '18630acd-b269-41d7-9220-e59ee161d13e', PREP = '5649309f-e005-40f8-801d-f6fdbb637c29';
const PROPOSAL = '003c0802-e222-402d-a497-082fd48781a7', EXECUTION = 'd663ce31-2d06-4704-af68-cb11b2402e2e';
const WORKFLOW = 'b6110045-8c64-4c69-94fb-71ffea6311cd', HASH = '2bf73798f1891beab74805d99a8ebb791fe8b17be588b656013fb8fbe17522ce';
const READ_SHA = '429791402fb77b88fa6131ca2585d1e0c242d8ae1bd2a3ec5caede1f5582e80c', PREP_SHA = 'f6fb6198795002f4378e890f2ff861fe32786e2e3021daa2c12c490449382d22';
const TEMPLATE_SHA = 'bbc8a57ec61ee342a55f3f56dd3f49e732c17b372c5aaf806d63555cd776099a';
const releaseSHA = '1799e821e6c2f668989a972fde26b162772e02e821ce9744fbe431894dfce476';
const sha = value => createHash('sha256').update(value).digest('hex');
const jsonSHA = value => sha(JSON.stringify(value));
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(value);
const keys = (value, names) => value && typeof value === 'object' && !Array.isArray(value) && equal(Object.keys(value).sort(), [...names].sort());
const report = { schema: 'nodia-ai-ai40-common-receipt-validation-v1', status: 'validation_failed', checks: {},
  SQL_read_only: true, SQL_writes: 0, provider_requests: 0, SDK_observations: 0, raw_payloads_emitted: false, credentials_or_session_identifiers_emitted: false };
let db, phase = 'input';
try {
  let length = 0; const chunks = [];
  for await (const chunk of process.stdin) { length += chunk.length; assert.ok(length <= 131072); chunks.push(chunk); }
  const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  assert.ok(keys(input, ['schema_version', 'database', 'published_preparation_schema_base64']) && input.schema_version === 1);
  const config = input.database;
  assert.ok(keys(config, ['host', 'port', 'database', 'username', 'password', 'ssl']));
  assert.equal(config.host, '127.0.0.1'); assert.ok(Number.isInteger(config.port) && config.port > 0 && config.port <= 65535 && typeof config.ssl === 'boolean');
  for (const key of ['database', 'username', 'password']) assert.ok(typeof config[key] === 'string' && Buffer.byteLength(config[key]) > 0 && Buffer.byteLength(config[key]) <= 4096 && !/[\0\r\n]/u.test(config[key]));
  assert.equal(process.cwd(), ROOT);
  phase = 'provenance';
  assert.equal(sha(await readFile(ROOT + '/release-manifest.json')), releaseSHA);
  const manifest = JSON.parse(await readFile(ROOT + '/dist/nodia-ai/knowledge/manifest.json', 'utf8'));
  assert.equal(manifest.release_id, '5c83848c6eb1a6ce77fa63ad9de38f4dea556f260b6a9646cfceaaf4850db994');
  const readBytes = await readFile(ROOT + '/dist/nodia-ai-products/contracts/common-reads.json'); assert.equal(sha(readBytes), READ_SHA);
  assert.ok(typeof input.published_preparation_schema_base64 === 'string');
  const prepBytes = Buffer.from(input.published_preparation_schema_base64, 'base64');
  assert.equal(prepBytes.toString('base64'), input.published_preparation_schema_base64); assert.equal(sha(prepBytes), PREP_SHA);
  assert.equal(sha(await readFile(ROOT + '/dist/nodia-ai-products/contracts/common-preparation.json')), TEMPLATE_SHA);
  const definitions = {
    nodia_preferences_list: [READ_SHA, 'PreferenceListInput', 'PreferencePage'], nodia_proposals_get: [READ_SHA, 'ProposalGetInput', 'PublicProposal'],
    nodia_operations_get: [READ_SHA, 'OperationGetInput', 'ExecutionStatus'],
    nodia_preferences_prepare: [PREP_SHA, 'McpPreferencePrepareInput', 'McpPreferencePreparationResult'],
    nodia_workflows_prepare: [PREP_SHA, 'McpWorkflowPrepareInput', 'McpWorkflowPreparationResult'],
  };
  for (const [name, [pin, inputDef, outputDef]] of Object.entries(definitions)) {
    const found = manifest.capability_contracts.filter(cap => cap.capability_id === name); assert.equal(found.length, 1);
    const cap = found[0]; assert.equal(cap.publication, 'published');
    assert.equal(cap.input_schema.sha256, pin); assert.equal(cap.output_schema.sha256, pin);
    assert.equal(cap.input_schema.definition, inputDef); assert.equal(cap.output_schema.definition, outputDef);
    assert.deepEqual(cap.required_module_routes, ['/tools/nodia-ai']);
  }
  const require = createRequire(ROOT + '/package.json'), { Ajv2020 } = require('ajv/dist/2020.js'), addFormats = require('ajv-formats');
  const ajv = new Ajv2020({ strict: true, allErrors: true }); addFormats(ajv);
  const schemas = { [READ_SHA]: JSON.parse(readBytes), [PREP_SHA]: JSON.parse(prepBytes) };
  Object.values(schemas).forEach(schema => ajv.addSchema(schema));
  const validators = Object.fromEntries(Object.entries(definitions).map(([name, [pin, i, o]]) => [name,
    [ajv.compile({ $ref: schemas[pin].$id + '#/$defs/' + i }), ajv.compile({ $ref: schemas[pin].$id + '#/$defs/' + o })]]));
  report.schema_pins = { published_reads: READ_SHA, published_composed_preparation: PREP_SHA, native_preparation_template: TEMPLATE_SHA,
    template_is_not_the_published_composed_schema: true, release_manifest: releaseSHA };
  const { DataSource } = require('typeorm');
  db = new DataSource({ type: 'postgres', ...config, ssl: config.ssl ? { rejectUnauthorized: false } : false,
    synchronize: false, migrationsRun: false, installExtensions: false, logging: false,
    extra: { max: 1, connectionTimeoutMillis: 5000, statement_timeout: 5000, options: '-c default_transaction_read_only=on' } });
  const { NodiaAiAuthorizationService } = await import(pathToFileURL(ROOT + '/dist/nodia-ai/nodia-ai-authorization.service.js'));
  const { AuthorizeNodiaAiUseCase } = await import(pathToFileURL(ROOT + '/dist/nodia-ai/use-case/authorize-nodia-ai.use-case.js'));
  phase = 'authority'; await db.initialize();
  const snapshot = await db.transaction('REPEATABLE READ', async manager => {
    await manager.query('SET TRANSACTION READ ONLY'); const [mode] = await manager.query('SHOW transaction_read_only'); assert.equal(mode.transaction_read_only, 'on');
    const [chat] = await manager.query('SELECT owner_id::text,lifecycle,expires_at>clock_timestamp() AS unexpired FROM nodia_ai_conversations WHERE id=$1', [CHAT]);
    assert.ok(chat && chat.owner_id === OWNER && chat.lifecycle === 'active' && chat.unexpired);
    const grants = await manager.query(`SELECT g.session_public_id::text FROM nodia_ai_execution_grants g JOIN nodia_ai_runs r ON r.id=g.run_id
      WHERE r.id=$1 AND r.conversation_id=$2 AND r.actor_id=$3 AND g.actor_id=$3 LIMIT 2`, [AUTHORITY, CHAT, OWNER]);
    assert.equal(grants.length, 1); assert.ok(uuid(grants[0].session_public_id));
    const actor = await new AuthorizeNodiaAiUseCase(new NodiaAiAuthorizationService(db)).execute(
      { userId: OWNER, sessionId: grants[0].session_public_id }, { moduleRoutes: ['/tools/nodia-ai', '/tools/finances-personal'] }, manager);
    assert.equal(actor.actorId, OWNER); assert.equal(actor.isSuperAdmin, true);
    report.checks.current_owner_and_exact_historical_grant_reauthorized = true;
    async function run(id, marker) {
      const [value] = await manager.query(`SELECT r.id,r.state,r.provider_dispatches_used,r.tool_calls_used,r.mcp_rpc_messages_used,r.assistant_message_id,
        m.seq::text AS user_seq FROM nodia_ai_runs r JOIN nodia_ai_messages m ON m.id=r.user_message_id
        WHERE r.id=$1 AND r.conversation_id=$2 AND r.actor_id=$3 AND m.conversation_id=$2 AND m.author_id=$3 AND m.role='user'`, [id, CHAT, OWNER]);
      assert.ok(value && value.state === 'completed' && value.assistant_message_id);
      if (marker) {
        assert.ok(BigInt(value.user_seq) > 32n);
        const [match] = await manager.query(`SELECT EXISTS(SELECT 1 FROM nodia_ai_message_parts WHERE message_id=(SELECT user_message_id FROM nodia_ai_runs WHERE id=$1)
          AND conversation_id=$2 AND kind='text' AND part_index=0 AND left(text,length($3))=$3) AS matches`, [id, CHAT, marker]); assert.equal(match.matches, true);
      }
      const tools = await manager.query('SELECT id,tool_name,state,contract_hash,arguments_hash,arguments,public_result FROM nodia_ai_tool_calls WHERE run_id=$1 AND conversation_id=$2 ORDER BY created_at,id LIMIT 16', [id, CHAT]);
      const attempts = await manager.query(`SELECT a.id,a.job_id,a.fence::text AS job_fence,a.runtime_fence::text AS runtime_fence,a.stage_key,a.stage_seq,a.phase,a.error_code,
        a.external_operation_ref,a.ended_at IS NOT NULL AS ended FROM nodia_ai_job_attempts a JOIN nodia_ai_jobs j ON j.id=a.job_id WHERE j.run_id=$1 AND j.conversation_id=$2 ORDER BY a.started_at,a.id LIMIT 16`, [id, CHAT]);
      const [answer] = await manager.query(`SELECT COALESCE(string_agg(text,E'\n' ORDER BY part_index),'') AS text FROM nodia_ai_message_parts
        WHERE message_id=$1 AND conversation_id=$2 AND kind='text'`, [value.assistant_message_id, CHAT]); assert.ok(Buffer.byteLength(answer.text) <= 65536);
      const validation = tools.filter(tool => tool.tool_name !== 'nodia_capabilities_select').map(tool => {
        const pair = validators[tool.tool_name]; assert.ok(pair); const i = pair[0](tool.arguments), o = pair[1](tool.public_result);
        return { tool_call_id: tool.id, tool_name: tool.tool_name, state: tool.state, contract_hash: tool.contract_hash,
          arguments_hash: tool.arguments_hash, observed_arguments_json_sha256: jsonSHA(tool.arguments), public_result_json_sha256: jsonSHA(tool.public_result),
          input_schema_valid: i, output_schema_valid: o, schema_error_keywords: [...new Set([...(pair[0].errors ?? []), ...(pair[1].errors ?? [])].map(error => error.keyword))] };
      });
      assert.ok(tools.every(tool => tool.state === 'completed'));
      return { value, tools, attempts, validation, answer: answer.text };
    }
    phase = 'read_receipts'; const reads = await run(READS);
    const byName = name => reads.tools.filter(tool => tool.tool_name === name);
    const expected = { nodia_preferences_list: { scope_key: 'finance', page_limit: 1 }, nodia_proposals_get: { proposal_id: PROPOSAL }, nodia_operations_get: { execution_id: EXECUTION } };
    report.checks.reads_have_one_selection_and_exact_three_inputs = reads.tools.length === 4 && byName('nodia_capabilities_select').length === 1 && Object.entries(expected).every(([name, args]) => byName(name).length === 1 && equal(byName(name)[0].arguments, args));
    report.checks.reads_published_schema_valid = reads.validation.every(row => row.input_schema_valid && row.output_schema_valid);
    const preferences = byName('nodia_preferences_list')[0].public_result, proposal = byName('nodia_proposals_get')[0].public_result, execution = byName('nodia_operations_get')[0].public_result;
    const expectedAnswer = { preferences_in_page: preferences.items.length, preferences_next_cursor: preferences.next_cursor,
      proposal_revision: proposal.revision, proposal_state: proposal.state, proposal_execution_id: proposal.execution_id,
      execution_revision: execution.revision, execution_state: execution.state, execution_completed_steps: execution.steps.filter(step => step.state === 'completed').length };
    phase = 'semantic';
    let answerJSON; try { answerJSON = JSON.parse(reads.answer); } catch { answerJSON = null; }
    report.checks.read_assistant_JSON_exactly_matches_immutable_receipts = equal(answerJSON, expectedAnswer);
    report.checks.read_receipt_identity_and_historical_state = proposal.proposal_id === PROPOSAL && proposal.execution_id === EXECUTION && execution.execution_id === EXECUTION
      && preferences.items.length === 0 && preferences.next_cursor === null && proposal.revision === 1 && proposal.state === 'confirmed'
      && execution.revision === 3 && execution.state === 'completed' && expectedAnswer.execution_completed_steps === 1;
    phase = 'prepare_receipts'; const prepared = await run(PREP, 'AI40-COMMON-PREP-R01.');
    const prepCalls = prepared.tools.filter(tool => tool.tool_name === 'nodia_preferences_prepare');
    const workflows = prepared.tools.filter(tool => tool.tool_name === 'nodia_workflows_prepare'), gets = prepared.tools.filter(tool => tool.tool_name === 'nodia_proposals_get');
    assert.equal(prepCalls.length, 2); assert.equal(workflows.length, 1); assert.equal(gets.length, 1);
    const draftIds = prepCalls.map(tool => tool.public_result.draft_id), singles = prepCalls.map(tool => tool.public_result.proposal?.proposal_id);
    report.checks.two_preference_create_inputs_exact_in_order = prepCalls.every((tool, index) => equal(tool.arguments,
      { operation: 'create', partial: { scope_key: 'finance', key: ['expense_category_id', 'income_category_id'][index], scope: {}, value: '1' } }));
    report.checks.preference_snapshots_ready_without_implicit_execution = prepCalls.every(tool => tool.public_result.status === 'ready' && tool.public_result.draft_revision === 1
      && tool.public_result.proposal?.state === 'ready' && tool.public_result.proposal.execution_id === null);
    report.checks.workflow_exactly_consumes_returned_drafts_without_bindings = equal(workflows[0].arguments, { catalog_version: 'nodia-ai-ai23-workflow/1', draft_ids: draftIds, bindings: [] });
    const combined = workflows[0].public_result.proposal;
    report.checks.workflow_frozen_identity_revision_hash = combined?.proposal_id === WORKFLOW && combined.revision === 1 && combined.hash === HASH;
    report.checks.workflow_snapshot_is_two_independent_preference_steps = combined?.steps?.length === 2 && combined.steps.every(step => step.kind === 'preference_change'
      && step.depends_on.length === 0 && step.output_bindings.length === 0);
    const stripStepId = step => Object.fromEntries(Object.entries(step).filter(([key]) => key !== 'step_id'));
    report.checks.workflow_order_and_all_public_step_fields_match_individual_sources = combined?.steps?.length === 2 && prepCalls.every((tool, index) => {
      const source = tool.public_result.proposal?.steps;
      return source?.length === 1 && source[0].scope.subject_user_id === OWNER
        && source[0].changes.some(change => change.field_key === 'key' && change.after === ['expense_category_id', 'income_category_id'][index])
        && source[0].changes.some(change => change.field_key === 'value' && change.after === '1')
        && equal(stripStepId(combined.steps[index]), stripStepId(source[0]));
    });
    report.checks.workflow_get_snapshot_matches_combined_proposal = equal(gets[0].arguments, { proposal_id: WORKFLOW }) && equal(gets[0].public_result, combined);
    report.checks.prepare_published_schema_valid = prepared.validation.every(row => row.input_schema_valid && row.output_schema_valid);
    report.checks.prepare_has_one_selection_and_four_expected_callbacks = prepared.tools.length === 5 && prepared.tools.filter(tool => tool.tool_name === 'nodia_capabilities_select').length === 1;
    const drafts = await manager.query('SELECT id,revision,state,claimed_proposal_id FROM nodia_ai_drafts WHERE conversation_id=$1 AND actor_id=$2 AND id=ANY($3::uuid[]) ORDER BY id', [CHAT, OWNER, draftIds]);
    report.checks.returned_drafts_current_claims_match_workflow = drafts.length === 2 && drafts.every(draft => draft.revision === 2 && draft.state === 'claimed' && draft.claimed_proposal_id === WORKFLOW);
    const old = await manager.query(`SELECT r.proposal_id,r.state FROM nodia_ai_proposal_revisions r JOIN nodia_ai_proposals p ON p.id=r.proposal_id
      WHERE p.conversation_id=$1 AND p.actor_id=$2 AND r.revision=1 AND r.proposal_id=ANY($3::uuid[])`, [CHAT, OWNER, singles]);
    report.checks.individual_sources_are_superseded = old.length === 2 && old.every(row => row.state === 'superseded');
    const [current] = await manager.query(`SELECT r.revision,r.hash,r.state FROM nodia_ai_proposal_revisions r JOIN nodia_ai_proposals p ON p.id=r.proposal_id
      WHERE p.id=$1 AND p.conversation_id=$2 AND p.actor_id=$3 AND r.revision=1`, [WORKFLOW, CHAT, OWNER]);
    report.checks.current_workflow_keeps_same_revision_and_hash = current?.revision === 1 && current.hash === HASH;
    phase = 'invariants';
    const [counts] = await manager.query(`SELECT (SELECT count(*)::int FROM nodia_ai_messages WHERE conversation_id=$1) messages,
      (SELECT count(*)::int FROM nodia_ai_runs WHERE conversation_id=$1) runs,(SELECT COALESCE(sum(provider_dispatches_used),0)::int FROM nodia_ai_runs WHERE conversation_id=$1) dispatches,
      (SELECT count(*)::int FROM nodia_ai_preferences WHERE owner_id=$2) accepted_preferences_now,
      (SELECT count(*)::int FROM nodia_ai_executions WHERE origin_conversation_id=$1) executions_now,
      (SELECT count(*)::int FROM nodia_ai_jobs WHERE state IN ('ready','leased','unknown','waiting')) pending_jobs,
      (SELECT count(*)::int FROM nodia_ai_job_attempts WHERE ended_at IS NULL) open_attempts,(SELECT count(*)::int FROM nodia_ai_runtime_slots WHERE state<>'free') retained_slots`, [CHAT, OWNER]);
    const project = row => ({ run_id: row.value.id, state: row.value.state, user_seq: row.value.user_seq, provider_dispatches: row.value.provider_dispatches_used,
      tool_calls: row.value.tool_calls_used, MCP_RPCs: row.value.mcp_rpc_messages_used, attempts: row.attempts, receipts: row.validation,
      assistant_sha256: sha(row.answer), assistant_utf8_bytes: Buffer.byteLength(row.answer) });
    return { conversation_id: CHAT, owner_id: OWNER, reads: project(reads), preparation: project(prepared), workflow_id: WORKFLOW,
      workflow_revision: current.revision, workflow_hash: current.hash, draft_ids: draftIds, counts };
  });
  report.snapshot = snapshot; report.historical_semantics_use_immutable_receipts_not_current_preference_count = true;
  report.current_workflow_may_be_legitimately_confirmed_after_the_preparation = true;
  report.status = Object.values(report.checks).every(value => value === true) ? 'validated_read_only' : 'validation_failed';
} catch (error) {
  const value = typeof error?.getResponse === 'function' ? error.getResponse() : null;
  const message = typeof value === 'string' ? value : value?.message;
  const allowed = ['nodia_ai:capability_denied', 'auth:session_expired', 'nodia_ai:conversation_expired'];
  report.error_category = allowed.includes(message) ? message : error?.code === 'ERR_ASSERTION' ? 'assertion_failed' : 'private_dependency_or_protocol_failure';
  report.failed_phase = phase;
} finally {
  if (db?.isInitialized) try { await db.destroy(); } catch {
    report.status = 'validation_failed'; report.error_category = 'database_close_failed';
  }
}
console.log(JSON.stringify(report));
if (report.status !== 'validated_read_only') process.exitCode = 1;
