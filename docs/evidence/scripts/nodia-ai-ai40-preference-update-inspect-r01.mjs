// OPERATOR ONLY. Caller seals this source and the real fixture descriptor per intention.
// No confirmation, SDK, journal, loadForContext or SQL mutation. main() is explicit.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { isDeepStrictEqual as equal } from 'node:util';
import { pathToFileURL } from 'node:url';
const ROOT = '/opt/nodia/releases/nodia-server-ai40-r08';
const RELEASE = '08145edaefff382ba2ccbbf8d51c325de630feeef5b67a1834651b1cdd6577bc';
const CHAT = 'ec626b72-1f32-4486-9f3a-8263cffce267', OWNER = '1', AUTHORITY = '8e4c0db1-6b07-4524-a1cf-f33d09210766';
const TARGET = '04f8a72d-2fab-4c48-b7e1-e15e95d70bec';
const READ_SHA = '429791402fb77b88fa6131ca2585d1e0c242d8ae1bd2a3ec5caede1f5582e80c';
const PREP_SHA = 'f6fb6198795002f4378e890f2ff861fe32786e2e3021daa2c12c490449382d22';
const sha = value => createHash('sha256').update(value).digest('hex');
const exact = (v, keys) => v !== null && typeof v === 'object' && !Array.isArray(v) && equal(Object.keys(v).sort(), [...keys].sort());
const hash = v => typeof v === 'string' && /^[a-f0-9]{64}$/u.test(v);
const uuid = v => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(v);
const bigint = v => typeof v === 'string' && /^[1-9][0-9]{0,18}$/u.test(v) && BigInt(v) <= 9223372036854775807n;
export function validateDescriptor(v) {
  assert.ok(exact(v, ['schema_version', 'phase', 'conversation_id', 'expected_owner_id', 'authority_run_id', 'category', 'preparation_run_id', 'proposal', 'execution_id', 'readback_run_id', 'baseline', 'database', 'published_preparation_schema_base64']));
  assert.equal(v.schema_version, 1); assert.equal(v.conversation_id, CHAT); assert.equal(v.expected_owner_id, OWNER); assert.equal(v.authority_run_id, AUTHORITY);
  assert.ok(['prepared', 'committed', 'readback'].includes(v.phase) && uuid(v.preparation_run_id));
  const c = v.category;
  assert.ok(exact(c, ['id', 'key', 'name', 'creation_receipt_sha256']) && bigint(c.id) && hash(c.creation_receipt_sha256));
  for (const k of ['key', 'name']) assert.ok(typeof c[k] === 'string' && c[k].length > 0 && c[k].length <= 255 && !/[\0\r\n]/u.test(c[k]));
  assert.ok(exact(v.proposal, ['id', 'revision', 'hash']) && uuid(v.proposal.id) && Number.isSafeInteger(v.proposal.revision) && v.proposal.revision > 0 && v.proposal.revision <= 2147483647 && hash(v.proposal.hash));
  if (v.phase === 'prepared') assert.ok(v.execution_id === null && v.readback_run_id === null && v.baseline === null);
  else {
    assert.ok(uuid(v.execution_id) && exact(v.baseline, ['old_value', 'preference_sql_sha256', 'preference_fingerprint', 'finance_sql_sha256']));
    assert.ok(bigint(v.baseline.old_value) && v.baseline.old_value !== c.id);
    for (const k of ['preference_sql_sha256', 'preference_fingerprint', 'finance_sql_sha256']) assert.ok(hash(v.baseline[k]));
    assert.ok(v.phase === 'readback' ? uuid(v.readback_run_id) && v.readback_run_id !== v.preparation_run_id : v.readback_run_id === null);
  }
  const d = v.database;
  assert.ok(exact(d, ['host', 'port', 'database', 'username', 'password', 'ssl']) && d.host === '127.0.0.1' && typeof d.ssl === 'boolean' && Number.isSafeInteger(d.port) && d.port > 0 && d.port <= 65535);
  for (const k of ['database', 'username', 'password']) assert.ok(typeof d[k] === 'string' && d[k].length > 0 && Buffer.byteLength(d[k]) <= 4096 && !/[\0\r\n]/u.test(d[k]));
  assert.ok(typeof v.published_preparation_schema_base64 === 'string'); return v;
}
export async function main() {
  let db, phase = 'closed_descriptor';
  const report = { schema: 'nodia-ai-ai40-preference-update-inspection-v1', SQL_writes: 0, SDK_requests: 0, confirmation_requests: 0, journal_reads: 0, journal_writes: 0, credentials_or_raw_messages_emitted: false, fixture_receipt_provenance_requires_pinned_caller: true, native_ACK_requires_separate_reader: true };
  try {
    const chunks = []; let size = 0;
    for await (const chunk of process.stdin) { size += chunk.length; assert.ok(size <= 131072); chunks.push(chunk); }
    const input = validateDescriptor(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    phase = 'pinned_environment';
    assert.equal(process.platform, 'linux'); assert.equal(process.getuid(), 10000); assert.equal(process.env.NODE_ENV, 'test'); assert.equal(process.env.DOTENV_CONFIG_PATH, '/dev/null'); assert.equal(process.env.RATE_LIMIT_STORAGE, 'memory');
    const require = createRequire(ROOT + '/package.json'); require('reflect-metadata');
    const bytes = await readFile(ROOT + '/release-manifest.json'); assert.equal(sha(bytes), RELEASE); const manifest = JSON.parse(bytes);
    const pinned = async path => { const value = await readFile(ROOT + '/' + path); assert.equal(sha(value), manifest.files[path]); return value; };
    const load = async (path, name) => { await pinned('dist/' + path + '.js'); return (await import(pathToFileURL(ROOT + '/dist/' + path + '.js')))[name]; };
    const reads = await pinned('dist/nodia-ai-products/contracts/common-reads.json'); assert.equal(sha(reads), READ_SHA);
    const preparation = Buffer.from(input.published_preparation_schema_base64, 'base64'); assert.equal(preparation.toString('base64'), input.published_preparation_schema_base64); assert.equal(sha(preparation), PREP_SHA);
    const { Ajv2020 } = require('ajv/dist/2020.js'), formats = require('ajv-formats'); const ajv = new Ajv2020({ strict: true }); formats(ajv);
    const r = JSON.parse(reads), p = JSON.parse(preparation); ajv.addSchema(r); ajv.addSchema(p);
    const knowledge = JSON.parse(await pinned('dist/nodia-ai/knowledge/manifest.json'));
    const definitions = [['nodia_preferences_prepare', p, PREP_SHA, 'McpPreferencePrepareInput', 'McpPreferencePreparationResult'], ['nodia_proposals_get', r, READ_SHA, 'ProposalGetInput', 'PublicProposal'], ['nodia_preferences_list', r, READ_SHA, 'PreferenceListInput', 'PreferencePage']];
    const contracts = Object.fromEntries(definitions.map(([name, schema, pin, i, o]) => {
      const caps = knowledge.capability_contracts.filter(cap => cap.capability_id === name); assert.equal(caps.length, 1); const cap = caps[0];
      assert.equal(cap.publication, 'published'); assert.equal(cap.input_schema.sha256, pin); assert.equal(cap.output_schema.sha256, pin); assert.equal(cap.input_schema.definition, i); assert.equal(cap.output_schema.definition, o);
      return [name, [i, o].map(def => ajv.compile({ $ref: schema.$id + '#/$defs/' + def }))];
    }));
    const receiptValid = ajv.compile({ $ref: p.$id + '#/$defs/PreferenceEffectReceipt' });
    const [Auth, Authorize, Store, Reader, List, fingerprint] = await Promise.all([
      ['nodia-ai/nodia-ai-authorization.service', 'NodiaAiAuthorizationService'], ['nodia-ai/use-case/authorize-nodia-ai.use-case', 'AuthorizeNodiaAiUseCase'], ['nodia-ai-preference/nodia-ai-preference.service', 'NodiaAiPreferenceService'], ['nodia-ai-preference/use-case/nodia-ai-preference-reader.use-case', 'NodiaAiPreferenceReaderUseCase'], ['nodia-ai-preference/use-case/list-nodia-ai-preferences.use-case', 'ListNodiaAiPreferencesUseCase'], ['nodia-ai-preference/types/preference.types', 'preferenceFingerprint'],
    ].map(([path, name]) => load(path, name)));
    const { DataSource } = require('typeorm');
    db = await new DataSource({ type: 'postgres', ...input.database, ssl: input.database.ssl ? { rejectUnauthorized: false } : undefined, synchronize: false, migrationsRun: false, installExtensions: false, logging: false, entities: [ROOT + '/dist/**/*.entity.js'], extra: { max: 2, connectionTimeoutMillis: 5000, statement_timeout: 5000, options: '-c default_transaction_read_only=on' } }).initialize();
    const authorize = new Authorize(new Auth(db)), store = new Store(db), reader = new Reader(store, authorize), list = new List(store, authorize, reader);
    phase = 'authorized_snapshot';
    const snapshot = await db.transaction('REPEATABLE READ', async m => {
      await m.query('SET TRANSACTION READ ONLY');
      const [chat] = await m.query('SELECT owner_id::text,lifecycle,expires_at>clock_timestamp() unexpired FROM nodia_ai_conversations WHERE id=$1', [CHAT]); assert.ok(chat?.owner_id === OWNER && chat.lifecycle === 'active' && chat.unexpired);
      const grants = await m.query('SELECT g.session_public_id::text FROM nodia_ai_execution_grants g JOIN nodia_ai_runs r ON r.id=g.run_id WHERE r.id=$1 AND r.conversation_id=$2 AND r.actor_id=$3 AND g.actor_id=$3 LIMIT 2', [AUTHORITY, CHAT, OWNER]); assert.equal(grants.length, 1);
      const identity = { userId: OWNER, sessionId: grants[0].session_public_id }, actor = await authorize.execute(identity, {}, m); assert.equal(actor.actorId, OWNER);
      const [category] = await m.query('SELECT id::text,user_id::text,key,name,is_active FROM finance_categories WHERE id=$1', [input.category.id]); assert.ok(category?.user_id === OWNER && category.is_active && category.key === input.category.key && category.name === input.category.name);
      const ownRun = async id => { const [run] = await m.query('SELECT id,state,assistant_message_id,context_manifest FROM nodia_ai_runs WHERE id=$1 AND conversation_id=$2 AND actor_id=$3', [id, CHAT, OWNER]); assert.ok(run?.state === 'completed' && run.assistant_message_id !== null); return run; };
      const calls = async id => { const rows = await m.query('SELECT id,tool_name,state,arguments,public_result,contract_hash FROM nodia_ai_tool_calls WHERE run_id=$1 AND conversation_id=$2 ORDER BY created_at,id LIMIT 17', [id, CHAT]); assert.ok(rows.length <= 16); return rows.filter(row => row.tool_name !== 'nodia_capabilities_select').map(row => { const pair = contracts[row.tool_name]; assert.ok(pair && row.state === 'completed' && hash(row.contract_hash) && pair[0](row.arguments) && pair[1](row.public_result)); return row; }); };
      await ownRun(input.preparation_run_id); const prepCalls = await calls(input.preparation_run_id), preps = prepCalls.filter(row => row.tool_name === 'nodia_preferences_prepare'), gets = prepCalls.filter(row => row.tool_name === 'nodia_proposals_get'); assert.equal(preps.length, 1); assert.ok(gets.length >= 1 && prepCalls.length === 1 + gets.length);
      const prep = preps[0]; assert.deepEqual(prep.arguments, { operation: 'update', partial: { id: TARGET, expected_revision: 1, value: category.id } }); const publicProposal = prep.public_result.proposal;
      assert.ok(prep.public_result.status === 'ready' && publicProposal?.state === 'ready' && publicProposal.proposal_id === input.proposal.id && publicProposal.revision === input.proposal.revision && publicProposal.hash === input.proposal.hash);
      assert.ok(gets.every(row => equal(row.arguments, { proposal_id: input.proposal.id }) && equal(row.public_result, publicProposal)));
      const [proposal] = await m.query('SELECT p.actor_id::text,p.conversation_id,p.current_revision,r.hash,r.state,r.expires_at>clock_timestamp() unexpired FROM nodia_ai_proposals p JOIN nodia_ai_proposal_revisions r ON r.proposal_id=p.id AND r.revision=$2 WHERE p.id=$1', [input.proposal.id, input.proposal.revision]); assert.ok(proposal?.actor_id === OWNER && proposal.conversation_id === CHAT && proposal.current_revision === input.proposal.revision && proposal.hash === input.proposal.hash);
      const steps = await m.query('SELECT id,tool_name,scope,command_template,preconditions,public_step FROM nodia_ai_proposal_steps WHERE proposal_id=$1 AND proposal_revision=$2 ORDER BY position', [input.proposal.id, input.proposal.revision]); assert.equal(steps.length, 1); const step = steps[0], old = step.preconditions.target;
      assert.ok(step.tool_name === 'nodia_preferences_prepare_update' && step.scope.subject_user_id === OWNER && step.command_template.id === TARGET && step.command_template.expected_revision === 1 && step.command_template.value === category.id && step.command_template.key === 'expense_category_id' && step.command_template.scope_key === 'finance' && equal(step.command_template.scope, {}) && old.id === TARGET && old.revision === 1 && bigint(old.value) && old.value !== category.id);
      assert.deepEqual(publicProposal.steps, [step.public_step]); assert.ok(step.public_step.effect_key === 'preferences.update' && step.public_step.kind === 'preference_change' && step.public_step.target.id === TARGET && step.public_step.depends_on.length === 0 && step.public_step.output_bindings.length === 0);
      const page = await list.executeInTransaction(m, identity, { scope_key: 'finance', page_limit: 2 }), prefs = await store.list(m, OWNER); assert.equal(prefs.length, 1); assert.equal(page.items.length, 1); assert.equal(page.next_cursor, null); const item = page.items[0];
      // Candidate projection checks current reference eligibility, not accepted memory.
      const [candidate] = await reader.project(m, actor, [{ ...prefs[0], value: category.id }], actor.modules.map(module => module.route));
      assert.ok(candidate.available && candidate.value_label === category.name && candidate.value === category.id);
      const currentFingerprint = fingerprint([{ ...item, id: item.preference_id }]);
      const [sql] = await m.query("SELECT (SELECT encode(sha256(convert_to(to_jsonb(p)::text,'UTF8')),'hex') FROM nodia_ai_preferences p WHERE id=$1 AND owner_id=$2) preference_sql_sha256,(SELECT encode(sha256(convert_to(COALESCE(jsonb_agg(to_jsonb(f) ORDER BY id)::text,'[]'),'UTF8')),'hex') FROM finance_movements f) finance_sql_sha256", [TARGET, OWNER]);
      const executions = await m.query('SELECT id,conversation_id,proposal_id,origin_conversation_id,origin_proposal_revision,proposal_hash,actor_id::text,chat_owner_id::text,state FROM nodia_ai_executions WHERE origin_proposal_id=$1', [input.proposal.id]);
      const checks = { category_real_active_owned: true, new_reference_available_with_real_label: true, preparation_receipts_exact: true, one_native_update_step_same_target: true, one_current_preference_same_scope: item.preference_id === TARGET && item.scope_key === 'finance' && item.key === 'expense_category_id' && equal(item.scope, {}) && item.available };
      let effect = null, readback = null;
      if (input.phase === 'prepared') Object.assign(checks, { before_human_old_revision_and_value: item.revision === 1 && item.value === old.value, proposal_ready_no_execution: proposal.state === 'ready' && proposal.unexpired && executions.length === 0 });
      else {
        assert.equal(executions.length, 1); const e = executions[0];
        const effects = await m.query('SELECT source_step_id,state,tool_name,minimal_receipt FROM nodia_ai_execution_steps WHERE execution_id=$1 ORDER BY position', [e.id]); assert.equal(effects.length, 1); effect = effects[0];
        const receipt = { schema_version: 1, resource_key: 'nodia_ai_preferences', operation: 'update', resource_id: TARGET, owner_id: OWNER, revision: 2 };
        const [challenge] = await m.query('SELECT count(*)::int total FROM nodia_ai_confirmation_challenges WHERE proposal_id=$1 AND proposal_revision=$2 AND expected_hash=$3 AND actor_id=$4 AND consumed_at IS NOT NULL', [input.proposal.id, input.proposal.revision, input.proposal.hash, OWNER]);
        Object.assign(checks, { one_confirmed_completed_execution: proposal.state === 'confirmed' && e.id === input.execution_id && e.state === 'completed' && e.conversation_id === CHAT && e.origin_conversation_id === CHAT && e.proposal_id === input.proposal.id && e.origin_proposal_revision === input.proposal.revision && e.proposal_hash === input.proposal.hash && e.actor_id === OWNER && e.chat_owner_id === OWNER, one_exact_update_receipt: effect.state === 'completed' && effect.source_step_id === step.id && effect.tool_name === step.tool_name && receiptValid(effect.minimal_receipt) && equal(effect.minimal_receipt, receipt), human_challenge_consumed: challenge.total === 1, new_value_revision_and_label: item.revision === 2 && item.value === category.id && item.value_label === category.name, fingerprint_and_row_changed: currentFingerprint !== input.baseline.preference_fingerprint && sql.preference_sql_sha256 !== input.baseline.preference_sql_sha256 && old.value === input.baseline.old_value, finance_unchanged: sql.finance_sql_sha256 === input.baseline.finance_sql_sha256 });
      }
      if (input.phase === 'readback') {
        const run = await ownRun(input.readback_run_id), currentCalls = await calls(run.id), reads = currentCalls.filter(row => row.tool_name === 'nodia_preferences_list'); assert.equal(reads.length, 1); assert.deepEqual(reads[0].arguments, { scope_key: 'finance', page_limit: 2 }); assert.equal(currentCalls.length, 1);
        const expected = [{ preference_id: TARGET, revision: 2, sha256: currentFingerprint }], contexts = run.context_manifest.stage_contexts ?? {};
        const attempts = await m.query('SELECT a.id,a.stage_key,a.external_operation_ref FROM nodia_ai_job_attempts a JOIN nodia_ai_jobs j ON j.id=a.job_id WHERE j.run_id=$1 ORDER BY a.started_at,a.id LIMIT 129', [run.id]); assert.ok(attempts.length <= 128); const native = attempts.filter(a => a.external_operation_ref !== null && ['inference', 'delegated_inference'].includes(a.stage_key));
        Object.assign(checks, { MCP_readback_matches_current_compiled_reader: equal(reads[0].public_result, page), current_run_fingerprint_exact: equal(run.context_manifest.accepted_preferences, expected), all_native_stage_fingerprints_exact: native.length > 0 && native.every(a => equal(contexts[a.id]?.accepted_preferences, expected)) && Object.values(contexts).every(c => equal(c.accepted_preferences, expected)) });
        readback = { run_id: run.id, receipt_id: reads[0].id, contract_hash: reads[0].contract_hash, result_sha256: sha(JSON.stringify(reads[0].public_result)), accepted_preferences: expected, native_attempts: native };
      }
      return { checks, phase: input.phase, category: input.category, proposal: input.proposal, preparation_run_id: input.preparation_run_id, preparation_receipts: prepCalls.map(row => ({ id: row.id, tool_name: row.tool_name, contract_hash: row.contract_hash })), execution_id: input.execution_id, minimal_receipt: effect?.minimal_receipt ?? null, readback, current_preference: item, baseline: { old_value: old.value, ...sql, preference_fingerprint: currentFingerprint } };
    });
    Object.assign(report, snapshot, { status: Object.values(snapshot.checks).every(Boolean) ? 'validated_read_only' : 'validation_failed', release_manifest_sha256: RELEASE, schema_pins: { published_preparation: PREP_SHA, common_reads: READ_SHA } });
    if (report.status !== 'validated_read_only') process.exitCode = 1;
  } catch (error) { Object.assign(report, { status: 'inspection_failed', failed_phase: phase, error_class: ['AssertionError', 'Error', 'ForbiddenException', 'UnauthorizedException', 'QueryFailedError', 'TypeError', 'SyntaxError'].includes(error?.name) ? error.name : 'unclassified' }); process.exitCode = 1; }
  finally { if (db?.isInitialized) await db.destroy().catch(() => {}); }
  console.log(JSON.stringify(report));
}
