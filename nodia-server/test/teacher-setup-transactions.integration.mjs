// Synthetic local PostgreSQL only. Actual migration, authority, transactions, CAS and admission.
// The optional release root must be an isolated compilation; no application env/auth/provider is loaded.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';

const root = resolve(process.env.TEACHER_TEST_RELEASE_ROOT ?? fileURLToPath(new URL('..', import.meta.url)));
const load = (name) => import(pathToFileURL(resolve(root, 'dist', `${name}.js`)));
const { CreateTeacherDomain1793570000000 } = await load('migrations/1793570000000-CreateTeacherDomain');
const { PreserveTeacherArchivedPauseState1793590000000 } = await load('migrations/1793590000000-PreserveTeacherArchivedPauseState');
const { PersistTeacherSetupDraft1793610000000 } = await load('migrations/1793610000000-PersistTeacherSetupDraft');
const { TeacherService } = await load('teacher/teacher.service');
const { CheckModuleAccessUseCase } = await load('authorization/use-case/check-module-access.use-case');
const { ExecuteTeacherCommandUseCase } = await load('teacher/use-case/execute-teacher-command.use-case');
const { ReadTeacherUseCase } = await load('teacher/use-case/read-teacher.use-case');
const { PublishTeacherUseCase } = await load('teacher/use-case/publish-teacher.use-case');
const { defaultPolicy } = await load('teacher/policies/teacher-validation');

