import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Existing availability and balances keep their historical meaning. */
export class TrackProductStock1794030000000 implements MigrationInterface {
  name = 'TrackProductStock1794030000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      ALTER TABLE products
        ADD COLUMN track_stock boolean NOT NULL DEFAULT false,
        ALTER COLUMN stock TYPE numeric USING stock::numeric;
      ALTER TABLE products
        ADD CONSTRAINT ck_products_stock_balance
        CHECK(stock BETWEEN -2147483648 AND 2147483647 AND scale(stock) <= 3
          AND (stock >= 0 OR (NOT track_stock AND stock = trunc(stock))));
      ALTER TABLE product_logs
        ADD COLUMN track_stock boolean,
        ALTER COLUMN stock TYPE numeric USING stock::numeric;
      ALTER TABLE product_logs
        ADD CONSTRAINT ck_product_logs_stock_balance
        CHECK(stock BETWEEN -2147483648 AND 2147483647 AND scale(stock) <= 3
          AND (stock >= 0 OR (track_stock IS NOT TRUE AND stock = trunc(stock))));
    `);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query('LOCK TABLE products, product_logs, sale_events IN ACCESS EXCLUSIVE MODE');
    const [row]: { unsafe: boolean }[] = await runner.query(`
      SELECT EXISTS(SELECT 1 FROM products WHERE track_stock OR stock <> trunc(stock))
        OR EXISTS(SELECT 1 FROM product_logs
          WHERE track_stock IS NOT NULL OR stock <> trunc(stock))
        OR EXISTS(SELECT 1 FROM sale_events WHERE changes ? 'stock_deductions') AS unsafe
    `);
    if (row?.unsafe !== false)
      throw new Error('product:stock_tracking_rollback_would_lose_data');
    await runner.query(`
      ALTER TABLE product_logs
        DROP CONSTRAINT ck_product_logs_stock_balance,
        DROP COLUMN track_stock,
        ALTER COLUMN stock TYPE integer USING stock::integer;
      ALTER TABLE products
        DROP CONSTRAINT ck_products_stock_balance,
        DROP COLUMN track_stock,
        ALTER COLUMN stock TYPE integer USING stock::integer;
    `);
  }
}
