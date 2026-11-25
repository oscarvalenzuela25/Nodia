import 'reflect-metadata';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { hostname } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs, parseEnv } from 'node:util';
import { DataSource } from 'typeorm';
import { isAgenticModelAllowed } from '../dist/ai-provider/helpers/agentic-model-policy.helper.js';
import { CheckModuleAccessUseCase } from '../dist/authorization/use-case/check-module-access.use-case.js';
import { CodexChatRuntime } from '../dist/common/ai/codex/codex-chat-runtime.js';
import {
  codexProcessIdentity,
  stopCodexGroup,
} from '../dist/common/ai/codex/codex-process-ownership.js';
import { CodexRuntimeService } from '../dist/common/ai/codex/codex-runtime.service.js';
import { ApiNodiaAiCredentialsService } from '../dist/nodia-ai-adapter/api-nodia-ai-credentials.service.js';
import { NodiaAiConnectionsService } from '../dist/nodia-ai-conversation/nodia-ai-connections.service.js';
import { ValidateNodiaAiRuntimePolicyUseCase } from '../dist/nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case.js';
import {
  cvAgenticPayloadHash,
  parseCvAgenticDescriptor,
  parseCvAgenticReceipt,
} from '../dist/nodia-cv/agentic/nodia-cv-agentic-contract.js';
import { NodiaCvCodexSelection } from '../dist/nodia-cv/agentic/nodia-cv-codex-selection.js';
import { NodiaCvCodexTransport } from '../dist/nodia-cv/agentic/nodia-cv-codex-transport.js';
import { prepareCvTailoring } from '../dist/nodia-cv/engine/index.js';
import { NodiaCvGenerationScope } from '../dist/nodia-cv/nodia-cv-generation-scope.service.js';
import { NodiaCvGenerationStore } from '../dist/nodia-cv/nodia-cv-generation.store.js';
import { NodiaCvProfilesService } from '../dist/nodia-cv/nodia-cv-profiles.service.js';
import { NodiaCvSelectionService } from '../dist/nodia-cv/nodia-cv-selection.service.js';
import { NodiaCvPdfRenderer } from '../dist/nodia-cv/pdf/nodia-cv-pdf-renderer.service.js';
import {
  readNodiaCvProfile,
  withNodiaCvEntryIds,
} from '../dist/nodia-cv/policies/nodia-cv-profile.js';
import {
  cvExecutionHash,
  cvGenerationPrompt,
  CV_PROBE_CANDIDATE,
  CV_PROBE_OFFER,
  validCvProbeDraft,
} from '../dist/nodia-cv/policies/nodia-cv-generation.js';
import { NodiaCvGenerationsUseCase } from '../dist/nodia-cv/use-case/nodia-cv-generations.use-case.js';

// This operator-only runner prepares one synthetic probe on an isolated database.
// It never calls a worker. A separately started pilot consumes an admitted job.
const PILOT_DATABASE = 'nodia_cv_test_agentic_vm';
const ACTIVE_ENV = '/opt/nodia/nodia-server/.env';
const MARKER = 'nodia_cv_agentic_pilot_manifest';
const MODES = ['seed', 'preflight', 'admit', 'verify'];
const EXPECTED = {
  connection_id: '1',
  mode: 'agentic',
  model_id: 'gpt-6.2-sol',
  effort_id: 'high',
};
const PROBE = {
  id: '9007199254740931',
  email: 'cv-agentic-probe@example.invalid',
  name: CV_PROBE_CANDIDATE,
};
const BROWSER = {
  id: '9007199254740932',
  email: 'cv-agentic-owner@example.invalid',
  name: 'CV Pilot Owner',
};
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const report = { scope: 'nodia_cv_agentic_synthetic_vm', status: 'failed' };
let db;
let launcher;
let runtime;

function check(condition, code) {
  if (!condition) throw new Error(code);
}

function safeCode(error) {
  return (
    [error?.message, error?.code].find(
      (value) =>
        typeof value === 'string' &&
        (/^(?:(?:nodiaCv|cv):)?[a-z][a-z0-9_]{2,80}$/.test(value) ||
          /^[0-9A-Z]{5}$/.test(value)),
    ) ?? 'pilot_probe_assertion_or_runtime_error'
  );
}

const sha = (value) => createHash('sha256').update(value).digest('hex');
const sameSelection = (value, expected) =>
  value &&
  ['connection_id', 'mode', 'model_id', 'effort_id'].every(
    (key) => value[key] === expected[key],
  );

