import { HttpStatus, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Worker } from 'node:worker_threads';
import { cvGenerationError } from '../policies/nodia-cv-generation-errors.js';
import {
  CV_PDF_LIMITS,
  CvPdfError,
  isCvPdfTemplate,
  type CvPdfDocument,
  type CvPdfErrorCode,
  type CvPdfResult,
  type CvPdfTemplate,
  type CvPdfWorkerInput,
  type CvPdfWorkerMessage,
} from './nodia-cv-pdf-contract.js';
import {
  composeCvPdfDocument,
  snapshotCvPdfSource,
  type CvPdfSource,
} from './nodia-cv-pdf-source.js';

export {
  CV_PDF_RENDERER,
  type CvPdfTemplate,
} from './nodia-cv-pdf-contract.js';
export {
  snapshotCvPdfSource,
  type CvPdfSource,
} from './nodia-cv-pdf-source.js';

const status: Record<CvPdfErrorCode, HttpStatus> = {
  pdf_busy: HttpStatus.TOO_MANY_REQUESTS,
  pdf_timeout: HttpStatus.GATEWAY_TIMEOUT,
  pdf_limits: HttpStatus.UNPROCESSABLE_ENTITY,
  pdf_render_failed: HttpStatus.INTERNAL_SERVER_ERROR,
  pdf_read_failed: HttpStatus.UNPROCESSABLE_ENTITY,
  pdf_no_text: HttpStatus.UNPROCESSABLE_ENTITY,
  pdf_text_mismatch: HttpStatus.UNPROCESSABLE_ENTITY,
  pdf_layout_invalid: HttpStatus.UNPROCESSABLE_ENTITY,
};

export async function runCvPdfWorker(
  worker: Worker,
  phaseMs: number = CV_PDF_LIMITS.phaseMs,
): Promise<CvPdfResult> {
  try {
    return await new Promise((resolve, reject) => {
      let reading = false;
      const expire = () => reject(new CvPdfError('pdf_timeout'));
      let timer = setTimeout(expire, phaseMs);
      const stopped = () => {
        clearTimeout(timer);
        reject(
          new CvPdfError(reading ? 'pdf_read_failed' : 'pdf_render_failed'),
        );
      };
      worker.once('error', stopped);
      worker.once('exit', stopped);
      worker.on('message', (message: CvPdfWorkerMessage) => {
        if (message.type === 'reading') {
          if (!reading) {
            reading = true;
            clearTimeout(timer);
            timer = setTimeout(expire, phaseMs);
          }
          return;
        }

        clearTimeout(timer);
        if (message.type === 'failure') {
          reject(new CvPdfError(message.code));
          return;
        }
        resolve({
          ...message.result,
          bytes: Buffer.from(message.result.bytes),
        });
      });
    });
  } finally {
    await worker.terminate();
  }
}

@Injectable()
export class NodiaCvPdfRenderer implements OnModuleDestroy {
  private worker: Worker | null = null;
  private stopping = false;

  render(source: CvPdfSource, template: CvPdfTemplate): Promise<CvPdfResult> {
    return this.renderPrepared(
      () => composeCvPdfDocument(snapshotCvPdfSource(source)),
      template,
    );
  }

  renderDocument(
    document: CvPdfDocument,
    template: CvPdfTemplate,
  ): Promise<CvPdfResult> {
    return this.renderPrepared(() => document, template);
  }

  private async renderPrepared(
    document: () => CvPdfDocument,
    template: CvPdfTemplate,
  ): Promise<CvPdfResult> {
    if (this.worker || this.stopping)
      cvGenerationError('pdf_busy', status.pdf_busy);
    try {
      if (!isCvPdfTemplate(template)) throw new CvPdfError('pdf_render_failed');
      const workerData: CvPdfWorkerInput = {
        document: document(),
        template,
      };
      this.worker = new Worker(
        new URL('./nodia-cv-pdf.worker.js', import.meta.url),
        {
          workerData,
          env: {},
          execArgv: [],
          resourceLimits: {
            maxOldGenerationSizeMb: 96,
            maxYoungGenerationSizeMb: 16,
            stackSizeMb: 2,
          },
        },
      );
      return await runCvPdfWorker(this.worker);
    } catch (error) {
      const code =
        error instanceof CvPdfError ? error.code : 'pdf_render_failed';
      cvGenerationError(code, status[code]);
    } finally {
      this.worker = null;
    }
  }

  async onModuleDestroy() {
    this.stopping = true;
    await this.worker?.terminate();
  }
}
