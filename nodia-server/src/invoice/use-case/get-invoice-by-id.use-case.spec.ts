import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetInvoiceByIdUseCase } from './get-invoice-by-id.use-case.js';
import type { InvoiceService } from '../invoice.service.js';

describe('GetInvoiceByIdUseCase', () => {
  let useCase: GetInvoiceByIdUseCase;
  let invoiceServiceMock: Partial<InvoiceService>;

  beforeEach(() => {
    invoiceServiceMock = {
      findOneInvoice: vi.fn(),
    };
    useCase = new GetInvoiceByIdUseCase(invoiceServiceMock as InvoiceService);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call invoiceService.findOneInvoice with id and return invoice', async () => {
    const id = '1';
    const mockInvoice = {
      id,
      business_id: 'b7b80a11-827c-4712-9c17-9150d0325d7b',
      provider_id: '1',
      code: 'INV-2026-001',
      total_amount: 154000,
      path_storage: '/invoices/inv-001.pdf',
      data: {},
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    };

    vi.mocked(invoiceServiceMock.findOneInvoice!).mockResolvedValue(mockInvoice as any);

    const result = await useCase.execute(id);

    expect(invoiceServiceMock.findOneInvoice).toHaveBeenCalledTimes(1);
    expect(invoiceServiceMock.findOneInvoice).toHaveBeenCalledWith(id);
    expect(result).toEqual(mockInvoice);
  });
});
