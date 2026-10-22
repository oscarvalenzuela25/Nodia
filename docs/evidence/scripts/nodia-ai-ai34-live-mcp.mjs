// Explicit synthetic real-Gemini canary. Read-only configured SQL, one independent MCP generation maximum.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';

assert.equal(process.env.NODIA_AI_ALLOW_LIVE, 'yes', 'Explicit live opt-in is required');
const runtime = process.env.NODIA_AI_AI34_RUNTIME;
const output = process.env.NODIA_AI_AI34_OUTPUT;
assert.ok(runtime && path.isAbsolute(runtime) && output && path.isAbsolute(output), 'Explicit runtime/output paths are required');
assert.equal(fs.existsSync(output), false, 'Never overwrite evidence from an earlier live attempt');
const require = createRequire(path.join(runtime, 'package.json'));
const { parse } = require('dotenv');
const config = parse(fs.readFileSync(path.join(runtime, '.env')));
const privateUrl = new URL(config.GEMINI_MICROSERVICE_URL);
assert.ok(['127.0.0.1', 'localhost', '::1', '[::1]'].includes(privateUrl.hostname), 'The adapter must remain private');
assert.match(config.GEMINI_SERVICE_TOKEN ?? '', /^[a-f0-9]{64}$/i);
for (const [key, value] of Object.entries(config)) if (process.env[key] === undefined) process.env[key] = value;
process.env.GEMINI_SERVICE_TOKEN = config.GEMINI_SERVICE_TOKEN;
process.env.GEMINI_MICROSERVICE_URL = config.GEMINI_MICROSERVICE_URL.replace(/\/+$/, '');
process.env.DOTENV_CONFIG_PATH = '/dev/null';
const load = (file) => import(pathToFileURL(path.join(runtime, 'dist', file + '.js')).href);
const [{ DataSource }, { GeminiNodiaAiAdapterUseCase: Adapter }, { NodiaAiAdapterTransport: Transport },
  { ReconcileGeminiNodiaAiRuntimeUseCase: Reconciliation }, { BuildNodiaAiCompactionUseCase: Compaction },
  { BuildNodiaAiContextUseCase: Context }, { ValidateNodiaAiRuntimePolicyUseCase: ValidatePolicy },
  { LoadNodiaAiKnowledgeUseCase: Knowledge }, { NODIA_AI_COMPACTION_BUILDER_VERSION: builderVersion }] = await Promise.all([
  import(require.resolve('typeorm')), load('nodia-ai-adapter/use-case/gemini-nodia-ai-adapter.use-case'),
  load('nodia-ai-adapter/nodia-ai-adapter.service'), load('nodia-ai-adapter/use-case/reconcile-gemini-nodia-ai-runtime.use-case'),
  load('nodia-ai-context/use-case/build-nodia-ai-compaction.use-case'), load('nodia-ai-context/use-case/build-nodia-ai-context.use-case'),
  load('nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case'),
  load('nodia-ai-context/use-case/load-nodia-ai-knowledge.use-case'), load('nodia-ai-context/types/nodia-ai-compaction.types'),
]);
const policy = new ValidatePolicy().execute(JSON.parse(fs.readFileSync(path.join(runtime, 'dist/nodia-ai-runtime/config/runtime-policy.json'), 'utf8')));
const root = path.join(runtime, 'dist/nodia-ai/knowledge');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const pin = JSON.parse(fs.readFileSync(path.join(runtime, 'dist/nodia-ai-context/config/knowledge-pin.json'), 'utf8'));
const registrations = manifest.capability_contracts.map((item) => ({ capability_id: item.capability_id,
  revision: item.revision, kind: item.kind, required_module_routes: item.required_module_routes,
  input_schema_sha256: item.input_schema.sha256, output_schema_sha256: item.output_schema.sha256 }));
