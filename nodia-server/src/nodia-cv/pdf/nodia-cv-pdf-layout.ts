import { readFileSync } from 'node:fs';
import { create as readFont, type Font } from 'fontkit';
import PDFDocument from 'pdfkit';
import {
  CV_PDF_LIMITS,
  CvPdfError,
  type CvPdfBlock,
  type CvPdfBlockKind,
  type CvPdfDocument,
  type CvPdfTemplate,
} from './nodia-cv-pdf-contract.js';

export const CV_A4_WIDTH = 595.28;
export const CV_A4_HEIGHT = 841.89;

type Style = {
  size: number;
  height: number;
  color: string;
  after: number;
  bold?: true;
  before?: number;
};

interface TemplateLayout {
  margin: number;
  styles: Record<CvPdfBlockKind, Style>;
}

const classic: TemplateLayout = {
  margin: 48,
  styles: {
    title: { size: 24, height: 32, color: '#172438', after: 2, bold: true },
    subtitle: { size: 12, height: 17, color: '#36516f', after: 5 },
    contact: { size: 9.5, height: 14, color: '#42546a', after: 3 },
    section: {
      size: 14,
      height: 21,
      color: '#36516f',
      before: 10,
      after: 3,
      bold: true,
    },
    group: {
      size: 11,
      height: 16,
      color: '#172438',
      before: 4,
      after: 2,
      bold: true,
    },
    body: { size: 10.5, height: 15, color: '#223244', after: 3 },
  },
};

const compact: TemplateLayout = {
  margin: 40,
  styles: {
    title: { size: 21, height: 27, color: '#172438', after: 1, bold: true },
    subtitle: { size: 11, height: 15, color: '#36516f', after: 4 },
    contact: { size: 9.5, height: 13, color: '#42546a', after: 1 },
    section: {
      size: 12.5,
      height: 17,
      color: '#36516f',
      before: 8,
      after: 2,
      bold: true,
    },
    group: {
      size: 10.25,
      height: 14,
      color: '#172438',
      before: 3,
      after: 1,
      bold: true,
    },
    body: { size: 9.75, height: 13, color: '#223244', after: 2 },
  },
};

interface WrappedLine {
  text: string;
  separator: ' ' | '';
}

export interface CvPdfPageLine extends WrappedLine {
  block: number;
  top: number;
  style: Style;
  url?: string;
}

export interface CvPdfLayout {
  margin: number;
  pages: CvPdfPageLine[][];
}

const segmenter = new Intl.Segmenter();
function wrapText(
  text: string,
  measure: (text: string) => number,
  maximumWidth: number,
  maximumLines: number,
): WrappedLine[] {
  const lines: WrappedLine[] = [];
  let line = '';
  let separator: WrappedLine['separator'] = '';
  const commit = (nextSeparator: WrappedLine['separator']) => {
    if (lines.length >= maximumLines) throw new CvPdfError('pdf_limits');
    lines.push({ text: line, separator });
    line = '';
    separator = nextSeparator;
  };

  for (const word of text.split(' ')) {
    const joined = line ? `${line} ${word}` : word;
    if (measure(joined) <= maximumWidth) {
      line = joined;
      continue;
    }
    if (line) commit(' ');
    if (measure(word) <= maximumWidth) {
      line = word;
      continue;
    }
    for (const { segment } of segmenter.segment(word)) {
      if (measure(line + segment) > maximumWidth) {
        if (!line || measure(segment) > maximumWidth)
          throw new CvPdfError('pdf_limits');
        commit('');
      }
      line += segment;
    }
  }
  if (line) commit('');
  return lines;
}

function fontAsset(name: string): { bytes: Buffer; font: Font } {
  const bytes = readFileSync(new URL(`./assets/${name}.ttf`, import.meta.url));
  const font = readFont(bytes);
  if (!('hasGlyphForCodePoint' in font))
    throw new CvPdfError('pdf_render_failed');
  return { bytes, font };
}

