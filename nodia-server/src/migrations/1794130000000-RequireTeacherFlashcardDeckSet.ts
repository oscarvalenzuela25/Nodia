import type { MigrationInterface, QueryRunner } from 'typeorm';

export class RequireTeacherFlashcardDeckSet1794130000000 implements MigrationInterface {
  name = 'RequireTeacherFlashcardDeckSet1794130000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      LOCK TABLE teacher_flashcard_sets, teacher_flashcard_decks,
        teacher_flashcard_set_import_requests IN ACCESS EXCLUSIVE MODE;
      INSERT INTO teacher_flashcard_sets (owner_user_id, title, normalized_title)
      SELECT DISTINCT owner_user_id, 'Mazos sin clasificar', 'mazos sin clasificar'
      FROM teacher_flashcard_decks WHERE set_id IS NULL
      ON CONFLICT (owner_user_id, normalized_title) DO NOTHING;

      UPDATE teacher_flashcard_decks d
      SET set_id = s.id
      FROM teacher_flashcard_sets s
      WHERE d.owner_user_id = s.owner_user_id AND d.set_id IS NULL
        AND s.normalized_title = 'mazos sin clasificar';

      ALTER TABLE teacher_flashcard_decks
        DROP CONSTRAINT fk_flashcard_decks_owner_set,
        ALTER COLUMN set_id SET NOT NULL,
        ADD CONSTRAINT fk_flashcard_decks_owner_set
          FOREIGN KEY (owner_user_id, set_id) REFERENCES teacher_flashcard_sets(owner_user_id, id);

      ALTER TABLE teacher_flashcard_set_import_requests
        ADD COLUMN set_title varchar(120),
        ADD COLUMN deck_count integer CHECK (deck_count > 0),
        ADD CONSTRAINT ck_flashcard_set_import_snapshot
          CHECK ((set_title IS NULL) = (deck_count IS NULL));
    `);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`
      LOCK TABLE teacher_flashcard_sets, teacher_flashcard_decks,
        teacher_flashcard_set_import_requests IN ACCESS EXCLUSIVE MODE;
      DO $guard$
      BEGIN
        IF EXISTS (SELECT 1 FROM teacher_flashcard_set_import_requests WHERE set_title IS NOT NULL) THEN
          RAISE EXCEPTION 'Preserve the flashcard set import snapshots before removing this migration';
        END IF;
      END $guard$;
      ALTER TABLE teacher_flashcard_set_import_requests
        DROP CONSTRAINT ck_flashcard_set_import_snapshot,
        DROP COLUMN set_title,
        DROP COLUMN deck_count;
      ALTER TABLE teacher_flashcard_decks
        DROP CONSTRAINT fk_flashcard_decks_owner_set,
        ALTER COLUMN set_id DROP NOT NULL,
        ADD CONSTRAINT fk_flashcard_decks_owner_set
          FOREIGN KEY (owner_user_id, set_id) REFERENCES teacher_flashcard_sets(owner_user_id, id)
          ON DELETE SET NULL (set_id);
    `);
  }
}
