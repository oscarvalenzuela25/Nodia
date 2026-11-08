import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Unit snapshots preserve historical meaning when a product changes its unit later. */
export class AddFractionalSaleQuantities1793440000000 implements MigrationInterface {
  name = 'AddFractionalSaleQuantities1793440000000';

  async up(runner: QueryRunner): Promise<void> {
    const checks: { conname: string }[] =
      await runner.query(`SELECT conname FROM pg_constraint
      WHERE conrelid='public.sale_items'::regclass AND contype='c'
      AND pg_get_constraintdef(oid) LIKE '%line_total%'
      AND pg_get_constraintdef(oid) LIKE '%quantity%'
      AND pg_get_constraintdef(oid) LIKE '%unit_price%'`);
    if (checks.length !== 1 || checks[0].conname !== 'sale_items_check')
      throw new Error('business:sale_quantity_constraint_changed');
    await runner.query(`ALTER TABLE sale_items DROP CONSTRAINT sale_items_check;
      ALTER TABLE sale_items DROP CONSTRAINT sale_items_quantity_check;
      ALTER TABLE sale_items ALTER COLUMN quantity TYPE numeric USING quantity::numeric;
      ALTER TABLE sale_items ADD CONSTRAINT ck_sale_items_quantity_decimal
        CHECK(quantity>0 AND quantity<=2147483647 AND scale(quantity)<=3);
      ALTER TABLE sale_items ADD CONSTRAINT ck_sale_items_rounded_line_total
        CHECK(line_total::numeric=round(quantity*unit_price::numeric,0));
      ALTER TABLE sale_items ALTER COLUMN product_code_snapshot DROP NOT NULL;
      ALTER TABLE sale_items ADD COLUMN measurement_unit_snapshot varchar(16) NOT NULL DEFAULT 'unit';
      ALTER TABLE sale_items ADD CONSTRAINT ck_sale_items_measurement_unit
        CHECK(measurement_unit_snapshot IN ('unit','kg','g','bundle'));`);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(
      'LOCK TABLE sale_mutation_requests,sale_items IN ACCESS EXCLUSIVE MODE',
    );
    const [row]: { unsafe: boolean }[] = await runner.query(`SELECT
      EXISTS(SELECT 1 FROM sale_items WHERE quantity<>trunc(quantity)
        OR measurement_unit_snapshot<>'unit' OR product_code_snapshot IS NULL)
      OR EXISTS(SELECT 1 FROM sale_mutation_requests
        WHERE jsonb_path_exists(result,'$.items[*].measurement_unit_snapshot')) AS unsafe`);
    if (row?.unsafe !== false)
      throw new Error('business:sale_quantity_rollback_would_lose_data');
    await runner.query(`ALTER TABLE sale_items DROP CONSTRAINT ck_sale_items_measurement_unit;
      ALTER TABLE sale_items DROP COLUMN measurement_unit_snapshot;
      ALTER TABLE sale_items ALTER COLUMN product_code_snapshot SET NOT NULL;
      ALTER TABLE sale_items DROP CONSTRAINT ck_sale_items_rounded_line_total;
      ALTER TABLE sale_items DROP CONSTRAINT ck_sale_items_quantity_decimal;
      ALTER TABLE sale_items ALTER COLUMN quantity TYPE integer USING quantity::integer;
      ALTER TABLE sale_items ADD CONSTRAINT sale_items_quantity_check CHECK(quantity>0);
      ALTER TABLE sale_items ADD CONSTRAINT sale_items_check
        CHECK(line_total::numeric=quantity::numeric*unit_price::numeric);`);
  }
}
