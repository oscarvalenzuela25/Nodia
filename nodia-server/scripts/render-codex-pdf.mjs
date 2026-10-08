// Isolated, bounded PDF worker. stdout is a count, never invoice content.
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createCanvas, DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas';
Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
try {
  const directory = process.argv[2];
  const bytes = await readFile(join(directory, 'input.pdf'));
  if (bytes.length > 10 * 1024 * 1024) throw new Error('limit');
  const task = getDocument({
    data: new Uint8Array(bytes),
    isEvalSupported: false,
    useSystemFonts: false,
    disableFontFace: true,
    stopAtErrors: true,
  });
  const pdf = await task.promise;
  try {
    if (pdf.numPages < 1 || pdf.numPages > 8) throw new Error('pages');
    let total = 0;
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const base = page.getViewport({ scale: 1 });
      if (
        !Number.isFinite(base.width) ||
        !Number.isFinite(base.height) ||
        base.width <= 0 ||
        base.height <= 0
      )
        throw new Error('dimensions');
      const view = page.getViewport({
        scale: Math.min(2, 1600 / Math.max(base.width, base.height)),
      });
      const canvas = createCanvas(
        Math.ceil(view.width),
        Math.ceil(view.height),
      );
      await page.render({
        canvasContext: canvas.getContext('2d'),
        viewport: view,
      }).promise;
      const image = await canvas.encode('png');
      total += image.length;
      if (total > 24 * 1024 * 1024) throw new Error('bytes');
      await writeFile(join(directory, `page-${i}.png`), image, { mode: 0o600 });
      page.cleanup();
    }
    process.stdout.write(String(pdf.numPages));
  } finally {
    await task.destroy();
  }
} catch {
  process.exitCode = 1;
}
