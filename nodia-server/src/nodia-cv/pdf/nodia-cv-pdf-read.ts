import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { TextItem } from 'pdfjs-dist/types/src/display/api.js';
import {
  CV_PDF_LIMITS,
  CvPdfError,
  normalizeCvPdfText,
  type CvPdfDocument,
} from './nodia-cv-pdf-contract.js';
import {
  CV_A4_HEIGHT,
  CV_A4_WIDTH,
  type CvPdfLayout,
} from './nodia-cv-pdf-layout.js';

interface ReadLine {
  baseline: number;
  text: string;
}

interface ReadPage {
  width: number;
  height: number;
  rotation: number;
  firstX: number;
  lastX: number;
  links: string[];
  lines: ReadLine[];
}

function readPageLines(items: TextItem[], height: number, tolerance: number) {
  const lines: ReadLine[] = [];
  let firstX = Infinity;
  let lastX = -Infinity;
  for (const item of items) {
    if (!item.str.trim() && !lines.length) continue;
    const baseline = height - item.transform[5];
    const left = item.transform[4];
    if (item.str.trim()) {
      firstX = Math.min(firstX, left);
      lastX = Math.max(lastX, left + item.width);
    }
    const line = lines.at(-1);
    if (line && Math.abs(line.baseline - baseline) < tolerance) {
      line.text += item.str;
    } else if (item.str.trim()) {
      lines.push({ baseline, text: item.str });
    }
  }
  return { lines, firstX, lastX };
}

export async function verifyCvPdf(
  bytes: Buffer,
  document: CvPdfDocument,
  layout: CvPdfLayout,
): Promise<{ page_count: number; extracted_text: string }> {
  if (bytes.length > CV_PDF_LIMITS.bytes) throw new CvPdfError('pdf_limits');
  if (bytes.subarray(0, 5).toString('ascii') !== '%PDF-')
    throw new CvPdfError('pdf_read_failed');

  const task = getDocument({
    data: Uint8Array.from(bytes),
    useWorkerFetch: false,
    useSystemFonts: false,
    useWasm: false,
    disableFontFace: true,
    stopAtErrors: true,
    verbosity: 0,
  });
  const coordinateTolerance = 1;
  const readPages: ReadPage[] = [];
  let failure: CvPdfError | undefined;
  try {
    const pdf = await task.promise;
    if (pdf.numPages > CV_PDF_LIMITS.pages) throw new CvPdfError('pdf_limits');
    for (let index = 1; index <= pdf.numPages; index++) {
      const page = await pdf.getPage(index);
      try {
        const viewport = page.getViewport({ scale: 1 });
        const content = await page.getTextContent({
          disableNormalization: true,
        });
        const annotations = await page.getAnnotations();
        readPages.push({
          width: viewport.width,
          height: viewport.height,
          rotation: viewport.rotation,
          links: annotations
            .filter((item) => item.subtype === 'Link')
            .map((item) => item.url ?? ''),
          ...readPageLines(
            content.items.filter((item): item is TextItem => 'str' in item),
            viewport.height,
            coordinateTolerance,
          ),
        });
      } finally {
        page.cleanup();
      }
    }
  } catch (error) {
    failure =
      error instanceof CvPdfError ? error : new CvPdfError('pdf_read_failed');
  } finally {
    try {
      await task.destroy();
    } catch {
      failure ??= new CvPdfError('pdf_read_failed');
    }
  }
  if (failure) throw failure;

  if (!readPages.some(({ lines }) => lines.length))
    throw new CvPdfError('pdf_no_text');
  if (readPages.length !== layout.pages.length)
    throw new CvPdfError('pdf_layout_invalid');
  const fields = document.blocks.map(() => '');
  for (const [index, page] of readPages.entries()) {
    const planned = layout.pages[index];
    if (
      page.lines.length !== planned.length ||
      page.rotation !== 0 ||
      Math.abs(page.width - CV_A4_WIDTH) > coordinateTolerance ||
      Math.abs(page.height - CV_A4_HEIGHT) > coordinateTolerance ||
      page.firstX < layout.margin - coordinateTolerance ||
      page.lastX > page.width - layout.margin + coordinateTolerance
    )
      throw new CvPdfError('pdf_layout_invalid');

    const plannedLinks = planned.flatMap((line) =>
      line.url ? [line.url] : [],
    );
    if (
      page.links.length !== plannedLinks.length ||
      plannedLinks.some((url, linkIndex) => page.links[linkIndex] !== url)
    )
      throw new CvPdfError('pdf_layout_invalid');

    for (const [lineIndex, line] of page.lines.entries()) {
      const expected = planned[lineIndex];
      const text = normalizeCvPdfText(line.text);
      if (text !== expected.text) throw new CvPdfError('pdf_text_mismatch');
      if (
        !Number.isFinite(line.baseline) ||
        line.baseline < expected.top - coordinateTolerance ||
        line.baseline >
          expected.top + expected.style.height + coordinateTolerance
      )
        throw new CvPdfError('pdf_layout_invalid');
      fields[expected.block] += expected.separator + text;
    }
  }

  if (fields.some((text, index) => text !== document.blocks[index].text))
    throw new CvPdfError('pdf_text_mismatch');
  return { page_count: readPages.length, extracted_text: fields.join('\n') };
}
