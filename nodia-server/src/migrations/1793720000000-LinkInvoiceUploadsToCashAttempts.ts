import type { MigrationInterface, QueryRunner } from 'typeorm';

export class LinkInvoiceUploadsToCashAttempts1793720000000 implements MigrationInterface {
  name = 'LinkInvoiceUploadsToCashAttempts1793720000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      ALTER TABLE invoice_uploads
        ADD COLUMN cash_attempt_id uuid,
        ADD COLUMN uploaded_at timestamptz,
        ADD CONSTRAINT ck_invoice_uploads_cash_upload
          CHECK (uploaded_at IS NULL OR cash_attempt_id IS NOT NULL),
        ADD CONSTRAINT uq_invoice_uploads_cash_attempt UNIQUE (cash_attempt_id)
    `);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query('LOCK TABLE invoice_uploads IN ACCESS EXCLUSIVE MODE');
    const [row]: { pending: boolean }[] = await runner.query(`
      SELECT EXISTS (SELECT 1 FROM invoice_uploads WHERE cash_attempt_id IS NOT NULL) AS pending
    `);
    if (row?.pending !== false)
      throw new Error('business:cash_invoice_uploads_rollback_pending');
    await runner.query(`
      ALTER TABLE invoice_uploads
        DROP CONSTRAINT ck_invoice_uploads_cash_upload,
        DROP CONSTRAINT uq_invoice_uploads_cash_attempt,
        DROP COLUMN uploaded_at,
        DROP COLUMN cash_attempt_id
    `);
  }
}
