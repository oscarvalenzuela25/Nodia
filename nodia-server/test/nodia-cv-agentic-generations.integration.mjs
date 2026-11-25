import 'reflect-metadata';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { PassThrough, Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { DataSource } from 'typeorm';
import {
  agenticHash,
  agenticTextHash,
} from '../dist/ai-generation/agentic-text-contract.js';
import { GenerationWorkerSourceRegistry } from '../dist/ai-generation/worker-source-registry.js';
import { CheckModuleAccessUseCase } from '../dist/authorization/use-case/check-module-access.use-case.js';
import { PrepareNodiaAiRestoreUseCase } from '../dist/nodia-ai-recovery/use-case/prepare-nodia-ai-restore.use-case.js';
import { ApiNodiaAiCredentialsService } from '../dist/nodia-ai-adapter/api-nodia-ai-credentials.service.js';
import { NodiaAiConnectionsService } from '../dist/nodia-ai-conversation/nodia-ai-connections.service.js';
import { ValidateNodiaAiRuntimePolicyUseCase } from '../dist/nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case.js';
import { CODEX_CV_HOST_CAPABILITIES } from '../dist/nodia-cv/agentic/nodia-cv-codex-host.js';
import { NodiaCvCodexSelection } from '../dist/nodia-cv/agentic/nodia-cv-codex-selection.js';
import { NodiaCvCodexTransport } from '../dist/nodia-cv/agentic/nodia-cv-codex-transport.js';
import { prepareCvTailoring } from '../dist/nodia-cv/engine/index.js';
import { NodiaCvGenerationScope } from '../dist/nodia-cv/nodia-cv-generation-scope.service.js';
import { NodiaCvGenerationStore } from '../dist/nodia-cv/nodia-cv-generation.store.js';
import { NodiaCvGenerationWorker } from '../dist/nodia-cv/nodia-cv-generation.worker.js';
import { NodiaCvProfilesService } from '../dist/nodia-cv/nodia-cv-profiles.service.js';
import { NodiaCvSelectionService } from '../dist/nodia-cv/nodia-cv-selection.service.js';
import {
  CV_PROBE_CANDIDATE,
  CV_PROBE_OFFER,
} from '../dist/nodia-cv/policies/nodia-cv-generation.js';
import { NodiaCvGenerationsUseCase } from '../dist/nodia-cv/use-case/nodia-cv-generations.use-case.js';
import { NodiaCvProfilesUseCase } from '../dist/nodia-cv/use-case/nodia-cv-profiles.use-case.js';

const url = new URL(process.env.NODIA_CV_TEST_DATABASE_URL ?? 'invalid:');
assert.ok(
  url.protocol === 'postgresql:' &&
    url.hostname === '127.0.0.1' &&
    /^\/nodia_cv_test_[a-z0-9_]+$/.test(url.pathname) &&
    !url.search &&
    !url.hash,
  'Use an empty disposable loopback PostgreSQL database named nodia_cv_test_*.',
);

const glob = (relative) => fileURLToPath(new URL(relative, import.meta.url));
const dataSource = (connection) =>
  new DataSource({
    type: 'postgres',
    url: connection.href,
    synchronize: false,
    entities: [glob('../dist/**/*.entity.js')],
    migrations: [glob('../dist/migrations/*.js')],
  });
const db = dataSource(url);
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
const temporary = resolve(tmpdir());
const root = await mkdtemp(join(temporary, 'nodia-cv-step3-fixture-'));
assert.equal(dirname(root), temporary);

const model = 'gpt-6.2-sol';
const effort = 'high';
const nativeIdentity = {
  pid: 402,
  group: 402,
  birth: '102',
  boot: randomUUID(),
};
const originalOwner = { ...nativeIdentity, pid: 503, group: 503, birth: '103' };
const resourceKey = 'codex-profile:' + 'a'.repeat(64);
let generation = 'b'.repeat(32);
let workerEpoch = originalOwner;
let behavior = 'complete';
let closureVerifiable = true;
let failNextAck = false;
let nativeFailure;
let sends = 0;
let observations = 0;
let currentAttempt;
let setup;
let connection;
let admin;
let owner;
let moduleId;

const connections = new NodiaAiConnectionsService(db);
const access = new CheckModuleAccessUseCase(db);
const profiles = new NodiaCvProfilesService();
const scope = new NodiaCvGenerationScope(db, access);
const api = {
  measure() {
    throw Error('Unexpected API key path');
  },
  execute() {
    throw Error('Unexpected API key path');
  },
};
const profile = {
  profile_name: 'Synthetic CV',
  full_name: CV_PROBE_CANDIDATE,
  main_stack: ['TypeScript'],
  contact: { email: 'private-fixture@example.invalid' },
};

async function user(userId, adminRole = false) {
  const sessionId = randomUUID();
  await db.query("INSERT INTO users(id,email,name) VALUES($1,$2,'Synthetic')", [
    userId,
    `cv-${userId}@example.invalid`,
  ]);
  await db.query(
    `INSERT INTO auth_sessions(public_id,user_id,refresh_token_hash,expires_at)
    VALUES($1,$2,$3,now()+interval '1 hour')`,
    [sessionId, userId, createHash('sha256').update(sessionId).digest('hex')],
  );
  if (adminRole)
    await db.query(
      `INSERT INTO user_roles(user_id,role_id,is_active)
    SELECT $1,id,true FROM roles WHERE key='super_admin'`,
      [userId],
    );
  return { userId, sessionId };
}

async function operation(id) {
  const [row] = await db.query(
    `SELECT o.*,s.state AS slot_state
    FROM ai_generation_operations o
    LEFT JOIN nodia_ai_runtime_slots s ON s.resource_key=o.resource_key
    WHERE o.id=$1`,
    [id],
  );
  return row;
}

const lock = () => join(root, connection.id, 'nodia.lock');
const workspace = () => join(root, 'teacher-work-Ab12Cd');
const retireFixtureLease = async () => {
  await rm(lock(), { force: true });
  await rm(workspace(), { recursive: true, force: true });
};
const line = (value) => JSON.stringify(value) + '\n';

class FixtureStore extends NodiaCvGenerationStore {
  async agenticAcknowledge(manager, op, receipt) {
    if (failNextAck) {
      failNextAck = false;
      throw new Error('synthetic loss before SQL ACK');
    }
    return super.agenticAcknowledge(manager, op, receipt);
  }
}

class FixtureHost extends EventEmitter {
  pid = nativeIdentity.pid;
  stdout = new PassThrough();
  stderr = new PassThrough();
  stdin = new Writable({
    write: (bytes, _encoding, done) => {
      void this.respond(JSON.parse(String(bytes))).then(
        () => done(),
        (error) => {
          nativeFailure = error;
          done();
          this.finish(1);
        },
      );
    },
  });

  finish(code) {
    this.stdout.end();
    this.stderr.end();
    this.emit('close', code);
  }

  async respond({ prompt, ...request }) {
    sends++;
    const op = await operation(currentAttempt.id);
    assert.equal(op.phase, 'transport_open');
    assert.equal(op.slot_state, 'held');
    assert.equal(op.started_exchanges, 1);
    assert.equal(
      op.agentic_transport_descriptor.attempt_id,
      request.operation_id,
    );
    assert.deepEqual(op.cv_agentic_native.native, nativeIdentity);
    assert.equal(request.model_id, model);
    assert.equal(request.effort_id, effort);
    assert.ok(!prompt.includes(profile.contact.email));
    if (behavior === 'no-terminal') {
      this.finish(1);
      return;
    }
    if (behavior === 'revoke')
      await db.query(
        'UPDATE user_modules SET is_active=false WHERE user_id=$1 AND module_id=$2',
        [owner.userId, moduleId],
      );
    const nonce = randomUUID();
    const policyHash = CODEX_CV_HOST_CAPABILITIES.policy_hash;
    const binding = agenticHash({
      ...request,
      prompt_hash: agenticTextHash(prompt),
      policy_hash: policyHash,
      source_commit: CODEX_CV_HOST_CAPABILITIES.source_commit,
    });
    const text = JSON.stringify(setup.answer);
    this.stdout.write(
      line({
        event: 'started',
        operation_id: request.operation_id,
        binding_hash: binding,
        policy_hash: policyHash,
        proof_nonce: nonce,
      }),
    );
    this.stdout.write(
      line({
        event: 'terminal',
        status: 'completed',
        binding_hash: binding,
        proof_nonce: nonce,
        text,
        text_hash: agenticTextHash(text),
        local_closed: true,
        remote_outcome: 'completed',
      }),
    );
    this.finish(0);
  }
}

function worker() {
  const store = new FixtureStore();
  const journal = {
    root: async () => join(root, 'chat-jobs'),
    identity: async () => ({ resourceKey, runtimeSessionId: generation }),
  };
  const runtime = {
    releaseIdle: async () => {},
    recoverClosedProfile: async (id, savedOwner, savedNative) => {
      assert.equal(id, connection.id);
      assert.deepEqual(savedOwner, originalOwner);
      assert.deepEqual(savedNative, nativeIdentity);
      await retireFixtureLease();
    },
  };
  const metadata = {
    observe: async () => {
      observations++;
      return {
        ...(await journal.identity()),
        session: {
          available: true,
          authenticated: true,
          checkedAt: new Date().toISOString(),
        },
        models: [{ id: model, supportedReasoningEfforts: [effort] }],
      };
    },
  };
  const selection = new NodiaCvCodexSelection(connections, metadata);
  const codex = new NodiaCvCodexTransport(selection, runtime, journal, {
    metadata: async () => ({
      path: '/synthetic/native-fixture',
      sha512: 'a'.repeat(128),
      runtimeHash: 'b'.repeat(64),
      capabilities: CODEX_CV_HOST_CAPABILITIES,
      modelMetadata: '{"synthetic":true}',
    }),
    acquire: async () => {
      await writeFile(lock(), 'synthetic-profile-custody', { flag: 'wx' });
      await mkdir(workspace());
      return {
        profilePath: dirname(lock()),
        cwd: workspace(),
        bindRuntime: async () => {},
        release: retireFixtureLease,
      };
    },
    identity: async (pid) => {
      if (pid === process.pid) return workerEpoch;
      if (behavior === 'revoke-before-arm')
        await db.query(
          'UPDATE user_modules SET is_active=false WHERE user_id=$1 AND module_id=$2',
          [owner.userId, moduleId],
        );
      return nativeIdentity;
    },
    spawn: () => new FixtureHost(),
    stop: async (identity) => {
      assert.deepEqual(identity, nativeIdentity);
      if (!closureVerifiable) throw Error('synthetic process closure unproven');
    },
    same: async (identity) => identity.pid === workerEpoch.pid,
    assertEmpty: async () => {
      throw Error('missing fixture process identity');
    },
  });
  const selections = new NodiaCvSelectionService(
    new ApiNodiaAiCredentialsService(db),
    connections,
    policy,
    codex,
    selection,
  );
  const generations = new NodiaCvGenerationsUseCase(
    scope,
    store,
    profiles,
    selections,
    api,
    policy,
  );
  const registry = new GenerationWorkerSourceRegistry();
  new NodiaCvGenerationWorker(
    scope,
    store,
    profiles,
    selections,
    api,
    registry,
    policy,
    codex,
  ).onModuleInit();
  return {
    generations,
    profiles: new NodiaCvProfilesUseCase(db, access, profiles, store),
    run: () => registry.execute(randomUUID(), new AbortController().signal),
    recover: () => registry.recover(),
  };
}

async function checkRestoreQuarantine(id, expectedTerminal) {
  const original = url.pathname.slice(1);
  const clone =
    'nodia_cv_test_copy_' + randomUUID().replaceAll('-', '').slice(0, 12);
  const maintenanceUrl = new URL(url);
  maintenanceUrl.pathname = '/postgres';
  const maintenance = dataSource(maintenanceUrl);
  const cloneUrl = new URL(url);
  cloneUrl.pathname = '/' + clone;
  const copy = dataSource(cloneUrl);
  await db.destroy();
  await maintenance.initialize();
  try {
    // Both identifiers come from the strict disposable URL and generated fixture name.
    await maintenance.query(
      `CREATE DATABASE "${clone}" TEMPLATE "${original}"`,
    );
    await copy.initialize();
    const restore = new PrepareNodiaAiRestoreUseCase(copy, policy, {}, {});
    await assert.rejects(
      restore.execute({}),
      /nodia_ai:cv_restore_requires_owner_reconciliation/,
    );
    const [preserved] = await copy.query(
      'SELECT terminal_proof,started_exchanges,acknowledged_at FROM ai_generation_operations WHERE id=$1',
      [id],
    );
    assert.deepEqual(preserved.terminal_proof, expectedTerminal);
    assert.equal(preserved.started_exchanges, 1);
    assert.equal(preserved.acknowledged_at, null);
  } finally {
    if (copy.isInitialized) await copy.destroy();
    await maintenance.query(`DROP DATABASE IF EXISTS "${clone}"`);
    await maintenance.destroy();
    await db.initialize();
  }
}

const makeInput = (candidate, selection) => ({
  request_key: randomUUID(),
  profile_id: candidate.id,
  profile_revision: candidate.revision,
  language: 'en',
  offer_text: CV_PROBE_OFFER,
  selection,
});

try {
  await db.initialize();
  const [empty] = await db.query(
    "SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='public'",
  );
  assert.equal(empty.n, 0);
  await db.runMigrations({ transaction: 'all' });
  admin = await user('9007199254740931', true);
  owner = await user('9007199254740932');
  const [group] = await db.query(
    "INSERT INTO module_groups(key,sort_order) VALUES('cv_agentic_test',99) RETURNING id",
  );
  const [module] = await db.query(
    "INSERT INTO modules(module_group_id,key,link,sort_order) VALUES($1,'cv_test','/nodia-cv',0) RETURNING id",
    [group.id],
  );
  moduleId = module.id;
  await db.query(
    'INSERT INTO user_modules(user_id,module_id,is_active) VALUES($1,$2,true)',
    [owner.userId, moduleId],
  );
  await db.query(
    "UPDATE ai_provider_catalog SET can_use_agentic=true,is_active=true WHERE key='openai'",
  );
  const [catalog] = await db.query(
    "SELECT id FROM ai_provider_catalog WHERE key='openai'",
  );
  [connection] = await db.query(
    `INSERT INTO ai_providers(catalog_id,name,fields,use_agentic,is_active)
    VALUES($1,'Synthetic Agentic',$2::jsonb,true,true) RETURNING id::text`,
    [catalog.id, JSON.stringify({ agentic: { allowed_model_ids: [model] } })],
  );
  await mkdir(join(root, connection.id));
  const selection = {
    connection_id: connection.id,
    mode: 'agentic',
    model_id: model,
    effort_id: effort,
  };
  setup = worker();
  const adminCv = await setup.profiles.create(admin, {
    request_key: randomUUID(),
    profile,
  });
  const ownerCv = await setup.profiles.create(owner, {
    request_key: randomUUID(),
    profile: { ...profile, full_name: 'Fixture Developer' },
  });
  const fact = prepareCvTailoring({
    profile: adminCv,
    offer: CV_PROBE_OFFER,
    locale: 'en',
  }).evidence.find((item) => item.text === 'TypeScript').id;
  const answer = {
    selectedEvidenceIds: [fact],
    requirements: [
      {
        quote: 'TypeScript',
        kind: 'required',
        relation: 'direct',
        evidenceIds: [fact],
      },
      {
        quote: 'Kubernetes',
        kind: 'preferred',
        relation: 'absent',
        evidenceIds: [],
      },
    ],
  };
  setup.answer = answer;

  const ordinary = makeInput(ownerCv, selection);
  await assert.rejects(setup.generations.start(owner, ordinary), {
    status: 409,
    message: /generation_selection_unqualified/,
  });
  await assert.rejects(setup.generations.startProbe(owner, ordinary), {
    status: 403,
    message: /generation_probe_forbidden/,
  });

  const probe = makeInput(adminCv, selection);
  const sameProbe = await Promise.all([
    setup.generations.startProbe(admin, probe),
    setup.generations.startProbe(admin, probe),
  ]);
  assert.equal(sameProbe[0].id, sameProbe[1].id);
  currentAttempt = sameProbe[0];
  const reads = observations;
  assert.equal(
    (await setup.generations.startProbe(admin, probe)).id,
    currentAttempt.id,
  );
  assert.equal(observations, reads);
  failNextAck = true;
  await Promise.all([setup.run(), setup.run()]);
  assert.equal(nativeFailure, undefined);
  assert.equal(sends, 1);
  const pending = await operation(currentAttempt.id);
  assert.equal(pending.phase, 'closed');
  assert.equal(pending.remote_outcome, 'completed');
  assert.equal(pending.terminal_proof.process_closed, true);
  assert.equal(pending.acknowledged_at, null);
  assert.equal(pending.slot_state, 'held');
  await assert.rejects(
    db.query(
      `UPDATE ai_generation_operations SET terminal_proof =
      jsonb_set(terminal_proof,'{actor_id}','"333"'::jsonb) WHERE id=$1`,
      [currentAttempt.id],
    ),
    { code: '23514' },
  );
  assert.equal(
    (await setup.generations.eligibility(owner, selection)).qualified,
    false,
  );

  await checkRestoreQuarantine(currentAttempt.id, pending.terminal_proof);
  const restarted = worker();
  await restarted.recover();
  const acknowledged = await operation(currentAttempt.id);
  assert.deepEqual(acknowledged.terminal_proof, pending.terminal_proof);
  assert.ok(acknowledged.agentic_acknowledged_at);
  assert.equal(acknowledged.slot_state, 'free');
  assert.equal(sends, 1);
  assert.equal(await restarted.run(), false);
  assert.equal(
    (await restarted.generations.eligibility(owner, selection)).qualified,
    true,
  );
  assert.deepEqual(
    (
      await restarted.generations.status(admin, currentAttempt.id)
    ).draft.requirements.map((row) => row.coverage),
    ['supported', 'gap'],
  );
  generation = 'c'.repeat(32);
  assert.equal(
    (await restarted.generations.eligibility(owner, selection)).qualified,
    false,
  );
  generation = 'b'.repeat(32);

  behavior = 'no-terminal';
  closureVerifiable = false;
  currentAttempt = await restarted.generations.start(owner, ordinary);
  await restarted.run();
  assert.equal(nativeFailure, undefined);
  assert.equal(sends, 2);
  assert.equal((await operation(currentAttempt.id)).started_exchanges, 1);
  await db.query(
    "UPDATE nodia_cv_generations SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1",
    [currentAttempt.id],
  );
  workerEpoch = { ...originalOwner, pid: 604, group: 604, birth: '104' };
  const afterCrash = worker();
  await afterCrash.recover();
  const unresolved = await operation(currentAttempt.id);
  assert.equal(unresolved.slot_state, 'unknown');
  assert.equal(unresolved.terminal_proof, null);
  assert.equal(unresolved.acknowledged_at, null);
  closureVerifiable = true;
  await afterCrash.recover();
  const reconciled = await operation(currentAttempt.id);
  assert.equal(reconciled.remote_outcome, 'unknown');
  assert.equal(reconciled.terminal_proof.process_closed, true);
  assert.ok(reconciled.acknowledged_at);
  assert.equal(reconciled.slot_state, 'free');
  assert.equal(await afterCrash.run(), false);
  assert.equal(sends, 2);
  assert.equal(
    (await afterCrash.generations.statusByRequest(owner, ordinary.request_key))
      .state,
    'unknown',
  );

  behavior = 'revoke-before-arm';
  currentAttempt = await afterCrash.generations.start(
    owner,
    makeInput(ownerCv, selection),
  );
  failNextAck = true;
  await afterCrash.run();
  const unsent = await operation(currentAttempt.id);
  assert.equal(sends, 2);
  assert.equal(unsent.started_exchanges, 0);
  assert.equal(unsent.terminal_proof.remote_outcome, 'not_dispatched');
  assert.deepEqual(unsent.cv_agentic_native.native, nativeIdentity);
  assert.equal(unsent.acknowledged_at, null);
  await worker().recover();
  assert.equal((await operation(currentAttempt.id)).slot_state, 'free');
  await db.query(
    'UPDATE user_modules SET is_active=true WHERE user_id=$1 AND module_id=$2',
    [owner.userId, moduleId],
  );

  // A valid result cannot publish after revocation during the native exchange.
  behavior = 'revoke';
  currentAttempt = await afterCrash.generations.start(
    owner,
    makeInput(ownerCv, selection),
  );
  await afterCrash.run();
  assert.equal(nativeFailure, undefined);
  assert.equal(sends, 3);
  const [failed] = await db.query(
    'SELECT state,error_code,draft FROM nodia_cv_generations WHERE id=$1',
    [currentAttempt.id],
  );
  assert.deepEqual(failed, {
    state: 'failed',
    error_code: 'authority_changed',
    draft: null,
  });
  assert.equal((await operation(currentAttempt.id)).slot_state, 'free');
  assert.equal(await afterCrash.run(), false);
  console.log(
    'CV Agentic: PostgreSQL exact admission, one exchange, probe ACK, restore quarantine, restart recovery, no replay, and revocation passed.',
  );
} finally {
  if (db.isInitialized) await db.destroy();
  await rm(root, { recursive: true, force: true });
}
