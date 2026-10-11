import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Catalog identity only; an entry never authenticates or implements its provider. */
export class CompleteAiProviderCatalog1791640000000 implements MigrationInterface {
  name = 'CompleteAiProviderCatalog1791640000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`INSERT INTO ai_provider_catalog
      (key,name,can_use_api_key,can_use_token_plan_web,can_use_token_plan_agentic,is_active)
      VALUES ('moonshot','Moonshot AI (Kimi)',false,false,false,true)
      ON CONFLICT(key) DO NOTHING`);
    // Align creation defaults with the current entity contract; preserve all configured rows.
    await runner.query(
      'ALTER TABLE ai_provider_catalog ALTER COLUMN can_use_api_key SET DEFAULT false',
    );
    await runner.query(
      'ALTER TABLE ai_providers ALTER COLUMN use_api_key SET DEFAULT false',
    );
  }

  async down(): Promise<void> {
    // Preserve catalog identities, user connections and safe disabled defaults.
    // Restore a verified backup explicitly if an earlier contract is required.
  }
}
