import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Extend the bounded cache catalog without changing the previously delivered migration. */
export class NewsNodeSource1793670001000 implements MigrationInterface {
  name = 'NewsNodeSource1793670001000';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE news_sources DROP CONSTRAINT news_sources_source_key_check',
    );
    await queryRunner.query(
      "ALTER TABLE news_sources ADD CONSTRAINT news_sources_source_key_check CHECK(source_key IN ('web-dev','node-js'))",
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    // Node.js public metadata is disposable cache. The original web.dev snapshot remains intact.
    await queryRunner.query(
      "DELETE FROM news_sources WHERE source_key='node-js'",
    );
    await queryRunner.query(
      'ALTER TABLE news_sources DROP CONSTRAINT news_sources_source_key_check',
    );
    await queryRunner.query(
      "ALTER TABLE news_sources ADD CONSTRAINT news_sources_source_key_check CHECK(source_key='web-dev')",
    );
  }
}
