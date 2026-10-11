import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInvoiceUploads1791630000000 implements MigrationInterface {
  name = 'CreateInvoiceUploads1791630000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE invoice_uploads (
      storage_key varchar(255) PRIMARY KEY,
      cleanup_after timestamptz NOT NULL,
      retry_after timestamptz NOT NULL,
      cleanup_started boolean NOT NULL DEFAULT false,
      cleanup_attempts integer NOT NULL DEFAULT 0 CHECK (cleanup_attempts >= 0)
    )`);
    await runner.query(
      'CREATE INDEX idx_invoice_uploads_retry_after ON invoice_uploads(retry_after)',
    );
    await runner.query(
      'CREATE INDEX idx_invoices_path_storage ON invoices(path_storage)',
    );
  }

  async down(runner: QueryRunner): Promise<void> {
    const [row]: { pending: boolean }[] = await runner.query(
      'SELECT EXISTS(SELECT 1 FROM invoice_uploads) AS pending',
    );
    if (row.pending)
      throw new Error(
        'Recover pending invoice uploads before removing their recovery journal.',
      );
    await runner.query('DROP TABLE invoice_uploads');
    await runner.query('DROP INDEX idx_invoices_path_storage');
  }
}
