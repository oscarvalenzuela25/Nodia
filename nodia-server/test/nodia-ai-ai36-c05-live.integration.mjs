// Explicit C05 real-Gemini acceptance against disposable PostgreSQL only.
// Publication/selection come from the compiled production bundle, never fixture
// publication overrides. The HTTP actor and records are synthetic; confirmation
// is an operator test driver, not a physical user click or UI acceptance.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { Test } from '@nestjs/testing';
import { UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { parse } from 'dotenv';
import {
  createNodiaAiIntegrationFixture,
  loadAi,
} from './nodia-ai.integration.fixture.mjs';
import {
  startC05OwnedLogObserver,
  c05ObserverPolicySha,
} from './nodia-ai-ai36-c05-owned-log-observer.mjs';
import {
  C05_CASE_TOOLS,
  runC05IndependentCase,
} from './nodia-ai-ai36-c05-independent-cases.fixture.mjs';

const controlMode = process.env.NODIA_AI_C05_SEMANTIC_CONTROL === 'yes';
const discoveryOnly = process.env.NODIA_AI_C05_DISCOVERY_ONLY === 'yes';
const caseId = process.env.NODIA_AI_C05_CASE;
assert.ok(
  Object.hasOwn(C05_CASE_TOOLS, caseId),
  'Explicit independent case is required',
);
const observerScript = process.env.NODIA_AI_C05_OBSERVER_SCRIPT;
assert.ok(
  !observerScript || (discoveryOnly && !controlMode),
  'Owned-log observation is an explicit real single-generation diagnostic only',
);
class DiscoveryCanaryFinished extends Error {}
assert.equal(
  process.env.NODIA_AI_ALLOW_LIVE,
  controlMode ? 'no' : 'yes',
  'Distinct explicit synthetic-control or real-provider opt-in required',
);
const controlFixture = controlMode
  ? await import('./nodia-ai-ai36-c05-semantic-control.fixture.mjs')
  : null;
const runtime = process.env.NODIA_AI_C05_OPERATIONAL_RUNTIME;
const output = process.env.NODIA_AI_C05_OUTPUT;
assert.ok(
  (controlMode || (runtime && path.isAbsolute(runtime))) &&
    output &&
    path.isAbsolute(output),
);
assert.equal(fs.existsSync(output), false, 'Never replace an earlier attempt');
const configuration = controlMode
  ? {}
  : parse(fs.readFileSync(path.join(runtime, '.env')));
if (!controlMode) {
  const privateUrl = new URL(configuration.GEMINI_MICROSERVICE_URL);
  assert.ok(
    ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(privateUrl.hostname),
  );
  assert.match(configuration.GEMINI_SERVICE_TOKEN ?? '', /^[a-f0-9]{64}$/iu);
  // The configured environment is never written into the candidate or fixtures.
  process.env.GEMINI_MICROSERVICE_URL = configuration.GEMINI_MICROSERVICE_URL;
  process.env.GEMINI_SERVICE_TOKEN = configuration.GEMINI_SERVICE_TOKEN;
}
process.env.DOTENV_CONFIG_PATH = '/dev/null';
const sha = (value) =>
  createHash('sha256')
    .update(typeof value === 'string' ? value : JSON.stringify(value))
    .digest('hex');
const report = {
  stage: 'AI-36-C05',
  scope: controlMode
    ? 'synthetic_transport_production_semantics_control_disposable_sql'
    : 'explicit_published_selected_capabilities_real_gemini_disposable_sql',
  status: 'running',
  started_at_utc: new Date().toISOString(),
  maximum_generations: discoveryOnly ? 1 : 2,
  maximum_generations_per_run: discoveryOnly ? 1 : 2,
  diagnostic_only: discoveryOnly,
  independent_case: caseId,
  cohort_maximum_generations: 8,
  next_case_requires_explicit_operator_GO: true,
  requested_capability_names: C05_CASE_TOOLS[caseId],
  selection_mode: 'automatic_discovery_then_explicit_bounded_execution',
  selection_callbacks: 0,
  actual_provider_generations: 0,
  provider_dispatch_attempts: 0,
  generation_count_scope:
    'native_accepted_MCP_start_requests_not_token_or_billing_measurement',
  native_terminal_ACKs: [],
  native_transport_observations: {},
  automatic_inference_retries: 0,
  operational_database_writes: 0,
  synthetic_publication_override: false,
  synthetic_provider_transport: controlMode,
  synthetic_http_actor: true,
  human_confirmation_layer:
    'explicit_operator_HTTP_test_driver_not_physical_UI',
  natural_language_scope:
    'directed_synthetic_requests_with_exact_tool_names_and_known_ids',
  configured_sql_read_only: !controlMode,
  configured_database_access: controlMode ? 'none' : 'read_only',
  storage_operations: 0,
  services_restarted: false,
  credentials_logged: false,
  checks: [],
  turns: [],
  per_capability: {},
  runtime_timings: [],
  owned_cli_log_observations: [],
  acceptance_scope: discoveryOnly
    ? 'single_generation_discovery_diagnostic_no_business_capability_acceptance'
    : controlMode
      ? 'synthetic_transport_only_all_native_business_rules_and_assertions_real_not_provider_acceptance'
      : 'current_explicit_bundle_and_exact_configured_Gemini_selection_in_laboratory_not_productive_acceptance',
};
const save = () =>
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
const check = (name, condition = true) => {
  assert.ok(condition, name);
  report.checks.push(name);
  save();
};
save();
const operational = controlMode
  ? null
  : new DataSource({
      type: 'postgres',
      host: configuration.POSTGRES_HOST,
      port: Number(configuration.POSTGRES_PORT),
      database: configuration.POSTGRES_DB,
      username: configuration.POSTGRES_USER,
      password: configuration.POSTGRES_PASSWORD,
      ssl:
        configuration.POSTGRES_SSL === 'true'
          ? { rejectUnauthorized: false }
          : undefined,
      synchronize: false,
      migrationsRun: false,
    });
let fixture,
  app,
  compiled,
  activeTurn,
  pending = false;
let reconciliation, cleanup;
const observerHandles = [];
const expectedNew = [
  'nodia_finance_movements_prepare_create',
  'nodia_proposals_get',
  'nodia_operations_get',
  'nodia_workflows_prepare',
  'nodia_attachments_describe',
  'nodia_preferences_list',
  'nodia_preferences_prepare',
];
const load = async (...entries) =>
  Promise.all(entries.map(([file, name]) => loadAi(file, name)));
try {
  let original;
  if (controlMode) {
    original = controlFixture.syntheticOriginal;
    report.public_mode_configuration_sha256 = sha(original.mode_fields);
    report.configuration_snapshot_scope =
      'explicit_synthetic_test_configuration_no_operational_environment_or_database';
  } else {
    await operational.initialize();
    const readOnly = operational.createQueryRunner();
    await readOnly.connect();
    try {
      await readOnly.startTransaction();
      await readOnly.query('SET TRANSACTION READ ONLY');
      const quiet = (
        await readOnly.query(`SELECT
      (SELECT count(*)::int FROM nodia_ai_jobs WHERE state IN ('ready','leased','waiting','unknown')) pending_jobs,
      (SELECT count(*)::int FROM nodia_ai_job_attempts WHERE ended_at IS NULL) open_attempts,
      (SELECT count(*)::int FROM nodia_ai_runtime_slots WHERE state IN ('held','unknown')) retained_slots`)
      )[0];
      check(
        'operational runtime has no pending work before real-provider verification',
        Object.values(quiet).every((value) => value === 0),
      );
      const rows =
        await readOnly.query(`SELECT p.id::text,p.updated_at,p.fields->'agentic' mode_fields,
      p.fields->'agentic'->>'selected_model' model_id,
      COALESCE(p.fields->'agentic'->'thinking_levels'->>(p.fields->'agentic'->>'selected_model'),
        p.fields->'agentic'->>'thinking_level') effort_id
      FROM ai_providers p JOIN ai_provider_catalog c ON c.id=p.catalog_id
      WHERE p.is_active AND c.is_active AND c.key='gemini' AND p.use_agentic AND c.can_use_agentic`);
      assert.equal(
        rows.length,
        1,
        'Require one exact currently configured Gemini Agentic connection',
      );
      original = rows[0];
      assert.match(original.id, /^[1-9][0-9]*$/u);
      assert.ok(
        typeof original.model_id === 'string' && original.model_id.trim(),
      );
      assert.ok(
        original.mode_fields &&
          typeof original.mode_fields === 'object' &&
          !Array.isArray(original.mode_fields),
      );
      const secretKeys = new Set([
        'api_key',
        'api_keys',
        'access_token',
        'refresh_token',
        'id_token',
        'secret',
        'password',
        'cookies',
        'cookie',
        'authorization',
        'credentials',
        'credential',
      ]);
      const rejectSecrets = (value) => {
        if (value && typeof value === 'object')
          for (const [key, item] of Object.entries(value)) {
            assert.equal(
              secretKeys.has(key.toLowerCase()),
              false,
              'Provider mode configuration must contain no credentials',
            );
            rejectSecrets(item);
          }
      };
      rejectSecrets(original.mode_fields);
      report.public_mode_configuration_sha256 = sha(original.mode_fields);
      report.configuration_snapshot_scope =
        'nonsecret_agentic_mode_fields_and_updated_at_preserve_native_configuration_fingerprint';
      await readOnly.commitTransaction();
    } finally {
      await readOnly.release();
    }
    await operational.destroy();
  }
  fixture = await createNodiaAiIntegrationFixture(
    controlMode ? 'ai3607' : 'ai3605',
  );
  const { db, options, identities } = fixture;
  const [
    Tools,
    Conversation,
    Processing,
    Runtime,
    Confirmation,
    Execution,
    Observation,
  ] = await load(
    ['nodia-ai-tools/nodia-ai-tools.module', 'NodiaAiToolsModule'],
    [
      'nodia-ai-conversation/nodia-ai-conversation.module',
      'NodiaAiConversationModule',
    ],
    ['nodia-ai-context/nodia-ai-processing.module', 'NodiaAiProcessingModule'],
    ['nodia-ai-runtime/nodia-ai-runtime.module', 'NodiaAiRuntimeModule'],
    [
      'nodia-ai-confirmation/nodia-ai-confirmation.module',
      'NodiaAiConfirmationModule',
    ],
    ['nodia-ai-execution/nodia-ai-execution.module', 'NodiaAiExecutionModule'],
    [
      'nodia-ai-observation/nodia-ai-observation.module',
      'NodiaAiObservationModule',
    ],
  );
  const [
    Stage,
    Create,
    Admit,
    AdapterPort,
    Adapter,
    Transport,
    Redis,
    Registry,
    Claim,
    Execute,
    Filter,
    Policy,
    bodyParser,
    Reconciliation,
    Cleanup,
    Prepare,
    Handler,
    ProcessStage,
  ] = await load(
    [
      'nodia-ai-runtime/use-case/run-nodia-ai-stage.use-case',
      'RunNodiaAiStageUseCase',
    ],
    [
      'nodia-ai-conversation/use-case/create-nodia-ai-conversation.use-case',
      'CreateNodiaAiConversationUseCase',
    ],
    [
      'nodia-ai-conversation/use-case/admit-nodia-ai-message.use-case',
      'AdmitNodiaAiMessageUseCase',
    ],
    ['nodia-ai-adapter/types/nodia-ai-adapter.types', 'NodiaAiAdapterPort'],
    [
      'nodia-ai-adapter/use-case/gemini-nodia-ai-adapter.use-case',
      'GeminiNodiaAiAdapterUseCase',
    ],
    ['nodia-ai-adapter/nodia-ai-adapter.service', 'NodiaAiAdapterTransport'],
    ['common/redis/redis.service', 'RedisService'],
    [
      'nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case',
      'NodiaAiToolRegistryUseCase',
    ],
    [
      'nodia-ai-execution/use-case/claim-nodia-ai-execution.use-case',
      'ClaimNodiaAiExecutionUseCase',
    ],
    [
      'nodia-ai-execution/use-case/execute-nodia-ai-local-execution.use-case',
      'ExecuteNodiaAiLocalExecutionUseCase',
    ],
    ['common/filters/all-exceptions.filter', 'AllExceptionsFilter'],
    ['nodia-ai-runtime/config/runtime-policy', 'NODIA_AI_RUNTIME_POLICY'],
    [
      'nodia-ai-conversation/nodia-ai-conversation-body-parser',
      'createNodiaAiConversationBodyParser',
    ],
    [
      'nodia-ai-runtime/use-case/reconcile-nodia-ai-runtime.use-case',
      'ReconcileNodiaAiRuntimeUseCase',
    ],
    [
      'nodia-ai-runtime/use-case/cleanup-nodia-ai-runtime-proofs.use-case',
      'CleanupNodiaAiRuntimeProofsUseCase',
    ],
    [
      'nodia-ai-proposal/use-case/prepare-nodia-ai-proposal.use-case',
      'PrepareNodiaAiProposalUseCase',
    ],
    ['nodia-ai-runtime/types/worker.types', 'NODIA_AI_STAGE_HANDLER'],
    [
      'nodia-ai-context/use-case/process-nodia-ai-stage.use-case',
      'ProcessNodiaAiStageUseCase',
    ],
  );
  const privateTransport = new Transport();
  const semanticControl = controlMode
    ? controlFixture.createC05SemanticControl({
        db,
        report,
        save,
        getActiveTurn: () => activeTurn,
        getRegistry: () => compiled.get(Registry),
      })
    : null;
  const clock = () => ({
    at_utc: new Date().toISOString(),
    monotonic_ms: performance.now(),
  });
  const safeCode = (error) =>
    typeof error?.code === 'string' &&
    /^[a-z][a-z0-9_]{0,127}$/u.test(error.code)
      ? error.code
      : 'unclassified_error';
  const timeRuntime = async (kind, action, context = {}) => {
    const timing = { kind, ...context, started: clock(), status: 'started' };
    assert.ok(
      report.runtime_timings.length < 128,
      'Bounded runtime timing observations',
    );
    report.runtime_timings.push(timing);
    save();
    try {
      const result = await action();
      timing.status = 'completed';
      return result;
    } catch (error) {
      timing.status = 'rejected';
      timing.error_code = safeCode(error);
      throw error;
    } finally {
      timing.finished = clock();
      timing.elapsed_ms =
        timing.finished.monotonic_ms - timing.started.monotonic_ms;
      save();
    }
  };
  const auditedTransport = {
    async request(target, payload, signal, dispatch) {
      assert.equal(
        controlMode,
        false,
        'Synthetic semantic control must never invoke native transport',
      );
      const route = target.match(
        /^\/nodia-ai\/agentic\/attempts\/([a-f0-9-]+)\/(mcp\/(?:events|results|cancel)|acknowledge)$/u,
      );
      const attemptId =
        target === '/nodia-ai/agentic/mcp/start'
          ? payload.attempt_id
          : route?.[1];
      const kind =
        target === '/nodia-ai/agentic/mcp/start' ? 'start' : route?.[2];
      const stamp = clock;
      const trace = attemptId
        ? (report.native_transport_observations[attemptId] ??= {
            request_counts: {},
            response_counts: {},
            failed_counts: {},
            transitions: [],
            latest_poll: null,
            latency_ms_by_kind: {},
            last_completed_request_by_kind: {},
          })
        : undefined;
      const started = stamp();
      if (trace) {
        trace.request_counts[kind] = (trace.request_counts[kind] ?? 0) + 1;
        trace.in_flight_request = {
          kind,
          ordinal: trace.request_counts[kind],
          started,
        };
        if (kind !== 'mcp/events' && trace.transitions.length < 256)
          trace.transitions.push({
            kind,
            direction: 'request_started',
            ...started,
            ...(kind === 'mcp/results' ? { call_id: payload.call_id } : {}),
          });
        // Persist before awaiting: cancellation/lost response must retain the request boundary.
        save();
      }
      let response;
      if (kind === 'start') {
        const generation = activeTurn.generations.find(
          (item) => item.attempt_id === attemptId,
        );
        generation.native_start_payload_sha256 = sha(payload);
        generation.native_canonical_prompt_sha256 = sha(
          payload.canonical_prompt,
        );
        generation.native_timeout_seconds = payload.timeout_seconds;
        if (observerScript) {
          const measured = activeTurn.measurements.at(-1);
          try {
            assert.equal(measured.measurementKind, 'exact');
            assert.equal(
              measured.canonicalUtf8Bytes,
              Buffer.byteLength(payload.canonical_prompt),
            );
            assert.ok(
              !payload.attachments?.length,
              'This diagnostic has no files or account documents',
            );
            const expectedPolicy = {
              tools: payload.tools,
              rpc_budget: 128,
              tool_budget: 12,
              timeout_seconds: payload.timeout_seconds,
              cli_json_string_arguments: true,
              documents: [],
              context_budget: {
                schema_version: 1,
                initial_utf8_bytes: measured.totalUtf8Bytes,
                maximum_utf8_bytes: 262144,
              },
            };
            generation.native_public_policy_sha256 =
              c05ObserverPolicySha(expectedPolicy);
            generation.native_public_policy_hash_format =
              'sorted_compact_ASCII_JSON_SHA256';
            const observer = await startC05OwnedLogObserver(
              {
                schema_version: 1,
                attempt_id: attemptId,
                resource_key: payload.resource_key,
                session_generation: payload.session_generation,
                operation_ref: payload.operation_ref ?? payload.attempt_id,
                marker_path: `/app/session_state/runtime_admission/${payload.resource_key.split(':')[1]}.unknown`,
                profile_home: process.env.NODIA_AI_C05_OBSERVER_PROFILE_HOME,
                parser_path: process.env.NODIA_AI_C05_OBSERVER_PARSER,
                parser_sha256: process.env.NODIA_AI_C05_OBSERVER_PARSER_SHA256,
                expected_policy: expectedPolicy,
                maximum_seconds: 140,
              },
              observerScript,
              process.env.NODIA_AI_C05_OBSERVER_PYTHON,
              (observation) => {
                const index = report.owned_cli_log_observations.findIndex(
                  (item) => item.attempt_id === attemptId,
                );
                if (index < 0)
                  report.owned_cli_log_observations.push(observation);
                else report.owned_cli_log_observations[index] = observation;
                save();
              },
            );
            observerHandles.push(observer);
          } catch {
            report.owned_cli_log_observations.push({
              attempt_id: attemptId,
              state: 'diagnostic_unavailable',
              reason: 'observer_setup_failed',
            });
            save();
          }
        }
        if (trace.transitions.length < 256)
          trace.transitions.push({
            kind,
            direction: 'native_POST_started',
            ...stamp(),
          });
        save();
      }
      const httpStarted = stamp();
      try {
        response = await privateTransport.request(
          target,
          payload,
          signal,
          dispatch,
        );
      } catch (error) {
        if (trace) {
          trace.failed_counts[kind] = (trace.failed_counts[kind] ?? 0) + 1;
          const finished = stamp();
          trace.last_failed_request = {
            kind,
            started,
            finished,
            elapsed_ms: finished.monotonic_ms - started.monotonic_ms,
            signal_aborted: signal?.aborted === true,
            error_code: safeCode(error),
          };
          trace.in_flight_request = null;
          save();
        }
        throw error;
      }
      if (trace) {
        const received = stamp();
        trace.last_completed_request = {
          kind,
          started,
          received,
          elapsed_ms: received.monotonic_ms - started.monotonic_ms,
          http_elapsed_ms: received.monotonic_ms - httpStarted.monotonic_ms,
        };
        trace.last_completed_request_by_kind[kind] =
          trace.last_completed_request;
        const duration = trace.last_completed_request.elapsed_ms;
        const aggregate = (trace.latency_ms_by_kind[kind] ??= {
          count: 0,
          total: 0,
          minimum: duration,
          maximum: duration,
        });
        aggregate.count++;
        aggregate.total += duration;
        aggregate.minimum = Math.min(aggregate.minimum, duration);
        aggregate.maximum = Math.max(aggregate.maximum, duration);
        trace.in_flight_request = null;
        trace.response_counts[kind] = (trace.response_counts[kind] ?? 0) + 1;
        let changed = kind !== 'mcp/events';
        if (kind === 'mcp/events') {
          const eventKinds = {};
          const eventIdentities = [];
          for (const event of Array.isArray(response?.events)
            ? response.events
            : []) {
            const type = ['tool_request', 'answer', 'error'].includes(
              event?.kind,
            )
              ? event.kind
              : 'other';
            eventKinds[type] = (eventKinds[type] ?? 0) + 1;
            if (eventIdentities.length < 256)
              eventIdentities.push({
                kind: type,
                seq: Number.isSafeInteger(event?.seq) ? event.seq : null,
                ...(type === 'tool_request'
                  ? {
                      name:
                        typeof event?.name === 'string' &&
                        /^nodia_[a-z0-9_]{1,100}$/u.test(event.name)
                          ? event.name
                          : 'invalid',
                      call_id:
                        typeof event?.call_id === 'string' &&
                        /^[a-f0-9-]{36}$/u.test(event.call_id)
                          ? event.call_id
                          : null,
                    }
                  : {}),
              });
          }
          const poll = {
            state: ['running', 'completed', 'unknown'].includes(response?.state)
              ? response.state
              : 'invalid',
            rpc_messages: Number.isSafeInteger(response?.rpc_messages)
              ? response.rpc_messages
              : null,
            unforwarded_tool_requests: Number.isSafeInteger(
              response?.unforwarded_tool_requests,
            )
              ? response.unforwarded_tool_requests
              : null,
            cursor_requested: Number.isSafeInteger(payload.after)
              ? payload.after
              : null,
            event_kinds: eventKinds,
            event_identities: eventIdentities,
          };
          const signature = sha(poll);
          if (
            trace.latest_poll?.signature !== signature &&
            trace.transitions.length < 256
          ) {
            trace.transitions.push({ kind, ...poll, ...stamp() });
            changed = true;
          }
          trace.latest_poll = { ...poll, signature, ...stamp() };
        } else if (trace.transitions.length < 256) {
          trace.transitions.push({
            kind,
            direction: 'response_received',
            ...received,
            elapsed_ms: received.monotonic_ms - started.monotonic_ms,
            http_elapsed_ms: received.monotonic_ms - httpStarted.monotonic_ms,
            ...(kind === 'mcp/results'
              ? {
                  call_id: payload.call_id,
                  accepted: response?.accepted === true,
                }
              : {}),
            ...(kind === 'start'
              ? { running: response?.state === 'running' }
              : {}),
            ...(kind === 'acknowledge'
              ? { acknowledged: response?.acknowledged === true }
              : {}),
          });
        }
        if (changed || trace.response_counts[kind] % 10 === 0) save();
      }
      if (
        target === '/nodia-ai/agentic/mcp/start' &&
        response?.state === 'running'
      ) {
        report.actual_provider_generations++;
        save();
      }
      if (
        /^\/nodia-ai\/agentic\/attempts\/[a-f0-9-]+\/acknowledge$/u.test(
          target,
        ) &&
        response?.acknowledged === true
      ) {
        report.native_terminal_ACKs.push({
          attempt_id: payload.operation_ref,
          terminal_proof_sha256: sha(payload.terminal_proof_id),
          acknowledged_at_utc: new Date().toISOString(),
        });
        save();
      }
      return response;
    },
  };
  const native = semanticControl?.adapter ?? new Adapter(db, auditedTransport);
  const instrumented = {
    async observe(...args) {
      const observed = await timeRuntime('observe', () =>
        native.observe(...args),
      );
      if (activeTurn)
        activeTurn.native_observation = {
          available: observed.available,
          supports_mcp: observed.supportsMcp,
          source: observed.source,
          observed_at: observed.observedAt.toISOString(),
          reason: observed.reason,
        };
      check(
        'native exact selection reports available MCP before message admission or dispatch',
        observed.available && observed.supportsMcp,
      );
      return observed;
    },
    verifyConfiguration: (...args) => native.verifyConfiguration(...args),
    async measureContext(...args) {
      const measured = await timeRuntime('measure_context', () =>
        native.measureContext(...args),
      );
      if (activeTurn) {
        activeTurn.measurements.push(measured);
        save();
      }
      return measured;
    },
    async execute(request, signal) {
      assert.ok(
        activeTurn &&
          report.provider_dispatch_attempts < report.maximum_generations,
        'Real generation budget exhausted',
      );
      assert.ok(
        activeTurn.generations.length < report.maximum_generations_per_run,
        'Per-run generation budget exhausted',
      );
      const [frozen] = await db.query(
        'SELECT context_manifest FROM nodia_ai_runs WHERE id=$1',
        [activeTurn.run_id],
      );
      const [grant] = await db.query(
        'SELECT allowed_operations FROM nodia_ai_execution_grants WHERE run_id=$1',
        [activeTurn.run_id],
      );
      const phase = frozen.context_manifest.tool_selection.phase;
      assert.ok(
        ['discovery', 'execution'].includes(phase),
        'Only a frozen discovery or execution generation may dispatch',
      );
      const generation = {
        attempt_id: request.attemptId,
        phase,
        callbacks: [],
        provider_deadline_at: request.deadlineAt.toISOString(),
        selected_tool_names: request.tools.map((tool) => tool.name).sort(),
        selected_catalog_sha256: sha(request.tools),
        frozen_contracts_sha256: sha(frozen.context_manifest.tool_contracts),
        terminal_proof_received: false,
        started_at_utc: new Date().toISOString(),
        started_monotonic_ms: performance.now(),
      };
      activeTurn.generations.push(generation);
      report.provider_dispatch_attempts++;
      assert.ok(generation.selected_tool_names.length <= 74);
      assert.deepEqual(
        generation.selected_tool_names,
        Object.keys(frozen.context_manifest.tool_contracts).sort(),
        'The provider receives exactly the tools frozen in the backend run and grant',
      );
      assert.deepEqual(
        grant.allowed_operations
          .filter((name) => name !== 'chat:respond')
          .sort(),
        generation.selected_tool_names,
      );
      if (phase === 'discovery') {
        assert.equal(
          activeTurn.generations.length,
          1,
          'A run cannot repeat discovery',
        );
        assert.ok(
          generation.selected_tool_names.includes('nodia_capabilities_select'),
        );
        assert.ok(
          expectedNew.every(
            (name) => !generation.selected_tool_names.includes(name),
          ),
          'Discovery exposes no business capability',
        );
      } else {
        assert.equal(activeTurn.generations[0].phase, 'discovery');
        assert.ok(
          !generation.selected_tool_names.includes('nodia_capabilities_select'),
        );
        const selected =
          frozen.context_manifest.tool_selection.request.capability_ids;
        generation.requested_capability_ids = selected;
        generation.required_capabilities_selected =
          activeTurn.required_tools.every((name) => selected.includes(name));
        for (const name of expectedNew)
          if (selected.includes(name))
            report.per_capability[name].selected_in_real_generation = true;
        const [acks] = await db.query(
          "SELECT count(*)::int count FROM nodia_ai_jobs WHERE kind='reconcile' AND stage_key='reconcile_ack'",
        );
        assert.equal(
          acks.count,
          0,
          'Execution must wait until the discovery terminal proof has been acknowledged',
        );
        assert.ok(
          report.native_terminal_ACKs.some(
            (item) => item.attempt_id === activeTurn.generations[0].attempt_id,
          ),
          'The native service must have acknowledged the exact discovery attempt before execution',
        );
        generation.discovery_ACK_completed_before_dispatch = true;
      }
      save();
      const reply = await timeRuntime(
        'execute',
        () =>
          native.execute(
            {
              ...request,
              onToolCall: async (call, callbackSignal) => {
                const selectionCallback =
                  call.name === 'nodia_capabilities_select';
                const item = {
                  name: call.name,
                  phase,
                  kind: selectionCallback
                    ? 'selection'
                    : expectedNew.includes(call.name)
                      ? 'capability'
                      : 'technical_or_existing_read',
                  call_id: call.callId,
                  observed_attempt_id: request.attemptId,
                  requested_at_utc: new Date().toISOString(),
                  requested_monotonic_ms: performance.now(),
                  arguments_sha256: sha(call.arguments),
                  status: 'requested',
                };
                activeTurn.callbacks.push(item);
                generation.callbacks.push(item);
                save();
                if (selectionCallback) {
                  assert.equal(phase, 'discovery');
                  report.selection_callbacks++;
                } else if (expectedNew.includes(call.name)) {
                  assert.equal(
                    phase,
                    'execution',
                    'Business callbacks are impossible in discovery',
                  );
                  report.per_capability[call.name].actual_callbacks++;
                }
                let result;
                try {
                  result = await request.onToolCall(call, callbackSignal);
                } catch (error) {
                  const code =
                    typeof error?.code === 'string'
                      ? error.code
                      : error?.message;
                  item.error_code =
                    typeof code === 'string' &&
                    /^(?:nodia_ai:)?[a-z][a-z0-9_]{0,127}$/u.test(code)
                      ? code
                      : 'callback_rejected';
                  item.rejected_at_utc = new Date().toISOString();
                  item.rejected_monotonic_ms = performance.now();
                  item.status = 'rejected';
                  save();
                  throw error;
                }
                item.status = 'completed';
                item.completed_at_utc = new Date().toISOString();
                item.completed_monotonic_ms = performance.now();
                item.result_sha256 = sha(result);
                const receipts = await db.query(
                  'SELECT id,run_id,adapter_call_id,state,public_result FROM nodia_ai_tool_calls WHERE run_id=$1 AND adapter_call_id=$2',
                  [activeTurn.run_id, call.callId],
                );
                if (receipts.length === 1)
                  item.durable_receipt = {
                    receipt_id: receipts[0].id,
                    run_id: receipts[0].run_id,
                    adapter_call_id: receipts[0].adapter_call_id,
                    state: receipts[0].state,
                    result_sha256: sha(receipts[0].public_result),
                  };
                if (selectionCallback) {
                  assert.equal(result.status, 'selection_requested');
                  assert.equal(result.next_action, 'finish_current_generation');
                  assert.equal(result.business_effects, false);
                  generation.selection_requested_capability_ids =
                    result.selected_capability_ids;
                } else if (expectedNew.includes(call.name))
                  report.per_capability[call.name].successful_callbacks++;
                save();
                return result;
              },
            },
            signal,
          ),
        { attempt_id: request.attemptId, phase },
      );
      generation.terminal_proof_received = true;
      generation.terminal_proof_sha256 = sha(
        reply.terminalProof.terminalProofId,
      );
      generation.terminal_proof_outcome = reply.terminalProof.outcome;
      generation.process_closed = reply.terminalProof.processClosed;
      generation.answer_sha256 = sha(
        reply.kind === 'answer' ? reply.text : reply.kind,
      );
      generation.finished_at_utc = new Date().toISOString();
      generation.finished_monotonic_ms = performance.now();
      save();
      return reply;
    },
  };
  const builder = Test.createTestingModule({
    imports: [
      TypeOrmModule.forRootAsync({
        useFactory: () => options,
        dataSourceFactory: async () => db,
      }),
      Tools,
      Conversation,
      Processing,
      Runtime,
      Confirmation,
      Execution,
      Observation,
    ],
    providers: [Stage],
  })
    .overrideProvider(Redis)
    .useValue({
      get: async () => null,
      set: async () => {},
      del: async () => {},
      keys: async () => [],
    })
    .overrideProvider(Transport)
    .useValue(auditedTransport)
    .overrideProvider(AdapterPort)
    .useValue(instrumented)
    .overrideProvider(Handler)
    .useFactory({
      inject: [ProcessStage],
      factory: (handler) => ({
        catalogVersions: handler.catalogVersions,
        execute: (claim, context) =>
          handler.execute(claim, {
            ...context,
            armDispatch: async (...args) => {
              const timing = {
                kind: 'arm_dispatch',
                attempt_id: claim.attempt.id,
                started: clock(),
                status: 'started',
              };
              report.runtime_timings.push(timing);
              save();
              try {
                const deadline = await context.armDispatch(...args);
                assert.ok(
                  deadline instanceof Date,
                  'The compiled dispatch deadline contract is required',
                );
                timing.provider_deadline_at = deadline.toISOString();
                timing.status = 'completed';
                return deadline;
              } catch (error) {
                timing.status = 'rejected';
                timing.error_code = safeCode(error);
                throw error;
              } finally {
                timing.finished = clock();
                timing.elapsed_ms =
                  timing.finished.monotonic_ms - timing.started.monotonic_ms;
                save();
              }
            },
          }),
      }),
    });
  if (controlMode) {
    const [ProofPort] = await load([
      'nodia-ai-runtime/types/reconciliation.types',
      'NodiaAiRuntimeReconciliationPort',
    ]);
    builder.overrideProvider(ProofPort).useValue(semanticControl.proofs);
  }
  compiled = await builder.compile();
  reconciliation = compiled.get(Reconciliation);
  cleanup = compiled.get(Cleanup);
  app = compiled.createNestApplication({ logger: false });
  app.setGlobalPrefix('api/v1');
  app.use(
    '/api/v1/nodia-ai',
    bodyParser(compiled.get(Policy).admission.http_json_bytes),
  );
  app.useGlobalFilters(new Filter());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalGuards({
    canActivate(context) {
      const request = context.switchToHttp().getRequest(),
        identity = identities.get(request.headers['x-fixture-actor']);
      if (!identity) throw new UnauthorizedException();
      request.auth = {
        user: { id: identity.userId },
        sessionId: identity.sessionId,
      };
      return true;
    },
  });
  await app.listen(0, '127.0.0.1');
  const base = `${await app.getUrl()}/api/v1/nodia-ai`;
  const http = async (
    target,
    { method = 'GET', body, expected = 200 } = {},
  ) => {
    const response = await fetch(base + target, {
      method,
      headers: { 'content-type': 'application/json', 'x-fixture-actor': '1' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const result = response.status === 204 ? null : await response.json();
    assert.equal(
      response.status,
      expected,
      `Operator HTTP ${method} ${target} returned ${response.status}`,
    );
    return result;
  };
  let [module] = await db.query(
    "SELECT id::text FROM modules WHERE link='/finances-personal'",
  );
  if (!module)
    [module] = await db.query(
      "INSERT INTO modules(module_group_id,link,key) SELECT module_group_id,'/finances-personal','personal_finance' FROM modules WHERE key='nodia_ai' RETURNING id::text",
    );
  await db.query(
    'INSERT INTO user_modules(user_id,module_id) VALUES(1,$1) ON CONFLICT DO NOTHING',
    [module.id],
  );
  await db.query(
    `INSERT INTO ai_providers(id,name,catalog_id,fields,use_agentic,is_active,updated_at)
    SELECT $1,'Synthetic C05 connection using exact configured public selection',id,$2::jsonb,true,true,$3
    FROM ai_provider_catalog WHERE key='gemini'`,
    [
      original.id,
      JSON.stringify({ agentic: original.mode_fields }),
      original.updated_at,
    ],
  );
  const [category] = await db.query(
    "INSERT INTO finance_categories(user_id,name,key) VALUES(1,'Synthetic C05 food','ai36_c05_food') RETURNING id::text",
  );
  const selection = {
    connection_id: original.id,
    mode: 'agentic',
    model_id: original.model_id,
    effort_id: original.effort_id ?? null,
  };
  report.selection = selection;
  const pin = JSON.parse(
    fs.readFileSync(
      new URL(
        '../dist/nodia-ai-context/config/knowledge-pin.json',
        import.meta.url,
      ),
    ),
  );
  const manifest = JSON.parse(
    fs.readFileSync(
      new URL('../dist/nodia-ai/knowledge/manifest.json', import.meta.url),
    ),
  );
  assert.equal(
    manifest.capability_contracts.length,
    74,
    'The first C05 cohort adds exactly seven capabilities to the 67 reads',
  );
  report.publication = {
    release_id: pin.release_id,
    catalog_release: pin.catalog_release,
    manifest_sha256: sha(
      fs.readFileSync(
        new URL('../dist/nodia-ai/knowledge/manifest.json', import.meta.url),
        'utf8',
      ),
    ),
    capabilities: manifest.capability_contracts.length,
    registry_hash: manifest.registry_sha256,
  };
  const registry = compiled.get(Registry),
    identity = identities.get('1'),
    stage = compiled.get(Stage);
  check(
    'the actual compiled publication and registry bind all seven C05 capabilities',
    expectedNew.every(
      (name) =>
        manifest.capability_contracts.some(
          (item) =>
            item.capability_id === name && item.publication === 'published',
        ) &&
        registry
          .list(['/nodia-ai', '/finances-personal'])
          .some((item) => item.toolName === name),
    ),
  );
  for (const name of expectedNew) {
    const registration = registry
      .list(['/nodia-ai', '/finances-personal'])
      .find((item) => item.toolName === name);
    report.per_capability[name] = {
      actual_callbacks: 0,
      successful_callbacks: 0,
      publication_bound: true,
      selected_in_real_generation: false,
      contract_hash: registration.contractHash,
      real_provider: !controlMode,
      actual_compiled_gateway: true,
      records: 'synthetic_disposable_SQL',
      physical_UI: false,
      productive_acceptance: false,
      semantic_assertions: [],
    };
  }
  const semantic = (name, id, expected, observed) => {
    assert.deepEqual(observed, expected, name + ': ' + id);
    check(name + ': ' + id);
    report.per_capability[name].semantic_assertions.push({
      id,
      passed: true,
      expected,
      observed,
    });
    save();
  };
  const chat = await compiled.get(Create).execute(identity, {
    client_request_id: randomUUID(),
    title: 'Synthetic real-provider C05 acceptance',
    selection,
  });
  report.disposable_chat_id = chat.conversation_id;
  async function turn(label, text, requiredTools) {
    activeTurn = {
      label,
      measurements: [],
      callbacks: [],
      generations: [],
      required_tools: requiredTools,
      human_prompt_sha256: sha(text),
      started_at_utc: new Date().toISOString(),
    };
    report.turns.push(activeTurn);
    save();
    const [header] = await db.query(
      'SELECT revision FROM nodia_ai_conversations WHERE id=$1',
      [chat.conversation_id],
    );
    const admitted = await compiled
      .get(Admit)
      .execute(identity, chat.conversation_id, {
        client_message_id: randomUUID(),
        expected_conversation_revision: header.revision,
        parts: [{ kind: 'text', text }],
      });
    activeTurn.run_id = admitted.run.run_id;
    save();
    const [queued] = await db.query(
      'SELECT created_at,deadline_at FROM nodia_ai_runs WHERE id=$1',
      [activeTurn.run_id],
    );
    activeTurn.queued_at_utc = queued.created_at.toISOString();
    activeTurn.run_deadline_at = queued.deadline_at.toISOString();
    const [frozen] = await db.query(
      'SELECT context_manifest FROM nodia_ai_runs WHERE id=$1',
      [activeTurn.run_id],
    );
    const [grant] = await db.query(
      'SELECT allowed_operations FROM nodia_ai_execution_grants WHERE run_id=$1',
      [activeTurn.run_id],
    );
    activeTurn.initial_frozen_tool_names = Object.keys(
      frozen.context_manifest.tool_contracts,
    ).sort();
    assert.deepEqual(
      grant.allowed_operations.filter((name) => name !== 'chat:respond').sort(),
      activeTurn.initial_frozen_tool_names,
    );
    assert.equal(frozen.context_manifest.tool_selection.phase, 'discovery');
    activeTurn.initial_frozen_contracts_sha256 = sha(
      frozen.context_manifest.tool_contracts,
    );
    save();
    for (let steps = 0; steps < 8; steps++) {
      const [row] = await db.query(
        'SELECT state,error_code,context_manifest FROM nodia_ai_runs WHERE id=$1',
        [activeTurn.run_id],
      );
      if (
        discoveryOnly &&
        activeTurn.generations.length === 1 &&
        activeTurn.generations[0].terminal_proof_received &&
        row.context_manifest.tool_selection.phase === 'execution'
      ) {
        const generation = activeTurn.generations[0];
        assert.equal(generation.phase, 'discovery');
        assert.ok(
          report.native_terminal_ACKs.some(
            (item) =>
              item.attempt_id === generation.attempt_id &&
              item.terminal_proof_sha256 === generation.terminal_proof_sha256,
          ),
        );
        assert.deepEqual(
          [
            ...row.context_manifest.tool_selection.request.capability_ids,
          ].sort(),
          [...requiredTools].sort(),
        );
        const jobs = await db.query(
          'SELECT state,stage_key,attempt_count FROM nodia_ai_jobs WHERE run_id=$1 ORDER BY created_at,id',
          [activeTurn.run_id],
        );
        const [quiet] = await db.query(`SELECT
          (SELECT count(*)::int FROM nodia_ai_job_attempts WHERE ended_at IS NULL) open_attempts,
          (SELECT count(*)::int FROM nodia_ai_runtime_slots WHERE state IN ('held','unknown')) retained_slots,
          (SELECT count(*)::int FROM nodia_ai_jobs WHERE kind='reconcile') proof_ack_jobs`);
        assert.deepEqual(quiet, {
          open_attempts: 0,
          retained_slots: 0,
          proof_ack_jobs: 0,
        });
        assert.equal(report.provider_dispatch_attempts, 1);
        activeTurn.state = row.state;
        activeTurn.finished_at_utc = new Date().toISOString();
        report.diagnostic_stop = {
          reason: 'discovery_completed_ACK_and_local_selection_activation_only',
          run_state: row.state,
          turn_completed: false,
          business_capabilities_accepted: 0,
          queued_continuation_undispatched: true,
          jobs,
          native_and_SQL_quiet: quiet,
        };
        save();
        throw new DiscoveryCanaryFinished();
      }
      if (row.state === 'completed') break;
      if (
        ['unknown', 'failed', 'cancelled', 'waiting_for_user'].includes(
          row.state,
        )
      )
        break;
      const claimed = await stage.execute(
        randomUUID(),
        new AbortController().signal,
      );
      if (!claimed) break;
      for (let work = 0; work < 2; work++) {
        const result = await cleanup.execute();
        if (!result.processed) break;
      }
    }
    const [finished] = await db.query(
      'SELECT state,error_code FROM nodia_ai_runs WHERE id=$1',
      [activeTurn.run_id],
    );
    activeTurn.state = finished.state;
    activeTurn.error_code = finished.error_code;
    activeTurn.finished_at_utc = new Date().toISOString();
    save();
    assert.equal(
      finished.state,
      'completed',
      'Real turn did not complete; no automatic replay',
    );
    check(
      label +
        ': discovery selection and execution are separate bounded generations',
      activeTurn.generations.length === 2 &&
        activeTurn.generations[0].phase === 'discovery' &&
        activeTurn.generations[1].phase === 'execution' &&
        activeTurn.generations[1].required_capabilities_selected &&
        activeTurn.generations[0].callbacks.some(
          (item) => item.kind === 'selection' && item.status === 'completed',
        ) &&
        activeTurn.generations.every((item) => item.terminal_proof_received),
    );
    for (let work = 0; work < 4; work++) {
      const result = await cleanup.execute();
      if (!result.processed) break;
    }
    const receipts = await db.query(
      "SELECT id,run_id,adapter_call_id,tool_name,contract_hash,public_result FROM nodia_ai_tool_calls WHERE run_id=$1 AND state='completed' ORDER BY created_at,id",
      [activeTurn.run_id],
    );
    activeTurn.receipts = receipts.map((item) => ({
      receipt_id: item.id,
      tool_name: item.tool_name,
      run_id: item.run_id,
      adapter_call_id: item.adapter_call_id,
      state: 'completed',
      contract_hash: item.contract_hash,
      result_sha256: sha(item.public_result),
    }));
    check(
      label + ': required real callbacks have durable completed SQL receipts',
      requiredTools.every((name) =>
        receipts.some((item) => item.tool_name === name),
      ),
    );
    for (const receipt of receipts) {
      if (receipt.tool_name === 'nodia_capabilities_select') continue;
      const value = await http('/tool-calls/' + receipt.id + '/result');
      assert.equal(
        sha(value),
        sha(receipt.public_result),
        'Terminal receipt recovery must not replay tools',
      );
    }
    return receipts;
  }
  async function humanConfirm(proposal, purpose = 'capability_acceptance') {
    const challenge = await http(
      `/proposals/${proposal.proposal_id}/confirmation-challenge`,
      {
        method: 'POST',
        body: {
          proposal_revision: proposal.revision,
          expected_hash: proposal.hash,
        },
      },
    );
    const body = {
      client_request_id: randomUUID(),
      proposal_revision: proposal.revision,
      expected_hash: proposal.hash,
      confirmation_token: challenge.confirmation_token,
    };
    const accepted = await http(`/proposals/${proposal.proposal_id}/confirm`, {
      method: 'POST',
      body,
      expected: 202,
    });
    const duplicate = await http(`/proposals/${proposal.proposal_id}/confirm`, {
      method: 'POST',
      body,
      expected: 202,
    });
    assert.equal(
      accepted.execution.execution_id,
      duplicate.execution.execution_id,
    );
    let state = accepted.execution.state;
    for (let step = 0; step < 8 && state === 'queued'; step++) {
      const lease = await compiled.get(Claim).execute(randomUUID());
      assert.equal(lease?.executionId, accepted.execution.execution_id);
      state = (
        await compiled
          .get(Execute)
          .execute(identity, accepted.execution.execution_id, lease)
      ).state;
    }
    assert.equal(state, 'completed');
    report.human_confirmations ??= [];
    report.human_confirmations.push({
      proposal_id: proposal.proposal_id,
      revision: proposal.revision,
      proposal_hash: proposal.hash,
      execution_id: accepted.execution.execution_id,
      duplicate_confirmation_same_execution: true,
      layer: 'operator_HTTP_fixture_actor_not_UI',
      purpose,
    });
    save();
    return accepted.execution.execution_id;
  }
  await runC05IndependentCase({
    caseId,
    db,
    compiled,
    Prepare,
    identity,
    chat,
    category,
    turn,
    humanConfirm,
    http,
    semantic,
    check,
    report,
    save,
  });
  const quiet = (
    await db.query(`SELECT
    (SELECT count(*)::int FROM nodia_ai_jobs WHERE state IN ('ready','leased','waiting','unknown')) pending_jobs,
    (SELECT count(*)::int FROM nodia_ai_job_attempts WHERE ended_at IS NULL) open_attempts,
    (SELECT count(*)::int FROM nodia_ai_runtime_slots WHERE state IN ('held','unknown')) retained_slots`)
  )[0];
  check(
    'disposable worker has no uncertain attempts retained slots or pending proof ACKs',
    Object.values(quiet).every((value) => value === 0),
  );
  report.status = 'passed';
} catch (error) {
  report.status =
    error instanceof DiscoveryCanaryFinished
      ? 'diagnostic_completed'
      : 'failed';
  if (!(error instanceof DiscoveryCanaryFinished)) {
    report.failure_category =
      error instanceof assert.AssertionError
        ? 'acceptance_assertion_failed'
        : 'live_acceptance_failed';
    if (error instanceof assert.AssertionError)
      report.failure_assertion = String(error.message).slice(0, 512);
    process.exitCode = 1;
  }
} finally {
  if (fixture && compiled && reconciliation && cleanup) {
    try {
      const uncertain = await fixture.db.query(
        "SELECT id FROM nodia_ai_jobs WHERE kind='turn' AND state='unknown'",
      );
      report.uncertain_reconciliation = [];
      for (const job of uncertain) {
        const result = await reconciliation.execute(
          fixture.identities.get('3'),
          job.id,
        );
        report.uncertain_reconciliation.push({
          job_id: job.id,
          resolved: result.resolved,
          cleanup_pending: result.cleanup_pending,
        });
      }
      for (let step = 0; step < 8; step++) {
        const result = await cleanup.execute();
        if (!result.processed) break;
      }
      const [open] = await fixture.db.query(
        "SELECT count(*)::int count FROM nodia_ai_jobs WHERE state IN ('leased','unknown') OR kind='reconcile'",
      );
      pending = open.count > 0;
    } catch {
      pending = true;
    }
  }
  if (fixture?.db.isInitialized) {
    try {
      const [business] = await fixture.db.query(`SELECT
        (SELECT count(*)::int FROM finance_movements) finance_movements,
        (SELECT count(*)::int FROM nodia_ai_preferences) accepted_preferences`);
      const runs = await fixture.db.query(
        'SELECT id,state,error_code,provider_dispatches_used,tool_calls_used,budget_snapshot FROM nodia_ai_runs ORDER BY created_at,id',
      );
      const receipts = await fixture.db.query(
        'SELECT id,tool_name,state,contract_hash,arguments_hash,public_result FROM nodia_ai_tool_calls ORDER BY created_at,id',
      );
      report.disposable_sql_final = {
        business_counts: business,
        runs,
        receipts: receipts.map((receipt) => ({
          receipt_id: receipt.id,
          tool_name: receipt.tool_name,
          state: receipt.state,
          contract_hash: receipt.contract_hash,
          arguments_hash: receipt.arguments_hash,
          result_sha256: sha(receipt.public_result),
        })),
      };
    } catch {
      report.disposable_sql_snapshot = 'unavailable';
    }
  }
  for (const observer of observerHandles) {
    try {
      await observer.stop();
    } catch {
      /* Supplemental reader cannot change native outcome or reconciliation. */
    }
  }
  report.unresolved_native_or_proof_state = pending;
  report.disposable_database_retained_for_reconciliation = pending;
  if (pending) {
    report.status = 'failed';
    report.failure_category ??= 'native_reconciliation_pending';
    process.exitCode = 1;
  }
  if (operational?.isInitialized) await operational.destroy();
  if (app) await app.close();
  else if (compiled) await compiled.close();
  if (fixture && !pending) await fixture.close();
  report.finished_at_utc = new Date().toISOString();
  save();
  console.log(JSON.stringify(report, null, 2));
}
