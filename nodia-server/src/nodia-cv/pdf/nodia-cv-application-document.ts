import {
  cvApplicationDocumentTextLimit,
  type PrepareNodiaCvApplicationDocumentDto,
} from '../dto/nodia-cv-application-document.dto.js';
import { cvGenerationError } from '../policies/nodia-cv-generation-errors.js';
import type {
  CvPdfBlock,
  CvPdfDocument,
  CvPdfLanguage,
} from './nodia-cv-pdf-contract.js';

const labels = {
  es: {
    cover: 'Carta de presentación',
    recommendation: 'Carta de recomendación',
    watermark: 'Borrador sin firma. Para revisión de la persona referente.',
  },
  en: {
    cover: 'Cover letter',
    recommendation: 'Letter of recommendation',
    watermark: 'Unsigned draft for the referee to review.',
  },
} as const;

export function composeCvApplicationDocument(
  language: CvPdfLanguage,
  input: Pick<PrepareNodiaCvApplicationDocumentDto, 'kind' | 'text'>,
): CvPdfDocument {
  const lines = input.text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (
    input.text.length > cvApplicationDocumentTextLimit ||
    lines.length > 28 ||
    !/[\p{L}\p{N}]/u.test(input.text)
  )
    cvGenerationError('pdf_limits', 422);
  const copy = labels[language];
  const blocks: CvPdfBlock[] = [
    { kind: 'title', text: copy[input.kind], keepWithNext: true },
  ];
  if (input.kind === 'recommendation')
    blocks.push({ kind: 'subtitle', text: copy.watermark, keepWithNext: true });
  blocks.push(...lines.map((text): CvPdfBlock => ({ kind: 'body', text })));
  return { language, blocks, missing_contact: false };
}
