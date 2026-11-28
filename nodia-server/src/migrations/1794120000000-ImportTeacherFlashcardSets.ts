import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ImportTeacherFlashcardSets1794120000000 implements MigrationInterface {
  name = 'ImportTeacherFlashcardSets1794120000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      CREATE TABLE teacher_flashcard_set_import_requests (
        owner_user_id bigint NOT NULL REFERENCES users(id),
        request_key uuid NOT NULL,
        request_hash varchar(64) NOT NULL,
        set_id uuid,
        PRIMARY KEY (owner_user_id, request_key),
        FOREIGN KEY (owner_user_id, set_id)
          REFERENCES teacher_flashcard_sets(owner_user_id, id) ON DELETE SET NULL (set_id)
      );
      CREATE INDEX ix_flashcard_set_imports_owner_set
        ON teacher_flashcard_set_import_requests(owner_user_id, set_id) WHERE set_id IS NOT NULL;
    `);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`
      LOCK TABLE teacher_flashcard_set_import_requests IN ACCESS EXCLUSIVE MODE;
      DO $guard$
      BEGIN
        IF EXISTS (SELECT 1 FROM teacher_flashcard_set_import_requests) THEN
          RAISE EXCEPTION 'Preserve the flashcard set import receipts before removing this migration';
        END IF;
      END $guard$;
      DROP TABLE teacher_flashcard_set_import_requests;
    `);
  }
}
