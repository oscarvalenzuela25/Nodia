import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { AnalyzeInvoiceUseCase } from './analyze-invoice.use-case.js';
import { GeminiService } from '../../common/ai/gemini.service.js';
import { GeminiUpstreamException } from '../../common/ai/gemini-upstream.exception.js';
import type { MistralService } from '../../common/ai/mistral.service.js';
import type { ProviderService } from '../../provider/provider.service.js';
import type { AnalyzeInvoiceDto } from '../dto/analyze-invoice.dto.js';

vi.mock('../../config/envs.config.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../config/envs.config.js')>();
  return {
    ...actual,
    canUseGemini: () => true,
    canUseMistral: () => true,
  };
});

describe('AnalyzeInvoiceUseCase with the private Gemini adapter', () => {
  afterEach(() => vi.unstubAllGlobals());

  const file = {
    buffer: Buffer.from('%PDF-1.4'), size: 8, mimetype: 'application/pdf',
    originalname: 'invoice.pdf',
  } as Express.Multer.File;
  const dto: AnalyzeInvoiceDto = {
    business_id: 'b7b80a11-827c-4712-9c17-9150d0325d7b',
    ai_provider: 'gemini', model: 'discovered-model', engine: 'web',
  };
  const create = () => new AnalyzeInvoiceUseCase(
    new GeminiService(), {} as MistralService, {} as ProviderService,
  );

  it('preserves zero and missing values for review', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: null, total_amount: null, data: { items: [
        { name: 'Producto', quantity: 0, cost_price: 0, total_price: 0 },
        { name: 'Incompleto', quantity: null },
      ] },
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await create().execute(file, dto);
    expect(result.code).toBe('');
    expect(result.total_amount).toBeNull();
    expect(result.data.items[0].quantity).toBe(0);
    expect(result.data.items[0].cost_price).toBe(0);
    expect(result.data.items[1].quantity).toBeNull();
    expect(result.data.items[1].unit_price).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([429, 503, 504, 422, 502])('preserves HTTP %s without retrying or leaking the provider body', async (status) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"detail":"secret provider output"}', {
      status, headers: { 'Retry-After': '30', 'X-Request-ID': 'ab'.repeat(16) },
    }));
    vi.stubGlobal('fetch', fetchMock);
    try {
      await create().execute(file, dto);
      expect.fail('Expected upstream rejection');
    } catch (error) {
      expect(error).toBeInstanceOf(GeminiUpstreamException);
      const upstream = error as GeminiUpstreamException;
      expect(upstream.getStatus()).toBe(status);
      expect(upstream.retryAfterSeconds).toBe(30);
      expect(JSON.stringify(upstream.getResponse())).not.toContain('secret');
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([-1, '12', true])('rejects invalid quantity %s at the adapter boundary', async (quantity) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: { items: [{ name: 'Producto', quantity }] },
    }), { status: 200 })));
    await expect(create().execute(file, dto)).rejects.toThrow('valores numéricos inválidos');
  });
});

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

  it('rejects a declared PDF whose content is not a PDF', async () => {
    const spoofed = { ...mockFile, buffer: Buffer.from('not a PDF') };
    await expect(useCase.execute(spoofed, mockDto)).rejects.toThrow(BadRequestException);
    expect(geminiServiceMock.extractInvoiceData).not.toHaveBeenCalled();
  });

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
      tax: 19,
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
      19,
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

  it('should process invoice successfully with provider_id and pass template fields and tax to Gemini', async () => {
    const dtoWithProvider: AnalyzeInvoiceDto = {
      ...mockDto,
      provider_id: '1',
    };

    const providerMock = {
      id: '1',
      business_id: mockDto.business_id,
      name: 'Molinos S.A.',
      tax: 19,
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
      19,
    );
    expect(result.provider_id).toBe('1');
    expect(result.code).toBe('F-00129');
  });

  it('should process invoice with structured provider fields { value, instructions } and custom tax', async () => {
    const dtoWithProvider: AnalyzeInvoiceDto = {
      ...mockDto,
      provider_id: '2',
    };

    const providerMock = {
      id: '2',
      business_id: mockDto.business_id,
      name: 'Distribuidora Central',
      tax: 10,
      fields: {
        code: { value: 'CODIGO', instructions: 'Tomar la parte izquierda antes del guion' },
        cost_price: { value: 'PRECIO_NETO' },
        packages: { value: 'BULTOS' },
        units_per_package: { value: 'UNIDADES_X_CAJA' },
      },
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
      business: {} as any,
    };

    vi.mocked(providerServiceMock.findOne!).mockResolvedValue(providerMock);

    const result = await useCase.execute(mockFile, dtoWithProvider);

    expect(providerServiceMock.findOne).toHaveBeenCalledWith('2');
    expect(geminiServiceMock.extractInvoiceData).toHaveBeenCalledWith(
      mockFile.buffer,
      mockFile.mimetype,
      providerMock.fields,
      10,
    );
    expect(result.provider_id).toBe('2');
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
      19,
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
      19,
    );
    expect(mistralServiceMock.extractInvoiceData).not.toHaveBeenCalled();
    expect(result.code).toBe('F-00129');
  });

  it('should prefer ocr_model over default model when configured on provider', async () => {
    const aiProviderServiceMock = {
      findAllProviders: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'prov-ocr',
            key: 'mistral',
            is_active: true,
            fields: {
              selected_model: 'mistral-large-latest',
              ocr_model: 'mistral-ocr-2503',
            },
          },
        ],
      }),
    };

    const useCaseWithAi = new AnalyzeInvoiceUseCase(
      geminiServiceMock as GeminiService,
      mistralServiceMock as MistralService,
      providerServiceMock as ProviderService,
      aiProviderServiceMock as any,
    );

    await useCaseWithAi.execute(mockFile, {
      ...mockDto,
      ai_provider: 'mistral',
    });

    expect(mistralServiceMock.extractInvoiceData).toHaveBeenCalledWith(
      mockFile.buffer,
      mockFile.mimetype,
      undefined,
      19,
      'mistral-ocr-2503',
      'mistral-ocr-2503',
    );
  });

  it('should use explicit model from DTO if provided', async () => {
    const aiProviderServiceMock = {
      findAllProviders: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'prov-ocr',
            key: 'mistral',
            is_active: true,
            fields: {
              selected_model: 'mistral-large-latest',
              ocr_model: 'mistral-ocr-2503',
            },
          },
        ],
      }),
    };

    const useCaseWithAi = new AnalyzeInvoiceUseCase(
      geminiServiceMock as GeminiService,
      mistralServiceMock as MistralService,
      providerServiceMock as ProviderService,
      aiProviderServiceMock as any,
    );

    await useCaseWithAi.execute(mockFile, {
      ...mockDto,
      ai_provider: 'mistral',
      model: 'custom-model-x',
    });

    expect(mistralServiceMock.extractInvoiceData).toHaveBeenCalledWith(
      mockFile.buffer,
      mockFile.mimetype,
      undefined,
      19,
      'custom-model-x',
      'mistral-ocr-2503',
    );
  });

  it('should pass extended_thinking when requested and supported by model', async () => {
    const aiProviderServiceMock = {
      findAllProviders: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'prov-gemini',
            key: 'gemini',
            is_active: true,
            fields: {
              selected_model: 'gemini-3.8-flash-thinking',
              enable_extended_thinking: true,
              available_models: [
                { id: 'gemini-3.8-flash-thinking', capabilities: ['reasoning'] },
              ],
            },
          },
        ],
      }),
    };

    const useCaseWithAi = new AnalyzeInvoiceUseCase(
      geminiServiceMock as GeminiService,
      mistralServiceMock as MistralService,
      providerServiceMock as ProviderService,
      aiProviderServiceMock as any,
    );

    await useCaseWithAi.execute(mockFile, {
      ...mockDto,
      ai_provider: 'gemini',
      extended_thinking: true,
    });

    expect(geminiServiceMock.extractInvoiceData).toHaveBeenCalledWith(
      mockFile.buffer,
      mockFile.mimetype,
      undefined,
      19,
      'gemini-3.8-flash-thinking',
      true,
      undefined,
    );
  });

  it('should pass engine from DTO when provided', async () => {
    await useCase.execute(mockFile, {
      ...mockDto,
      ai_provider: 'gemini',
      engine: 'web',
    });

    expect(geminiServiceMock.extractInvoiceData).toHaveBeenCalledWith(
      mockFile.buffer,
      mockFile.mimetype,
      undefined,
      19,
      undefined,
      undefined,
      'web',
    );
  });

  it('should pass engine from configured provider fields', async () => {
    const aiProviderServiceMock = {
      findAllProviders: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'prov-gemini-agentic',
            key: 'gemini',
            is_active: true,
            fields: {
              engine: 'agentic',
              selected_model: 'gemini-3.8-flash',
            },
          },
        ],
      }),
    };

    const useCaseWithAi = new AnalyzeInvoiceUseCase(
      geminiServiceMock as GeminiService,
      mistralServiceMock as MistralService,
      providerServiceMock as ProviderService,
      aiProviderServiceMock as any,
    );

    await useCaseWithAi.execute(mockFile, {
      ...mockDto,
      ai_provider: 'gemini',
    });

    expect(geminiServiceMock.extractInvoiceData).toHaveBeenCalledWith(
      mockFile.buffer,
      mockFile.mimetype,
      undefined,
      19,
      'gemini-3.8-flash',
      undefined,
      'agentic',
    );
  });

  it('should map mode token_plan_agentic to agentic engine and resolve mode-specific model', async () => {
    const aiProviderServiceMock = {
      findAllProviders: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'prov-gemini-multi',
            key: 'gemini',
            is_active: true,
            use_token_plan_agentic: true,
            use_token_plan_web: true,
            default_mode: 'token_plan_web',
            fields: {
              token_plan_agentic: {
                selected_model: 'gemini-3.1-pro',
              },
              token_plan_web: {
                selected_model: 'gemini-flash',
              },
            },
          },
        ],
      }),
    };

    const useCaseWithAi = new AnalyzeInvoiceUseCase(
      geminiServiceMock as GeminiService,
      mistralServiceMock as MistralService,
      providerServiceMock as ProviderService,
      aiProviderServiceMock as any,
    );

    await useCaseWithAi.execute(mockFile, {
      ...mockDto,
      ai_provider: 'gemini',
      mode: 'token_plan_agentic',
    });

    expect(geminiServiceMock.extractInvoiceData).toHaveBeenCalledWith(
      mockFile.buffer,
      mockFile.mimetype,
      undefined,
      19,
      'gemini-3.1-pro',
      undefined,
      'agentic',
    );
  });

  it('should map mode token_plan_web to web engine', async () => {
    await useCase.execute(mockFile, {
      ...mockDto,
      ai_provider: 'gemini',
      mode: 'token_plan_web',
    });

    expect(geminiServiceMock.extractInvoiceData).toHaveBeenCalledWith(
      mockFile.buffer,
      mockFile.mimetype,
      undefined,
      19,
      undefined,
      undefined,
      'web',
    );
  });

  it('should pass thinking_level when provided in dto', async () => {
    await useCase.execute(mockFile, {
      ...mockDto,
      ai_provider: 'gemini',
      mode: 'token_plan_agentic',
      thinking_level: 'high',
    });

    expect(geminiServiceMock.extractInvoiceData).toHaveBeenCalledWith(
      mockFile.buffer,
      mockFile.mimetype,
      undefined,
      19,
      undefined,
      undefined,
      'agentic',
      'high',
    );
  });

  it('should resolve thinking_level from provider modeFields when configured', async () => {
    const aiProviderServiceMock = {
      findAllProviders: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'agentic-prov',
            key: 'gemini',
            is_active: true,
            use_token_plan_agentic: true,
            fields: {
              token_plan_agentic: {
                selected_model: 'gemini-3.1-pro',
                thinking_levels: {
                  'gemini-3.1-pro': 'low',
                },
              },
            },
          },
        ],
      }),
    };

    const useCaseWithProv = new AnalyzeInvoiceUseCase(
      geminiServiceMock as GeminiService,
      mistralServiceMock as MistralService,
      providerServiceMock as ProviderService,
      aiProviderServiceMock as any,
    );

    await useCaseWithProv.execute(mockFile, {
      ...mockDto,
      ai_provider: 'gemini',
      mode: 'token_plan_agentic',
      thinking_level: 'low',
    });

    expect(geminiServiceMock.extractInvoiceData).toHaveBeenCalledWith(
      mockFile.buffer,
      mockFile.mimetype,
      undefined,
      19,
      'gemini-3.1-pro',
      undefined,
      'agentic',
      'low',
    );
  });
});
