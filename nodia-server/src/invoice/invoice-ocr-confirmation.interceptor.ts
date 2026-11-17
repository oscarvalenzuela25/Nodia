import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
  type CallHandler,
  type ExecutionContext,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MAX_OCR_COMMAND_BYTES } from './dto/cash-invoice-command.js';
import { MAX_INVOICE_FILE_BYTES } from './invoice-file-validation.js';

const OcrFileParser = FileInterceptor('file', {
  limits: {
    fieldSize: MAX_OCR_COMMAND_BYTES + 1,
    fileSize: MAX_INVOICE_FILE_BYTES + 1,
    fieldNameSize: 32,
    files: 1,
    fields: 1,
    parts: 3,
  },
});

@Injectable()
export class InvoiceOcrConfirmationInterceptor {
  private readonly parser = new OcrFileParser();

  async intercept(context: ExecutionContext, next: CallHandler) {
    try {
      return await this.parser.intercept(context, next);
    } catch (error) {
      // Nest maps Multer's field-size error to 400 by default. The command
      // part has a byte budget and uses the same 413 contract as the file.
      if (
        error instanceof BadRequestException &&
        error.message.startsWith('Field value too long')
      )
        throw new PayloadTooLargeException('business:cash_invalid_command');
      throw error;
    }
  }
}
