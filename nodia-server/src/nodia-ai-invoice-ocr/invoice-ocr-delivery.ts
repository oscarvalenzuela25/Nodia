import type { NodiaAiJsonObject } from '../nodia-ai-conversation/types/nodia-ai-persistence.types.js';

export const INVOICE_OCR_FILE_BYTES = 10 * 1024 * 1024;
export const INVOICE_OCR_MEDIA_TYPES = Object.freeze([
  'image/png', 'image/jpeg', 'image/webp', 'application/pdf',
]);
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

/** An authorized OCR route is not evidence of general native image/PDF support. */
export function isInvoiceOcrReference(
  file: { kind: string; text: string | null; metadata: { media_type: string | null; byte_count: number | null } },
  manifest: Readonly<NodiaAiJsonObject>,
): boolean {
  const { media_type: mime, byte_count: bytes } = file.metadata;
  return manifest.invoice_ocr_capability === true && file.text === null &&
    typeof bytes === 'number' && Number.isSafeInteger(bytes) && bytes > 0 && bytes <= INVOICE_OCR_FILE_BYTES &&
    (file.kind === 'pdf' ? mime === 'application/pdf' :
      file.kind === 'image' && mime !== null && mime.startsWith('image/') && INVOICE_OCR_MEDIA_TYPES.includes(mime));
}

export function invoiceOcrReferenceIds(manifest: Readonly<NodiaAiJsonObject>): readonly string[] {
  if (manifest.invoice_ocr_reference_ids === undefined) return [];
  const ids = manifest.invoice_ocr_reference_ids;
  if (manifest.invoice_ocr_capability !== true || !Array.isArray(ids) || ids.length > 4 ||
      ids.some(id => typeof id !== 'string' || !uuid.test(id)) || new Set(ids).size !== ids.length)
    throw new Error('nodia_ai:invalid_persisted_state');
  return ids as string[];
}
