import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateInvoiceUseCase } from './update-invoice.use-case.js';
import type { InvoiceService } from '../invoice.service.js';
import type { UpdateInvoiceDto } from '../dto/update-invoice.dto.js';

describe('UpdateInvoiceUseCase', () => {
  let useCase: UpdateInvoiceUseCase;
  let invoiceServiceMock: Partial<InvoiceService>;

  beforeEach(() => {
    invoiceServiceMock = {
      updateInvoice: vi.fn(),
    };
    useCase = new UpdateInvoiceUseCase(invoiceServiceMock as InvoiceService);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call invoiceService.updateInvoice with id and dto, returning updated invoice', async () => {
    const id = '1';
    const dto: UpdateInvoiceDto = {
      path_storage: '/invoices/inv-001-updated.pdf',
      is_active: true,
    };

    const updated = {
      id,
      business_id: 'b7b80a11-827c-4712-9c17-9150d0325d7b',
      provider_id: '1',
      code: 'INV-2026-001',
      total_amount: 154000,
      path_storage: dto.path_storage,
      data: {},
      is_active: dto.is_active,
      created_at: new Date(),
      updated_at: new Date(),
    };

    vi.mocked(invoiceServiceMock.updateInvoice!).mockResolvedValue(updated as any);

    const result = await useCase.execute(id, dto);

    expect(invoiceServiceMock.updateInvoice).toHaveBeenCalledTimes(1);
    expect(invoiceServiceMock.updateInvoice).toHaveBeenCalledWith(id, dto);
    expect(result).toEqual(updated);
  });
});
