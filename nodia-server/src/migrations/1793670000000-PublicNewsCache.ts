import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PublicNewsCache1793670000000 implements MigrationInterface {
  name = 'PublicNewsCache1793670000000';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE news_sources (
      source_key text PRIMARY KEY CHECK(source_key='web-dev'),
      articles jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(articles)='array' AND jsonb_array_length(articles)<=100),
      feed_ids text[] NOT NULL DEFAULT '{}' CHECK(cardinality(feed_ids)<=100),
      last_attempt_at timestamptz, last_success_at timestamptz, next_refresh_at timestamptz,
      last_error_code text, etag text, last_modified text, lease_token uuid, lease_until timestamptz,
      CHECK((lease_token IS NULL)=(lease_until IS NULL))
    )`);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    // Rollback is explicit; only this bounded external cache is disposable.
    await queryRunner.query('DROP TABLE news_sources');
  }
}