function pilotSource() {
  const url = new URL(process.env.NODIA_CV_TEST_DATABASE_URL ?? 'invalid:');
  check(
    url.protocol === 'postgresql:' &&
      url.hostname === '127.0.0.1' &&
      /^\d+$/.test(url.port) &&
      Number(url.port) !== 5432 &&
      url.pathname === '/' + PILOT_DATABASE &&
      !url.search &&
      !url.hash &&
      Boolean(url.username),
    'isolated_pilot_database_required',
  );
  return new DataSource({
    type: 'postgres',
    url: url.href,
    synchronize: false,
    logging: false,
    entities: [
      fileURLToPath(new URL('../dist/**/*.entity.js', import.meta.url)),
    ],
    migrations: [
      fileURLToPath(new URL('../dist/migrations/*.js', import.meta.url)),
    ],
    extra: { max: 4 },
  });
}

async function configuredConnection() {
  const settings = parseEnv(await readFile(ACTIVE_ENV, 'utf8'));
  check(
    ['127.0.0.1', 'localhost'].includes(settings.POSTGRES_HOST) &&
      settings.POSTGRES_PORT === '5432' &&
      settings.POSTGRES_DB === 'nodia_lab' &&
      Boolean(settings.POSTGRES_USER) &&
      Boolean(settings.POSTGRES_PASSWORD),
    'unexpected_configured_source',
  );
  const active = new DataSource({
    type: 'postgres',
    host: settings.POSTGRES_HOST,
    port: 5432,
    database: settings.POSTGRES_DB,
    username: settings.POSTGRES_USER,
    password: settings.POSTGRES_PASSWORD,
    synchronize: false,
    logging: false,
    extra: {
      max: 1,
      options: '-c default_transaction_read_only=on -c statement_timeout=5000',
    },
  });
  try {
    await active.initialize();
    const [configured] = await active.query(
      `SELECT current_setting('transaction_read_only')='on' AND current_database()='nodia_lab' AS safe,
        c.key, p.is_active, c.is_active AS catalog_active, p.use_agentic, c.can_use_agentic,
        p.fields->'agentic' AS agentic
        FROM ai_providers p JOIN ai_provider_catalog c ON c.id=p.catalog_id WHERE p.id=$1`,
      [EXPECTED.connection_id],
    );
    check(
      configured?.safe &&
        configured.key === 'openai' &&
        configured.is_active &&
        configured.catalog_active &&
        configured.use_agentic &&
        configured.can_use_agentic &&
        isAgenticModelAllowed(configured.agentic, EXPECTED.model_id),
      'configured_codex_connection_unavailable',
    );
    report.configuredSourceReadOnly = true;
  } finally {
    if (active.isInitialized) await active.destroy();
  }
}

async function compose(database, activeRuntime) {
  const chat = new CodexChatRuntime(activeRuntime);
  const connections = new NodiaAiConnectionsService(database);
  const codexSelection = new NodiaCvCodexSelection(connections, chat);
  const transport = new NodiaCvCodexTransport(
    codexSelection,
    activeRuntime,
    chat.journal,
  );
  const authority = new CheckModuleAccessUseCase(database);
  const store = new NodiaCvGenerationStore();
  const profiles = new NodiaCvProfilesService();
  const scope = new NodiaCvGenerationScope(database, authority);
  const api = {
    execute() {
      throw new Error('unexpected_api_key_dispatch');
    },
  };
  const policy = new ValidateNodiaAiRuntimePolicyUseCase().execute(
    JSON.parse(
      await readFile(
        new URL(
          '../dist/nodia-ai-runtime/config/runtime-policy.json',
          import.meta.url,
        ),
        'utf8',
      ),
    ),
  );
  const selections = new NodiaCvSelectionService(
    new ApiNodiaAiCredentialsService(database),
    connections,
    policy,
    transport,
    codexSelection,
  );
  return {
    chat,
    transport,
    profiles,
    scope,
    selections,
    command: new NodiaCvGenerationsUseCase(
      scope,
      store,
      profiles,
      selections,
      api,
      policy,
    ),
  };
}

