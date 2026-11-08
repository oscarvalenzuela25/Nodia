import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Server-owned drafts preserve setup text without putting prompts into browser storage. */
export class PersistTeacherSetupDraft1793610000000 implements MigrationInterface {
  name = 'PersistTeacherSetupDraft1793610000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE teacher_sessions
      ADD COLUMN setup_draft_text text NOT NULL DEFAULT '',
      ADD COLUMN setup_draft_revision integer NOT NULL DEFAULT 0,
      ADD CONSTRAINT ck_teacher_setup_draft_text CHECK(char_length(setup_draft_text)<=4000 AND octet_length(setup_draft_text)<=8192),
      ADD CONSTRAINT ck_teacher_setup_draft_revision CHECK(setup_draft_revision>=0)`);
  }
  async down(q: QueryRunner): Promise<void> {
    const [row]: { occupied: boolean }[] = await q.query(
      "SELECT EXISTS(SELECT 1 FROM teacher_sessions WHERE setup_draft_text<>'' OR setup_draft_revision<>0) AS occupied",
    );
    if (row.occupied) throw Error('teacher_setup_draft_rollback_requires_reconciliation');
    await q.query(`ALTER TABLE teacher_sessions
      DROP CONSTRAINT ck_teacher_setup_draft_text,
      DROP CONSTRAINT ck_teacher_setup_draft_revision,
      DROP COLUMN setup_draft_text,DROP COLUMN setup_draft_revision`);
  }
}
