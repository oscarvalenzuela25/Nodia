import 'reflect-metadata';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { fileURLToPath } from 'node:url';
import { parseArgs, parseEnv } from 'node:util';
import { DataSource } from 'typeorm';
import { ApiTextGenerationService } from '../dist/ai-generation/api-text-generation.service.js';
import { GenerationWorkerSourceRegistry } from '../dist/ai-generation/worker-source-registry.js';
import { CheckModuleAccessUseCase } from '../dist/authorization/use-case/check-module-access.use-case.js';
import { ApiNodiaAiCredentialsService } from '../dist/nodia-ai-adapter/api-nodia-ai-credentials.service.js';
import { NodiaAiConnectionsService } from '../dist/nodia-ai-conversation/nodia-ai-connections.service.js';
import { ValidateNodiaAiRuntimePolicyUseCase } from '../dist/nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case.js';
import { NodiaCvGenerationScope } from '../dist/nodia-cv/nodia-cv-generation-scope.service.js';
import { NodiaCvGenerationStore } from '../dist/nodia-cv/nodia-cv-generation.store.js';
import { NodiaCvGenerationWorker } from '../dist/nodia-cv/nodia-cv-generation.worker.js';
import { NodiaCvProfilesService } from '../dist/nodia-cv/nodia-cv-profiles.service.js';
import { NodiaCvSelectionService } from '../dist/nodia-cv/nodia-cv-selection.service.js';
import {
  CV_PROBE_CANDIDATE,
  CV_PROBE_OFFER,
  validCvProbeDraft,
} from '../dist/nodia-cv/policies/nodia-cv-generation.js';
import { NodiaCvGenerationsUseCase } from '../dist/nodia-cv/use-case/nodia-cv-generations.use-case.js';
import { NodiaCvProfilesUseCase } from '../dist/nodia-cv/use-case/nodia-cv-profiles.use-case.js';

const { values } = parseArgs({
  options: {
    connection: { type: 'string' },
    model: { type: 'string' },
    effort: { type: 'string' },
    'run-once': { type: 'boolean', default: false },
  },
});
const probeSelection = {
  connection_id: values.connection,
  mode: 'api_key',
  model_id: values.model,
  effort_id: values.effort ?? null,
};
const report = {
  scope: 'nodia_cv_api_key_synthetic_vm',
  stage: 'validate_environment',
  startedAt: new Date().toISOString(),
  status: 'failed',
  node: process.version,
};
let lab;
let configured;
let previousMasterKey;
let installedMasterKey = false;

function check(condition, code) {
  if (!condition) throw new Error(code);
}

function policy() {
  const envelope = JSON.parse(readFileSync(
    new URL('../dist/nodia-ai-runtime/config/runtime-policy.json', import.meta.url),
    'utf8',
  ));
  return new ValidateNodiaAiRuntimePolicyUseCase().execute(envelope);
}

function borrowConfiguredSource() {
  check(hostname() === 'nodia-vps-lab' && process.platform === 'linux', 'vm_required');
  const active = parseEnv(readFileSync('/opt/nodia/nodia-server/.env', 'utf8'));
  check(['127.0.0.1', 'localhost'].includes(active.POSTGRES_HOST) &&
    active.POSTGRES_PORT === '5432' &&
    active.POSTGRES_DB === 'nodia_lab' &&
    Boolean(active.POSTGRES_USER) &&
    Boolean(active.POSTGRES_PASSWORD), 'unexpected_configured_database');
  check(/^[a-fA-F0-9]{64}$/.test(active.AI_SECRET_MASTER_KEY ?? ''), 'configured_master_key_unavailable');

  previousMasterKey = process.env.AI_SECRET_MASTER_KEY;
  process.env.AI_SECRET_MASTER_KEY = active.AI_SECRET_MASTER_KEY;
  installedMasterKey = true;
  return new DataSource({
    type: 'postgres',
    host: active.POSTGRES_HOST,
    port: Number(active.POSTGRES_PORT),
    database: active.POSTGRES_DB,
    username: active.POSTGRES_USER,
    password: active.POSTGRES_PASSWORD,
    synchronize: false,
    logging: false,
    extra: {
      max: 2,
      options: '-c default_transaction_read_only=on -c statement_timeout=5000',
    },
  });
}

// The VM connection, model and selected key remain read-only in their configured
// source. The inherited transport resolves and decrypts only its exact selected key.
class ReadOnlyConfiguredCredentials extends ApiNodiaAiCredentialsService {
  configuration(selection) {
    return super.configuration(selection);
  }
}

