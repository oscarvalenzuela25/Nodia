import { describe, expect, it } from 'vitest';
import { INVOICE_OCR_FILE_BYTES, invoiceOcrReferenceIds, isInvoiceOcrReference } from './invoice-ocr-delivery.js';

const id = '76a1dd25-e0e8-468e-9c7d-bd0d83ddfb71';
const source = { kind: 'pdf', text: null, metadata: { media_type: 'application/pdf', byte_count: 100 } };
describe('authorized invoice OCR references', () => {
  it('permits a stored original for OCR without declaring native vision verified', () => {
    expect(isInvoiceOcrReference(source, { invoice_ocr_capability: true })).toBe(true);
    expect(isInvoiceOcrReference(source, {})).toBe(false);
    expect(isInvoiceOcrReference(source, { verified_attachment_media_types: ['application/pdf'] })).toBe(false);
  });
  it.each([0, null, INVOICE_OCR_FILE_BYTES + 1])('rejects unknown, empty or oversized originals: %s', bytes => {
    expect(isInvoiceOcrReference({ ...source, metadata: { ...source.metadata, byte_count: bytes } }, { invoice_ocr_capability: true })).toBe(false);
  });
  it('does not relabel reviewed text, audio or mismatched MIME as an invoice original', () => {
    expect(isInvoiceOcrReference({ ...source, text: 'reviewed' }, { invoice_ocr_capability: true })).toBe(false);
    expect(isInvoiceOcrReference({ ...source, kind: 'audio' }, { invoice_ocr_capability: true })).toBe(false);
    expect(isInvoiceOcrReference({ ...source, kind: 'image' }, { invoice_ocr_capability: true })).toBe(false);
  });
  it('keeps the original delivery of historical manifests and validates the new private references', () => {
    expect(invoiceOcrReferenceIds({})).toEqual([]);
    expect(invoiceOcrReferenceIds({ invoice_ocr_capability: true, invoice_ocr_reference_ids: [id] })).toEqual([id]);
    expect(() => invoiceOcrReferenceIds({ invoice_ocr_reference_ids: [id] })).toThrow();
    expect(() => invoiceOcrReferenceIds({ invoice_ocr_capability: true, invoice_ocr_reference_ids: [id, id] })).toThrow();
    expect(() => invoiceOcrReferenceIds({ invoice_ocr_capability: true, invoice_ocr_reference_ids: ['foreign'] })).toThrow();
  });
});
