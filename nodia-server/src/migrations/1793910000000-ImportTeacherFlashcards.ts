import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ImportTeacherFlashcards1793910000000 implements MigrationInterface {
  name = 'ImportTeacherFlashcards1793910000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      ALTER TABLE teacher_flashcard_decks ADD COLUMN category varchar(80)
        CHECK (btrim(category) <> '');
      CREATE TABLE teacher_flashcard_import_requests (
        owner_user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        request_key uuid NOT NULL,
        request_hash char(64) NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
        deck_id uuid,
        card_count integer NOT NULL,
        imported_count integer NOT NULL CHECK (imported_count BETWEEN 1 AND 30),
        CHECK (card_count >= imported_count),
        PRIMARY KEY (owner_user_id, request_key),
        FOREIGN KEY (owner_user_id, deck_id) REFERENCES teacher_flashcard_decks(owner_user_id, id)
      );
    `);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`
      LOCK TABLE teacher_flashcard_decks, teacher_flashcard_import_requests IN ACCESS EXCLUSIVE MODE;
      DO $guard$
      BEGIN
        IF EXISTS (SELECT 1 FROM teacher_flashcard_decks WHERE category IS NOT NULL)
          OR EXISTS (SELECT 1 FROM teacher_flashcard_import_requests) THEN
          RAISE EXCEPTION 'Preserve the flashcard categories and import receipts before removing this migration';
        END IF;
      END $guard$;
      DROP TABLE teacher_flashcard_import_requests;
      ALTER TABLE teacher_flashcard_decks DROP COLUMN category;
    `);
  }
}
