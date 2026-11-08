import type { MigrationInterface, QueryRunner } from 'typeorm';

/** User-authorized removal. Other monetary values and immutable proposal payloads are untouched. */
export class RemoveProductProfitPercentage1793620000000 implements MigrationInterface {
  name = 'RemoveProductProfitPercentage1793620000000';

  async up(q: QueryRunner): Promise<void> {
    // No CASCADE: unexpected external dependencies must stop the migration for review.
    await q.query('ALTER TABLE products DROP COLUMN profit_percentage');
    await q.query('ALTER TABLE product_logs DROP COLUMN profit_percentage');
  }

  async down(): Promise<void> {
    // The removed values cannot be derived from sale/cost prices or a new calculator preference.
    throw new Error('product_profit_percentage_rollback_requires_backup_restore');
  }
}
