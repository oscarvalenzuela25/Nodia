// Compiled Nest, TypeORM and PostgreSQL with an explicitly synthetic provider response.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { Module, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { createCanvas } from '@napi-rs/canvas';
import { ApiTextGenerationService } from '../dist/ai-generation/api-text-generation.service.js';
import { TeacherGenerationRuntimeService } from '../dist/ai-generation/teacher-generation-runtime.service.js';
import { GenerationWorkerSourceRegistry } from '../dist/ai-generation/worker-source-registry.js';
import { FlashcardLibraryRuntimeService } from '../dist/ai-generation/flashcard-library-runtime.service.js';
import { FlashcardLibraryStore } from '../dist/ai-generation/flashcard-library.store.js';
import {
  FLASHCARD_IMAGE_QUALIFICATION_PROMPT,
  FlashcardLibraryTransport,
} from '../dist/ai-generation/flashcard-library-transport.service.js';
import { CheckModuleAccessUseCase } from '../dist/authorization/use-case/check-module-access.use-case.js';
import { AllExceptionsFilter } from '../dist/common/filters/all-exceptions.filter.js';
import { ApiNodiaAiCredentialsService } from '../dist/nodia-ai-adapter/api-nodia-ai-credentials.service.js';
import { NodiaAiConnectionsService } from '../dist/nodia-ai-conversation/nodia-ai-connections.service.js';
import { ValidateNodiaAiRuntimePolicyUseCase } from '../dist/nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case.js';
import {
  encryptSecret,
  generateFingerprint,
} from '../dist/ai-provider/helpers/ai-key-crypto.helper.js';
import { teacherBodyParser } from '../dist/teacher/teacher-body-parser.js';
import { TeacherFlashcardGenerationController } from '../dist/teacher/teacher-flashcard-generation.controller.js';
import { TeacherFlashcardLibraryController } from '../dist/teacher/teacher-flashcard-library.controller.js';
import { TeacherFlashcardsController } from '../dist/teacher/teacher-flashcards.controller.js';
import { TeacherFlashcardsStore } from '../dist/teacher/teacher-flashcards.store.js';
import { TeacherService } from '../dist/teacher/teacher.service.js';
import {
  defaultPolicy,
  hash,
} from '../dist/teacher/policies/teacher-validation.js';
import { TEACHER_GENERATION_PORT } from '../dist/teacher/types/teacher.types.js';
import { ExecuteTeacherCommandUseCase } from '../dist/teacher/use-case/execute-teacher-command.use-case.js';
import {
  publishAssessment,
  startStoredAttempt,
} from '../dist/teacher/use-case/teacher-attempt-persistence.js';
import { PublishTeacherUseCase } from '../dist/teacher/use-case/publish-teacher.use-case.js';
import { ReadTeacherUseCase } from '../dist/teacher/use-case/read-teacher.use-case.js';
import { TeacherFlashcardGenerationUseCase } from '../dist/teacher/use-case/teacher-flashcard-generation.use-case.js';
import { TeacherFlashcardLibraryUseCase } from '../dist/teacher/use-case/teacher-flashcard-library.use-case.js';
import { TeacherFlashcardsUseCase } from '../dist/teacher/use-case/teacher-flashcards.use-case.js';
import { saveProposal } from '../dist/teacher/use-case/teacher-plan-persistence.js';

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
const originalFetch = globalThis.fetch;
process.env.NODE_ENV = 'test';
process.env.AI_SECRET_MASTER_KEY = randomBytes(32).toString('hex');
let app;

