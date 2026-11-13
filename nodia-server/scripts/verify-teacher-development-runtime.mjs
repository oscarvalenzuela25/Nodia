// Explicit operator verification against the configured development database.
// Never creates identities, seeds, sessions, credentials, or qualification receipts by hand.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const stages = new Set(['inspect', 'qualify-text', 'qualify-helper', 'run-job', 'complete-text', 'complete-helper']);
export function parseTeacherDevelopmentArgs(argv) {
  const values = new Map();
  for (const item of argv) {
    const match = /^--([a-z-]+)(?:=(.+))?$/.exec(item);
    if (!match || values.has(match[1])) throw Error('invalid_teacher_development_arguments');
    values.set(match[1], match[2] ?? true);
  }
  const stage = values.get('stage');
  if (values.get('development') !== true || !stages.has(stage) ||
      [...values.keys()].some(key => !['development', 'stage', 'session-id', 'actor-id', 'auth-session-id', 'thread-id', 'job-id', 'post-limit'].includes(key)) ||
      !uuid.test(values.get('session-id')) || !uuid.test(values.get('auth-session-id')) ||
      !/^[1-9][0-9]{0,18}$/.test(values.get('actor-id')) || BigInt(values.get('actor-id')) > 9223372036854775807n ||
      !/^(?:[1-9]|1[0-2])$/.test(values.get('post-limit'))) throw Error('invalid_teacher_development_arguments');
  if ((stage === 'qualify-helper') !== values.has('thread-id') ||
      (values.has('thread-id') && !uuid.test(values.get('thread-id')))) throw Error('invalid_teacher_development_arguments');
  const needsJob = ['run-job', 'complete-text', 'complete-helper'].includes(stage);
  if (needsJob !== values.has('job-id') || (needsJob && !uuid.test(values.get('job-id')))) throw Error('invalid_teacher_development_arguments');
  return Object.fromEntries(values);
}

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const folder = new URL('../../.tmp/teacher-development-20261111/', import.meta.url);
const statePath = new URL('runtime.private.json', folder);
const receiptPath = new URL('runtime-receipt.json', folder);
async function durableWrite(path, value) {
  const temporary = new URL(`${path.href}.${process.pid}.new`);
  const handle = await fs.open(temporary, 'wx', 0o600);
  try { await handle.writeFile(JSON.stringify(value, null, 2) + '\n'); await handle.sync(); }
  finally { await handle.close(); }
  await fs.rename(temporary, path);
}
function safeError(error) {
  const message = error?.code ?? error?.message;
  return typeof message === 'string' && /^(?:teacher:|auth:|authorization:|adapter_|invalid_|development_|[A-Z0-9_]+$)[a-zA-Z0-9_:.-]*$/.test(message)
    ? message : 'development_verification_failed';
}
export async function verifyTeacherDevelopment(args) {
  const server = fileURLToPath(new URL('../', import.meta.url));
  assert.equal(execFileSync('git', ['branch', '--show-current'], { cwd: server, encoding: 'utf8' }).trim(), 'development', 'development_branch_required');
  const { config } = await import('dotenv');
  config({ path: new URL('../.env', import.meta.url), quiet: true });
  assert.notEqual(process.env.NODE_ENV, 'production', 'development_environment_required');
  const compiled = path => new URL(`../dist/${path}`, import.meta.url).href;
  const [{ default: db }, { TeacherGenerationRuntimeService }, { ApiTextGenerationService },
    { GenerationWorkerSourceRegistry }, { ApiNodiaAiCredentialsService }, { NodiaAiConnectionsService },
    { CheckModuleAccessUseCase }, { ValidateNodiaAiRuntimePolicyUseCase }, { TeacherService },
    { PublishTeacherUseCase }, { TEACHER_GENERATION_POLICY_HASH }] = await Promise.all([
    'config/data-source.js', 'ai-generation/teacher-generation-runtime.service.js', 'ai-generation/api-text-generation.service.js',
    'ai-generation/worker-source-registry.js', 'nodia-ai-adapter/api-nodia-ai-credentials.service.js',
    'nodia-ai-conversation/nodia-ai-connections.service.js', 'authorization/use-case/check-module-access.use-case.js',
    'nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case.js', 'teacher/teacher.service.js',
    'teacher/use-case/publish-teacher.use-case.js', 'ai-generation/teacher-qualification-policy.js',
  ].map(path => import(compiled(path))));
  // This maintained helper is deliberately limited to the configured local development target.
  assert.ok(['localhost', '127.0.0.1', '::1'].includes(db.options.host), 'development_local_database_required');
  assert.equal(db.options.synchronize, false, 'development_explicit_migrations_required');
  await fs.mkdir(folder, { recursive: true });
  const lockPath = new URL('runtime.lock', folder);
  const lock = await fs.open(lockPath, 'wx', 0o600);
  await lock.writeFile(JSON.stringify({ pid: process.pid, stage: args.stage }));
  await lock.sync();
  const originalFetch = globalThis.fetch;
  let state, runtime, actionKey;
  const controller = new AbortController();
  const abort = () => controller.abort();
  process.once('SIGINT', abort); process.once('SIGTERM', abort);
  const timeout = setTimeout(abort, 350000);
  const actor = { userId: args['actor-id'], sessionId: args['auth-session-id'] };
  const sessionId = args['session-id'];
  const save = () => durableWrite(statePath, state);
  const jobs = async () => db.query(`SELECT j.id,j.session_id,j.purpose,j.state,j.blocks_duplicate,j.dispatches_used,
    j.error_code,j.created_at,o.id AS operation_id,o.phase,o.remote_outcome,o.reserved_exchanges,o.started_exchanges,
    o.acknowledged_at,o.request_hash,o.response_hash,
    o.terminal_proof->>'local_transport_closed' AS local_transport_closed
    FROM teacher_generation_jobs j LEFT JOIN LATERAL(SELECT * FROM ai_generation_operations
      WHERE teacher_job_id=j.id ORDER BY created_at DESC LIMIT 1)o ON true
    WHERE j.session_id=$1 AND j.actor_id=$2 ORDER BY j.created_at,j.id`, [sessionId, actor.userId]);
  try {
    await db.initialize();
    const access = new CheckModuleAccessUseCase(db);
    const store = new TeacherService(db, access);
    const session = await store.scope(actor, sessionId, async scope => {
      assert.ok(scope.session && scope.session.owner_user_id === actor.userId, 'development_owned_session_required');
      return scope.session;
    });
    const selection = session.selection;
    assert.equal(selection.mode, 'api_key', 'development_api_key_scope_required');
    const credentials = new ApiNodiaAiCredentialsService(db);
    const current = await credentials.configuration(selection);
    const policy = new ValidateNodiaAiRuntimePolicyUseCase().execute(JSON.parse(await fs.readFile(new URL('../dist/nodia-ai-runtime/config/runtime-policy.json', import.meta.url), 'utf8')));
    runtime = new TeacherGenerationRuntimeService(db, access, credentials, new NodiaAiConnectionsService(db),
      new GenerationWorkerSourceRegistry(), new ApiTextGenerationService(credentials, policy), policy);
    runtime.onModuleInit();
    const publisher = new PublishTeacherUseCase();
    runtime.setPublisher(publisher.publish.bind(publisher));
    const identity = {
      database_fingerprint: digest({ host: db.options.host, port: db.options.port, database: db.options.database, username: db.options.username }),
      actor_id: actor.userId, auth_session_id: actor.sessionId, selection,
      configuration_generation: current.configurationGeneration, session_generation: current.sessionGeneration,
      policy_hash: TEACHER_GENERATION_POLICY_HASH,
    };
    try { state = JSON.parse(await fs.readFile(statePath, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (state) {
      assert.deepEqual(state.identity, identity, 'development_identity_changed');
      assert.equal(state.post_limit, Number(args['post-limit']), 'development_budget_changed');
    } else {
      state = { schema_version: 1, created_at: new Date().toISOString(), identity,
        post_limit: Number(args['post-limit']), posts_reserved: 0, posts: [], actions: {} };
      if (args.stage !== 'inspect') await save();
    }
    const exportReceipt = async () => {
      const receipt = { schema_version: 1, observed_at: new Date().toISOString(), scope: 'configured_development_database',
        identity, post_limit: state.post_limit, posts_reserved: state.posts_reserved, posts: state.posts,
        actions: state.actions, session_id: sessionId, jobs: await jobs(),
        limits: ['operator qualification is not a Google login or UI walkthrough', 'no qualification transferred from laboratory',
          'only the recorded API selection, policy, configuration, session generation and purposes are in scope'] };
      await durableWrite(receiptPath, receipt);
      return receipt;
    };
    if (args.stage === 'inspect') {
      const receipt = await exportReceipt();
      console.log(JSON.stringify(receipt));
      return;
    }
    actionKey = [args.stage, sessionId, args['thread-id'] ?? args['job-id'] ?? ''].join(':');
    assert.ok(!state.actions[actionKey], 'development_action_already_started_no_replay');
    const before = await jobs();
    const isCompletion = args.stage.startsWith('complete-');
    if (!isCompletion) {
      assert.ok(!before.some(job => ['running', 'unknown'].includes(job.state)), 'development_original_outcome_requires_inspection');
      if (args.stage === 'run-job') {
        const job = before.find(row => row.id === args['job-id']);
        assert.ok(job?.state === 'queued' && job.dispatches_used === 0, 'development_fresh_queued_job_required');
        const [attempts] = await db.query('SELECT count(*)::integer AS n FROM teacher_generation_attempts WHERE job_id=$1', [job.id]);
        assert.equal(attempts.n, 0, 'development_attempt_already_exists_no_replay');
        const [persisted] = await db.query('SELECT selection_snapshot,configuration_generation,session_generation FROM teacher_generation_jobs WHERE id=$1', [job.id]);
        assert.deepEqual(persisted.selection_snapshot, selection, 'development_job_selection_changed');
        assert.equal(persisted.configuration_generation, current.configurationGeneration, 'development_job_configuration_changed');
        assert.equal(persisted.session_generation, current.sessionGeneration, 'development_job_session_generation_changed');
      }
      assert.ok(state.posts_reserved < state.post_limit, 'development_post_budget_exhausted');
    } else {
      assert.ok(before.some(job => job.id === args['job-id']), 'development_original_job_required');
    }
    state.actions[actionKey] = { started_at: new Date().toISOString(), stage: args.stage, session_id: sessionId,
      job_id: args['job-id'] ?? null, thread_id: args['thread-id'] ?? null, status: 'started' };
    await save();
    globalThis.fetch = async (url, init) => {
      assert.ok(!isCompletion, 'development_completion_must_not_dispatch');
      assert.equal(init?.method?.toUpperCase(), 'POST', 'development_unexpected_network_request');
      const observed = await credentials.configuration(selection);
      assert.equal(observed.configurationGeneration, current.configurationGeneration, 'development_configuration_changed_before_post');
      assert.equal(observed.sessionGeneration, current.sessionGeneration, 'development_epoch_changed_before_post');
      assert.ok(state.posts_reserved < state.post_limit, 'development_post_budget_exhausted');
      const post = { number: ++state.posts_reserved, action: actionKey, reserved_at: new Date().toISOString(),
        request_body_hash: createHash('sha256').update(typeof init.body === 'string' ? init.body : '').digest('hex'),
        http_status: null, transport_response_observed: false };
      state.posts.push(post);
      await save(); // Durable campaign reservation precedes transmission; runtime ledger also reserves before POST.
      const response = await originalFetch(url, init);
      post.http_status = response.status; post.transport_response_observed = true;
      await save();
      return response;
    };
    let result;
    if (args.stage === 'qualify-text') result = await runtime.qualifyText(actor, sessionId, selection, controller.signal);
    else if (args.stage === 'qualify-helper') result = await runtime.qualifyContextualReply(actor, sessionId, selection, args['thread-id'], controller.signal);
    else if (args.stage === 'complete-text') result = await runtime.completeTextQualification(actor, sessionId, args['job-id'], controller.signal);
    else if (args.stage === 'complete-helper') result = await runtime.completeContextualQualification(actor, sessionId, args['job-id'], controller.signal);
    else {
      // Existing runtime claims only this explicit fresh job, rather than polling unrelated queues.
      await runtime.run(randomUUID(), controller.signal, args['job-id']);
      const job = (await jobs()).find(row => row.id === args['job-id']);
      assert.ok(job?.state === 'ready' && job.phase === 'closed' && job.remote_outcome === 'completed' && job.acknowledged_at,
        'development_job_not_conclusively_completed');
      result = { job_id: job.id, operation_id: job.operation_id, purpose: job.purpose,
        local_closed: job.local_transport_closed === 'true', remote_outcome: job.remote_outcome };
    }
    if (args.stage.startsWith('qualify-') || isCompletion) assert.equal(result.qualified_current_policy, true, 'development_current_policy_not_qualified');
    state.actions[actionKey].status = 'completed';
    state.actions[actionKey].result = result;
    state.actions[actionKey].finished_at = new Date().toISOString();
    await save();
    await exportReceipt();
    console.log(JSON.stringify({ stage: args.stage, session_id: sessionId, result,
      posts_reserved: state.posts_reserved, post_limit: state.post_limit, receipt: fileURLToPath(receiptPath) }));
  } catch (error) {
    if (state && actionKey && state.actions[actionKey]?.status === 'started') {
      state.actions[actionKey].status = 'requires_inspection';
      state.actions[actionKey].error_code = safeError(error);
      await save();
    }
    throw error;
  } finally {
    globalThis.fetch = originalFetch;
    clearTimeout(timeout); process.off('SIGINT', abort); process.off('SIGTERM', abort);
    if (db.isInitialized) await db.destroy();
    await lock.close(); await fs.unlink(lockPath);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await verifyTeacherDevelopment(parseTeacherDevelopmentArgs(process.argv.slice(2))); }
  catch (error) { console.error(JSON.stringify({ error_code: safeError(error), no_replay: true })); process.exitCode = 1; }
}
