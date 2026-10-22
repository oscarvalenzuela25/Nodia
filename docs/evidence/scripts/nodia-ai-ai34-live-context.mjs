// Explicit synthetic real-Gemini canary. Read-only configured SQL, five generations maximum.
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
const report = { stage: 'AI-34', scope: 'real_gemini_compaction_and_snapshot_rehydration_synthetic_canary', status: 'running',
  observed_at_utc: new Date().toISOString(), maximum_generations: 5, generation_requests: 0,
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
  for (const engine of ['web', 'agentic']) {
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
    const nonce = randomBytes(12).toString('hex');
    const facts = {
      facts: `Presupuesto sintético ${nonce}: 23450 CLP para la fecha 2027-02-19.`,
      decisions: `Decisión sintética ${nonce}: solicitar confirmación antes de cualquier gasto.`,
      questions: `Duda pendiente ${nonce}: falta elegir la categoría de gasto.`,
      entities: `Entidad ficticia ${nonce}: Casa Bruma.`,
      requirements: `Requisito sintético ${nonce}: conservar fecha, monto y duda sin crear registros.`,
    };
    // Each canonical message remains below Nodia's 32 KiB admission ceiling.
    // Repetitive synthetic prose makes the five-message prefix genuinely long.
    const history = Object.entries(facts).map(([_category, text], index) => ({ seq: String(index + 1), role: 'user',
      scope: { schema_version: 1, module_routes: [] }, parts: [{ kind: 'text',
        text: text + '\n' + 'Texto sintético de relleno para comprobar contexto largo. '.repeat(500) }] }));
    check(engine + ': each synthetic original respects the current human-message byte ceiling', history.every((item) =>
      Buffer.byteLength(item.parts[0].text, 'utf8') <= policy.admission.message_text_utf8_bytes));
    const sourceHash = hash(JSON.stringify(history));
    const input = { history, moduleRoutes: ['/tools/nodia-ai'], throughSeq: '5', sourceHash };
    const prepared = compaction.execute(input);
    const measured = await adapter.measureContext({ selection, canonicalPrompt: prepared.prompt });
    check(engine + ': long extraction request fits the measured complete native prompt',
      prepared.sourceBytes >= policy.results.assembled_context_utf8_bytes / 2 &&
      measured.totalUtf8Bytes + measured.firstMcpListingUpperBoundUtf8Bytes <= measured.maxUtf8Bytes);
    async function generate(prompt) {
      assert.ok(report.generation_requests < report.maximum_generations, 'The real generation budget is exhausted');
      const attemptId = randomUUID();
      pending = { engine, attemptId, resourceKey: observed.resourceKey, sessionGeneration: observed.sessionGeneration, operationRef: attemptId };
      report.generation_requests++; save();
      const reply = await adapter.execute({ attemptId, selection, canonicalPrompt: prompt,
        resourceKey: observed.resourceKey, configurationGeneration: observed.configurationGeneration,
        sessionGeneration: observed.sessionGeneration, deadlineAt: new Date(Date.now() + 120000) }, AbortSignal.timeout(125000));
      // Ack even when the following semantic/JSON acceptance rejects this answer.
      await reconciliation.acknowledge(reply.terminalProof, AbortSignal.timeout(15000));
      pending = undefined; probe.terminal_proofs_acknowledged++; save();
      return reply;
    }
    const extracted = await generate(prepared.prompt);
    assert.equal(extracted.kind, 'answer');
    const summary = compaction.parse({ ...input, text: extracted.text });
    for (const [category, text] of Object.entries(facts))
      check(engine + ': extraction preserves synthetic ' + category + ' with its exact citation',
        summary[category].some((item) => item.text === text && item.source_seqs.includes(String(Object.keys(facts).indexOf(category) + 1))));
    const summaryBytes = Buffer.byteLength(JSON.stringify(summary), 'utf8');
    check(engine + ': extraction reduces bytes while preserving the checked facts', summaryBytes < prepared.sourceBytes);
    probe.compaction = { source_hash: sourceHash, canonical_utf8_bytes: prepared.sourceBytes,
      measurement: measured, summary_utf8_bytes: summaryBytes, summary_sha256: hash(JSON.stringify(summary)),
      checked_categories: Object.keys(facts), semantic_quality_scope: 'five_synthetic_cited_requirements_not_a_universal_losslessness_proof' }; save();
    const snapshot = { id: randomUUID(), revision: 1, throughSeq: '5', sourceHash, summary,
      scopeManifest: { schema_version: 1, module_routes: ['/tools/nodia-ai'] }, builderContractVersion: builderVersion };
    const ready = context.execute({ moduleRoutes: ['/tools/nodia-ai'], throughSeq: '6', mode, snapshot,
      acceptedPreferences: [], recoveryRefs: { schema_version: 1, references: [] }, fragmentIds: [],
      history: [{ seq: '6', role: 'user', scope: { schema_version: 1, module_routes: [] }, parts: [{ kind: 'text',
        text: 'Usando únicamente conversation_memory, devuelve un objeto JSON dentro de answer.text con claves amount_clp, date, pending_question, decision y entity. Usa amount_clp como número entero; conserva literalmente fecha y textos de esas citas. No crees registros ni uses herramientas.' }] }] });
    const continuedMeasurement = await adapter.measureContext({ selection, canonicalPrompt: ready.prompt });
    check(engine + ': rehydrated context uses the snapshot and a small current tail',
      Boolean(ready.manifest.context_snapshot) && continuedMeasurement.totalUtf8Bytes < measured.totalUtf8Bytes &&
      continuedMeasurement.totalUtf8Bytes + continuedMeasurement.firstMcpListingUpperBoundUtf8Bytes <= continuedMeasurement.maxUtf8Bytes);
    const continued = await generate(ready.prompt);
    assert.equal(continued.kind, 'answer');
    const value = JSON.parse(continued.text);
    check(engine + ': continuation retrieves amount and date only from cited memory', value.amount_clp === 23450 && value.date === '2027-02-19');
    check(engine + ': continuation preserves the pending question, confirmation decision and entity',
      value.pending_question === facts.questions && value.decision === facts.decisions && value.entity === facts.entities);
    probe.continuity = { measurement: continuedMeasurement, context_sha256: ready.manifest.context_sha256,
      raw_history_resent: false, accepted_preference_values_injected: 0, recovery_references: 0,
      amount_and_date_retrieved: true, pending_question_and_decision_retrieved: true, no_tools_exposed: true }; save();
  }
  check('exactly four explicit generations finished and every terminal proof was acknowledged',
    report.generation_requests === 4 && report.probes.every((probe) => probe.terminal_proofs_acknowledged === 2));
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
  check('five explicit generations complete without automatic retries or business SQL effects', report.generation_requests === 5);
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
