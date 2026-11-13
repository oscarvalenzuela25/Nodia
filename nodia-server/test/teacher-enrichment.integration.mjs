import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { teacherUpgradeLab } from './helpers/teacher-upgrade-lab.mjs';
import { ExecuteTeacherCommandUseCase } from '../dist/teacher/use-case/execute-teacher-command.use-case.js';
import { TeacherEnrichmentUseCase } from '../dist/teacher/use-case/teacher-enrichment.use-case.js';
import { saveProposal } from '../dist/teacher/use-case/teacher-plan-persistence.js';
import { defaultPolicy, hash } from '../dist/teacher/policies/teacher-validation.js';
import { publishAssessment, startStoredAttempt } from '../dist/teacher/use-case/teacher-attempt-persistence.js';
import { validateEnrichmentCitations, publishEnrichmentReply } from '../dist/teacher/use-case/teacher-enrichment-persistence.js';

const lab = await teacherUpgradeLab();
const checks = [];
const check = async (name, work) => { await work(); checks.push(name); };
try {
  await lab.migrate('1793630000000-TeacherLearningEvidence');
  const migration = '1793640000000-TeacherLearningEnrichment';
  await check('enrichment migration up/down/up preserves baseline', async () => {
    await lab.migrate(migration); await lab.migrate(migration, 'down'); await lab.migrate(migration);
  });
  const core = new ExecuteTeacherCommandUseCase(lab.store, lab.generation);
  const enrichment = new TeacherEnrichmentUseCase(lab.store, lab.generation);
  const create = async (actor = lab.actor) => (await core.execute(actor, null, randomUUID(), 'create', {
    topic: 'Synthetic transaction QA', objective: 'Explain atomic writes', explanation_language: 'en', organization: 'topics', day_count: null,
    selection: { connection_id: '1', mode: 'api_key', model_id: 'synthetic-isolated-model', effort_id: null },
  })).session_id;
  const id = await create();
  const run = async (operation, payload, key = randomUUID(), sessionId = id) => enrichment.execute(lab.actor, sessionId, key, {
    expected_revision: (await enrichment.dashboard(lab.actor, sessionId)).revision, operation, payload,
  });
  await check('private empty dashboard and ownership denials', async () => {
    const view = await enrichment.dashboard(lab.actor, id);
    assert.equal(view.revision, 0); assert.deepEqual(view.review_cards, []);
    await assert.rejects(enrichment.dashboard(lab.other, id));
    await assert.rejects(enrichment.dashboard(lab.noModule, id));
  });
  await check('lost-response receipt and concurrent CAS apply once', async () => {
    const body = { expected_revision: 0, operation: 'card_create', payload: { question: 'What is atomicity?', answer: 'All or nothing.', timezone: 'America/Santiago' } };
    const key = randomUUID();
    const first = await enrichment.execute(lab.actor, id, key, body);
    assert.deepEqual(await enrichment.execute(lab.actor, id, key, body), first);
    const sameRevision = (await enrichment.dashboard(lab.actor, id)).revision;
    const results = await Promise.allSettled([1, 2].map(n => enrichment.execute(lab.actor, id, randomUUID(), {
      expected_revision: sameRevision, operation: 'concept_create', payload: { label: `Concurrent ${n}`, statement: 'Synthetic concurrency observation.' },
    })));
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(results.filter(r => r.status === 'rejected').length, 1);
    assert.equal((await enrichment.dashboard(lab.actor, id)).review_cards.length, 1);
  });
  await check('rating is not section verification and cannot be applied twice', async () => {
    const card = (await enrichment.dashboard(lab.actor, id)).review_cards[0];
    await run('review_rate', { card_id: card.id, expected_card_revision: card.revision, rating: 1 });
    const updated = (await enrichment.dashboard(lab.actor, id)).review_cards[0];
    assert.equal(updated.reviews, 1); assert.equal(updated.state, 'learning');
    await assert.rejects(run('review_rate', { card_id: card.id, expected_card_revision: updated.revision, rating: 3 }));
    assert.equal((await lab.db.query('SELECT count(*)::integer AS n FROM teacher_section_verifications'))[0].n, 0);
  });
  let source;
  await check('text source deduplication, real citation verification and private snapshot', async () => {
    const payload = { title: 'Synthetic source', media_type: 'text/plain', text: 'An atomic transaction commits all changes or none of them.' };
    source = await run('source_create', payload);
    assert.equal((await run('source_create', payload)).resource_id, source.resource_id);
    const saved = await enrichment.source(lab.actor, id, source.resource_id);
    assert.equal(saved.pages[0].text, payload.text);
    await assert.rejects(enrichment.source(lab.other, id, source.resource_id));
    const citation = { source_id: source.resource_id, content_hash: saved.content_hash, page: 1, quote: 'all changes or none' };
    const admitted = { sources: [{ source_id: source.resource_id, content_hash: saved.content_hash, pages: saved.pages }] };
    await lab.store.scope(lab.actor, id, async ({ manager }) => {
      assert.deepEqual(await validateEnrichmentCitations(manager, id, [citation], admitted), [citation]);
      await assert.rejects(validateEnrichmentCitations(manager, id, [{ ...citation, quote: 'fabricated quotation' }], admitted));
      await assert.rejects(validateEnrichmentCitations(manager, id, [{ ...citation, page: 2 }], admitted));
      await assert.rejects(validateEnrichmentCitations(manager, id, [{ ...citation, content_hash: '0'.repeat(64) }], admitted));
    });
    await assert.rejects(run('source_create', { title: 'Corrupt', media_type: 'application/pdf', base64: Buffer.from('%PDF-broken').toString('base64') }));
  });
  await check('activity snapshots hide solutions; authored answers never claim independence', async () => {
    const activity = await run('activity_create', { kind: 'completion', prompt: 'Which property means all or nothing?', payload: {}, solution: 'atomicity' });
    const view = (await enrichment.dashboard(lab.actor, id)).activities.find(a => a.id === activity.resource_id);
    assert.equal(view.solution, undefined);
    const result = await run('activity_respond', { activity_id: view.id, expected_activity_revision: view.revision, answer: 'atomicity' });
    assert.equal(result.observation.correct, true); assert.equal(result.observation.independent, false);
    assert.equal(result.observation.grants_verification, false);
    await assert.rejects(run('activity_create', { kind: 'javascript', prompt: 'Run code', payload: {}, solution: '' }));
    await assert.rejects(run('visual_create', { kind: 'html', title: 'Unsafe', labels: ['one'], values: [1] }));
  });
  await check('cross-plan equivalence keeps same-owner authority and is reversible', async () => {
    const targetSession = await create();
    const foreignSession = await create(lab.other);
    const from = await run('concept_create', { label: 'Atomic', statement: 'All changes or none', conditions: 'Database transaction' });
    const to = await run('concept_create', { label: 'Atomic', statement: 'All writes or none', conditions: 'Database transaction' }, randomUUID(), targetSession);
    const foreign = await enrichment.execute(lab.other, foreignSession, randomUUID(), { expected_revision: 0, operation: 'concept_create', payload: { label: 'Private', statement: 'Private other owner' } });
    await assert.rejects(run('equivalence_set', { from_concept_id: from.resource_id, to_concept_id: foreign.resource_id, state: 'accepted' }));
    const eq = await run('equivalence_set', { from_concept_id: from.resource_id, to_concept_id: to.resource_id, state: 'accepted' });
    const view = (await enrichment.dashboard(lab.actor, id)).equivalences.find(e => e.id === eq.resource_id);
    assert.equal(view.transfers_verification, false);
    await run('equivalence_set', { from_concept_id: from.resource_id, to_concept_id: to.resource_id, state: 'rejected', expected_equivalence_revision: view.revision });
    assert.equal((await enrichment.dashboard(lab.actor, id)).equivalences.find(e => e.id === eq.resource_id).state, 'rejected');
  });
  await check('contextual helper checks exact anchor and final boundary before dispatch', async () => {
    const section = randomUUID(), objective = randomUUID(), unit = randomUUID();
    const outline = { schema_version: 1, title: 'Transactions', topic: 'Transactions', objective: 'Explain atomic writes', explanation_language: 'en', organization: 'topics', day_count: null,
      assessment_policy: defaultPolicy(1), sections: [{ id: section, title: 'Atomic writes', required: true, prerequisite_section_ids: [], objectives: [{ id: objective, description: 'Explain atomicity' }], units: [{ id: unit, title: 'Atomicity', objective_ids: [objective], day_start: null, day_end: null }] }] };
    const proposal = await lab.store.scope(lab.actor, id, ({ manager, session, actor }) => saveProposal(manager, session, actor.actorId, outline,
      { schema_version: 1, strategy: 'balanced', context_notes: '', examples_context: '', prerequisite_knowledge: [], preferred_formats: ['single_choice'] }, null), true);
    const sessionRevision = (await lab.db.query('SELECT revision FROM teacher_sessions WHERE id=$1', [id]))[0].revision;
    await core.execute(lab.actor, id, randomUUID(), 'accept', { expected_session_revision: sessionRevision, proposal_revision_id: proposal.id, proposal_hash: proposal.content_hash }, { proposalId: proposal.id });
    const current = (await lab.db.query('SELECT revision FROM teacher_sessions WHERE id=$1', [id]))[0].revision;
    const job = await core.execute(lab.actor, id, randomUUID(), 'material', { expected_session_revision: current, plan_revision_id: proposal.id, variant: 'current' }, { unitId: unit });
    const contentId = randomUUID(); const blocks = [{ id: 'atomicity', kind: 'explanation', title: 'Atomicity', body_markdown: 'Atomic writes commit all changes together.' }];
    await lab.db.query("INSERT INTO teacher_content_versions(id,session_id,plan_revision_id,unit_id,version_no,generation_job_id,context_hash,public_blocks,content_hash,publication_state) VALUES($1,$2,$3,$4,1,$5,$6,$7,$8,'current')", [contentId, id, proposal.id, unit, job.job_id, hash({ synthetic: true }), JSON.stringify(blocks), hash(blocks)]);
    await assert.rejects(run('thread_create', { content_version_id: contentId, block_id: 'atomicity', selection: 'Text that is absent' }));
    const thread = await run('thread_create', { content_version_id: contentId, block_id: 'atomicity', selection: 'commit all changes' });
    assert.equal((await enrichment.thread(lab.actor, id, thread.resource_id)).messages.length, 0);
    await lab.db.query("UPDATE teacher_generation_jobs SET state='failed_known',blocks_duplicate=false WHERE id=$1", [job.job_id]);
    const result = await run('thread_message', { thread_id: thread.resource_id, text: 'Explain the selected phrase.' });
    const [stored] = await lab.db.query('SELECT * FROM teacher_generation_jobs WHERE id=$1', [result.job_id]);
    assert.equal(stored.purpose, 'contextual_reply');
    assert.equal(stored.input_snapshot.visible_context, blocks[0].body_markdown);
    await lab.store.scope(lab.actor, id, async ({ manager }) => {
      await publishEnrichmentReply(manager, stored, JSON.stringify({ schema_version: 1, text: 'The writes succeed together or none are committed.' }));
    }, true);
    const history = await enrichment.thread(lab.actor, id, thread.resource_id);
    assert.equal(history.messages.length, 2);
    await lab.store.scope(lab.actor, id, async ({ manager, session }) => {
      const assessmentId = await publishAssessment(manager, session, job.job_id, {
        schema_version: 1, scope: 'section_final', plan_revision_id: proposal.id, section_id: section, unit_id: null,
        items: [{ local_ref: 'one', objective_id: objective, kind: 'single_choice', prompt: 'Choose the atomic outcome.',
          options: [{ id: 'all', label: 'All changes' }, { id: 'some', label: 'Only some changes' }],
          private_key: { kind: 'single_choice', option_id: 'all' }, explanation: 'Atomic changes commit together.' }],
      }, [{ ordinal: 1, objective_id: objective, kind: 'single_choice', max_points: 2 }], defaultPolicy(1), null);
      await startStoredAttempt(manager, session, assessmentId, 'direct');
    }, true);
    const jobCount = (await lab.db.query('SELECT count(*)::integer AS n FROM teacher_generation_jobs'))[0].n;
    await assert.rejects(run('thread_message', { thread_id: thread.resource_id, text: 'Help while a final is active.' }));
    await assert.rejects(lab.store.scope(lab.actor, id, ({ manager }) => publishEnrichmentReply(manager, stored,
      JSON.stringify({ schema_version: 1, text: 'Late reply must not publish during final.' })), true));
    assert.equal((await lab.db.query('SELECT count(*)::integer AS n FROM teacher_generation_jobs'))[0].n, jobCount);
    assert.equal((await enrichment.thread(lab.actor, id, thread.resource_id)).messages.length, 2);
    await lab.db.query("UPDATE teacher_sessions SET state='archived' WHERE id=$1", [id]);
    await assert.rejects(run('thread_message', { thread_id: thread.resource_id, text: 'Do not generate while archived.' }));
    assert.equal((await enrichment.thread(lab.actor, id, thread.resource_id)).messages.length, 2);
  });
  await check('backup restores all populated tables, immutable events, receipts and unknown fixture exactly', async () => {
    const [job] = await lab.db.query('SELECT id FROM teacher_generation_jobs ORDER BY created_at LIMIT 1');
    await lab.db.query("INSERT INTO ai_generation_operations(id,teacher_job_id,phase,remote_outcome) VALUES($1,$2,'unknown','unknown')", [randomUUID(), job.id]);
    const result = await lab.backupRestore();
    assert.equal(result.before, result.after);
    assert.ok(result.tables > 30);
  });
  await check('rollback refuses to discard populated records', async () => { await assert.rejects(lab.migrate(migration, 'down')); });
  console.log(JSON.stringify({ task: 'teacher_enrichment_integration', status: 'passed', checks,
    limitations: ['Real isolated SQL and authored fixtures; byte-equivalent logical restore in lab only, no operational backup restore, provider inference, deployed UI or long-term learning-effect claim.'] }));
} finally { await lab.close(); }
