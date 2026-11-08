import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddManualSaleLinePrices1793450000000 implements MigrationInterface {
  name = 'AddManualSaleLinePrices1793450000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`ALTER TABLE sale_items DROP CONSTRAINT sale_items_price_source_check;
      ALTER TABLE sale_items DROP CONSTRAINT sale_items_check1;
      ALTER TABLE sale_items ADD CONSTRAINT ck_sale_items_price_source
        CHECK(price_source IN ('regular','offer','manual'));
      ALTER TABLE sale_items ADD CONSTRAINT ck_sale_items_price_selection CHECK(
        (price_source='manual' AND (NOT is_offer_enabled_snapshot OR offer_price_snapshot IS NOT NULL))
        OR (is_offer_enabled_snapshot AND price_source='offer' AND offer_price_snapshot IS NOT NULL AND unit_price=offer_price_snapshot)
        OR (NOT is_offer_enabled_snapshot AND price_source='regular' AND unit_price=regular_unit_price));`);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(
      'LOCK TABLE sale_items,sale_mutation_requests,sale_events IN ACCESS EXCLUSIVE MODE',
    );
    const [row]: { unsafe: boolean }[] = await runner.query(`SELECT
      EXISTS(SELECT 1 FROM sale_items WHERE price_source='manual')
      OR EXISTS(SELECT 1 FROM sale_mutation_requests
        WHERE jsonb_path_exists(result,'$.items[*] ? (@.price_source == "manual")'))
      OR EXISTS(SELECT 1 FROM sale_events WHERE jsonb_array_length(COALESCE(changes->'manual_prices','[]'::jsonb))>0) AS unsafe`);
    if (row?.unsafe !== false)
      throw new Error('business:sale_manual_price_rollback_would_lose_data');
    await runner.query(`ALTER TABLE sale_items DROP CONSTRAINT ck_sale_items_price_selection;
      ALTER TABLE sale_items DROP CONSTRAINT ck_sale_items_price_source;
      ALTER TABLE sale_items ADD CONSTRAINT sale_items_price_source_check CHECK(price_source IN ('regular','offer'));
      ALTER TABLE sale_items ADD CONSTRAINT sale_items_check1 CHECK(
        (is_offer_enabled_snapshot AND price_source='offer' AND offer_price_snapshot IS NOT NULL AND unit_price=offer_price_snapshot)
        OR (NOT is_offer_enabled_snapshot AND price_source='regular' AND unit_price=regular_unit_price));`);
  }
}
