import { Injectable } from '@nestjs/common';
import type { FlashcardScope } from './teacher-flashcards.store.js';
import type { FlashcardSet } from './types/teacher-flashcards.types.js';

@Injectable()
export class TeacherFlashcardSetImportStore {
  async receipt({ manager, owner }: FlashcardScope, key: string) {
    const [receipt]: {
      set_id: string | null;
      request_hash: string;
      set_title: string | null;
      deck_count: number | null;
    }[] = await manager.query(
      `SELECT set_id, request_hash, set_title, deck_count FROM teacher_flashcard_set_import_requests
         WHERE owner_user_id = $1 AND request_key = $2`,
      [owner, key],
    );
    return receipt;
  }

  async record(
    { manager, owner }: FlashcardScope,
    key: string,
    digest: string,
    set: FlashcardSet,
  ) {
    await manager.query(
      `INSERT INTO teacher_flashcard_set_import_requests
         (owner_user_id, request_key, request_hash, set_id, set_title, deck_count)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [owner, key, digest, set.id, set.title, set.deck_count],
    );
  }
}
