import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBusinessCashCategories1793690000000 implements MigrationInterface {
  name = 'CreateBusinessCashCategories1793690000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      CREATE TABLE business_cash_categories (
        id bigserial CONSTRAINT pk_business_cash_categories PRIMARY KEY,
        business_id uuid NOT NULL,
        name varchar(120) NOT NULL,
        normalized_name text COLLATE "C" NOT NULL,
        description varchar(500) NOT NULL,
        is_active boolean NOT NULL DEFAULT true,
        version integer NOT NULL DEFAULT 1,
        created_by bigint NOT NULL,
        updated_by bigint NOT NULL,
        created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
        updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
        CONSTRAINT fk_business_cash_categories_business
          FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE RESTRICT,
        CONSTRAINT fk_business_cash_categories_created_by
          FOREIGN KEY (created_by) REFERENCES users(id),
        CONSTRAINT fk_business_cash_categories_updated_by
          FOREIGN KEY (updated_by) REFERENCES users(id),
        CONSTRAINT uq_business_cash_categories_business_normalized_name
          UNIQUE (business_id, normalized_name),
        CONSTRAINT uq_business_cash_categories_id_business UNIQUE (id, business_id),
        CONSTRAINT ck_business_cash_categories_name
          CHECK (char_length(btrim(name)) > 0),
        CONSTRAINT ck_business_cash_categories_normalized_name
          CHECK (octet_length(normalized_name) BETWEEN 1 AND 1024),
        CONSTRAINT ck_business_cash_categories_description
          CHECK (char_length(btrim(description)) > 0),
        CONSTRAINT ck_business_cash_categories_version CHECK (version > 0)
      );
      CREATE INDEX idx_business_cash_categories_activity_order
        ON business_cash_categories(business_id, is_active, normalized_name, id);
    `);

    await runner.query(`
      CREATE TABLE business_cash_mutation_requests (
        business_id uuid NOT NULL,
        actor_id bigint NOT NULL,
        request_key uuid NOT NULL,
        operation varchar(24) NOT NULL,
        contract_version smallint NOT NULL DEFAULT 1,
        request_hash varchar(64) NOT NULL,
        status varchar(16) NOT NULL,
        attempt_id uuid NOT NULL,
        lease_expires_at timestamptz NOT NULL,
        result jsonb,
        error jsonb,
        created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
        updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
        CONSTRAINT pk_business_cash_mutation_requests
          PRIMARY KEY (business_id, actor_id, request_key),
        CONSTRAINT fk_business_cash_mutation_requests_business
          FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE RESTRICT,
        CONSTRAINT fk_business_cash_mutation_requests_actor
          FOREIGN KEY (actor_id) REFERENCES users(id),
        CONSTRAINT ck_business_cash_mutation_requests_operation CHECK (
          operation IN ('category_create','category_update','movement_create','movement_update',
                        'invoice_create','invoice_update','invoice_ocr_confirm')
        ),
        CONSTRAINT ck_business_cash_mutation_requests_version CHECK (contract_version > 0),
        CONSTRAINT ck_business_cash_mutation_requests_hash CHECK (request_hash ~ '^[a-f0-9]{64}$'),
        CONSTRAINT ck_business_cash_mutation_requests_outcome CHECK (
          (status = 'committed' AND result IS NOT NULL AND jsonb_typeof(result) = 'object' AND error IS NULL)
          OR (status = 'rejected' AND error IS NOT NULL AND jsonb_typeof(error) = 'object' AND result IS NULL)
          OR (status IN ('processing','retryable') AND result IS NULL AND error IS NULL)
        )
      );
    `);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(
      'LOCK TABLE business_cash_mutation_requests, business_cash_categories IN ACCESS EXCLUSIVE MODE',
    );
    const [row]: { present: boolean }[] = await runner.query(`
      SELECT EXISTS(SELECT 1 FROM business_cash_mutation_requests)
        OR EXISTS(SELECT 1 FROM business_cash_categories) AS present
    `);
    if (row?.present !== false)
      throw new Error('business:cash_categories_rollback_would_lose_data');

    await runner.query('DROP TABLE business_cash_mutation_requests');
    await runner.query('DROP TABLE business_cash_categories');
  }
}
