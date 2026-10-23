// Operator-only non-generative collision probe using the deployed Server adapters.
// Exactly one health and one observe per trial; no start/turn, inference or retry.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { setTimeout as wait } from 'node:timers/promises';
import { execFileSync } from 'node:child_process';

const SERVER = '/opt/nodia/releases/nodia-server-ai38-owner-r01';
const ENV = '/opt/nodia/releases/nodia-server-ai15-20261016/.env';
const MANIFEST_SHA = '4c3fe6d600adab362a71c5f76357383e98aa7acda7c93aa73e61bfb29c626f92';
const sha = value => createHash('sha256').update(value).digest('hex');
const utc = () => new Date().toISOString();
const reasons = new Set(['runtime_busy', 'runtime_unconfigured', 'adapter_unconfigured', 'adapter_transport_unavailable',
  'adapter_invalid_response', 'agentic_unavailable', 'agentic_session_required', 'session_required', 'model_unavailable',
  'model_option_mismatch', 'adapter_protocol_unverified', 'adapter_generation_changed', 'service_unauthorized',
  'agentic_timeout', 'agentic_metadata_timeout', 'adapter_configuration_changed']);
const safeReason = value => value === null || value === undefined ? null : reasons.has(value) ? value : 'other_reason_present';
const runtimeEpoch = () => {
  const [value] = JSON.parse(execFileSync('docker', ['inspect', 'nodia-gemini-microservice'], { timeout: 10000, maxBuffer: 131072 }));
  assert.equal(value.State.Running, true);
  return { id: value.Id, image: value.Image, started_at: value.State.StartedAt };
};
let db, output, originalFetch;
let report = { schema: 'ai38-profile-reservation-probe-v1', status: 'precondition_failed',
  provider_generation_requests: 0, configured_SQL_writes: 0, automatic_retries: 0,
  request_headers_or_bodies_saved: false, service_credentials_emitted: false, observations: [] };
