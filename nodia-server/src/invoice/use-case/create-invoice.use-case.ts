import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateInvoiceDto } from '../dto/create-invoice.dto.js';
import { InvoiceService } from '../invoice.service.js';
import { StorageService } from '../../common/storage/storage.service.js';
import { randomUUID } from 'node:crypto';
import { validateInvoiceFile } from '../invoice-file-validation.js';
import { RecoverInvoiceUploadsUseCase } from './recover-invoice-uploads.use-case.js';
import { Invoice } from '../entities/invoice.entity.js';

@Injectable()
export class CreateInvoiceUseCase {
  private readonly logger = new Logger(CreateInvoiceUseCase.name);

  constructor(
    private readonly invoiceService: InvoiceService,
    private readonly storageService: StorageService,
    private readonly dataSource: DataSource,
    private readonly recovery: RecoverInvoiceUploadsUseCase,
  ) {}

  async execute(dto: CreateInvoiceDto, file?: Express.Multer.File) {
    if (!file) {
      return this.invoiceService.createInvoice({
        ...dto,
        path_storage: dto.path_storage || '',
      });
    }

    const extension = validateInvoiceFile(file);
    const storageKey = `invoices/${dto.business_id}/${randomUUID()}.${extension}`;
    // Fail closed: without a durable intent, no object may be uploaded.
    await this.dataSource.query(
      `
      INSERT INTO invoice_uploads(storage_key, cleanup_after, retry_after)
      VALUES ($1, clock_timestamp() + INTERVAL '10 minutes', clock_timestamp() + INTERVAL '10 minutes')
    `,
      [storageKey],
    );

    try {
      await this.storageService.uploadFile(
        storageKey,
        file.buffer,
        file.mimetype,
      );
      // R2 I/O stays outside SQL transactions. Invoice and removal of the
      // recovery intent commit together, using exactly the same manager.
      return await this.dataSource.transaction(async (manager) => {
        await manager.query("SET LOCAL statement_timeout = '10s'");
        await manager.query("SET LOCAL lock_timeout = '5s'");
        const rows: { storage_key: string }[] = await manager.query(
          `
          SELECT storage_key FROM invoice_uploads WHERE storage_key = $1
            AND NOT cleanup_started AND cleanup_after > clock_timestamp() FOR UPDATE
        `,
          [storageKey],
        );
        if (!rows.length)
          throw new ConflictException(
            'Invoice upload expired. Please retry the save.',
          );
        const invoice = await this.invoiceService.createInvoice(
          { ...dto, path_storage: storageKey },
          manager,
        );
        await manager.query(
          'DELETE FROM invoice_uploads WHERE storage_key = $1',
          [storageKey],
        );
        return invoice;
      });
    } catch (error) {
      // Covers failed/uncertain PUT, INSERT and COMMIT. Recovery first checks
      // persisted ownership, so it cannot delete a successfully committed file.
      try {
        const committed = await this.dataSource
          .getRepository(Invoice)
          .findOneBy({ path_storage: storageKey });
        if (committed) return committed;
        await this.recovery.execute(storageKey);
      } catch {
        this.logger.error({
          event: 'invoice_upload_recovery_unavailable',
          storageKey,
        });
      }
      throw error;
    }
  }
}
