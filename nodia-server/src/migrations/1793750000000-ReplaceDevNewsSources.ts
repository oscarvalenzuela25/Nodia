import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ReplaceDevNewsSources1793750000000 implements MigrationInterface {
  name = 'ReplaceDevNewsSources1793750000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Keep existing snapshots valid while the application retires their sources.
    await queryRunner.query(`
      ALTER TABLE news_sources
        DROP CONSTRAINT news_sources_source_key_check,
        ADD CONSTRAINT news_sources_source_key_check
          CHECK (source_key IN ('web-dev', 'node-js', 'go-blog', 'rust-blog', 'kubernetes-blog'))
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Only the new disposable snapshots are incompatible with the previous CHECK.
    await queryRunner.query(`
      DELETE FROM news_sources WHERE source_key IN ('go-blog', 'rust-blog', 'kubernetes-blog');
      ALTER TABLE news_sources
        DROP CONSTRAINT news_sources_source_key_check,
        ADD CONSTRAINT news_sources_source_key_check
          CHECK (source_key IN ('web-dev', 'node-js'));
    `);
  }
}
