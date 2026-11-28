import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Module, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { lockAuthority } from '../dist/authorization/authority-transaction.js';
import { AllExceptionsFilter } from '../dist/common/filters/all-exceptions.filter.js';
import {
  flashcardReadCandidates,
  flashcardWriteCandidates,
} from '../dist/nodia-ai-teacher-operations/flashcard-operations.js';
import { teacherBodyParser } from '../dist/teacher/teacher-body-parser.js';
import { TeacherFlashcardSetImportController } from '../dist/teacher/teacher-flashcard-set-import.controller.js';
import { TeacherFlashcardSetImportStore } from '../dist/teacher/teacher-flashcard-set-import.store.js';
import { TeacherFlashcardsController } from '../dist/teacher/teacher-flashcards.controller.js';
import { TeacherFlashcardsStore } from '../dist/teacher/teacher-flashcards.store.js';
import { TeacherService } from '../dist/teacher/teacher.service.js';
import { TeacherFlashcardSetImportUseCase } from '../dist/teacher/use-case/teacher-flashcard-set-import.use-case.js';
import { TeacherFlashcardsUseCase } from '../dist/teacher/use-case/teacher-flashcards.use-case.js';
import { ExecuteTeacherCommandUseCase } from '../dist/teacher/use-case/execute-teacher-command.use-case.js';
import { TeacherEnrichmentUseCase } from '../dist/teacher/use-case/teacher-enrichment.use-case.js';
import { saveProposal } from '../dist/teacher/use-case/teacher-plan-persistence.js';
import {
  defaultPolicy,
  hash,
} from '../dist/teacher/policies/teacher-validation.js';
import {
  publishAssessment,
  startStoredAttempt,
} from '../dist/teacher/use-case/teacher-attempt-persistence.js';
import { teacherUpgradeLab } from './helpers/teacher-upgrade-lab.mjs';

function disposableDatabase(raw) {
  if (!raw) return undefined;
  const url = new URL(raw);
  assert.ok(
    url.protocol === 'postgresql:' &&
      url.hostname === '127.0.0.1' &&
      /^\/teacher_flashcards_test_[a-z0-9]+$/.test(url.pathname) &&
      !url.search &&
      !url.hash,
    'Use only a disposable local teacher_flashcards_test_* database.',
  );
  return new DataSource({
    type: 'postgres',
    url: url.href,
    synchronize: false,
  });
}

const lab = await teacherUpgradeLab({
  database: disposableDatabase(process.env.TEACHER_FLASHCARDS_TEST_URL),
});
const migration = '1793900000000-CreateTeacherFlashcards';
const importMigration = '1793910000000-ImportTeacherFlashcards';
const setsMigration = '1793950000000-CreateTeacherFlashcardSets';
const setImportMigration = '1794120000000-ImportTeacherFlashcardSets';
const checks = [];
const check = async (name, run) => {
  await run();
  checks.push(name);
};
const webp =
  'UklGRlYAAABXRUJQVlA4WAoAAAAQAAAAAgAAAQAAQUxQSAcAAAAAkZGRkZGRAFZQOCAoAAAAkAEAnQEqAwACAAFAJiWIAnS6AAOYAP70vu/R9cIsjL/G+IL2pMAAAA==';
const flashcards = new TeacherFlashcardsUseCase(
  lab.store,
  new TeacherFlashcardsStore(),
);
const reads = new Map(
  flashcardReadCandidates(flashcards).map((port) => [port.toolName, port]),
);
const writes = new Map(
  flashcardWriteCandidates(flashcards).map((port) => [port.toolName, port]),
);
const checkpoint = (actor, work) =>
  lab.db.transaction(async (manager) => {
    await lockAuthority(manager);
    return work({ actorId: actor.userId, sessionId: actor.sessionId, manager });
  });
let app;

