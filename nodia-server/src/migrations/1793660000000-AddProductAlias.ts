import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Existing catalog/log rows remain unknown; invoice names are never backfilled as aliases. */
export class AddProductAlias1793660000000 implements MigrationInterface {
  name = 'AddProductAlias1793660000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE products ADD COLUMN alias varchar(255) NULL');
    await q.query('ALTER TABLE product_logs ADD COLUMN alias varchar(255) NULL');
  }

  async down(): Promise<void> {
    throw new Error('product_alias_rollback_requires_backup_restore');
  }
}
