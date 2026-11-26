import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCombinedSalePayments1794050000000 implements MigrationInterface {
  name = 'AddCombinedSalePayments1794050000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      ALTER TABLE sales
        DROP CONSTRAINT sales_payment_method_check,
        ADD CONSTRAINT sales_payment_method_check CHECK (
          payment_method IN ('cash','bank_transfer','debit_card','credit_card','card','other','mixed')
        ),
        ADD CONSTRAINT ck_sales_combined_payment CHECK (
          payment_method <> 'mixed' OR (
            status IN ('completed','cancelled') AND payment_method_description IS NULL
          )
        );

      CREATE TABLE sale_payments (
        id uuid PRIMARY KEY,
        business_id uuid NOT NULL,
        sale_id uuid NOT NULL,
        payment_method varchar(24) NOT NULL CHECK (payment_method IN ('cash','card','bank_transfer')),
        amount bigint NOT NULL CHECK (amount > 0),
        FOREIGN KEY (business_id,sale_id) REFERENCES sales(business_id,id) ON DELETE RESTRICT,
        UNIQUE (business_id,sale_id,payment_method)
      );
    `);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(
      'LOCK TABLE sales,sale_payments IN ACCESS EXCLUSIVE MODE',
    );
    const [row]: { present: boolean }[] = await runner.query(`
      SELECT EXISTS(SELECT 1 FROM sales WHERE payment_method IN ('card','mixed'))
        OR EXISTS(SELECT 1 FROM sale_payments) AS present
    `);
    if (row?.present !== false)
      throw new Error('business:sale_rollback_would_lose_data');
    await runner.query(`
      DROP TABLE sale_payments;
      ALTER TABLE sales
        DROP CONSTRAINT ck_sales_combined_payment,
        DROP CONSTRAINT sales_payment_method_check,
        ADD CONSTRAINT sales_payment_method_check CHECK (
          payment_method IN ('cash','bank_transfer','debit_card','credit_card','other')
        );
    `);
  }
}
