import type { MigrationInterface, QueryRunner } from 'typeorm';

export class QualifyTeacherFlashcardImages1793940000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE teacher_flashcard_image_qualifications (
      scope_hash char(64) PRIMARY KEY CHECK(scope_hash ~ '^[a-f0-9]{64}$'),
      contract_version text NOT NULL CHECK(contract_version='teacher-flashcard-library-image/1'),
      operation_id uuid NOT NULL UNIQUE REFERENCES ai_generation_operations(id) ON DELETE RESTRICT,
      response_hash char(64) NOT NULL CHECK(response_hash ~ '^[a-f0-9]{64}$'),
      observed_at timestamptz NOT NULL DEFAULT clock_timestamp()
    )`);
  }

  async down(runner: QueryRunner): Promise<void> {
    const [row] = await runner.query(
      'SELECT EXISTS(SELECT 1 FROM teacher_flashcard_image_qualifications) AS qualified',
    );
    if (row?.qualified !== false)
      throw Error(
        'teacher_flashcard_image_qualification_requires_reconciliation',
      );
    await runner.query('DROP TABLE teacher_flashcard_image_qualifications');
  }
}
