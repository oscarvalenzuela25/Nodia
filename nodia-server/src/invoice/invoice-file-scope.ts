import { ConflictException } from '@nestjs/common';

/** A stored key can only reference a file in the invoice business namespace. */
export function assertInvoiceFileScope(
  key: string | undefined,
  businessId: string,
): void {
  if (key === undefined || key === '') return;
  const match =
    /^invoices\/([0-9a-f-]{36})\/[A-Za-z0-9_-]+\.(?:pdf|png|jpg|jpeg|webp)$/i.exec(
      key,
    );
  if (!match || match[1].toLowerCase() !== businessId.toLowerCase())
    throw new ConflictException('business:invoice_file_scope_invalid');
}
