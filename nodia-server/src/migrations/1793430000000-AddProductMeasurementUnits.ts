import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Existing products and their pre-unit snapshots retain the explicit unit default. */
export class AddProductMeasurementUnits1793430000000 implements MigrationInterface {
  name = 'AddProductMeasurementUnits1793430000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`ALTER TABLE products
      ALTER COLUMN code DROP NOT NULL,
      ADD COLUMN measurement_unit varchar(16) NOT NULL DEFAULT 'unit',
      ADD CONSTRAINT ck_products_measurement_unit
        CHECK(measurement_unit IN ('unit','kg','g','bundle'))`);
    await runner.query(`ALTER TABLE product_logs
      ALTER COLUMN code DROP NOT NULL,
      ADD COLUMN measurement_unit varchar(16) NOT NULL DEFAULT 'unit',
      ADD CONSTRAINT ck_product_logs_measurement_unit
        CHECK(measurement_unit IN ('unit','kg','g','bundle'))`);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query('LOCK TABLE products,product_logs IN ACCESS EXCLUSIVE MODE');
    const [row]: { would_lose_data: boolean }[] = await runner.query(`SELECT
      EXISTS(SELECT 1 FROM products WHERE code IS NULL OR measurement_unit<>'unit') OR
      EXISTS(SELECT 1 FROM product_logs WHERE code IS NULL OR measurement_unit<>'unit') AS would_lose_data`);
    if (row?.would_lose_data !== false)
      throw Error('product:rollback_would_lose_measurement_data');
    await runner.query(`ALTER TABLE product_logs
      DROP CONSTRAINT ck_product_logs_measurement_unit,
      DROP COLUMN measurement_unit, ALTER COLUMN code SET NOT NULL`);
    await runner.query(`ALTER TABLE products
      DROP CONSTRAINT ck_products_measurement_unit,
      DROP COLUMN measurement_unit, ALTER COLUMN code SET NOT NULL`);
  }
}