try {
  await db.initialize();
  const [{ tables }] = await db.query(
    "SELECT count(*)::int AS tables FROM pg_tables WHERE schemaname='public'",
  );
  assert.equal(tables, 0, 'The disposable database must be empty.');
  await db.runMigrations({ transaction: 'all' });
  const actor = { userId: '9007199254740993', sessionId: randomUUID() };
  const other = { userId: '9007199254740994', sessionId: randomUUID() };
  const noModule = { userId: '9007199254740995', sessionId: randomUUID() };
  for (const user of [actor, other, noModule]) {
    await db.query(
      "INSERT INTO users(id,email,name) VALUES($1,$2,'Synthetic flashcards actor')",
      [user.userId, 'flashcard-' + user.userId + '@example.invalid'],
    );
    await db.query(
      "INSERT INTO auth_sessions(public_id,user_id,refresh_token_hash,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",
      [user.sessionId, user.userId, hash(user.sessionId)],
    );
  }
  const [{ id: group }] = await db.query(
    "INSERT INTO module_groups(key,sort_order) VALUES('synthetic_flashcards',99) RETURNING id::text",
  );
  const [{ id: moduleId }] = await db.query(
    "INSERT INTO modules(module_group_id,key,link,sort_order) VALUES($1,'nodia_teacher','/nodia-teacher',0) RETURNING id::text",
    [group],
  );
  await db.query(
    'INSERT INTO user_modules(user_id,module_id,is_active) VALUES($1,$3,true),($2,$3,true)',
    [actor.userId, other.userId, moduleId],
  );
  const model = 'synthetic-flashcard-fixture';
  const [{ id: connectionId }] = await db.query(
    "INSERT INTO ai_providers(catalog_id,name,use_api_key,fields) SELECT id,'Synthetic flashcard transport',true,$1::jsonb FROM ai_provider_catalog WHERE key='openai' RETURNING id::text",
    [{ api_key: { selected_model: model, available_models: [{ id: model }] } }],
  );
  const secret = 'synthetic-flashcard-fixture-key';
  await db.query(
    "INSERT INTO ai_api_keys(provider_id,label,secret_ciphertext,secret_fingerprint,display_hint,is_selected) VALUES($1,'Synthetic',$2,$3,'****',true)",
    [connectionId, encryptSecret(secret), generateFingerprint(secret)],
  );
  const policy = new ValidateNodiaAiRuntimePolicyUseCase().execute(
    JSON.parse(
      await readFile(
        new URL(
          '../src/nodia-ai-runtime/config/runtime-policy.json',
          import.meta.url,
        ),
        'utf8',
      ),
    ),
  );
  const access = new CheckModuleAccessUseCase(db);
  const credentials = new ApiNodiaAiCredentialsService(db);
  const apiText = new ApiTextGenerationService(credentials, policy);
  const libraryTransport = new FlashcardLibraryTransport(
    db,
    credentials,
    apiText,
    policy,
  );
  const libraryStore = new FlashcardLibraryStore(libraryTransport, policy);
  const libraryRuntime = new FlashcardLibraryRuntimeService(
    db,
    access,
    new GenerationWorkerSourceRegistry(),
    libraryTransport,
    policy,
  );
  const runtime = new TeacherGenerationRuntimeService(
    db,
    access,
    credentials,
    new NodiaAiConnectionsService(db),
    new GenerationWorkerSourceRegistry(),
    apiText,
    policy,
  );
  const publisher = new PublishTeacherUseCase();
  runtime.setPublisher(publisher.publish.bind(publisher));
  const store = new TeacherService(db, access);
  const core = new ExecuteTeacherCommandUseCase(store, runtime);
  const selection = {
    connection_id: connectionId,
    mode: 'api_key',
    model_id: model,
    effort_id: null,
  };
  const study = (
    await core.execute(actor, null, randomUUID(), 'create', {
      topic: 'Isolated transactions',
      objective: 'Explain atomicity',
      context: 'local-only context',
      explanation_language: 'en',
      organization: 'topics',
      day_count: null,
      selection,
      start_plan: false,
    })
  ).session_id;
  const section = randomUUID(),
    objective = randomUUID(),
    unit = randomUUID(),
    content = randomUUID();
  const outline = {
    schema_version: 1,
    title: 'Transactions',
    topic: 'Transactions',
    objective: 'Explain atomicity',
    explanation_language: 'en',
    organization: 'topics',
    day_count: null,
    assessment_policy: defaultPolicy(1),
    sections: [
      {
        id: section,
        title: 'Atomicity',
        required: true,
        prerequisite_section_ids: [],
        objectives: [{ id: objective, description: 'Explain atomicity' }],
        units: [
          {
            id: unit,
            title: 'Transactions',
            objective_ids: [objective],
            day_start: null,
            day_end: null,
          },
        ],
      },
    ],
  };
  const plan = await store.scope(
    actor,
    study,
    ({ manager, session, actor: current }) =>
      saveProposal(
        manager,
        session,
        current.actorId,
        outline,
        {
          schema_version: 1,
          strategy: 'balanced',
          context_notes: '',
          examples_context: '',
          prerequisite_knowledge: [],
          preferred_formats: ['single_choice'],
        },
        null,
      ),
    true,
  );
  const revision = async () =>
    (
      await db.query('SELECT revision FROM teacher_sessions WHERE id=$1', [
        study,
      ])
    )[0].revision;
  await core.execute(
    actor,
    study,
    randomUUID(),
    'accept',
    {
      expected_session_revision: await revision(),
      proposal_revision_id: plan.id,
      proposal_hash: plan.content_hash,
    },
    { proposalId: plan.id },
  );
  const material = await core.execute(
    actor,
    study,
    randomUUID(),
    'material',
    {
      expected_session_revision: await revision(),
      plan_revision_id: plan.id,
      variant: 'current',
    },
    { unitId: unit },
  );
  const quote = 'Atomic writes commit all changes together.';
  const blocks = [
    {
      id: 'atomicity',
      kind: 'explanation',
      title: 'Atomicity',
      body_markdown: quote,
    },
  ];
  await db.query(
    "INSERT INTO teacher_content_versions(id,session_id,plan_revision_id,unit_id,version_no,generation_job_id,context_hash,public_blocks,content_hash,publication_state) VALUES($1,$2,$3,$4,1,$5,$6,$7,$8,'current')",
    [
      content,
      study,
      plan.id,
      unit,
      material.job_id,
      hash({ synthetic: true }),
      JSON.stringify(blocks),
      hash(blocks),
    ],
  );
  await db.query(
    "UPDATE teacher_generation_jobs SET state='ready',blocks_duplicate=false WHERE id=$1",
    [material.job_id],
  );
  const anchor = {
    session_id: study,
    content_version_id: content,
    block_id: 'atomicity',
    selection: quote,
  };
  const proposal = {
    question: 'What commits together in an atomic write?',
    answer: 'All changes commit together.',
  };
  let failRemote = false;
  let posts = 0;
  let failImage = false;
  const libraryPosts = [];
  const canvas = createCanvas(48, 48);
  const paint = canvas.getContext('2d');
  paint.fillStyle = '#fe9e3a';
  paint.fillRect(0, 0, 48, 48);
  const generatedPng = canvas.toBuffer('image/png').toString('base64');

  globalThis.fetch = async (target, init) => {
    const address = new URL(String(target));
    if (address.hostname === '127.0.0.1') return originalFetch(target, init);
    assert.equal(address.origin, 'https://api.openai.com');
    const body = JSON.parse(init.body);
    const prompt = body.input?.[0]?.content?.[0]?.text ?? body.input;
    if (address.pathname === '/v1/images/generations') {
      assert.equal(body.model, model);
      assert.equal(body.n, 1);
      libraryPosts.push({ kind: 'image', prompt: body.prompt });
      if (failImage)
        return new Response(
          JSON.stringify({ error: { message: 'fixture rejected' } }),
          { status: 429 },
        );
      return Response.json({ data: [{ b64_json: generatedPng }] });
    }
    assert.equal(address.pathname, '/v1/responses');
    if (prompt.startsWith('Propose one study flashcard')) {
      libraryPosts.push({ kind: 'text', prompt });
      assert.ok(
        !prompt.includes('local-only context') && !prompt.includes(study),
      );
    } else {
      posts += 1;
      const data = JSON.parse(prompt.split('\nINPUT_DATA_JSON\n')[1]);
      assert.ok(quote.includes(data.source.selection));
      assert.deepEqual(Object.keys(data.source), ['selection']);
      assert.equal(data.explanation_language, 'en');
      assert.ok(
        !prompt.includes('local-only context') && !prompt.includes(study),
      );
      if (failRemote) throw new TypeError('Synthetic response lost');
    }
    return new Response(
      JSON.stringify({
        status: 'completed',
        output: [
          {
            type: 'message',
            role: 'assistant',
            content: [
              {
                type: 'output_text',
                text: JSON.stringify({ schema_version: 1, ...proposal }),
              },
            ],
          },
        ],
      }),
    );
  };

  class TestModule {}
  Module({
    controllers: [
      TeacherFlashcardGenerationController,
      TeacherFlashcardLibraryController,
      TeacherFlashcardsController,
    ],
    providers: [
      { provide: TeacherService, useValue: store },
      { provide: TEACHER_GENERATION_PORT, useValue: runtime },
      { provide: FlashcardLibraryStore, useValue: libraryStore },
      { provide: FlashcardLibraryTransport, useValue: libraryTransport },
      TeacherFlashcardGenerationUseCase,
      TeacherFlashcardLibraryUseCase,
      TeacherFlashcardsUseCase,
      TeacherFlashcardsStore,
    ],
  })(TestModule);
  app = await NestFactory.create(TestModule, {
    logger: false,
    bodyParser: false,
  });
  app.setGlobalPrefix('api/v1');
  app.use('/api/v1/teacher', teacherBodyParser);
  app.use((req, _res, next) => {
    const user =
      req.headers['x-fixture-actor'] === 'other'
        ? other
        : req.headers['x-fixture-actor'] === 'no-module'
          ? noModule
          : actor;
    req.auth = { user: { id: user.userId }, sessionId: user.sessionId };
    next();
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(0, '127.0.0.1');
  const base = (await app.getUrl()) + '/api/v1/teacher/flashcards/generations';
  const proposalsBase =
    (await app.getUrl()) + '/api/v1/teacher/flashcards/proposals';
  async function request(path, status, { body, fixtureActor } = {}) {
    const response = await fetch(base + path, {
      method: body ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-fixture-actor': fixtureActor ?? 'owner',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const result = await response.json();
    assert.equal(response.status, status, JSON.stringify(result));
    return result;
  }
  async function library(path, status, { body, fixtureActor } = {}) {
    const response = await fetch(proposalsBase + path, {
      method: body ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-fixture-actor': fixtureActor ?? 'owner',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    assert.match(response.headers.get('cache-control') ?? '', /no-store/);
    const result = await response.json();
    assert.equal(response.status, status, JSON.stringify(result));
    return result;
  }
  const intent = { request_key: randomUUID(), source: anchor, selection };
  await request('', 404, { body: intent, fixtureActor: 'other' });
  await request('', 403, { body: intent, fixtureActor: 'no-module' });
  await request('', 409, {
    body: { ...intent, selection: { ...selection, model_id: 'wrong-model' } },
  });
  await request('', 409, {
    body: { ...intent, source: { ...anchor, selection: 'fabricated quote' } },
  });
  const accepted = await request('', 202, { body: intent });
  const path = '/' + accepted.id;
  const requestPath = '/requests/' + intent.request_key;
  assert.deepEqual(await request(requestPath, 200), accepted);
  await request(path, 404, { fixtureActor: 'other' });
  await request(requestPath, 404, { fixtureActor: 'other' });
  assert.deepEqual(await request('', 202, { body: intent }), accepted);
  await request('', 409, {
    body: { ...intent, source: { ...anchor, selection: 'all changes' } },
  });
  assert.equal(posts, 0);
  assert.ok(await runtime.execute(randomUUID(), AbortSignal.timeout(10000)));
  assert.deepEqual(await request(path, 200), {
    id: accepted.id,
    state: 'ready',
    error_code: null,
    proposal,
  });
  assert.deepEqual(await request(requestPath, 200), await request(path, 200));
  const read = new ReadTeacherUseCase(store, runtime);
  await assert.rejects(read.job(actor, accepted.id), /not_found/);
  assert.equal(posts, 1);
  assert.deepEqual(
    await db.query('SELECT count(*)::int AS n FROM teacher_flashcards'),
    [{ n: 0 }],
  );

  const [{ id: cardId }] = await db.query(
    "INSERT INTO teacher_flashcards(owner_user_id,question,answer,source) VALUES($1,'Old question?','Old answer.',$2) RETURNING id",
    [actor.userId, { label: 'Atomicity', anchor }],
  );
  const regeneration = {
    request_key: randomUUID(),
    card_id: cardId,
    revision: 1,
    parts: 'text',
    selection,
  };
  const regenerated = await request('', 202, { body: regeneration });
  assert.ok(await runtime.execute(randomUUID(), AbortSignal.timeout(10000)));
  assert.deepEqual(
    (await request('/' + regenerated.id, 200)).proposal,
    proposal,
  );
  assert.deepEqual(
    await db.query(
      'SELECT question,answer,revision FROM teacher_flashcards WHERE id=$1',
      [cardId],
    ),
    [{ question: 'Old question?', answer: 'Old answer.', revision: 1 }],
  );

  const stale = await request('', 202, {
    body: { ...regeneration, request_key: randomUUID() },
  });
  await db.query('UPDATE teacher_flashcards SET revision=2 WHERE id=$1', [
    cardId,
  ]);
  assert.equal(
    await runtime.execute(randomUUID(), AbortSignal.timeout(10000)),
    false,
  );
  assert.equal((await request('/' + stale.id, 200)).state, 'failed_known');
  assert.equal(posts, 2);
  const lostIntent = {
    ...intent,
    request_key: randomUUID(),
    source: { ...anchor, selection: 'all changes' },
  };
  const lost = await request('', 202, { body: lostIntent });
  failRemote = true;
  assert.ok(await runtime.execute(randomUUID(), AbortSignal.timeout(10000)));
  assert.equal((await request('/' + lost.id, 200)).state, 'unknown');
  assert.deepEqual(await request('', 202, { body: lostIntent }), lost);
  assert.deepEqual(
    await request('', 202, {
      body: { ...lostIntent, request_key: randomUUID() },
    }),
    lost,
  );
  assert.equal(
    await runtime.execute(randomUUID(), AbortSignal.timeout(10000)),
    false,
  );
  assert.equal(posts, 3);
  assert.deepEqual(
    await db.query('SELECT dispatches_used FROM teacher_sessions WHERE id=$1', [
      study,
    ]),
    [{ dispatches_used: 3 }],
  );
  await db.query(
    "UPDATE teacher_content_versions SET publication_state='superseded' WHERE id=$1",
    [content],
  );
  assert.equal((await request(path, 409)).code, 'invalid_anchor');
  await db.query(
    "UPDATE teacher_content_versions SET publication_state='current' WHERE id=$1",
    [content],
  );
  const imageEligibility =
    '/eligibility?' +
    new URLSearchParams({
      kind: 'image',
      connection_id: selection.connection_id,
      mode: selection.mode,
      model_id: selection.model_id,
    });
  const notesIntent = {
    request_key: randomUUID(),
    origin: {
      kind: 'notes',
      notes: 'Atomicity means that all writes commit together.',
    },
    parts: 'both',
    text_selection: selection,
    image_selection: selection,
  };
  await library('', 403, { body: notesIntent, fixtureActor: 'no-module' });
  assert.deepEqual(await library(imageEligibility, 200), {
    eligible: false,
    reason_code: 'flashcard_image_unqualified',
    selection,
  });
  assert.equal(
    (await library('', 422, { body: notesIntent })).code,
    'flashcard_image_unqualified',
  );
  assert.equal(libraryPosts.length, 0);

  // Synthetic qualification stays entirely inside this disposable database.
  const qualificationId = randomUUID();
  await store.scope(
    actor,
    null,
    ({ manager, actor: current }) =>
      libraryStore.admit(manager, {
        id: qualificationId,
        owner: current.actorId,
        authSession: current.sessionId,
        requestKey: randomUUID(),
        requestHash: hash({ test: 'separate qualification' }),
        origin: { kind: 'notes' },
        qualification: true,
        textPrompt: null,
        textSelection: null,
        imagePrompt: FLASHCARD_IMAGE_QUALIFICATION_PROMPT,
        imageSelection: selection,
      }),
    true,
  );
  const [{ id: qualificationRole }] = await db.query(
    "INSERT INTO roles(key) VALUES('super_admin') ON CONFLICT(key) DO UPDATE SET is_active=true RETURNING id",
  );
  await db.query(
    'INSERT INTO user_roles(user_id,role_id,is_active) VALUES($1,$2,true)',
    [actor.userId, qualificationRole],
  );
  const runLibrary = () =>
    libraryRuntime.execute(randomUUID(), AbortSignal.timeout(10000));
  assert.ok(await runLibrary());
  assert.deepEqual(libraryPosts, [
    { kind: 'image', prompt: FLASHCARD_IMAGE_QUALIFICATION_PROMPT },
  ]);
  const [{ id: qualificationOperation }] = await db.query(
    "SELECT id FROM ai_generation_operations WHERE flashcard_proposal_id=$1 AND phase='closed' AND acknowledged_at IS NOT NULL",
    [qualificationId],
  );
  await store.scope(
    actor,
    null,
    ({ manager, actor: current }) =>
      libraryTransport.acceptImageQualification(
        manager,
        selection,
        qualificationOperation,
        current.actorId,
      ),
    true,
  );
  await db.query('DELETE FROM user_roles WHERE user_id=$1 AND role_id=$2', [
    actor.userId,
    qualificationRole,
  ]);
  await library('/' + qualificationId, 404);
  assert.deepEqual(await library(imageEligibility, 200), {
    eligible: true,
    reason_code: null,
    selection,
  });

  const [{ n: studiesBefore }] = await db.query(
    'SELECT count(*)::int AS n FROM teacher_sessions',
  );
  const note = await library('', 202, { body: notesIntent });
  const notePath = '/' + note.id;
  const noteRequestPath = '/requests/' + notesIntent.request_key;
  assert.deepEqual(await library('', 202, { body: notesIntent }), note);
  assert.equal(
    (
      await library('', 409, {
        body: {
          ...notesIntent,
          origin: { kind: 'notes', notes: 'A different lesson.' },
        },
      })
    ).code,
    'idempotency_conflict',
  );
  await library(notePath, 404, { fixtureActor: 'other' });
  await library(noteRequestPath, 404, { fixtureActor: 'other' });
  await library(notePath + '/image', 404);
  assert.equal((await library(notePath, 200)).image.state, 'queued');
  assert.ok(await runLibrary());
  const textReady = await library(noteRequestPath, 200);
  assert.deepEqual(textReady.text, {
    state: 'ready',
    error_code: null,
    value: proposal,
  });
  assert.equal(textReady.image.state, 'queued');
  assert.equal('origin' in textReady, false);
  assert.ok(await runLibrary());
  const noteReady = await library(notePath, 200);
  assert.equal(noteReady.image.state, 'ready');
  assert.deepEqual(
    libraryPosts.slice(-2).map((post) => post.kind),
    ['text', 'image'],
  );
  assert.ok(libraryPosts.at(-1).prompt.includes(proposal.answer));
  const image = await fetch(proposalsBase + notePath + '/image');
  assert.equal(image.status, 200);
  assert.equal(image.headers.get('content-type'), 'image/webp');
  assert.equal(image.headers.get('x-content-type-options'), 'nosniff');
  assert.match(image.headers.get('cache-control'), /private, no-store/);
  const imageBytes = Buffer.from(await image.arrayBuffer());
  assert.ok(imageBytes.length <= 144 * 1024);
  assert.equal(imageBytes.toString('ascii', 8, 12), 'WEBP');
  await library(notePath + '/image', 404, { fixtureActor: 'other' });
  assert.deepEqual(
    await db.query('SELECT count(*)::int AS n FROM teacher_sessions'),
    [{ n: studiesBefore }],
  );
  const cardsBase = (await app.getUrl()) + '/api/v1/teacher/flashcards/cards';
  assert.equal(
    (await db.query('SELECT count(*)::int AS n FROM teacher_flashcards'))[0].n,
    1,
  );
  const saved = await fetch(cardsBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      request_key: randomUUID(),
      ...noteReady.text.value,
      image: { side: 'answer', data: imageBytes.toString('base64') },
    }),
  });
  const savedCard = await saved.json();
  assert.equal(saved.status, 201, JSON.stringify(savedCard));
  assert.deepEqual(savedCard.image, { side: 'answer' });
  const storedImage = await fetch(cardsBase + '/' + savedCard.id + '/image');
  assert.equal(storedImage.status, 200);
  assert.deepEqual(Buffer.from(await storedImage.arrayBuffer()), imageBytes);

  const quoteIntent = {
    request_key: randomUUID(),
    origin: { kind: 'quote', anchor },
    parts: 'both',
    text_selection: selection,
    image_selection: selection,
  };
  await library('', 404, { body: quoteIntent, fixtureActor: 'other' });
  const quoteDraft = await library('', 202, { body: quoteIntent });
  assert.ok(await runLibrary());
  assert.ok(await runLibrary());
  assert.equal((await library('/' + quoteDraft.id, 200)).image.state, 'ready');

  const partialIntent = {
    ...quoteIntent,
    request_key: randomUUID(),
    origin: { kind: 'quote', anchor: { ...anchor, selection: 'all changes' } },
  };
  const partial = await library('', 202, { body: partialIntent });
  assert.ok(await runLibrary());
  failImage = true;
  assert.ok(await runLibrary());
  failImage = false;
  const quotePreview = await library('/' + partial.id, 200);
  assert.deepEqual(quotePreview.text.value, proposal);
  assert.equal(quotePreview.image.state, 'unknown');
  const postsAfterImageFailure = libraryPosts.length;
  assert.deepEqual(await library('', 202, { body: partialIntent }), partial);
  assert.equal(
    (
      await library('', 409, {
        body: { ...partialIntent, request_key: randomUUID() },
      })
    ).code,
    'flashcard_proposal_outcome_unknown',
  );
  assert.equal(await runLibrary(), false);
  assert.equal(libraryPosts.length, postsAfterImageFailure);

  const [{ id: libraryCard }] = await db.query(
    "INSERT INTO teacher_flashcards(owner_user_id,question,answer) VALUES($1,'Explain atomicity','All or nothing.') RETURNING id",
    [actor.userId],
  );
  const imageIntent = {
    request_key: randomUUID(),
    origin: { kind: 'card', id: libraryCard, revision: 1 },
    parts: 'image',
    image_selection: selection,
  };
  await library('', 404, { body: imageIntent, fixtureActor: 'other' });
  const replacement = await library('', 202, { body: imageIntent });
  assert.ok(await runLibrary());
  const imagePreview = await library('/' + replacement.id, 200);
  assert.equal(imagePreview.text.state, 'skipped');
  assert.equal(imagePreview.image.state, 'ready');
  assert.ok(libraryPosts.at(-1).prompt.includes('All or nothing.'));
  assert.deepEqual(
    await db.query(
      'SELECT question,answer,revision,image_side FROM teacher_flashcards WHERE id=$1',
      [libraryCard],
    ),
    [
      {
        question: 'Explain atomicity',
        answer: 'All or nothing.',
        revision: 1,
        image_side: null,
      },
    ],
  );
  await db.query('UPDATE teacher_flashcards SET revision=2 WHERE id=$1', [
    libraryCard,
  ]);
  assert.equal(
    (await library('/' + replacement.id, 409)).code,
    'revision_conflict',
  );

  const both = await library('', 202, {
    body: {
      ...imageIntent,
      request_key: randomUUID(),
      origin: { ...imageIntent.origin, revision: 2 },
      parts: 'both',
      text_selection: selection,
    },
  });
  assert.ok(await runLibrary());
  assert.ok(libraryPosts.at(-1).prompt.includes('All or nothing.'));
  assert.ok(await runLibrary());
  assert.deepEqual((await library('/' + both.id, 200)).text.value, proposal);
  assert.equal((await library('/' + both.id, 200)).image.state, 'ready');
  assert.ok(libraryPosts.at(-1).prompt.includes(proposal.answer));

  await db.query(
    "UPDATE teacher_flashcard_library_proposals SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",
    [note.id],
  );
  await library(notePath, 404);
  await library(notePath + '/image', 404);
  await libraryRuntime.recover();
  assert.deepEqual(
    await db.query(
      'SELECT state,prompt,text_value,image_bytes FROM teacher_flashcard_library_parts WHERE proposal_id=$1 ORDER BY kind',
      [note.id],
    ),
    [
      { state: 'ready', prompt: null, text_value: null, image_bytes: null },
      { state: 'ready', prompt: null, text_value: null, image_bytes: null },
    ],
  );
  assert.deepEqual(await library('', 202, { body: notesIntent }), note);

  const beforeFinal = {
    ...intent,
    request_key: randomUUID(),
    source: { ...anchor, selection: 'changes together' },
  };
  const finalQueued = await request('', 202, { body: beforeFinal });
  await store.scope(
    actor,
    study,
    async ({ manager, session }) => {
      const assessmentId = await publishAssessment(
        manager,
        session,
        material.job_id,
        {
          schema_version: 1,
          scope: 'section_final',
          plan_revision_id: plan.id,
          section_id: section,
          unit_id: null,
          items: [
            {
              local_ref: 'one',
              objective_id: objective,
              kind: 'single_choice',
              prompt: 'Choose the outcome.',
              options: [
                { id: 'all', label: 'All changes' },
                { id: 'some', label: 'Only some changes' },
              ],
              private_key: { kind: 'single_choice', option_id: 'all' },
              explanation: 'Atomic changes commit together.',
            },
          ],
        },
        [
          {
            ordinal: 1,
            objective_id: objective,
            kind: 'single_choice',
            max_points: 2,
          },
        ],
        defaultPolicy(1),
        null,
      );
      await startStoredAttempt(manager, session, assessmentId, 'direct');
    },
    true,
  );
  assert.equal(
    (await request(path, 409)).code,
    'helper_unavailable_during_final',
  );
  assert.equal(
    (await library('/' + quoteDraft.id, 409)).code,
    'helper_unavailable_during_final',
  );
  assert.equal(
    (
      await request('', 409, {
        body: { ...beforeFinal, request_key: randomUUID() },
      })
    ).code,
    'helper_unavailable_during_final',
  );
  assert.equal(
    await runtime.execute(randomUUID(), AbortSignal.timeout(10000)),
    false,
  );
  assert.deepEqual(await request('/' + finalQueued.id, 200), {
    id: finalQueued.id,
    state: 'failed_known',
    error_code: 'helper_unavailable_during_final',
    proposal: null,
  });
  assert.equal(posts, 3);
  console.log(
    'Teacher flashcard text and image proposal integration passed (intercepted HTTP, no provider requests).',
  );
} finally {
  globalThis.fetch = originalFetch;
  try {
    await app?.close();
  } finally {
    if (db.isInitialized) await db.destroy();
  }
}
