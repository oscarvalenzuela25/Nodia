// Real durable fences and process ownership with an entirely synthetic transport.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { DataSource } from 'typeorm';
import { FlashcardLibraryRuntimeService } from '../dist/ai-generation/flashcard-library-runtime.service.js';
import { FlashcardLibraryStore } from '../dist/ai-generation/flashcard-library.store.js';
import { GenerationWorkerSourceRegistry } from '../dist/ai-generation/worker-source-registry.js';
import { lockAuthority } from '../dist/authorization/authority-transaction.js';
import { CheckModuleAccessUseCase } from '../dist/authorization/use-case/check-module-access.use-case.js';
import { API_EXECUTOR_OWNER } from '../dist/nodia-ai-adapter/api-nodia-ai-runtime-owner.js';
import { PrepareNodiaAiRestoreUseCase } from '../dist/nodia-ai-recovery/use-case/prepare-nodia-ai-restore.use-case.js';
import { lockNodiaAiQueue } from '../dist/nodia-ai-runtime/queue-lock.js';
import { ValidateNodiaAiRuntimePolicyUseCase } from '../dist/nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case.js';
import { hash } from '../dist/teacher/policies/teacher-validation.js';

const url = new URL(
  process.env.TEACHER_FLASHCARD_GENERATION_TEST_URL ?? 'invalid:',
);
assert.ok(
  url.protocol === 'postgresql:' &&
    url.hostname === '127.0.0.1' &&
    /^\/teacher_flashcard_generation_test_[a-z0-9]+$/.test(url.pathname) &&
    !url.search &&
    !url.hash,
  'Use only an empty disposable local teacher_flashcard_generation_test_* database.',
);
const db = new DataSource({
  type: 'postgres',
  url: url.href,
  synchronize: false,
  migrations: [
    fileURLToPath(new URL('../dist/migrations/*.js', import.meta.url)),
  ],
});

