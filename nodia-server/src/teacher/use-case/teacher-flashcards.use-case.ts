import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { ActorReference } from '../../authorization/authority-transaction.js';
import type {
  CreateFlashcardDeckDto,
  CreateFlashcardDto,
  CreateFlashcardReviewDto,
  ImportFlashcardsDto,
  PatchFlashcardDto,
} from '../dto/teacher-flashcards.dto.js';
import { readFlashcardImport } from '../policies/teacher-flashcard-import.js';
import {
  flashcardDeckDefinition,
  flashcardDeckId,
  readFlashcardCreate,
  readFlashcardPatch,
} from '../policies/teacher-flashcards.js';
import {
  hash,
  requireUuid,
  teacherError,
} from '../policies/teacher-validation.js';
import {
  TeacherFlashcardsStore,
  type FlashcardScope,
} from '../teacher-flashcards.store.js';
import { TeacherService } from '../teacher.service.js';
import type {
  FlashcardAnchor,
  FlashcardDeckDefinition,
  FlashcardImportResult,
} from '../types/teacher-flashcards.types.js';
import {
  readAnchor,
  rejectFinalHelp,
} from './teacher-enrichment-persistence.js';

@Injectable()
export class TeacherFlashcardsUseCase {
  constructor(
    private readonly teacher: TeacherService,
    private readonly store: TeacherFlashcardsStore,
  ) {}

  decks(actor: ActorReference) {
    return this.scope(actor, (scope) => this.store.decks(scope));
  }

  createDeck(actor: ActorReference, input: CreateFlashcardDeckDto) {
    const spec = flashcardDeckDefinition(input.title, input.category);
    return this.scope(actor, (scope) => this.createNamedDeck(scope, spec));
  }

  importCards(actor: ActorReference, input: ImportFlashcardsDto) {
    const { requestKey, destination, cards } = readFlashcardImport(input);
    const digest = hash({ destination, cards });
    return this.scope<FlashcardImportResult>(actor, async (scope) => {
      await this.store.lockCreation(scope, requestKey, 'import');
      const previous = await this.store.importReceipt(scope, requestKey);
      if (previous) {
        if (previous.request_hash !== digest)
          teacherError('idempotency_conflict');
        return { deck: previous.deck, imported_count: previous.imported_count };
      }
      const deckId =
        destination.kind === 'new'
          ? (await this.createNamedDeck(scope, destination.deck)).id
          : destination.deckId;
      if (destination.kind === 'existing')
        await this.requireDeck(scope, deckId);
      await this.store.importCards(
        scope,
        deckId,
        cards.map((card) => ({
          ...card,
          request_hash: hash({ ...card, deckId, image: null }),
        })),
      );
      const deck = await this.store.deck(scope, deckId);
      if (!deck) teacherError('not_found', 404);
      const result = { deck, imported_count: cards.length };
      await this.store.recordImport(scope, requestKey, digest, deckId, result);
      return result;
    });
  }

  cards(actor: ActorReference, deck: unknown, page: number) {
    const deckId = flashcardDeckId(deck);
    if (!Number.isInteger(page) || page < 1 || page > 999999999)
      teacherError('invalid_input', 400);
    return this.scope(actor, async (scope) => {
      await this.requireDeck(scope, deckId);
      return this.store.cards(scope, deckId, page);
    });
  }

  createCard(actor: ActorReference, input: CreateFlashcardDto) {
    const key = requireUuid(input.request_key).toLowerCase();
    const data = readFlashcardCreate(input);
    const digest = hash({
      ...data,
      image:
        data.image === null
          ? null
          : {
              side: data.image.side,
              sha256: createHash('sha256')
                .update(data.image.bytes)
                .digest('hex'),
            },
    });
    return this.scope(actor, async (scope) => {
      await this.store.lockCreation(scope, key);
      const previous = await this.store.creation(scope, key);
      if (previous) {
        if (previous.request_hash === null)
          teacherError('flashcard_deleted', 410);
        if (previous.request_hash !== digest)
          teacherError('idempotency_conflict');
        return this.requireCard(scope, previous.card_id);
      }
      await this.requireDeck(scope, data.deckId);
      if (data.source?.anchor)
        await this.requireAnchor(scope, data.source.anchor);
      const id = await this.store.createCard(scope, data, key, digest);
      return this.requireCard(scope, id);
    });
  }

