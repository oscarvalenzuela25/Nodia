import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBusinessCashMovements1793700000000 implements MigrationInterface {
  name = 'CreateBusinessCashMovements1793700000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      CREATE TABLE business_cash_movements (
        id uuid CONSTRAINT pk_business_cash_movements PRIMARY KEY,
        business_id uuid NOT NULL,
        category_id bigint NOT NULL,
        type varchar(7) NOT NULL,
        amount bigint NOT NULL,
        occurred_on date NOT NULL,
        description varchar(500) NOT NULL,
        is_active boolean NOT NULL DEFAULT true,
        version integer NOT NULL DEFAULT 1,
        created_by bigint NOT NULL,
        updated_by bigint NOT NULL,
        created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
        updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
        CONSTRAINT fk_business_cash_movements_business
          FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE RESTRICT,
        CONSTRAINT fk_business_cash_movements_category
          FOREIGN KEY (category_id, business_id)
          REFERENCES business_cash_categories(id, business_id) ON DELETE RESTRICT,
        CONSTRAINT fk_business_cash_movements_created_by
          FOREIGN KEY (created_by) REFERENCES users(id),
        CONSTRAINT fk_business_cash_movements_updated_by
          FOREIGN KEY (updated_by) REFERENCES users(id),
        CONSTRAINT uq_business_cash_movements_id_business UNIQUE (id, business_id),
        CONSTRAINT ck_business_cash_movements_type CHECK (type IN ('income', 'expense')),
        CONSTRAINT ck_business_cash_movements_amount CHECK (amount BETWEEN 1 AND 9999999999999),
        CONSTRAINT ck_business_cash_movements_occurred_on
          CHECK (occurred_on BETWEEN DATE '0001-01-01' AND DATE '9999-12-31'),
        CONSTRAINT ck_business_cash_movements_description CHECK (description ~ '[^[:space:]]'),
        CONSTRAINT ck_business_cash_movements_version CHECK (version > 0)
      );
      CREATE INDEX idx_business_cash_movements_activity_date
        ON business_cash_movements(business_id, is_active, occurred_on, id);
      CREATE INDEX idx_business_cash_movements_category_date
        ON business_cash_movements(business_id, category_id, occurred_on, id);
    `);

    await runner.query(`
      CREATE TABLE business_cash_movement_audit (
        movement_id uuid NOT NULL,
        version integer NOT NULL,
        business_id uuid NOT NULL,
        actor_id bigint NOT NULL,
        operation varchar(24) NOT NULL,
        "before" jsonb,
        "after" jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
        CONSTRAINT pk_business_cash_movement_audit PRIMARY KEY (movement_id, version),
        CONSTRAINT fk_business_cash_movement_audit_movement
          FOREIGN KEY (movement_id, business_id)
          REFERENCES business_cash_movements(id, business_id) ON DELETE RESTRICT,
        CONSTRAINT fk_business_cash_movement_audit_actor
          FOREIGN KEY (actor_id) REFERENCES users(id),
        CONSTRAINT ck_business_cash_movement_audit_operation CHECK (
          (operation = 'movement_create' AND version = 1 AND "before" IS NULL)
          OR (operation = 'movement_update' AND version > 1
              AND "before" IS NOT NULL AND jsonb_typeof("before") = 'object')
        ),
        CONSTRAINT ck_business_cash_movement_audit_after CHECK (jsonb_typeof("after") = 'object')
      );
    `);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(
      'LOCK TABLE business_cash_movements, business_cash_movement_audit IN ACCESS EXCLUSIVE MODE',
    );
    const [row]: { present: boolean }[] = await runner.query(`
      SELECT EXISTS(SELECT 1 FROM business_cash_movements)
        OR EXISTS(SELECT 1 FROM business_cash_movement_audit) AS present
    `);
    if (row?.present !== false)
      throw new Error('business:cash_movements_rollback_would_lose_data');

    await runner.query('DROP TABLE business_cash_movement_audit');
    await runner.query('DROP TABLE business_cash_movements');
  }
}
