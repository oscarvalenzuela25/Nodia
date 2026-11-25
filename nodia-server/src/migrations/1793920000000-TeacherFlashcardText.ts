import type { MigrationInterface, QueryRunner } from 'typeorm';

const previousPurposes =
  "'setup_reply','plan_outline','plan_adjustment','learning_packet','assessment_only','written_feedback','contextual_reply'";

export class TeacherFlashcardText1793920000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      ALTER TABLE teacher_generation_jobs
        DROP CONSTRAINT teacher_generation_jobs_purpose_check,
        ADD CONSTRAINT teacher_generation_jobs_purpose_check
          CHECK(purpose IN (${previousPurposes},'flashcard_text'))
    `);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`
      ALTER TABLE teacher_generation_jobs
        DROP CONSTRAINT teacher_generation_jobs_purpose_check,
        ADD CONSTRAINT teacher_generation_jobs_purpose_check
          CHECK(purpose IN (${previousPurposes}))
    `);
  }
}
