import type { MigrationInterface, QueryRunner } from 'typeorm';

export class LinkBusinessCashInvoiceExpenses1793710000000 implements MigrationInterface {
  name = 'LinkBusinessCashInvoiceExpenses1793710000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      ALTER TABLE invoices
        ADD COLUMN version integer NOT NULL DEFAULT 1,
        ADD CONSTRAINT ck_invoices_version CHECK (version > 0),
        ADD CONSTRAINT uq_invoices_id_business UNIQUE (id, business_id);

      CREATE FUNCTION nodia_increment_invoice_version() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF ROW(NEW.id, NEW.business_id, NEW.provider_id, NEW.code, NEW.total_amount,
               NEW.path_storage, NEW.data, NEW.is_active, NEW.created_at) IS DISTINCT FROM
           ROW(OLD.id, OLD.business_id, OLD.provider_id, OLD.code, OLD.total_amount,
               OLD.path_storage, OLD.data, OLD.is_active, OLD.created_at)
           OR NEW.version = OLD.version::bigint + 1 THEN
          NEW.version := OLD.version + 1;
        ELSE
          NEW.version := OLD.version;
        END IF;
        RETURN NEW;
      END;
      $$;
      CREATE TRIGGER trg_invoices_version BEFORE UPDATE ON invoices
        FOR EACH ROW EXECUTE FUNCTION nodia_increment_invoice_version();
    `);

    await runner.query(`
      ALTER TABLE business_cash_movements
        ADD COLUMN source varchar(7) NOT NULL DEFAULT 'manual',
        ADD COLUMN invoice_id bigint,
        ADD COLUMN withdrawn_from_invoice boolean NOT NULL DEFAULT false,
        ALTER COLUMN description DROP NOT NULL,
        DROP CONSTRAINT ck_business_cash_movements_description,
        ADD CONSTRAINT ck_business_cash_movements_source CHECK (
          (source = 'manual' AND invoice_id IS NULL AND NOT withdrawn_from_invoice
            AND description IS NOT NULL AND description ~ '[^[:space:]]')
          OR (source = 'invoice' AND type = 'expense' AND invoice_id IS NOT NULL
            AND description IS NULL)
        ),
        ADD CONSTRAINT uq_business_cash_movements_invoice UNIQUE (invoice_id),
        ADD CONSTRAINT fk_business_cash_movements_invoice FOREIGN KEY (invoice_id, business_id)
          REFERENCES invoices(id, business_id) ON DELETE RESTRICT;

      ALTER TABLE business_cash_movement_audit
        DROP CONSTRAINT ck_business_cash_movement_audit_operation,
        ADD CONSTRAINT ck_business_cash_movement_audit_operation CHECK (
          (operation IN ('movement_create', 'invoice_create') AND version = 1 AND "before" IS NULL)
          OR (operation IN ('movement_update', 'invoice_update', 'invoice_withdraw', 'invoice_restore')
            AND version > 1 AND "before" IS NOT NULL AND jsonb_typeof("before") = 'object')
        );
    `);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`
      LOCK TABLE business_cash_mutation_requests, invoices,
        business_cash_movements, business_cash_movement_audit IN ACCESS EXCLUSIVE MODE
    `);
    const [row]: { present: boolean }[] = await runner.query(`
      SELECT EXISTS(SELECT 1 FROM invoices WHERE version <> 1)
        OR EXISTS(SELECT 1 FROM business_cash_movements WHERE source = 'invoice')
        OR EXISTS(SELECT 1 FROM business_cash_movement_audit WHERE operation IN (
          'invoice_create', 'invoice_update', 'invoice_withdraw', 'invoice_restore'
        ))
        OR EXISTS(SELECT 1 FROM business_cash_mutation_requests WHERE operation IN (
          'invoice_create', 'invoice_update', 'invoice_ocr_confirm'
        )) AS present
    `);
    if (row?.present !== false)
      throw new Error('business:cash_invoice_link_rollback_would_lose_data');

    await runner.query(`
      ALTER TABLE business_cash_movement_audit
        DROP CONSTRAINT ck_business_cash_movement_audit_operation,
        ADD CONSTRAINT ck_business_cash_movement_audit_operation CHECK (
          (operation = 'movement_create' AND version = 1 AND "before" IS NULL)
          OR (operation = 'movement_update' AND version > 1
            AND "before" IS NOT NULL AND jsonb_typeof("before") = 'object')
        );

      ALTER TABLE business_cash_movements
        DROP CONSTRAINT fk_business_cash_movements_invoice,
        DROP CONSTRAINT uq_business_cash_movements_invoice,
        DROP CONSTRAINT ck_business_cash_movements_source,
        DROP COLUMN withdrawn_from_invoice,
        DROP COLUMN invoice_id,
        DROP COLUMN source,
        ALTER COLUMN description SET NOT NULL,
        ADD CONSTRAINT ck_business_cash_movements_description CHECK (description ~ '[^[:space:]]');

      DROP TRIGGER trg_invoices_version ON invoices;
      DROP FUNCTION nodia_increment_invoice_version();
      ALTER TABLE invoices
        DROP CONSTRAINT uq_invoices_id_business,
        DROP CONSTRAINT ck_invoices_version,
        DROP COLUMN version;
    `);
  }
}
