import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Module, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AllExceptionsFilter } from '../dist/common/filters/all-exceptions.filter.js';
import { teacherBodyParser } from '../dist/teacher/teacher-body-parser.js';
import { TeacherFlashcardsController } from '../dist/teacher/teacher-flashcards.controller.js';
import { TeacherFlashcardsStore } from '../dist/teacher/teacher-flashcards.store.js';
import { TeacherService } from '../dist/teacher/teacher.service.js';
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
const checks = [];
const check = async (name, run) => {
  await run();
  checks.push(name);
};
const webp =
  'UklGRlYAAABXRUJQVlA4WAoAAAAQAAAAAgAAAQAAQUxQSAcAAAAAkZGRkZGRAFZQOCAoAAAAkAEAnQEqAwACAAFAJiWIAnS6AAOYAP70vu/R9cIsjL/G+IL2pMAAAA==';
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

  class FlashcardLabModule {}
  Module({
    controllers: [TeacherFlashcardsController],
    providers: [
      { provide: TeacherService, useValue: lab.store },
      TeacherFlashcardsStore,
      TeacherFlashcardsUseCase,
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
        { id: 'general', title: 'General', category: null, card_count: 0 },
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
      assert.deepEqual(
        expectStatus(await importCards(proposal), 201),
        confirmed,
      );
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

  console.log(JSON.stringify({ suite: 'teacher-flashcards', checks }, null, 2));
} finally {
  try {
    await app?.close();
  } finally {
    await lab.close();
  }
}
