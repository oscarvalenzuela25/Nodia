// OPERATOR ONLY: inspect preparation, committed deletion and current readback.
// Private stdin DB options, read-only PostgreSQL, no SDK, confirmation or journal mutation.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { isDeepStrictEqual as equal } from 'node:util';
import { pathToFileURL } from 'node:url';
const ROOT = '/opt/nodia/releases/nodia-server-ai40-r08';
const RELEASE = '08145edaefff382ba2ccbbf8d51c325de630feeef5b67a1834651b1cdd6577bc';
const CHAT = 'ec626b72-1f32-4486-9f3a-8263cffce267', OWNER = '1', AUTHORITY = '8e4c0db1-6b07-4524-a1cf-f33d09210766';
const TARGET = '669286a3-bc13-4a01-bf9c-203ed4359931', SURVIVOR = '04f8a72d-2fab-4c48-b7e1-e15e95d70bec';
const READ_SHA = '429791402fb77b88fa6131ca2585d1e0c242d8ae1bd2a3ec5caede1f5582e80c';
const PREP_SHA = 'f6fb6198795002f4378e890f2ff861fe32786e2e3021daa2c12c490449382d22';
const sha = value => createHash('sha256').update(value).digest('hex');
const exact = (value, names) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && equal(Object.keys(value).sort(), [...names].sort());
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(value);
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
const refs = values => [...values].sort((a, b) => a.preference_id.localeCompare(b.preference_id));
let db, phase = 'input_contract';
const report = { schema: 'nodia-ai-ai40-preference-forget-inspection-v1', status: 'not_started',
  SQL_writes: 0, SDK_requests: 0, confirmation_requests: 0, journal_reads: 0, journal_writes: 0,
  credentials_or_raw_messages_emitted: false, external_journal_requires_separate_readonly_receipt: true,
  physical_native_ACK_verified_by_this_script: false };
