export const CV_PDF_RENDERER = 'nodia-cv/pdfkit-0.21.0/pdfjs-6.4.299/2';

export const CV_PDF_LIMITS = {
  blocks: 128,
  textUnits: 24_000,
  pages: 4,
  bytes: 256 * 1024,
  phaseMs: 5_000,
} as const;

export const CV_PDF_TEMPLATES = [
  'classic',
  'compact',
  'editorial',
  'contemporary',
] as const;
export type CvPdfTemplate = (typeof CV_PDF_TEMPLATES)[number];

export function isCvPdfTemplate(value: unknown): value is CvPdfTemplate {
  return CV_PDF_TEMPLATES.some((template) => template === value);
}

export type CvPdfErrorCode =
  | 'pdf_busy'
  | 'pdf_timeout'
  | 'pdf_limits'
  | 'pdf_render_failed'
  | 'pdf_read_failed'
  | 'pdf_no_text'
  | 'pdf_text_mismatch'
  | 'pdf_layout_invalid';

export class CvPdfError extends Error {
  constructor(readonly code: CvPdfErrorCode) {
    super(code);
    this.name = 'CvPdfError';
  }
}

export type CvPdfLanguage = 'es' | 'en';
export type CvPdfBlockKind =
  'title' | 'subtitle' | 'contact' | 'section' | 'group' | 'body';

export interface CvPdfBlock {
  kind: CvPdfBlockKind;
  text: string;
  url?: string;
  keepWithNext?: boolean;
}

export interface CvPdfDocument {
  language: CvPdfLanguage;
  blocks: CvPdfBlock[];
  missing_contact: boolean;
}

export interface CvPdfDiagnostics {
  sha256: string;
  renderer: string;
  page_count: number;
  extracted_text: string;
  missing_contact: boolean;
}

export interface CvPdfResult extends CvPdfDiagnostics {
  bytes: Buffer;
}

export type CvPdfWorkerMessage =
  | { type: 'reading' }
  | { type: 'success'; result: CvPdfDiagnostics & { bytes: Uint8Array } }
  | { type: 'failure'; code: CvPdfErrorCode };

export interface CvPdfWorkerInput {
  document: CvPdfDocument;
  template: CvPdfTemplate;
}

export function normalizeCvPdfText(text: string): string {
  return text.normalize('NFC').replace(/\s+/gu, ' ').trim();
}