try {
  await lab.migrate('1793630000000-TeacherLearningEvidence');
  await lab.migrate('1793640000000-TeacherLearningEnrichment');
  const core = new ExecuteTeacherCommandUseCase(lab.store, lab.generation);
  const enrichment = new TeacherEnrichmentUseCase(lab.store, lab.generation);
  const sessionId = (
    await core.execute(lab.actor, null, randomUUID(), 'create', {
      topic: 'Synthetic transaction QA',
      objective: 'Explain atomic writes',
      explanation_language: 'en',
      organization: 'topics',
      day_count: null,
      selection: {
        connection_id: '1',
        mode: 'api_key',
        model_id: 'synthetic-isolated-model',
        effort_id: null,
      },
    })
  ).session_id;
  const legacy = await enrichment.execute(lab.actor, sessionId, randomUUID(), {
    expected_revision: 0,
    operation: 'card_create',
    payload: {
      question: 'Legacy question?',
      answer: 'Legacy answer.',
      timezone: 'America/Santiago',
    },
  });

  await check(
    'migration up/down/up preserves the legacy session card',
    async () => {
      await lab.migrate(migration);
      await lab.migrate(migration, 'down');
      await lab.migrate(migration);
      assert.equal(
        (await enrichment.dashboard(lab.actor, sessionId)).review_cards[0].id,
        legacy.resource_id,
      );
    },
  );
  await check(
    'import migration up/down/up preserves existing decks and cards',
    async () => {
      const [{ id: deckId }] = await lab.db.query(`
        INSERT INTO teacher_flashcard_decks (owner_user_id, title, normalized_title)
        VALUES (1, 'Pre-import Q&A', 'pre-import q&a') RETURNING id`);
      const [{ id: cardId }] = await lab.db.query(
        `
        INSERT INTO teacher_flashcards (owner_user_id, deck_id, question, answer)
        VALUES (1, $1, 'Synthetic question?', 'Synthetic answer.') RETURNING id`,
        [deckId],
      );
      await lab.migrate(importMigration);
      await lab.migrate(importMigration, 'down');
      await lab.migrate(importMigration);
      assert.deepEqual(
        await lab.db.query(
          `
        SELECT d.title, d.category, c.question
        FROM teacher_flashcard_decks d JOIN teacher_flashcards c ON c.deck_id=d.id
        WHERE d.id=$1 AND c.id=$2`,
          [deckId, cardId],
        ),
        [
          {
            title: 'Pre-import Q&A',
            category: null,
            question: 'Synthetic question?',
          },
        ],
      );
      await lab.db.query('DELETE FROM teacher_flashcards WHERE id=$1', [
        cardId,
      ]);
      await lab.db.query('DELETE FROM teacher_flashcard_decks WHERE id=$1', [
        deckId,
      ]);
    },
  );

  await check(
    'set migration preserves historical decks and cards',
    async () => {
      const prior = await lab.db.query(`
      WITH deck AS (
        INSERT INTO teacher_flashcard_decks (owner_user_id, title, normalized_title)
        VALUES (1, 'Pre-set deck', 'pre-set deck') RETURNING id
      )
      INSERT INTO teacher_flashcards (owner_user_id, deck_id, question, answer)
      SELECT 1, id, 'Historical question?', 'Historical answer.' FROM deck
      RETURNING deck_id, question
    `);
      await lab.migrate(setsMigration);
      await lab.migrate(setsMigration, 'down');
      await lab.migrate(setsMigration);
      assert.deepEqual(
        await lab.db.query(`
        SELECT c.deck_id, c.question, d.set_id
        FROM teacher_flashcards c JOIN teacher_flashcard_decks d
          ON (d.owner_user_id, d.id) = (c.owner_user_id, c.deck_id)
        WHERE d.title = 'Pre-set deck'
      `),
        [{ ...prior[0], set_id: null }],
      );
      await lab.db.query('DELETE FROM teacher_flashcards WHERE deck_id=$1', [
        prior[0].deck_id,
      ]);
      await lab.db.query('DELETE FROM teacher_flashcard_decks WHERE id=$1', [
        prior[0].deck_id,
      ]);
    },
  );

  class FlashcardLabModule {}
  Module({
    controllers: [TeacherFlashcardsController, TeacherFlashcardSetImportController],
    providers: [
      { provide: TeacherService, useValue: lab.store },
      TeacherFlashcardsStore,
      TeacherFlashcardsUseCase,
      TeacherFlashcardSetImportStore,
      TeacherFlashcardSetImportUseCase,
    ],
  })(FlashcardLabModule);
  app = await NestFactory.create(FlashcardLabModule, {
    logger: false,
    bodyParser: false,
  });
  app.setGlobalPrefix('api/v1');
  app.use('/api/v1/teacher', teacherBodyParser);
  app.use((req, _res, next) => {
    const actor =
      req.headers['x-qa-actor'] === 'other'
        ? lab.other
        : req.headers['x-qa-actor'] === 'no-module'
          ? lab.noModule
          : lab.actor;
    req.auth = { user: { id: actor.userId }, sessionId: actor.sessionId };
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
  const url = (await app.getUrl()) + '/api/v1/teacher/flashcards/';

  async function request(path, { method = 'GET', body, actor } = {}) {
    const response = await fetch(url + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(actor ? { 'x-qa-actor': actor } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const type = response.headers.get('content-type');
    const value =
      response.status === 204
        ? null
        : type === 'image/webp'
          ? Buffer.from(await response.arrayBuffer())
          : await response.json();
    return {
      status: response.status,
      value,
      type,
      cache: response.headers.get('cache-control'),
    };
  }

  function expectStatus(result, status) {
    assert.equal(result.status, status, JSON.stringify(result.value));
    assert.ok(result.cache?.includes('no-store'));
    return result.value;
  }
  const createCard = (body, actor) =>
    request('cards', { method: 'POST', body, actor });
  const manual = {
    request_key: randomUUID(),
    question: 'What is atomicity?',
    answer: 'All writes or none.',
  };

  let card;
  let personalDeck;
  await check(
    'General is virtual, named decks are owner-only, and create replay is idempotent',
    async () => {
      assert.deepEqual(expectStatus(await request('decks'), 200), [
        {
          id: 'general',
          title: 'General',
          category: null,
          set_id: null,
          card_count: 0,
        },
      ]);
      const createDeck = (title, actor) =>
        request('decks', { method: 'POST', body: { title }, actor });
      personalDeck = expectStatus(await createDeck('English'), 201);
      expectStatus(await createDeck('  ENGLISH  '), 409);
      expectStatus(await createDeck('General'), 409);
      const foreign = expectStatus(await createDeck('English', 'other'), 201);
      expectStatus(await request('cards?deck_id=' + foreign.id), 404);
      expectStatus(await createCard({ ...manual, deck_id: foreign.id }), 404);
      const [first, replay] = await Promise.all([
        createCard(manual),
        createCard(manual),
      ]);
      card = expectStatus(first, 201);
      assert.equal(card.deck_id, 'general');
      assert.deepEqual(expectStatus(replay, 201), card);
      expectStatus(await createCard({ ...manual, answer: 'Different' }), 409);
      assert.equal(expectStatus(await request('decks'), 200)[0].card_count, 1);
      assert.equal(expectStatus(await request('cards'), 200).meta.total, 1);
      assert.equal(
        expectStatus(await request('cards', { actor: 'other' }), 200).meta
          .total,
        0,
      );
      expectStatus(await request('decks', { actor: 'no-module' }), 403);
    },
  );

  await check(
    'owner-only optional set membership, with detachment preserving cards',
    async () => {
      const makeSet = (title, actor) =>
        request('sets', {
          method: 'POST',
          body: { title },
          actor,
        });
      const set = expectStatus(await makeSet('  Daily  English  '), 201);
      const foreign = expectStatus(
        await makeSet('Daily English', 'other'),
        201,
      );
      assert.deepEqual(set, {
        id: set.id,
        title: 'Daily English',
        deck_count: 0,
      });
      assert.equal(
        expectStatus(await makeSet('daily english'), 409).code,
        'flashcard_set_duplicate',
      );
      expectStatus(await request('sets', { actor: 'no-module' }), 403);
      const add = (body, actor) =>
        request('decks', {
          method: 'POST',
          body,
          actor,
        });
      expectStatus(await add({ title: 'Day 01', set_id: false }), 400);
      expectStatus(await add({ title: 'Day 01', set_id: foreign.id }), 404);
      const deck = expectStatus(
        await add({
          title: 'Day 01',
          category: 'Practice',
          set_id: set.id,
        }),
        201,
      );
      const path = 'decks/' + deck.id;
      const patch = (body, actor) =>
        request(path, {
          method: 'PATCH',
          body,
          actor,
        });
      expectStatus(await patch({}), 400);
      expectStatus(await patch({ set_id: foreign.id }), 404);
      expectStatus(await patch({ title: 'Foreign' }, 'other'), 404);
      assert.equal(
        expectStatus(await patch({ title: personalDeck.title }), 409).code,
        'flashcard_deck_duplicate',
      );
      assert.deepEqual(
        expectStatus(await patch({ set_id: null, category: null }), 200),
        {
          ...deck,
          category: null,
          set_id: null,
        },
      );
      assert.deepEqual(expectStatus(await patch({ set_id: set.id }), 200), {
        ...deck,
        category: null,
      });
      assert.deepEqual(expectStatus(await request('sets'), 200), [
        { ...set, deck_count: 1 },
      ]);
      assert.deepEqual(
        expectStatus(await request('sets', { actor: 'other' }), 200),
        [foreign],
      );
      const created = expectStatus(
        await createCard({
          ...manual,
          request_key: randomUUID(),
          deck_id: deck.id,
        }),
        201,
      );
      const removeSet = (id, actor) =>
        request('sets/' + id, { method: 'DELETE', actor });
      expectStatus(await removeSet(set.id, 'other'), 404);
      await assert.rejects(
        lab.migrate(setsMigration, 'down'),
        /Preserve the flashcard sets and import tombstones/,
      );
      expectStatus(await removeSet(set.id), 204);
      assert.deepEqual(expectStatus(await request('sets'), 200), []);
      assert.deepEqual(
        expectStatus(await request('decks'), 200).find(
          ({ id }) => id === deck.id,
        ),
        { ...deck, category: null, set_id: null, card_count: 1 },
      );
      assert.deepEqual(
        expectStatus(await request('cards?deck_id=' + deck.id), 200).data,
        [created],
      );
      expectStatus(await request(path, { method: 'DELETE' }), 204);
      expectStatus(await removeSet(foreign.id, 'other'), 204);
    },
  );

  await check(
    'deleting a deck removes its cards, media and reviews and retains non-replayable keys',
    async () => {
      const proposal = {
        request_key: randomUUID(),
        destination: { kind: 'new', title: 'Retired deck' },
        cards: [{ question: 'Example?', answer: 'Example.' }],
      };
      const send = (payload) =>
        request('imports', { method: 'POST', body: payload });
      const { deck } = expectStatus(await send(proposal), 201);
      const destination = {
        ...manual,
        request_key: randomUUID(),
        deck_id: deck.id,
      };
      const card = expectStatus(
        await createCard({
          ...destination,
          image: { side: 'question', data: webp },
        }),
        201,
      );
      expectStatus(
        await request('cards/' + card.id + '/reviews', {
          method: 'POST',
          body: { request_key: randomUUID(), remembered: true },
        }),
        204,
      );
      const foreign = request('decks/' + deck.id, {
        method: 'DELETE',
        actor: 'other',
      });
      expectStatus(await foreign, 404);
      expectStatus(await request('decks/general', { method: 'DELETE' }), 400);
      const [created, removed] = await Promise.all([
        createCard({ ...destination, request_key: randomUUID() }),
        request('decks/' + deck.id, { method: 'DELETE' }),
      ]);
      assert.ok(
        [201, 404].includes(created.status),
        JSON.stringify(created.value),
      );
      expectStatus(removed, 204);
      expectStatus(await request('cards?deck_id=' + deck.id), 404);
      expectStatus(await request('cards/' + card.id + '/image'), 404);
      assert.deepEqual(
        await lab.db.query(
          'SELECT id FROM teacher_flashcards WHERE deck_id=$1',
          [deck.id],
        ),
        [],
      );
      assert.deepEqual(
        await lab.db.query(
          'SELECT card_id FROM teacher_flashcard_reviews WHERE card_id=$1',
          [card.id],
        ),
        [],
      );
      assert.equal(
        expectStatus(
          await createCard({
            ...destination,
            image: { side: 'question', data: webp },
          }),
          410,
        ).code,
        'flashcard_deleted',
      );
      assert.equal(
        expectStatus(await send(proposal), 410).code,
        'flashcard_deck_deleted',
      );
      assert.equal(
        expectStatus(
          await send({
            ...proposal,
            cards: [{ question: 'New?', answer: 'Yes.' }],
          }),
          410,
        ).code,
        'flashcard_deck_deleted',
      );
      assert.deepEqual(
        await lab.db.query(
          'SELECT deck_id, request_hash FROM teacher_flashcard_import_requests WHERE owner_user_id=1 AND request_key=$1',
          [proposal.request_key],
        ),
        [{ deck_id: null, request_hash: null }],
      );
      await assert.rejects(
        lab.migrate(setsMigration, 'down'),
        /Preserve the flashcard sets and import tombstones/,
      );
    },
  );

  const path = 'cards/' + card.id;
  await check(
    'private media copies exact bytes, stays owner-only, and supports a face change and removal',
    async () => {
      const patch = (body, actor) =>
        request(path, { method: 'PATCH', body, actor });
      const image = { side: 'question', data: webp };
      const updated = expectStatus(
        await patch({
          revision: card.revision,
          deck_id: personalDeck.id,
          image,
        }),
        200,
      );
      assert.deepEqual(updated.image, { side: 'question' });
      assert.equal(updated.deck_id, personalDeck.id);
      const response = await request(path + '/image');
      assert.equal(response.type, 'image/webp');
      assert.equal(response.cache, 'private, no-store');
      assert.deepEqual(
        expectStatus(response, 200),
        Buffer.from(webp, 'base64'),
      );
      expectStatus(await request(path + '/image', { actor: 'other' }), 404);
      expectStatus(await request(path + '/image', { actor: 'no-module' }), 403);
      expectStatus(
        await patch({ revision: updated.revision, image }, 'other'),
        404,
      );
      expectStatus(await patch({ revision: card.revision, image: null }), 409);
      expectStatus(
        await patch({
          revision: updated.revision,
          image: { ...image, data: 'bad' },
        }),
        400,
      );
      assert.deepEqual(
        expectStatus(await request(path + '/image'), 200),
        Buffer.from(webp, 'base64'),
      );
      const moved = expectStatus(
        await patch({ revision: updated.revision, image_side: 'answer' }),
        200,
      );
      assert.deepEqual(moved.image, { side: 'answer' });
      const removed = expectStatus(
        await patch({
          revision: moved.revision,
          deck_id: 'general',
          image: null,
        }),
        200,
      );
      assert.equal(removed.image, null);
      expectStatus(await request(path + '/image'), 404);
      card = removed;
    },
  );

  await check(
    'lesson source belongs to the owner, requires an exact quote, and respects active finals',
    async () => {
      const section = randomUUID(),
        objective = randomUUID(),
        unit = randomUUID();
      const outline = {
        schema_version: 1,
        title: 'Transactions',
        topic: 'Transactions',
        objective: 'Explain atomic writes',
        explanation_language: 'en',
        organization: 'topics',
        day_count: null,
        assessment_policy: defaultPolicy(1),
        sections: [
          {
            id: section,
            title: 'Atomic writes',
            required: true,
            prerequisite_section_ids: [],
            objectives: [{ id: objective, description: 'Explain atomicity' }],
            units: [
              {
                id: unit,
                title: 'Atomicity',
                objective_ids: [objective],
                day_start: null,
                day_end: null,
              },
            ],
          },
        ],
      };
      const proposal = await lab.store.scope(
        lab.actor,
        sessionId,
        ({ manager, session, actor }) =>
          saveProposal(
            manager,
            session,
            actor.actorId,
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
      const revision = () =>
        lab.db
          .query('SELECT revision FROM teacher_sessions WHERE id=$1', [
            sessionId,
          ])
          .then(([session]) => session.revision);
      await core.execute(
        lab.actor,
        sessionId,
        randomUUID(),
        'accept',
        {
          expected_session_revision: await revision(),
          proposal_revision_id: proposal.id,
          proposal_hash: proposal.content_hash,
        },
        { proposalId: proposal.id },
      );
      const job = await core.execute(
        lab.actor,
        sessionId,
        randomUUID(),
        'material',
        {
          expected_session_revision: await revision(),
          plan_revision_id: proposal.id,
          variant: 'current',
        },
        { unitId: unit },
      );
      const contentId = randomUUID();
      const blocks = [
        {
          id: 'atomicity',
          kind: 'explanation',
          title: 'Atomicity',
          body_markdown: 'Atomic writes commit all changes together.',
        },
      ];
      await lab.db.query(
        "INSERT INTO teacher_content_versions(id,session_id,plan_revision_id,unit_id,version_no,generation_job_id,context_hash,public_blocks,content_hash,publication_state) VALUES($1,$2,$3,$4,1,$5,$6,$7,$8,'current')",
        [
          contentId,
          sessionId,
          proposal.id,
          unit,
          job.job_id,
          hash({ synthetic: true }),
          JSON.stringify(blocks),
          hash(blocks),
        ],
      );
      const anchor = {
        session_id: sessionId,
        content_version_id: contentId,
        block_id: 'atomicity',
        selection: 'commit all changes',
      };
      const source = { label: 'Atomicity', anchor };
      const patchSource = (value, actor) =>
        request(path, {
          method: 'PATCH',
          body: { revision: card.revision, source: value },
          actor,
        });
      expectStatus(
        await patchSource({
          ...source,
          anchor: { ...anchor, selection: 'unavailable quote' },
        }),
        409,
      );
      expectStatus(
        await createCard(
          { ...manual, request_key: randomUUID(), source },
          'other',
        ),
        404,
      );
      card = expectStatus(await patchSource(source), 200);
      assert.deepEqual(card.source, source);
      const getter = reads.get('nodia_teacher_flashcards_get');
      const aiCard = await checkpoint(lab.actor, (context) =>
        getter.execute({ id: card.id }, context),
      );
      assert.deepEqual(aiCard.source, { label: 'Atomicity' });
      await lab.store.scope(
        lab.actor,
        sessionId,
        async ({ manager, session }) => {
          const assessmentId = await publishAssessment(
            manager,
            session,
            job.job_id,
            {
              schema_version: 1,
              scope: 'section_final',
              plan_revision_id: proposal.id,
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
        expectStatus(await patchSource(source), 409).code,
        'helper_unavailable_during_final',
      );
      assert.deepEqual(
        expectStatus(await request('cards'), 200).data[0].source,
        { label: 'Atomicity' },
      );
    },
  );

  await check(
    'review replay registers once, preserves order, and cannot resurrect deleted cards',
    async () => {
      const later = expectStatus(
        await createCard({
          ...manual,
          request_key: randomUUID(),
          question: 'A newer card?',
        }),
        201,
      );
      const rating = { request_key: randomUUID(), remembered: false };
      const review = (body = rating, actor) =>
        request(path + '/reviews', { method: 'POST', body, actor });
      const [first, retry] = await Promise.all([review(), review()]);
      expectStatus(first, 204);
      expectStatus(retry, 204);
      expectStatus(await review({ ...rating, remembered: true }), 409);
      expectStatus(await review(rating, 'other'), 404);
      assert.deepEqual(
        await lab.db.query(
          'SELECT card_id, remembered FROM teacher_flashcard_reviews',
        ),
        [{ card_id: card.id, remembered: false }],
      );
      assert.deepEqual(
        expectStatus(await request('cards'), 200).data.map(({ id }) => id),
        [later.id, card.id],
      );
      expectStatus(
        await request(path, { method: 'DELETE', actor: 'other' }),
        404,
      );
      expectStatus(await request(path, { method: 'DELETE' }), 204);
      expectStatus(await request(path, { method: 'DELETE' }), 204);
      expectStatus(await review(), 404);
      assert.equal(
        expectStatus(await createCard(manual), 410).code,
        'flashcard_deleted',
      );
      assert.deepEqual(
        await lab.db.query('SELECT card_id FROM teacher_flashcard_reviews'),
        [],
      );
      assert.equal(expectStatus(await request('cards'), 200).meta.total, 1);
      assert.equal(
        (await enrichment.dashboard(lab.actor, sessionId)).review_cards[0].id,
        legacy.resource_id,
      );
      await assert.rejects(
        lab.migrate(migration, 'down'),
        /Preserve the flashcards/,
      );
    },
  );

  await check(
    'imports an entire set atomically and recovers concurrent requests without duplicating writes',
    async () => {
      await lab.migrate(setImportMigration);
      await lab.migrate(setImportMigration, 'down');
      await lab.migrate(setImportMigration);
      const importSet = (body, actor) =>
        request('imports/sets', { method: 'POST', body, actor });
      const card = { question: 'What is an import?', answer: 'A batch of new cards.' };
      const proposal = {
        request_key: randomUUID(),
        set: { title: '  Study subjects  ' },
        decks: [
          { title: 'Atomic imports', category: 'Terms', cards: [card] },
          { title: 'Batch imports', cards: [{ ...card, source: 'Notes' }, card] },
        ],
      };
      expectStatus(await importSet(proposal, 'no-module'), 403);
      const copies = await Promise.all([importSet(proposal), importSet(proposal)]);
      const receipt = expectStatus(copies[0], 201);
      assert.deepEqual(expectStatus(copies[1], 201), receipt);
      assert.deepEqual(receipt, {
        set: { id: receipt.set.id, title: 'Study subjects', deck_count: 2 },
        imported_count: 3,
      });
      assert.deepEqual(expectStatus(await request('decks'), 200)
        .filter(deck => deck.set_id === receipt.set.id)
        .map(deck => [deck.title, deck.category, deck.card_count]),
      [['Atomic imports', 'Terms', 1], ['Batch imports', null, 2]]);
      assert.ok(!expectStatus(await request('sets', { actor: 'other' }), 200)
        .some(set => set.id === receipt.set.id));
      assert.equal(expectStatus(await importSet({
        ...proposal, set: { title: 'Different set' },
      }), 409).code, 'idempotency_conflict');

      const conflict = {
        ...proposal,
        request_key: randomUUID(),
        set: { title: 'Should roll back' },
        decks: [{ title: 'A brand new deck', cards: [card] }, proposal.decks[1]],
      };
      assert.equal(expectStatus(await importSet(conflict), 409).code, 'flashcard_deck_duplicate');
      assert.ok(!expectStatus(await request('sets'), 200).some(set => set.title === conflict.set.title));
      assert.ok(!expectStatus(await request('decks'), 200).some(deck => deck.title === conflict.decks[0].title));
      const recovered = expectStatus(await importSet({ ...conflict, decks: [conflict.decks[0]] }), 201);
      expectStatus(await request('sets/' + recovered.set.id, { method: 'DELETE' }), 204);
      assert.equal(expectStatus(await importSet({ ...conflict, decks: [conflict.decks[0]] }), 410).code,
        'flashcard_set_deleted');
      await assert.rejects(lab.migrate(setImportMigration, 'down'), /Preserve the flashcard set import receipts/);
    },
  );

  await check(
    'imports categorized decks and single cards atomically, with owner isolation and stable replay',
    async () => {
      const importCards = (body, actor) =>
        request('imports', { method: 'POST', body, actor });
      const proposal = {
        request_key: randomUUID(),
        destination: {
          kind: 'new',
          title: '  Pronunciation  ',
          category: ' Idiomas　y sonido ',
        },
        cards: [
          {
            question: 'What sound comes first?',
            answer: 'The short vowel.',
            source: 'Synthetic notes',
          },
          { question: 'What sound comes next?', answer: 'The long vowel.' },
        ],
      };
      expectStatus(await importCards(proposal, 'no-module'), 403);
      const [initial, concurrent] = await Promise.all([
        importCards(proposal),
        importCards(proposal),
      ]);
      const confirmed = expectStatus(initial, 201);
      assert.deepEqual(expectStatus(concurrent, 201), confirmed);
      const { deck } = confirmed;
      assert.deepEqual(confirmed, {
        deck: {
          id: deck.id,
          title: 'Pronunciation',
          category: 'Idiomas y sonido',
          set_id: null,
          card_count: 2,
        },
        imported_count: 2,
      });
      assert.ok(
        expectStatus(await request('decks'), 200).some(
          (candidate) => candidate.id === deck.id,
        ),
      );
      assert.ok(
        !expectStatus(await request('decks', { actor: 'other' }), 200).some(
          (candidate) => candidate.id === deck.id,
        ),
      );
      const changed = { ...proposal, cards: [...proposal.cards].reverse() };
      assert.equal(
        expectStatus(await importCards(changed), 409).code,
        'idempotency_conflict',
      );
      const cardsPath = 'cards?deck_id=' + deck.id;
      const stored = expectStatus(await request(cardsPath), 200).data;
      assert.deepEqual(
        stored.map(({ question, answer, source, image }) => ({
          question,
          answer,
          source,
          image,
        })),
        [
          {
            question: proposal.cards[0].question,
            answer: proposal.cards[0].answer,
            source: { label: proposal.cards[0].source },
            image: null,
          },
          {
            question: proposal.cards[1].question,
            answer: proposal.cards[1].answer,
            source: null,
            image: null,
          },
        ],
      );
      const append = {
        request_key: randomUUID(),
        destination: { kind: 'existing', deck_id: deck.id },
        cards: [{ question: 'When?', answer: 'Today.' }],
      };
      expectStatus(await importCards(append, 'other'), 404);
      assert.deepEqual(expectStatus(await importCards(append), 201), {
        deck: { ...deck, card_count: 3 },
        imported_count: 1,
      });
      expectStatus(
        await request('cards/' + stored[0].id, { method: 'DELETE' }),
        204,
      );
      expectStatus(
        await request('cards/' + stored[0].id, { method: 'DELETE' }),
        204,
      );
      const set = expectStatus(
        await request('sets', { method: 'POST', body: { title: 'Listening' } }),
        201,
      );
      const edited = expectStatus(
        await request('decks/' + deck.id, {
          method: 'PATCH',
          body: { title: 'Edited deck', category: 'Listening', set_id: set.id },
        }),
        200,
      );
      assert.equal(edited.title, 'Edited deck');
      assert.deepEqual(expectStatus(await importCards(proposal), 201), {
        ...confirmed,
        deck: { ...deck, set_id: set.id },
      });
      const remainingCards = expectStatus(await request(cardsPath), 200).data;
      assert.deepEqual(
        remainingCards.map(({ question }) => question),
        ['When?', proposal.cards[1].question],
      );
      const general = expectStatus(
        await importCards({
          ...append,
          request_key: randomUUID(),
          destination: { kind: 'existing', deck_id: 'general' },
        }),
        201,
      );
      assert.equal(general.imported_count, 1);
      assert.equal(general.deck.id, 'general');
      assert.equal(general.deck.category, null);
      assert.equal(
        expectStatus(
          await request('decks', {
            method: 'POST',
            body: { title: 'Manual category', category: 'Practice' },
          }),
          201,
        ).category,
        'Practice',
      );
      await assert.rejects(
        lab.migrate(importMigration, 'down'),
        /Preserve the flashcard categories and import receipts/,
      );
    },
  );

  await check(
    'invalid or rejected imports leave no new mazo, cards, or receipt',
    async () => {
      const deckTitle = 'Synthetic rollback deck';
      const body = {
        request_key: randomUUID(),
        destination: { kind: 'new', title: deckTitle },
        cards: [
          { question: 'First?', answer: 'First.' },
          { question: 'Second?', answer: 'Synthetic rollback sentinel.' },
        ],
      };
      const send = (payload) =>
        request('imports', { method: 'POST', body: payload });
      const invalid = {
        ...body,
        cards: [
          body.cards[0],
          { ...body.cards[1], image: 'https://example.test/a.png' },
        ],
      };
      assert.equal((await send(invalid)).status, 400);
      const large = '学'.repeat(2000);
      assert.equal(
        expectStatus(
          await send({
            ...body,
            cards: Array.from({ length: 18 }, () => ({
              question: large,
              answer: large,
            })),
          }),
          413,
        ).code,
        'flashcard_import_too_large',
      );

      await lab.db.query(`
        ALTER TABLE teacher_flashcards ADD CONSTRAINT teacher_flashcard_import_synthetic_rejection
        CHECK (answer <> 'Synthetic rollback sentinel.')`);
      try {
        assert.equal((await send(body)).status, 500);
      } finally {
        await lab.db.query(`
          ALTER TABLE teacher_flashcards DROP CONSTRAINT teacher_flashcard_import_synthetic_rejection`);
      }
      assert.deepEqual(
        await lab.db.query(
          `
        SELECT id FROM teacher_flashcard_decks WHERE title=$1`,
          [deckTitle],
        ),
        [],
      );
      assert.deepEqual(
        await lab.db.query(`
        SELECT id FROM teacher_flashcards WHERE question IN ('First?', 'Second?')`),
        [],
      );
      assert.deepEqual(
        await lab.db.query(
          `
        SELECT request_key FROM teacher_flashcard_import_requests WHERE request_key=$1`,
          [body.request_key],
        ),
        [],
      );
      assert.equal(expectStatus(await send(body), 201).imported_count, 2);
    },
  );

  await check(
    'NodiaAI deck pages keep ordering and counts scoped to the owner',
    async () => {
      await lab.db.query(`
      INSERT INTO teacher_flashcard_decks (owner_user_id, title, normalized_title)
      SELECT 1, 'Flashcard catalog ' || s, 'flashcard catalog ' || s
      FROM generate_series(1, 51) AS p(s)`);
      const list = reads.get('nodia_teacher_flashcard_decks_list');
      const [first, second] = await checkpoint(lab.actor, async (context) => [
        await list.execute({}, context),
        await list.execute({ page: 2 }, context),
      ]);
      const expected = expectStatus(await request('decks'), 200);
      assert.equal(first.data.length, 50);
      assert.equal(first.data[0].id, 'general');
      assert.deepEqual(first.meta, {
        page: 1,
        total: expected.length,
        total_pages: 2,
      });
      assert.equal(second.meta.page, 2);
      assert.deepEqual(
        [...first.data, ...second.data],
        expected.map(({ set_id: _setId, ...deck }) => deck),
      );
      await assert.rejects(
        checkpoint(lab.noModule, (context) => list.execute({}, context)),
        (error) => error.getStatus() === 403,
      );
    },
  );

  await check(
    'NodiaAI flashcard effects keep owner, revisions and checkpoint rollback',
    async () => {
      const importPort = writes.get(
        'nodia_teacher_flashcard_imports_prepare_create',
      );
      const getPort = reads.get('nodia_teacher_flashcards_get');
      const listPort = reads.get('nodia_teacher_flashcards_list');
      const updatePort = writes.get('nodia_teacher_flashcards_prepare_update');
      const deletePort = writes.get('nodia_teacher_flashcards_prepare_delete');
      const reviewPort = writes.get(
        'nodia_teacher_flashcard_reviews_prepare_create',
      );
      const longQuestion = '🟪'.repeat(400);
      const input = {
        destination: {
          kind: 'new',
          title: '  AI   imports  ',
          category: '  Review  ',
        },
        cards: [
          {
            question: longQuestion,
            answer: '  Confirmed answer. ',
            source: ' Notes ',
          },
        ],
      };
      const proposal = await checkpoint(lab.actor, (context) =>
        importPort.prepare(input, context),
      );
      assert.deepEqual(proposal.command.destination, {
        kind: 'new',
        title: 'AI imports',
        category: 'Review',
      });
      assert.deepEqual(
        await lab.db.query(
          "SELECT id FROM teacher_flashcard_decks WHERE title = 'AI imports'",
        ),
        [],
      );
      const requestKey = randomUUID();
      await checkpoint(lab.actor, async (context) => {
        await importPort.verify(proposal, context);
        for (let i = 0; i < 2; i++) {
          assert.deepEqual(
            await importPort.execute(proposal, { ...context, requestKey }),
            { id: requestKey },
          );
        }
      });
      const [{ deck_id: deckId, imported_count: count }] = await lab.db.query(
        'SELECT deck_id, imported_count FROM teacher_flashcard_import_requests WHERE request_key = $1',
        [requestKey],
      );
      assert.equal(count, 1);
      const page = await checkpoint(lab.actor, (context) =>
        listPort.execute({ deck_id: deckId }, context),
      );
      assert.equal(page.meta.total, 1);
      const [summary] = page.data;
      assert.equal(Array.from(summary.question).length, 320);
      assert.equal(summary.question_truncated, true);
      assert.equal(Object.hasOwn(summary, 'answer'), false);
      const id = summary.id;
      const get = (identity) =>
        checkpoint(identity, (context) => getPort.execute({ id }, context));
      assert.deepEqual(await get(lab.actor), {
        id,
        deck_id: deckId,
        question: longQuestion,
        answer: 'Confirmed answer.',
        revision: 1,
        image: null,
        source: { label: 'Notes' },
      });
      await assert.rejects(get(lab.other), { message: 'teacher:not_found' });

      const pendingDelete = await checkpoint(lab.actor, (context) =>
        deletePort.prepare({ id }, context),
      );
      assert.deepEqual(pendingDelete.preview, {
        question: longQuestion,
        deck_title: 'AI imports',
        removes_image: false,
        removes_review_history: true,
      });
      const pendingUpdate = await checkpoint(lab.actor, (context) =>
        updatePort.prepare(
          { id, source: null, answer: '  New answer.  ' },
          context,
        ),
      );
      const update = async (context) => {
        await updatePort.verify(pendingUpdate, context);
        return updatePort.execute(pendingUpdate, {
          ...context,
          requestKey: randomUUID(),
        });
      };
      await assert.rejects(
        checkpoint(lab.actor, async (context) => {
          assert.deepEqual(await update(context), { id });
          assert.equal(
            (await getPort.execute({ id }, context)).answer,
            'New answer.',
          );
          throw new Error('synthetic rollback');
        }),
        { message: 'synthetic rollback' },
      );
      assert.equal((await get(lab.actor)).answer, 'Confirmed answer.');
      await checkpoint(lab.actor, update);
      assert.equal((await get(lab.actor)).source, null);
      await assert.rejects(
        checkpoint(lab.actor, (context) =>
          deletePort.verify(pendingDelete, context),
        ),
        { message: 'teacher:revision_conflict' },
      );
      await assert.rejects(
        checkpoint(lab.actor, (context) =>
          deletePort.execute(pendingDelete, {
            ...context,
            requestKey: randomUUID(),
          }),
        ),
        { message: 'teacher:revision_conflict' },
      );
      assert.equal((await get(lab.actor)).answer, 'New answer.');

      const reviewKey = randomUUID();
      await checkpoint(lab.actor, async (context) => {
        const review = await reviewPort.prepare(
          { id, remembered: false },
          context,
        );
        assert.deepEqual(
          await reviewPort.execute(review, {
            ...context,
            requestKey: reviewKey,
          }),
          { id },
        );
      });
      assert.deepEqual(
        await lab.db.query(
          'SELECT card_id, remembered FROM teacher_flashcard_reviews WHERE request_key = $1',
          [reviewKey],
        ),
        [{ card_id: id, remembered: false }],
      );
    },
  );

  console.log(JSON.stringify({ suite: 'teacher-flashcards', checks }, null, 2));
} finally {
  try {
    await app?.close();
  } finally {
    await lab.close();
  }
}
