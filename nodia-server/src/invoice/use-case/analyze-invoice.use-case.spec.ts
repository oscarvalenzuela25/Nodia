import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { AnalyzeInvoiceUseCase } from './analyze-invoice.use-case.js';
import { GeminiService } from '../../common/ai/gemini.service.js';
import { GeminiUpstreamException } from '../../common/ai/gemini-upstream.exception.js';
import type { MistralService } from '../../common/ai/mistral.service.js';
import type { ProviderService } from '../../provider/provider.service.js';
import type { AnalyzeInvoiceDto } from '../dto/analyze-invoice.dto.js';
import type { AiProviderService } from '../../ai-provider/ai-provider.service.js';
import type { ExecuteApiInvoiceUseCase } from '../../ai-provider/use-case/execute-api-invoice.use-case.js';

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

  it.each([
    [504, 'analysis_timeout', 'tiempo máximo permitido'],
    [504, 'agentic_timeout', 'Antigravity CLI'],
    [504, 'provider_timeout', 'tiempo de espera'],
    [502, 'provider_response_error', 'respuesta válida'],
  ])('preserves safe upstream cause %s/%s without exposing the body', async (status, code, message) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"detail":"private document and cookie"}', {
      status, headers: { 'X-Nodia-Error-Code': code, 'X-Request-ID': 'ab'.repeat(16) },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const error = await create().execute(file, dto).catch((error: unknown) => error);
    expect(error).toBeInstanceOf(GeminiUpstreamException);
    const upstream = error as GeminiUpstreamException;
    expect(upstream.getStatus()).toBe(status);
    expect(upstream.getResponse()).toMatchObject({ upstreamErrorCode: code, upstreamRequestId: 'ab'.repeat(16) });
    expect(JSON.stringify(upstream.getResponse())).toContain(message);
    expect(JSON.stringify(upstream.getResponse())).not.toContain('private');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(['private provider output', '__proto__', 'constructor', 'provider_response_error'])('ignores untrusted or mismatched upstream cause %s', async (code) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"code":"secret"}', {
      status: 504, headers: { 'X-Nodia-Error-Code': code },
    })));
    const error = await create().execute(file, dto).catch((error: unknown) => error) as GeminiUpstreamException;
    expect(error.getStatus()).toBe(504);
    expect(error.getResponse()).not.toHaveProperty('upstreamErrorCode');
    expect(JSON.stringify(error.getResponse())).not.toContain('secret');
  });

  it('forwards exact agentic model and effort to the private explicit route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: 'SYNTHETIC', total_amount: 0, data: { items: [{ name: 'Synthetic product', quantity: 0 }] },
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await create().execute(file, { ...dto, engine: 'agentic', mode: 'token_plan_agentic', thinking_level: 'high' });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/agentic\/analyze-invoice$/);
    expect(options.body.get('engine')).toBe('agentic');
    expect(options.body.get('model')).toBe('discovered-model');
    expect(options.body.get('thinking_level')).toBe('high');
    expect(options.body.has('extended_thinking')).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    { mode: 'token_plan_agentic', engine: 'web' },
    { mode: 'token_plan_web', engine: 'agentic' },
    { engine: 'agentic', thinking_level: 'max' },
    { mode: 'unknown' }, { extended_thinking: 'invalid' },
    { mode: 'token_plan_agentic', extended_thinking: true },
  ])('rejects contradictory or malformed legacy options before transport (%j)', async (options) => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    await expect(create().execute(file, { ...dto, ...options } as AnalyzeInvoiceDto)).rejects.toBeInstanceOf(BadRequestException);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('AnalyzeInvoiceUseCase API routing', () => {
  const file = { buffer: Buffer.from('%PDF-1.4'), size: 8, mimetype: 'application/pdf' } as Express.Multer.File;
  const dto = { business_id: 'b7b80a11-827c-4712-9c17-9150d0325d7b', ai_provider_id: '42', mode: 'api_key' } as AnalyzeInvoiceDto;
  function setup() {
    const gemini = { extractInvoiceData: vi.fn() };
    const mistral = { extractInvoiceData: vi.fn() };
    const providers = { findProviderById: vi.fn().mockResolvedValue({ id: '42', catalog: { key: 'openai' }, default_mode: 'api_key', use_api_key: true }), findAllProviders: vi.fn().mockResolvedValue({ data: [] }) };
    const api = { execute: vi.fn().mockResolvedValue({ code: 'SYNTHETIC', total_amount: null, items: [] }) };
    const useCase = new AnalyzeInvoiceUseCase(gemini as unknown as GeminiService, mistral as unknown as MistralService, {} as ProviderService, providers as unknown as AiProviderService, api as unknown as ExecuteApiInvoiceUseCase);
    return { gemini, mistral, providers, api, useCase };
  }
  it('routes the exact OpenAI instance to API without calling a session adapter', async () => {
    const { api, gemini, mistral, useCase } = setup();
    expect((await useCase.execute(file, dto)).total_amount).toBeNull();
    expect(api.execute).toHaveBeenCalledWith('42', undefined, file, undefined, 19, undefined);
    expect(gemini.extractInvoiceData).not.toHaveBeenCalled();
    expect(mistral.extractInvoiceData).not.toHaveBeenCalled();
  });
  it('preserves an explicit instance failure instead of choosing another connection', async () => {
    const { providers, api, useCase } = setup();
    providers.findProviderById.mockRejectedValue(new BadRequestException('Instance unavailable'));
    await expect(useCase.execute(file, dto)).rejects.toThrow('Instance unavailable');
    expect(providers.findAllProviders).not.toHaveBeenCalled();
    expect(api.execute).not.toHaveBeenCalled();
  });
  it('passes the explicit API thinking level to the API use case without a session engine', async () => {
    const { api, gemini, useCase } = setup();
    await useCase.execute(file, { ...dto, thinking_level: 'low' });
    expect(api.execute).toHaveBeenCalledWith('42', undefined, file, undefined, 19, 'low');
    expect(gemini.extractInvoiceData).not.toHaveBeenCalled();
  });
  it('rejects OpenAI session modes and unknown provider selections before execution', async () => {
    const { api, gemini, useCase } = setup();
    await expect(useCase.execute(file, { ...dto, mode: 'token_plan_web' })).rejects.toThrow('únicamente el canal API');
    await expect(useCase.execute(file, { business_id: dto.business_id, ai_provider: 'missing' })).rejects.toThrow('conexión activa');
    expect(api.execute).not.toHaveBeenCalled();
    expect(gemini.extractInvoiceData).not.toHaveBeenCalled();
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

// Synthetic options fixtures; never an inference against Google.
describe('AnalyzeInvoiceUseCase saved thinking options', () => {
  const file = { buffer: Buffer.from('%PDF-1.4'), size: 8, mimetype: 'application/pdf' } as Express.Multer.File;
  const dto = { business_id: 'b7b80a11-827c-4712-9c17-9150d0325d7b', ai_provider_id: '42' } as AnalyzeInvoiceDto;
  const setup = (mode: 'token_plan_web' | 'token_plan_agentic', options: Record<string, unknown>) => {
    const gemini = { extractInvoiceData: vi.fn().mockResolvedValue({ code: null, total_amount: null, items: [] }) };
    const providers = { findProviderById: vi.fn().mockResolvedValue({ id: '42', catalog: { key: 'gemini' }, default_mode: mode, fields: { [mode]: { selected_model: 'opaque-live-id', ...options } } }) };
    const useCase = new AnalyzeInvoiceUseCase(gemini as unknown as GeminiService, {} as MistralService, {} as ProviderService, providers as unknown as AiProviderService);
    return { useCase, gemini };
  };
  it('forwards saved Web thinking and respects an explicit false override', async () => {
    const { useCase, gemini } = setup('token_plan_web', { enable_extended_thinking: true });
    await useCase.execute(file, dto);
    expect(gemini.extractInvoiceData).toHaveBeenLastCalledWith(file.buffer, file.mimetype, undefined, 19, 'opaque-live-id', true, 'web');
    await useCase.execute(file, { ...dto, extended_thinking: false });
    expect(gemini.extractInvoiceData).toHaveBeenLastCalledWith(file.buffer, file.mimetype, undefined, 19, 'opaque-live-id', false, 'web');
  });
  it('forwards configured Agentic level without a DTO override or a default model', async () => {
    const { useCase, gemini } = setup('token_plan_agentic', { thinking_levels: { 'opaque-live-id': 'high' } });
    await useCase.execute(file, dto);
    expect(gemini.extractInvoiceData).toHaveBeenCalledWith(file.buffer, file.mimetype, undefined, 19, 'opaque-live-id', undefined, 'agentic', 'high');
  });
  it('does not invent Medium when the Agentic preference is absent', async () => {
    const { useCase, gemini } = setup('token_plan_agentic', {});
    await useCase.execute(file, dto);
    expect(gemini.extractInvoiceData).toHaveBeenCalledWith(file.buffer, file.mimetype, undefined, 19, 'opaque-live-id', undefined, 'agentic');
  });
});
