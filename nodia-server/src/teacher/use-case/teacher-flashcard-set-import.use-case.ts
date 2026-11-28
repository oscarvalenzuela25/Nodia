import { Injectable } from '@nestjs/common';
import type { ActorReference } from '../../authorization/authority-transaction.js';
import type { ImportFlashcardSetDto } from '../dto/teacher-flashcards.dto.js';
import { readFlashcardSetImport } from '../policies/teacher-flashcard-import.js';
import { hash, teacherError } from '../policies/teacher-validation.js';
import { TeacherFlashcardSetImportStore } from '../teacher-flashcard-set-import.store.js';
import { TeacherFlashcardsStore } from '../teacher-flashcards.store.js';
import { TeacherService } from '../teacher.service.js';

@Injectable()
export class TeacherFlashcardSetImportUseCase {
  constructor(
    private readonly teacher: TeacherService,
    private readonly flashcards: TeacherFlashcardsStore,
    private readonly imports: TeacherFlashcardSetImportStore,
  ) {}

  execute(actor: ActorReference, input: ImportFlashcardSetDto) {
    const { requestKey, set, decks, cardCount } = readFlashcardSetImport(input);
    const digest = hash({ set, decks });
    return this.teacher.scope(actor, null, async ({ manager, actor }) => {
      const scope = { manager, owner: actor.actorId };
      await this.flashcards.lockCreation(scope, 'set:' + requestKey, 'import');
      const previous = await this.imports.receipt(scope, requestKey);
      let setId: string;
      if (previous) {
        if (!previous.set_id) teacherError('flashcard_set_deleted', 410);
        if (previous.request_hash !== digest) teacherError('idempotency_conflict');
        setId = previous.set_id;
      } else {
        const created = await this.flashcards.createSet(scope, set);
        if (!created) teacherError('flashcard_set_duplicate');
        setId = created.id;
        for (const { definition, cards } of decks) {
          const deck = await this.flashcards.createDeck(scope, definition, setId);
          if (!deck) teacherError('flashcard_deck_duplicate');
          await this.flashcards.importCards(
            scope,
            deck.id,
            cards.map(card => ({
              ...card,
              request_hash: hash({ ...card, deckId: deck.id, image: null }),
            })),
          );
        }
        await this.imports.record(scope, requestKey, digest, setId);
      }
      return {
        set: { id: setId, title: set.title, deck_count: decks.length },
        imported_count: cardCount,
      };
    });
  }
}
