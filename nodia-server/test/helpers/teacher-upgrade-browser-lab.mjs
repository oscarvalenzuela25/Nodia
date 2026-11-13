// Opt-in loopback QA server. Disposable PostgreSQL, signed expiring fixture JWTs,
// real Teacher controllers/DTOs/SQL; no application env, credentials or provider.
import 'reflect-metadata';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Module, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { teacherUpgradeLab } from './teacher-upgrade-lab.mjs';
import { TeacherService } from '../../dist/teacher/teacher.service.js';
import { TeacherController } from '../../dist/teacher/teacher.controller.js';
import { TeacherLearningController } from '../../dist/teacher/teacher-learning.controller.js';
import { TeacherEnrichmentController } from '../../dist/teacher/teacher-enrichment.controller.js';
import { TeacherReceiptStatusInterceptor } from '../../dist/teacher/teacher-receipt-status.interceptor.js';
import { ReadTeacherUseCase } from '../../dist/teacher/use-case/read-teacher.use-case.js';
import { ExecuteTeacherCommandUseCase } from '../../dist/teacher/use-case/execute-teacher-command.use-case.js';
import { TeacherLearningUseCase } from '../../dist/teacher/use-case/teacher-learning.use-case.js';
import { TeacherEnrichmentUseCase } from '../../dist/teacher/use-case/teacher-enrichment.use-case.js';
import { saveProposal } from '../../dist/teacher/use-case/teacher-plan-persistence.js';
import { publishAssessment } from '../../dist/teacher/use-case/teacher-attempt-persistence.js';
import { publishEnrichmentReply } from '../../dist/teacher/use-case/teacher-enrichment-persistence.js';
import { defaultPolicy, hash } from '../../dist/teacher/policies/teacher-validation.js';
import { teacherBodyParser } from '../../dist/teacher/teacher-body-parser.js';
import { AllExceptionsFilter } from '../../dist/common/filters/all-exceptions.filter.js';

