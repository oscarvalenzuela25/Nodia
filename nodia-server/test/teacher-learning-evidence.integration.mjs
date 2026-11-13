import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { teacherUpgradeLab } from './helpers/teacher-upgrade-lab.mjs';
import { ExecuteTeacherCommandUseCase } from '../dist/teacher/use-case/execute-teacher-command.use-case.js';
import { ReadTeacherUseCase } from '../dist/teacher/use-case/read-teacher.use-case.js';
import { TeacherLearningUseCase } from '../dist/teacher/use-case/teacher-learning.use-case.js';
import { saveProposal } from '../dist/teacher/use-case/teacher-plan-persistence.js';
import { publishAssessment, startStoredAttempt } from '../dist/teacher/use-case/teacher-attempt-persistence.js';
import { learningGenerationContext, refreshLearningEvidence } from '../dist/teacher/use-case/teacher-learning-persistence.js';
import { canonical, defaultPolicy, hash } from '../dist/teacher/policies/teacher-validation.js';

const lab = await teacherUpgradeLab();
const checks = [];
const measurements = [];
const check = async (name, work) => { await work(); checks.push(name); };
try {
  await lab.migrate('1793630000000-TeacherLearningEvidence');
  await lab.migrate('1793640000000-TeacherLearningEnrichment');
  const core = new ExecuteTeacherCommandUseCase(lab.store, lab.generation);
  const learning = new TeacherLearningUseCase(lab.store);
  const read = new ReadTeacherUseCase(lab.store, lab.generation);
  const revision = async id => (await lab.db.query('SELECT revision FROM teacher_sessions WHERE id=$1', [id]))[0].revision;
  const create = async (actor = lab.actor) => (await core.execute(actor, null, randomUUID(), 'create', {
    topic: 'Synthetic evidence QA', objective: 'Explain atomic transactions', explanation_language: 'en', organization: 'topics', day_count: null,
    selection: { connection_id: '1', mode: 'api_key', model_id: 'synthetic-isolated-model', effort_id: null },
  })).session_id;
  const id = await create();
  const section = randomUUID(), objective = randomUUID(), unit = randomUUID(), dimension = randomUUID();
  const otherObjective = randomUUID(), otherUnit = randomUUID();
  const outline = { schema_version: 1, title: 'Atomic operations', topic: 'Transactions', objective: 'Explain atomic writes', explanation_language: 'en', organization: 'topics', day_count: null,
    assessment_policy: defaultPolicy(1), sections: [{ id: section, title: 'Atomicity', required: true, prerequisite_section_ids: [],
      objectives: [{ id: objective, description: 'Identify all-or-nothing writes' }, { id: otherObjective, description: 'Explain persistence after commit' }],
      units: [{ id: unit, title: 'Transactions', objective_ids: [objective], day_start: null, day_end: null },
        { id: otherUnit, title: 'Durability', objective_ids: [otherObjective], day_start: null, day_end: null }] }] };
  const guide = { schema_version: 1, strategy: 'balanced', context_notes: '', examples_context: '', prerequisite_knowledge: [], preferred_formats: ['completion'] };
  const proposal = await lab.store.scope(lab.actor, id, ({ manager, session, actor }) => saveProposal(manager, session, actor.actorId, outline, guide, null), true);
  const bank = await learning.execute(lab.actor, id, randomUUID(), 'blueprint', {
    expected_session_revision: await revision(id), title: 'Atomicity fixture', dimensions: [{ id: dimension, description: 'All-or-nothing changes' }], reviewed: true,
    items: [{ dimension_id: dimension, kind: 'completion', prompt: 'Name the all-or-nothing property.',
      private_key: { kind: 'completion', alternatives: ['atomicity'], case_sensitive: false }, explanation: 'Atomicity commits all changes together.' }],
  });
  let diagnostic;
  await check('diagnostic pause/resume preserves answer, confidence, cursor, receipt and absence of inference', async () => {
    const admitted = await core.execute(lab.actor, id, randomUUID(), 'start_diagnostic', { expected_session_revision: await revision(id), entry_route: 'diagnostic' });
    diagnostic = await read.attempt(lab.actor, id, admitted.attempt_id);
    const q = await read.question(lab.actor, id, diagnostic.attempt_id, diagnostic.questions[0].question_id);
    await learning.execute(lab.actor, id, randomUUID(), 'metadata', { expected_session_revision: await revision(id), response_id: q.response_id,
      expected_response_revision: q.response_revision, self_explanation: 'Only a portion of a transaction may be committed.', confidence: 0 });
    const current = await read.question(lab.actor, id, diagnostic.attempt_id, q.question_id);
    const session = await read.detail(lab.actor, id);
    const pauseKey = randomUUID();
    const pauseBody = { expected_session_revision: await revision(id), expected_cursor_revision: session.cursor.revision,
      cursor: { phase: 'practice', attempt_id: diagnostic.attempt_id, item_id: q.question_id, plan_revision_id: null, section_id: null, unit_id: null },
      attempt_id: diagnostic.attempt_id, expected_attempt_revision: diagnostic.revision,
      pending_responses: [{ question_id: q.question_id, expected_response_revision: current.response_revision, answer: { kind: 'completion', text: 'atomicity' } }] };
    const paused = await core.execute(lab.actor, id, pauseKey, 'pause', pauseBody);
    assert.deepEqual(await core.execute(lab.actor, id, pauseKey, 'pause', pauseBody), paused);
    const saved = await read.question(lab.actor, id, diagnostic.attempt_id, q.question_id);
    assert.equal(saved.draft_answer.text, 'atomicity'); assert.equal(saved.confidence, 0);
    assert.equal(saved.self_explanation, 'Only a portion of a transaction may be committed.');
    await assert.rejects(core.execute(lab.actor, id, randomUUID(), 'submit_question', { expected_attempt_revision: diagnostic.revision,
      expected_response_revision: saved.response_revision, answer: { kind: 'completion', text: 'atomicity' } }, { attemptId: diagnostic.attempt_id, questionId: q.question_id }));
    await core.execute(lab.actor, id, randomUUID(), 'resume', { expected_session_revision: await revision(id) });
    const resumed = await read.detail(lab.actor, id);
    assert.equal(resumed.cursor.attempt_id, diagnostic.attempt_id); assert.equal(resumed.cursor.item_id, q.question_id);
    const fresh = await read.attempt(lab.actor, id, diagnostic.attempt_id);
    await core.execute(lab.actor, id, randomUUID(), 'submit_question', { expected_attempt_revision: fresh.revision,
      expected_response_revision: saved.response_revision, answer: saved.draft_answer }, { attemptId: diagnostic.attempt_id, questionId: q.question_id });
    const observed = (await learning.read(lab.actor, id)).observations[0];
    assert.equal(observed.earned_points, 2); assert.equal(observed.confidence, 0);
    assert.equal(observed.self_explanation, 'Only a portion of a transaction may be committed.');
    assert.equal(observed.independent, false);
    const [count] = await lab.db.query('SELECT count(*)::integer AS n FROM teacher_generation_jobs');
    assert.equal(count.n, 0);
  });
  await check('mapping rejects another session or missing objective and does not follow revisions by matching IDs', async () => {
    const foreign = await create(lab.other);
    const foreignPlan = await lab.store.scope(lab.other, foreign, ({ manager, session, actor }) => saveProposal(manager, session, actor.actorId, outline, guide, null), true);
    const base = { expected_session_revision: await revision(id), blueprint_id: bank.blueprint_id, dimension_id: dimension, plan_revision_id: proposal.id, objective_id: objective };
    await assert.rejects(learning.execute(lab.actor, id, randomUUID(), 'mapping', { ...base, plan_revision_id: foreignPlan.id }));
    await assert.rejects(learning.execute(lab.actor, id, randomUUID(), 'mapping', { ...base, objective_id: randomUUID() }));
    await learning.execute(lab.actor, id, randomUUID(), 'mapping', base);
    const newer = await lab.store.scope(lab.actor, id, ({ manager, session, actor }) => saveProposal(manager, session, actor.actorId,
      { ...outline, title: 'Revised condition', sections: [{ ...outline.sections[0], objectives: outline.sections[0].objectives.map(o => o.id === objective ? { ...o, description: 'A different explicit condition' } : o) }] }, guide, null), true);
    const context = plan => lab.store.scope(lab.actor, id, ({ manager, session }) => learningGenerationContext(manager, session, plan));
    assert.equal((await context(proposal.id)).evidence.length, 1);
    assert.equal((await context(newer.id)).evidence.length, 0);
    await core.execute(lab.actor, id, randomUUID(), 'accept', { expected_session_revision: await revision(id), proposal_revision_id: proposal.id, proposal_hash: proposal.content_hash }, { proposalId: proposal.id });
    assert.equal((await read.detail(lab.actor, id)).current_plan.id, proposal.id);
  });
  const job = await core.execute(lab.actor, id, randomUUID(), 'material', { expected_session_revision: await revision(id), plan_revision_id: proposal.id, variant: 'current' }, { unitId: unit });
  const contentId = randomUUID();
  const blocks = [{ id: 'predict', kind: 'prediction', title: 'Predict', body_markdown: 'What happens after a failed write?' },
    { id: 'explain', kind: 'explanation', title: 'Atomicity', body_markdown: 'All related writes commit together.' },
    { id: 'check', kind: 'check', title: 'Apply', body_markdown: 'Apply the rule to a transfer.' }];
  await lab.db.query("INSERT INTO teacher_content_versions(id,session_id,plan_revision_id,unit_id,version_no,generation_job_id,context_hash,public_blocks,content_hash,publication_state) VALUES($1,$2,$3,$4,1,$5,$6,$7,$8,'current')", [contentId, id, proposal.id, unit, job.job_id, hash({ synthetic: true }), JSON.stringify(blocks), hash(blocks)]);
  const otherJob = await core.execute(lab.actor, id, randomUUID(), 'material', { expected_session_revision: await revision(id), plan_revision_id: proposal.id, variant: 'current' }, { unitId: otherUnit });
  const otherContentId = randomUUID();
  await lab.db.query("INSERT INTO teacher_content_versions(id,session_id,plan_revision_id,unit_id,version_no,generation_job_id,context_hash,public_blocks,content_hash,publication_state) VALUES($1,$2,$3,$4,1,$5,$6,$7,$8,'current')", [otherContentId, id, proposal.id, otherUnit, otherJob.job_id, hash({ synthetic: true }), JSON.stringify(blocks), hash(blocks)]);
  await check('lesson interactions preserve exact kind/version, replay once, enforce CAS and serialize context dates', async () => {
    const body = { expected_session_revision: await revision(id), content_version_id: contentId, block_id: 'predict', kind: 'prediction', text: 'I expect a partial write.' };
    await assert.rejects(learning.execute(lab.actor, id, randomUUID(), 'interaction', { ...body, block_id: 'explain' }));
    await assert.rejects(learning.execute(lab.actor, id, randomUUID(), 'interaction', { ...body, kind: 'check' }));
    await assert.rejects(learning.execute(lab.other, id, randomUUID(), 'interaction', body));
    const key = randomUUID(); const first = await learning.execute(lab.actor, id, key, 'interaction', body);
    assert.deepEqual(await learning.execute(lab.actor, id, key, 'interaction', body), first);
    const checkBody = { expected_session_revision: await revision(id), content_version_id: contentId, block_id: 'check', kind: 'check', text: 'Neither side changes after failure.' };
    const raced = await Promise.allSettled([1, 2].map(() => learning.execute(lab.actor, id, randomUUID(), 'interaction', checkBody)));
    assert.equal(raced.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(raced.filter(r => r.status === 'rejected').length, 1);
    const context = await lab.store.scope(lab.actor, id, ({ manager, session }) => learningGenerationContext(manager, session, proposal.id, unit));
    assert.equal(context.lesson_interactions.length, 2);
    assert.ok(context.lesson_interactions.every(i => typeof i.created_at === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(i.created_at)));
    assert.ok(canonical(context).includes(context.lesson_interactions[0].created_at));
    const initialMaterial = await read.material(lab.actor, id, unit, proposal.id);
    assert.equal(initialMaterial.lesson_interactions.length, 2);
    assert.ok(initialMaterial.lesson_interactions.every(i => i.content_version_id === contentId && typeof i.created_at === 'string'));
    await learning.execute(lab.actor, id, randomUUID(), 'interaction', { expected_session_revision: await revision(id),
      content_version_id: otherContentId, block_id: 'check', kind: 'check', text: 'An interaction from the other unit must not appear here.' });
    const currentMaterial = await read.material(lab.actor, id, unit, proposal.id);
    assert.deepEqual(currentMaterial.lesson_interactions, initialMaterial.lesson_interactions);
    assert.equal((await read.material(lab.actor, id, otherUnit, proposal.id)).lesson_interactions.length, 1);
    await assert.rejects(read.material(lab.other, id, unit, proposal.id));
    const before = (await learning.read(lab.actor, id)).interactions;
    assert.deepEqual((await learning.read(lab.actor, id)).interactions, before);
    await lab.db.query("UPDATE teacher_content_versions SET publication_state='superseded' WHERE id=$1", [contentId]);
    await assert.rejects(learning.execute(lab.actor, id, randomUUID(), 'interaction', { ...checkBody, expected_session_revision: await revision(id) }));
    assert.deepEqual((await learning.read(lab.actor, id)).interactions, before);
    await lab.db.query("UPDATE teacher_content_versions SET publication_state='current' WHERE id=$1", [contentId]);
  });
  const item = (prompt, index = 1) => ({ local_ref: String(index), objective_id: objective, kind: 'completion', prompt,
    private_key: { kind: 'completion', alternatives: ['atomicity'], case_sensitive: false }, explanation: 'Atomicity commits all writes or none.',
    hint: 'Consider whether related changes form a single operation.' });
  const attempt = async (items, targetUnit = unit, targetContent = contentId, targetJob = job.job_id) => lab.store.scope(lab.actor, id, async ({ manager, session }) => {
    const assessmentId = await publishAssessment(manager, session, targetJob, { schema_version: 1, scope: 'unit_practice', plan_revision_id: proposal.id, section_id: section, unit_id: targetUnit, items },
      items.map((i, n) => ({ ordinal: n + 1, objective_id: i.objective_id, kind: 'completion', max_points: 2 })), defaultPolicy(1), targetContent);
    return startStoredAttempt(manager, session, assessmentId, 'practice');
  }, true);
  const submit = async (attemptId, questionId, text) => {
    const a = await read.attempt(lab.actor, id, attemptId), q = await read.question(lab.actor, id, attemptId, questionId);
    return core.execute(lab.actor, id, randomUUID(), 'submit_question', { expected_attempt_revision: a.revision, expected_response_revision: q.response_revision,
      answer: { kind: 'completion', text } }, { attemptId, questionId });
  };
  const finish = async attemptId => core.execute(lab.actor, id, randomUUID(), 'submit_attempt', { expected_attempt_revision: (await read.attempt(lab.actor, id, attemptId)).revision }, { attemptId });
  await check('error then help then repeated task stay distinct from a genuinely new independent occurrence', async () => {
    const first = await attempt([item('Which property commits related changes together?'), item('Which property prevents half a write?', 2)]);
    const a = await read.attempt(lab.actor, id, first.attempt_id);
    await submit(a.attempt_id, a.questions[0].question_id, 'durability');
    const original = (await learning.read(lab.actor, id)).observations.find(o => o.attempt_id === a.attempt_id);
    assert.equal(original.earned_points, 0); assert.equal(original.independent, true);
    const withFirst = await read.attempt(lab.actor, id, a.attempt_id);
    await core.execute(lab.actor, id, randomUUID(), 'help', { expected_attempt_revision: withFirst.revision,
      question_id: a.questions[1].question_id, accept_assisted_attempt: true }, { attemptId: a.attempt_id });
    await submit(a.attempt_id, a.questions[1].question_id, 'atomicity');
    await finish(a.attempt_id);
    const assisted = (await learning.read(lab.actor, id)).observations.find(o => o.attempt_id === a.attempt_id && o.earned_points === 2);
    assert.equal(assisted.assisted, true); assert.equal(assisted.independent, false);
    const repeated = await attempt([item('Which property commits related changes together?')]);
    const repeatedView = await read.attempt(lab.actor, id, repeated.attempt_id);
    assert.equal(repeatedView.assisted, true);
    await submit(repeated.attempt_id, repeatedView.questions[0].question_id, 'atomicity');
    await finish(repeated.attempt_id);
    const seen = (await learning.read(lab.actor, id)).observations.find(o => o.attempt_id === repeated.attempt_id);
    assert.equal(seen.earned_points, 2); assert.equal(seen.independent, false);
    const [provenance] = await lab.db.query('SELECT assistance FROM teacher_responses WHERE attempt_id=$1', [repeated.attempt_id]);
    assert.equal(provenance.assistance.previously_seen_item, true);
    const novel = await attempt([item('A bank transfer fails after its debit: name the property that also rolls back the credit.')]);
    const novelView = await read.attempt(lab.actor, id, novel.attempt_id);
    assert.equal(novelView.assisted, false);
    await submit(novel.attempt_id, novelView.questions[0].question_id, 'atomicity');
    await finish(novel.attempt_id);
    const finalView = await learning.read(lab.actor, id);
    assert.equal(finalView.observations.find(o => o.attempt_id === novel.attempt_id).independent, true);
    assert.deepEqual(finalView.observations.find(o => o.id === original.id), original);
    assert.equal((await lab.db.query('SELECT count(*)::integer AS n FROM teacher_section_verifications WHERE session_id=$1', [id]))[0].n, 0);
  });
  await check('evidence refresh has one bounded SQL statement and is idempotent at128 pending rows', async () => {
    for (let batch = 0; batch < 8; batch++) {
      const a = await attempt(Array.from({ length: 16 }, (_, i) => item(`Synthetic batch ${batch}, task ${i}: name the transaction property.`, i + 1)));
      await lab.db.query("UPDATE teacher_responses SET submitted_at=clock_timestamp(),frozen_answer=$2,grade_state='graded',earned_points=2 WHERE attempt_id=$1", [a.attempt_id, JSON.stringify({ kind: 'completion', text: 'atomicity' })]);
      await lab.db.query("UPDATE teacher_attempts SET state='graded',is_active=false,closed_at=clock_timestamp(),earned_points=denominator_points WHERE id=$1", [a.attempt_id]);
    }
    const fingerprintRows = async manager => manager.query('SELECT response_id,attempt_id,objective_id,description,plan_revision_id,answer_state,earned_points,max_points,assisted,self_explanation,confidence,observed_at FROM teacher_learning_evidence WHERE session_id=$1 ORDER BY response_id,objective_id,answer_state', [id]);
    const measure = async (label, work) => {
      const runner = lab.db.createQueryRunner(); await runner.connect(); await runner.startTransaction();
      try {
        let calls = 0;
        const manager = { query: (...args) => { calls++; return runner.manager.query(...args); } };
        const before = await fingerprintRows(runner.manager);
        const started = performance.now(); await work(manager, id); const elapsed = performance.now() - started;
        const after = await fingerprintRows(runner.manager);
        assert.equal(after.length - before.length, 128);
        measurements.push({ label, responses: 128, calls, elapsed_ms: Number(elapsed.toFixed(3)) });
        return after;
      } finally { await runner.rollbackTransaction(); await runner.release(); }
    };
    const baselineArg = process.argv.find(a => a.startsWith('--baseline-module='));
    let baseline;
    if (baselineArg) {
      const file = resolve(baselineArg.slice('--baseline-module='.length));
      const bytes = await readFile(file);
      baseline = (await import(pathToFileURL(file).href)).refreshLearningEvidence;
      measurements.push({ baseline_sha256: createHash('sha256').update(bytes).digest('hex') });
    }
    for (let sample = 0; sample < 3; sample++) {
      const expected = baseline ? await measure('before_per_row', baseline) : null;
      const actual = await measure('after_set_based', refreshLearningEvidence);
      if (expected) assert.deepEqual(actual, expected);
      assert.equal(measurements.at(-1).calls, 1);
    }
    await lab.store.scope(lab.actor, id, ({ manager }) => refreshLearningEvidence(manager, id), true);
    const before = await fingerprintRows(lab.db);
    await lab.store.scope(lab.actor, id, ({ manager }) => refreshLearningEvidence(manager, id), true);
    assert.deepEqual(await fingerprintRows(lab.db), before);
  });
  await check('generation filters target revision and objective before its evidence cap', async () => {
    for (let batch = 0; batch < 7; batch++) {
      const items = Array.from({ length: 16 }, (_, i) => ({ ...item(`Unrelated durability ${batch}, task ${i}.`, i + 1), objective_id: otherObjective }));
      const a = await attempt(items, otherUnit, otherContentId, otherJob.job_id);
      await lab.db.query("UPDATE teacher_responses SET submitted_at=clock_timestamp(),frozen_answer=$2,grade_state='graded',earned_points=2 WHERE attempt_id=$1", [a.attempt_id, JSON.stringify({ kind: 'completion', text: 'atomicity' })]);
      await lab.db.query("UPDATE teacher_attempts SET state='graded',is_active=false,closed_at=clock_timestamp(),earned_points=denominator_points WHERE id=$1", [a.attempt_id]);
    }
    await lab.store.scope(lab.actor, id, ({ manager }) => refreshLearningEvidence(manager, id), true);
    // A global last100 view now contains only the newer unrelated objective.
    assert.ok((await learning.read(lab.actor, id)).observations.every(o => o.objective_id === otherObjective));
    const focus = await lab.store.scope(lab.actor, id, ({ manager, session }) => learningGenerationContext(manager, session, proposal.id, unit));
    assert.equal(focus.evidence.length, 12);
    assert.ok(focus.evidence.every(o => o.objective_id === objective));
    assert.notEqual(focus.target_focus.find(o => o.objective_id === objective).reason, 'insufficient_evidence');
    assert.ok(focus.response_details.length > 0);
  });
  console.log(JSON.stringify({ task: 'teacher_learning_evidence_qa', checks, measurements,
    environment: 'PostgreSQL16 disposable; compiled real Teacher core and synthetic generation port', remote_posts: 0,
    limitations: ['No provider, deployed JWT/UI or educational-effect qualification. Novel fixture task checks occurrence identity, not measured transfer efficacy.'] }));
} finally { await lab.close(); }
