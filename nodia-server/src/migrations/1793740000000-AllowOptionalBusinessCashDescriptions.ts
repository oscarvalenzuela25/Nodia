import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AllowOptionalBusinessCashDescriptions1793740000000 implements MigrationInterface {
  name = 'AllowOptionalBusinessCashDescriptions1793740000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      ALTER TABLE business_cash_categories
        DROP CONSTRAINT ck_business_cash_categories_description,
        ADD CONSTRAINT ck_business_cash_categories_description
          CHECK (description = '' OR char_length(btrim(description)) > 0);

      ALTER TABLE business_cash_movements
        DROP CONSTRAINT ck_business_cash_movements_source,
        ADD CONSTRAINT ck_business_cash_movements_source CHECK (
          (source = 'manual' AND invoice_id IS NULL AND NOT withdrawn_from_invoice
            AND description IS NOT NULL AND (description = '' OR description ~ '[^[:space:]]'))
          OR (source = 'invoice' AND type = 'expense' AND invoice_id IS NOT NULL
            AND description IS NULL)
        );
    `);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`
      ALTER TABLE business_cash_categories
        DROP CONSTRAINT ck_business_cash_categories_description,
        ADD CONSTRAINT ck_business_cash_categories_description
          CHECK (char_length(btrim(description)) > 0);

      ALTER TABLE business_cash_movements
        DROP CONSTRAINT ck_business_cash_movements_source,
        ADD CONSTRAINT ck_business_cash_movements_source CHECK (
          (source = 'manual' AND invoice_id IS NULL AND NOT withdrawn_from_invoice
            AND description IS NOT NULL AND description ~ '[^[:space:]]')
          OR (source = 'invoice' AND type = 'expense' AND invoice_id IS NOT NULL
            AND description IS NULL)
        );
    `);
  }
}
