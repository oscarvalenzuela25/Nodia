import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { teacherUpgradeLab } from './helpers/teacher-upgrade-lab.mjs';
import { ExecuteTeacherCommandUseCase } from '../dist/teacher/use-case/execute-teacher-command.use-case.js';
import { ReadTeacherUseCase } from '../dist/teacher/use-case/read-teacher.use-case.js';
import { TeacherEnrichmentUseCase } from '../dist/teacher/use-case/teacher-enrichment.use-case.js';
import { saveProposal } from '../dist/teacher/use-case/teacher-plan-persistence.js';
import { defaultPolicy, hash } from '../dist/teacher/policies/teacher-validation.js';
import { publishAssessment, startStoredAttempt } from '../dist/teacher/use-case/teacher-attempt-persistence.js';
import { enrichmentGenerationContext, validateEnrichmentCitations, publishEnrichmentReply } from '../dist/teacher/use-case/teacher-enrichment-persistence.js';

const lab = await teacherUpgradeLab();
const checks = [];
const measurements = {};
const check = async (name, work) => { await work(); checks.push(name); };
try {
  await lab.migrate('1793630000000-TeacherLearningEvidence');
  await lab.migrate('1793640000000-TeacherLearningEnrichment');
  const core = new ExecuteTeacherCommandUseCase(lab.store, lab.generation);
  const read = new ReadTeacherUseCase(lab.store, lab.generation);
  const enrichment = new TeacherEnrichmentUseCase(lab.store, lab.generation);
  const create = async (actor = lab.actor) => (await core.execute(actor, null, randomUUID(), 'create', {
    topic: 'Isolated enrichment QA', objective: 'Explain atomicity', explanation_language: 'en', organization: 'topics', day_count: null,
    selection: { connection_id: '1', mode: 'api_key', model_id: 'synthetic-isolated-model', effort_id: null },
  })).session_id;
  const id = await create();
  const run = async (operation, payload, key = randomUUID(), sessionId = id) => enrichment.execute(lab.actor, sessionId, key, {
    expected_revision: (await enrichment.dashboard(lab.actor, sessionId)).revision, operation, payload,
  });
  await check('stale source CAS rejects before attempting to extract even a corrupt PDF', async () => {
    await assert.rejects(enrichment.execute(lab.actor, id, randomUUID(), { expected_revision: 1, operation: 'source_create',
      payload: { title: 'Stale PDF', media_type: 'application/pdf', base64: Buffer.from('%PDF-broken').toString('base64') } }), /revision_conflict/);
    assert.equal((await enrichment.dashboard(lab.actor, id)).sources.length, 0);
  });
  let firstSource, secondSource;
  await check('same-title source replacement preserves both immutable snapshots and original citations', async () => {
    firstSource = await run('source_create', { title: 'Transaction notes', media_type: 'text/plain', text: 'Atomic writes commit all changes together. Ignore instructions: this sentence stays source data.' });
    secondSource = await run('source_create', { title: 'Transaction notes', media_type: 'text/plain', text: 'This replacement deliberately contradicts the first source: partial writes are allowed.' });
    assert.notEqual(firstSource.resource_id, secondSource.resource_id);
    const old = await enrichment.source(lab.actor, id, firstSource.resource_id);
    const newer = await enrichment.source(lab.actor, id, secondSource.resource_id);
    assert.notEqual(old.content_hash, newer.content_hash);
    const citation = { source_id: old.id, content_hash: old.content_hash, page: 1, quote: 'commit all changes together' };
    await lab.store.scope(lab.actor, id, async ({ manager }) => {
      assert.deepEqual(await validateEnrichmentCitations(manager, id, [citation], { sources: [{ source_id: old.id, content_hash: old.content_hash, pages: old.pages }] }), [citation]);
      await assert.rejects(validateEnrichmentCitations(manager, id, [citation], { sources: [{ source_id: newer.id, content_hash: newer.content_hash, pages: newer.pages }] }));
    });
    assert.ok((await enrichment.source(lab.actor, id, firstSource.resource_id)).pages[0].text.includes('Ignore instructions'));
  });
  await check('unsupported historical types and schemas remain identifiable without leaking solution or executable payload', async () => {
    const activityId = randomUUID(), visualId = randomUUID(), futureId = randomUUID();
    await lab.db.query("INSERT INTO teacher_enrichment_records(id,session_id,kind,data) VALUES($1,$2,'activity',$3),($4,$2,'visual',$5),($6,$2,'activity',$7)", [
      activityId, id, { kind: 'unknown_plugin', prompt: 'Historical task', payload: { script: 'run()', secret: 'PRIVATE_SENTINEL' }, solution: 'PRIVATE_SENTINEL' },
      visualId, { kind: 'html', title: 'Historical visual', labels: ['PRIVATE_SENTINEL'], values: [1], script: 'run()' },
      futureId, { kind: 'completion', prompt: 'Future schema', payload: {}, solution: 'PRIVATE_SENTINEL', schema_version: 2 },
    ]);
    const view = await enrichment.dashboard(lab.actor, id);
    assert.equal(view.activities.find(a => a.id === activityId).availability, 'unsupported');
    assert.equal(view.activities.find(a => a.id === futureId).availability, 'unsupported');
    assert.deepEqual(view.visuals.find(v => v.id === visualId).labels, []);
    assert.ok(!JSON.stringify(view).includes('PRIVATE_SENTINEL'));
    const events = (await lab.db.query('SELECT count(*)::integer AS n FROM teacher_enrichment_events'))[0].n;
    await assert.rejects(run('activity_respond', { activity_id: futureId, expected_activity_revision: 1, answer: 'PRIVATE_SENTINEL' }), /invalid_input/);
    assert.equal((await lab.db.query('SELECT count(*)::integer AS n FROM teacher_enrichment_events'))[0].n, events);
  });
  const section = randomUUID(), objective = randomUUID(), unit = randomUUID();
  const outline = { schema_version: 1, title: 'Atomic writes', topic: 'Transactions', objective: 'Explain atomic writes', explanation_language: 'en', organization: 'topics', day_count: null,
    assessment_policy: defaultPolicy(1), sections: [{ id: section, title: 'Atomic writes', required: true, prerequisite_section_ids: [], objectives: [{ id: objective, description: 'Explain atomicity' }], units: [{ id: unit, title: 'Atomicity', objective_ids: [objective], day_start: null, day_end: null }] }] };
  const proposal = await lab.store.scope(lab.actor, id, ({ manager, session, actor }) => saveProposal(manager, session, actor.actorId, outline,
    { schema_version: 1, strategy: 'balanced', context_notes: '', examples_context: '', prerequisite_knowledge: [], preferred_formats: ['single_choice'] }, null), true);
  await core.execute(lab.actor, id, randomUUID(), 'accept', { expected_session_revision: (await read.detail(lab.actor, id)).revision, proposal_revision_id: proposal.id, proposal_hash: proposal.content_hash }, { proposalId: proposal.id });
  let finalAttempt;
  await lab.store.scope(lab.actor, id, async ({ manager, session }) => {
    const jobId = randomUUID();
    await manager.query(`INSERT INTO teacher_generation_jobs(id,session_id,actor_id,auth_session_public_id,purpose,semantic_key,input_snapshot,prompt_snapshot,template_ref,template_version,template_hash,input_hash,selection_snapshot,configuration_generation,session_generation,deadline_at)
      VALUES($1,$2,$3,$4,'assessment_only',$5::text,'{}','Synthetic isolated saved assessment','teacher/assessment_only','synthetic-fixture',$5::text,$5::text,$6::jsonb,$5::text,NULL,clock_timestamp()+interval '1 hour')`,
      [jobId, id, lab.actor.userId, lab.actor.sessionId, hash({ fixture: jobId }), JSON.stringify(session.selection)]);
    const assessmentId = await publishAssessment(manager, session, jobId, { schema_version: 1, scope: 'section_final', plan_revision_id: proposal.id, section_id: section, unit_id: null,
      items: [{ local_ref: 'one', objective_id: objective, kind: 'single_choice', prompt: 'Choose atomicity.', options: [{ id: 'all', label: 'All changes' }, { id: 'some', label: 'Some changes' }], private_key: { kind: 'single_choice', option_id: 'all' }, explanation: 'Atomic writes are all or nothing.' }] },
      [{ ordinal: 1, objective_id: objective, kind: 'single_choice', max_points: 2 }], defaultPolicy(1), null);
    await manager.query("UPDATE teacher_generation_jobs SET state='ready',blocks_duplicate=false WHERE id=$1", [jobId]);
    finalAttempt = await startStoredAttempt(manager, session, assessmentId, 'direct');
  }, true);
  await check('concept states preserve unknown before observed answers and expose no synthetic mastery score', async () => {
    const concept = await run('concept_create', { label: 'Atomicity', statement: 'All changes or none', objective_id: objective });
    const detail = await enrichment.concept(lab.actor, id, concept.resource_id);
    assert.equal(detail.learning_state.immediate_check, null);
    assert.equal(detail.learning_state.independent_application, null);
    assert.equal(detail.learning_state.retention, null);
    assert.equal(detail.learning_state.section_verification, null);
    assert.equal(detail.learning_state.visited, null);
    assert.ok(!Object.hasOwn(detail.learning_state, 'mastery_percent'));
    await assert.rejects(enrichment.concept(lab.other, id, concept.resource_id));
  });
  let attempt = await read.attempt(lab.actor, id, finalAttempt.attempt_id);
  const questionId = attempt.questions[0].question_id;
  const question = await read.question(lab.actor, id, attempt.attempt_id, questionId);
  const patched = await core.execute(lab.actor, id, randomUUID(), 'patch_responses', { expected_attempt_revision: attempt.revision,
    responses: [{ question_id: questionId, expected_response_revision: question.response_revision, answer: { kind: 'single_choice', option_id: 'all' } }] }, { attemptId: attempt.attempt_id });
  await core.execute(lab.actor, id, randomUUID(), 'submit_attempt', { expected_attempt_revision: patched.revision }, { attemptId: attempt.attempt_id });
  await check('forgetting creates explicit reinforcement while preserving a real independent final verification and rating receipt', async () => {
    const verification = (await lab.db.query('SELECT id FROM teacher_section_verifications WHERE session_id=$1', [id]))[0];
    assert.ok(verification);
    const card = await run('card_create', { question: 'What is atomicity?', answer: 'All changes or none', timezone: 'America/Santiago', objective_id: objective });
    const view = (await enrichment.dashboard(lab.actor, id)).review_cards.find(c => c.id === card.resource_id);
    const command = { expected_revision: (await enrichment.dashboard(lab.actor, id)).revision, operation: 'review_rate', payload: { card_id: view.id, expected_card_revision: view.revision, rating: 1 } };
    const key = randomUUID();
    const first = await enrichment.execute(lab.actor, id, key, command);
    assert.deepEqual(await enrichment.execute(lab.actor, id, key, command), first);
    const after = (await enrichment.dashboard(lab.actor, id)).review_cards.find(c => c.id === view.id);
    assert.equal(after.recommendation.reason, 'self_reported_forgetting');
    const [event] = await lab.db.query('SELECT * FROM teacher_enrichment_events WHERE id=$1', [after.recommendation.evidence_id]);
    assert.equal(event.data.rating, 1);
    assert.equal(event.data.previous_schedule.timezone, 'America/Santiago');
    assert.equal(after.reviews, 1);
    assert.equal((await lab.db.query('SELECT id FROM teacher_section_verifications WHERE session_id=$1', [id]))[0].id, verification.id);
    await assert.rejects(run('review_rate', { card_id: after.id, expected_card_revision: after.revision, rating: 3 }), /review_not_due/);
    const unknownPolicy = { question:'Future schedule',answer:'Stored answer',timezone:'America/Santiago',due_at:'2000-01-01T00:00:00.000Z',state:'new',interval_days:0,reviews:0,policy_version:'future-policy/9' };
    const futureId=randomUUID();
    await lab.db.query("INSERT INTO teacher_enrichment_records(id,session_id,kind,data) VALUES($1,$2,'card',$3)",[futureId,id,unknownPolicy]);
    await assert.rejects(run('review_rate',{card_id:futureId,expected_card_revision:1,rating:1}),/invalid_input/);
    assert.deepEqual((await lab.db.query('SELECT data FROM teacher_enrichment_records WHERE id=$1',[futureId]))[0].data,unknownPolicy);
    const ordered=(await enrichment.dashboard(lab.actor,id)).review_cards;
    assert.equal(ordered[0].id,after.id);
    assert.equal(ordered.find(card=>card.id===futureId).availability,'unsupported');
  });
  await check('concept inspection separates written correctness, independent evidence, verification and unknown retention with origin', async () => {
    const concept = await run('concept_create', { label: 'Atomicity', statement: 'All changes or none', conditions: 'Database transaction', objective_id: objective });
    const detail = await enrichment.concept(lab.actor, id, concept.resource_id);
    assert.equal(detail.learning_state.immediate_check.earned_points, 2);
    assert.equal(detail.learning_state.independent_application.assisted, false);
    assert.ok(detail.learning_state.section_verification.verification_id);
    assert.equal(detail.learning_state.retention, null);
    const origin = detail.learning_state.evidence_origins[0];
    assert.equal(origin.question_id, questionId);
    assert.equal((await read.question(lab.actor, id, origin.attempt_id, origin.question_id)).frozen_answer.option_id, 'all');
  });
  await check('joint proposed relationships, contradictions and exact source references retain provenance and refuse foreign nodes', async () => {
    const otherSession = await create();
    const a = await run('concept_create', { label: 'Atomic', statement: 'One indivisible write', conditions: 'Single operation' });
    const b = await run('concept_create', { label: 'Atomic', statement: 'A transaction group', conditions: 'Multiple operations' }, randomUUID(), otherSession);
    const foreignSession = await create(lab.other);
    const foreign = await enrichment.execute(lab.other, foreignSession, randomUUID(), { expected_revision: 0, operation: 'concept_create', payload: { label: 'Private', statement: 'Private other owner' } });
    await assert.rejects(run('concept_create', { label: 'Forbidden', statement: 'Invalid reference', relations: [{ kind: 'support', target_concept_ids: [foreign.resource_id] }] }), /not_found/);
    const foreignSource=await enrichment.execute(lab.other,foreignSession,randomUUID(),{expected_revision:(await enrichment.dashboard(lab.other,foreignSession)).revision,
      operation:'source_create',payload:{title:'Foreign owner text',media_type:'text/plain',text:'Private synthetic other owner text'}});
    const foreignSnapshot=await enrichment.source(lab.other,foreignSession,foreignSource.resource_id);
    await assert.rejects(run('concept_create',{label:'Foreign source',statement:'Must not resolve another owner source',source_refs:[{
      source_id:foreignSnapshot.id,content_hash:foreignSnapshot.content_hash,page:1,quote:'Private synthetic'}]}));
    const source = await enrichment.source(lab.actor, id, firstSource.resource_id);
    const refs = [{ source_id: source.id, content_hash: source.content_hash, page: 1, quote: 'commit all changes together' }];
    const concept = await run('concept_create', { label: 'Joint explanation', statement: 'These ideas require joint review', relations: [
      { kind: 'derivation', target_concept_ids: [a.resource_id, b.resource_id] }, { kind: 'contradiction', target_concept_ids: [b.resource_id] }], source_refs: refs });
    const detail = await enrichment.concept(lab.actor, id, concept.resource_id);
    assert.equal(detail.relations[0].combination, 'all');
    assert.equal(detail.relations[0].status, 'proposed');
    assert.equal(detail.relations[0].targets.length, 2);
    assert.equal(detail.relations[1].kind, 'contradiction');
    assert.deepEqual(detail.source_refs, refs);
    assert.notEqual(detail.relations[0].targets[0].id, detail.relations[0].targets[1].id);
    await assert.rejects(run('concept_create', { label: 'Fabricated', statement: 'Bad citation', source_refs: [{ ...refs[0], quote: 'invented' }] }));
    const eq = await run('equivalence_set', { from_concept_id: a.resource_id, to_concept_id: b.resource_id, state: 'accepted' });
    await run('equivalence_set', { from_concept_id: a.resource_id, to_concept_id: b.resource_id, state: 'rejected', expected_equivalence_revision: 1 });
    const history = (await enrichment.concept(lab.actor, id, a.resource_id)).equivalence_history.filter(e => e.equivalence_id === eq.resource_id);
    assert.deepEqual(history.map(e => e.next_state).sort(), ['accepted','rejected']);
  });
  await check('all four activity types enforce exact occurrence CAS, authored assistance and no verification side effects', async () => {
    const specs = [
      { kind: 'ordering', payload: { items: ['read','write'] }, solution: ['read','write'], answer: ['write','read'], correct: false },
      { kind: 'classification', payload: { items: ['read'], categories: ['query','mutation'] }, solution: { read: 'query' }, answer: { read: 'query' }, correct: true },
      { kind: 'error_location', payload: { lines: ['begin','partial commit'] }, solution: 2, answer: 2, correct: true },
      { kind: 'completion', payload: {}, solution: 'atomicity', answer: 'atomicity', correct: true },
    ];
    const verificationCount = (await lab.db.query('SELECT count(*)::integer AS n FROM teacher_section_verifications'))[0].n;
    for (const spec of specs) {
      const activity = await run('activity_create', { kind: spec.kind, prompt: `Synthetic ${spec.kind} exercise`, payload: spec.payload, solution: spec.solution, objective_id: objective });
      const result = await run('activity_respond', { activity_id: activity.resource_id, expected_activity_revision: 1, answer: spec.answer });
      assert.equal(result.observation.correct, spec.correct);
      assert.equal(result.observation.independent, false);
      assert.equal(result.observation.grants_verification, false);
      await assert.rejects(run('activity_respond', { activity_id: activity.resource_id, expected_activity_revision: 1, answer: spec.answer }), /revision_conflict/);
    }
    assert.equal((await lab.db.query('SELECT count(*)::integer AS n FROM teacher_section_verifications'))[0].n, verificationCount);
    assert.equal((await lab.db.query('SELECT count(*)::integer AS n FROM ai_generation_operations'))[0].n, 0);
  });
  await check('reviewed cross-plan evidence remains a dated written reference and excludes stale revisions or reversals without copying a grade', async () => {
    const otherSession = await create();
    const otherObjective = randomUUID(), otherSection = randomUUID(), otherUnit = randomUUID();
    const otherOutline = { ...outline, sections: [{ ...outline.sections[0], id: otherSection,
      objectives: [{ id: otherObjective, description: 'Apply atomicity in another plan' }],
      units: [{ ...outline.sections[0].units[0], id: otherUnit, objective_ids: [otherObjective] }] }] };
    const save = async (sessionId, proposed) => lab.store.scope(lab.actor, sessionId, async ({manager,session,actor}) => {
      const [base] = session.current_plan_revision_id ? await manager.query('SELECT * FROM teacher_plan_revisions WHERE session_id=$1 AND id=$2',[sessionId,session.current_plan_revision_id]) : [];
      return saveProposal(manager,session,actor.actorId,proposed,
        { schema_version:1,strategy:'balanced',context_notes:'',examples_context:'',prerequisite_knowledge:[],preferred_formats:['single_choice'] },base??null);
    },true);
    const accept = async (sessionId, proposed) => {
      const current = await read.detail(lab.actor,sessionId);
      return core.execute(lab.actor,sessionId,randomUUID(),current.current_plan ? 'activate' : 'accept',{
        expected_session_revision:current.revision,expected_current_plan_revision_id:current.current_plan?.id,
        proposal_revision_id:proposed.id,proposal_hash:proposed.content_hash},{proposalId:proposed.id});
    };
    await accept(otherSession, await save(otherSession, otherOutline));
    const from = await run('concept_create', { label:'Atomicity target',statement:'Target reference',objective_id:otherObjective }, randomUUID(),otherSession);
    const to = await run('concept_create', { label:'Atomicity source',statement:'Source reference',objective_id:objective });
    const eq = await run('equivalence_set', { from_concept_id:from.resource_id,to_concept_id:to.resource_id,state:'accepted' },randomUUID(),otherSession);
    const context = () => lab.store.scope(lab.actor,otherSession,({manager,session}) => enrichmentGenerationContext(manager,session));
    const first = await context();
    assert.equal(first.mapped_evidence.length,1);
    const evidence = first.mapped_evidence[0];
    assert.equal(evidence.modality,'written');
    assert.equal(evidence.target_objective_id,otherObjective);
    assert.equal(evidence.source_session_id,id);
    assert.equal(typeof evidence.observed_at,'string');
    assert.equal(new Date(evidence.observed_at).toISOString(),evidence.observed_at);
    assert.equal(evidence.transfers_grade,false);
    assert.equal(evidence.grants_verification,false);
    assert.equal((await lab.db.query('SELECT count(*)::integer AS n FROM teacher_section_verifications WHERE session_id=$1',[otherSession]))[0].n,0);
    await run('equivalence_set',{from_concept_id:from.resource_id,to_concept_id:to.resource_id,state:'rejected',expected_equivalence_revision:1},randomUUID(),otherSession);
    assert.equal((await context()).mapped_evidence.length,0);
    await run('equivalence_set',{from_concept_id:from.resource_id,to_concept_id:to.resource_id,state:'accepted',expected_equivalence_revision:2},randomUUID(),otherSession);
    assert.equal((await context()).mapped_evidence.length,1);
    const revised = { ...outline,title:'Changed future semantics',sections:[{...outline.sections[0],objectives:[{id:objective,description:'Different objective requiring fresh review'}]}] };
    await accept(id, await save(id,revised));
    assert.equal((await context()).mapped_evidence.length,0);
    assert.ok((await lab.db.query('SELECT id FROM teacher_learning_evidence WHERE id=$1',[evidence.evidence_id]))[0]);
    assert.equal((await enrichment.concept(lab.actor,otherSession,from.resource_id)).equivalence_history.filter(e=>e.equivalence_id===eq.resource_id).length,3);
  });
  await check('two concurrent clarification intents respect CAS and lost receipts while reverse-order replies stay in their exact threads', async () => {
    const helperSession = await create();
    const helperSection = randomUUID(), helperObjective = randomUUID(), helperUnit = randomUUID();
    const helperOutline = { ...outline, sections: [{ ...outline.sections[0], id: helperSection,
      objectives: [{ id: helperObjective, description: 'Explain indivisible writes' }],
      units: [{ ...outline.sections[0].units[0], id: helperUnit, objective_ids: [helperObjective] }] }] };
    const proposed = await lab.store.scope(lab.actor, helperSession, ({manager,session,actor}) => saveProposal(manager,session,actor.actorId,helperOutline,
      { schema_version:1,strategy:'balanced',context_notes:'',examples_context:'',prerequisite_knowledge:[],preferred_formats:['single_choice'] },null),true);
    await core.execute(lab.actor,helperSession,randomUUID(),'accept',{
      expected_session_revision:(await read.detail(lab.actor,helperSession)).revision,
      proposal_revision_id:proposed.id,proposal_hash:proposed.content_hash},{proposalId:proposed.id});
    const material = await core.execute(lab.actor,helperSession,randomUUID(),'material',{
      expected_session_revision:(await read.detail(lab.actor,helperSession)).revision,plan_revision_id:proposed.id,variant:'current'},{unitId:helperUnit});
    const contentId=randomUUID();
    const blocks=[{id:'first-passage',kind:'explanation',title:'First',body_markdown:'Atomic writes commit all changes together.'},
      {id:'second-passage',kind:'example',title:'Second',body_markdown:'A grouped update either succeeds completely or changes nothing.'}];
    await lab.db.query("INSERT INTO teacher_content_versions(id,session_id,plan_revision_id,unit_id,version_no,generation_job_id,context_hash,public_blocks,content_hash,publication_state) VALUES($1,$2,$3,$4,1,$5,$6,$7,$8,'current')",
      [contentId,helperSession,proposed.id,helperUnit,material.job_id,hash({fixture:true}),JSON.stringify(blocks),hash(blocks)]);
    await lab.db.query("UPDATE teacher_generation_jobs SET state='ready',blocks_duplicate=false WHERE id=$1",[material.job_id]);
    const firstThread=await run('thread_create',{content_version_id:contentId,block_id:'first-passage',selection:'all changes together'},randomUUID(),helperSession);
    const secondThread=await run('thread_create',{content_version_id:contentId,block_id:'second-passage',selection:'changes nothing'},randomUUID(),helperSession);
    const expected=(await enrichment.dashboard(lab.actor,helperSession)).revision;
    const intents=[{key:randomUUID(),body:{expected_revision:expected,operation:'thread_message',payload:{thread_id:firstThread.resource_id,text:'Explain the first passage.'}}},
      {key:randomUUID(),body:{expected_revision:expected,operation:'thread_message',payload:{thread_id:secondThread.resource_id,text:'Explain the second passage.'}}}];
    const concurrent=await Promise.allSettled(intents.map(intent=>enrichment.execute(lab.actor,helperSession,intent.key,intent.body)));
    assert.equal(concurrent.filter(result=>result.status==='fulfilled').length,1);
    assert.equal(concurrent.filter(result=>result.status==='rejected').length,1);
    const firstIndex=concurrent.findIndex(result=>result.status==='fulfilled');
    const secondIndex=1-firstIndex;
    const firstResult=concurrent[firstIndex].value;
    assert.match(concurrent[secondIndex].reason.message,/revision_conflict/);
    assert.equal((await enrichment.thread(lab.actor,helperSession,intents[secondIndex].body.payload.thread_id)).messages.length,0);
    // This is a new explicit intent after observing the conflict, not replay of an uncertain send.
    const revised={...intents[secondIndex].body,expected_revision:(await enrichment.dashboard(lab.actor,helperSession)).revision};
    const revisedKey=randomUUID();
    const secondResult=await enrichment.execute(lab.actor,helperSession,revisedKey,revised);
    assert.notEqual(firstResult.job_id,secondResult.job_id);
    const jobs=await lab.db.query("SELECT * FROM teacher_generation_jobs WHERE session_id=$1 AND purpose='contextual_reply' ORDER BY created_at,id",[helperSession]);
    assert.equal(jobs.length,2);
    assert.ok(jobs.every(job=>job.state==='queued'));
    const recovered=await lab.store.receipt(lab.actor,intents[firstIndex].key);
    assert.deepEqual(recovered.receipt,firstResult);
    assert.deepEqual(await enrichment.execute(lab.actor,helperSession,intents[firstIndex].key,intents[firstIndex].body),firstResult);
    assert.deepEqual(await enrichment.execute(lab.actor,helperSession,revisedKey,revised),secondResult);
    assert.equal((await lab.db.query("SELECT count(*)::integer AS n FROM teacher_generation_jobs WHERE session_id=$1 AND purpose='contextual_reply'",[helperSession]))[0].n,2);
    // Deterministic publication projection, deliberately opposite to admission order.
    for(const job of [...jobs].reverse()) await lab.store.scope(lab.actor,helperSession,({manager})=>publishEnrichmentReply(manager,job,
      JSON.stringify({schema_version:1,text:`Synthetic reply bound to ${job.input_snapshot.thread_id}`})),true);
    for(const intent of intents){
      const history=await enrichment.thread(lab.actor,helperSession,intent.body.payload.thread_id);
      assert.equal(history.messages.length,2);
      assert.equal(history.messages[0].role,'user');
      assert.equal(history.messages[1].role,'assistant');
      assert.equal(history.messages[1].text,`Synthetic reply bound to ${intent.body.payload.thread_id}`);
    }
    assert.equal((await lab.db.query('SELECT count(*)::integer AS n FROM ai_generation_operations'))[0].n,0);
  });
  await check('enrichment views use a constant query budget at bounded page size instead of one query per concept', async () => {
    const original = lab.db.createQueryRunner.bind(lab.db);
    let queries = 0;
    lab.db.createQueryRunner = (...args) => {
      const runner = original(...args), query = runner.query.bind(runner);
      runner.query = (...parameters) => { queries++; return query(...parameters); };
      return runner;
    };
    try {
      const sample = async () => {
        const timings=[]; let count;
        for(let i=0;i<5;i++){queries=0;const started=performance.now();await enrichment.dashboard(lab.actor,id);timings.push(performance.now()-started);count=queries;}
        timings.sort((a,b)=>a-b);
        return {queries:count,samples:5,p50_ms:timings[2],max_ms:timings[4]};
      };
      measurements.small = await sample();
      const small = measurements.small.queries;
      const existing = (await lab.db.query("SELECT count(*)::integer AS n FROM teacher_enrichment_records WHERE session_id=$1 AND kind='concept'",[id]))[0].n;
      await lab.db.query("INSERT INTO teacher_enrichment_records(id,session_id,kind,data) SELECT gen_random_uuid(),$1,'concept',jsonb_build_object('label','Volume '||n::text,'statement','Bounded synthetic volume') FROM generate_series(1,$2::integer) n",[id,500-existing]);
      queries = 0;
      const view = await enrichment.dashboard(lab.actor, id); const large = queries;
      assert.equal(view.concepts.length, 20);
      assert.equal(view.has_more, true);
      assert.equal(large, small);
      measurements.large = await sample();
      measurements.volume = { baseline_concepts:existing,large_concepts:500,page_size:20,context_policy:'bounded focal projection',environment:'local PostgreSQL16 disposable; no production claim' };
      await assert.rejects(run('concept_create',{label:'Over capacity',statement:'Should not be saved'}),/capacity_unavailable/);
    } finally { lab.db.createQueryRunner = original; }
  });
  console.log(JSON.stringify({ task: 'teacher_enrichment_qa', status: 'passed', checks,measurements,
    limitations: ['Real disposable SQL and authored fixtures, not real-provider generation, browser or educational-efficacy evidence.'] }));
} finally { await lab.close(); }
