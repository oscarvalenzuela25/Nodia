import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GetInvoiceViewUrlUseCase } from './get-invoice-view-url.use-case.js';
import type { InvoiceService } from '../invoice.service.js';
import type { StorageService } from '../../common/storage/storage.service.js';

describe('GetInvoiceViewUrlUseCase', () => {
  let useCase: GetInvoiceViewUrlUseCase;
  let invoiceServiceMock: Partial<InvoiceService>;
  let storageServiceMock: Partial<StorageService>;

  beforeEach(() => {
    invoiceServiceMock = {
      findOneInvoice: vi.fn(),
    };
    storageServiceMock = {
      getSignedFileUrl: vi.fn(),
    };
    useCase = new GetInvoiceViewUrlUseCase(
      invoiceServiceMock as InvoiceService,
      storageServiceMock as StorageService,
    );
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should return signed url and path_storage when invoice has file', async () => {
    const id = 'inv-123';
    const mockInvoice = {
      id,
      business_id: 'biz-001',
      code: 'INV-2026-001',
      path_storage: 'invoices/biz-001/17000000-receipt.pdf',
    };

    const mockSignedUrl =
      'https://account-id.r2.cloudflarestorage.com/invoices/biz-001/17000000-receipt.pdf?signature=abc';

    vi.mocked(invoiceServiceMock.findOneInvoice!).mockResolvedValue(
      mockInvoice as any,
    );
    vi.mocked(storageServiceMock.getSignedFileUrl!).mockResolvedValue(
      mockSignedUrl,
    );

    const result = await useCase.execute(id);

    expect(invoiceServiceMock.findOneInvoice).toHaveBeenCalledWith(id);
    expect(storageServiceMock.getSignedFileUrl).toHaveBeenCalledWith(
      'invoices/biz-001/17000000-receipt.pdf',
    );
    expect(result).toEqual({
      url: mockSignedUrl,
      path_storage: 'invoices/biz-001/17000000-receipt.pdf',
    });
  });

  it('should throw BadRequestException if invoice does not have path_storage', async () => {
    const id = 'inv-empty-path';
    const mockInvoice = {
      id,
      business_id: 'biz-001',
      code: 'INV-2026-002',
      path_storage: '',
    };

    vi.mocked(invoiceServiceMock.findOneInvoice!).mockResolvedValue(
      mockInvoice as any,
    );

    await expect(useCase.execute(id)).rejects.toThrow(BadRequestException);
    expect(storageServiceMock.getSignedFileUrl).not.toHaveBeenCalled();
  });

  it('should throw BadRequestException if invoice path_storage is whitespace only', async () => {
    const id = 'inv-whitespace-path';
    const mockInvoice = {
      id,
      business_id: 'biz-001',
      code: 'INV-2026-003',
      path_storage: '   ',
    };

    vi.mocked(invoiceServiceMock.findOneInvoice!).mockResolvedValue(
      mockInvoice as any,
    );

    await expect(useCase.execute(id)).rejects.toThrow(BadRequestException);
    expect(storageServiceMock.getSignedFileUrl).not.toHaveBeenCalled();
  });

  it('should propagate NotFoundException if invoice does not exist', async () => {
    const id = 'non-existent-id';
    vi.mocked(invoiceServiceMock.findOneInvoice!).mockRejectedValue(
      new NotFoundException(`Invoice with ID "${id}" not found`),
    );

    await expect(useCase.execute(id)).rejects.toThrow(NotFoundException);
    expect(storageServiceMock.getSignedFileUrl).not.toHaveBeenCalled();
  });
});