  patchCard(actor: ActorReference, id: string, input: PatchFlashcardDto) {
    requireUuid(id);
    const data = readFlashcardPatch(input);
    return this.scope(actor, async (scope) => {
      const card = await this.store.lockCard(scope, id);
      if (!card) teacherError('not_found', 404);
      if (card.revision !== data.revision || data.revision === 2147483647)
        teacherError('revision_conflict');
      if (data.imageSide !== undefined && card.image_side === null)
        teacherError('invalid_input', 400);
      if (data.deckId !== undefined) await this.requireDeck(scope, data.deckId);
      if (data.source?.anchor)
        await this.requireAnchor(scope, data.source.anchor);
      if (!(await this.store.patchCard(scope, id, data)))
        teacherError('revision_conflict');
      return this.requireCard(scope, id);
    });
  }

  deleteCard(actor: ActorReference, id: string) {
    requireUuid(id);
    return this.scope(actor, async (scope) => {
      const key = await this.store.creationKey(scope, id);
      if (!key) teacherError('not_found', 404);
      await this.store.lockCreation(scope, key);
      await this.store.deleteCard(scope, id);
    });
  }

  image(actor: ActorReference, id: string) {
    requireUuid(id);
    return this.scope(actor, async (scope) => {
      const image = await this.store.image(scope, id);
      if (!image) teacherError('not_found', 404);
      return image;
    });
  }

  review(actor: ActorReference, id: string, input: CreateFlashcardReviewDto) {
    const cardId = requireUuid(id).toLowerCase();
    const key = requireUuid(input.request_key).toLowerCase();
    if (typeof input.remembered !== 'boolean')
      teacherError('invalid_input', 400);
    return this.scope(actor, async (scope) => {
      if (!(await this.store.lockReviewCard(scope, cardId)))
        teacherError('not_found', 404);
      if (!(await this.store.remember(scope, cardId, key, input.remembered)))
        teacherError('idempotency_conflict');
    });
  }

  private scope<T>(
    actor: ActorReference,
    work: (scope: FlashcardScope) => Promise<T>,
  ) {
    return this.teacher.scope(actor, null, ({ manager, actor: current }) =>
      work({ manager, owner: current.actorId }),
    );
  }

  private async requireDeck(scope: FlashcardScope, deckId: string | null) {
    if (deckId && !(await this.store.hasDeck(scope, deckId)))
      teacherError('not_found', 404);
  }

  private async createNamedDeck(
    scope: FlashcardScope,
    spec: FlashcardDeckDefinition,
  ) {
    const deck = await this.store.createDeck(scope, spec);
    if (!deck) teacherError('flashcard_deck_duplicate');
    return deck;
  }

  private async requireCard(scope: FlashcardScope, id: string) {
    const card = await this.store.card(scope, id);
    if (!card) teacherError('not_found', 404);
    return card;
  }

  private async requireAnchor(
    { manager, owner }: FlashcardScope,
    anchor: FlashcardAnchor,
  ) {
    // Order the final-assessment check against Teacher commands changing this session.
    const [session]: { id: string }[] = await manager.query(
      'SELECT id FROM teacher_sessions WHERE id = $1 AND owner_user_id = $2 FOR SHARE',
      [anchor.session_id, owner],
    );
    if (!session) teacherError('not_found', 404);
    await rejectFinalHelp(manager, session.id);
    await readAnchor(manager, session.id, { ...anchor });
  }
}