try {
  await db.initialize();
  const [{ tables }] = await db.query(
    "SELECT count(*)::int AS tables FROM pg_tables WHERE schemaname='public'",
  );
  assert.equal(tables, 0, 'The disposable database must be empty.');
  await db.runMigrations({ transaction: 'all' });
  const owner = '9017309254740021';
  const authSession = randomUUID();
  await db.query(
    "INSERT INTO users(id,email,name) VALUES($1,'recovery@example.invalid','Synthetic recovery actor')",
    [owner],
  );
  await db.query(
    "INSERT INTO auth_sessions(public_id,user_id,refresh_token_hash,expires_at) VALUES($1,$2,$3,clock_timestamp()+interval '1 hour')",
    [authSession, owner, hash(authSession)],
  );
  const [{ id: group }] = await db.query(
    "INSERT INTO module_groups(key,sort_order) VALUES('synthetic_library_recovery',99) RETURNING id",
  );
  const [{ id: moduleId }] = await db.query(
    "INSERT INTO modules(module_group_id,key,link,sort_order) VALUES($1,'nodia_teacher','/nodia-teacher',0) RETURNING id",
    [group],
  );
  await db.query(
    'INSERT INTO user_modules(user_id,module_id,is_active) VALUES($1,$2,true)',
    [owner, moduleId],
  );
  const [{ id: connection }] = await db.query(
    "INSERT INTO ai_providers(catalog_id,name,use_api_key) SELECT id,'Synthetic recovery transport',true FROM ai_provider_catalog WHERE key='openai' RETURNING id::text",
  );
  const selection = {
    connection_id: connection,
    mode: 'api_key',
    model_id: 'synthetic-recovery',
    effort_id: null,
  };
  const resourceKey = 'synthetic-flashcard-recovery';
  const configuration = {
    providerKey: 'openai',
    connectionId: connection,
    keyId: null,
    resourceKey,
    configurationGeneration: 'synthetic-configuration',
    sessionGeneration: 'synthetic-session',
  };
  const policyAsset = JSON.parse(
    await readFile(
      new URL(
        '../dist/nodia-ai-runtime/config/runtime-policy.json',
        import.meta.url,
      ),
      'utf-8',
    ),
  );
  const policy = new ValidateNodiaAiRuntimePolicyUseCase().execute(policyAsset);
  // Stop before any retention writes on this copy. The guard runs under the real database transaction.
  const restore = new PrepareNodiaAiRestoreUseCase(db, policy, undefined, {
    execute() {
      throw Error('restore reached manifest validation');
    },
  });
  let transportStep;
  const transport = {
    configure: async () => configuration,
    execute: async (_kind, context) => transportStep(context),
  };
  const store = new FlashcardLibraryStore(transport, policy);
  const runtime = new FlashcardLibraryRuntimeService(
    db,
    new CheckModuleAccessUseCase(db),
    new GenerationWorkerSourceRegistry(),
    transport,
    policy,
  );
  const admit = (input) =>
    db.transaction(async (manager) => {
      await lockAuthority(manager);
      await lockNodiaAiQueue(manager);
      return store.admit(manager, input);
    });
  const slot = async () =>
    (
      await db.query(
        'SELECT state,generation_operation_id FROM nodia_ai_runtime_slots WHERE resource_key=$1',
        [resourceKey],
      )
    )[0];
  const ledger = async (id) =>
    (
      await db.query(
        'SELECT phase,started_exchanges,remote_outcome,terminal_proof FROM ai_generation_operations WHERE id=$1',
        [id],
      )
    )[0];
  const status = (id) => store.byId(db.manager, owner, id);
  const reply = {
    schema_version: 1,
    question: 'A fixture?',
    answer: 'Only a fixture.',
  };
  let sequence = 0;

  async function pauseOperation({
    startsExchange = true,
    hasImage = false,
    expire = true,
    output = reply,
  } = {}) {
    const id = randomUUID();
    const requestKey = randomUUID();
    const textPrompt = 'Synthetic recovery intent ' + ++sequence;
    const input = {
      id,
      owner,
      authSession,
      requestKey,
      requestHash: hash(textPrompt),
      origin: { kind: 'notes' },
      textPrompt,
      textSelection: selection,
      imagePrompt: null,
      imageSelection: hasImage ? selection : null,
    };
    assert.deepEqual(await admit(input), { id });
    await assert.rejects(restore.execute({}), {
      message:
        'nodia_ai:flashcard_library_restore_requires_owner_reconciliation',
    });
    const entered = Promise.withResolvers();
    const release = Promise.withResolvers();
    transportStep = async (context) => {
      try {
        if (startsExchange) await context.beforeExchange();
        entered.resolve(context.operationId);
        await release.promise;
        if (!startsExchange) await context.beforeExchange();
        const response = JSON.stringify(output);
        return {
          text: response,
          responseHash: createHash('sha256').update(response).digest('hex'),
        };
      } catch (error) {
        entered.reject(error);
        throw error;
      }
    };
    const executing = runtime.execute(randomUUID(), AbortSignal.timeout(10000));
    const partId = await Promise.race([
      entered.promise,
      executing.then(() => {
        throw Error('The fixture transport did not start.');
      }),
    ]);
    if (expire) {
      await db.query(
        "UPDATE teacher_flashcard_library_parts SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1",
        [partId],
      );
    }
    return { input, id, partId, release, executing };
  }

  const live = await pauseOperation({ hasImage: true });
  await runtime.recover();
  assert.deepEqual(await slot(), {
    state: 'unknown',
    generation_operation_id: live.partId,
  });
  await assert.rejects(restore.execute({}), {
    message: 'nodia_ai:flashcard_library_restore_requires_owner_reconciliation',
  });
  assert.equal((await ledger(live.partId)).phase, 'transport_open');
  assert.equal(
    (await status(live.id)).text.error_code,
    'local_closure_unproven',
  );
  assert.equal(
    (await status(live.id)).image.error_code,
    'flashcard_proposal_text_dependency_failed',
  );
  await assert.rejects(
    admit({ ...live.input, id: randomUUID(), requestKey: randomUUID() }),
    {
      message: 'teacher:flashcard_proposal_outcome_unknown',
    },
  );
  live.release.reject(new Error('Synthetic timed-out response'));
  assert.ok(await live.executing);
  assert.deepEqual(await slot(), {
    state: 'free',
    generation_operation_id: null,
  });
  assert.equal(
    (await ledger(live.partId)).terminal_proof.closure_basis,
    'same_executor_return',
  );
  assert.equal((await status(live.id)).text.state, 'unknown');

  const dead = await pauseOperation();
  const child = spawn(process.execPath, ['-e', 'process.exit(0)'], {
    windowsHide: true,
  });
  await once(child, 'exit');
  await db.query(
    'UPDATE ai_generation_operations SET api_owner_identity=$2::jsonb WHERE id=$1',
    [
      dead.partId,
      { ...API_EXECUTOR_OWNER, pid: child.pid, instance: randomUUID() },
    ],
  );
  await runtime.recover();
  assert.deepEqual(await slot(), {
    state: 'free',
    generation_operation_id: null,
  });
  assert.equal(
    (await ledger(dead.partId)).terminal_proof.closure_basis,
    'proven_dead_local_owner',
  );
  assert.equal((await ledger(dead.partId)).remote_outcome, 'unknown');
  dead.release.resolve();
  assert.ok(await dead.executing);
  assert.equal((await status(dead.id)).text.state, 'unknown');
  assert.equal((await status(dead.id)).text.value, null);

  const before = await pauseOperation({ startsExchange: false });
  await runtime.recover();
  assert.deepEqual(await slot(), {
    state: 'free',
    generation_operation_id: null,
  });
  const result = await ledger(before.partId);
  assert.equal(result.started_exchanges, 0);
  assert.equal(result.remote_outcome, null);
  assert.equal(result.terminal_proof.closure_basis, 'durable_before_dispatch');
  before.release.resolve();
  assert.ok(await before.executing);
  assert.equal((await ledger(before.partId)).started_exchanges, 0);
  assert.equal(
    (await status(before.id)).text.error_code,
    'worker_lost_before_dispatch',
  );

  const oversize = await pauseOperation({
    expire: false,
    output: {
      schema_version: 1,
      question: 'Q' + '\u0001'.repeat(1999),
      answer: 'A' + '\u0001'.repeat(1999),
    },
  });
  oversize.release.resolve();
  assert.ok(await oversize.executing);
  assert.deepEqual(await slot(), {
    state: 'free',
    generation_operation_id: null,
  });
  assert.equal(
    (await status(oversize.id)).text.error_code,
    'invalid_generated_content',
  );
  assert.equal((await ledger(oversize.partId)).remote_outcome, 'completed');
  await assert.rejects(restore.execute({}), {
    message: 'restore reached manifest validation',
  });
  console.log(
    'Teacher flashcard library recovery passed with live, departed and pre-dispatch executors, and bounded publication.',
  );
} finally {
  if (db.isInitialized) await db.destroy();
}
