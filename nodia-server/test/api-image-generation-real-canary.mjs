// Operator-only technical acceptance. Default is inert; real execution requires
// --execute AND the exact stdin gate. Never put a credential in argv/env/files.
// Separate generated-image lane: one POST, no attachments/tools and no model fallback.
// Durable proof plus the actual private attachment use cases/SQL are required before output.
// Storage uses a bounded RAM fixture and local full raster decoder, not operational R2/parser RPC.
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFile, stat, mkdir, writeFile, realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertPublishedCanaryCatalog } from './fixtures/published-canary-catalog.mjs';

const GATE = 'root_approved_api_image_generation_canary_r01';
// Offline 1x1 PNG fixture only; never supplied to a real inference.
const SYNTHETIC_IMAGE_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC';
const hash = value => createHash('sha256').update(value).digest('hex');
const json = value => JSON.stringify(value);
const fail = code => { throw Error('canary:' + code); };
const emptyObject = value => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0;
const safeError = error => {
  const code = typeof error?.code === 'string' ? error.code : error?.message;
  return typeof code === 'string' && /^(?:canary:|nodia_ai:)?[a-z][a-z0-9_]{0,100}$/.test(code)
    ? code : 'operator_or_upstream_error';
};

function validateInput(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).sort().join(',') !== 'gate,model,provider,secret' ||
      value.gate !== GATE || !['openai', 'gemini'].includes(value.provider) ||
      typeof value.secret !== 'string' || !value.secret.trim() || value.secret !== value.secret.trim() ||
      Buffer.byteLength(value.secret) > 16384 || /[\r\n\0]/.test(value.secret) ||
      typeof value.model !== 'string' || !value.model.trim() || value.model !== value.model.trim() ||
      Buffer.byteLength(value.model) > 1024 || !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/.test(value.model)) fail('invalid_stdin_contract');
  return value;
}

function publicCatalogText(value, limit) {
  if (typeof value !== 'string') return null;
  let result = '', bytes = 0;
  for (const point of value) {
    const char = point.codePointAt(0) < 32 || point.codePointAt(0) === 127 ? ' ' : point;
    const next = Buffer.byteLength(char);
    if (bytes + next > limit) break;
    result += char; bytes += next;
  }
  return result;
}