function selectFont(doc: PDFKit.PDFDocument, style: Style) {
  return doc.font(style.bold ? 'Bold' : 'Regular').fontSize(style.size);
}

function layoutPdf(
  doc: PDFKit.PDFDocument,
  blocks: CvPdfBlock[],
  { styles, margin }: TemplateLayout,
): CvPdfLayout {
  const maximumWidth = CV_A4_WIDTH - 2 * margin;
  const usableHeight = CV_A4_HEIGHT - 2 * margin;
  const prepared = blocks.map((block) => {
    const style = styles[block.kind];
    selectFont(doc, style);
    const lines = wrapText(
      block.text,
      (value) => doc.widthOfString(value),
      maximumWidth,
      Math.floor(usableHeight / style.height),
    );
    return {
      height: (style.before ?? 0) + lines.length * style.height + style.after,
      lines,
      style,
    };
  });

  const pages: CvPdfPageLine[][] = [[]];
  let page = pages[0];
  let top = margin;
  for (let start = 0; start < prepared.length;) {
    let end = start + 1;
    while (end < prepared.length && blocks[end - 1].keepWithNext) end++;
    const group = prepared.slice(start, end);
    const minimumHeight = group.reduce(
      (total, block) => total + block.height,
      0,
    );
    if (minimumHeight > usableHeight) throw new CvPdfError('pdf_limits');
    if (top + minimumHeight > CV_A4_HEIGHT - margin) {
      if (pages.length >= CV_PDF_LIMITS.pages)
        throw new CvPdfError('pdf_limits');
      page = [];
      pages.push(page);
      top = margin;
    }
    for (const [offset, { lines, style }] of group.entries()) {
      const block = start + offset;
      top += style.before ?? 0;
      for (const line of lines) {
        page.push({ ...line, block, top, style, url: blocks[block].url });
        top += style.height;
      }
      top += style.after;
    }
    start = end;
  }

  return { margin, pages };
}

function readBytes(doc: PDFKit.PDFDocument): Promise<Buffer> {
  let bytes = 0;
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > CV_PDF_LIMITS.bytes) {
        doc.destroy(new CvPdfError('pdf_limits'));
        return;
      }
      chunks.push(chunk);
    });
    doc.once('error', reject);
    doc.once('end', () => resolve(Buffer.concat(chunks)));
  });
}

export async function renderCvPdfBytes(
  document: CvPdfDocument,
  template: CvPdfTemplate,
): Promise<{ bytes: Buffer; layout: CvPdfLayout }> {
  const settings = template === 'classic' ? classic : compact;
  const regular = fontAsset('DejaVuSans');
  const bold = fontAsset('DejaVuSans-Bold');
  for (const block of document.blocks) {
    const { font } = settings.styles[block.kind].bold ? bold : regular;
    for (const character of new Set(block.text)) {
      if (!font.hasGlyphForCodePoint(character.codePointAt(0)!))
        throw new CvPdfError('pdf_text_mismatch');
    }
  }

  const doc = new PDFDocument({
    size: 'A4',
    margin: settings.margin,
    autoFirstPage: false,
    lang: document.language,
    info: {
      Title: document.language === 'es' ? 'Currículum' : 'Résumé',
      Creator: 'Nodia CV',
    },
  });
  try {
    doc.registerFont('Regular', regular.bytes).registerFont('Bold', bold.bytes);
    const layout = layoutPdf(doc, document.blocks, settings);
    const output = readBytes(doc);
    try {
      for (const page of layout.pages) {
        doc.addPage();
        for (const line of page) {
          selectFont(doc, line.style).fillColor(
            line.url ? '#205b88' : line.style.color,
          );
          doc.text(line.text, layout.margin, line.top, {
            lineBreak: false,
            link: line.url,
          });
        }
      }
      doc.end();
    } catch {
      doc.destroy(new CvPdfError('pdf_render_failed'));
    }
    return { bytes: await output, layout };
  } finally {
    doc.destroy();
  }
}
