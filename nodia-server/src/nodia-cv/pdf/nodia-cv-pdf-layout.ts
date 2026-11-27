import { readFileSync } from 'node:fs';
import { create as readFont, type Font } from 'fontkit';
import PDFDocument from 'pdfkit';
import {
  CV_PDF_LIMITS,
  CvPdfError,
  isCvPdfTemplate,
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
  font?: 'SerifBold' | 'Bold';
  centered?: true;
  marker?: 'rule' | 'bar';
};

interface TemplateLayout {
  margin: number;
  styles: Record<CvPdfBlockKind, Style>;
  topRule?: string;
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

const layouts: Record<CvPdfTemplate, TemplateLayout> = {
  classic,
  compact,
  editorial: {
    margin: 53,
    styles: {
      title: {
        size: 29,
        height: 38,
        color: '#3e372d',
        after: 2,
        font: 'SerifBold',
      },
      subtitle: {
        size: 12,
        height: 17,
        color: '#473d33',
        after: 4,
        bold: true,
      },
      contact: { size: 9.5, height: 14, color: '#564e43', after: 2 },
      section: {
        size: 13.5,
        height: 20,
        color: '#3e372d',
        before: 15,
        after: 3,
        font: 'SerifBold',
        marker: 'rule',
      },
      group: {
        size: 11,
        height: 16,
        color: '#342f29',
        before: 3,
        after: 1,
        bold: true,
      },
      body: { size: 10.5, height: 15, color: '#342f29', after: 3 },
    },
  },
  contemporary: {
    margin: 48,
    topRule: '#283f69',
    styles: {
      title: {
        size: 27,
        height: 34,
        color: '#283f69',
        after: 2,
        bold: true,
        centered: true,
      },
      subtitle: {
        size: 12,
        height: 17,
        color: '#26364d',
        after: 3,
        bold: true,
        centered: true,
      },
      contact: {
        size: 9.5,
        height: 14,
        color: '#42546a',
        after: 2,
        centered: true,
      },
      section: {
        size: 13.5,
        height: 20,
        color: '#283f69',
        before: 13,
        after: 3,
        bold: true,
        marker: 'bar',
      },
      group: {
        size: 11,
        height: 16,
        color: '#26364d',
        before: 3,
        after: 1,
        bold: true,
      },
      body: { size: 10.5, height: 15, color: '#26364d', after: 3 },
    },
  },
};

interface WrappedLine {
  text: string;
  separator: ' ' | '';
}

export interface CvPdfPageLine extends WrappedLine {
  block: number;
  left: number;
  top: number;
  style: Style;
  url?: string;
  marker?: Style['marker'];
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

function fontName(style: Style) {
  return style.font ?? (style.bold ? 'Bold' : 'Regular');
}

function selectFont(doc: PDFKit.PDFDocument, style: Style) {
  return doc.font(fontName(style)).fontSize(style.size);
}

function layoutPdf(
  doc: PDFKit.PDFDocument,
  blocks: CvPdfBlock[],
  styles: Style[],
  margin: number,
): CvPdfLayout {
  const maximumWidth = CV_A4_WIDTH - 2 * margin;
  const usableHeight = CV_A4_HEIGHT - 2 * margin;
  const prepared = blocks.map((block, index) => {
    const style = styles[index];
    selectFont(doc, style);
    const lines = wrapText(
      block.text,
      (value) => doc.widthOfString(value),
      maximumWidth,
      Math.floor(usableHeight / style.height),
    );
    return {
      height: (style.before ?? 0) + lines.length * style.height + style.after,
      lines: lines.map((line) => ({
        ...line,
        left: style.centered
          ? margin + (maximumWidth - doc.widthOfString(line.text)) / 2
          : margin,
      })),
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
      for (const [index, line] of lines.entries()) {
        page.push({
          ...line,
          block,
          top,
          style,
          url: blocks[block].url,
          marker: index === 0 ? style.marker : undefined,
        });
        top += style.height;
      }
      top += style.after;
    }
    start = end;
  }

  return { margin, pages };
}

function renderMarker(
  doc: PDFKit.PDFDocument,
  line: CvPdfPageLine,
  margin: number,
) {
  if (line.marker === 'rule') {
    doc
      .save()
      .strokeColor('#8e8272')
      .lineWidth(0.42)
      .moveTo(margin, line.top - 5)
      .lineTo(CV_A4_WIDTH - margin, line.top - 5)
      .stroke()
      .restore();
  } else if (line.marker === 'bar') {
    doc
      .save()
      .rect(margin - 7, line.top + 2, 2, 13)
      .fill(line.style.color)
      .restore();
  }
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
  if (!isCvPdfTemplate(template)) throw new CvPdfError('pdf_render_failed');
  const settings = layouts[template];
  const fonts = {
    Regular: fontAsset('DejaVuSans'),
    Bold: fontAsset('DejaVuSans-Bold'),
    ...(template === 'editorial'
      ? { SerifBold: fontAsset('DejaVuSerif-Bold') }
      : {}),
  };
  const styles = document.blocks.map((block) => {
    let style = settings.styles[block.kind];
    const points = [...new Set(block.text)].map((character) =>
      character.codePointAt(0)!,
    );
    const supports = (name: ReturnType<typeof fontName>) => {
      const asset = fonts[name];
      return (
        asset && points.every((point) => asset.font.hasGlyphForCodePoint(point))
      );
    };
    if (style.font === 'SerifBold' && !supports('SerifBold'))
      style = { ...style, font: 'Bold' };
    if (!supports(fontName(style))) throw new CvPdfError('pdf_text_mismatch');
    return style;
  });

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
    for (const [name, asset] of Object.entries(fonts))
      doc.registerFont(name, asset.bytes);
    const layout = layoutPdf(doc, document.blocks, styles, settings.margin);
    const output = readBytes(doc);
    try {
      for (const page of layout.pages) {
        doc.addPage();
        if (settings.topRule) {
          doc
            .save()
            .rect(
              layout.margin,
              layout.margin - 11,
              CV_A4_WIDTH - 2 * layout.margin,
              2.5,
            )
            .fill(settings.topRule)
            .restore();
        }
        for (const line of page) {
          renderMarker(doc, line, layout.margin);
          selectFont(doc, line.style).fillColor(
            line.url ? '#205b88' : line.style.color,
          );
          doc.text(line.text, line.left, line.top, {
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