async function seedLab(manager, config, catalogId) {
  const userId = '9007199254740931';
  const sessionId = randomUUID();
  await manager.query(
    'INSERT INTO users(id,email,name) VALUES ($1,$2,$3)',
    [userId, 'cv03-synthetic@example.invalid', CV_PROBE_CANDIDATE],
  );
  await manager.query(
    "INSERT INTO auth_sessions(public_id,user_id,refresh_token_hash,expires_at) VALUES ($1,$2,$3,now()+interval '1 hour')",
    [sessionId, userId, createHash('sha256').update(sessionId).digest('hex')],
  );
  const roles = await manager.query(
    "INSERT INTO user_roles(user_id,role_id,is_active) SELECT $1,id,true FROM roles WHERE key='super_admin' RETURNING role_id::text",
    [userId],
  );
  check(roles.length === 1, 'synthetic_user_role_missing');
  await manager.query(
    "INSERT INTO ai_providers(id,catalog_id,fields,name,use_api_key,is_active) VALUES ($1,$2,$3::jsonb,'CV lab FK pointer',false,false)",
    [config.connectionId, catalogId, JSON.stringify({})],
  );
  // Inert FK pointer. It cannot authenticate. The selected credentials service uses
  // the configured read-only database for both metadata and secret resolution.
  await manager.query(
    "INSERT INTO ai_api_keys(id,provider_id,label,secret_ciphertext,secret_fingerprint,display_hint,is_active,is_selected) VALUES ($1,$2,'CV lab FK pointer','lab-pointer-invalid',repeat('0',64),'****',false,false)",
    [config.keyId, config.connectionId],
  );
  return { userId, sessionId };
}

function safeError(error) {
  const values = [error instanceof Error ? error.message : null, error?.code];
  return values.find(value => typeof value === 'string' &&
    (/^(?:nodiaCv:)?[a-z][a-z0-9_]{2,72}$/.test(value) || /^[A-Z0-9]{5}$/.test(value))) ??
    'probe_assertion_or_runtime_error';
}

