import type { MigrationInterface, QueryRunner } from 'typeorm';

const PREVIOUS_IDS = ['gemini-4-hydrogen-high'];

// Versioned connection configuration, using the exact slugs in the official
// Antigravity headless catalog. Discovery still intersects these IDs with the
// current account before they can be activated.
const EXPANDED_IDS = [
  'gemini-4-neon-low',
  'gemini-4-neon-medium',
  'gemini-4-neon-high',
  'gemini-4-neon-xhigh',
  'gemini-4-carbon-low',
  'gemini-4-carbon-medium',
  'gemini-4-carbon-high',
  'gemini-4-hydrogen-low',
  'gemini-4-hydrogen-medium',
  'gemini-4-hydrogen-high',
  'gemini-4-hydrogen-xhigh',
];

export class ExpandGeminiAgenticModelCatalog1794020000000 implements MigrationInterface {
  name = 'ExpandGeminiAgenticModelCatalog1794020000000';

  async up(runner: QueryRunner): Promise<void> {
    await this.replacePolicy(runner, PREVIOUS_IDS, EXPANDED_IDS);
  }

  async down(runner: QueryRunner): Promise<void> {
    await this.replacePolicy(runner, EXPANDED_IDS, PREVIOUS_IDS);
  }

  private async replacePolicy(
    runner: QueryRunner,
    previous: string[],
    next: string[],
  ): Promise<void> {
    await runner.query("SET LOCAL lock_timeout = '5s'");
    await runner.query(`
      UPDATE ai_providers provider
      SET fields = jsonb_set(provider.fields, '{agentic,allowed_model_ids}', $2::jsonb, false),
          updated_at = now()
      FROM ai_provider_catalog catalog
      WHERE provider.catalog_id = catalog.id
        AND catalog.key IN ('gemini', 'google')
        AND provider.fields #> '{agentic,allowed_model_ids}' = $1::jsonb
    `, [JSON.stringify(previous), JSON.stringify(next)]);
  }
}
