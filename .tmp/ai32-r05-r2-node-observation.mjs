// Run only on the VM. Operational credentials stay in this process and are never projected.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const runtime = '/opt/nodia/releases/nodia-server-ai15-20261016';
const expectedSessions = { token_plan_web: process.argv[2], token_plan_agentic: process.argv[3] };
const requiredMedia = { token_plan_web: ['image/png','application/pdf','audio/wav','audio/webm','audio/ogg'], token_plan_agentic: ['image/png','application/pdf','audio/webm'] };
const report = { stage: 'AI-32-R05-node-observation', status: 'running', provider_generations: 0, database_writes: 0, configured_database_read_only: false, connection_id: '2', selections: [], source_hashes: {} };
let db;
try {
  assert.equal(process.platform, 'linux', 'vm_only');
  assert.ok(Object.values(expectedSessions).every(value => typeof value === 'string' && /^[0-9a-f]{32}$/.test(value)), 'exact_expected_sessions_required');
  const manifestBytes = await readFile('/tmp/nodia-ai32-r05-storage-candidate/dist-manifest.json');
  assert.equal(createHash('sha256').update(manifestBytes).digest('hex'), '0293d34fe9d320be6b9f696ebdc094e839d5cf5919f25091aa480ee262dfc3b5', 'r05_manifest_pin_required');
  const dist = Object.entries(JSON.parse(manifestBytes));
  assert.equal(dist.length, 909, 'exact_tested_compiled_files_required');
  for (const [relative, expected] of dist) {
    assert.ok(!relative.includes('..') && /^dist\/[A-Za-z0-9_./-]+$/.test(relative), 'safe_compiled_path_required');
    assert.equal(createHash('sha256').update(await readFile(runtime + '/' + relative)).digest('hex'), expected, 'compiled_file_drift');
  }
  report.compiled_dist_files_verified = dist.length;
  report.compiled_manifest_reference = 'docs/evidence/nodia-ai-ai32-r05-r2-dist-manifest.json';
  report.compiled_manifest_sha256 = createHash('sha256').update(manifestBytes).digest('hex');
  report.runtime_release = runtime;
  const require = createRequire(runtime + '/package.json');
  require('reflect-metadata');
  const env = require('dotenv').parse(await readFile(runtime + '/.env'));
  for (const key of ['POSTGRES_HOST', 'POSTGRES_PORT', 'POSTGRES_DB', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'GEMINI_MICROSERVICE_URL', 'GEMINI_SERVICE_TOKEN']) {
    assert.ok(typeof env[key] === 'string' && env[key].length > 0, 'required_runtime_configuration_missing');
    process.env[key] = env[key];
  }
  process.env.DOTENV_CONFIG_PATH = '/dev/null';
  const { DataSource } = require('typeorm');
  db = new DataSource({ type: 'postgres', host: env.POSTGRES_HOST, port: Number(env.POSTGRES_PORT), database: env.POSTGRES_DB, username: env.POSTGRES_USER, password: env.POSTGRES_PASSWORD, synchronize: false, migrationsRun: false, logging: false,
    extra: { max: 1, options: '-c default_transaction_read_only=on', statement_timeout: 5000, connectionTimeoutMillis: 5000 } });
  await db.initialize();
  const [mode] = await db.query("SELECT current_setting('default_transaction_read_only') AS default_read_only,current_setting('transaction_read_only') AS transaction_read_only");
  assert.equal(mode.default_read_only, 'on', 'readonly_default_required');
  assert.equal(mode.transaction_read_only, 'on', 'readonly_transaction_required');
  report.configured_database_read_only = true;
  report.database_session = { ...mode, pool_max: 1 };
  const load = async relative => {
    const file = runtime + '/dist/' + relative + '.js';
    report.source_hashes['dist/' + relative + '.js'] = createHash('sha256').update(await readFile(file)).digest('hex');
    return import(pathToFileURL(file).href);
  };
  const [{ GeminiNodiaAiAdapterUseCase }, { NodiaAiAdapterTransport }, { projectNodiaAiConnection }] = await Promise.all([
    load('nodia-ai-adapter/use-case/gemini-nodia-ai-adapter.use-case'),
    load('nodia-ai-adapter/nodia-ai-adapter.service'),
    load('nodia-ai-conversation/use-case/list-nodia-ai-connections.use-case'),
  ]);
  const rows = await db.query(`SELECT p.id::text,COALESCE(NULLIF(p.name,''),c.name) AS label,c.key AS provider_key,
    p.is_active,c.is_active AS catalog_active,p.use_api_key,p.use_token_plan_web,p.use_token_plan_agentic,
    c.can_use_api_key,c.can_use_token_plan_web,c.can_use_token_plan_agentic,p.fields
    FROM ai_providers p JOIN ai_provider_catalog c ON c.id=p.catalog_id WHERE p.id=$1`, ['2']);
  assert.equal(rows.length, 1, 'configured_connection_required');
  assert.equal(rows[0].provider_key, 'gemini', 'exact_provider_required');
  // Reuse the actual server selector. No duplicated model or effort defaults.
  const configuration = projectNodiaAiConnection(rows[0]);
  const adapter = new GeminiNodiaAiAdapterUseCase(db, new NodiaAiAdapterTransport());
  const [conversation] = await db.query('SELECT selected_connection_id::text AS connection_id,selected_mode AS mode,selected_model_id AS model_id,selected_effort_id AS effort_id,revision,retention_epoch::text,routing_revision,lifecycle,(active_job_id IS NOT NULL) AS has_active_job FROM nodia_ai_conversations WHERE id=$1',['33d6c32d-19a3-4533-8077-3ca7299d30cb']);
  assert.ok(conversation, 'authorized_conversation_required');
  report.conversation = conversation;
  for (const wanted of ['token_plan_web', 'token_plan_agentic']) {
    const selected = configuration.modes.find(value => value.mode === wanted);
    if (selected?.configuration !== 'configured' || !selected.configured_selection) {
      report.selections.push({ mode: wanted, status: 'configuration_missing' });
      continue;
    }
    const selection = wanted === conversation.mode ? {connection_id:conversation.connection_id,mode:conversation.mode,model_id:conversation.model_id,effort_id:conversation.effort_id} : selected.configured_selection;
    try {
      const observed = await adapter.observe(selection);
      report.selections.push({ mode: selection.mode, connectionId: selection.connection_id, modelId: selection.model_id, effortId: selection.effort_id,
        status: 'contract_accepted', available: observed.available, source: observed.source, observedAt: observed.observedAt.toISOString(), resourceKey: observed.resourceKey,
        configurationGeneration: observed.configurationGeneration, sessionGeneration: observed.sessionGeneration, adapterContractVersion: observed.adapterContractVersion,
        verifiedModalities: observed.verifiedModalities, verifiedAttachmentMediaTypes: observed.verifiedAttachmentMediaTypes, supportsMcp: observed.supportsMcp,
        reason: observed.reason,
        exactSessionMatched: observed.sessionGeneration === expectedSessions[wanted],
        exactMediaTypesMatched: JSON.stringify([...(observed.verifiedAttachmentMediaTypes ?? [])].sort()) === JSON.stringify([...requiredMedia[wanted]].sort()) });
    } catch (error) {
      const code = typeof error?.code === 'string' && /^[a-z_]{1,100}$/.test(error.code) ? error.code : 'observation_failed';
      report.selections.push({ mode: selection.mode, connectionId: selection.connection_id, modelId: selection.model_id, effortId: selection.effort_id, status: 'rejected', error_code: code });
    }
  }
  const [last] = await db.query("SELECT current_setting('transaction_read_only') AS transaction_read_only");
  assert.equal(last.transaction_read_only, 'on', 'readonly_session_preserved');
  report.status = report.selections.length === 2 && report.selections.every(value => value.status === 'contract_accepted' && value.available === true && value.exactSessionMatched && value.exactMediaTypesMatched) ? 'passed' : 'gates_open';
} catch (error) {
  report.status = 'failed';
  // Deliberately exclude arbitrary error messages, SQL, env and remote response bodies.
  report.error = { name: typeof error?.name === 'string' && /^[A-Za-z0-9_]{1,80}$/.test(error.name) ? error.name : 'Error', code: typeof error?.code === 'string' && /^[A-Za-z0-9_]{1,100}$/.test(error.code) ? error.code : 'safe_observation_failed' };
} finally {
  if (db?.isInitialized) await db.destroy();
}
report.observed_at_utc_vm = new Date().toISOString();
console.log(JSON.stringify(report, null, 2));
if (report.status !== 'passed') process.exitCode = 1;
