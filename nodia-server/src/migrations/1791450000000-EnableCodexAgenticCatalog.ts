import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Capability metadata only. Does not connect accounts or enable existing instances. */
export class EnableCodexAgenticCatalog1791450000000 implements MigrationInterface {
  name = 'EnableCodexAgenticCatalog1791450000000';
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE IF NOT EXISTS nodia_codex_catalog_rollback (
      id bigint PRIMARY KEY, can_use_api_key boolean NOT NULL,
      can_use_token_plan_web boolean NOT NULL, can_use_token_plan_agentic boolean NOT NULL)`);
    await runner.query(`INSERT INTO nodia_codex_catalog_rollback
      SELECT id, can_use_api_key, can_use_token_plan_web, can_use_token_plan_agentic
      FROM ai_provider_catalog WHERE key = 'openai' ON CONFLICT (id) DO NOTHING`);
    await runner.query(`UPDATE ai_provider_catalog SET can_use_api_key = true,
      can_use_token_plan_web = false, can_use_token_plan_agentic = true, updated_at = NOW()
      WHERE key = 'openai'`);
  }
  async down(runner: QueryRunner): Promise<void> {
    const [table] = await runner.query(
      `SELECT to_regclass('nodia_codex_catalog_rollback') AS name`,
    );
    if (!table?.name) return;
    await runner.query(`UPDATE ai_provider_catalog c SET can_use_api_key = b.can_use_api_key,
      can_use_token_plan_web = b.can_use_token_plan_web,
      can_use_token_plan_agentic = b.can_use_token_plan_agentic, updated_at = NOW()
      FROM nodia_codex_catalog_rollback b WHERE c.id = b.id AND c.key = 'openai'`);
    await runner.query('DROP TABLE nodia_codex_catalog_rollback');
  }
}
