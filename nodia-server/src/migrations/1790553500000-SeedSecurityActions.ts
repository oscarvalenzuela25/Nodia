import type { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedSecurityActions1790553500000 implements MigrationInterface {
  name = 'SeedSecurityActions1790553500000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO actions (key, description, is_active)
      VALUES
        ('ai:manage', 'Manage AI providers and credentials', true),
        ('invoice:analyze', 'Analyze invoices with AI', true)
      ON CONFLICT (key) DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO translations (source_entity, source_id, source_key, locale, value, is_active)
      SELECT 'actions', a.id::text, 'key', labels.locale, labels.value, true
      FROM actions a
      JOIN (VALUES
        ('ai:manage', 'es', 'Gestionar IA'),
        ('ai:manage', 'en', 'Manage AI'),
        ('invoice:analyze', 'es', 'Analizar facturas con IA'),
        ('invoice:analyze', 'en', 'Analyze invoices with AI')
      ) AS labels(action_key, locale, value) ON labels.action_key = a.key
      ON CONFLICT (source_entity, source_id, source_key, locale) DO NOTHING
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_user_roles_active_user_role
      ON user_roles (user_id, role_id) WHERE is_active = true
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_role_actions_active_role_action
      ON role_actions (role_id, action_id) WHERE is_active = true
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS idx_role_actions_active_role_action',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS idx_user_roles_active_user_role',
    );
    // Leave assigned actions intact so rolling back cannot silently remove permissions.
  }
}
