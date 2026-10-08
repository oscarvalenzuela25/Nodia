import type { MigrationInterface, QueryRunner } from 'typeorm';

export class SelectSoleAiApiKey1791330000000 implements MigrationInterface {
  name = 'SelectSoleAiApiKey1791330000000';

  async up(runner: QueryRunner): Promise<void> {
    // Lock the same provider rows as key mutations before repairing historical pools.
    await runner.query(`SELECT id FROM ai_providers ORDER BY id FOR UPDATE`);
    await runner.query(`UPDATE ai_api_keys k SET is_selected = true, updated_at = NOW()
      WHERE k.is_active = true AND k.is_selected = false
      AND (SELECT COUNT(*) FROM ai_api_keys pool WHERE pool.provider_id = k.provider_id) = 1`);
  }

  async down(): Promise<void> {
    // Do not undo the user's current credential selection. Restore its explicit backup if needed.
  }
}