// The guard surrounds global fetch, including discovery and every transport round.
// Rejected requests are never forwarded. There is no hidden HTTP/retry allowance.
function providerGuard(provider, model, send, counts, allowed) {
  return async (input, init = {}) => {
    if (typeof input !== 'string' && !(input instanceof URL)) fail('request_object_forbidden');
    const url = new URL(input), method = (init.method ?? 'GET').toUpperCase();
    if (url.username || url.password || url.hash || init.redirect !== 'error') fail('unsafe_http_envelope');
    const origin = provider === 'openai' ? 'https://api.openai.com' : 'https://generativelanguage.googleapis.com';
    if (url.origin !== origin) fail('unexpected_network_origin');
    if (method === 'GET') {
      const validPath = provider === 'openai' ? url.pathname === '/v1/models' && !url.search :
        url.pathname === '/v1beta/models' && [...url.searchParams.keys()].every(key => ['pageSize', 'pageToken'].includes(key));
      if (!allowed.discovery || !validPath || counts.gets >= (provider === 'openai' ? 1 : 20)) fail('discovery_budget_or_route');
      counts.gets++;
    } else if (method === 'POST') {
      const path = provider === 'openai' ? '/v1/images/generations' :
        '/v1beta/models/' + encodeURIComponent(model.replace(/^models\//, '')) + ':generateContent';
      if (!allowed.inference || url.pathname !== path || url.search || counts.posts >= 1 || typeof init.body !== 'string') fail('post_budget_or_route');
      const body = JSON.parse(init.body);
      if (provider === 'openai' && body.model !== model) fail('post_selected_model_changed');
      counts.posts++;
    } else fail('http_method_forbidden');
    try {
      const response = await send(input, init);
      if (!Number.isInteger(response.status) || response.status < 100 || response.status > 599) fail('invalid_http_status');
      (counts.http_statuses ??= []).push({ kind: method === 'GET' ? 'discovery' : 'inference', status: response.status });
      // Do not clone, read or retain the upstream body, URL, headers or statusText.
      return response;
    } catch (error) {
      counts.network_failures = (counts.network_failures ?? 0) + 1;
      throw error;
    }
  };
}

function captureTerminal(report, descriptor, point, parse) {
  const proof = parse(descriptor);
  if (descriptor.schema_version !== 3 || proof.engine !== 'api_key' || proof.localTransportClosed !== true || proof.processClosed !== undefined)
    fail('invalid_api_terminal_witness');
  const observed = { point, schema_version: descriptor.schema_version, descriptor_sha256: hash(json(descriptor)),
    local_transport_closed: true, remote_outcome: proof.remoteOutcome, outcome: proof.outcome,
    observed_at: proof.observedAt.toISOString(), proof_id_sha256: hash(proof.terminalProofId) };
  (report.terminal_observations ??= []).push(observed);
  report.terminal_closed = true;
  report.terminal_proof_sha256 = observed.descriptor_sha256;
  report.terminal_schema_version = 3;
  report.remote_outcome = proof.remoteOutcome; report.terminal_outcome = proof.outcome;
  return observed;
}

async function contractSelfTest() {
  assert.ok(emptyObject({})); assert.ok(emptyObject(Object.create(null)));
  assert.ok(!emptyObject([])); assert.ok(!emptyObject({ extra: true })); assert.ok(!emptyObject(null));
  const dummy = { provider: 'openai', secret: 'synthetic-only', model: 'fixture-only-model', gate: GATE };
  validateInput(dummy);
  for (const value of [{ ...dummy, gate: 'wrong' }, { ...dummy, extra: 1 }, { ...dummy, secret: 'bad\nvalue' }, { ...dummy, model: '' }])
    assert.throws(() => validateInput(value));
  for (const provider of ['openai', 'gemini']) {
    const counts = { gets: 0, posts: 0 }, allowed = { discovery: true, inference: true };
    let forwarded = 0;
    const guarded = providerGuard(provider, dummy.model, async () => { forwarded++; return new Response('{}'); }, counts, allowed);
    const origin = provider === 'openai' ? 'https://api.openai.com' : 'https://generativelanguage.googleapis.com';
    const models = origin + (provider === 'openai' ? '/v1/models' : '/v1beta/models?pageSize=1000');
    const url = origin + (provider === 'openai' ? '/v1/images/generations' : '/v1beta/models/' + dummy.model + ':generateContent');
    await guarded(models, { redirect: 'error' });
    const init = { method: 'POST', redirect: 'error', body: json({ model: dummy.model }) };
    await guarded(url, init);
    await assert.rejects(guarded(url, init));
    await assert.rejects(guarded('https://example.invalid', init));
    await assert.rejects(guarded(url, { ...init, redirect: 'follow' }));
    assert.equal(forwarded, 2); assert.equal(counts.posts, 1);
    assert.deepEqual(counts.http_statuses, [{ kind: 'discovery', status: 200 }, { kind: 'inference', status: 200 }]);
    const rejectionCounts = { gets: 0, posts: 0 };
    const rejected = providerGuard(provider, dummy.model, async () => new Response('private-upstream-body-never-read', { status: 429 }), rejectionCounts, allowed);
    const response = await rejected(url, init);
    assert.equal(response.bodyUsed, false);
    assert.deepEqual(rejectionCounts.http_statuses, [{ kind: 'inference', status: 429 }]);
    assert.ok(!json(rejectionCounts).includes('private-upstream-body'));
  }
  const { terminalRuntimeProofDescriptor, readTerminalProof } = await import('../dist/nodia-ai-runtime/use-case/runtime-reconciliation-descriptor.js');
  const attemptId = randomUUID();
  const proof = { engine: 'api_key', attemptId, operationRef: attemptId,
    adapterIdentity: { providerKey: 'gemini', connectionId: '1', contractVersion: 'nodia-ai-api-chat/1' },
    resourceKey: 'api-connection:' + 'a'.repeat(64), sessionGeneration: 'b'.repeat(32),
    terminalProofId: randomUUID(), localTransportClosed: true, remoteOutcome: 'unknown', outcome: 'abandoned_unknown', observedAt: new Date() };
  const descriptor = terminalRuntimeProofDescriptor(proof), receipt = { terminal_closed: false };
  const row = { terminal_proof: descriptor };
  captureTerminal(receipt, row.terminal_proof, 'before_common_reconcile', readTerminalProof);
  delete row.terminal_proof; // ACK's cascade may remove the original dispatch row.
  assert.equal(receipt.terminal_closed, true); assert.equal(receipt.remote_outcome, 'unknown');
  assert.equal(receipt.terminal_observations[0].descriptor_sha256, hash(json(descriptor)));
  assert.throws(() => captureTerminal({}, { ...descriptor, terminal_proof: { ...descriptor.terminal_proof, local_transport_closed: false } }, 'forged', readTerminalProof));
  return { success: true, mode: 'pure_contract_self_test', real_network_requests: 0, database_created: false,
    checks: ['exact_input_gate', 'empty_closed_arguments_including_null_prototype', 'one_post_maximum_both_providers', 'origin_model_route_redirect_guards',
      'http_status_only_no_upstream_body_read', 'schema3_terminal_snapshot_survives_ack_cascade', 'forged_local_closure_rejected'] };
}

async function stdinInput() {
  const parts = []; let bytes = 0;
  for await (const part of process.stdin) {
    bytes += part.length;
    if (bytes > 65536) fail('stdin_too_large');
    parts.push(part);
  }
  const buffer = Buffer.concat(parts);
  try { return validateInput(JSON.parse(buffer.toString('utf8'))); }
  finally { buffer.fill(0); for (const part of parts) part.fill(0); }
}

async function execute(outputPath, rehearsalProvider) {
  const report = { schema_version: 1, success: false, mode: 'real_api_image_generation_canary', case: 'image-generation', scope: 'disposable_configuration_only',
    proves: [], requested_checks: ['selected_model_live_discovery', 'one_generated_inline_image', 'image_generation_qualification', 'durable_api_terminal_and_ack', 'private_sql_attachment_store_and_authorized_readback'],
    does_not_prove: ['operational_connection_qualification', 'all_business_operations', 'business_tool_gateway_permissions', 'human_confirmation_ui', 'operational_R2_and_isolated_parser_RPC', 'calendar_retention_and_physical_cleanup', 'natural_chat_worker_and_browser', 'semantic_prompt_compliance_without_human_visual_review'],
    real_key_persisted: false, operational_database_accessed: false, key_transport: 'ssh_stdin_memory_only', automatic_retries: 0,
    post_limit: 1, provider_posts: 0, discovery_gets: 0, callback_calls: 0, replayed_requests: 0,
    terminal_closed: false, ack: false, state_clean: false, owned_fixture_cleanup: false };
  const originalFetch = globalThis.fetch;
  const consoleMethods = new Map(['log', 'info', 'warn', 'error', 'debug'].map(name => [name, console[name]]));
  let input, secret, fixture, compiled, claim, reservation, request, apiRuntime, commonRuntime, checkpoint,
    release, recover, cleanup, reconcile, policy, authorize, stopHeartbeat, leaseError, snapshotDispatch;
  const privateObjects = new Map(), objectCounts = { put: 0, get: 0, delete: 0 };
  let stage = 'stdin', heartbeatPending = Promise.resolve(), heartbeatTimer, heartbeatStopped = false;
  const controller = new AbortController();
  const cancel = () => controller.abort(Error('canary:operator_cancelled'));
  process.once('SIGINT', cancel); process.once('SIGTERM', cancel);
  const counts = { gets: 0, posts: 0 }, allowed = { discovery: false, inference: false };
  const checks = [];
  const check = (name, condition) => { assert.ok(condition, name); checks.push(name); };
  try {
    input = rehearsalProvider ? validateInput({ provider: rehearsalProvider, secret: 'synthetic-only-never-sent', model: 'synthetic-media-model', gate: GATE }) : await stdinInput();
    secret = input.secret; delete input.secret;
    report.provider = input.provider; report.model = input.model;
    stage = 'output_path_preflight';
    const outputRoot = resolve(process.cwd(), 'public-generated-fixtures'), outputDirectory = resolve(outputPath);
    const expectedDirectory = resolve(outputRoot, rehearsalProvider ? 'image-rehearsal-r01' : 'image-r01');
    if (outputDirectory !== expectedDirectory) fail('invalid_output_directory');
    try { await stat(outputDirectory); fail('output_directory_already_exists'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    report.storage_scope = 'disposable_SQL_and_RAM_object_storage_local_raster_decoder_only';
    report.semantic_prompt_compliance = null;
    report.fixture_provided_as_model_input = false;
    const send = rehearsalProvider ? async (_url, init = {}) => {
      if ((init.method ?? 'GET') === 'GET') return new Response(json(input.provider === 'openai' ? { data: [{ id: input.model }] } :
        { models: [{ name: 'models/' + input.model, displayName: 'Synthetic media model', supportedGenerationMethods: ['generateContent'] }] }));
      const body = JSON.parse(init.body), prompt = input.provider === 'openai' ? body.prompt : body.contents[0].parts[0].text;
      if (!prompt.includes('Verification nonce:')) fail('synthetic_prompt_nonce_missing');
      return new Response(json(input.provider === 'openai' ? { data: [{ b64_json: SYNTHETIC_IMAGE_PNG }] } :
        { candidates: [{ content: { role: 'model', parts: [{ text: 'Synthetic image only' }, { inlineData: { mimeType: 'image/png', data: SYNTHETIC_IMAGE_PNG } }] }, finishReason: 'STOP' }] }));
    } : originalFetch;
    globalThis.fetch = providerGuard(input.provider, input.model, send, counts, allowed);
    if (rehearsalProvider) { report.mode = 'synthetic_provider_sql_rehearsal'; report.real_provider_inference_success = false; }
    // Imported services may log diagnostics. This operator emits only its explicit
    // allowlisted receipt; neither console messages nor upstream exceptions escape.
    for (const name of consoleMethods.keys()) console[name] = () => {};
    // Isolation is configured before importing any production module. This fresh
    // master encrypts ONLY the dummy fixture record, never the real stdin secret.
    process.env.AI_SECRET_MASTER_KEY = randomBytes(32).toString('hex');
    const { createNodiaAiIntegrationFixture, loadAi } = await import('./nodia-ai.integration.fixture.mjs');
    const load = (path, name) => loadAi(path, name);
    stage = 'isolated_postgresql_32_migrations';
    fixture = await createNodiaAiIntegrationFixture('ai9302');
    const { db, identities, options } = fixture;
    const migrationCount = Number((await db.query('SELECT count(*)::int n FROM migrations'))[0].n);
    report.migrations = migrationCount;
    check('fresh_postgresql_all_32_migrations', migrationCount === 32);
    stage = 'production_dependency_graph';
    const { Test } = await import('@nestjs/testing');
    const { TypeOrmModule } = await import('@nestjs/typeorm');
    const { Logger } = await import('@nestjs/common');
    Logger.overrideLogger(false);
    const entries = [
      ['nodia-ai-tools/nodia-ai-tools.module', 'NodiaAiToolsModule'],
      ['nodia-ai-conversation/nodia-ai-conversation.module', 'NodiaAiConversationModule'],
      ['nodia-ai-context/nodia-ai-processing.module', 'NodiaAiProcessingModule'],
      ['nodia-ai-runtime/nodia-ai-runtime.module', 'NodiaAiRuntimeModule'],
      ['nodia-ai-confirmation/nodia-ai-confirmation.module', 'NodiaAiConfirmationModule'],
      ['nodia-ai-execution/nodia-ai-execution.module', 'NodiaAiExecutionModule'],
      ['common/redis/redis.service', 'RedisService'],
    ];
    const modules = await Promise.all(entries.map(([path, name]) => load(path, name)));
    const redis = modules.pop();
    const builder = Test.createTestingModule({ imports: [TypeOrmModule.forRootAsync({ useFactory: () => options, dataSourceFactory: async () => db }), ...modules] });
    builder.overrideProvider(redis).useValue({ get: async () => null, set: async () => {}, del: async () => {}, keys: async () => [] });
    const Storage = await load('nodia-ai-attachment/types/attachment-ports', 'NodiaAiAttachmentStorage');
    const Inspector = await load('nodia-ai-attachment/types/attachment-ports', 'NodiaAiAttachmentInspector');
    builder.overrideProvider(Storage).useValue({
      put: async (key, path, mime, signal) => { signal.throwIfAborted(); const bytes = await readFile(path); if (privateObjects.has(key) || bytes.length > 16777216 || !['image/png', 'image/jpeg', 'image/webp'].includes(mime)) fail('memory_put_invalid'); privateObjects.set(key, Buffer.from(bytes)); objectCounts.put++; },
      get: async (key, maxBytes, signal) => { signal.throwIfAborted(); const bytes = privateObjects.get(key); if (!bytes || bytes.length > maxBytes) fail('memory_get_invalid'); objectCounts.get++; return Buffer.from(bytes); },
      delete: async key => { privateObjects.delete(key); objectCounts.delete++; },
    });
    builder.overrideProvider(Inspector).useValue({ inspect: async ({ path, kind, byteCount, signal }) => {
      signal?.throwIfAborted(); if (kind !== 'image' || byteCount < 1 || byteCount > 16777216) fail('local_image_inspection_invalid');
      const bytes = await readFile(path), { imageSize } = await import('image-size'), size = imageSize(bytes);
      const mime = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' }[size.type];
      if (!mime || bytes.length !== byteCount || !size.width || !size.height || size.width * size.height > policy.admission.image_pixels) fail('local_image_inspection_invalid');
      const { loadImage } = await import('@napi-rs/canvas'), decoded = await loadImage(bytes);
      if (decoded.width !== size.width || decoded.height !== size.height) fail('local_image_raster_mismatch');
      report.decoded_image = { width: decoded.width, height: decoded.height, media_type: mime, bytes: bytes.length, sha256: hash(bytes) };
      return { mediaType: mime, pageCount: null, durationSeconds: null, extractedText: null };
    } });
    compiled = await builder.compile();
    const get = async (path, name) => compiled.get(await load(path, name));
    policy = compiled.get(await load('nodia-ai-runtime/config/runtime-policy', 'NODIA_AI_RUNTIME_POLICY'));
    const knowledge = await get('nodia-ai-context/use-case/load-nodia-ai-knowledge.use-case', 'LoadNodiaAiKnowledgeUseCase');
    const registry = await get('nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case', 'NodiaAiToolRegistryUseCase');
    report.published_contracts = assertPublishedCanaryCatalog(registry.publishedContracts(), knowledge.manifest.capability_contracts);
    check('actual_compiled_contract_registry_matches_pinned_knowledge_with_sales', true);
    report.knowledge_release = knowledge.manifest.release_id;
    report.catalog_release = knowledge.manifest.catalog_release;
    report.operator_sha256 = hash(await readFile(fileURLToPath(import.meta.url)));
    const { ApiProviderService } = await import('../dist/common/ai/api-provider.service.js');
    allowed.discovery = true;
    stage = 'live_model_discovery_before_post';
    const discovered = await new ApiProviderService().listModels(input.provider, secret, AbortSignal.timeout(30000));
    allowed.discovery = false;
    check('selected_model_exactly_in_live_discovery', Array.isArray(discovered) && discovered.some(item => item.id === input.model));
    report.discovered_models = discovered.length;
    report.selected_model_discovered = true;
    report.model_catalog = discovered.slice(0, 1000).map(item => ({ id: publicCatalogText(item.id, 1024), name: publicCatalogText(item.name, 256),
      description: publicCatalogText(item.description, 512), contextWindow: Number.isSafeInteger(item.contextWindow) && item.contextWindow >= 0 ? item.contextWindow : null }));
    report.model_catalog_truncated = discovered.length > 1000;
    report.model_catalog_source = 'existing_live_listModels_result_public_fields_only_no_capabilities_inferred';
    const [catalog] = await db.query('SELECT id::text FROM ai_provider_catalog WHERE key=$1', [input.provider]);
    check('disposable_provider_catalog_entry_exists', !!catalog);
    await db.query('UPDATE ai_provider_catalog SET can_use_api_key=true,is_active=true WHERE id=$1', [catalog.id]);
    const [provider] = await db.query(`INSERT INTO ai_providers(catalog_id,name,use_api_key,use_agentic,default_mode,fields)
      VALUES($1,'Disposable technical API canary',true,false,'api_key',$2::jsonb) RETURNING id::text`,
    [catalog.id, json({ api_key: { selected_model: input.model, available_models: [{ id: input.model }] } })]);
    const { encryptSecret, generateFingerprint } = await import('../dist/ai-provider/helpers/ai-key-crypto.helper.js');
    const dummy = 'synthetic-canary-key-never-sent';
    await db.query(`INSERT INTO ai_api_keys(provider_id,label,secret_ciphertext,secret_fingerprint,display_hint,is_selected,is_active)
      VALUES($1,'Disposable dummy key',$2,$3,'...dummy',true,true)`, [provider.id, encryptSecret(dummy), generateFingerprint(dummy)]);
    const credentials = await get('nodia-ai-adapter/api-nodia-ai-credentials.service', 'ApiNodiaAiCredentialsService');
    const selection = { connection_id: provider.id, mode: 'api_key', model_id: input.model, effort_id: null };
    // Keep the production configuration/epoch checks; replace only the secret port.
    // No fingerprint, encryption operation or SQL parameter ever receives `secret`.
    credentials.secret = async (requested, expected) => {
      const current = await credentials.configuration(requested);
      if (current.configurationGeneration !== expected.configurationGeneration || current.keyId !== expected.keyId) fail('configuration_changed');
      return secret;
    };
    const adapter = await get('nodia-ai-adapter/use-case/api-nodia-ai-adapter.use-case', 'ApiNodiaAiAdapterUseCase');
    apiRuntime = await get('nodia-ai-adapter/api-nodia-ai-runtime.service', 'ApiNodiaAiRuntimeService');
    commonRuntime = await get('nodia-ai-runtime/nodia-ai-runtime.service', 'NodiaAiRuntimeService');
    authorize = await get('nodia-ai/use-case/authorize-nodia-ai.use-case', 'AuthorizeNodiaAiUseCase');
    const Claim = await load('nodia-ai-runtime/use-case/claim-nodia-ai-job.use-case', 'ClaimNodiaAiJobUseCase');
    const Checkpoint = await load('nodia-ai-runtime/use-case/checkpoint-nodia-ai-job.use-case', 'CheckpointNodiaAiJobUseCase');
    const Reserve = await load('nodia-ai-runtime/use-case/reserve-nodia-ai-runtime-slot.use-case', 'ReserveNodiaAiRuntimeSlotUseCase');
    const Release = await load('nodia-ai-runtime/use-case/release-nodia-ai-runtime-slot.use-case', 'ReleaseNodiaAiRuntimeSlotUseCase');
    const Recover = await load('nodia-ai-runtime/use-case/recover-nodia-ai-jobs.use-case', 'RecoverNodiaAiJobsUseCase');
    const Cleanup = await load('nodia-ai-runtime/use-case/cleanup-nodia-ai-runtime-proofs.use-case', 'CleanupNodiaAiRuntimeProofsUseCase');
    const Reconcile = await load('nodia-ai-runtime/use-case/reconcile-nodia-ai-runtime.use-case', 'ReconcileNodiaAiRuntimeUseCase');
    const Progress = await load('nodia-ai-context/use-case/execute-nodia-ai-knowledge-tool.use-case', 'ExecuteNodiaAiKnowledgeToolUseCase');
    const { readTerminalProof, terminalRuntimeProofDescriptor } = await import('../dist/nodia-ai-runtime/use-case/runtime-reconciliation-descriptor.js');
    // Observe the actual durable terminal before common reconciliation/ACK can
    // delete its job/attempt/dispatch row. Missing later rows cannot negate proof.
    snapshotDispatch = async point => {
      if (!claim) return;
      const [row] = await db.query('SELECT state,terminal_proof,request_hash,response_hash,exchange_count FROM nodia_ai_api_dispatches WHERE attempt_id=$1', [claim.attempt.id]);
      if (!row) return;
      report.request_sha256 = row.request_hash; report.response_sha256 = row.response_hash;
      report.durable_exchange_count = row.exchange_count;
      if (row.state === 'closed' && row.terminal_proof) captureTerminal(report, row.terminal_proof, point, readTerminalProof);
    };
    const proofPort = {
      reconcile: async (identity, signal) => {
        const proof = await apiRuntime.reconcile(identity, signal);
        captureTerminal(report, terminalRuntimeProofDescriptor(proof), 'runtime_reconciled_before_common_settle_and_ack', readTerminalProof);
        await snapshotDispatch('durable_runtime_before_common_settle_and_ack');
        return proof;
      },
      acknowledge: async (proof, signal) => {
        const witness = captureTerminal(report, terminalRuntimeProofDescriptor(proof), 'before_actual_runtime_ack', readTerminalProof);
        await snapshotDispatch('durable_before_actual_runtime_ack');
        await apiRuntime.acknowledge(proof, signal);
        report.ack = true; report.acknowledged_terminal_sha256 = witness.descriptor_sha256;
      },
    };
    checkpoint = new Checkpoint(commonRuntime, authorize, policy); release = new Release(checkpoint);
    recover = new Recover(commonRuntime, policy); cleanup = new Cleanup(commonRuntime, proofPort, policy);
    reconcile = new Reconcile(commonRuntime, authorize, proofPort, cleanup, policy);
    const progress = new Progress(knowledge, authorize, policy);
    const identity = identities.get('1');
    const actor = await authorize.execute(identity);
    const moduleRoutes = actor.modules.map(module => module.route);
    await db.query('DELETE FROM user_modules WHERE user_id=2');
    await assert.rejects(authorize.execute(identities.get('2')));
    check('missing_module_denied_before_provider_post', counts.posts === 0);
    const domainCounts = async () => (await db.query('SELECT (SELECT count(*)::int FROM products) products,(SELECT count(*)::int FROM invoices) invoices,(SELECT count(*)::int FROM finance_movements) finance_movements'))[0];
    report.domain_counts_before = await domainCounts();
    check('synthetic_actor_has_only_nodia_ai_module', moduleRoutes.length === 1 && moduleRoutes[0] === '/nodia-ai');
    const before = await adapter.observe(selection);
    check('no_unproved_media_or_mcp_advertised_before_test', before.supportsMcp === false && before.supportsTools === true && before.verifiedAttachmentMediaTypes.length === 0 && !before.supportsImageGeneration);
    const config = await credentials.configuration(selection);
    const conversation = randomUUID(), message = randomUUID(), run = randomUUID(), job = randomUUID();
    const publicNonce = randomBytes(18).toString('hex');
    const prompt = `Create one simple square image: a solid blue circle centered on a plain white background. No text, no logos, no border. This is a synthetic technical rendering test. Verification nonce: ${publicNonce}. Do not draw the nonce. No tools, external assets or business operations are authorized.`;
    report.prompt_semantic_target = 'one_solid_blue_circle_on_white_square_no_text';
    const manifest = { session_generation: config.sessionGeneration, configuration_generation: config.configurationGeneration,
      adapter_identity: { provider_key: input.provider, contract_version: 'nodia-ai-api-chat/1', connection_id: provider.id } };
    const budget = { schema_version: 1, tool_calls: policy.budget.tool_calls_per_run, mcp_rpc_messages: policy.budget.mcp_rpc_messages_per_run,
      provider_dispatches: policy.budget.provider_dispatches_per_run, compactions: policy.budget.compactions_per_run, delegations: policy.budget.delegations_per_run };
    stage = 'common_queue_grant_claim_and_arm';
    await db.transaction(async manager => {
      await manager.query("INSERT INTO nodia_ai_conversations(id,owner_id,client_request_id,title,creation_request_hash,expires_at,next_message_seq) VALUES($1,1,$2,'Disposable API technical canary',$3,now()+interval '1 day',1)", [conversation, randomUUID(), hash(prompt)]);
      await manager.query("INSERT INTO nodia_ai_messages(id,conversation_id,seq,role,author_id,client_message_id,status,source_scope_manifest,sealed_at,input_hash) VALUES($1,$2,1,'user',1,$3,'sealed','{}',now(),$4)", [message, conversation, randomUUID(), hash(prompt)]);
      await manager.query("INSERT INTO nodia_ai_message_parts(message_id,conversation_id,part_index,kind,text) VALUES($1,$2,0,'text',$3)", [message, conversation, prompt]);
      await manager.query(`INSERT INTO nodia_ai_runs(id,conversation_id,actor_id,user_message_id,selection_snapshot,catalog_version,policy_version,policy_hash,routing_snapshot,budget_snapshot,input_through_seq,state,phase,deadline_at,retention_epoch,context_manifest)
        VALUES($1,$2,1,$3,$4::jsonb,$5,$6,$7,'{"schema_version":1,"enabled":false,"revision":1,"target":null}',$8::jsonb,1,'queued','context',now()+interval '10 minutes',1,$9::jsonb)`,
      [run, conversation, message, json(selection), knowledge.manifest.catalog_release, policy.policyVersion, policy.policyHash, json(budget), json(manifest)]);
      await manager.query(`INSERT INTO nodia_ai_execution_grants(id,actor_id,session_public_id,run_id,allowed_modules,allowed_operations,allowed_scope,policy_version,expires_at)
        VALUES($1,1,$2,$3,$4::jsonb,'["chat:respond"]','{}',$5,now()+interval '10 minutes')`, [randomUUID(), identity.sessionId, run, json(moduleRoutes), policy.policyVersion]);
      await manager.query("INSERT INTO nodia_ai_jobs(id,kind,dedup_key,conversation_id,run_id,state,available_at,deadline_at,stage_key) VALUES($1,'turn',$2,$3,$4,'ready',now(),now()+interval '10 minutes','context')", [job, 'turn:' + run, conversation, run]);
      await manager.query('UPDATE nodia_ai_conversations SET active_job_id=$2 WHERE id=$1', [conversation, job]);
    });
    claim = await new Claim(commonRuntime, authorize, policy).execute(randomUUID(), [knowledge.manifest.catalog_release]);
    check('common_claim_matches_own_job', claim?.job.id === job);
    reservation = { ...await new Reserve(checkpoint, policy).execute(claim, config.resourceKey, claim.attempt.id),
      adapterIdentity: { providerKey: input.provider, contractVersion: 'nodia-ai-api-chat/1', connectionId: provider.id }, sessionGeneration: config.sessionGeneration };
    await checkpoint.armDispatch(claim, selection, reservation, manager => adapter.verifyConfiguration(selection, config.configurationGeneration, manager));
    const context = { checkpoint: work => checkpoint.execute(claim, work) };
    const stop = async () => { heartbeatStopped = true; clearInterval(heartbeatTimer); await heartbeatPending; };
    stopHeartbeat = stop;
    const tick = () => {
      heartbeatPending = heartbeatPending.then(async () => {
        if (heartbeatStopped || leaseError) return;
        try { await checkpoint.heartbeat(claim); report.heartbeats = (report.heartbeats ?? 0) + 1; }
        catch (error) { leaseError = error; controller.abort(); }
      });
    };
    heartbeatTimer = setInterval(tick, policy.timing.heartbeat_seconds * 1000);
    request = {
      attemptId: claim.attempt.id, selection, canonicalPrompt: prompt,
      deadlineAt: new Date(Math.min(Date.now() + policy.timing.provider_dispatch_seconds * 1000, claim.job.deadline_at.getTime(), claim.run.deadline_at.getTime())),
      resourceKey: config.resourceKey, sessionGeneration: config.sessionGeneration, configurationGeneration: config.configurationGeneration,
      imageGeneration: { prompt },
      tools: [],
      onLeaseCheck: async signal => {
        signal.throwIfAborted(); if (leaseError) throw leaseError;
        await checkpoint.execute(claim, async manager => {
          await adapter.verifyConfiguration(selection, config.configurationGeneration, manager);
          const slots = await manager.query("SELECT resource_key FROM nodia_ai_runtime_slots WHERE resource_key=$1 AND state='held' AND job_id=$2 AND holder_worker_id=$3 AND fence=$4 AND external_operation_ref=$5 AND lease_until>clock_timestamp()", [reservation.resourceKey, job, claim.attempt.worker_id, reservation.fence, reservation.operationRef]);
          if (slots.length !== 1) fail('runtime_slot_not_owned');
        });
      },
      onProtocolProgress: (total, signal, hidden = 0) => { signal.throwIfAborted(); return progress.progress(claim, context, total, hidden); },
      onToolCall: async () => { report.callback_calls++; fail('no_tool_authorized'); },
    };
    report.request_prompt_sha256 = hash(prompt);
    report.public_nonce_sha256 = hash(publicNonce);
    allowed.inference = true;
    stage = 'one_image_generation_one_post_qualification';
    const qualified = await adapter.qualifyMedia(request, { nonce: publicNonce, expectedText: [], imageGeneration: true }, controller.signal);
    const { reply, acceptance } = qualified;
    allowed.inference = false;
    report.reply_sha256 = reply.kind === 'answer' ? hash(reply.text) : null;
    report.generated_image_present = reply.kind === 'answer' && !!reply.generatedImage;
    check('exactly_one_post_and_no_callbacks', report.callback_calls === 0 && counts.posts === 1);
    const proof = reply.terminalProof;
    report.terminal_closed = proof.engine === 'api_key' && proof.localTransportClosed === true && proof.remoteOutcome === 'completed' && proof.outcome === 'completed' && proof.processClosed === undefined;
    report.terminal_proof_sha256 = hash(json(proof));
    report.remote_outcome = proof.remoteOutcome; report.terminal_outcome = proof.outcome;
    report.terminal_schema_version = terminalRuntimeProofDescriptor(proof).schema_version;
    captureTerminal(report, terminalRuntimeProofDescriptor(proof), 'adapter_reply_before_common_checkpoint_and_ack', readTerminalProof);
    await snapshotDispatch('durable_success_before_common_checkpoint_and_ack');
    check('real_reply_closed_schema3_proof_and_hidden_oracles', report.terminal_closed && report.terminal_schema_version === 3 && report.generated_image_present);
    const after = await adapter.observe(selection);
    report.qualified_input_media_types = after.verifiedAttachmentMediaTypes;
    report.supports_tools = after.supportsTools === true; report.supports_mcp = after.supportsMcp;
    check('only_image_generation_qualified_no_input_media_or_mcp', acceptance.verifiedMediaTypes.length === 0 && acceptance.imageGeneration &&
      after.verifiedAttachmentMediaTypes.length === 0 && after.supportsImageGeneration && report.supports_tools && report.supports_mcp === false);
    const acceptanceRows = await db.query('SELECT verified_media_types,image_generation,evidence FROM nodia_ai_api_acceptances');
    check('single_durable_acceptance_matches_request_response_and_output', acceptanceRows.length === 1 && acceptanceRows[0].evidence.image_generation?.request_hash === report.request_sha256 &&
      acceptanceRows[0].evidence.image_generation?.response_hash === report.response_sha256 && acceptanceRows[0].evidence.image_generation?.generated_image_sha256 === reply.generatedImage.sha256);
    report.acceptance_evidence_sha256 = hash(json(acceptanceRows[0].evidence));
    stage = 'real_private_attachment_use_cases_with_ram_storage';
    const generatedStore = await get('nodia-ai-attachment/use-case/store-nodia-ai-generated-image.use-case', 'StoreNodiaAiGeneratedImageUseCase');
    const manage = await get('nodia-ai-attachment/use-case/manage-nodia-ai-attachment.use-case', 'ManageNodiaAiAttachmentUseCase');
    const stored = await generatedStore.execute(identity, conversation, run, reply.generatedImage);
    check('real_private_generated_attachment_ready_unreviewed', stored.state === 'ready' && stored.conversation_id === conversation && stored.kind === 'image' && stored.interpretation === null);
    const content = await manage.content(identity, stored.attachment_id);
    check('real_private_sql_content_hash_readback_matches_generated_output', hash(content.buffer) === reply.generatedImage.sha256 && content.media_type === reply.generatedImage.mediaType);
    await db.query("INSERT INTO user_modules(user_id,module_id) SELECT 2,id FROM modules WHERE key='nodia_ai'");
    const getsBefore = objectCounts.get;
    await assert.rejects(manage.content(identities.get('2'), stored.attachment_id));
    check('non_owner_with_module_cannot_read_or_touch_object_storage', objectCounts.get === getsBefore);
    const reloaded = await manage.get(identity, stored.attachment_id);
    check('reload_reads_same_private_ready_metadata', reloaded.state === 'ready' && reloaded.byte_count === content.buffer.length && reloaded.attachment_id === stored.attachment_id);
    report.private_attachment_id = stored.attachment_id; report.private_attachment_storage_scope = 'real_SQL_authority_and_use_cases_with_RAM_object_port';
    report.storage_operations = objectCounts;
    stage = 'save_synthetic_output_after_durable_proof_and_private_readback';
    await mkdir(outputRoot, { recursive: true, mode: 0o700 });
    if (await realpath(outputRoot) !== outputRoot) fail('output_root_symlink_forbidden');
    await mkdir(outputDirectory, { mode: 0o700 });
    const extension = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[content.media_type];
    const outputFile = resolve(outputDirectory, 'generated-image.' + extension);
    await writeFile(outputFile, content.buffer, { flag: 'wx', mode: 0o600 });
    report.generated_artifact = { path: outputFile, sha256: hash(content.buffer), bytes: content.buffer.length, media_type: content.media_type,
      after_durable_proof_and_private_readback: true, public_synthetic_only: true };
    stage = 'common_terminal_release_and_ack';
    await stop();
    await checkpoint.finish(claim, { status: 'completed', terminalProof: proof, persist: manager => release.execute(claim, reservation, proof, manager) });
    const ack = await cleanup.execute();
    check('common_cleanup_ack_settled_once', ack.processed === 1 && ack.settled === 1);
    report.ack = true;
    const [binding] = await db.query('SELECT request_hash,response_hash,exchange_count FROM nodia_ai_api_dispatches WHERE attempt_id=$1', [claim.attempt.id]);
    report.request_sha256 = binding.request_hash; report.response_sha256 = binding.response_hash;
    report.durable_exchange_count = binding.exchange_count;
    check('durable_exchange_count_matches_guarded_actual_posts', binding.exchange_count === counts.posts);
    report.domain_counts_after = await domainCounts();
    check('no_business_effects', json(report.domain_counts_after) === json(report.domain_counts_before));
    await db.query("UPDATE ai_providers SET updated_at=updated_at+interval '1 second' WHERE id=$1", [provider.id]);
    const changed = await adapter.observe(selection);
    check('configuration_epoch_change_invalidates_image_generation_without_new_post', changed.verifiedAttachmentMediaTypes.length === 0 && changed.supportsImageGeneration === false && counts.posts === 1);
    report.configuration_epoch_invalidation_verified = true;
    report.proves = report.requested_checks;
    report.success = true;
  } catch (error) {
    report.failure_stage = stage; report.error_code = safeError(error);
    // No generation is replayed. Let the actual already-closed executor prove its
    // outcome; only this disposable job's lease is expired for common recovery.
    allowed.inference = false; allowed.discovery = false; controller.abort();
    if (stopHeartbeat) await stopHeartbeat();
    if (claim && fixture && apiRuntime && recover && reconcile) {
      try { await snapshotDispatch?.('error_before_common_recovery_reconcile_and_ack'); }
      catch (snapshotError) { report.terminal_snapshot_error_code = safeError(snapshotError); }
      try {
        await fixture.db.query("UPDATE nodia_ai_jobs SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1 AND state='leased'", [claim.job.id]);
        await recover.execute();
        const admin = fixture.identities.get('3');
        const recovered = await reconcile.execute(admin, claim.job.id);
        report.recovery_resolved = recovered.resolved === true;
        report.ack = recovered.resolved === true && recovered.cleanup_pending === false;
        await snapshotDispatch?.('after_common_settle_if_row_retained');
      } catch (recoveryError) { report.recovery_error_code = safeError(recoveryError); }
    }
  } finally {
    allowed.inference = false; allowed.discovery = false; controller.abort();
    if (stopHeartbeat) await stopHeartbeat();
    if (fixture?.db?.isInitialized) {
      try {
        const [state] = await fixture.db.query(`SELECT
          (SELECT count(*)::int FROM nodia_ai_runtime_slots WHERE state<>'free') active_slots,
          (SELECT count(*)::int FROM nodia_ai_jobs WHERE state IN ('ready','waiting','leased','unknown') OR stage_key='reconcile_ack') pending_jobs,
          (SELECT count(*)::int FROM nodia_ai_api_dispatches WHERE state<>'closed' OR acknowledged_at IS NULL) unacked_dispatches`);
        report.sql_quiet_counts = state;
        report.state_clean = Object.values(state).every(count => count === 0);
        if (claim) {
          const [binding] = await fixture.db.query('SELECT request_hash,response_hash,exchange_count FROM nodia_ai_api_dispatches WHERE attempt_id=$1', [claim.attempt.id]);
          if (binding) {
            report.request_sha256 = binding.request_hash; report.response_sha256 = binding.response_hash;
            report.durable_exchange_count = binding.exchange_count;
          }
        }
      } catch { report.state_clean = false; report.state_check_failed = true; }
    }
    report.provider_posts = counts.posts; report.discovery_gets = counts.gets;
    if (rehearsalProvider) {
      report.synthetic_provider_posts = counts.posts; report.synthetic_discovery_gets = counts.gets;
      report.provider_posts = 0; report.discovery_gets = 0; report.real_network_requests = 0;
      report.proves = []; report.does_not_prove.push('real_provider_inference_or_media_qualification');
    }
    report.http_statuses = counts.http_statuses ?? [];
    report.network_failures = counts.network_failures ?? 0;
    report.checks = checks;
    report.success = report.success && report.state_clean && report.ack && report.terminal_closed;
    secret = undefined; input = undefined;
    try { if (compiled) await compiled.close(); }
    catch { report.success = false; report.module_cleanup_failed = true; }
    try { if (fixture) { await fixture.close(); report.owned_fixture_cleanup = true; } }
    catch { report.success = false; report.owned_fixture_cleanup = false; }
    for (const bytes of privateObjects.values()) bytes.fill(0); privateObjects.clear();
    delete process.env.AI_SECRET_MASTER_KEY;
    globalThis.fetch = originalFetch;
    for (const [name, method] of consoleMethods) console[name] = method;
    process.removeListener('SIGINT', cancel); process.removeListener('SIGTERM', cancel);
  }
  return report;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--self-test-contract') return contractSelfTest();
  if (args.length === 5 && args[0] === '--rehearse' && args[1] === '--provider' && ['openai', 'gemini'].includes(args[2]) && args[3] === '--output-dir' && args[4]) return execute(args[4], args[2]);
  if (!args.includes('--execute')) {
    if (args.length) fail('unknown_dry_run_argument');
    return { schema_version: 1, status: 'prepared_not_executed', stdin_read: false, database_created: false,
      provider_requests: 0, required: '--execute --output-dir public-generated-fixtures/image-r01 and exact four-field stdin gate', max_provider_posts: 1 };
  }
  if (args.length !== 3 || args[0] !== '--execute' || args[1] !== '--output-dir' || !args[2]) fail('invalid_execute_arguments');
  return execute(args[2]);
}

try {
  const report = await main();
  process.stdout.write(JSON.stringify(report) + '\n');
  if (report.success === false) process.exitCode = 1;
} catch (error) {
  process.stdout.write(JSON.stringify({ schema_version: 1, success: false, error_code: safeError(error), contents_redacted: true }) + '\n');
  process.exitCode = 1;
}
