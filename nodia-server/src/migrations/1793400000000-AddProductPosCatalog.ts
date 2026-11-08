import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Additive catalog expansion. Historical stock and logs are not reinterpreted. */
export class AddProductPosCatalog1793400000000 implements MigrationInterface {
  name = 'AddProductPosCatalog1793400000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`ALTER TABLE products
      ADD COLUMN barcode varchar(255), ADD COLUMN offer_price integer,
      ADD COLUMN is_offer_enabled boolean NOT NULL DEFAULT false,
      ADD COLUMN has_stock boolean, ADD COLUMN version integer NOT NULL DEFAULT 1,
      ADD CONSTRAINT uq_products_business_id_id UNIQUE(business_id,id),
      ADD CONSTRAINT ck_products_pos_version CHECK(version>0),
      ADD CONSTRAINT ck_products_barcode CHECK(barcode IS NULL OR
        (length(barcode)>0 AND barcode=btrim(barcode) AND barcode !~ '[[:cntrl:]]' AND barcode !~ '^[[:space:]]*$')),
      ADD CONSTRAINT ck_products_offer CHECK(offer_price IS NULL OR offer_price>=0),
      ADD CONSTRAINT ck_products_selected_offer CHECK(NOT is_offer_enabled OR offer_price IS NOT NULL)`);
    await runner.query(
      'CREATE UNIQUE INDEX uq_products_business_barcode ON products(business_id,barcode) WHERE barcode IS NOT NULL',
    );
    await runner.query(`ALTER TABLE product_logs
      ADD COLUMN barcode varchar(255), ADD COLUMN offer_price integer,
      ADD COLUMN is_offer_enabled boolean, ADD COLUMN has_stock boolean,
      ADD COLUMN product_version integer, ADD COLUMN event_type varchar(40) NOT NULL DEFAULT 'legacy',
      ADD COLUMN source varchar(40) NOT NULL DEFAULT 'legacy', ADD COLUMN actor_id bigint REFERENCES users(id) ON DELETE RESTRICT,
      ADD COLUMN changed_fields jsonb NOT NULL DEFAULT '[]', ADD COLUMN image_id uuid`);
    await runner.query(`CREATE TABLE product_images (
      id uuid PRIMARY KEY, business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
      product_id bigint, uploaded_by bigint NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      storage_key varchar(255) NOT NULL UNIQUE,
      status varchar(24) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','uploading','ready','pending_delete','deleted','failed')),
      is_current boolean NOT NULL DEFAULT false,
      mime_type varchar(80), byte_size integer, width integer, height integer, sha256 char(64), product_version integer,
      reserved_product_version integer NOT NULL CHECK(reserved_product_version>0),
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(), ready_at timestamptz,
      cleanup_after timestamptz NOT NULL DEFAULT clock_timestamp()+interval '10 minutes',
      retry_after timestamptz NOT NULL DEFAULT clock_timestamp()+interval '10 minutes',
      cleanup_attempts integer NOT NULL DEFAULT 0,
      FOREIGN KEY(business_id,product_id) REFERENCES products(business_id,id) ON DELETE RESTRICT,
      CHECK(NOT is_current OR (status='ready' AND product_id IS NOT NULL)),
      CHECK(byte_size IS NULL OR byte_size>0), CHECK(width IS NULL OR width>0), CHECK(height IS NULL OR height>0),
      CHECK(sha256 IS NULL OR sha256 ~ '^[a-f0-9]{64}$')
    )`);
    await runner.query(
      'CREATE UNIQUE INDEX uq_product_images_current ON product_images(product_id) WHERE is_current',
    );
    await runner.query(
      'CREATE INDEX idx_product_images_cleanup ON product_images(retry_after,id) WHERE NOT is_current',
    );
    await runner.query(
      'CREATE INDEX idx_product_logs_price_baseline ON product_logs(product_id,created_at DESC,id DESC)',
    );
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(
      'LOCK TABLE product_images,products,product_logs IN ACCESS EXCLUSIVE MODE',
    );
    const [row]: { present: boolean }[] =
      await runner.query(`SELECT EXISTS(SELECT 1 FROM product_images)
      OR EXISTS(SELECT 1 FROM products WHERE barcode IS NOT NULL OR offer_price IS NOT NULL OR is_offer_enabled OR has_stock IS NOT NULL OR version<>1)
      OR EXISTS(SELECT 1 FROM product_logs WHERE product_version IS NOT NULL) AS present`);
    if (row?.present !== false)
      throw Error('product:rollback_would_lose_pos_data');
    await runner.query('DROP TABLE product_images');
    await runner.query('DROP INDEX idx_product_logs_price_baseline');
    await runner.query(`ALTER TABLE product_logs DROP COLUMN barcode,DROP COLUMN offer_price,DROP COLUMN is_offer_enabled,
      DROP COLUMN has_stock,DROP COLUMN product_version,DROP COLUMN event_type,DROP COLUMN source,
      DROP COLUMN actor_id,DROP COLUMN changed_fields,DROP COLUMN image_id`);
    await runner.query('DROP INDEX uq_products_business_barcode');
    await runner.query(`ALTER TABLE products DROP CONSTRAINT uq_products_business_id_id,
      DROP CONSTRAINT ck_products_pos_version,DROP CONSTRAINT ck_products_barcode,DROP CONSTRAINT ck_products_offer,
      DROP CONSTRAINT ck_products_selected_offer,DROP COLUMN barcode,DROP COLUMN offer_price,
      DROP COLUMN is_offer_enabled,DROP COLUMN has_stock,DROP COLUMN version`);
  }
}
