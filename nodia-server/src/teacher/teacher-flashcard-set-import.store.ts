import { Injectable } from '@nestjs/common';
import type { FlashcardScope } from './teacher-flashcards.store.js';

@Injectable()
export class TeacherFlashcardSetImportStore {
  async receipt({ manager, owner }: FlashcardScope, key: string) {
    const [receipt]: { set_id: string | null; request_hash: string }[] =
      await manager.query(
        `SELECT set_id, request_hash FROM teacher_flashcard_set_import_requests
         WHERE owner_user_id = $1 AND request_key = $2`,
        [owner, key],
      );
    return receipt;
  }

  async record(
    { manager, owner }: FlashcardScope,
    key: string,
    digest: string,
    setId: string,
  ) {
    await manager.query(
      `INSERT INTO teacher_flashcard_set_import_requests
         (owner_user_id, request_key, request_hash, set_id) VALUES ($1, $2, $3, $4)`,
      [owner, key, digest, setId],
    );
  }
}