try {
  let size = 0; const chunks = [];
  for await (const chunk of process.stdin) { size += chunk.length; assert.ok(size <= 131072); chunks.push(chunk); }
  const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  assert.ok(exact(input, ['schema_version', 'phase', 'conversation_id', 'expected_owner_id', 'authority_run_id', 'preparation_run_id', 'proposal', 'execution_id', 'readback_run_id', 'baseline', 'published_preparation_schema_base64', 'database']));
  assert.equal(input.schema_version, 1); assert.equal(input.conversation_id, CHAT); assert.equal(input.expected_owner_id, OWNER); assert.equal(input.authority_run_id, AUTHORITY);
  assert.ok(['prepared', 'committed', 'readback'].includes(input.phase) && uuid(input.preparation_run_id));
  assert.ok(exact(input.proposal, ['id', 'revision', 'hash']) && uuid(input.proposal.id) && Number.isSafeInteger(input.proposal.revision) && input.proposal.revision > 0 && input.proposal.revision <= 2147483647 && hash(input.proposal.hash));
  if (input.phase === 'prepared') assert.ok(input.execution_id === null && input.readback_run_id === null && input.baseline === null);
  else {
    assert.ok(uuid(input.execution_id) && exact(input.baseline, ['survivor_sql_sha256', 'finance_sql_sha256']) && hash(input.baseline.survivor_sql_sha256) && hash(input.baseline.finance_sql_sha256));
    assert.ok(input.phase === 'readback' ? uuid(input.readback_run_id) : input.readback_run_id === null);
  }
  assert.ok(exact(input.database, ['host', 'port', 'database', 'username', 'password', 'ssl']) && input.database.host === '127.0.0.1' && typeof input.database.ssl === 'boolean');
  assert.ok(Number.isSafeInteger(input.database.port) && input.database.port > 0 && input.database.port <= 65535);
  for (const key of ['database', 'username', 'password']) assert.ok(typeof input.database[key] === 'string' && input.database[key].length > 0 && Buffer.byteLength(input.database[key]) <= 4096 && !/[\0\r\n]/u.test(input.database[key]));
  phase = 'pinned_readonly_environment';
  assert.equal(process.platform, 'linux'); assert.equal(process.getuid(), 10000); assert.equal(process.env.NODE_ENV, 'test');
  assert.equal(process.env.DOTENV_CONFIG_PATH, '/dev/null'); assert.equal(process.env.RATE_LIMIT_STORAGE, 'memory');
  const require = createRequire(ROOT + '/package.json'); require('reflect-metadata');
  const manifestBytes = await readFile(ROOT + '/release-manifest.json'); assert.equal(sha(manifestBytes), RELEASE);
  const manifest = JSON.parse(manifestBytes);
  const pinned = async path => { const value = await readFile(ROOT + '/' + path); assert.equal(sha(value), manifest.files[path]); return value; };
  const load = async (path, name) => { await pinned('dist/' + path + '.js'); return (await import(pathToFileURL(ROOT + '/dist/' + path + '.js')))[name]; };
  const knowledge = JSON.parse(await pinned('dist/nodia-ai/knowledge/manifest.json'));
  const readBytes = await pinned('dist/nodia-ai-products/contracts/common-reads.json'); assert.equal(sha(readBytes), READ_SHA);
  assert.equal(typeof input.published_preparation_schema_base64, 'string');
  const preparationBytes = Buffer.from(input.published_preparation_schema_base64, 'base64');
  assert.equal(preparationBytes.toString('base64'), input.published_preparation_schema_base64); assert.equal(sha(preparationBytes), PREP_SHA);
  const { Ajv2020 } = require('ajv/dist/2020.js'), addFormats = require('ajv-formats');
  const ajv = new Ajv2020({ strict: true, allErrors: true }); addFormats(ajv);
  const schemas = { [READ_SHA]: JSON.parse(readBytes), [PREP_SHA]: JSON.parse(preparationBytes) };
  Object.values(schemas).forEach(schema => ajv.addSchema(schema));
  const definitions = { nodia_preferences_prepare: [PREP_SHA, 'McpPreferencePrepareInput', 'McpPreferencePreparationResult'],
    nodia_proposals_get: [READ_SHA, 'ProposalGetInput', 'PublicProposal'], nodia_preferences_list: [READ_SHA, 'PreferenceListInput', 'PreferencePage'],
    nodia_operations_get: [READ_SHA, 'OperationGetInput', 'ExecutionStatus'] };
  const validators = {};
  for (const [name, [pin, i, o]] of Object.entries(definitions)) {
    const published = knowledge.capability_contracts.filter(cap => cap.capability_id === name);
    assert.equal(published.length, 1); const cap = published[0]; assert.equal(cap.publication, 'published');
    assert.equal(cap.input_schema.sha256, pin); assert.equal(cap.output_schema.sha256, pin);
    assert.equal(cap.input_schema.definition, i); assert.equal(cap.output_schema.definition, o);
    validators[name] = [i, o].map(definition => ajv.compile({ $ref: schemas[pin].$id + '#/$defs/' + definition }));
  }
  const receiptValid = ajv.compile({ $ref: schemas[PREP_SHA].$id + '#/$defs/PreferenceEffectReceipt' });
  const [AuthStore, Authorize, Store, Reader, List, fingerprint] = await Promise.all([
    ['nodia-ai/nodia-ai-authorization.service', 'NodiaAiAuthorizationService'], ['nodia-ai/use-case/authorize-nodia-ai.use-case', 'AuthorizeNodiaAiUseCase'],
    ['nodia-ai-preference/nodia-ai-preference.service', 'NodiaAiPreferenceService'], ['nodia-ai-preference/use-case/nodia-ai-preference-reader.use-case', 'NodiaAiPreferenceReaderUseCase'],
    ['nodia-ai-preference/use-case/list-nodia-ai-preferences.use-case', 'ListNodiaAiPreferencesUseCase'], ['nodia-ai-preference/types/preference.types', 'preferenceFingerprint'],
  ].map(([path, name]) => load(path, name)));
  const { DataSource } = require('typeorm');
  db = await new DataSource({ type: 'postgres', ...input.database, ssl: input.database.ssl ? { rejectUnauthorized: false } : undefined,
    synchronize: false, migrationsRun: false, installExtensions: false, logging: false, entities: [ROOT + '/dist/**/*.entity.js'],
    extra: { max: 2, connectionTimeoutMillis: 5000, statement_timeout: 5000, options: '-c default_transaction_read_only=on' } }).initialize();
  const authorize = new Authorize(new AuthStore(db)), store = new Store(db), reader = new Reader(store, authorize), list = new List(store, authorize, reader);
  phase = 'readonly_receipt_and_current_preference';
  const snapshot = await db.transaction('REPEATABLE READ', async manager => {
    await manager.query('SET TRANSACTION READ ONLY'); const [ro] = await manager.query('SHOW transaction_read_only'); assert.equal(ro.transaction_read_only, 'on');
    const [chat] = await manager.query('SELECT owner_id::text,lifecycle,expires_at>clock_timestamp() unexpired FROM nodia_ai_conversations WHERE id=$1', [CHAT]);
    assert.ok(chat?.owner_id === OWNER && chat.lifecycle === 'active' && chat.unexpired);
    const grants = await manager.query(`SELECT g.session_public_id::text FROM nodia_ai_execution_grants g JOIN nodia_ai_runs r ON r.id=g.run_id
      WHERE r.id=$1 AND r.conversation_id=$2 AND r.actor_id=$3 AND g.actor_id=$3 LIMIT 2`, [AUTHORITY, CHAT, OWNER]); assert.equal(grants.length, 1);
    const identity = { userId: OWNER, sessionId: grants[0].session_public_id };
    const actor = await authorize.execute(identity, {}, manager); assert.equal(actor.actorId, OWNER);
    const ownRun = async id => {
      const [run] = await manager.query(`SELECT r.id,r.state,r.assistant_message_id,r.context_manifest,r.provider_dispatches_used,r.tool_calls_used,r.mcp_rpc_messages_used
        FROM nodia_ai_runs r JOIN nodia_ai_messages m ON m.id=r.user_message_id AND m.conversation_id=r.conversation_id
        WHERE r.id=$1 AND r.conversation_id=$2 AND r.actor_id=$3 AND m.role='user' AND m.author_id=$3`, [id, CHAT, OWNER]);
      assert.ok(run && run.state === 'completed' && run.assistant_message_id !== null); return run;
    };
    const calls = async run => {
      const rows = await manager.query('SELECT id,tool_name,state,arguments,public_result,contract_hash FROM nodia_ai_tool_calls WHERE run_id=$1 AND conversation_id=$2 ORDER BY created_at,id LIMIT 17', [run.id, CHAT]);
      assert.ok(rows.length <= 16);
      for (const row of rows.filter(item => item.tool_name !== 'nodia_capabilities_select')) {
        assert.ok(validators[row.tool_name]); const [i, o] = validators[row.tool_name];
        assert.ok(row.state === 'completed' && i(row.arguments) && o(row.public_result) && hash(row.contract_hash));
      }
      return rows.filter(row => row.tool_name !== 'nodia_capabilities_select');
    };
    const prepRun = await ownRun(input.preparation_run_id), prepCalls = await calls(prepRun);
    const prepares = prepCalls.filter(row => row.tool_name === 'nodia_preferences_prepare'), gets = prepCalls.filter(row => row.tool_name === 'nodia_proposals_get');
    assert.equal(prepares.length, 1); assert.ok(gets.length >= 1 && prepCalls.length === prepares.length + gets.length);
    const prep = prepares[0]; assert.deepEqual(prep.arguments, { operation: 'delete', partial: { id: TARGET, expected_revision: 1 } });
    const proposal = prep.public_result.proposal;
    assert.ok(prep.public_result.status === 'ready' && proposal?.state === 'ready');
    assert.ok(proposal.proposal_id === input.proposal.id && proposal.revision === input.proposal.revision && proposal.hash === input.proposal.hash);
    assert.ok(gets.every(row => equal(row.arguments, { proposal_id: input.proposal.id }) && equal(row.public_result, proposal)));
    const [stored] = await manager.query(`SELECT p.current_revision,p.actor_id::text,p.conversation_id,r.hash,r.state,r.expires_at>clock_timestamp() unexpired
      FROM nodia_ai_proposals p JOIN nodia_ai_proposal_revisions r ON r.proposal_id=p.id AND r.revision=$2 WHERE p.id=$1`, [input.proposal.id, input.proposal.revision]);
    assert.ok(stored && stored.actor_id === OWNER && stored.conversation_id === CHAT && stored.hash === input.proposal.hash && stored.current_revision === input.proposal.revision);
    const steps = await manager.query('SELECT id,tool_name,scope,command_template,public_step,preconditions FROM nodia_ai_proposal_steps WHERE proposal_id=$1 AND proposal_revision=$2 ORDER BY position', [input.proposal.id, input.proposal.revision]);
    assert.equal(steps.length, 1); const step = steps[0];
    assert.ok(step.tool_name === 'nodia_preferences_prepare_delete' && step.command_template.id === TARGET && step.command_template.expected_revision === 1
      && step.command_template.key === 'income_category_id' && step.scope.subject_user_id === OWNER && step.preconditions.target.id === TARGET && step.preconditions.target.revision === 1);
    assert.deepEqual(proposal.steps, [step.public_step]);
    assert.ok(step.public_step.kind === 'preference_change' && step.public_step.target.resource_key === 'nodia_ai_preferences' && step.public_step.target.id === TARGET
      && step.public_step.depends_on.length === 0 && step.public_step.output_bindings.length === 0 && step.public_step.effect_key === 'preferences.delete');
    const executions = await manager.query('SELECT id,conversation_id,proposal_id,origin_conversation_id,origin_proposal_revision,proposal_hash,actor_id::text,chat_owner_id::text,state FROM nodia_ai_executions WHERE origin_proposal_id=$1', [input.proposal.id]);
    const prefs = await store.list(manager, OWNER);
    const page = await list.executeInTransaction(manager, identity, { scope_key: 'finance', page_limit: 2 });
    const targets = prefs.filter(pref => pref.id === TARGET), survivors = prefs.filter(pref => pref.id === SURVIVOR);
    const [baseline] = await manager.query(`SELECT
      (SELECT encode(sha256(convert_to(to_jsonb(p)::text,'UTF8')),'hex') FROM nodia_ai_preferences p WHERE id=$1 AND owner_id=$2) survivor_sql_sha256,
      (SELECT encode(sha256(convert_to(COALESCE(jsonb_agg(to_jsonb(f) ORDER BY id)::text,'[]'),'UTF8')),'hex') FROM finance_movements f) finance_sql_sha256`, [SURVIVOR, OWNER]);
    const checks = { preparation_receipts_and_proposal_exact: true, native_step_exact_target_and_no_bindings: true,
      survivor_present: survivors.length === 1 && survivors[0].key === 'expense_category_id' && survivors[0].revision === 1,
      expected_current_preference_count: prefs.length === (input.phase === 'prepared' ? 2 : 1) };
    let execution = null;
    if (input.phase === 'prepared') {
      Object.assign(checks, { target_still_accepted_before_human: targets.length === 1 && targets[0].revision === 1 && targets[0].key === 'income_category_id',
        proposal_ready_and_unexpired: stored.state === 'ready' && stored.unexpired, no_execution_before_human: executions.length === 0 });
    } else {
      assert.equal(executions.length, 1); const e = executions[0]; assert.equal(e.id, input.execution_id);
      const effectSteps = await manager.query('SELECT id,source_step_id,state,tool_name,minimal_receipt,native_request_key FROM nodia_ai_execution_steps WHERE execution_id=$1 ORDER BY position', [e.id]);
      assert.equal(effectSteps.length, 1); const effect = effectSteps[0];
      const expectedReceipt = { schema_version: 1, resource_key: 'nodia_ai_preferences', operation: 'delete', resource_id: TARGET, owner_id: OWNER, revision: 2 };
      const [challenges] = await manager.query(`SELECT count(*)::int total FROM nodia_ai_confirmation_challenges WHERE proposal_id=$1 AND proposal_revision=$2 AND expected_hash=$3 AND actor_id=$4 AND consumed_at IS NOT NULL`, [input.proposal.id, input.proposal.revision, input.proposal.hash, OWNER]);
      Object.assign(checks, { one_exact_completed_execution: stored.state === 'confirmed' && e.state === 'completed' && e.conversation_id === CHAT && e.origin_conversation_id === CHAT && e.proposal_id === input.proposal.id && e.actor_id === OWNER && e.chat_owner_id === OWNER && e.origin_proposal_revision === input.proposal.revision && e.proposal_hash === input.proposal.hash,
        one_closed_delete_receipt: effect.state === 'completed' && effect.source_step_id === step.id && effect.tool_name === step.tool_name && receiptValid(effect.minimal_receipt) && equal(effect.minimal_receipt, expectedReceipt),
        one_consumed_human_challenge: challenges.total === 1, target_removed_after_human: targets.length === 0,
        survivor_unchanged: baseline.survivor_sql_sha256 === input.baseline.survivor_sql_sha256,
        finance_unchanged: baseline.finance_sql_sha256 === input.baseline.finance_sql_sha256 });
      execution = { execution_id: e.id, state: e.state, step_id: effect.id, native_request_key: effect.native_request_key,
        minimal_receipt: effect.minimal_receipt, minimal_receipt_sha256: sha(JSON.stringify(effect.minimal_receipt)) };
    }
    let readback = null;
    if (input.phase === 'readback') {
      const run = await ownRun(input.readback_run_id), currentCalls = await calls(run), reads = currentCalls.filter(row => row.tool_name === 'nodia_preferences_list');
      assert.equal(reads.length, 1); assert.deepEqual(reads[0].arguments, { scope_key: 'finance', page_limit: 2 });
      const expectedRefs = refs(page.items.filter(item => item.available).map(item => ({ preference_id: item.preference_id, revision: item.revision, sha256: fingerprint([{ ...item, id: item.preference_id }]) })));
      const manifestRefs = run.context_manifest.accepted_preferences;
      const contexts = run.context_manifest.stage_contexts ?? {};
      assert.ok(contexts && typeof contexts === 'object' && !Array.isArray(contexts));
      const attempts = await manager.query(`SELECT a.id,a.phase,a.stage_key,a.external_operation_ref FROM nodia_ai_job_attempts a JOIN nodia_ai_jobs j ON j.id=a.job_id WHERE j.run_id=$1 ORDER BY a.started_at,a.id LIMIT 129`, [run.id]); assert.ok(attempts.length <= 128);
      Object.assign(checks, { readback_MCP_equals_current_compiled_page: equal(reads[0].public_result, page) && page.next_cursor === null && page.items.length === 1 && page.items[0].preference_id === SURVIVOR && page.items[0].available,
        no_removed_preference_in_run_context: Array.isArray(manifestRefs) && equal(refs(manifestRefs), expectedRefs) && expectedRefs.length === 1 && expectedRefs[0].preference_id === SURVIVOR,
        no_removed_preference_in_stored_stage_contexts: Object.values(contexts).every(context => Array.isArray(context.accepted_preferences) && equal(refs(context.accepted_preferences), expectedRefs)),
        all_native_inferences_have_current_preference_context: attempts.some(attempt => attempt.external_operation_ref !== null && ['inference', 'delegated_inference'].includes(attempt.stage_key)) && attempts.filter(attempt => attempt.external_operation_ref !== null && ['inference', 'delegated_inference'].includes(attempt.stage_key)).every(attempt => contexts[attempt.id] !== undefined) });
      readback = { run_id: run.id, provider_dispatches: run.provider_dispatches_used, tool_calls: run.tool_calls_used, MCP_RPCs: run.mcp_rpc_messages_used,
        native_attempts: attempts.filter(attempt => attempt.external_operation_ref !== null), accepted_preferences: manifestRefs, expected_preference_fingerprints: expectedRefs,
        MCP_result_sha256: sha(JSON.stringify(reads[0].public_result)) };
    }
    return { checks, proposal_id: input.proposal.id, proposal_revision: input.proposal.revision, proposal_hash: input.proposal.hash,
      proposal_state: stored.state, preparation_run_id: prepRun.id, preparation_receipt_id: prep.id,
      preparation_result_sha256: sha(JSON.stringify(prep.public_result)), execution, readback, baseline,
      current_preferences: page.items.map(item => ({ preference_id: item.preference_id, key: item.key, revision: item.revision, available: item.available })),
      target_preference_id: TARGET, survivor_preference_id: SURVIVOR, actor_current_authority_verified: true };
  });
  Object.assign(report, snapshot, { status: Object.values(snapshot.checks).every(Boolean) ? 'validated_read_only' : 'validation_failed',
    inspection_phase: input.phase, release_manifest_sha256: RELEASE, schema_pins: { published_preparation: PREP_SHA, published_common_reads: READ_SHA },
    historical_messages_and_receipts_not_rewritten: true });
  if (report.status !== 'validated_read_only') process.exitCode = 1;
} catch (error) {
  Object.assign(report, { status: 'inspection_failed', failed_phase: phase,
    error_class: ['AssertionError', 'Error', 'ForbiddenException', 'UnauthorizedException', 'QueryFailedError', 'TypeError', 'SyntaxError'].includes(error?.name) ? error.name : 'unclassified',
    error_code: ['nodia_ai:capability_denied', 'auth:session_expired'].includes(error?.message) ? error.message : null });
  process.exitCode = 1;
} finally { if (db?.isInitialized) await db.destroy().catch(() => {}); }
console.log(JSON.stringify(report));
