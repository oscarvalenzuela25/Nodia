import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetAllInvoicesUseCase } from './get-all-invoices.use-case.js';
import type { InvoiceService } from '../invoice.service.js';
import type { GetInvoicesDto } from '../dto/get-invoices.dto.js';

describe('GetAllInvoicesUseCase', () => {
  let useCase: GetAllInvoicesUseCase;
  let invoiceServiceMock: Partial<InvoiceService>;

  beforeEach(() => {
    invoiceServiceMock = {
      findAllInvoices: vi.fn(),
    };
    useCase = new GetAllInvoicesUseCase(invoiceServiceMock as InvoiceService);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call invoiceService.findAllInvoices with queryParams and return result', async () => {
    const queryParams: GetInvoicesDto = {
      page: 1,
      limit: 10,
      all: false,
      includes: true,
    };

    const mockResponse = {
      data: [
        {
          id: '1',
          business_id: 'b7b80a11-827c-4712-9c17-9150d0325d7b',
          provider_id: '1',
          code: 'INV-2026-001',
          total_amount: 154000,
          path_storage: '/invoices/inv-001.pdf',
          data: {},
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
      meta: {
        page: 1,
        limit: 10,
        total_items: 1,
        total_pages: 1,
      },
    };

    vi.mocked(invoiceServiceMock.findAllInvoices!).mockResolvedValue(mockResponse as any);

    const result = await useCase.execute(queryParams);

    expect(invoiceServiceMock.findAllInvoices).toHaveBeenCalledTimes(1);
    expect(invoiceServiceMock.findAllInvoices).toHaveBeenCalledWith(queryParams);
    expect(result).toEqual(mockResponse);
  });
});