if (!process.argv.includes('--serve-isolated-browser-qa') || process.argv.length !== 3) throw Error('explicit_isolated_browser_qa_flag_required');
const fixtureDir = resolve('../nodia-client/.tmp/teacher-upgrade-integrated');
const fixturePath = resolve(fixtureDir, 'fixture.json');
const lab = await teacherUpgradeLab();
let app, timer, stopped = false;
let requestStop;
const stopRequested = new Promise(resolve => { requestStop = resolve; });
const close = async () => {
  if (stopped) return;
  stopped = true;
  clearInterval(timer);
  if (app) await app.close();
  await lab.close();
  await rm(fixturePath, { force: true });
};
try {
  await lab.migrate('1793630000000-TeacherLearningEvidence');
  await lab.migrate('1793640000000-TeacherLearningEnrichment');
  const core = new ExecuteTeacherCommandUseCase(lab.store, lab.generation);
  const read = new ReadTeacherUseCase(lab.store, lab.generation);
  const learning = new TeacherLearningUseCase(lab.store);
  const enrichment = new TeacherEnrichmentUseCase(lab.store, lab.generation);
  const created = await core.execute(lab.actor, null, randomUUID(), 'create', {
    topic: 'QA aislada: transacciones', objective: 'Explicar atomicidad y conservar identidad', explanation_language: 'es',
    organization: 'topics', day_count: null, selection: { connection_id: '1', mode: 'api_key', model_id: 'synthetic-browser-fixture', effort_id: null },
  });
  const sessionId = created.session_id;
  const revision = async () => (await lab.db.query('SELECT revision FROM teacher_sessions WHERE id=$1', [sessionId]))[0].revision;
  const sectionId = randomUUID(), objectiveId = randomUUID(), unitId = randomUUID();
  const outline = { schema_version: 1, title: 'QA: atomicidad', topic: 'Transacciones', objective: 'Aplicar atomicidad', explanation_language: 'es', organization: 'topics', day_count: null,
    assessment_policy: defaultPolicy(1), sections: [{ id: sectionId, title: 'Escrituras relacionadas', required: true, prerequisite_section_ids: [], objectives: [{ id: objectiveId, description: 'Aplicar todas las escrituras o ninguna' }], units: [{ id: unitId, title: 'Atomicidad', objective_ids: [objectiveId], day_start: null, day_end: null }] }] };
  const proposal = await lab.store.scope(lab.actor, sessionId, ({ manager, session, actor }) => saveProposal(manager, session, actor.actorId, outline,
    { schema_version: 1, strategy: 'balanced', context_notes: '', examples_context: '', prerequisite_knowledge: [], preferred_formats: ['single_choice'] }, null), true);
  await core.execute(lab.actor, sessionId, randomUUID(), 'accept', { expected_session_revision: await revision(), proposal_revision_id: proposal.id, proposal_hash: proposal.content_hash }, { proposalId: proposal.id });
  const material = await core.execute(lab.actor, sessionId, randomUUID(), 'material', { expected_session_revision: await revision(), plan_revision_id: proposal.id, variant: 'current' }, { unitId });
  const contentId = randomUUID();
  const blocks = [
    { id: 'prediction', kind: 'prediction', title: 'Antes de leer', body_markdown: '¿Qué debe pasar si falla una de dos escrituras relacionadas?' },
    { id: 'atomicity', kind: 'explanation', title: 'Atomicidad', body_markdown: 'Una transacción atómica aplica todos los cambios o ninguno. Si falla la segunda escritura, se revierten ambas.' },
    { id: 'check', kind: 'check', title: 'Aplica la idea', body_markdown: 'Una transferencia debita una cuenta y acredita otra. Explica qué debe ocurrir si falla el crédito.' },
  ];
  await lab.db.query("INSERT INTO teacher_content_versions(id,session_id,plan_revision_id,unit_id,version_no,generation_job_id,context_hash,public_blocks,content_hash,publication_state) VALUES($1,$2,$3,$4,1,$5,$6,$7,$8,'current')", [contentId, sessionId, proposal.id, unitId, material.job_id, hash({ fixture: true }), JSON.stringify(blocks), hash(blocks)]);
  await lab.db.query("UPDATE teacher_generation_jobs SET state='ready',result_ref=$2,blocks_duplicate=false WHERE id=$1", [material.job_id, JSON.stringify({ content_version_id: contentId })]);
  const practice = await lab.store.scope(lab.actor, sessionId, async ({ manager, session }) => {
    const items = ['¿Qué exige la atomicidad?', '¿Qué pasa si falla el crédito?'].map((prompt, index) => ({ local_ref: `item${index}`, objective_id: objectiveId, kind: 'single_choice', prompt,
      options: [{ id: 'all', label: 'Todos los cambios o ninguno' }, { id: 'partial', label: 'Conservar cambios parciales' }],
      private_key: { kind: 'single_choice', option_id: 'all' }, explanation: 'Las escrituras relacionadas se confirman juntas o se revierten juntas.' }));
    const assessmentId = await publishAssessment(manager, session, material.job_id,
      { schema_version: 1, scope: 'unit_practice', plan_revision_id: proposal.id, section_id: sectionId, unit_id: unitId, items },
      items.map((_, i) => ({ ordinal: i + 1, objective_id: objectiveId, kind: 'single_choice', max_points: 2 })), defaultPolicy(1), contentId);
    return assessmentId;
  }, true);
  const dimension = randomUUID();
  await learning.execute(lab.actor, sessionId, randomUUID(), 'blueprint', { expected_session_revision: await revision(), title: 'Banco sintético revisado para QA', reviewed: true,
    dimensions: [{ id: dimension, description: 'Conservar escrituras relacionadas' }], items: [{ dimension_id: dimension, kind: 'completion', prompt: 'Completa: todos los cambios o ___.', private_key: { kind: 'completion', alternatives: ['ninguno'], case_sensitive: false }, explanation: 'Atomicidad aplica todos o ninguno.' }] });
  const run = async (operation, payload) => enrichment.execute(lab.actor, sessionId, randomUUID(), { expected_revision: (await enrichment.dashboard(lab.actor, sessionId)).revision, operation, payload });
  await run('card_create', { question: '¿Qué significa atomicidad?', answer: 'Todos los cambios o ninguno.', timezone: 'America/Santiago', objective_id: objectiveId });
  const source = await run('source_create', { title: 'Fuente textual de QA', media_type: 'text/plain', text: 'Una transacción atómica confirma todos los cambios o ninguno.' });
  await run('activity_create', { kind: 'completion', prompt: 'Completa: todos o ___.', payload: {}, solution: 'ninguno', objective_id: objectiveId });
  await run('activity_create', { kind: 'ordering', prompt: 'Ordena el flujo controlado.', payload: { items: ['Iniciar', 'Escribir', 'Confirmar'] }, solution: ['Iniciar', 'Escribir', 'Confirmar'] });
  await run('visual_create', { kind: 'bar_chart', title: 'Valores declarados de QA', labels: ['Confirmación', 'Reversión'], values: [1, 0] });
  await run('visual_create', { kind: 'timeline', title: 'Secuencia declarada de QA', labels: ['Inicio', 'Confirmación'], values: [0, 1] });
  // Historical records with unavailable renderers are read-only fixtures, never accepted writes.
  await lab.db.query("INSERT INTO teacher_enrichment_records(id,session_id,kind,data) VALUES($1,$2,'activity',$3),($4,$2,'visual',$5)", [randomUUID(), sessionId, JSON.stringify({ schema_version: 99, kind: 'download_plugin', prompt: 'Actividad histórica no disponible', objective_id: null, answered: false, solution: 'never_public', payload: { code: 'never_execute' } }), randomUUID(), JSON.stringify({ schema_version: 99, kind: 'html', title: 'Visual histórico no disponible', labels: [], values: [], payload: { url: 'https://example.test/never_load' } })]);
  const concept = await run('concept_create', { label: 'Atomicidad', statement: 'Escrituras relacionadas forman una unidad.', conditions: 'Dentro de una transacción', objective_id: objectiveId });
  const thread = await run('thread_create', { content_version_id: contentId, block_id: 'atomicity', selection: 'todos los cambios o ninguno' });
  await lab.db.query('UPDATE teacher_cursors SET phase=$2,plan_revision_id=$3,section_id=$4,unit_id=$5,content_version_id=$6,block_id=$7 WHERE session_id=$1', [sessionId, 'theory', proposal.id, sectionId, unitId, contentId, 'prediction']);
  const jwt = new JwtService({ secret: randomBytes(32).toString('hex') });
  const token = actor => jwt.sign({ sub: actor.userId, sid: actor.sessionId }, { algorithm: 'HS256', issuer: 'isolated-teacher-browser-qa', audience: 'isolated-teacher-browser-client', expiresIn: '2h' });
  class BrowserQaModule {}
  Module({ controllers: [TeacherController, TeacherLearningController, TeacherEnrichmentController], providers: [
    { provide: TeacherService, useValue: lab.store }, { provide: ReadTeacherUseCase, useValue: read }, { provide: ExecuteTeacherCommandUseCase, useValue: core },
    { provide: TeacherLearningUseCase, useValue: learning }, { provide: TeacherEnrichmentUseCase, useValue: enrichment }, TeacherReceiptStatusInterceptor,
  ] })(BrowserQaModule);
  app = await NestFactory.create(BrowserQaModule, { logger: false, bodyParser: false });
  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: ['http://127.0.0.1:5181','http://127.0.0.1:5182','http://127.0.0.1:5183','http://127.0.0.1:5184'], credentials: true });
  const requests = [];
  app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'OPTIONS') return next();
    try {
      const claims = jwt.verify((req.headers.authorization ?? '').replace(/^Bearer /, ''), { algorithms: ['HS256'], issuer: 'isolated-teacher-browser-qa', audience: 'isolated-teacher-browser-client' });
      const actor = [lab.actor, lab.other, lab.noModule].find(a => a.userId === claims.sub && a.sessionId === claims.sid);
      if (!actor) throw Error('fixture_actor_required');
      req.auth = { user: { id: actor.userId, name: 'QA aislada', email: 'qa@example.test', image_url: null }, sessionId: actor.sessionId };
      requests.push({ method: req.method, path: req.path });
      if (req.path === '/api/v1/__qa/metrics') return res.json({ requests, remote_inference_posts: 0 });
      // Deterministic cleanup also works when a Windows terminal kills the shell
      // instead of forwarding SIGINT to this Node child.
      if (req.method === 'POST' && req.path === '/api/v1/__qa/shutdown') {
        if (actor !== lab.actor) return res.status(403).json({ code: 'fixture_owner_required' });
        res.status(202).json({ status: 'isolated_lab_stopping' });
        setImmediate(requestStop);
        return;
      }
      next();
    } catch { res.status(401).json({ code: 'session_required', message: 'auth:session_required' }); }
  });
  app.use('/api/v1/teacher', teacherBodyParser);
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(0, '127.0.0.1');
  // A deterministic fixture publisher tests late thread delivery without a remote model.
  let publishing = false;
  timer = setInterval(async () => {
    if (publishing || stopped) return;
    publishing = true;
    try {
      const jobs = await lab.db.query("SELECT * FROM teacher_generation_jobs WHERE session_id=$1 AND purpose='contextual_reply' AND state='queued' ORDER BY created_at LIMIT 1", [sessionId]);
      for (const job of jobs) await lab.store.scope(lab.actor, sessionId, async ({ manager }) => {
        await publishEnrichmentReply(manager, job, JSON.stringify({ schema_version: 1, text: 'Respuesta sintética de QA: la operación completa se confirma o se revierte.' }));
        await manager.query("UPDATE teacher_generation_jobs SET state='ready',blocks_duplicate=false,result_ref=$2 WHERE id=$1", [job.id, JSON.stringify({ thread_id: job.input_snapshot.thread_id })]);
      }, true);
    } catch { /* The real publisher can reject stale anchors/finals; no replay or fallback. */ }
    finally { publishing = false; }
  }, 2500);
  await mkdir(fixtureDir, { recursive: true });
  await writeFile(fixturePath, JSON.stringify({ fixture: 'isolated_teacher_qa', api: `${await app.getUrl()}/api/v1`, token: token(lab.actor), other_token: token(lab.other), no_module_token: token(lab.noModule), expires_at: Date.now() + 7200000,
    session_id: sessionId, unit_id: unitId, section_id: sectionId, objective_id: objectiveId, content_version_id: contentId, practice_assessment_id: practice, source_id: source.resource_id, concept_id: concept.resource_id, thread_id: thread.resource_id }, null, 2) + '\n', { mode: 0o600 });
  console.log(JSON.stringify({ status: 'isolated_browser_qa_ready', api: `${await app.getUrl()}/api/v1`, fixture_path: '.tmp/teacher-upgrade-integrated/fixture.json', remote_inference_posts: 0 }));
  process.once('SIGINT', requestStop);
  process.once('SIGTERM', requestStop);
  await stopRequested;
} finally { await close(); }