const knowledge = new Knowledge(root, pin, fs.readFileSync(path.join(runtime, 'dist/nodia-ai-context/config/knowledge-schema.json')), registrations, policy);
const context = new Context(knowledge, policy), compaction = new Compaction(policy), transport = new Transport();
const db = new DataSource({ type: 'postgres', host: config.POSTGRES_HOST, port: Number(config.POSTGRES_PORT),
  database: config.POSTGRES_DB, username: config.POSTGRES_USER, password: config.POSTGRES_PASSWORD,
  ssl: config.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : undefined, synchronize: false, migrationsRun: false });
const report = { stage: 'AI-34', scope: 'real_gemini_independent_synthetic_mcp_canary', status: 'running',
  observed_at_utc: new Date().toISOString(), maximum_generations: 1, generation_requests: 0,
  operational_sql_writes: 0, user_chats_created: 0, business_tools_exposed: 0, automatic_inference_retries: 0,
  credentials_logged: false, model_context_tokens: null, knowledge_release: pin.release_id,
  knowledge_capability_metadata_source: 'built_manifest_projection_not_an_independent_tool_registry_test',
  sql_worker_and_snapshot_persistence_acceptance: 'separate_isolated_integration', checks: [], probes: [] };
const save = () => fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
const check = (label, ok) => { assert.ok(ok, label); report.checks.push(label); save(); };
const hash = (value) => createHash('sha256').update(value).digest('hex');
let reconciliation;
let pending;
let agenticConfiguration;
await db.initialize();
try {
  const adapter = new Adapter(db, transport); reconciliation = new Reconciliation(transport);
  const quiet = (await db.query(`SELECT (SELECT count(*)::int FROM nodia_ai_jobs WHERE state IN ('ready','leased','waiting','unknown')) pending_jobs,
    (SELECT count(*)::int FROM nodia_ai_job_attempts WHERE ended_at IS NULL) open_attempts,
    (SELECT count(*)::int FROM nodia_ai_runtime_slots WHERE state IN ('held','unknown')) held_or_unknown_slots`))[0];
  check('configured runtime is quiet before synthetic provider work', Object.values(quiet).every((value) => value === 0));
  const rows = await db.query(`SELECT p.id::text,p.fields,p.use_token_plan_web,p.use_token_plan_agentic
    FROM ai_providers p JOIN ai_provider_catalog c ON c.id=p.catalog_id
    WHERE p.is_active AND c.is_active AND c.key='gemini'`);
  assert.equal(rows.length, 1, 'Exactly one configured Gemini connection is required');
  const row = rows[0];
  for (const engine of ['agentic']) {
    const mode = 'token_plan_' + engine, fields = row.fields?.[mode];
    assert.equal(row['use_' + mode], true, 'The requested engine must be configured');
    assert.ok(typeof fields?.selected_model === 'string' && fields.selected_model.trim(), 'An exact persisted model is required');
    const selection = { connection_id: row.id, mode, model_id: fields.selected_model,
      effort_id: fields.thinking_levels?.[fields.selected_model] ?? fields.thinking_level ?? null };
    const probe = { engine, selection, compaction: null, continuity: null, terminal_proofs_acknowledged: 0 };
    report.probes.push(probe); save();
    const observed = await adapter.observe(selection, AbortSignal.timeout(35000));
    check(engine + ': exact current selection is eligible', observed.available && observed.resourceKey !== null);
    if (engine === 'agentic') agenticConfiguration = { selection, observed };
  }
  const { selection, observed } = agenticConfiguration;
  const toolName = 'nodia_ai34_synthetic_read';
  const tools = [{ name: toolName, description: 'Read one synthetic verification value. No business database access or mutations.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {}, required: [] } }];
  const canonicalPrompt = `Verificación sintética explícita: llama exactamente una vez a ${toolName} con {}. Después responde con el valor returned_nonce recibido de la herramienta, literalmente dentro de answer.text. El valor no está en este mensaje. No uses otras herramientas, no crees registros ni solicites escrituras.`;
  const measured = await adapter.measureContext({ selection, canonicalPrompt, tools });
  check('agentic MCP: complete initial prompt plus first listing upper bound fits',
    measured.firstMcpListingUpperBoundUtf8Bytes > 0 &&
    measured.totalUtf8Bytes + measured.firstMcpListingUpperBoundUtf8Bytes <= measured.maxUtf8Bytes);
  const attemptId = randomUUID(), returnedNonce = randomBytes(20).toString('hex');
  const mcp = { scope: 'real_agentic_synthetic_read_callback_not_business_sql', attempt_id: attemptId,
    selection, measurement: measured, started_at_utc: new Date().toISOString(), tool_callback_count: 0,
    protocol_rpc_messages: 0, unforwarded_tool_requests: 0, terminal_proof_acknowledged: false,
    controlled_context_ledger: 'collect_safe_native_terminal_diagnostic_by_attempt_id' };
  report.mcp_probe = mcp;
  pending = { engine: 'agentic', attemptId, resourceKey: observed.resourceKey,
    sessionGeneration: observed.sessionGeneration, operationRef: attemptId };
  assert.ok(report.generation_requests < report.maximum_generations);
  report.generation_requests++; save();
  const reply = await adapter.probeMcp({ attemptId, selection, canonicalPrompt, tools,
    resourceKey: observed.resourceKey, configurationGeneration: observed.configurationGeneration,
    sessionGeneration: observed.sessionGeneration, deadlineAt: new Date(Date.now() + 120000),
    onToolCall: async (call) => {
      assert.equal(call.name, toolName); assert.deepEqual(call.arguments, {});
      assert.equal(mcp.tool_callback_count, 0, 'The synthetic read callback must never be duplicated');
      mcp.tool_callback_count++; save();
      return { schema_version: 1, source: 'explicit_synthetic_fixture', returned_nonce: returnedNonce };
    },
    onProtocolProgress: async (rpcMessages, _signal, unforwarded = 0) => {
      assert.ok(Number.isInteger(rpcMessages) && rpcMessages >= mcp.protocol_rpc_messages && rpcMessages <= 64);
      assert.equal(unforwarded, 0, 'The canary must not request unexposed tools');
      mcp.protocol_rpc_messages = rpcMessages; mcp.unforwarded_tool_requests = unforwarded; save();
    },
  }, AbortSignal.timeout(125000));
  await reconciliation.acknowledge(reply.terminalProof, AbortSignal.timeout(15000));
  pending = undefined; mcp.terminal_proof_acknowledged = true; mcp.finished_at_utc = new Date().toISOString(); save();
  check('agentic MCP: one real callback supplied a value absent from the prompt and proof was acknowledged',
    reply.kind === 'answer' && reply.text === returnedNonce && mcp.tool_callback_count === 1 && mcp.protocol_rpc_messages > 0);
  mcp.returned_nonce_sha256 = hash(returnedNonce);
  check('one independent explicit generation completed without inference retries or business SQL effects', report.generation_requests === 1);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.failure_category = typeof error?.code === 'string' && /^[a-z_]+$/.test(error.code) ? error.code :
    error instanceof assert.AssertionError ? 'acceptance_assertion_failed' : 'canary_failed';
  if (pending && reconciliation) {
    try {
      const proof = await reconciliation.reconcile(pending, AbortSignal.timeout(20000));
      await reconciliation.acknowledge(proof, AbortSignal.timeout(15000));
      report.uncertain_attempt_reconciliation = { outcome: proof.outcome, process_closed: proof.processClosed, acknowledged: true };
      pending = undefined;
    } catch { report.uncertain_attempt_reconciliation = { outcome: 'pending', acknowledged: false, request: pending }; }
  }
  process.exitCode = 1;
} finally {
  report.finished_at_utc = new Date().toISOString(); save();
  await db.destroy();
  console.log(JSON.stringify({ stage: report.stage, status: report.status, generation_requests: report.generation_requests,
    checks: report.checks.length, failure_category: report.failure_category ?? null, unresolved_attempt: Boolean(pending) }));
}
