import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds an opt-in preference and permits absent folios without rewriting existing invoices. */
export class ProviderOcrAndOptionalInvoiceCode1793680000000 implements MigrationInterface {
  name = 'ProviderOcrAndOptionalInvoiceCode1793680000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE providers ADD COLUMN use_ocr boolean NOT NULL DEFAULT false');
    await q.query('ALTER TABLE invoices ALTER COLUMN code DROP NOT NULL');
  }

  async down(): Promise<void> {
    // Dropping the preference and fabricating missing folios would lose user data.
    throw new Error('provider_ocr_optional_invoice_code_rollback_requires_backup_restore');
  }
}