try {
  check(/^[1-9][0-9]{0,18}$/.test(values.connection ?? '') &&
    /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/.test(values.model ?? '') &&
    (values.effort === undefined || /^[a-z][a-z0-9_-]{0,31}$/.test(values.effort)),
  'select_connection_and_model_explicitly');

  configured = borrowConfiguredSource();
  report.stage = 'configured_preflight';
  await configured.initialize();
  const [readOnly] = await configured.query("SELECT current_setting('transaction_read_only')='on' AND current_database()='nodia_lab' AS enabled");
  check(readOnly?.enabled === true, 'configured_source_must_be_read_only');
  const credentials = new ReadOnlyConfiguredCredentials(configured);
  const actual = await credentials.configuration(probeSelection);
  const [active] = await configured.query(
    `SELECT c.key, (p.fields #>> '{api_key,selected_model}')=$2 AS selected,
      COALESCE((p.fields #> '{api_key,thinking_levels}') ->> $2::text,
        p.fields #>> '{api_key,thinking_level}') AS api_effort,
      p.fields #>> '{agentic,selected_model}' AS agentic_model,
      COALESCE((p.fields #> '{agentic,thinking_levels}') ->> (p.fields #>> '{agentic,selected_model}'),
        p.fields #>> '{agentic,thinking_level}') AS agentic_effort
     FROM ai_providers p JOIN ai_provider_catalog c ON c.id=p.catalog_id WHERE p.id=$1`,
    [probeSelection.connection_id, probeSelection.model_id],
  );
  check(active?.key === actual.providerKey && active.selected === true &&
    active.api_effort === probeSelection.effort_id, 'configured_selection_mismatch');
  report.selection = probeSelection;
  report.provider = actual.providerKey;
  report.configurationPresent = true;
  report.configuredSourceReadOnly = true;
  if (!values['run-once']) {
    report.status = 'configuration_only';
    report.dispatched = 0;
  } else {
    report.stage = 'isolated_database';
    lab = new DataSource({
      type: 'postgres',
      url: 'postgresql://nodia_cv_lab@127.0.0.1:55443/nodia_cv_test_cv03',
      synchronize: false,
      logging: false,
      entities: [fileURLToPath(new URL('../dist/**/*.entity.js', import.meta.url))],
      migrations: [fileURLToPath(new URL('../dist/migrations/*.js', import.meta.url))],
      extra: { max: 3 },
    });
    await lab.initialize();
    const [isolation] = await lab.query(
      "SELECT current_database()='nodia_cv_test_cv03' AND current_user='nodia_cv_lab' AS enabled, (SELECT count(*)::int FROM pg_tables WHERE schemaname='public') AS tables",
    );
    check(isolation?.enabled === true && isolation.tables === 0, 'empty_isolated_database_required');
    const migrations = await lab.runMigrations({ transaction: 'all' });
    report.migrations = migrations.length;
    const [catalog] = await lab.query(
      'SELECT id::text FROM ai_provider_catalog WHERE key=$1',
      [actual.providerKey],
    );
    check(catalog?.id, 'synthetic_catalog_missing');
    const actor = await lab.transaction(manager => seedLab(manager, actual, catalog.id));
    const currentPolicy = policy();
    const moduleAccess = new CheckModuleAccessUseCase(lab);
    const profiles = new NodiaCvProfilesService();
    const store = new NodiaCvGenerationStore();
    const profileCommand = new NodiaCvProfilesUseCase(lab, moduleAccess, profiles, store);
    const scope = new NodiaCvGenerationScope(lab, moduleAccess);
    const selections = new NodiaCvSelectionService(
      credentials, new NodiaAiConnectionsService(lab), currentPolicy,
    );
    const api = new ApiTextGenerationService(credentials, currentPolicy);
    const generationCommand = new NodiaCvGenerationsUseCase(
      scope, store, profiles, selections, api, currentPolicy,
    );
    const worker = new NodiaCvGenerationWorker(
      scope, store, profiles, selections, api, new GenerationWorkerSourceRegistry(), currentPolicy,
    );

    report.stage = 'admit_probe';
    if (typeof active.agentic_model === 'string' && active.agentic_model.trim()) {
      const agentic = await generationCommand.eligibility(actor, {
        connection_id: probeSelection.connection_id,
        mode: 'agentic',
        model_id: active.agentic_model,
        effort_id: active.agentic_effort,
      });
      check(agentic.eligible === false &&
        agentic.reason_code === 'agentic_transport_unavailable', 'unexpected_agentic_eligibility');
      report.agentic = { ...agentic, dispatched: 0 };
    }
    const eligibility = await generationCommand.eligibility(actor, probeSelection);
    check(eligibility.reason_code === 'qualification_required', 'unexpected_initial_eligibility');
    const profile = await profileCommand.create(actor, {
      request_key: randomUUID(),
      profile: {
        profile_name: 'Nodia CV live synthetic qualification',
        full_name: CV_PROBE_CANDIDATE,
        contact: { email: 'cv03-contact@example.invalid' },
        main_stack: ['TypeScript'],
      },
    });
    const requestKey = randomUUID();
    const started = await generationCommand.startProbe(actor, {
      request_key: requestKey,
      profile_id: profile.id,
      profile_revision: profile.revision,
      offer_text: CV_PROBE_OFFER,
      language: 'en',
      selection: probeSelection,
    });
    report.generationId = started.id;
    check(started.state === 'queued', 'probe_not_queued');
    report.stage = 'dispatch_one_probe';
    const workerId = randomUUID();
    check(await worker.execute(workerId, new AbortController().signal, started.id), 'probe_not_claimed');

    report.stage = 'read_back_probe';
    const result = await generationCommand.statusByRequest(actor, requestKey);
    const [receipt] = await lab.query(
      "SELECT o.owner_kind,o.phase,o.started_exchanges,o.reserved_exchanges,o.remote_outcome,o.acknowledged_at IS NOT NULL AS acked,o.terminal_proof->>'contract' AS proof_contract,o.terminal_proof->>'closure_basis' AS closure_basis,(o.terminal_proof->>'local_transport_closed')::bool AS local_closed,o.request_hash=o.terminal_proof->>'request_hash' AS request_hash_matches,o.response_hash=o.terminal_proof->>'response_hash' AS response_hash_matches,s.state AS slot_state FROM ai_generation_operations o JOIN nodia_ai_runtime_slots s ON s.resource_key=o.resource_key WHERE o.cv_generation_id=$1",
      [started.id],
    );
    report.state = result.state;
    report.publicErrorCode = result.error_code;
    report.receipt = receipt;
    report.validSyntheticDraft = result.draft ? validCvProbeDraft(result.draft) : false;
    check(receipt?.owner_kind === 'cv' && receipt.started_exchanges === 1 &&
      receipt.reserved_exchanges === 1, 'unexpected_exchange_receipt');
    check(result.state === 'ready' && report.validSyntheticDraft &&
      receipt.phase === 'closed' && receipt.remote_outcome === 'completed' &&
      receipt.acked && receipt.local_closed && receipt.request_hash_matches && receipt.response_hash_matches &&
      receipt.closure_basis === 'same_executor_return' && receipt.slot_state === 'free', 'live_probe_did_not_qualify');
    const qualified = await generationCommand.eligibility(actor, probeSelection);
    check(qualified.reason_code === 'qualified' && qualified.eligible === true, 'qualified_selection_not_readable');
    check(!(await worker.execute(workerId, new AbortController().signal, started.id)), 'terminal_probe_replayed');
    report.scopeHashRecorded = true;
    report.status = 'qualified_in_isolated_lab';
    report.stage = 'complete';
  }
} catch (error) {
  report.failure = safeError(error);
  process.exitCode = 1;
} finally {
  if (lab?.isInitialized) await lab.destroy();
  if (configured?.isInitialized) await configured.destroy();
  if (installedMasterKey) {
    if (previousMasterKey === undefined) delete process.env.AI_SECRET_MASTER_KEY;
    else process.env.AI_SECRET_MASTER_KEY = previousMasterKey;
  }
  report.finishedAt = new Date().toISOString();
  console.log(JSON.stringify(report));
}
