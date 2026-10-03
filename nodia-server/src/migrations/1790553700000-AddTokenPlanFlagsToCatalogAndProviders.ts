import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTokenPlanFlagsToCatalogAndProviders1790553700000
  implements MigrationInterface
{
  name = 'AddTokenPlanFlagsToCatalogAndProviders1790553700000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add can_use_* permission flags to ai_provider_catalog
    await queryRunner.query(`
      ALTER TABLE ai_provider_catalog
        ADD COLUMN IF NOT EXISTS can_use_api_key BOOLEAN NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS can_use_token_plan_web BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS can_use_token_plan_agentic BOOLEAN NOT NULL DEFAULT false;
    `);

    // 2. Enable token plan modes for Gemini in the catalog
    await queryRunner.query(`
      UPDATE ai_provider_catalog
      SET
        can_use_api_key = true,
        can_use_token_plan_web = true,
        can_use_token_plan_agentic = true
      WHERE key = 'gemini';
    `);

    // 3. Remove obsolete columns (key, fields_version, mode) from ai_providers
    await queryRunner.query(`
      ALTER TABLE ai_providers
        DROP COLUMN IF EXISTS key,
        DROP COLUMN IF EXISTS fields_version,
        DROP COLUMN IF EXISTS mode;
    `);

    // Drop obsolete enum if exists
    await queryRunner.query(`
      DROP TYPE IF EXISTS ai_providers_mode_enum CASCADE;
    `);

    // 4. Add use_* active switch flags and default_mode to ai_providers
    await queryRunner.query(`
      ALTER TABLE ai_providers
        ADD COLUMN IF NOT EXISTS use_api_key BOOLEAN NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS use_token_plan_web BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS use_token_plan_agentic BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS default_mode VARCHAR(32) DEFAULT NULL;
    `);

    // 5. Add check constraint for default_mode
    await queryRunner.query(`
      ALTER TABLE ai_providers
        DROP CONSTRAINT IF EXISTS chk_ai_providers_default_mode;
      ALTER TABLE ai_providers
        ADD CONSTRAINT chk_ai_providers_default_mode
        CHECK (default_mode IS NULL OR default_mode IN ('api_key', 'token_plan_web', 'token_plan_agentic'));
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Revert check constraint and columns in ai_providers
    await queryRunner.query(`
      ALTER TABLE ai_providers
        DROP CONSTRAINT IF EXISTS chk_ai_providers_default_mode,
        DROP COLUMN IF EXISTS default_mode,
        DROP COLUMN IF EXISTS use_token_plan_agentic,
        DROP COLUMN IF EXISTS use_token_plan_web,
        DROP COLUMN IF EXISTS use_api_key;
    `);

    // 2. Re-create obsolete columns in ai_providers if reverting
    await queryRunner.query(`
      CREATE TYPE ai_providers_mode_enum AS ENUM ('api_key', 'web_session');
      ALTER TABLE ai_providers
        ADD COLUMN IF NOT EXISTS key VARCHAR(64),
        ADD COLUMN IF NOT EXISTS fields_version SMALLINT NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS mode ai_providers_mode_enum NOT NULL DEFAULT 'api_key';
    `);

    // 3. Revert ai_provider_catalog columns
    await queryRunner.query(`
      ALTER TABLE ai_provider_catalog
        DROP COLUMN IF EXISTS can_use_token_plan_agentic,
        DROP COLUMN IF EXISTS can_use_token_plan_web,
        DROP COLUMN IF EXISTS can_use_api_key;
    `);
  }
}
