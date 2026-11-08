import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBusinessSales1793410000000 implements MigrationInterface {
  name = 'CreateBusinessSales1793410000000';
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      ALTER TABLE businesses ADD COLUMN sales_timezone varchar(64) NOT NULL DEFAULT 'America/Santiago';
      CREATE TABLE sales (
        id uuid PRIMARY KEY, business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
        status varchar(16) NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','completed','cancelled','discarded')),
        currency varchar(3) NOT NULL DEFAULT 'CLP' CHECK(currency='CLP'),
        payment_method varchar(24) NOT NULL DEFAULT 'cash' CHECK(payment_method IN ('cash','bank_transfer','debit_card','credit_card','other')),
        payment_method_description varchar(500), total_amount bigint NOT NULL DEFAULT 0 CHECK(total_amount>=0),
        version integer NOT NULL DEFAULT 1 CHECK(version>0),
        created_by bigint NOT NULL REFERENCES users(id), updated_by bigint NOT NULL REFERENCES users(id),
        completed_by bigint REFERENCES users(id), cancelled_by bigint REFERENCES users(id),
        created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
        completed_at timestamptz, cancelled_at timestamptz, cancellation_reason varchar(500),
        UNIQUE(business_id,id),
        CHECK(status NOT IN ('completed','cancelled') OR (total_amount>0 AND completed_at IS NOT NULL AND completed_by IS NOT NULL)),
        CHECK(status NOT IN ('draft','discarded') OR (completed_at IS NULL AND completed_by IS NULL)),
        CHECK((status='cancelled' AND cancelled_at IS NOT NULL AND cancelled_by IS NOT NULL AND cancellation_reason IS NOT NULL AND length(btrim(cancellation_reason))>0)
          OR (status<>'cancelled' AND cancelled_at IS NULL AND cancelled_by IS NULL AND cancellation_reason IS NULL))
      );
      CREATE INDEX idx_sales_business_status_updated ON sales(business_id,status,updated_at DESC,id);
      CREATE INDEX idx_sales_business_completed ON sales(business_id,completed_at DESC,id) WHERE status='completed';
      CREATE TABLE sale_items (
        id uuid PRIMARY KEY, business_id uuid NOT NULL, sale_id uuid NOT NULL, product_id bigint NOT NULL,
        position integer NOT NULL CHECK(position>=0), quantity integer NOT NULL CHECK(quantity>0),
        product_code_snapshot varchar(255) NOT NULL, product_barcode_snapshot varchar(255), product_name_snapshot varchar(255) NOT NULL,
        regular_unit_price bigint NOT NULL CHECK(regular_unit_price>=0), offer_price_snapshot bigint CHECK(offer_price_snapshot>=0),
        is_offer_enabled_snapshot boolean NOT NULL, price_source varchar(8) NOT NULL CHECK(price_source IN ('regular','offer')),
        unit_price bigint NOT NULL CHECK(unit_price>=0), cost_price_snapshot bigint CHECK(cost_price_snapshot>=0),
        cost_price_tax_snapshot bigint CHECK(cost_price_tax_snapshot>=0), line_total bigint NOT NULL CHECK(line_total>=0),
        product_version integer NOT NULL CHECK(product_version>0),
        created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
        FOREIGN KEY(business_id,sale_id) REFERENCES sales(business_id,id) ON DELETE RESTRICT,
        FOREIGN KEY(business_id,product_id) REFERENCES products(business_id,id) ON DELETE RESTRICT,
        UNIQUE(sale_id,product_id), UNIQUE(sale_id,position),
        CHECK(line_total::numeric=quantity::numeric*unit_price::numeric),
        CHECK((is_offer_enabled_snapshot AND price_source='offer' AND offer_price_snapshot IS NOT NULL AND unit_price=offer_price_snapshot)
          OR (NOT is_offer_enabled_snapshot AND price_source='regular' AND unit_price=regular_unit_price))
      );
      CREATE INDEX idx_sale_items_business_product ON sale_items(business_id,product_id,sale_id);
      CREATE TABLE sale_mutation_requests (
        id uuid PRIMARY KEY, business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
        actor_id bigint NOT NULL REFERENCES users(id), request_key uuid NOT NULL,
        operation varchar(16) NOT NULL CHECK(operation IN ('create','update','complete','cancel','discard')),
        request_hash varchar(64) NOT NULL CHECK(request_hash~'^[a-f0-9]{64}$'),
        sale_id uuid, result_version integer, result_status varchar(16), result jsonb,
        created_at timestamptz NOT NULL DEFAULT clock_timestamp(), completed_at timestamptz,
        FOREIGN KEY(business_id,sale_id) REFERENCES sales(business_id,id) ON DELETE RESTRICT,
        UNIQUE(business_id,actor_id,request_key), UNIQUE(business_id,id),
        CHECK((result IS NULL AND completed_at IS NULL) OR (jsonb_typeof(result)='object' AND completed_at IS NOT NULL))
      );
      CREATE TABLE sale_events (
        id uuid PRIMARY KEY, business_id uuid NOT NULL, sale_id uuid NOT NULL, sale_version integer NOT NULL CHECK(sale_version>0),
        event_type varchar(16) NOT NULL CHECK(event_type IN ('create','update','complete','cancel','discard')),
        actor_id bigint NOT NULL REFERENCES users(id), origin varchar(16) NOT NULL CHECK(origin IN ('http','nodia_ai')),
        mutation_request_id uuid NOT NULL, occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(), changes jsonb NOT NULL,
        FOREIGN KEY(business_id,sale_id) REFERENCES sales(business_id,id) ON DELETE RESTRICT,
        FOREIGN KEY(business_id,mutation_request_id) REFERENCES sale_mutation_requests(business_id,id) ON DELETE RESTRICT,
        UNIQUE(sale_id,sale_version)
      );
      CREATE INDEX idx_sale_events_business_sale ON sale_events(business_id,sale_id,sale_version);
      CREATE FUNCTION nodia_reject_sale_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'sale_events are append-only'; END;
      $$;
      CREATE TRIGGER sale_events_append_only BEFORE UPDATE OR DELETE ON sale_events
        FOR EACH ROW EXECUTE FUNCTION nodia_reject_sale_event_mutation();
    `);
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query(
      'LOCK TABLE sales,sale_items,sale_mutation_requests,sale_events IN ACCESS EXCLUSIVE MODE',
    );
    const [row]: { present: boolean }[] = await runner.query(`SELECT
      EXISTS(SELECT 1 FROM sales) OR EXISTS(SELECT 1 FROM sale_mutation_requests) OR EXISTS(SELECT 1 FROM sale_events) AS present`);
    if (row?.present !== false)
      throw Error('business:sale_rollback_would_lose_data');
    await runner.query(`DROP TABLE sale_events; DROP FUNCTION nodia_reject_sale_event_mutation();
      DROP TABLE sale_mutation_requests; DROP TABLE sale_items; DROP TABLE sales;
      ALTER TABLE businesses DROP COLUMN sales_timezone;`);
  }
}
