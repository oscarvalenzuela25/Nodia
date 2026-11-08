import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Archiving a paused session needs two independent continuation frames. */
export class PreserveTeacherArchivedPauseState1793590000000 implements MigrationInterface {
  name = 'PreserveTeacherArchivedPauseState1793590000000';
  async up(q: QueryRunner): Promise<void> {
    const [row]: { ambiguous: boolean }[] = await q.query(
      "SELECT EXISTS(SELECT 1 FROM teacher_sessions WHERE state='archived') AS ambiguous",
    );
    if (row.ambiguous)
      throw new Error(
        'Teacher archive transition requires reconciliation: previous paused state cannot be inferred from legacy archived rows',
      );
    await q.query(
      "ALTER TABLE teacher_sessions ADD COLUMN archived_state text CHECK(archived_state IS NULL OR archived_state IN ('draft','active','paused','completed'))",
    );
  }
  async down(q: QueryRunner): Promise<void> {
    const [row]: { occupied: boolean }[] = await q.query(
      'SELECT EXISTS(SELECT 1 FROM teacher_sessions WHERE archived_state IS NOT NULL) AS occupied',
    );
    if (row.occupied)
      throw new Error(
        'Teacher archive rollback refused: preserve nested paused continuation before removing its frame',
      );
    await q.query('ALTER TABLE teacher_sessions DROP COLUMN archived_state');
  }
}
