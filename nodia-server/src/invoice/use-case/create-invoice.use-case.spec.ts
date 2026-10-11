import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DataSource, EntityManager } from 'typeorm';
import { CreateInvoiceUseCase } from './create-invoice.use-case.js';
import type { RecoverInvoiceUploadsUseCase } from './recover-invoice-uploads.use-case.js';
import type { InvoiceService } from '../invoice.service.js';
import type { StorageService } from '../../common/storage/storage.service.js';
import type { CreateInvoiceDto } from '../dto/create-invoice.dto.js';
import type { Invoice } from '../entities/invoice.entity.js';

describe('CreateInvoiceUseCase', () => {
  const dto: CreateInvoiceDto = {
    business_id: 'b7b80a11-827c-4712-9c17-9150d0325d7b',
    provider_id: '1',
    code: 'INV-2026-001',
    total_amount: 154000,
    data: { items: [] },
  };
  const file = {
    fieldname: 'file',
    originalname: 'factura.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: 2048,
    buffer: Buffer.from('%PDF-1.4 final'),
  } as Express.Multer.File;
  const invoice = { id: '1', ...dto, path_storage: 'stored-key' } as Invoice;
  let useCase: CreateInvoiceUseCase;
  let operations: string[];
  let invoiceService: { createInvoice: ReturnType<typeof vi.fn> };
  let storage: { uploadFile: ReturnType<typeof vi.fn> };
  let recovery: { execute: ReturnType<typeof vi.fn> };
  let query: ReturnType<typeof vi.fn>;
  let managerQuery: ReturnType<typeof vi.fn>;
  let findOneBy: ReturnType<typeof vi.fn>;
  let transaction: ReturnType<typeof vi.fn>;
  let manager: EntityManager;

  beforeEach(() => {
    operations = [];
    query = vi.fn(async () => {
      operations.push('register');
    });
    managerQuery = vi.fn(async (sql: string) => {
      if (sql.includes('SELECT')) return [{ storage_key: 'stored-key' }];
      if (sql.includes('DELETE')) operations.push('remove-intent');
      return [];
    });
    manager = { query: managerQuery } as unknown as EntityManager;
    invoiceService = {
      createInvoice: vi.fn(async () => {
        operations.push('invoice');
        return invoice;
      }),
    };
    storage = {
      uploadFile: vi.fn(async () => {
        operations.push('upload');
        return 'stored-key';
      }),
    };
    recovery = {
      execute: vi.fn(async () => {
        operations.push('compensate');
      }),
    };
    findOneBy = vi.fn().mockResolvedValue(null);
    transaction = vi.fn(
      async (work: (manager: EntityManager) => Promise<Invoice>) => {
        operations.push('begin');
        const result = await work(manager);
        operations.push('commit');
        return result;
      },
    );
    const db = {
      query,
      transaction,
      getRepository: () => ({ findOneBy }),
    } as unknown as DataSource;
    useCase = new CreateInvoiceUseCase(
      invoiceService as unknown as InvoiceService,
      storage as unknown as StorageService,
      db,
      recovery as unknown as RecoverInvoiceUploadsUseCase,
    );
  });

  it('preserves creation without a file or R2 effects and normalizes an absent path', async () => {
    await expect(useCase.execute(dto)).resolves.toBe(invoice);
    expect(invoiceService.createInvoice).toHaveBeenCalledWith({
      ...dto,
      path_storage: '',
    });
    expect(query).not.toHaveBeenCalled();
    expect(storage.uploadFile).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it('preserves a historical storage path on creation without a new upload', async () => {
    const input = { ...dto, path_storage: 'invoices/historical.pdf' };
    await useCase.execute(input);
    expect(invoiceService.createInvoice).toHaveBeenCalledWith(input);
    expect(recovery.execute).not.toHaveBeenCalled();
  });

  it('rejects MIME spoofing before any durable or external effects', async () => {
    await expect(
      useCase.execute(dto, { ...file, mimetype: 'image/png' }),
    ).rejects.toThrow();
    expect(query).not.toHaveBeenCalled();
    expect(storage.uploadFile).not.toHaveBeenCalled();
    expect(invoiceService.createInvoice).not.toHaveBeenCalled();
  });

  it('does not upload when the durable recovery journal cannot be saved', async () => {
    query.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(useCase.execute(dto, file)).rejects.toThrow(
      'database unavailable',
    );
    expect(storage.uploadFile).not.toHaveBeenCalled();
    expect(invoiceService.createInvoice).not.toHaveBeenCalled();
  });

  it('uploads outside the transaction, then commits invoice and intent removal with one manager', async () => {
    const input = structuredClone(dto);
    const snapshot = structuredClone(input);
    await expect(useCase.execute(input, file)).resolves.toBe(invoice);
    expect(operations).toEqual([
      'register',
      'upload',
      'begin',
      'invoice',
      'remove-intent',
      'commit',
    ]);
    const key = storage.uploadFile.mock.calls[0][0];
    expect(key).toMatch(
      /^invoices\/b7b80a11-827c-4712-9c17-9150d0325d7b\/[a-f\d-]+\.pdf$/,
    );
    expect(invoiceService.createInvoice).toHaveBeenCalledWith(
      { ...dto, path_storage: key },
      manager,
    );
    expect(input).toEqual(snapshot);
    expect(recovery.execute).not.toHaveBeenCalled();
  });

  it('does not insert an invoice on a failed or uncertain R2 upload and schedules compensation', async () => {
    storage.uploadFile.mockRejectedValueOnce(new Error('PUT timed out'));
    await expect(useCase.execute(dto, file)).rejects.toThrow('PUT timed out');
    expect(invoiceService.createInvoice).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
    expect(recovery.execute).toHaveBeenCalledWith(
      storage.uploadFile.mock.calls[0][0],
    );
  });

  it('compensates a failed SQL write and preserves its original error', async () => {
    invoiceService.createInvoice.mockRejectedValueOnce(
      new Error('constraint violation'),
    );
    await expect(useCase.execute(dto, file)).rejects.toThrow(
      'constraint violation',
    );
    expect(operations).toEqual(['register', 'upload', 'begin', 'compensate']);
  });

  it('compensates when the final journal write fails, not just the invoice INSERT', async () => {
    managerQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('DELETE')) throw new Error('journal delete failed');
      return [{ storage_key: 'stored-key' }];
    });
    await expect(useCase.execute(dto, file)).rejects.toThrow(
      'journal delete failed',
    );
    expect(recovery.execute).toHaveBeenCalledOnce();
    expect(operations).not.toContain('commit');
  });

  it('cannot confirm an expired upload already claimed by cleanup', async () => {
    managerQuery.mockResolvedValue([]);
    await expect(useCase.execute(dto, file)).rejects.toThrow(
      'Invoice upload expired',
    );
    expect(invoiceService.createInvoice).not.toHaveBeenCalled();
    expect(recovery.execute).toHaveBeenCalledOnce();
  });

  it('recovers an acknowledged-late SQL commit without deleting its attached object', async () => {
    transaction.mockRejectedValueOnce(new Error('COMMIT response lost'));
    findOneBy.mockResolvedValueOnce(invoice);
    await expect(useCase.execute(dto, file)).resolves.toBe(invoice);
    expect(recovery.execute).not.toHaveBeenCalled();
  });

  it('preserves the original save error when recovery is temporarily unavailable', async () => {
    invoiceService.createInvoice.mockRejectedValueOnce(
      new Error('save failed'),
    );
    recovery.execute.mockRejectedValueOnce(new Error('cleanup unavailable'));
    await expect(useCase.execute(dto, file)).rejects.toThrow('save failed');
  });
});
