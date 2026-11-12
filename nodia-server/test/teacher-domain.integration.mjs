import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { mkdirSync, writeFileSync } from 'node:fs';
import { DataSource } from 'typeorm';
import { Module, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { CreateTeacherDomain1793570000000 } from '../dist/migrations/1793570000000-CreateTeacherDomain.js';
import { PreserveTeacherArchivedPauseState1793590000000 } from '../dist/migrations/1793590000000-PreserveTeacherArchivedPauseState.js';
import { PersistTeacherSetupDraft1793610000000 } from '../dist/migrations/1793610000000-PersistTeacherSetupDraft.js';
import { TeacherLearningEvidence1793630000000 } from '../dist/migrations/1793630000000-TeacherLearningEvidence.js';
import { TeacherLearningEnrichment1793640000000 } from '../dist/migrations/1793640000000-TeacherLearningEnrichment.js';
import { CheckModuleAccessUseCase } from '../dist/authorization/use-case/check-module-access.use-case.js';
import { TeacherService } from '../dist/teacher/teacher.service.js';
import { ReadTeacherUseCase } from '../dist/teacher/use-case/read-teacher.use-case.js';
import { ExecuteTeacherCommandUseCase } from '../dist/teacher/use-case/execute-teacher-command.use-case.js';
import { PublishTeacherUseCase } from '../dist/teacher/use-case/publish-teacher.use-case.js';
import { TeacherController } from '../dist/teacher/teacher.controller.js';
import { teacherBodyParser } from '../dist/teacher/teacher-body-parser.js';
import { AllExceptionsFilter } from '../dist/common/filters/all-exceptions.filter.js';
import { defaultPolicy } from '../dist/teacher/policies/teacher-validation.js';

// Synthetic transport only; all actual authority/SQL/DTO/projection rules run unchanged.
// No application .env, credentials, profiles, remote provider or operational DB.
const container = `template_teacher_${process.pid}_${randomBytes(4).toString('hex')}`;
const password = randomBytes(24).toString('hex');
const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
const checks = [];
const check = async (name, work) => {
  await work();
  checks.push(name);
};
const user = '9007199254740993',
  session = randomUUID(),
  otherSession = randomUUID(),
  superSession = randomUUID();
const actor = { userId: user, sessionId: session },
  other = { userId: '2', sessionId: otherSession },
  superActor = { userId: '3', sessionId: superSession };
let serveTimer;
let started = false,
  db,
  app;
try {
  docker(
    'run',
    '--pull=never',
    '--detach',
    '--rm',
    '--name',
    container,
    '--publish',
    '127.0.0.1::5432',
    '--env',
    'POSTGRES_DB=teacher_test',
    '--env',
    'POSTGRES_USER=teacher_test',
    '--env',
    `POSTGRES_PASSWORD=${password}`,
    'postgres:16-alpine',
  );
  started = true;
  for (let i = 0; i < 40; i++) {
    try {
      docker(
        'exec',
        container,
        'pg_isready',
        '-h',
        '127.0.0.1',
        '-U',
        'teacher_test',
      );
      break;
    } catch (error) {
      if (i === 39) throw error;
      await delay(200);
    }
  }
  const port = Number(docker('port', container, '5432/tcp').split(':').at(-1));
  db = new DataSource({
    type: 'postgres',
    host: '127.0.0.1',
    port,
    username: 'teacher_test',
    password,
    database: 'teacher_test',
    synchronize: false,
  });
  await db.initialize();
  await db.query(`CREATE TABLE users(id bigint PRIMARY KEY,is_active boolean NOT NULL DEFAULT true);
 CREATE TABLE auth_sessions(public_id uuid PRIMARY KEY,user_id bigint NOT NULL,revoked_at timestamptz,expires_at timestamptz NOT NULL);
 CREATE TABLE roles(id bigint PRIMARY KEY,key text NOT NULL,is_active boolean NOT NULL DEFAULT true);
 CREATE TABLE user_roles(user_id bigint NOT NULL,role_id bigint NOT NULL,is_active boolean NOT NULL DEFAULT true);
 CREATE TABLE actions(id bigint PRIMARY KEY);CREATE TABLE role_actions(id bigint PRIMARY KEY);
 CREATE TABLE module_groups(id bigint PRIMARY KEY,is_active boolean NOT NULL DEFAULT true,name text);
 CREATE TABLE modules(id bigint PRIMARY KEY,key text,link text,module_group_id bigint,is_active boolean NOT NULL DEFAULT true);
 CREATE TABLE user_modules(user_id bigint,module_id bigint,is_active boolean NOT NULL DEFAULT true);
 INSERT INTO users(id) VALUES(${user}),(2),(3),(4);INSERT INTO roles(id,key) VALUES(1,'super_admin');INSERT INTO user_roles(user_id,role_id) VALUES(3,1);
 INSERT INTO module_groups(id,name) VALUES(1,'Studies'),(2,'Renamed group');INSERT INTO modules(id,key,link,module_group_id) VALUES(1,'nodia_teacher','/nodia-teacher',1);INSERT INTO user_modules(user_id,module_id) VALUES(${user},1),(2,1);`);
  for (const a of [actor, other, superActor])
    await db.query(
      "INSERT INTO auth_sessions(public_id,user_id,expires_at) VALUES($1,$2,clock_timestamp()+interval '1 day')",
      [a.sessionId, a.userId],
    );
  const migration = new CreateTeacherDomain1793570000000(),
    q = db.createQueryRunner();
  await q.connect();
  await check(
    'Teacher DDL empty up/down/up, twenty durable tables',
    async () => {
      await migration.up(q);
      await migration.down(q);
      await migration.up(q);
      const archiveMigration =
        new PreserveTeacherArchivedPauseState1793590000000();
      await archiveMigration.up(q);
      await archiveMigration.down(q);
      await archiveMigration.up(q);
      const [row] = await db.query(
        "SELECT count(*)::integer AS n FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'teacher_%'",
      );
      assert.equal(row.n, 20);
    },
  );
  // Preserve the baseline up/down/up assertion above; exercise current commands
  // against the additive current schema rather than a historical installation.
  await new PersistTeacherSetupDraft1793610000000().up(q);
  await new TeacherLearningEvidence1793630000000().up(q);
  await new TeacherLearningEnrichment1793640000000().up(q);
  await q.release();
  // Minimal neutral read-side fixture. Shared-runtime proofs/capacity are tested separately.
  await db.query(
    'CREATE TABLE ai_generation_operations(id uuid PRIMARY KEY,teacher_job_id uuid,phase text,remote_outcome text,terminal_proof jsonb,acknowledged_at timestamptz,created_at timestamptz NOT NULL DEFAULT clock_timestamp())',
  );
  const portFixture = {
    setPublisher() {},
    async connections() {
      return {
        items: [
          {
            connection_id: '1',
            label: 'Synthetic isolated Teacher QA',
            is_active: true,
            modes: [
              {
                mode: 'api_key',
                configuration: 'configured',
                configured_selection: {
                  connection_id: '1',
                  mode: 'api_key',
                  model_id: 'synthetic-discovered-model',
                  effort_id: null,
                },
                models: [
                  {
                    model_id: 'synthetic-discovered-model',
                    label: 'Synthetic discovered model',
                    efforts: [],
                  },
                ],
              },
            ],
          },
        ],
        next_cursor: null,
      };
    },
    async eligibility(_actor, connection_id, input) {
      return {
        selection: { connection_id, ...input },
        eligible: true,
        reason_code: null,
        checked_at: new Date().toISOString(),
      };
    },
    async verifySelection() {
      return {
        configuration_generation: 'synthetic-v1',
        session_generation: null,
      };
    },
  };
  const store = new TeacherService(db, new CheckModuleAccessUseCase(db));
  const command = new ExecuteTeacherCommandUseCase(store, portFixture),
    read = new ReadTeacherUseCase(store, portFixture),
    publisher = new PublishTeacherUseCase();
  const perform = (
    operation,
    id,
    body = {},
    target = {},
    key = randomUUID(),
    as = actor,
  ) => command.execute(as, id, key, operation, body, target);
  const publish = async (jobId, value) =>
    db.transaction(async (manager) => {
      const [job] = await manager.query(
        'SELECT * FROM teacher_generation_jobs WHERE id=$1 FOR UPDATE',
        [jobId],
      );
      const result = await publisher.publish(
        manager,
        job,
        JSON.stringify(value),
      );
      await manager.query(
        "UPDATE teacher_generation_jobs SET state='ready',blocks_duplicate=false,result_ref=$2 WHERE id=$1",
        [jobId, result],
      );
      return result;
    });
  let id,
    revision = 1;
  await check(
    'Create request races, exact bigint identity, immutable receipt and payload conflict',
    async () => {
      const key = randomUUID(),
        body = {
          topic: 'Networks',
          objective: 'Understand DNS',
          explanation_language: 'en',
          organization: 'topics',
          day_count: null,
        };
      const [a, b] = await Promise.all([
        perform('create', null, body, {}, key),
        perform('create', null, body, {}, key),
      ]);
      assert.deepEqual(a, b);
      id = a.session_id;
      const detail = await read.detail(actor, id);
      assert.equal(detail.owner_user_id, user);
      assert.equal(detail.selection, null);
      assert.equal((await read.receipt(actor, key)).receipt.session_id, id);
      await assert.rejects(
        perform('create', null, { ...body, topic: 'Changed' }, {}, key),
        /idempotency_conflict/,
      );
      assert.equal(
        (
          await db.query('SELECT count(*)::integer AS n FROM teacher_sessions')
        )[0].n,
        1,
      );
    },
  );
  await check(
    'Ownership, active superadmin bypass and module revocation use current SQL authority',
    async () => {
      await assert.rejects(read.detail(other, id), /not_found/);
      assert.equal((await read.detail(superActor, id)).id, id);
      await db.query(
        'UPDATE user_modules SET is_active=false WHERE user_id=$1',
        [user],
      );
      await assert.rejects(read.detail(actor, id), /module_access_required/);
      await db.query(
        'UPDATE user_modules SET is_active=true WHERE user_id=$1',
        [user],
      );
    },
  );
  await check(
    'Draft pause/resume preserves cursor without generation; group moves preserve authority',
    async () => {
      await perform('pause', id, {
        expected_session_revision: revision,
        expected_cursor_revision: 1,
        cursor: { phase: 'setup' },
      });
      revision++;
      assert.equal((await read.detail(actor, id)).state, 'paused');
      await perform('archive', id, { expected_session_revision: revision });
      revision++;
      const archived = await read.detail(actor, id);
      assert.equal(archived.state, 'archived');
      assert.equal(archived.archived_state, 'paused');
      assert.equal(archived.resume_state, 'draft');
      const archiveRunner = db.createQueryRunner();
      await archiveRunner.connect();
      await assert.rejects(
        new PreserveTeacherArchivedPauseState1793590000000().down(
          archiveRunner,
        ),
        /rollback refused/,
      );
      await archiveRunner.release();
      await perform('unarchive', id, { expected_session_revision: revision });
      revision++;
      assert.equal((await read.detail(actor, id)).state, 'paused');
      await perform('resume', id, { expected_session_revision: revision });
      revision++;
      assert.equal((await read.detail(actor, id)).state, 'draft');
      assert.equal(
        (
          await db.query(
            'SELECT count(*)::integer AS n FROM teacher_generation_jobs',
          )
        )[0].n,
        0,
      );
      await db.query(
        "UPDATE module_groups SET name='Independent label' WHERE id=2; UPDATE modules SET module_group_id=2 WHERE id=1",
      );
      assert.equal((await read.detail(actor, id)).id, id);
    },
  );
  await perform('patch', id, {
    expected_session_revision: revision,
    selection: {
      connection_id: '1',
      mode: 'api_key',
      model_id: 'synthetic-discovered-model',
      effort_id: null,
    },
  });
  revision++;
  await check(
    'Versioned setup brief survives beyond the last12 messages without repeating generation',
    async () => {
      const job = await perform('message', id, {
        expected_session_revision: revision,
        text: 'Remember the initial context: diagnose home DNS failures.',
        generate_reply: true,
      });
      revision++;
      const result = await publish(job.job_id, {
        schema_version: 1,
        text: 'We will retain the home DNS troubleshooting context.',
        brief: {
          topic: 'Networks',
          objective: 'Understand DNS and diagnose home DNS failures.',
        },
        questions: ['Do you prefer a local resolver example?'],
        organization_options: ['days', 'topics'],
      });
      assert.equal(result.setup_summary.source_message_id, result.message_id);
      assert.equal(result.setup_summary.source_message_seq, '2');
      for (let i = 0; i < 13; i++) {
        await perform('message', id, {
          expected_session_revision: revision,
          text: `Later user detail ${i}`,
          generate_reply: false,
        });
        revision++;
      }
      const proposalJob = await perform('propose', id, {
        expected_session_revision: revision,
        organization: 'topics',
        day_count: null,
      });
      const [storedJob] = await db.query(
        'SELECT input_snapshot,prompt_snapshot FROM teacher_generation_jobs WHERE id=$1',
        [proposalJob.job_id],
      );
      assert.equal(storedJob.input_snapshot.messages.length, 12);
      assert.equal(
        storedJob.input_snapshot.messages.some((m) =>
          m.text.includes('Remember the initial context'),
        ),
        false,
      );
      assert.equal(
        storedJob.input_snapshot.setup_summary.brief.objective,
        'Understand DNS and diagnose home DNS failures.',
      );
      assert.ok(
        storedJob.prompt_snapshot.includes('diagnose home DNS failures'),
      );
      assert.equal(
        (await read.job(actor, job.job_id)).result_ref.setup_summary.revision,
        2,
      );
      await db.query(
        "UPDATE teacher_generation_jobs SET state='cancelled_before_dispatch',blocks_duplicate=false WHERE id=$1",
        [proposalJob.job_id],
      );
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::integer AS n FROM teacher_generation_jobs WHERE purpose='setup_reply'",
          )
        )[0].n,
        1,
      );
    },
  );
  const proposalAck = await perform('propose', id, {
    expected_session_revision: revision,
    organization: 'topics',
    day_count: null,
  });
  const p = {
    schema_version: 1,
    title: 'Network plan',
    topic: 'Networks',
    objective: 'Understand DNS',
    explanation_language: 'en',
    organization: 'topics',
    day_count: null,
    sections: [
      {
        id: 's',
        title: 'DNS',
        required: true,
        prerequisite_section_ids: [],
        objectives: [{ id: 'o', description: 'Explain resolution' }],
        units: [
          {
            id: 'u',
            title: 'DNS',
            objective_ids: ['o'],
            day_start: null,
            day_end: null,
          },
        ],
      },
    ],
    assessment_policy: defaultPolicy(),
  };
  const g = {
    schema_version: 1,
    strategy: 'balanced',
    context_notes: '',
    examples_context: 'Networks',
    prerequisite_knowledge: [],
    preferred_formats: ['single_choice', 'completion', 'short_text'],
  };
  const proposalResult = await publish(proposalAck.job_id, {
    schema_version: 1,
    outline: p,
    guide: g,
  });
  let proposal = await read.proposal(
    actor,
    id,
    proposalResult.proposal_revision_id,
  );
  await check(
    'Manual revision uses no inference; exact acceptance is idempotent even without provider',
    async () => {
      const count = (
        await db.query(
          'SELECT count(*)::integer AS n FROM teacher_generation_jobs',
        )
      )[0].n;
      const edited = structuredClone(proposal.outline);
      edited.title = 'Saved networks';
      const next = await perform(
        'patch_proposal',
        id,
        {
          expected_session_revision: revision,
          expected_proposal_hash: proposal.content_hash,
          outline: edited,
        },
        { proposalId: proposal.id },
      );
      revision++;
      proposal = await read.proposal(actor, id, next.id);
      assert.equal(
        (
          await db.query(
            'SELECT count(*)::integer AS n FROM teacher_generation_jobs',
          )
        )[0].n,
        count,
      );
      const body = {
        expected_session_revision: revision,
        proposal_revision_id: proposal.id,
        proposal_hash: proposal.content_hash,
      };
      const [a, b] = await Promise.all([
        perform('accept', id, body, { proposalId: proposal.id }),
        perform('accept', id, body, { proposalId: proposal.id }),
      ]);
      assert.equal(a.plan_revision_id, b.plan_revision_id);
      revision++;
    },
  );
  const planId = proposal.id,
    sectionId = proposal.outline.sections[0].id,
    unitId = proposal.outline.sections[0].units[0].id;
  const assessmentFor = async (jobId) => {
    const [j] = await db.query(
      'SELECT * FROM teacher_generation_jobs WHERE id=$1',
      [jobId],
    );
    return {
      schema_version: 1,
      scope: j.input_snapshot.scope,
      plan_revision_id: j.plan_revision_id,
      section_id: j.section_id,
      unit_id: j.unit_id,
      items: j.input_snapshot.blueprint.map((slot, i) => ({
        local_ref: `item${i}`,
        objective_id: slot.objective_id,
        kind: slot.kind,
        prompt: `Explain DNS task ${i} for ${jobId}`,
        ...(slot.kind === 'single_choice'
          ? {
              options: [
                { id: 'yes', label: 'Correct' },
                { id: 'no', label: 'Different' },
              ],
            }
          : {}),
        private_key:
          slot.kind === 'single_choice'
            ? { kind: slot.kind, option_id: 'yes' }
            : slot.kind === 'completion'
              ? { kind: slot.kind, alternatives: ['DNS'], case_sensitive: true }
              : {
                  kind: slot.kind,
                  criteria: ['objective', 'accuracy', 'clarity'].map(
                    (criterion_id) => ({
                      criterion_id,
                      anchors: ['Missing', 'Partial', 'Correct'],
                    }),
                  ),
                },
        explanation: 'DNS resolves a name through the configured resolver.',
        hint: 'Consider the resolver sequence.',
      })),
    };
  };
  let attemptId;
  await check(
    'Direct final creates only assessment, one concurrent intention and no lesson dependency',
    async () => {
      const body = {
        expected_session_revision: revision,
        plan_revision_id: planId,
        entry_route: 'direct',
        new_attempt: false,
      };
      const [a, b] = await Promise.all([
        perform('start_final', id, body, { sectionId }),
        perform('start_final', id, body, { sectionId }),
      ]);
      assert.equal(a.job_id, b.job_id);
      assert.equal(
        (
          await db.query(
            'SELECT count(*)::integer AS n FROM teacher_content_versions',
          )
        )[0].n,
        0,
      );
      const result = await publish(a.job_id, await assessmentFor(a.job_id));
      attemptId = result.attempt_id;
      assert.ok(attemptId);
    },
  );
  let questions;
  await check(
    'Final public index/questions hide keys, points and explanations before full submit',
    async () => {
      const a = await read.attempt(actor, id, attemptId);
      questions = a.questions;
      assert.equal('earned_points' in a, false);
      assert.equal('denominator_points' in a, false);
      for (const item of questions) {
        const q = await read.question(actor, id, attemptId, item.question_id);
        const serialized = JSON.stringify(q);
        assert.ok(!serialized.includes('private_key'));
        assert.equal('feedback' in q, false);
        assert.equal('earned_points' in q, false);
      }
      await assert.rejects(
        perform(
          'submit_question',
          id,
          {
            expected_attempt_revision: a.revision,
            expected_response_revision: 1,
            answer: { kind: 'dont_know' },
          },
          { attemptId, questionId: questions[0].question_id },
        ),
        /final_requires_full_submit/,
      );
      await assert.rejects(
        perform(
          'submit_attempt',
          id,
          { expected_attempt_revision: a.revision },
          { attemptId },
        ),
        /incomplete_assessment/,
      );
    },
  );
  await check(
    'Response CAS and full submission freeze all answers; 90 exact remains pending until mixed rubric feedback',
    async () => {
      let a = await read.attempt(actor, id, attemptId);
      const patches = [];
      for (let i = 0; i < questions.length; i++) {
        const q = await read.question(
          actor,
          id,
          attemptId,
          questions[i].question_id,
        );
        patches.push({
          question_id: q.question_id,
          expected_response_revision: q.response_revision,
          answer:
            q.kind === 'single_choice'
              ? { kind: 'single_choice', option_id: i < 2 ? 'no' : 'yes' }
              : q.kind === 'completion'
                ? { kind: 'completion', text: 'DNS' }
                : {
                    kind: 'short_text',
                    text: 'The configured resolver maps names to records.',
                  },
        });
      }
      const saved = await perform(
        'patch_responses',
        id,
        { expected_attempt_revision: a.revision, responses: patches },
        { attemptId },
      );
      await assert.rejects(
        perform(
          'patch_responses',
          id,
          { expected_attempt_revision: a.revision, responses: patches },
          { attemptId },
        ),
        /revision_conflict/,
      );
      const textItem = patches.find((p) => p.answer.kind === 'completion');
      assert.ok(textItem);
      const cleared = await perform(
        'patch_responses',
        id,
        {
          expected_attempt_revision: saved.revision,
          responses: [
            {
              question_id: textItem.question_id,
              expected_response_revision:
                textItem.expected_response_revision + 1,
              answer: { kind: 'completion', text: ' \t\u00a0 ' },
            },
          ],
        },
        { attemptId },
      );
      const blankQuestion = await read.question(
        actor,
        id,
        attemptId,
        textItem.question_id,
      );
      assert.equal(blankQuestion.draft_answer.text, ' \t\u00a0 ');
      assert.equal(
        (await read.attempt(actor, id, attemptId)).questions.find(
          (q) => q.question_id === textItem.question_id,
        ).answer_status,
        'empty',
      );
      await assert.rejects(
        perform(
          'submit_attempt',
          id,
          { expected_attempt_revision: cleared.revision },
          { attemptId },
        ),
        /incomplete_assessment/,
      );
      assert.equal(
        (
          await db.query(
            'SELECT count(*)::integer AS n FROM teacher_responses WHERE attempt_id=$1 AND submitted_at IS NOT NULL',
            [attemptId],
          )
        )[0].n,
        0,
      );
      const restored = await perform(
        'patch_responses',
        id,
        {
          expected_attempt_revision: cleared.revision,
          responses: [
            {
              question_id: textItem.question_id,
              expected_response_revision: blankQuestion.response_revision,
              answer: { kind: 'completion', text: 'DNS' },
            },
          ],
        },
        { attemptId },
      );
      const submitted = await perform(
        'submit_attempt',
        id,
        { expected_attempt_revision: restored.revision },
        { attemptId },
      );
      assert.equal(submitted.state, 'grading_pending');
      a = await read.attempt(actor, id, attemptId);
      assert.equal(a.result, 'pending');
      assert.equal(a.percentage, null);
      await assert.rejects(
        perform(
          'patch_responses',
          id,
          { expected_attempt_revision: a.revision, responses: patches },
          { attemptId },
        ),
        /response_already_submitted/,
      );
      const [job] = await db.query(
        "SELECT * FROM teacher_generation_jobs WHERE attempt_id=$1 AND purpose='written_feedback'",
        [attemptId],
      );
      const feedback = {
        schema_version: 1,
        responses: job.input_snapshot.responses.map((r) => ({
          response_id: r.response_id,
          criteria: ['objective', 'accuracy', 'clarity'].map(
            (criterion_id) => ({
              criterion_id,
              points: 2,
              comment: 'Meets fixed rubric',
            }),
          ),
          uncertain: false,
          explanation: 'Correct according to the stored criteria.',
        })),
      };
      await publish(job.id, feedback);
      a = await read.attempt(actor, id, attemptId);
      assert.equal(a.result, 'passed');
      assert.equal(a.earned_points, 36);
      assert.equal(a.denominator_points, 40);
      assert.equal(a.percentage, 90);
      assert.equal((await read.detail(actor, id)).state, 'completed');
    },
  );
  await check(
    'One packet publication, private practice keys, cursor and response drafts pause atomically',
    async () => {
      let current = await read.detail(actor, id);
      const body = {
        expected_session_revision: current.revision,
        plan_revision_id: planId,
        variant: 'current',
      };
      const [a, b] = await Promise.all([
        perform('material', id, body, { unitId }),
        perform('material', id, body, { unitId }),
      ]);
      assert.equal(a.job_id, b.job_id);
      const candidate = await assessmentFor(a.job_id);
      const packet = {
        schema_version: 1,
        unit_id: unitId,
        plan_revision_id: planId,
        blocks: [
          {
            id: 'theory',
            kind: 'explanation',
            title: 'Resolver',
            body_markdown: 'A resolver queries DNS records.',
          },
          {
            id: 'example',
            kind: 'example',
            title: 'Example',
            body_markdown: 'Look up a host record.',
          },
          {
            id: 'practice',
            kind: 'guided_practice',
            title: 'Practice',
            body_markdown: 'Describe which record is needed.',
          },
        ],
        practice_assessment: candidate,
      };
      await assert.rejects(
        publish(a.job_id, {
          ...packet,
          blocks: [
            {
              ...packet.blocks[0],
              body_markdown: '<img src=x onerror=alert(1)>',
            },
          ],
        }),
        /invalid_generated_content/,
      );
      assert.equal(
        (
          await db.query(
            'SELECT count(*)::integer AS n FROM teacher_content_versions',
          )
        )[0].n,
        0,
      );
      const saved = await publish(a.job_id, packet);
      const material = await read.material(actor, id, unitId, planId);
      assert.equal(material.content_version_id, saved.content_version_id);
      assert.equal(JSON.stringify(material).includes('private_key'), false);
      assert.equal(JSON.stringify(material).includes('correct_answer'), false);
      const reused = await perform('material', id, body, { unitId });
      assert.equal(reused.resource_id, saved.content_version_id);
      assert.equal(
        (
          await db.query(
            'SELECT count(*)::integer AS n FROM teacher_content_versions',
          )
        )[0].n,
        1,
      );
      const practice = await perform(
        'start_practice',
        id,
        {
          expected_session_revision: current.revision,
          plan_revision_id: planId,
          entry_route: 'practice',
          new_attempt: false,
        },
        { unitId },
      );
      const attempt = await read.attempt(actor, id, practice.attempt_id);
      const first = await read.question(
        actor,
        id,
        attempt.attempt_id,
        attempt.questions[0].question_id,
      );
      await assert.rejects(
        read.question(
          actor,
          id,
          attempt.attempt_id,
          attempt.questions[1].question_id,
        ),
        /question_not_current/,
      );
      await perform('pause', id, {
        expected_session_revision: current.revision,
        expected_cursor_revision: current.cursor.revision,
        cursor: {
          phase: 'practice',
          plan_revision_id: planId,
          section_id: sectionId,
          unit_id: unitId,
          content_version_id: saved.content_version_id,
          attempt_id: attempt.attempt_id,
          item_id: first.question_id,
        },
        attempt_id: attempt.attempt_id,
        expected_attempt_revision: attempt.revision,
        pending_responses: [
          {
            question_id: first.question_id,
            expected_response_revision: first.response_revision,
            answer: { kind: 'single_choice', option_id: 'yes' },
          },
        ],
      });
      current = await read.detail(actor, id);
      assert.equal(current.state, 'paused');
      assert.equal(current.cursor.item_id, first.question_id);
      const pausedQuestion = await read.question(
        actor,
        id,
        attempt.attempt_id,
        first.question_id,
      );
      assert.equal(pausedQuestion.draft_answer.option_id, 'yes');
      await perform('resume', id, {
        expected_session_revision: current.revision,
      });
      const resumedAttempt = await read.attempt(actor, id, attempt.attempt_id);
      const submitted = await perform(
        'submit_question',
        id,
        {
          expected_attempt_revision: resumedAttempt.revision,
          expected_response_revision: pausedQuestion.response_revision,
          answer: { kind: 'single_choice', option_id: 'yes' },
        },
        { attemptId: attempt.attempt_id, questionId: first.question_id },
      );
      assert.ok(submitted);
      const gradedQuestion = await read.question(
        actor,
        id,
        attempt.attempt_id,
        first.question_id,
      );
      assert.equal(gradedQuestion.feedback.earned_points, 2);
      assert.equal(gradedQuestion.feedback.max_points, 2);
      assert.ok(gradedQuestion.feedback.explanation);
      await assert.rejects(
        perform(
          'patch_responses',
          id,
          {
            expected_attempt_revision: submitted.revision,
            responses: [
              {
                question_id: first.question_id,
                expected_response_revision: gradedQuestion.response_revision,
                answer: { kind: 'single_choice', option_id: 'no' },
              },
            ],
          },
          { attemptId: attempt.attempt_id },
        ),
        /response_already_submitted/,
      );
    },
  );
  await check(
    'Unknown feedback stays pending, needs demonstrated local closure and never replays same responses',
    async () => {
      const current = await read.detail(actor, id),
        body = {
          expected_session_revision: current.revision,
          plan_revision_id: planId,
          entry_route: 'direct',
          new_attempt: true,
        };
      const [a, b] = await Promise.all([
        perform('start_final', id, body, { sectionId }),
        perform('start_final', id, body, { sectionId }),
      ]);
      assert.equal(a.job_id, b.job_id);
      const variant = await assessmentFor(a.job_id);
      const copiedPrompt = (
        await read.question(actor, id, attemptId, questions[0].question_id)
      ).prompt;
      const onlyDistractorsChanged = structuredClone(variant);
      onlyDistractorsChanged.items[0].prompt = copiedPrompt;
      onlyDistractorsChanged.items[0].options = [
        { id: 'yes', label: 'Different wording for right answer' },
        { id: 'no', label: 'Different distractor only' },
      ];
      await assert.rejects(
        publish(a.job_id, onlyDistractorsChanged),
        /invalid_generated_content/,
      );
      const generated = await publish(a.job_id, variant);
      let attempt = await read.attempt(actor, id, generated.attempt_id);
      const patches = [];
      for (const item of attempt.questions) {
        const q = await read.question(
          actor,
          id,
          attempt.attempt_id,
          item.question_id,
        );
        patches.push({
          question_id: q.question_id,
          expected_response_revision: q.response_revision,
          answer:
            q.kind === 'short_text'
              ? {
                  kind: 'short_text',
                  text: 'A resolver queries authoritative records.',
                }
              : { kind: 'dont_know' },
        });
      }
      const stored = await perform(
        'patch_responses',
        id,
        { expected_attempt_revision: attempt.revision, responses: patches },
        { attemptId: attempt.attempt_id },
      );
      const submitted = await perform(
        'submit_attempt',
        id,
        { expected_attempt_revision: stored.revision },
        { attemptId: attempt.attempt_id },
      );
      await db.query(
        "UPDATE teacher_generation_jobs SET state='unknown',dispatches_used=1 WHERE id=$1",
        [submitted.job_id],
      );
      attempt = await read.attempt(actor, id, attempt.attempt_id);
      assert.equal(attempt.result, 'pending');
      assert.equal(attempt.allowed_actions.close_pending.enabled, false);
      await assert.rejects(
        perform(
          'close_pending',
          id,
          {
            expected_attempt_revision: attempt.revision,
            reason: 'feedback_unknown_unrecoverable',
          },
          { attemptId: attempt.attempt_id },
        ),
        /local_closure_required/,
      );
      await db.query(
        "INSERT INTO ai_generation_operations(id,teacher_job_id,phase,remote_outcome,terminal_proof,acknowledged_at) VALUES($1,$2,'closed','unknown',$3,clock_timestamp())",
        [
          randomUUID(),
          submitted.job_id,
          { fixture: 'demonstrated-local-close' },
        ],
      );
      await db.query(
        'UPDATE teacher_generation_jobs SET blocks_duplicate=false WHERE id=$1',
        [submitted.job_id],
      );
      attempt = await read.attempt(actor, id, attempt.attempt_id);
      assert.equal(attempt.allowed_actions.close_pending.enabled, true);
      const closed = await perform(
        'close_pending',
        id,
        {
          expected_attempt_revision: attempt.revision,
          reason: 'feedback_unknown_unrecoverable',
        },
        { attemptId: attempt.attempt_id },
      );
      assert.equal(closed.is_active, false);
      assert.equal(closed.result, 'pending');
      const preserved = await read.attempt(actor, id, attempt.attempt_id);
      assert.equal(preserved.percentage, null);
      const [oldJob] = await db.query(
        'SELECT * FROM teacher_generation_jobs WHERE id=$1',
        [submitted.job_id],
      );
      const late = {
        schema_version: 1,
        responses: oldJob.input_snapshot.responses.map((r) => ({
          response_id: r.response_id,
          criteria: ['objective', 'accuracy', 'clarity'].map(
            (criterion_id) => ({ criterion_id, points: 2, comment: 'Late' }),
          ),
          uncertain: false,
          explanation: 'Late result',
        })),
      };
      await db.transaction(async (m) => {
        const result = await publisher.publish(m, oldJob, JSON.stringify(late));
        assert.equal(result.publication_state, 'obsolete');
      });
      assert.equal(
        (await read.attempt(actor, id, attempt.attempt_id)).result,
        'pending',
      );
      const again = await perform(
        'start_final',
        id,
        {
          ...body,
          expected_session_revision: (await read.detail(actor, id)).revision,
        },
        { sectionId },
      );
      assert.notEqual(again.job_id, a.job_id);
      const [newJob] = await db.query(
        'SELECT purpose FROM teacher_generation_jobs WHERE id=$1',
        [again.job_id],
      );
      assert.equal(newJob.purpose, 'assessment_only');
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::integer AS n FROM teacher_generation_jobs WHERE attempt_id=$1 AND purpose='written_feedback'",
            [attempt.attempt_id],
          )
        )[0].n,
        1,
      );
      await db.query(
        "UPDATE teacher_generation_jobs SET state='cancelled_before_dispatch',blocks_duplicate=false WHERE id=$1",
        [again.job_id],
      );
    },
  );
  await check(
    'Durable versions, compound FKs, atomic pause and rollback reject cross-session/late writes',
    async () => {
      const otherDraft = await perform('create', null, {
        topic: 'English',
        objective: 'Explain a problem',
        explanation_language: 'es',
        organization: 'days',
        day_count: 2,
      });
      const before = await read.detail(actor, id);
      await assert.rejects(
        perform('pause', id, {
          expected_session_revision: before.revision,
          expected_cursor_revision: before.cursor.revision,
          cursor: {
            phase: 'theory',
            plan_revision_id: planId,
            section_id: sectionId,
            unit_id: unitId,
            content_version_id: randomUUID(),
          },
        }),
        /invalid_input/,
      );
      assert.equal((await read.detail(actor, id)).state, before.state);
      await assert.rejects(
        db.query(
          'INSERT INTO teacher_units(session_id,plan_revision_id,section_id,id,title,ordinal,semantic_hash) VALUES($1,$2,$3,$4,$5,2,$6)',
          [
            otherDraft.session_id,
            planId,
            sectionId,
            randomUUID(),
            'Foreign',
            'a'.repeat(64),
          ],
        ),
      );
      const runner = db.createQueryRunner();
      await runner.connect();
      await assert.rejects(migration.down(runner), /rollback refused/);
      await runner.release();
    },
  );
  await check(
    'Manual future revisions preserve history and reuse only unchanged semantic verification',
    async () => {
      const current = await read.detail(actor, id),
        jobsBefore = (
          await db.query(
            'SELECT count(*)::integer AS n FROM teacher_generation_jobs',
          )
        )[0].n;
      const renamed = structuredClone(current.current_plan.outline);
      renamed.title = 'Display title revision';
      renamed.sections[0].title = 'Same DNS objectives';
      const draft = await perform(
        'patch_proposal',
        id,
        {
          expected_session_revision: current.revision,
          expected_proposal_hash: current.current_plan.content_hash,
          outline: renamed,
        },
        { proposalId: current.current_plan.id },
      );
      assert.notEqual(draft.id, current.current_plan.id);
      assert.equal(
        (await read.detail(actor, id)).revision,
        draft.revision,
        'manual revision ACK must contain the persisted session CAS revision',
      );
      const activated = await perform(
        'activate',
        id,
        {
          expected_session_revision: draft.revision,
          expected_current_plan_revision_id: current.current_plan.id,
          proposal_revision_id: draft.id,
          proposal_hash: draft.content_hash,
        },
        { proposalId: draft.id },
      );
      let revised = await read.detail(actor, id);
      assert.equal(revised.current_plan.id, draft.id);
      assert.equal(revised.state, 'completed');
      assert.equal(revised.section_verifications.length, 1);
      assert.equal((await read.attempt(actor, id, attemptId)).result, 'passed');
      const changed = structuredClone(revised.current_plan.outline);
      changed.sections[0].objectives[0].description =
        'Diagnose a different semantic objective';
      const semanticDraft = await perform(
        'patch_proposal',
        id,
        {
          expected_session_revision: activated.revision,
          expected_proposal_hash: revised.current_plan.content_hash,
          outline: changed,
        },
        { proposalId: revised.current_plan.id },
      );
      await perform(
        'activate',
        id,
        {
          expected_session_revision: semanticDraft.revision,
          expected_current_plan_revision_id: revised.current_plan.id,
          proposal_revision_id: semanticDraft.id,
          proposal_hash: semanticDraft.content_hash,
        },
        { proposalId: semanticDraft.id },
      );
      revised = await read.detail(actor, id);
      assert.equal(revised.state, 'active');
      assert.equal(revised.section_verifications.length, 0);
      assert.equal(
        (await read.attempt(actor, id, attemptId)).earned_points,
        36,
      );
      assert.equal(
        (
          await db.query(
            'SELECT count(*)::integer AS n FROM teacher_generation_jobs',
          )
        )[0].n,
        jobsBefore,
      );
    },
  );
  await check(
    'HTTP runs compiled DTOs with unknown-field rejection, UTF8/body bound and real session ownership',
    async () => {
      class HarnessModule {}
      Module({
        controllers: [TeacherController],
        providers: [
          { provide: TeacherService, useValue: store },
          { provide: ReadTeacherUseCase, useValue: read },
          { provide: ExecuteTeacherCommandUseCase, useValue: command },
        ],
      })(HarnessModule);
      app = await NestFactory.create(HarnessModule, { logger: false });
      app.setGlobalPrefix('api/v1');
      app.use((req, res, next) => {
        const origin = req.headers.origin;
        if (
          typeof origin === 'string' &&
          /^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/.test(origin)
        ) {
          res.setHeader('Access-Control-Allow-Origin', origin);
          res.setHeader('Access-Control-Allow-Credentials', 'true');
          res.setHeader('Vary', 'Origin');
          res.setHeader(
            'Access-Control-Allow-Headers',
            'Authorization,Content-Type,Idempotency-Key,Accept-Language',
          );
          res.setHeader(
            'Access-Control-Allow-Methods',
            'GET,POST,PATCH,OPTIONS',
          );
        }
        if (req.method === 'OPTIONS') {
          res.status(204).end();
          return;
        }
        next();
      });
      app.use('/api/v1/teacher', teacherBodyParser);
      app.use((req, _res, next) => {
        req.auth = {
          user: {
            id: user,
            name: 'Synthetic',
            email: 'fixture@example.test',
            image_url: null,
          },
          sessionId: session,
        };
        next();
      });
      app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
        }),
      );
      app.useGlobalFilters(new AllExceptionsFilter());
      await app.listen(0, '127.0.0.1');
      const url = await app.getUrl();
      const bad = await fetch(`${url}/api/v1/teacher/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': randomUUID(),
        },
        body: JSON.stringify({
          topic: 'x',
          objective: 'y',
          explanation_language: 'en',
          owner_user_id: '2',
        }),
      });
      assert.equal(bad.status, 400);
      const badBody = await bad.json();
      assert.equal(badBody.code, 'invalid_input');
      assert.equal(JSON.stringify(badBody).includes('stack'), false);
      const large = await fetch(`${url}/api/v1/teacher/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': randomUUID(),
        },
        body: JSON.stringify({ topic: 'x'.repeat(270000) }),
      });
      assert.equal(large.status, 413);
      assert.equal((await large.json()).code, 'invalid_input');
      const malformed = await fetch(`${url}/api/v1/teacher/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': randomUUID(),
        },
        body: Buffer.from([123, 34, 97, 34, 58, 34, 255, 34, 125]),
      });
      assert.equal(malformed.status, 400);
      assert.equal((await malformed.json()).code, 'invalid_input');
      const validBody = {
        topic: 'English',
        objective: 'Describe a technical problem',
        explanation_language: 'en',
        organization: 'days',
        day_count: null,
      };
      const created = await fetch(`${url}/api/v1/teacher/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': randomUUID(),
        },
        body: JSON.stringify(validBody),
      });
      assert.equal(created.status, 201);
      const createdBody = await created.json();
      const plainMessage = await fetch(
        `${url}/api/v1/teacher/sessions/${createdBody.session_id}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': randomUUID(),
          },
          body: JSON.stringify({
            expected_session_revision: 1,
            text: 'Keep this draft',
            generate_reply: false,
          }),
        },
      );
      assert.equal(plainMessage.status, 201);
      const detail = await fetch(`${url}/api/v1/teacher/sessions/${id}`);
      assert.equal(detail.status, 200);
      assert.equal(detail.headers.get('cache-control'), 'no-store');
      assert.equal((await detail.json()).owner_user_id, user);
    },
  );
  const report = {
    schema_version: 1,
    environment:
      'disposable PostgreSQL16 Docker, compiled domain/HTTP, synthetic transport only',
    checks,
    limitations: [
      'Does not qualify any real provider or runtime slot/proof behavior.',
      'No operational DB, migration adoption, publication or deployment.',
    ],
  };
  mkdirSync('output', { recursive: true });
  writeFileSync(
    'output/teacher-domain-integration.json',
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(JSON.stringify(report, null, 2));
  if (process.argv.includes('--serve')) {
    // UI QA only: no real provider. The production publisher validates every synthetic result.
    const syntheticOutput = async (j) => {
      const context = j.input_snapshot.session;
      if (j.purpose === 'setup_reply')
        return {
          schema_version: 1,
          text: `Synthetic QA: we can study ${context.topic} by days or topics.`,
          brief: { topic: context.topic, objective: context.objective },
          questions: [],
          organization_options: ['days', 'topics'],
        };
      if (j.purpose === 'plan_outline' || j.purpose === 'plan_adjustment') {
        const byDays = j.input_snapshot.organization === 'days',
          days = byDays ? j.input_snapshot.day_count : null;
        return {
          schema_version: 1,
          outline: {
            ...structuredClone(p),
            title: context.topic,
            topic: context.topic,
            objective: context.objective,
            explanation_language: context.explanation_language,
            organization: byDays ? 'days' : 'topics',
            day_count: days,
            sections: [
              {
                ...structuredClone(p.sections[0]),
                title: context.topic,
                objectives: [{ id: 'o', description: context.objective }],
                units: [
                  {
                    id: 'u',
                    title: context.topic,
                    objective_ids: ['o'],
                    day_start: byDays ? 1 : null,
                    day_end: days,
                  },
                ],
              },
            ],
          },
          guide: g,
        };
      }
      if (j.purpose === 'learning_packet')
        return {
          schema_version: 1,
          unit_id: j.unit_id,
          plan_revision_id: j.plan_revision_id,
          blocks: [
            {
              id: 'theory',
              kind: 'explanation',
              title: 'Synthetic lesson',
              body_markdown: `Synthetic UI QA material for ${context.topic}. This content is a test fixture.`,
            },
            {
              id: 'example',
              kind: 'example',
              title: 'Example',
              body_markdown:
                'Describe a situation and explain the important steps.',
            },
            {
              id: 'practice',
              kind: 'guided_practice',
              title: 'Practice',
              body_markdown: 'Explain the example using your own words.',
            },
          ],
          practice_assessment: await assessmentFor(j.id),
        };
      if (j.purpose === 'assessment_only') return assessmentFor(j.id);
      return {
        schema_version: 1,
        responses: j.input_snapshot.responses.map((r) => ({
          response_id: r.response_id,
          criteria: ['objective', 'accuracy', 'clarity'].map(
            (criterion_id) => ({
              criterion_id,
              points: 2,
              comment: 'Synthetic fixed-rubric feedback',
            }),
          ),
          uncertain: false,
          explanation: 'Synthetic reviewed fixture feedback.',
        })),
      };
    };
    let publishing = false;
    serveTimer = setInterval(async () => {
      if (publishing) return;
      publishing = true;
      try {
        const jobs = await db.query(
          "SELECT j.* FROM teacher_generation_jobs j JOIN teacher_sessions s ON s.id=j.session_id WHERE j.state='queued' AND s.state NOT IN ('paused','archived') ORDER BY j.created_at LIMIT 1",
        );
        if (jobs[0]) {
          try {
            await publish(jobs[0].id, await syntheticOutput(jobs[0]));
          } catch {
            await db.query(
              "UPDATE teacher_generation_jobs SET state='failed_known',blocks_duplicate=false,error_code='invalid_generated_content' WHERE id=$1",
              [jobs[0].id],
            );
          }
        }
      } finally {
        publishing = false;
      }
    }, 200);
    console.log(
      JSON.stringify({
        teacher_qa_server: await app.getUrl(),
        api_prefix: '/api/v1',
        provider: 'synthetic publisher only',
        database: 'disposable Docker',
        actor_id: user,
      }),
    );
    await new Promise((resolve) => {
      process.once('SIGINT', resolve);
      process.once('SIGTERM', resolve);
    });
  }
} finally {
  clearInterval(serveTimer);
  if (app) await app.close();
  if (db?.isInitialized) await db.destroy();
  if (started) docker('stop', container);
}
