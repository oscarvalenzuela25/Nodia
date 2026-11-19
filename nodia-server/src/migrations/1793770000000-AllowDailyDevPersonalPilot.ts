import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AllowDailyDevPersonalPilot1793770000000 implements MigrationInterface {
  name = 'AllowDailyDevPersonalPilot1793770000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE news_personal_connections
        DROP CONSTRAINT news_personal_connections_provider_check,
        ADD CONSTRAINT news_personal_connections_provider_check
          CHECK (provider IN ('dev-community', 'daily-dev'))
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      LOCK TABLE news_personal_connections IN ACCESS EXCLUSIVE MODE;
      DO $guard$
      BEGIN
        IF EXISTS (SELECT 1 FROM news_personal_connections WHERE provider = 'daily-dev') THEN
          RAISE EXCEPTION 'daily.dev connections must be preserved before rolling back the pilot';
        END IF;
      END $guard$;
      ALTER TABLE news_personal_connections
        DROP CONSTRAINT news_personal_connections_provider_check,
        ADD CONSTRAINT news_personal_connections_provider_check
          CHECK (provider = 'dev-community');
    `);
  }
}
