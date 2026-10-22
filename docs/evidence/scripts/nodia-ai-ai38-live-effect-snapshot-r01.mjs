// Operator-only bounded SQL observer. Never imports the application or dispatches tools.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const ORIGINAL = '/opt/nodia/releases/nodia-server-ai15-20261016';
const sha = value => createHash('sha256').update(value).digest('hex');
let stage = 'arguments', source, runner;
try {
  const { values } = parseArgs({ options: {
    'conversation-id': { type: 'string' }, marker: { type: 'string' }, phase: { type: 'string' },
  }, strict: true, allowPositionals: false });
  const id = values['conversation-id'];
  const marker = values.marker;
  const phase = values.phase ?? 'observation';
  assert.match(id ?? '', /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
  if (marker !== undefined) assert.match(marker, /^AI38-UI-[A-Za-z0-9_-]{1,100}$/u);
  assert.match(phase, /^[a-zA-Z0-9_-]{1,80}$/u);
  const require = createRequire(path.join(ORIGINAL, 'package.json'));
  const config = require('dotenv').parse(fs.readFileSync(path.join(ORIGINAL, '.env')));
  const { DataSource } = require('typeorm');
  stage = 'connection';
  source = new DataSource({ type: 'postgres', host: config.POSTGRES_HOST,
    port: Number(config.POSTGRES_PORT), database: config.POSTGRES_DB,
    username: config.POSTGRES_USER, password: config.POSTGRES_PASSWORD,
    ssl: config.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    synchronize: false, migrationsRun: false, logging: false,
    extra: { connectionTimeoutMillis: 5000, statement_timeout: 5000, idle_in_transaction_session_timeout: 15000 } });
  await source.initialize();
  runner = source.createQueryRunner(); await runner.connect();
  await runner.startTransaction('REPEATABLE READ');
  await runner.query('SET TRANSACTION READ ONLY');
  const [tx] = await runner.query("SELECT current_setting('transaction_read_only') read_only, current_setting('transaction_isolation') isolation, now() observed_at_utc");
  assert.equal(tx.read_only, 'on'); assert.equal(tx.isolation, 'repeatable read');
  stage = 'bounds';
  const [counts] = await runner.query(`SELECT
    (SELECT count(*)::int FROM nodia_ai_conversations WHERE id=$1) conversations,
    (SELECT count(*)::int FROM nodia_ai_messages WHERE conversation_id=$1) messages,
    (SELECT count(*)::int FROM nodia_ai_runs WHERE conversation_id=$1) runs,
    (SELECT count(*)::int FROM nodia_ai_tool_calls WHERE conversation_id=$1) tool_calls,
    (SELECT count(*)::int FROM nodia_ai_proposals WHERE conversation_id=$1) proposals,
    (SELECT count(*)::int FROM nodia_ai_proposal_revisions r JOIN nodia_ai_proposals p ON p.id=r.proposal_id WHERE p.conversation_id=$1) proposal_revisions,
    (SELECT count(*)::int FROM nodia_ai_proposal_steps s JOIN nodia_ai_proposals p ON p.id=s.proposal_id WHERE p.conversation_id=$1) proposal_steps,
    (SELECT count(*)::int FROM nodia_ai_executions WHERE origin_conversation_id=$1) executions,
    (SELECT count(*)::int FROM nodia_ai_execution_steps s JOIN nodia_ai_executions e ON e.id=s.execution_id WHERE e.origin_conversation_id=$1) execution_steps,
    (SELECT count(*)::int FROM nodia_ai_confirmation_challenges c JOIN nodia_ai_proposals p ON p.id=c.proposal_id WHERE p.conversation_id=$1) challenges,
    (SELECT count(*)::int FROM nodia_ai_execution_grants g WHERE g.run_id IN(SELECT id FROM nodia_ai_runs WHERE conversation_id=$1) OR g.execution_id IN(SELECT id FROM nodia_ai_executions WHERE origin_conversation_id=$1)) grants,
    (SELECT count(*)::int FROM nodia_ai_jobs WHERE conversation_id=$1) jobs,
    (SELECT count(*)::int FROM nodia_ai_job_attempts a JOIN nodia_ai_jobs j ON j.id=a.job_id WHERE j.conversation_id=$1) attempts`, [id]);
  assert.equal(counts.conversations, 1);
  for (const [key, cap] of Object.entries({ messages: 200, runs: 100, tool_calls: 500,
    proposals: 100, proposal_revisions: 300, proposal_steps: 800, executions: 100,
    execution_steps: 800, challenges: 300, grants: 300, jobs: 500, attempts: 1000 }))
    assert.ok(Number.isInteger(counts[key]) && counts[key] >= 0 && counts[key] <= cap, 'observation_cap_exceeded');
  stage = 'projection';
  const [conversation] = await runner.query(`SELECT id,owner_id,revision,retention_epoch,lifecycle,
    selected_connection_id,selected_mode,selected_model_id,selected_effort_id,routing_revision,routing_enabled,
    active_job_id,next_message_seq,next_event_seq,last_owner_message_at,expires_at
    FROM nodia_ai_conversations WHERE id=$1`, [id]);
  const owner = conversation.owner_id;
  const [categoryCounts] = await runner.query(`SELECT count(*)::int owned_total,
    count(*) FILTER(WHERE is_active)::int owned_active FROM finance_categories WHERE user_id=$1`, [owner]);
  assert.ok(categoryCounts.owned_total <= 500, 'category_observation_cap_exceeded');
  const ownActiveCategories = await runner.query(`SELECT id,user_id,is_active FROM finance_categories
    WHERE user_id=$1 AND is_active ORDER BY id LIMIT 500`, [owner]);
  const proposals = await runner.query(`SELECT p.id,p.actor_id,p.current_revision,p.prior_execution_id,
    r.revision,r.state,r.hash,r.catalog_version,r.canonicalization_version,r.created_at,r.expires_at
    FROM nodia_ai_proposals p JOIN nodia_ai_proposal_revisions r ON r.proposal_id=p.id
    WHERE p.conversation_id=$1 ORDER BY p.id,r.revision LIMIT 300`, [id]);
  const proposalSteps = await runner.query(`SELECT s.id,s.proposal_id,s.proposal_revision,s.position,
    s.tool_name,s.contract_hash,s.kind,s.effect_key,s.scope->>'subject_user_id' subject_user_id,
    encode(sha256(convert_to(s.command_template::text,'UTF8')),'hex') command_template_sha256,
    encode(sha256(convert_to(s.public_step::text,'UTF8')),'hex') public_step_sha256,
    encode(sha256(convert_to(s.preconditions::text,'UTF8')),'hex') preconditions_sha256
    FROM nodia_ai_proposal_steps s JOIN nodia_ai_proposals p ON p.id=s.proposal_id
    WHERE p.conversation_id=$1 ORDER BY s.proposal_id,s.proposal_revision,s.position LIMIT 800`, [id]);
  const executions = await runner.query(`SELECT id,proposal_id,origin_proposal_id,origin_proposal_revision,
    proposal_hash,actor_id,chat_owner_id,catalog_version,revision,state,prior_execution_id,created_at,completed_at
    FROM nodia_ai_executions WHERE origin_conversation_id=$1 ORDER BY created_at,id LIMIT 100`, [id]);
  const executionSteps = await runner.query(`SELECT s.id,s.execution_id,s.source_step_id,s.position,s.tool_name,
    s.template_hash,s.bound_command_hash,s.state,s.minimal_scope->>'subject_user_id' subject_user_id,
    CASE WHEN s.minimal_receipt IS NULL THEN NULL ELSE jsonb_build_object(
      'schema_version',s.minimal_receipt->'schema_version','resource_key',s.minimal_receipt->'resource_key',
      'resource_id',s.minimal_receipt->'resource_id','subject_user_id',s.minimal_receipt->'subject_user_id') END minimal_receipt,
    s.lease_fence,s.error_code,s.dispatched_at,s.completed_at
    FROM nodia_ai_execution_steps s JOIN nodia_ai_executions e ON e.id=s.execution_id
    WHERE e.origin_conversation_id=$1 ORDER BY s.execution_id,s.position LIMIT 800`, [id]);
  const challenges = await runner.query(`SELECT c.id,c.proposal_id,c.proposal_revision,c.actor_id,c.expected_hash,
    c.consumed_at IS NOT NULL consumed,c.created_at,c.expires_at,c.consumed_at
    FROM nodia_ai_confirmation_challenges c JOIN nodia_ai_proposals p ON p.id=c.proposal_id
    WHERE p.conversation_id=$1 ORDER BY c.created_at,c.id LIMIT 300`, [id]);
  const grants = await runner.query(`SELECT g.id,g.actor_id,g.run_id,g.execution_id,g.command_set_hash,
    g.policy_version,g.expires_at,g.revoked_at,g.created_at FROM nodia_ai_execution_grants g
    WHERE g.run_id IN(SELECT id FROM nodia_ai_runs WHERE conversation_id=$1)
    OR g.execution_id IN(SELECT id FROM nodia_ai_executions WHERE origin_conversation_id=$1)
    ORDER BY g.created_at,g.id LIMIT 300`, [id]);
  const runs = await runner.query(`SELECT id,actor_id,connection_id,selection_snapshot,
    catalog_version,policy_version,revision,state,phase,error_code,created_at,completed_at,
    provider_dispatches_used,tool_calls_used,mcp_rpc_messages_used,compactions_used,delegations_used
    FROM nodia_ai_runs WHERE conversation_id=$1 ORDER BY created_at,id LIMIT 100`, [id]);
  const callbacks = await runner.query(`SELECT id,run_id,tool_name,contract_hash,state,created_at,completed_at,
    public_result->>'status' preparation_status,public_result->>'draft_id' draft_id,
    public_result->'proposal'->>'proposal_id' result_proposal_id
    FROM nodia_ai_tool_calls WHERE conversation_id=$1 ORDER BY created_at,id LIMIT 500`, [id]);
  const callbackCounts = await runner.query(`SELECT tool_name,state,count(*)::int count
    FROM nodia_ai_tool_calls WHERE conversation_id=$1 GROUP BY tool_name,state ORDER BY tool_name,state`, [id]);
  const jobs = await runner.query(`SELECT id,run_id,execution_id,kind,state,stage_key,stage_seq,
    attempt_count,fence,available_at,deadline_at,created_at,updated_at FROM nodia_ai_jobs
    WHERE conversation_id=$1 ORDER BY created_at,id LIMIT 500`, [id]);
  const attempts = await runner.query(`SELECT a.id,a.job_id,a.attempt_no,a.fence,a.phase,a.stage_key,a.stage_seq,
    a.error_code,a.external_operation_ref IS NOT NULL native_operation_reference_present,
    a.started_at,a.ended_at FROM nodia_ai_job_attempts a JOIN nodia_ai_jobs j ON j.id=a.job_id
    WHERE j.conversation_id=$1 ORDER BY a.started_at,a.id LIMIT 1000`, [id]);
  const [quiet] = await runner.query(`SELECT
    (SELECT count(*)::int FROM nodia_ai_jobs WHERE state IN('ready','leased','waiting','unknown')) pending_jobs,
    (SELECT count(*)::int FROM nodia_ai_job_attempts WHERE ended_at IS NULL) open_attempts,
    (SELECT count(*)::int FROM nodia_ai_runtime_slots WHERE state IN('held','unknown')) retained_slots`);
  let markerCount = null, movements = [];
  if (marker !== undefined) {
    [markerCount] = await runner.query(`SELECT count(*)::int owned_marker_count
      FROM finance_movements WHERE user_id=$1 AND name=$2`, [owner,marker]);
    assert.ok(markerCount.owned_marker_count <= 100, 'marker_observation_cap_exceeded');
    movements = await runner.query(`SELECT id,user_id,category_id,obligation_id,name AS test_marker,
      amount,type,status,is_active,created_at,updated_at FROM finance_movements
      WHERE user_id=$1 AND name=$2 ORDER BY id LIMIT 100`, [owner,marker]);
  }
  await runner.commitTransaction();
  const snapshot = { conversation,counts,category_counts:categoryCounts,own_active_categories:ownActiveCategories,
    proposals,proposal_steps:proposalSteps,executions,execution_steps:executionSteps,challenges,grants,
    runs,callbacks,callback_counts:callbackCounts,jobs,attempts,marker_count:markerCount,movements };
  console.log(JSON.stringify({ schema:'ai38-live-effect-snapshot-v1',phase,
    status:'observed_not_physical_UI_or_provider_ACK_attestation',observed_at_VM_utc:tx.observed_at_utc,
    source_sha256:sha(fs.readFileSync(fileURLToPath(import.meta.url))),
    connection_runtime_root:ORIGINAL,transaction:{read_only:true,isolation:tx.isolation},
    snapshot_sha256:sha(JSON.stringify(snapshot)),snapshot,global_quiet:quiet,
    configured_SQL_writes:0,provider_requests:0,chat_payloads_emitted:false,
    session_or_confirmation_secrets_emitted:false,
    limits:['SQL callbacks/counters are persisted observations, not native ACK attestation.',
      'Human gesture, authenticated DOM, exact preview and HTTP calls need independent evidence.',
      'Counts may legitimately be zero before preparation/confirmation; no phase success is inferred.',
      'Owned exact marker only; no unrelated financial rows or category names are emitted.'] },null,2));
} catch {
  console.error(JSON.stringify({schema:'ai38-live-effect-snapshot-v1',status:'failed',stage,diagnostic_details_withheld:true}));
  process.exitCode=1;
} finally {
  if(runner?.isTransactionActive) await runner.rollbackTransaction().catch(()=>{});
  if(runner) await runner.release().catch(()=>{});
  if(source?.isInitialized) await source.destroy().catch(()=>{});
}
