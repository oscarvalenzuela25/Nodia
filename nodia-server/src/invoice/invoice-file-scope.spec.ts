import { describe, expect, it } from 'vitest';
import { assertInvoiceFileScope } from './invoice-file-scope.js';

const business = '11111111-1111-4111-8111-111111111111';
describe('invoice file ownership', () => {
  it.each([
    undefined,
    '',
    `invoices/${business}/synthetic-file.pdf`,
    `invoices/${business}/synthetic.jpeg`,
  ])(
    'accepts an empty attachment or a key in the invoice business: %s',
    (key) => {
      expect(() => assertInvoiceFileScope(key, business)).not.toThrow();
    },
  );
  it.each([
    'invoices/22222222-2222-4222-8222-222222222222/synthetic.pdf',
    `invoices/${business}/../synthetic.pdf`,
    `invoices/${business}/synthetic.pdf?download=foreign`,
    'https://example.invalid/foreign.pdf',
    'invoices/historical.pdf',
  ])('rejects a forged or foreign object key: %s', (key) => {
    expect(() => assertInvoiceFileScope(key, business)).toThrow(
      'business:invoice_file_scope_invalid',
    );
  });
});