try {
  const { values } = parseArgs({ options: { phase: { type: 'string' }, trial: { type: 'string' },
    'offset-ms': { type: 'string', default: '100' }, 'wait-seconds': { type: 'string', default: '31' },
    'expected-image': { type: 'string' },
    'execute-metadata-only': { type: 'boolean', default: false } }, strict: true, allowPositionals: false });
  assert.equal(values['execute-metadata-only'], true);
  assert.ok(['diag', 'fix'].includes(values.phase) && ['A', 'B'].includes(values.trial));
  assert.match(values['offset-ms'], /^(?:0|[1-9][0-9]{0,3})$/u);
  assert.match(values['wait-seconds'], /^[0-9]{2}$/u);
  const offsetMs = Number(values['offset-ms']), waitSeconds = Number(values['wait-seconds']);
  assert.ok(offsetMs <= 1000 && waitSeconds >= 31 && waitSeconds <= 40);
  assert.equal(process.getuid(), 0);
  assert.match(values['expected-image'] ?? '', /^sha256:[a-f0-9]{64}$/u);
  const epochBefore = runtimeEpoch();
  assert.equal(epochBefore.image, values['expected-image']);
  assert.equal(sha(fs.readFileSync(path.join(SERVER, 'release-manifest.json'))), MANIFEST_SHA);
  const work = `/opt/nodia/verification/ai38-profile-reservation-${values.phase}-probe-r01`;
  if (!fs.existsSync(work)) fs.mkdirSync(work, { mode: 0o700 });
  const info = fs.lstatSync(work);
  assert.ok(info.isDirectory() && !info.isSymbolicLink() && info.uid === 0 && (info.mode & 0o777) === 0o700);
  const plannedOutput = path.join(work, `trial-${values.trial}.json`);
  assert.ok(!fs.existsSync(plannedOutput));
  assert.ok(!fs.existsSync(path.join(work, `trial-${values.trial}.lock`)));
  const require = createRequire(path.join(SERVER, 'package.json'));
  require('reflect-metadata');
  const config = require('dotenv').parse(fs.readFileSync(ENV));
  // This laboratory source uses loopback TCP without TLS. Fail rather than
  // weakening certificate verification or accepting a remote database.
  assert.notEqual(config.POSTGRES_SSL, 'true');
  assert.ok(['127.0.0.1', 'localhost', '::1', '[::1]'].includes(config.POSTGRES_HOST));
  const baseUrl = new URL(config.GEMINI_MICROSERVICE_URL);
  assert.ok(baseUrl.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(baseUrl.hostname));
  assert.equal(baseUrl.username, ''); assert.equal(baseUrl.password, '');
  assert.match(config.GEMINI_SERVICE_TOKEN, /^[a-f0-9]{64}$/iu);
  // Only necessary native-service configuration enters this process in memory.
  process.env.GEMINI_MICROSERVICE_URL = config.GEMINI_MICROSERVICE_URL;
  process.env.GEMINI_SERVICE_TOKEN = config.GEMINI_SERVICE_TOKEN;
  process.env.DOTENV_CONFIG_PATH = '/dev/null';
  process.env.RATE_LIMIT_STORAGE = 'memory';
  process.env.NODE_ENV = 'test';
  require('@nestjs/common').Logger.overrideLogger(false);
  const { DataSource } = require('typeorm');
  db = new DataSource({ type: 'postgres', host: config.POSTGRES_HOST, port: Number(config.POSTGRES_PORT),
    username: config.POSTGRES_USER, password: config.POSTGRES_PASSWORD, database: config.POSTGRES_DB,
    entities: [], migrations: [], synchronize: false, migrationsRun: false, logging: false,
    extra: { options: '-c default_transaction_read_only=on', statement_timeout: 5000, connectionTimeoutMillis: 5000 } });
  await db.initialize();
  const [readOnly] = await db.query('SHOW default_transaction_read_only');
  assert.equal(readOnly.default_transaction_read_only, 'on');
  const readSelection = async () => {
    const [row] = await db.query(`SELECT p.id::text,p.is_active,p.use_api_key,p.use_token_plan_web,p.use_token_plan_agentic,
      p.fields,c.key provider_key,c.is_active catalog_active,c.can_use_api_key,c.can_use_token_plan_web,c.can_use_token_plan_agentic
      FROM ai_providers p JOIN ai_provider_catalog c ON c.id=p.catalog_id WHERE p.id=$1`, ['2']);
    assert.ok(row?.provider_key === 'gemini' && row.is_active && row.catalog_active && row.use_token_plan_agentic);
    const { projectNodiaAiConnection } = await import(pathToFileURL(path.join(SERVER, 'dist/nodia-ai-conversation/use-case/list-nodia-ai-connections.use-case.js')));
    const mode = projectNodiaAiConnection(row).modes.find(item => item.mode === 'token_plan_agentic');
    assert.equal(mode.configuration, 'configured'); assert.ok(mode.configured_selection);
    return mode.configured_selection;
  };
  const quiet = async () => {
    const [value] = await db.query(`SELECT (SELECT count(*)::int FROM nodia_ai_jobs WHERE state IN ('ready','leased','waiting','unknown')) pending_jobs,
      (SELECT count(*)::int FROM nodia_ai_job_attempts WHERE ended_at IS NULL) open_attempts,
      (SELECT count(*)::int FROM nodia_ai_runtime_slots WHERE state IN ('held','unknown')) retained_slots`);
    assert.ok(Object.values(value).every(item => item === 0));
    return value;
  };
  const selection = await readSelection();
  report = { ...report, phase: values.phase, trial: values.trial, status: 'running', began_at_utc: utc(),
    source_sha256: sha(fs.readFileSync(fileURLToPath(import.meta.url))), server_manifest_sha256: MANIFEST_SHA,
    native_epoch_before: epochBefore,
    connection_id: '2', selection_sha256: sha(JSON.stringify(selection)), configured_selection_from_SQL: true,
    configured_selection_changed: false, configured_database_read_only: true, quiet_before: await quiet(),
    wait_before_calls_seconds: waitSeconds, inter_request_offset_ms: offsetMs, HTTP_requests: [] };
  const { GeminiService } = await import(pathToFileURL(path.join(SERVER, 'dist/common/ai/gemini.service.js')));
  const { GeminiNodiaAiAdapterUseCase } = await import(pathToFileURL(path.join(SERVER, 'dist/nodia-ai-adapter/use-case/gemini-nodia-ai-adapter.use-case.js')));
  const { NodiaAiAdapterTransport } = await import(pathToFileURL(path.join(SERVER, 'dist/nodia-ai-adapter/nodia-ai-adapter.service.js')));
  const service = new GeminiService();
  const adapter = new GeminiNodiaAiAdapterUseCase(db, new NodiaAiAdapterTransport());
  originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const destination = new URL(url);
    const endpoint = destination.pathname === '/engines/status' && init?.method === 'GET' ? 'health' :
      destination.pathname === '/nodia-ai/agentic/observe' && init?.method === 'POST' ? 'observe' : null;
    assert.ok(endpoint && destination.origin === baseUrl.origin);
    assert.ok(!report.HTTP_requests.some(item => item.endpoint === endpoint), 'At most one call per endpoint; no retry');
    const item = { endpoint, method: init.method, started_at_utc: utc(), completed_at_utc: null, status: null };
    report.HTTP_requests.push(item);
    try {
      const response = await originalFetch(url, init);
      item.status = response.status;
      return response;
    } finally { item.completed_at_utc = utc(); }
  };
  // All package/config/import/SQL checks have passed before claiming this
  // metadata trial. A pre-call precondition failure has no consumed intent.
  // Once claimed, a failed invocation cannot repeat either HTTP request.
  fs.writeFileSync(path.join(work, `trial-${values.trial}.lock`), JSON.stringify({ phase: values.phase, trial: values.trial, began_at: utc() }), { flag: 'wx', mode: 0o600 });
  output = plannedOutput;
  await wait(waitSeconds * 1000);
  report.calls_began_at_utc = utc();
  const health = async () => {
    try {
      const result = await service.getDualEngineStatus(AbortSignal.timeout(20000));
      return { operation: 'health', returned: result !== null, agentic_available: result?.agentic?.available ?? null,
        agentic_session_active: result?.agentic?.has_active_session ?? null, reason: safeReason(result?.agentic?.reason) };
    } catch (error) { return { operation: 'health', returned: false, reason: safeReason(error?.code) }; }
  };
  const observe = async () => {
    try {
      const result = await adapter.observe(selection, AbortSignal.timeout(35000));
      return { operation: 'observe', returned: true, available: result.available, supports_mcp: result.supportsMcp,
        reason: safeReason(result.reason) };
    } catch (error) { return { operation: 'observe', returned: false, reason: safeReason(error?.code) }; }
  };
  const first = values.trial === 'A' ? health : observe;
  const second = values.trial === 'A' ? observe : health;
  const firstTask = first();
  await wait(offsetMs);
  const secondTask = second();
  report.observations = await Promise.all([firstTask, secondTask]);
  assert.deepEqual(await readSelection(), selection, 'Configured selection changed during explicit probe');
  report.quiet_after = await quiet();
  const epochAfter = runtimeEpoch();
  assert.deepEqual(epochAfter, epochBefore, 'Native epoch changed during explicit probe');
  report.native_epoch_after = epochAfter;
  assert.equal(report.HTTP_requests.length, 2);
  report.status = 'metadata_trial_completed_not_causal_acceptance';
  report.completed_at_utc = utc();
} catch (error) {
  report.status = 'probe_failed_no_automatic_retry';
  report.failure_class = error?.constructor?.name === 'AssertionError' ? 'AssertionError' : 'OperationError';
  report.completed_at_utc = utc();
  process.exitCode = 1;
} finally {
  if (originalFetch) globalThis.fetch = originalFetch;
  if (db?.isInitialized) await db.destroy();
  if (output) fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}
