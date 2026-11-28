import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { QueryFailedError, type EntityManager } from 'typeorm';
import type { ActorReference } from '../../authorization/authority-transaction.js';
import type {
  CreateFlashcardDeckDto,
  CreateFlashcardDto,
  CreateFlashcardReviewDto,
  CreateFlashcardSetDto,
  ImportFlashcardsDto,
  PatchFlashcardDto,
  PatchFlashcardDeckDto,
} from '../dto/teacher-flashcards.dto.js';
import { readFlashcardImport } from '../policies/teacher-flashcard-import.js';
import {
  flashcardCollectionTitle,
  flashcardDeckDefinition,
  flashcardDeckId,
  flashcardSetId,
  readFlashcardCreate,
  readFlashcardDeckPatch,
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

type ConfirmedCardEffect = {
  manager: EntityManager;
  expectedRevision: number;
};

@Injectable()
export class TeacherFlashcardsUseCase {
  constructor(
    private readonly teacher: TeacherService,
    private readonly store: TeacherFlashcardsStore,
  ) {}

  decks(actor: ActorReference) {
    return this.scope(actor, (scope) => this.store.decks(scope));
  }

  deckPage(actor: ActorReference, page: number, manager: EntityManager) {
    this.requirePage(page);
    return this.scope(
      actor,
      (scope) => this.store.deckPage(scope, page),
      manager,
    );
  }

  deck(actor: ActorReference, id: string, manager?: EntityManager) {
    const deckId = flashcardDeckId(id);
    return this.scope(
      actor,
      async (scope) => {
        const deck = await this.store.deck(scope, deckId);
        if (!deck) teacherError('not_found', 404);
        return deck;
      },
      manager,
    );
  }

  createDeck(
    actor: ActorReference,
    input: CreateFlashcardDeckDto,
    manager?: EntityManager,
  ) {
    const spec = flashcardDeckDefinition(input.title, input.category);
    const setId =
      input.set_id == null ? undefined : flashcardSetId(input.set_id);
    return this.scope(
      actor,
      (scope) => this.createNamedDeck(scope, spec, setId),
      manager,
    );
  }

  async patchDeck(
    actor: ActorReference,
    id: string,
    input: PatchFlashcardDeckDto,
  ) {
    const deckId = requireUuid(id).toLowerCase();
    const patch = readFlashcardDeckPatch(input);
    try {
      return await this.scope(actor, async (scope) => {
        if (patch.setId) await this.requireSet(scope, patch.setId);
        const deck = await this.store.patchDeck(scope, deckId, patch);
        if (!deck) teacherError('not_found', 404);
        return deck;
      });
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        error.driverError.code === '23505' &&
        error.driverError.constraint ===
          'teacher_flashcard_decks_owner_user_id_normalized_title_key'
      ) {
        teacherError('flashcard_deck_duplicate');
      }
      throw error;
    }
  }

  deleteDeck(actor: ActorReference, id: string) {
    const deckId = requireUuid(id).toLowerCase();
    return this.scope(actor, async (scope) => {
      // Serialize deletion with card creation, import, and moves into this deck.
      if (!(await this.store.lockDeck(scope, deckId, 'update')))
        teacherError('not_found', 404);
      await this.store.deleteDeck(scope, deckId);
    });
  }

  sets(actor: ActorReference) {
    return this.scope(actor, (scope) => this.store.sets(scope));
  }

  createSet(actor: ActorReference, input: CreateFlashcardSetDto) {
    const spec = flashcardCollectionTitle(input.title);
    return this.scope(actor, async (scope) => {
      const set = await this.store.createSet(scope, spec);
      if (!set) teacherError('flashcard_set_duplicate');
      return set;
    });
  }

  deleteSet(actor: ActorReference, id: string) {
    const setId = requireUuid(id).toLowerCase();
    return this.scope(actor, async (scope) => {
      if (!(await this.store.deleteSet(scope, setId)))
        teacherError('not_found', 404);
    });
  }

  importCards(
    actor: ActorReference,
    input: ImportFlashcardsDto,
    manager?: EntityManager,
  ) {
    const { requestKey, destination, cards } = readFlashcardImport(input);
    const digest = hash({ destination, cards });
    return this.scope<FlashcardImportResult>(
      actor,
      async (scope) => {
        await this.store.lockCreation(scope, requestKey, 'import');
        const previous = await this.store.importReceipt(scope, requestKey);
        if (previous) {
          if (previous.request_hash === null)
            teacherError('flashcard_deck_deleted', 410);
          if (previous.request_hash !== digest)
            teacherError('idempotency_conflict');
          // A replay confirms the original JSON destination even if the deck was edited.
          const deck =
            destination.kind === 'new'
              ? {
                  ...previous.deck,
                  title: destination.deck.title,
                  category: destination.deck.category,
                  ...(destination.setId && { set_id: destination.setId }),
                }
              : previous.deck;
          return {
            deck,
            imported_count: previous.imported_count,
          };
        }
        const deckId =
          destination.kind === 'new'
            ? (
                await this.createNamedDeck(
                  scope,
                  destination.deck,
                  destination.setId,
                )
              ).id
            : destination.deckId;
        if (
          destination.kind === 'existing' &&
          deckId &&
          !(await this.store.lockDeck(scope, deckId, 'key-share'))
        )
          teacherError('not_found', 404);
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
        await this.store.recordImport(
          scope,
          requestKey,
          digest,
          deckId,
          result,
        );
        return result;
      },
      manager,
    );
  }

  cards(
    actor: ActorReference,
    deck: unknown,
    page: number,
    manager?: EntityManager,
  ) {
    const deckId = flashcardDeckId(deck);
    this.requirePage(page);
    return this.scope(
      actor,
      async (scope) => {
        await this.requireDeck(scope, deckId);
        return this.store.cards(scope, deckId, page);
      },
      manager,
    );
  }

  card(actor: ActorReference, id: string, manager?: EntityManager) {
    requireUuid(id);
    return this.scope(actor, (scope) => this.requireCard(scope, id), manager);
  }

  createCard(
    actor: ActorReference,
    input: CreateFlashcardDto,
    manager?: EntityManager,
  ) {
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
    return this.scope(
      actor,
      async (scope) => {
        await this.store.lockCreation(scope, key);
        const previous = await this.store.creation(scope, key);
        if (previous) {
          if (previous.request_hash === null)
            teacherError('flashcard_deleted', 410);
          if (previous.request_hash !== digest)
            teacherError('idempotency_conflict');
          const card = await this.store.card(scope, previous.card_id);
          if (!card) teacherError('flashcard_deleted', 410);
          return card;
        }
        if (
          data.deckId &&
          !(await this.store.lockDeck(scope, data.deckId, 'key-share'))
        )
          teacherError('not_found', 404);
        if (data.source?.anchor)
          await this.requireAnchor(scope, data.source.anchor);
        const id = await this.store.createCard(scope, data, key, digest);
        return this.requireCard(scope, id);
      },
      manager,
    );
  }

  patchCard(
    actor: ActorReference,
    id: string,
    input: PatchFlashcardDto,
    manager?: EntityManager,
  ) {
    requireUuid(id);
    const data = readFlashcardPatch(input);
    return this.scope(
      actor,
      async (scope) => {
        // Take the destination deck lock before the card lock, matching deleteDeck.
        const targetReady =
          !data.deckId ||
          (await this.store.lockDeck(scope, data.deckId, 'key-share'));
        const card = await this.store.lockCard(scope, id);
        if (!card) teacherError('not_found', 404);
        if (card.revision !== data.revision || data.revision === 2147483647)
          teacherError('revision_conflict');
        if (data.imageSide !== undefined && card.image_side === null)
          teacherError('invalid_input', 400);
        if (!targetReady) teacherError('not_found', 404);
        if (data.source?.anchor)
          await this.requireAnchor(scope, data.source.anchor);
        if (!(await this.store.patchCard(scope, id, data)))
          teacherError('revision_conflict');
        return this.requireCard(scope, id);
      },
      manager,
    );
  }

  deleteCard(actor: ActorReference, id: string, effect?: ConfirmedCardEffect) {
    requireUuid(id);
    return this.scope(
      actor,
      async (scope) => {
        const key = await this.store.creationKey(scope, id);
        if (!key) teacherError('not_found', 404);
        await this.store.lockCreation(scope, key);
        if (effect)
          await this.requireRevision(scope, id, effect.expectedRevision);
        await this.store.deleteCard(scope, id);
      },
      effect?.manager,
    );
  }

  image(actor: ActorReference, id: string) {
    requireUuid(id);
    return this.scope(actor, async (scope) => {
      const image = await this.store.image(scope, id);
      if (!image) teacherError('not_found', 404);
      return image;
    });
  }

  review(
    actor: ActorReference,
    id: string,
    input: CreateFlashcardReviewDto,
    effect?: ConfirmedCardEffect,
  ) {
    const cardId = requireUuid(id).toLowerCase();
    const key = requireUuid(input.request_key).toLowerCase();
    if (typeof input.remembered !== 'boolean')
      teacherError('invalid_input', 400);
    return this.scope(
      actor,
      async (scope) => {
        if (effect)
          await this.requireRevision(scope, cardId, effect.expectedRevision);
        else if (!(await this.store.lockReviewCard(scope, cardId)))
          teacherError('not_found', 404);
        if (!(await this.store.remember(scope, cardId, key, input.remembered)))
          teacherError('idempotency_conflict');
      },
      effect?.manager,
    );
  }

  private scope<T>(
    actor: ActorReference,
    work: (scope: FlashcardScope) => Promise<T>,
    manager?: EntityManager,
  ) {
    return this.teacher.scope(
      actor,
      null,
      ({ manager: scopedManager, actor: current }) =>
        work({ manager: scopedManager, owner: current.actorId }),
      false,
      manager,
    );
  }

  private async requireRevision(
    scope: FlashcardScope,
    id: string,
    revision: number,
  ) {
    const card = await this.store.lockCard(scope, id);
    if (!card) teacherError('not_found', 404);
    if (card.revision !== revision) teacherError('revision_conflict');
  }

  private requirePage(page: number) {
    if (!Number.isInteger(page) || page < 1 || page > 999999999)
      teacherError('invalid_input', 400);
  }

  private async requireDeck(scope: FlashcardScope, deckId: string | null) {
    if (deckId && !(await this.store.hasDeck(scope, deckId)))
      teacherError('not_found', 404);
  }

  private async createNamedDeck(
    scope: FlashcardScope,
    spec: FlashcardDeckDefinition,
    setId?: string,
  ) {
    if (setId) {
      await this.requireSet(scope, setId);
    } else {
      // Compatibility for clients and existing assistant commands without a Set field.
      setId = (
        await this.store.findOrCreateSet(
          scope,
          flashcardCollectionTitle('Mazos sin clasificar'),
        )
      ).id;
    }
    const deck = await this.store.createDeck(scope, spec, setId);
    if (!deck) teacherError('flashcard_deck_duplicate');
    return deck;
  }

  private async requireSet(scope: FlashcardScope, setId: string) {
    if (!(await this.store.lockSet(scope, setId)))
      teacherError('not_found', 404);
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
