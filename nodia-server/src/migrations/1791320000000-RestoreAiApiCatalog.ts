import type { MigrationInterface, QueryRunner } from 'typeorm';

export class RestoreAiApiCatalog1791320000000 implements MigrationInterface {
  name = 'RestoreAiApiCatalog1791320000000';
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`ALTER TABLE ai_provider_catalog
      ADD COLUMN IF NOT EXISTS can_use_api_key boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS can_use_token_plan_web boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS can_use_token_plan_agentic boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true`);
    await runner.query(`INSERT INTO ai_provider_catalog
      (key, name, can_use_api_key, can_use_token_plan_web, can_use_token_plan_agentic, is_active, created_at, updated_at)
      VALUES ('gemini', 'Google Gemini', true, true, true, true, NOW(), NOW()), ('openai', 'OpenAI', true, false, false, true, NOW(), NOW())
      ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, is_active = true, updated_at = NOW(), can_use_api_key = EXCLUDED.can_use_api_key,
        can_use_token_plan_web = EXCLUDED.can_use_token_plan_web,
        can_use_token_plan_agentic = EXCLUDED.can_use_token_plan_agentic`);
  }
  async down(): Promise<void> {
    // Catalog records may now be referenced by user connections. Preserve all rows/flags.
    // Restore the pre-run catalog backup explicitly if an operational rollback is required.
  }
}
