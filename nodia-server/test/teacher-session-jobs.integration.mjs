// Dedicated temporary PostgreSQL only. Never loads application .env or contacts a provider.
// Run with PGHOST=<private Unix socket dir>, PGUSER=teacher_list_test,
// PGDATABASE=teacher_list_test, TEACHER_LIST_TEST_ISOLATED=1 and
// TEACHER_TEST_RELEASE_ROOT=<isolated compiled candidate>. Requires its normal TypeORM deps.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DataSource } from 'typeorm';

if (process.env.TEACHER_LIST_TEST_ISOLATED !== '1'
  || !process.env.PGHOST || !isAbsolute(process.env.PGHOST)
  || process.env.PGUSER !== 'teacher_list_test' || process.env.PGDATABASE !== 'teacher_list_test'
  || !process.env.TEACHER_TEST_RELEASE_ROOT || !isAbsolute(process.env.TEACHER_TEST_RELEASE_ROOT))
  throw new Error('Dedicated temporary PostgreSQL and isolated release root are required');
const root = process.env.TEACHER_TEST_RELEASE_ROOT;
const { latestSessionJobs } = await import(pathToFileURL(resolve(root, 'dist/teacher/use-case/teacher-session-jobs.js')));
const { ReadTeacherUseCase } = await import(pathToFileURL(resolve(root, 'dist/teacher/use-case/read-teacher.use-case.js')));
const source = new DataSource({ type: 'postgres', host: process.env.PGHOST,
  port: Number(process.env.PGPORT ?? 5432), username: 'teacher_list_test', database: 'teacher_list_test',
  connectTimeoutMS: 5000, logging: false,
});
const id = number => `00000000-0000-4000-8000-${number.toString(16).padStart(12, '0')}`;
const checks = [];
try {
  await source.initialize();
  await source.transaction(async manager => {
    await manager.query(`CREATE TEMP TABLE teacher_sessions (
      id uuid PRIMARY KEY,owner_user_id bigint NOT NULL,title text,topic text,objective text,
      explanation_language text,requested_organization text,requested_day_count integer,state text,
      revision integer,current_plan_revision_id uuid,dispatch_limit integer,dispatches_used integer,
      created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now()
    ) ON COMMIT DROP`);
    await manager.query(`CREATE TEMP TABLE teacher_generation_jobs (
      id uuid PRIMARY KEY,session_id uuid NOT NULL,state text NOT NULL,purpose text NOT NULL,
      created_at timestamptz NOT NULL,prompt_snapshot text DEFAULT 'private synthetic fixture',
      selection_snapshot jsonb DEFAULT '{}',UNIQUE(session_id,id)
    ) ON COMMIT DROP`);
    const own = Array.from({ length: 50 }, (_, index) => id(index + 1));
    for (const sessionId of [...own, id(99)]) await manager.query(
      "INSERT INTO teacher_sessions(id,owner_user_id,title,topic,objective,state,revision,dispatch_limit,dispatches_used) VALUES($1,$2,'Synthetic title','Synthetic topic','Synthetic objective','draft',1,200,1)",
      [sessionId, sessionId === id(99) ? '2' : '1'],
    );
    const insert = (sessionId, jobId, state, seconds, purpose = 'plan_outline') => manager.query(
      'INSERT INTO teacher_generation_jobs(id,session_id,state,purpose,created_at) VALUES($1,$2,$3,$4,$5)',
      [jobId, sessionId, state, purpose, new Date(Date.UTC(2026, 10, 6, 0, 0, seconds))],
    );
    await insert(own[0], id(101), 'queued', 1);
    await insert(own[0], id(102), 'ready', 9, 'setup_reply');
    await insert(own[1], id(103), 'running', 1);
    await insert(own[1], id(104), 'ready', 9, 'setup_reply');
    await insert(own[2], id(105), 'ready', 4);
    await insert(own[2], id(106), 'failed_known', 4);
    await insert(own[3], id(107), 'blocked_paused', 1);
    await insert(own[3], id(108), 'unknown', 9);
    await insert(id(99), id(109), 'running', 59);

    let jobReads = 0;
    const measured = new Proxy(manager, { get(target, property) {
      if (property === 'query') return (...args) => {
        if (String(args[0]).includes('DISTINCT ON (session_id)')) jobReads++;
        return target.query(...args);
      };
      return Reflect.get(target, property);
    } });
    const jobs = await latestSessionJobs(measured, own);
    assert.equal(jobReads, 1);
    assert.equal(jobs.get(own[0]).job_id, id(101));
    assert.equal(jobs.get(own[1]).job_id, id(103));
    checks.push('older_queued_and_running_take_priority_over_newer_ready');
    assert.equal(jobs.get(own[2]).job_id, id(106));
    assert.equal(jobs.get(own[3]).job_id, id(108));
    checks.push('terminal_latest_and_equal_timestamp_uuid_tiebreak');
    assert.equal(jobs.has(id(99)), false);
    assert.equal(jobs.has(own[4]), false);
    assert.deepEqual(Object.keys(jobs.get(own[0])).sort(), ['job_id', 'purpose', 'state']);
    checks.push('fifty_authorized_ids_single_batch_public_projection_only');
    const empty = await latestSessionJobs(measured, []);
    assert.equal(empty.size, 0); assert.equal(jobReads, 1);
    checks.push('empty_batch_performs_no_job_query');

    // The existing authority facade is substituted; its unchanged owner SQL runs against real PG.
    // This proves list filtering/projection, not authentication or module guards.
    const store = { scope: async (actor, sessionId, work) => {
      assert.equal(sessionId, null);
      return work({ manager: measured, actor: { actorId: actor.userId }, session: null });
    } };
    const reader = new ReadTeacherUseCase(store, {});
    const page = await reader.list({ userId: '1', sessionId: id(501) }, { page: 1, limit: 50, archived: 'false' });
    assert.equal(page.meta.total_items, 50); assert.equal(page.data.length, 50); assert.equal(jobReads, 2);
    assert.equal(page.data.some(row => row.id === id(99)), false);
    assert.equal(page.data.find(row => row.id === own[4]).latest_job, null);
    assert.equal(page.data.find(row => row.id === own[0]).latest_job.state, 'queued');
    const otherPage = await reader.list({ userId: '2', sessionId: id(502) }, { page: 1, limit: 50, archived: 'false' });
    assert.equal(otherPage.data.length, 1); assert.equal(otherPage.data[0].id, id(99));
    assert.equal(otherPage.data[0].latest_job.job_id, id(109));
    const noPage = await reader.list({ userId: '3', sessionId: id(503) }, { page: 1, limit: 50, archived: 'false' });
    assert.equal(noPage.data.length, 0); assert.equal(jobReads, 3);
    checks.push('real_list_owner_sql_excludes_other_actor_and_null_for_no_job');
  });
  process.stdout.write(JSON.stringify({ schema: 'teacher-session-jobs-sql/1', status: 'passed', checks, auth_guards_exercised: false, operational_db_used: false, provider_calls: 0 }) + '\n');
} finally { if (source.isInitialized) await source.destroy(); }
