import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { teacherUpgradeLab } from './helpers/teacher-upgrade-lab.mjs';
import { ExecuteTeacherCommandUseCase } from '../dist/teacher/use-case/execute-teacher-command.use-case.js';
import { ReadTeacherUseCase } from '../dist/teacher/use-case/read-teacher.use-case.js';
import { TeacherLearningUseCase } from '../dist/teacher/use-case/teacher-learning.use-case.js';
import { saveProposal } from '../dist/teacher/use-case/teacher-plan-persistence.js';
import { defaultPolicy, hash } from '../dist/teacher/policies/teacher-validation.js';
import { learningGenerationContext } from '../dist/teacher/use-case/teacher-learning-persistence.js';
import { admitTeacherGeneration } from '../dist/teacher/use-case/teacher-generation-admission.js';

// Real PostgreSQL authority/transaction/constraint rules; no remote inference or application env.
const lab = await teacherUpgradeLab();
const checks = [];
const check = async (name, work) => { await work(); checks.push(name); };
try {
  const migration = '1793630000000-TeacherLearningEvidence';
  await check('additive learning migration up/down/up on isolated baseline', async () => {
    await lab.migrate(migration); await lab.migrate(migration, 'down'); await lab.migrate(migration);
  });
  await lab.migrate('1793640000000-TeacherLearningEnrichment');
  const command = new ExecuteTeacherCommandUseCase(lab.store, lab.generation);
  const read = new ReadTeacherUseCase(lab.store, lab.generation);
  const learning = new TeacherLearningUseCase(lab.store);
  const created = await command.execute(lab.actor, null, randomUUID(), 'create', {
    topic: 'Synthetic SQL learning QA', objective: 'Explain a left join', explanation_language: 'en', organization: 'topics', day_count: null,
    selection: { connection_id: '1', mode: 'api_key', model_id: 'synthetic-isolated-model', effort_id: null },
  });
  const id = created.session_id;
  const revision = async () => (await lab.db.query('SELECT revision FROM teacher_sessions WHERE id=$1', [id]))[0].revision;
  const bankBody = (reviewed) => ({ expected_session_revision: 0, title: 'Synthetic reviewed fixture',
    dimensions: [{ id: dimension, description: 'Preserving rows without matching keys' }], reviewed,
    items: [{ dimension_id: dimension, kind: 'single_choice', prompt: 'Which join preserves unmatched left rows?',
      options: [{ id: 'left', label: 'Left join' }, { id: 'inner', label: 'Inner join' }],
      private_key: { kind: 'single_choice', option_id: 'left' }, explanation: 'A left join preserves every left row.' },
      { dimension_id: dimension, kind: 'single_choice', prompt: 'An unmatched left row remains in which result?',
        options: [{ id: 'left', label: 'Left join result' }, { id: 'inner', label: 'Inner join result' }],
        private_key: { kind: 'single_choice', option_id: 'left' }, explanation: 'An unmatched left row is retained.' }],
  });
  const dimension = randomUUID();
  await check('empty evidence and absent bank stay unknown; no inference', async () => {
    const view = await learning.read(lab.actor, id);
    assert.deepEqual(view.observations, []); assert.equal(view.diagnostic_blueprint, null);
    await assert.rejects(command.execute(lab.actor, id, randomUUID(), 'start_diagnostic',
      { expected_session_revision: await revision(), entry_route: 'diagnostic' }));
    const [row] = await lab.db.query('SELECT count(*)::integer AS n FROM teacher_generation_jobs');
    assert.equal(row.n, 0);
  });
  await check('learning read/write rejects another owner and revoked module', async () => {
    await assert.rejects(learning.read(lab.other, id));
    await assert.rejects(learning.read(lab.noModule, id));
    await assert.rejects(learning.execute(lab.other, id, randomUUID(), 'blueprint', { ...bankBody(true), expected_session_revision: await revision() }));
  });
  await check('idempotent bank command and stale CAS preserve a single version', async () => {
    const body = { ...bankBody(false), expected_session_revision: await revision() };
    const key = randomUUID();
    const first = await learning.execute(lab.actor, id, key, 'blueprint', body);
    assert.deepEqual(await learning.execute(lab.actor, id, key, 'blueprint', body), first);
    await assert.rejects(learning.execute(lab.actor, id, randomUUID(), 'blueprint', body));
    await assert.rejects(learning.execute(lab.actor, id, key, 'blueprint', { ...body, title: 'Different intent' }));
    await assert.rejects(command.execute(lab.actor, id, randomUUID(), 'start_diagnostic',
      { expected_session_revision: await revision(), entry_route: 'diagnostic' }));
  });
  let attempt;
  await check('reviewed diagnostic starts directly with meaningful dimension and private key', async () => {
    await learning.execute(lab.actor, id, randomUUID(), 'blueprint', { ...bankBody(true), expected_session_revision: await revision() });
    const view = await learning.read(lab.actor, id);
    assert.equal(view.diagnostic_blueprint.dimensions[0].id, dimension);
    assert.equal(view.diagnostic_blueprint.reviewed, true);
    assert.equal(JSON.stringify(view).includes('private_key'), false);
    const started = await command.execute(lab.actor, id, randomUUID(), 'start_diagnostic',
      { expected_session_revision: await revision(), entry_route: 'diagnostic' });
    attempt = await read.attempt(lab.actor, id, started.attempt_id);
    assert.equal(attempt.scope, 'diagnostic'); assert.equal(attempt.result, null);
    const q = await read.question(lab.actor, id, attempt.attempt_id, attempt.questions[0].question_id);
    assert.equal(q.confidence, null); assert.equal(q.self_explanation, null);
    assert.equal(q.feedback, undefined); assert.equal(q.private_key, undefined);
    assert.deepEqual(q.options, (await read.question(lab.actor, id, attempt.attempt_id, q.question_id)).options);
  });
  await check('explicit zero confidence persists; frozen answer rejects later reflection edits', async () => {
    const questionId = attempt.questions[0].question_id;
    let q = await read.question(lab.actor, id, attempt.attempt_id, questionId);
    await learning.execute(lab.actor, id, randomUUID(), 'metadata', {
      expected_session_revision: await revision(), response_id: q.response_id,
      expected_response_revision: q.response_revision, self_explanation: 'I inferred it from preservation of the left rows.', confidence: 0,
    });
    q = await read.question(lab.actor, id, attempt.attempt_id, questionId);
    assert.equal(q.confidence, 0);
    await command.execute(lab.actor, id, randomUUID(), 'submit_question', {
      expected_attempt_revision: attempt.revision, expected_response_revision: q.response_revision,
      answer: { kind: 'single_choice', option_id: 'left' },
    }, { attemptId: attempt.attempt_id, questionId });
    q = await read.question(lab.actor, id, attempt.attempt_id, questionId);
    await assert.rejects(learning.execute(lab.actor, id, randomUUID(), 'metadata', {
      expected_session_revision: await revision(), response_id: q.response_id,
      expected_response_revision: q.response_revision, confidence: 100,
    }));
    const view = await learning.read(lab.actor, id);
    assert.equal(view.observations.length, 1);
    assert.equal(view.observations[0].confidence, 0);
    assert.equal(view.observations[0].objective_id, dimension);
    assert.equal(view.observations[0].earned_points, 2);
    assert.equal((await read.attempt(lab.actor, id, attempt.attempt_id)).result, null);
    assert.equal((await lab.db.query('SELECT count(*)::integer AS n FROM teacher_section_verifications'))[0].n, 0);
  });
  await check('explicit candidate mapping feeds a frozen generation snapshot and excludes later evidence', async () => {
    const section = randomUUID(), objective = randomUUID(), unit = randomUUID();
    const outline = { schema_version: 1, title: 'Join semantics', topic: 'Joins', objective: 'Preserve left rows', explanation_language: 'en', organization: 'topics', day_count: null,
      assessment_policy: defaultPolicy(1), sections: [{ id: section, title: 'Preserving rows', required: true, prerequisite_section_ids: [],
        objectives: [{ id: objective, description: 'Identify preservation of unmatched left rows' }],
        units: [{ id: unit, title: 'Outer joins', objective_ids: [objective], day_start: null, day_end: null }] }] };
    const proposal = await lab.store.scope(lab.actor, id, ({ manager, session, actor }) => saveProposal(manager, session, actor.actorId, outline,
      { schema_version: 1, strategy: 'balanced', context_notes: '', examples_context: '', prerequisite_knowledge: [], preferred_formats: ['single_choice'] }, null), true);
    const context = () => lab.store.scope(lab.actor, id, ({ manager, session }) => learningGenerationContext(manager, session, proposal.id));
    assert.equal((await context()).evidence.length, 0);
    const bank = (await learning.read(lab.actor, id)).diagnostic_blueprint;
    const body = { expected_session_revision: await revision(), blueprint_id: bank.id, dimension_id: dimension,
      plan_revision_id: proposal.id, objective_id: objective };
    await assert.rejects(learning.execute(lab.actor, id, randomUUID(), 'mapping', { ...body, objective_id: randomUUID() }));
    await learning.execute(lab.actor, id, randomUUID(), 'mapping', body);
    const mapped = await context();
    assert.equal(mapped.evidence.length, 1);
    assert.equal(mapped.evidence[0].objective_id, objective);
    assert.equal(mapped.evidence[0].confidence, 0);
    assert.equal(mapped.evidence[0].independent, false);
    const admitted = await lab.store.scope(lab.actor, id, scope => admitTeacherGeneration(scope, lab.generation,
      'plan_outline', { policy: defaultPolicy(1) }, { plan_revision_id: proposal.id }), true);
    const [before] = await lab.db.query('SELECT input_snapshot,input_hash FROM teacher_generation_jobs WHERE id=$1', [admitted.job_id]);
    assert.equal(before.input_snapshot.learning_evidence.evidence.length, 1);
    const current = await read.attempt(lab.actor, id, attempt.attempt_id);
    const questionId = current.questions[1].question_id;
    const q = await read.question(lab.actor, id, attempt.attempt_id, questionId);
    await command.execute(lab.actor, id, randomUUID(), 'submit_question', {
      expected_attempt_revision: current.revision, expected_response_revision: q.response_revision,
      answer: { kind: 'single_choice', option_id: 'left' },
    }, { attemptId: attempt.attempt_id, questionId });
    assert.equal((await context()).evidence.length, 2);
    const [after] = await lab.db.query('SELECT input_snapshot,input_hash FROM teacher_generation_jobs WHERE id=$1', [admitted.job_id]);
    assert.deepEqual(after, before);
    assert.equal(after.input_hash, hash(after.input_snapshot));
  });
  await check('rollback refuses to erase admitted learning evidence', async () => {
    await assert.rejects(lab.migrate(migration, 'down'));
    assert.equal((await learning.read(lab.actor, id)).observations.length, 2);
  });
  console.log(JSON.stringify({ task: 'teacher_upgrade_core_integration', status: 'passed', checks,
    limitations: ['Synthetic transport, real isolated PostgreSQL; no deployed app, provider qualification or pedagogical effectiveness claim.'] }));
} finally { await lab.close(); }
