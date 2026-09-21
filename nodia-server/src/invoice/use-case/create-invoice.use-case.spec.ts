import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateInvoiceUseCase } from './create-invoice.use-case.js';
import type { InvoiceService } from '../invoice.service.js';
import type { StorageService } from '../../common/storage/storage.service.js';
import type { CreateInvoiceDto } from '../dto/create-invoice.dto.js';

describe('CreateInvoiceUseCase', () => {
  let useCase: CreateInvoiceUseCase;
  let invoiceServiceMock: Partial<InvoiceService>;
  let storageServiceMock: Partial<StorageService>;

  const mockFile: Express.Multer.File = {
    fieldname: 'file',
    originalname: 'factura_final.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: 2048,
    buffer: Buffer.from('%PDF-1.4 final'),
    stream: null as any,
    destination: '',
    filename: '',
    path: '',
  };

  beforeEach(() => {
    invoiceServiceMock = {
      createInvoice: vi.fn(),
    };
    storageServiceMock = {
      uploadFile: vi.fn().mockResolvedValue('invoices/b7b80a11-827c-4712-9c17-9150d0325d7b/final.pdf'),
    };
    useCase = new CreateInvoiceUseCase(
      invoiceServiceMock as InvoiceService,
      storageServiceMock as StorageService,
    );
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call invoiceService.createInvoice with dto when no file is passed', async () => {
    const dto: CreateInvoiceDto = {
      business_id: 'b7b80a11-827c-4712-9c17-9150d0325d7b',
      provider_id: '1',
      code: 'INV-2026-001',
      total_amount: 154000,
      path_storage: '/invoices/inv-001.pdf',
      data: { items: [{ name: 'Harina', price: 1000 }] },
    };

    const created = {
      id: '1',
      ...dto,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    };

    vi.mocked(invoiceServiceMock.createInvoice!).mockResolvedValue(created as any);

    const result = await useCase.execute(dto);

    expect(storageServiceMock.uploadFile).not.toHaveBeenCalled();
    expect(invoiceServiceMock.createInvoice).toHaveBeenCalledTimes(1);
    expect(invoiceServiceMock.createInvoice).toHaveBeenCalledWith(dto);
    expect(result).toEqual(created);
  });

  it('should upload file to storage and set path_storage when file is passed', async () => {
    const dto: CreateInvoiceDto = {
      business_id: 'b7b80a11-827c-4712-9c17-9150d0325d7b',
      provider_id: '1',
      code: 'INV-2026-002',
      total_amount: 200000,
      data: { items: [] },
    };

    const created = {
      id: '2',
      ...dto,
      path_storage: 'invoices/b7b80a11-827c-4712-9c17-9150d0325d7b/final.pdf',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    };

    vi.mocked(invoiceServiceMock.createInvoice!).mockResolvedValue(created as any);

    const result = await useCase.execute(dto, mockFile);

    expect(storageServiceMock.uploadFile).toHaveBeenCalledTimes(1);
    expect(storageServiceMock.uploadFile).toHaveBeenCalledWith(
      expect.stringContaining('invoices/b7b80a11-827c-4712-9c17-9150d0325d7b/'),
      mockFile.buffer,
      mockFile.mimetype,
    );
    expect(dto.path_storage).toBe('invoices/b7b80a11-827c-4712-9c17-9150d0325d7b/final.pdf');
    expect(invoiceServiceMock.createInvoice).toHaveBeenCalledWith(dto);
    expect(result).toEqual(created);
  });
});
