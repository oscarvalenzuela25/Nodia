import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTeacherFlashcardSets1793950000000 implements MigrationInterface {
  name = 'CreateTeacherFlashcardSets1793950000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      CREATE TABLE teacher_flashcard_sets (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_user_id bigint NOT NULL REFERENCES users(id),
        title varchar(120) NOT NULL CHECK (btrim(title) <> ''),
        normalized_title varchar(160) COLLATE "C" NOT NULL CHECK (normalized_title <> ''),
        UNIQUE (owner_user_id, id),
        UNIQUE (owner_user_id, normalized_title)
      );
      ALTER TABLE teacher_flashcard_decks
        ADD COLUMN set_id uuid,
        ADD CONSTRAINT fk_flashcard_decks_owner_set
          FOREIGN KEY (owner_user_id, set_id) REFERENCES teacher_flashcard_sets(owner_user_id, id)
          ON DELETE SET NULL (set_id);
      CREATE INDEX ix_flashcard_decks_owner_set
        ON teacher_flashcard_decks(owner_user_id, set_id) WHERE set_id IS NOT NULL;
      ALTER TABLE teacher_flashcard_import_requests
        ALTER COLUMN request_hash DROP NOT NULL,
        ADD CONSTRAINT ck_flashcard_import_deleted_deck CHECK (request_hash IS NOT NULL OR deck_id IS NULL);
      CREATE INDEX ix_flashcard_imports_owner_deck
        ON teacher_flashcard_import_requests(owner_user_id, deck_id) WHERE deck_id IS NOT NULL;
    `);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`
      LOCK TABLE teacher_flashcard_sets, teacher_flashcard_decks,
        teacher_flashcard_import_requests IN ACCESS EXCLUSIVE MODE;
      DO $guard$
      BEGIN
        IF EXISTS (SELECT 1 FROM teacher_flashcard_sets)
          OR EXISTS (SELECT 1 FROM teacher_flashcard_import_requests WHERE request_hash IS NULL) THEN
          RAISE EXCEPTION 'Preserve the flashcard sets and import tombstones before removing this migration';
        END IF;
      END $guard$;
      DROP INDEX ix_flashcard_imports_owner_deck;
      ALTER TABLE teacher_flashcard_import_requests
        DROP CONSTRAINT ck_flashcard_import_deleted_deck,
        ALTER COLUMN request_hash SET NOT NULL;
      DROP INDEX ix_flashcard_decks_owner_set;
      ALTER TABLE teacher_flashcard_decks DROP COLUMN set_id;
      DROP TABLE teacher_flashcard_sets;
    `);
  }
}