async function seedActor(manager, person, moduleId, superAdmin = false) {
  await manager.query('INSERT INTO users(id,email,name) VALUES($1,$2,$3)', [
    person.id,
    person.email,
    person.name,
  ]);
  await manager.query(
    'INSERT INTO user_modules(user_id,module_id,is_active) VALUES ($1,$2,true)',
    [person.id, moduleId],
  );
  if (superAdmin) {
    const role = await manager.query(
      `INSERT INTO user_roles(user_id,role_id,is_active) SELECT $1,id,true FROM roles WHERE key='super_admin'
       RETURNING role_id`,
      [person.id],
    );
    check(role.length === 1, 'pilot_admin_role_missing');
  }
  const sessionId = randomUUID();
  await manager.query(
    `INSERT INTO auth_sessions(public_id,user_id,refresh_token_hash,expires_at)
     VALUES ($1,$2,$3,now()+interval '24 hours')`,
    [sessionId, person.id, sha(randomUUID())],
  );
  return { userId: person.id, sessionId };
}

async function seedProfile(parts, manager, actor, person) {
  const { profile, requestHash } = readNodiaCvProfile({
    profile_name: 'CV Agentic synthetic pilot',
    full_name: person.name,
    professional_title: 'Software Developer',
    contact: { email: 'synthetic.cv.contact@example.invalid' },
    main_stack: ['TypeScript'],
  });
  const id = randomUUID();
  check(
    await parts.profiles.claimCreate(
      manager,
      actor.userId,
      randomUUID(),
      id,
      requestHash,
    ),
    'pilot_profile_receipt_failed',
  );
  return parts.profiles.insert(manager, {
    ...profile,
    id,
    owner_user_id: actor.userId,
    data: withNodiaCvEntryIds(profile.data),
  });
}

