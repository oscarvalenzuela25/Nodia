import { BadRequestException } from '@nestjs/common';

/** No folio is different from inventing one; unrelated PATCHes omit this helper. */
export function normalizeInvoiceCode(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.trim().length > 255)
    throw new BadRequestException('business:invoice_code_invalid');
  return value.trim() || null;
}
