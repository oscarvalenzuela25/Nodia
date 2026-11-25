import { createHash } from 'node:crypto';
import { parentPort, workerData } from 'node:worker_threads';
import {
  CV_PDF_RENDERER,
  CvPdfError,
  type CvPdfWorkerInput,
  type CvPdfWorkerMessage,
} from './nodia-cv-pdf-contract.js';
import { renderCvPdfBytes } from './nodia-cv-pdf-layout.js';

const port = parentPort;
if (!port) throw new CvPdfError('pdf_render_failed');
const { document, template } = workerData as CvPdfWorkerInput;

function post(message: CvPdfWorkerMessage, transfer: ArrayBuffer[] = []) {
  port!.postMessage(message, transfer);
}

let reading = false;
try {
  const output = await renderCvPdfBytes(document, template);
  const sha256 = createHash('sha256').update(output.bytes).digest('hex');

  reading = true;
  post({ type: 'reading' });
  const { verifyCvPdf } = await import('./nodia-cv-pdf-read.js');
  const checked = await verifyCvPdf(output.bytes, document, output.layout);

  const bytes = Uint8Array.from(output.bytes);
  post(
    {
      type: 'success',
      result: {
        bytes,
        sha256,
        renderer: CV_PDF_RENDERER,
        ...checked,
        missing_contact: document.missing_contact,
      },
    },
    [bytes.buffer],
  );
} catch (error) {
  post({
    type: 'failure',
    code:
      error instanceof CvPdfError
        ? error.code
        : reading
          ? 'pdf_read_failed'
          : 'pdf_render_failed',
  });
} finally {
  port.close();
}