async function seed(parts, requestKey) {
  await configuredConnection();
  const native = await parts.chat.observe(
    EXPECTED.connection_id,
    AbortSignal.timeout(30_000),
  );
  check(
    native.session.available &&
      native.session.authenticated === true &&
      native.session.usageAllowed !== false,
    'configured_codex_session_unavailable',
  );
  const models = native.models.filter(
    (model) => model.id === EXPECTED.model_id,
  );
  check(
    models.length === 1 &&
      models[0].supportedReasoningEfforts.includes(EXPECTED.effort_id),
    'configured_codex_model_or_effort_missing',
  );
  const model = models[0];
  const fields = {
    agentic: {
      allowed_model_ids: [model.id],
      available_models: [
        {
          id: model.id,
          displayName: model.displayName,
          supportedReasoningEfforts: model.supportedReasoningEfforts,
        },
      ],
      selected_model: model.id,
      thinking_levels: { [model.id]: EXPECTED.effort_id },
    },
  };
  report.migrations = (await db.runMigrations({ transaction: 'all' })).length;
  const browserProfile = await db.transaction(async (manager) => {
    const [group] = await manager.query(
      "INSERT INTO module_groups(key,sort_order) VALUES ('cv_agentic_vm',99) RETURNING id",
    );
    const [module] = await manager.query(
      "INSERT INTO modules(module_group_id,key,link,sort_order) VALUES ($1,'nodia_cv','/nodia-cv',0) RETURNING id",
      [group.id],
    );
    const [catalog] = await manager.query(
      "SELECT id FROM ai_provider_catalog WHERE key='openai' AND is_active AND can_use_agentic",
    );
    check(catalog, 'pilot_catalog_openai_missing');
    await manager.query(
      `INSERT INTO ai_providers(id,catalog_id,name,fields,use_agentic,is_active,default_mode)
       VALUES ($1,$2,'ChatGPT',$3::jsonb,true,true,'agentic')`,
      [EXPECTED.connection_id, catalog.id, JSON.stringify(fields)],
    );
    const admin = await seedActor(manager, PROBE, module.id, true);
    const browser = await seedActor(manager, BROWSER, module.id);
    const adminProfile = await seedProfile(parts, manager, admin, PROBE);
    const browserProfile = await seedProfile(parts, manager, browser, BROWSER);
    await manager.query(`CREATE TABLE ${MARKER} (
      id boolean PRIMARY KEY CHECK(id), request_key uuid NOT NULL, connection_id bigint NOT NULL,
      model_id text NOT NULL, effort_id text NOT NULL, admin_session uuid NOT NULL,
      profile_id uuid NOT NULL, profile_revision integer NOT NULL CHECK(profile_revision>0),
      browser_profile_id uuid NOT NULL
    )`);
    await manager.query(
      `INSERT INTO ${MARKER}(id,request_key,connection_id,model_id,effort_id,admin_session,profile_id,profile_revision,browser_profile_id)
       VALUES (true,$1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        requestKey,
        EXPECTED.connection_id,
        EXPECTED.model_id,
        EXPECTED.effort_id,
        admin.sessionId,
        adminProfile.id,
        adminProfile.revision,
        browserProfile.id,
      ],
    );
    return browserProfile;
  });
  report.status = 'seeded';
  report.browserProfileId = browserProfile.id;
  report.publishedEfforts = model.supportedReasoningEfforts;
}

async function manifest(requestKey) {
  const [row] = await db.query(`SELECT * FROM ${MARKER} WHERE id`);
  check(
    row?.request_key === requestKey &&
      row.connection_id === EXPECTED.connection_id &&
      row.model_id === EXPECTED.model_id &&
      row.effort_id === EXPECTED.effort_id,
    'pilot_manifest_mismatch',
  );
  return row;
}

function actorFor(pilot) {
  return { userId: PROBE.id, sessionId: pilot.admin_session };
}

async function inspect(parts, actor, selection) {
  await parts.scope.transaction((manager) =>
    parts.scope.authorize(manager, actor),
  );
  const observed = await parts.transport.observe(
    selection,
    AbortSignal.timeout(30_000),
  );
  const eligibility = await parts.scope.transaction(async (manager) => {
    await parts.scope.authorize(manager, actor);
    return parts.selections.eligibility(manager, selection, observed);
  });
  return { observed, eligibility };
}

async function ready(parts, pilot) {
  const { observed, eligibility } = await inspect(
    parts,
    actorFor(pilot),
    EXPECTED,
  );
  report.observation = {
    selection: observed.selection.status,
    transport: observed.transport.status,
    reason: observed.transport.reason ?? null,
    eligible: eligibility.eligible,
    gate: eligibility.reason_code,
  };
  check(
    observed.selection.status === 'metadata_ready' &&
      observed.transport.status === 'available' &&
      sameSelection(observed.selection.selection, EXPECTED),
    'exact_host_preflight_not_ready',
  );
  return eligibility;
}

async function existingProbe(pilot) {
  const [found] = await db.query(
    `SELECT count(*)::int AS seen, count(*) FILTER (WHERE request_key=$1 AND owner_user_id=$2)::int AS exact
     FROM nodia_cv_generations WHERE qualification AND selection_snapshot->>'mode'='agentic'`,
    [pilot.request_key, PROBE.id],
  );
  check(
    found.seen === found.exact && found.exact <= 1,
    'unexpected_prior_agentic_probe',
  );
  return found.exact === 1;
}

async function admit(parts, pilot) {
  const actor = actorFor(pilot);
  if (await existingProbe(pilot)) {
    const previous = await parts.command.statusByRequest(
      actor,
      pilot.request_key,
    );
    check(
      sameSelection(previous.selection, EXPECTED) &&
        previous.profile_id === pilot.profile_id,
      'pilot_request_identity_changed',
    );
    report.status = 'existing_probe';
    report.generationId = previous.id;
    report.state = previous.state;
    return;
  }
  const [quiescent] = await db.query(`SELECT NOT EXISTS (
    SELECT 1 FROM ai_generation_operations WHERE acknowledged_at IS NULL
  ) AND NOT EXISTS (SELECT 1 FROM nodia_cv_generations WHERE state IN ('queued','running')) AS safe`);
  check(quiescent.safe, 'pilot_queue_not_quiet');
  const gate = await ready(parts, pilot);
  check(
    !gate.eligible && gate.reason_code === 'qualification_required',
    'initial_selection_already_qualified',
  );
  const started = await parts.command.startProbe(actor, {
    request_key: pilot.request_key,
    profile_id: pilot.profile_id,
    profile_revision: pilot.profile_revision,
    offer_text: CV_PROBE_OFFER,
    language: 'en',
    selection: EXPECTED,
  });
  check(
    sameSelection(started.selection, EXPECTED) &&
      started.profile_id === pilot.profile_id,
    'pilot_request_identity_changed',
  );
  report.status = 'admitted';
  report.generationId = started.id;
  report.state = started.state;
}

async function resultFor(pilot, seconds) {
  const until = Date.now() + seconds * 1000;
  for (;;) {
    const [result] = await db.query(
      `SELECT g.*,o.id AS operation_id,o.phase,o.owner_kind,o.started_exchanges,o.reserved_exchanges,
        o.response_hash,o.request_hash AS execution_hash,o.selection_snapshot AS ledger_selection,
        o.agentic_transport_descriptor,o.cv_agentic_native,o.terminal_proof,o.remote_outcome,
        o.acknowledged_at IS NOT NULL AND o.agentic_acknowledged_at IS NOT NULL AS acked,
        s.state AS slot_state
      FROM nodia_cv_generations g
      LEFT JOIN ai_generation_operations o ON o.cv_generation_id=g.id AND o.actor_id=g.owner_user_id
      LEFT JOIN nodia_ai_runtime_slots s ON s.resource_key=o.resource_key
      WHERE g.qualification AND g.owner_user_id=$1 AND g.request_key=$2`,
      [PROBE.id, pilot.request_key],
    );
    check(result, 'pilot_probe_not_admitted');
    if (
      !['queued', 'running', 'ready'].includes(result.state) ||
      (result.state === 'ready' && result.acked) ||
      Date.now() >= until
    )
      return result;
    await delay(Math.min(500, Math.max(0, until - Date.now())));
  }
}

async function verifyPdf(result) {
  const renderer = new NodiaCvPdfRenderer();
  const pdfs = [];
  const source = {
    language: result.language,
    profile: result.profile_snapshot,
    draft: result.draft,
    review: result.review,
  };
  try {
    for (const template of ['classic', 'compact']) {
      const pdf = await renderer.render(source, template);
      check(
        sha(pdf.bytes) === pdf.sha256 &&
          pdf.page_count > 0 &&
          pdf.extracted_text.includes(CV_PROBE_CANDIDATE) &&
          pdf.extracted_text.includes('TypeScript') &&
          !pdf.extracted_text.includes('Kubernetes'),
        'pilot_pdf_read_verification_failed',
      );
      pdfs.push({
        template,
        sha256: pdf.sha256,
        pages: pdf.page_count,
        verified: true,
      });
    }
    return pdfs;
  } finally {
    await renderer.onModuleDestroy();
  }
}

async function verify(parts, pilot, seconds) {
  check(await existingProbe(pilot), 'pilot_probe_not_admitted');
  const result = await resultFor(pilot, seconds);
  report.generationId = result.id;
  report.state = result.state;
  report.receipt = {
    phase: result.phase ?? null,
    remote: result.remote_outcome ?? null,
    started: result.started_exchanges ?? 0,
    reserved: result.reserved_exchanges ?? 0,
    acked: result.acked ?? false,
    slot: result.slot_state ?? null,
  };
  report.publicErrorCode =
    result.error_code && safeCode({ code: result.error_code });
  if (
    ['queued', 'running'].includes(result.state) ||
    (result.state === 'ready' && !result.acked)
  ) {
    report.status = 'pending';
    return;
  }
  check(
    result.state === 'ready' &&
      result.phase === 'closed' &&
      result.acked &&
      result.slot_state === 'free' &&
      result.owner_kind === 'cv' &&
      result.operation_id === result.id &&
      result.started_exchanges === 1 &&
      result.reserved_exchanges === 1 &&
      result.remote_outcome === 'completed' &&
      sameSelection(result.selection_snapshot, EXPECTED) &&
      sameSelection(result.ledger_selection, EXPECTED) &&
      result.profile_id === pilot.profile_id &&
      result.profile_revision === pilot.profile_revision &&
      result.offer_text === CV_PROBE_OFFER &&
      validCvProbeDraft(result.draft),
    'live_probe_did_not_qualify',
  );
  const descriptor = parseCvAgenticDescriptor(
    result.agentic_transport_descriptor,
  );
  const proof = parseCvAgenticReceipt(result.terminal_proof, descriptor);
  const prepared = prepareCvTailoring({
    profile: result.profile_snapshot,
    offer: result.offer_text,
    locale: result.language,
  });
  check(
    descriptor.generation_id === result.id &&
      descriptor.actor_id === PROBE.id &&
      descriptor.profile_id === pilot.profile_id &&
      descriptor.profile_revision === pilot.profile_revision &&
      descriptor.configuration_generation === result.configuration_generation &&
      descriptor.session_generation === result.session_generation &&
      descriptor.resource_key === result.resource_key &&
      descriptor.payload_hash === cvAgenticPayloadHash(prepared) &&
      result.execution_hash ===
        cvExecutionHash(
          result.request_hash,
          result.scope_hash,
          cvGenerationPrompt(prepared),
        ) &&
      proof.remote_outcome === 'completed' &&
      proof.response_hash === result.response_hash &&
      proof.process_closed,
    'pilot_terminal_identity_mismatch',
  );
  const currentProcess = await codexProcessIdentity(process.pid);
  const custody = result.cv_agentic_native;
  check(
    custody?.native &&
      custody.native.group === custody.native.pid &&
      custody.native.boot === currentProcess.boot,
    'pilot_native_custody_not_current',
  );
  await stopCodexGroup(custody.native, false);
  report.receipt.processClosed = true;
  report.receipt.responseHash = result.response_hash;
  report.receipt.proofId = proof.terminal_proof_id;
  const actor = actorFor(pilot);
  const exact = await ready(parts, pilot);
  const alternate = await inspect(parts, actor, {
    ...EXPECTED,
    effort_id: 'medium',
  });
  check(
    exact.eligible &&
      exact.qualified &&
      exact.reason_code === 'qualified' &&
      !alternate.eligibility.eligible &&
      !alternate.eligibility.qualified &&
      alternate.eligibility.reason_code === 'qualification_required',
    'pilot_qualification_scope_mismatch',
  );
  report.alternateEffort = {
    effort: 'medium',
    eligible: alternate.eligibility.eligible,
    reason: alternate.eligibility.reason_code,
  };
  report.validDraft = true;
  report.requirements = result.draft.requirements.map(({ kind, coverage }) => ({
    kind,
    coverage,
  }));
  report.pdfs = await verifyPdf(result);
  report.status = 'qualified_in_isolated_vm';
}

try {
  const { values } = parseArgs({
    options: {
      action: { type: 'string' },
      connection: { type: 'string' },
      model: { type: 'string' },
      effort: { type: 'string' },
      request: { type: 'string' },
      'wait-seconds': { type: 'string', default: '0' },
    },
  });
  check(
    process.platform === 'linux' && hostname() === 'nodia-vps-lab',
    'vm_required',
  );
  check(
    MODES.includes(values.action) &&
      UUID.test(values.request ?? '') &&
      values.connection === EXPECTED.connection_id &&
      values.model === EXPECTED.model_id &&
      values.effort === EXPECTED.effort_id &&
      /^\d{1,3}$/.test(values['wait-seconds']) &&
      Number(values['wait-seconds']) <= 120,
    'explicit_pilot_selection_and_request_required',
  );
  report.action = values.action;
  report.target = EXPECTED;
  db = pilotSource();
  await db.initialize();
  const [target] = await db.query(`SELECT current_database() AS name,
    to_regclass('public.${MARKER}') IS NOT NULL AS seeded,
    (SELECT count(*)::int FROM pg_tables WHERE schemaname='public') AS tables`);
  check(target.name === PILOT_DATABASE, 'pilot_database_mismatch');
  launcher = db.createQueryRunner();
  const [locked] = await launcher.query(
    'SELECT pg_try_advisory_lock(1894473012,11304) AS acquired',
  );
  check(locked.acquired, 'pilot_operation_busy');
  runtime = new CodexRuntimeService();
  const parts = await compose(db, runtime);
  if (values.action === 'seed') {
    if (target.seeded) {
      report.browserProfileId = (
        await manifest(values.request)
      ).browser_profile_id;
      report.status = 'already_seeded';
    } else {
      if (target.tables > 0) {
        check(
          !(await db.showMigrations()),
          'empty_isolated_pilot_database_required',
        );
        const [empty] = await db.query(
          `SELECT NOT EXISTS (SELECT 1 FROM users) AND
            NOT EXISTS (SELECT 1 FROM ai_providers) AND
            NOT EXISTS (SELECT 1 FROM nodia_cv_generations) AS safe`,
        );
        check(empty.safe, 'empty_isolated_pilot_database_required');
      }
      await seed(parts, values.request);
    }
  } else {
    const pilot = await manifest(values.request);
    if (values.action === 'preflight') {
      await ready(parts, pilot);
      report.status = 'preflight_complete';
    } else if (values.action === 'admit') {
      await admit(parts, pilot);
    } else {
      await verify(parts, pilot, Number(values['wait-seconds']));
    }
  }
} catch (error) {
  report.failure = safeCode(error);
  process.exitCode = 1;
} finally {
  const settled = await Promise.allSettled([
    runtime?.onModuleDestroy(),
    launcher
      ?.query('SELECT pg_advisory_unlock(1894473012,11304)')
      .finally(() => launcher.release()),
  ]);
  if (db?.isInitialized) await db.destroy();
  if (settled.some((result) => result.status === 'rejected')) {
    report.cleanup = 'unverified';
    process.exitCode = 1;
  }
  console.log(JSON.stringify(report));
}
