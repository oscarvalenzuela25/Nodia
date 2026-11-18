import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBusinessShoppingLists1793730000000 implements MigrationInterface {
  name = 'CreateBusinessShoppingLists1793730000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      CREATE TABLE business_shopping_lists (
        id uuid CONSTRAINT pk_business_shopping_lists PRIMARY KEY,
        business_id uuid NOT NULL,
        name varchar(150) NOT NULL,
        is_active boolean NOT NULL DEFAULT true,
        version integer NOT NULL DEFAULT 1,
        created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
        updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
        CONSTRAINT fk_business_shopping_lists_business
          FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE RESTRICT,
        CONSTRAINT uq_business_shopping_lists_id_business UNIQUE (id, business_id),
        CONSTRAINT ck_business_shopping_lists_name CHECK (name ~ '[^[:space:]]'),
        CONSTRAINT ck_business_shopping_lists_version CHECK (version > 0)
      )
    `);
    await runner.query(`
      CREATE INDEX idx_business_shopping_lists_name
        ON business_shopping_lists(business_id, name, id)
    `);
    await runner.query(`
      CREATE TABLE business_shopping_list_items (
        id uuid CONSTRAINT pk_business_shopping_list_items PRIMARY KEY,
        list_id uuid NOT NULL,
        business_id uuid NOT NULL,
        product_id bigint NOT NULL,
        product_name varchar(255) NOT NULL,
        quantity numeric(12,3) NOT NULL,
        position integer NOT NULL,
        checked boolean NOT NULL DEFAULT false,
        check_version integer NOT NULL DEFAULT 1,
        checked_at timestamptz,
        checked_by bigint,
        CONSTRAINT fk_business_shopping_list_items_list
          FOREIGN KEY (list_id, business_id)
          REFERENCES business_shopping_lists(id, business_id) ON DELETE RESTRICT,
        CONSTRAINT fk_business_shopping_list_items_checked_by
          FOREIGN KEY (checked_by) REFERENCES users(id),
        CONSTRAINT uq_business_shopping_list_items_product UNIQUE (list_id, product_id),
        CONSTRAINT uq_business_shopping_list_items_position UNIQUE (list_id, position)
          DEFERRABLE INITIALLY DEFERRED,
        CONSTRAINT ck_business_shopping_list_items_product CHECK (product_id > 0),
        CONSTRAINT ck_business_shopping_list_items_quantity
          CHECK (quantity BETWEEN 0.001 AND 999999999.999),
        CONSTRAINT ck_business_shopping_list_items_position CHECK (position BETWEEN 0 AND 499),
        CONSTRAINT ck_business_shopping_list_items_check_metadata CHECK (
          (check_version = 1 AND NOT checked AND checked_at IS NULL AND checked_by IS NULL)
          OR (check_version > 1 AND checked_at IS NOT NULL AND checked_by IS NOT NULL)
        )
      )
    `);
    await runner.query(`
      CREATE TABLE business_shopping_list_create_requests (
        business_id uuid NOT NULL,
        actor_id bigint NOT NULL,
        request_key uuid NOT NULL,
        list_id uuid NOT NULL,
        request_hash varchar(64) NOT NULL,
        result jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
        CONSTRAINT pk_business_shopping_list_create_requests
          PRIMARY KEY (business_id, actor_id, request_key),
        CONSTRAINT fk_business_shopping_list_create_requests_list
          FOREIGN KEY (list_id, business_id)
          REFERENCES business_shopping_lists(id, business_id) ON DELETE RESTRICT,
        CONSTRAINT fk_business_shopping_list_create_requests_actor
          FOREIGN KEY (actor_id) REFERENCES users(id),
        CONSTRAINT ck_business_shopping_list_create_requests_hash
          CHECK (request_hash ~ '^[0-9a-f]{64}$'),
        CONSTRAINT ck_business_shopping_list_create_requests_result
          CHECK (jsonb_typeof(result) = 'object')
      )
    `);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`
      LOCK TABLE business_shopping_lists, business_shopping_list_items,
        business_shopping_list_create_requests IN ACCESS EXCLUSIVE MODE
    `);
    const [row]: { present: boolean }[] = await runner.query(`
      SELECT EXISTS(SELECT 1 FROM business_shopping_lists)
        OR EXISTS(SELECT 1 FROM business_shopping_list_items)
        OR EXISTS(SELECT 1 FROM business_shopping_list_create_requests) AS present
    `);
    if (row?.present !== false)
      throw new Error('business:shopping_list_rollback_would_lose_data');

    await runner.query('DROP TABLE business_shopping_list_create_requests');
    await runner.query('DROP TABLE business_shopping_list_items');
    await runner.query('DROP TABLE business_shopping_lists');
  }
}
