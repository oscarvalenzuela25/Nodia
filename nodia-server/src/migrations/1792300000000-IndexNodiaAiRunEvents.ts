import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Existing M1 content and cascade semantics are unchanged. */
export class IndexNodiaAiRunEvents1792300000000 implements MigrationInterface {
  name = 'IndexNodiaAiRunEvents1792300000000';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE INDEX nodia_ai_events_run_seq_idx ON nodia_ai_events (run_id, seq)',
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX nodia_ai_events_run_seq_idx');
  }
}