const container = `teacher_setup_${process.pid}_${randomBytes(4).toString('hex')}`;
const password = randomBytes(24).toString('hex');
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const actor = { userId: '9007199254740993', sessionId: randomUUID() };
const other = { userId: '2', sessionId: randomUUID() };
const selected = { connection_id: '2', mode: 'agentic', model_id: 'synthetic-model', effort_id: 'synthetic-effort' };
const create = { topic: 'Synthetic networks', objective: 'Understand a synthetic concept', explanation_language: 'es' };
const checks = [];
const check = async (name, work) => { await work(); checks.push(name); };
let db, started = false;
let verifyFailure = false, verificationCalls = 0, generationCalls = 0;
const port = {
  async verifySelection() {
    verificationCalls++;
    if (verifyFailure) throw Error('synthetic_unqualified');
    return { configuration_generation: 'synthetic-config', session_generation: null };
  },
  async run() { generationCalls++; throw Error('generation_forbidden_in_test'); },
};
try {
  docker('run', '--pull=never', '--detach', '--rm', '--name', container, '--publish', '127.0.0.1::5432',
    '--env', 'POSTGRES_DB=teacher_test', '--env', 'POSTGRES_USER=teacher_test', '--env', `POSTGRES_PASSWORD=${password}`, 'postgres:16-alpine');
  started = true;
  for (let i = 0; ; i++) {
    try { docker('exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'teacher_test'); break; }
    catch (error) { if (i >= 40) throw error; await delay(200); }
  }
  const mapped = Number(docker('port', container, '5432/tcp').split(':').at(-1));
  db = new DataSource({ type: 'postgres', host: '127.0.0.1', port: mapped, username: 'teacher_test', password, database: 'teacher_test', synchronize: false, logging: false });
  await db.initialize();
  await db.query(`CREATE TABLE users(id bigint PRIMARY KEY,is_active boolean NOT NULL DEFAULT true);
CREATE TABLE auth_sessions(public_id uuid PRIMARY KEY,user_id bigint NOT NULL,revoked_at timestamptz,expires_at timestamptz NOT NULL);
CREATE TABLE roles(id bigint PRIMARY KEY,key text,is_active boolean NOT NULL DEFAULT true);
CREATE TABLE user_roles(user_id bigint,role_id bigint,is_active boolean NOT NULL DEFAULT true);
CREATE TABLE actions(id bigint PRIMARY KEY);CREATE TABLE role_actions(id bigint PRIMARY KEY);
CREATE TABLE module_groups(id bigint PRIMARY KEY,is_active boolean NOT NULL DEFAULT true,name text);
CREATE TABLE modules(id bigint PRIMARY KEY,key text,link text,module_group_id bigint,is_active boolean NOT NULL DEFAULT true);
CREATE TABLE user_modules(user_id bigint,module_id bigint,is_active boolean NOT NULL DEFAULT true);
INSERT INTO users(id) VALUES(${actor.userId}),(2);INSERT INTO module_groups(id,name) VALUES(1,'Studies');
INSERT INTO modules(id,key,link,module_group_id) VALUES(1,'nodia_teacher','/nodia-teacher',1);
INSERT INTO user_modules(user_id,module_id) VALUES(${actor.userId},1),(2,1);`);
  for (const ref of [actor, other]) await db.query("INSERT INTO auth_sessions(public_id,user_id,expires_at) VALUES($1,$2,clock_timestamp()+interval '1 day')", [ref.sessionId, ref.userId]);
  const runner = db.createQueryRunner(); await runner.connect();
  await new CreateTeacherDomain1793570000000().up(runner);
  await new PreserveTeacherArchivedPauseState1793590000000().up(runner);
  const migration = new PersistTeacherSetupDraft1793610000000();
  await check('additive draft migration up/down/up and existing row defaults', async () => {
    const id = randomUUID();
    await db.query("INSERT INTO teacher_sessions(id,owner_user_id,topic,objective,explanation_language,created_by_actor_id) VALUES($1,$2,'Existing','Existing','es',$2)", [id, actor.userId]);
    await migration.up(runner);
    const [row] = await db.query('SELECT setup_draft_text,setup_draft_revision,revision,dispatches_used FROM teacher_sessions WHERE id=$1', [id]);
    assert.deepEqual(row, { setup_draft_text: '', setup_draft_revision: 0, revision: 1, dispatches_used: 0 });
    await migration.down(runner); await migration.up(runner);
  });
  await runner.release();
  const store = new TeacherService(db, new CheckModuleAccessUseCase(db));
  const command = new ExecuteTeacherCommandUseCase(store, port), read = new ReadTeacherUseCase(store, port);
  const perform = (op, id, body, key = randomUUID(), who = actor) => command.execute(who, id, key, op, body);
  const state = async (id) => (await db.query('SELECT * FROM teacher_sessions WHERE id=$1', [id]))[0];
  const counts = async () => (await db.query(`SELECT (SELECT count(*)::int FROM teacher_sessions) AS sessions,
    (SELECT count(*)::int FROM teacher_cursors) AS cursors,(SELECT count(*)::int FROM teacher_requests) AS requests,
    (SELECT count(*)::int FROM teacher_setup_messages) AS messages,(SELECT count(*)::int FROM teacher_generation_jobs) AS jobs`))[0];
  const rejectCode = (code, status = 409) => (e) => e.getStatus?.() === status && e.getResponse()?.code === code;
  let session;
  await check('legacy create still returns a plain recoverable draft', async () => {
    session = await perform('create', null, create);
    assert.equal(session.revision, 1); assert.equal(session.kind, undefined);
    const detail = await read.detail(actor, session.session_id);
    assert.equal(detail.setup_draft_text, ''); assert.equal(detail.setup_draft_revision, 0); assert.equal(detail.selection, null);
    assert.equal(verificationCalls, 0);
  });
  await check('concurrent create+start is one receipt/session/cursor/queued job without spending a dispatch', async () => {
    const before = await counts(), key = randomUUID(), body = { ...create, organization: 'topics', selection: selected, start_plan: true };
    const replies = await Promise.all([perform('create', null, body, key), perform('create', null, body, key)]);
    assert.deepEqual(replies[0], replies[1]); const result = replies[0]; assert.equal(result.kind, 'job'); assert.equal(result.state, 'queued');
    const after = await counts(); for (const name of ['sessions', 'cursors', 'requests', 'jobs']) assert.equal(after[name], before[name] + 1);
    const saved = await state(result.session_id); assert.deepEqual(saved.selection, selected); assert.equal(saved.dispatches_used, 0); assert.equal(saved.current_plan_revision_id, null);
    const [job] = await db.query('SELECT * FROM teacher_generation_jobs WHERE id=$1', [result.job_id]);
    assert.equal(job.purpose, 'plan_outline'); assert.equal(job.dispatches_used, 0); assert.equal(job.actor_id, actor.userId);
    assert.equal(job.input_snapshot.organization, 'topics'); assert.equal(job.input_snapshot.day_count, null);
    assert.equal(job.input_snapshot.session.topic, create.topic); assert.deepEqual(job.selection_snapshot, selected);
    const recovered = await store.receipt(actor, key); assert.equal(recovered.http_status, 202); assert.deepEqual(recovered.receipt, result);
    await assert.rejects(perform('create', null, { ...body, topic: 'Different' }, key), rejectCode('idempotency_conflict'));
    const countBeforeProposal = await counts();
    const repeated = await perform('propose', result.session_id, { expected_session_revision: 1, organization: 'topics', day_count: null });
    assert.equal(repeated.job_id, result.job_id); assert.equal((await counts()).jobs, countBeforeProposal.jobs);
  });
  await check('invalid selection, failed verification and capacity rejection roll back the entire create', async () => {
    let before = await counts();
    await assert.rejects(perform('create', null, { ...create, start_plan: true }), rejectCode('no_model')); assert.deepEqual(await counts(), before);
    verifyFailure = true;
    await assert.rejects(perform('create', null, { ...create, start_plan: true, selection: selected }), /synthetic_unqualified/); assert.deepEqual(await counts(), before);
    verifyFailure = false;
    const suggested = await perform('create', null, { ...create, start_plan: true, selection: selected });
    const [suggestion] = await db.query('SELECT input_snapshot FROM teacher_generation_jobs WHERE id=$1', [suggested.job_id]);
    assert.equal(suggestion.input_snapshot.organization, 'teacher_suggests'); assert.equal(suggestion.input_snapshot.day_count, null);
    before = await counts();
    await assert.rejects(perform('create', null, { ...create, start_plan: true, selection: selected }), rejectCode('capacity_unavailable', 429)); assert.deepEqual(await counts(), before);
    await db.query("UPDATE teacher_generation_jobs SET state='cancelled_before_dispatch',blocks_duplicate=false WHERE dispatches_used=0");
  });
  await check('Teacher-suggested scheduling publishes either valid proposal without fabricating or accepting a stored schedule', async () => {
    for (const organization of ['days', 'topics']) {
      let created = await perform('create', null, { ...create, start_plan: organization === 'days', selection: selected });
      if (organization === 'topics') created = {
        ...created,
        ...(await perform('propose', created.session_id, { expected_session_revision: 1, organization: 'teacher_suggests', day_count: null })),
      };
      const outline = {
        schema_version: 1, title: 'Synthetic proposal', topic: create.topic, objective: create.objective,
        explanation_language: 'es', organization, day_count: organization === 'days' ? 2 : null,
        sections: [{ id: 'section', title: 'Synthetic section', required: true, prerequisite_section_ids: [],
          objectives: [{ id: 'objective', description: 'Explain a synthetic concept' }],
          units: [{ id: 'unit', title: 'Synthetic unit', objective_ids: ['objective'], day_start: organization === 'days' ? 1 : null, day_end: organization === 'days' ? 2 : null }] }],
        assessment_policy: defaultPolicy(),
      };
      const output = { schema_version: 1, outline, guide: { schema_version: 1, strategy: 'balanced', context_notes: '', examples_context: '', prerequisite_knowledge: [], preferred_formats: ['single_choice', 'completion', 'short_text'] } };
      const result = await db.transaction(async manager => {
        const [job] = await manager.query('SELECT * FROM teacher_generation_jobs WHERE id=$1 FOR UPDATE', [created.job_id]);
        const published = await new PublishTeacherUseCase().publish(manager, job, JSON.stringify(output));
        await manager.query("UPDATE teacher_generation_jobs SET state='ready',blocks_duplicate=false,result_ref=$2 WHERE id=$1", [job.id, published]);
        return published;
      });
      const saved = await state(created.session_id);
      assert.equal(saved.requested_organization, 'teacher_suggests'); assert.equal(saved.requested_day_count, null); assert.equal(saved.current_plan_revision_id, null);
      const [proposed] = await db.query('SELECT state,outline,generation_job_id FROM teacher_plan_revisions WHERE id=$1', [result.proposal_revision_id]);
      assert.equal(proposed.state, 'candidate'); assert.equal(proposed.outline.organization, organization);
      assert.equal(proposed.outline.day_count, organization === 'days' ? 2 : null); assert.equal(proposed.generation_job_id, created.job_id);
    }
  });
  await check('draft autosave races are fenced, idempotent, owned and generation-free without session revision churn', async () => {
    const calls = verificationCalls, id = session.session_id, key = randomUUID();
    const saved = await perform('setup_draft', id, { expected_draft_revision: 0, text: '  pending\nthoughts  ' }, key);
    assert.equal(saved.setup_draft_revision, 1); assert.equal(saved.setup_draft_text, '  pending\nthoughts  ');
    assert.deepEqual(await perform('setup_draft', id, { expected_draft_revision: 0, text: '  pending\nthoughts  ' }, key), saved);
    const writes = await Promise.allSettled(['First tab', 'Second tab'].map(text => perform('setup_draft', id, { expected_draft_revision: 1, text })));
    assert.equal(writes.filter(x => x.status === 'fulfilled').length, 1);
    assert.equal(writes.filter(x => x.status === 'rejected' && rejectCode('draft_revision_conflict')(x.reason)).length, 1);
    const row = await state(id); assert.equal(row.revision, 1); assert.equal(row.setup_draft_revision, 2); assert.equal(row.dispatches_used, 0);
    await assert.rejects(perform('setup_draft', id, { expected_draft_revision: 2, text: 'Not owner' }, randomUUID(), other), rejectCode('not_found', 404));
    await assert.rejects(perform('setup_draft', id, { expected_draft_revision: 2, text: '€'.repeat(3000) }), rejectCode('invalid_input', 400));
    assert.equal(verificationCalls, calls); assert.equal(generationCalls, 0);
  });
  let paused;
  await check('pause includes the pending setup snapshot atomically; cursor or draft conflicts roll everything back', async () => {
    const id = session.session_id, before = await state(id), base = { expected_session_revision: 1, cursor: { phase: 'setup' }, expected_cursor_revision: 1 };
    await assert.rejects(perform('pause', id, { ...base, expected_cursor_revision: 99, pending_setup_draft: { expected_draft_revision: 2, text: 'Must roll back' } }), rejectCode('revision_conflict'));
    assert.deepEqual(await state(id), before);
    await assert.rejects(perform('pause', id, { ...base, pending_setup_draft: { expected_draft_revision: 1, text: 'Must also roll back' } }), rejectCode('draft_revision_conflict'));
    assert.deepEqual(await state(id), before);
    paused = await perform('pause', id, { ...base, pending_setup_draft: { expected_draft_revision: 2, text: 'Unsent before debounce' } });
    assert.equal(paused.state, 'paused'); assert.equal(paused.setup_draft_revision, 3); assert.equal(paused.setup_draft_text, 'Unsent before debounce');
    const detail = await read.detail(actor, id); assert.equal(detail.setup_draft_text, paused.setup_draft_text); assert.equal(detail.setup_draft_revision, 3);
    await assert.rejects(perform('setup_draft', id, { expected_draft_revision: 3, text: 'Paused write' }), rejectCode('session_paused'));
  });
  await check('message preserves a newer draft, clears only its exact snapshot, and keeps legacy sends compatible', async () => {
    const id = session.session_id, resumed = await perform('resume', id, { expected_session_revision: paused.revision });
    await perform('setup_draft', id, { expected_draft_revision: 3, text: 'Newer edit from another tab' });
    const older = await perform('message', id, { expected_session_revision: resumed.revision, expected_draft_revision: 3, text: 'Unsent before debounce', generate_reply: false });
    assert.equal(older.setup_draft_text, 'Newer edit from another tab'); assert.equal(older.setup_draft_revision, 4);
    const sent = await perform('message', id, { expected_session_revision: older.revision, expected_draft_revision: 4, text: 'Newer edit from another tab', generate_reply: false });
    assert.equal(sent.setup_draft_text, ''); assert.equal(sent.setup_draft_revision, 5);
    await perform('setup_draft', id, { expected_draft_revision: 5, text: 'Legacy must preserve this draft' });
    const legacy = await perform('message', id, { expected_session_revision: sent.revision, text: 'Legacy message', generate_reply: false });
    assert.equal(legacy.setup_draft_text, 'Legacy must preserve this draft'); assert.equal(legacy.setup_draft_revision, 6);
  });
  await check('failed message generation admission cannot clear or store a partial message', async () => {
    const id = session.session_id, before = await state(id), all = await counts();
    await assert.rejects(perform('message', id, { expected_session_revision: before.revision, expected_draft_revision: before.setup_draft_revision, text: before.setup_draft_text, generate_reply: true }), rejectCode('no_model'));
    assert.deepEqual(await state(id), before); assert.deepEqual(await counts(), all);
  });
  await check('database constraints enforce raw byte/character bounds and migration rollback preserves nonempty history', async () => {
    const id = session.session_id;
    await assert.rejects(db.query('UPDATE teacher_sessions SET setup_draft_text=$2 WHERE id=$1', [id, '€'.repeat(3000)]), e => e.code === '23514');
    await assert.rejects(db.query('UPDATE teacher_sessions SET setup_draft_revision=-1 WHERE id=$1', [id]), e => e.code === '23514');
    const before = await state(id), q = db.createQueryRunner(); await q.connect();
    await assert.rejects(migration.down(q), /teacher_setup_draft_rollback_requires_reconciliation/); await q.release();
    assert.deepEqual(await state(id), before); assert.equal(generationCalls, 0);
  });
  console.log(JSON.stringify({ success: true, checks, count: checks.length, synthetic_transport: true, real_PostgreSQL: true, provider_requests: 0, operational_credentials: false }));
} finally {
  if (db?.isInitialized) await db.destroy();
  if (started) docker('rm', '--force', container);
}
