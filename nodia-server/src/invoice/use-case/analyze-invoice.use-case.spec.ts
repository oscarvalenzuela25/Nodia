import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { AnalyzeInvoiceUseCase } from './analyze-invoice.use-case.js';
import type { GeminiService } from '../../common/ai/gemini.service.js';
import type { MistralService } from '../../common/ai/mistral.service.js';
import type { ProviderService } from '../../provider/provider.service.js';
import type { AnalyzeInvoiceDto } from '../dto/analyze-invoice.dto.js';

describe('AnalyzeInvoiceUseCase', () => {
  let useCase: AnalyzeInvoiceUseCase;
  let geminiServiceMock: Partial<GeminiService>;
  let mistralServiceMock: Partial<MistralService>;
  let providerServiceMock: Partial<ProviderService>;

  const mockFile: Express.Multer.File = {
    fieldname: 'file',
    originalname: 'factura_marzo.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: 1024,
    buffer: Buffer.from('%PDF-1.4 mock content'),
    stream: null as any,
    destination: '',
    filename: '',
    path: '',
  };

  const mockDto: AnalyzeInvoiceDto = {
    business_id: 'b7b80a11-827c-4712-9c17-9150d0325d7b',
  };

  beforeEach(() => {
    geminiServiceMock = {
      extractInvoiceData: vi.fn().mockResolvedValue({
        code: 'F-00129',
        total_amount: 54000,
        issue_date: '2026-03-15',
        items: [
          {
            code: 'PROD-1',
            name: 'Harina 1kg',
            quantity: 10,
            unit_price: 5400,
            total_price: 54000,
          },
        ],
        raw_data: { subtotal: 45378, tax: 8622 },
      }),
    };
    mistralServiceMock = {
      extractInvoiceData: vi.fn().mockResolvedValue({
        code: 'M-0089',
        total_amount: 32000,
        issue_date: '2026-03-16',
        items: [
          {
            code: 'PROD-M1',
            name: 'Azucar 1kg',
            quantity: 5,
            unit_price: 6400,
            total_price: 32000,
          },
        ],
        raw_data: { subtotal: 26890, tax: 5110 },
      }),
    };
    providerServiceMock = {
      findOne: vi.fn(),
    };

    useCase = new AnalyzeInvoiceUseCase(
      geminiServiceMock as GeminiService,
      mistralServiceMock as MistralService,
      providerServiceMock as ProviderService,
    );
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should throw BadRequestException if no file is provided', async () => {
    await expect(useCase.execute(undefined, mockDto)).rejects.toThrow(
      BadRequestException,
    );
    await expect(
      useCase.execute({ ...mockFile, buffer: undefined as any }, mockDto),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException if file MIME type is unsupported', async () => {
    const invalidFile = { ...mockFile, mimetype: 'text/plain' };
    await expect(useCase.execute(invalidFile, mockDto)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should throw BadRequestException if provider does not belong to the business', async () => {
    const dtoWithProvider: AnalyzeInvoiceDto = {
      ...mockDto,
      provider_id: '99',
    };

    vi.mocked(providerServiceMock.findOne!).mockResolvedValue({
      id: '99',
      business_id: 'other-business-uuid',
      name: 'Molinos S.A.',
      fields: {},
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
      business: {} as any,
    });

    await expect(useCase.execute(mockFile, dtoWithProvider)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should process invoice successfully without provider_id and without uploading to storage', async () => {
    const result = await useCase.execute(mockFile, mockDto);

    expect(geminiServiceMock.extractInvoiceData).toHaveBeenCalledWith(
      mockFile.buffer,
      mockFile.mimetype,
      undefined,
    );
    expect(result).toEqual({
      business_id: mockDto.business_id,
      provider_id: null,
      code: 'F-00129',
      total_amount: 54000,
      data: {
        issue_date: '2026-03-15',
        items: [
          {
            code: 'PROD-1',
            name: 'Harina 1kg',
            quantity: 10,
            unit_price: 5400,
            total_price: 54000,
          },
        ],
        subtotal: 45378,
        tax: 8622,
      },
    });
  });

  it('should process invoice successfully with provider_id and pass template fields to Gemini', async () => {
    const dtoWithProvider: AnalyzeInvoiceDto = {
      ...mockDto,
      provider_id: '1',
    };

    const providerMock = {
      id: '1',
      business_id: mockDto.business_id,
      name: 'Molinos S.A.',
      fields: { folio_key: 'NroFactura', rut_key: 'RUT' },
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
      business: {} as any,
    };

    vi.mocked(providerServiceMock.findOne!).mockResolvedValue(providerMock);

    const result = await useCase.execute(mockFile, dtoWithProvider);

    expect(providerServiceMock.findOne).toHaveBeenCalledWith('1');
    expect(geminiServiceMock.extractInvoiceData).toHaveBeenCalledWith(
      mockFile.buffer,
      mockFile.mimetype,
      providerMock.fields,
    );
    expect(result.provider_id).toBe('1');
    expect(result.code).toBe('F-00129');
  });

  it('should process invoice successfully using Mistral when ai_provider is mistral', async () => {
    const dtoWithMistral: AnalyzeInvoiceDto = {
      ...mockDto,
      ai_provider: 'mistral',
    };

    const result = await useCase.execute(mockFile, dtoWithMistral);

    expect(mistralServiceMock.extractInvoiceData).toHaveBeenCalledWith(
      mockFile.buffer,
      mockFile.mimetype,
      undefined,
    );
    expect(geminiServiceMock.extractInvoiceData).not.toHaveBeenCalled();
    expect(result.code).toBe('M-0089');
    expect(result.total_amount).toBe(32000);
    expect(result.data.items).toEqual([
      {
        code: 'PROD-M1',
        name: 'Azucar 1kg',
        quantity: 5,
        unit_price: 6400,
        total_price: 32000,
      },
    ]);
  });

  it('should process invoice successfully using Gemini when ai_provider is gemini', async () => {
    const dtoWithGemini: AnalyzeInvoiceDto = {
      ...mockDto,
      ai_provider: 'gemini',
    };

    const result = await useCase.execute(mockFile, dtoWithGemini);

    expect(geminiServiceMock.extractInvoiceData).toHaveBeenCalledWith(
      mockFile.buffer,
      mockFile.mimetype,
      undefined,
    );
    expect(mistralServiceMock.extractInvoiceData).not.toHaveBeenCalled();
    expect(result.code).toBe('F-00129');
  });
});
