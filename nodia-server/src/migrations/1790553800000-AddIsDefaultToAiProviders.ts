import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsDefaultToAiProviders1790553800000
  implements MigrationInterface
{
  name = 'AddIsDefaultToAiProviders1790553800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE ai_providers
        ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;
    `);

    // If there is at least one active provider and none is default, set the first one as default
    await queryRunner.query(`
      WITH first_active AS (
        SELECT id FROM ai_providers
        WHERE is_active = true
        ORDER BY id ASC
        LIMIT 1
      )
      UPDATE ai_providers
      SET is_default = true
      WHERE id IN (SELECT id FROM first_active)
        AND NOT EXISTS (
          SELECT 1 FROM ai_providers WHERE is_default = true
        );
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE ai_providers
        DROP COLUMN IF EXISTS is_default;
    `);
  }
}
