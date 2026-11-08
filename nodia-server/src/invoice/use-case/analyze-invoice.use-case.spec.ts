import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { AnalyzeInvoiceUseCase } from './analyze-invoice.use-case.js';
import { GeminiService } from '../../common/ai/gemini.service.js';
import { GeminiUpstreamException } from '../../common/ai/gemini-upstream.exception.js';
import type { MistralService } from '../../common/ai/mistral.service.js';
import type { ProviderService } from '../../provider/provider.service.js';
import type { AnalyzeInvoiceDto } from '../dto/analyze-invoice.dto.js';
import type { AiProviderService } from '../../ai-provider/ai-provider.service.js';
import type { ExecuteCodexInvoiceUseCase } from '../../ai-provider/use-case/execute-codex-invoice.use-case.js';
import type { ExecuteApiInvoiceUseCase } from '../../ai-provider/use-case/execute-api-invoice.use-case.js';
import type { InvoiceService } from '../invoice.service.js';

const actor = {
  userId: '12',
  sessionId: '11111111-1111-4111-8111-111111111112',
};
const invoiceAccess = { assertBusinessAccess: vi.fn(async () => undefined) };

vi.mock('../../config/envs.config.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../config/envs.config.js')>();
  return {
    ...actual,
    envs: {
      ...actual.envs,
      GEMINI_SERVICE_TOKEN: '1'.repeat(64),
      GEMINI_MICROSERVICE_URL: 'http://127.0.0.1:8000',
    },
    canUseGemini: () => true,
    canUseMistral: () => true,
  };
});

describe('AnalyzeInvoiceUseCase with the private Gemini adapter', () => {
  it('forwards caller cancellation to Gemini without a second inference', async () => {
    const cancellation = new AbortController();
    const fetchMock = vi.fn(
      (_url, options: RequestInit) =>
        new Promise((_resolve, reject) => {
          options.signal!.addEventListener(
            'abort',
            () => reject(new DOMException('Aborted', 'AbortError')),
            { once: true },
          );
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const pending = create().execute(
      file,
      dto,
      cancellation.signal,
      undefined,
      actor,
    );
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    cancellation.abort();
    await expect(pending).rejects.toMatchObject({ status: 504 });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
  it('observes safe private events even when inference completes before the first poll', async () => {
    const progress = {
      validateContext: vi.fn(),
      resolve: vi.fn(),
      emit: vi.fn(),
    };
    let privateId = '';
    const fetchMock = vi.fn(async (url: string, options: RequestInit) => {
      if (options.method === 'POST') {
        privateId = String(
          (options.headers as Record<string, string>)['X-Nodia-Analysis-Id'],
        );
        return new Response(
          JSON.stringify({
            code: null,
            total_amount: 0,
            data: { items: [{ name: 'Synthetic item', quantity: 0 }] },
          }),
        );
      }
      return new Response(
        JSON.stringify({
          version: 1,
          id: privateId,
          events: [
            { sequence: 1, stage: 'cli_initialized' },
            { sequence: 2, stage: 'document_read_completed' },
          ],
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      create().execute(file, dto, undefined, progress, actor),
    ).resolves.toMatchObject({ total_amount: 0 });
    expect(
      fetchMock.mock.calls.filter(([, options]) => options.method === 'POST'),
    ).toHaveLength(1);
    expect(progress.emit).toHaveBeenCalledWith('document_read_completed');
    expect(progress.emit).toHaveBeenCalledWith('extraction_validated');
  });
  afterEach(() => vi.unstubAllGlobals());

  const file = {
    buffer: Buffer.from('%PDF-1.4'),
    size: 8,
    mimetype: 'application/pdf',
    originalname: 'invoice.pdf',
  } as Express.Multer.File;
  const dto: AnalyzeInvoiceDto = {
    business_id: 'b7b80a11-827c-4712-9c17-9150d0325d7b',
    ai_provider: 'gemini',
    model: 'discovered-model',
    engine: 'agentic',
  };
  const create = () =>
    new AnalyzeInvoiceUseCase(
      new GeminiService(),
      {} as MistralService,
      {} as ProviderService,
      undefined,
      undefined,
      undefined,
      invoiceAccess as unknown as InvoiceService,
    );

  it('rejects a missing actor before reading providers or dispatching inference', async () => {
    const gemini = { extractInvoiceData: vi.fn() };
    const mistral = { extractInvoiceData: vi.fn() };
    const provider = { findOne: vi.fn() };
    const configured = { findProviderById: vi.fn(), findAllProviders: vi.fn() };
    const access = { assertBusinessAccess: vi.fn() };
    const useCase = new AnalyzeInvoiceUseCase(
      gemini as unknown as GeminiService,
      mistral as unknown as MistralService,
      provider as unknown as ProviderService,
      configured as unknown as AiProviderService,
      undefined,
      undefined,
      access as unknown as InvoiceService,
    );
    await expect(useCase.execute(file, dto)).rejects.toMatchObject({
      status: 401,
    });
    expect(access.assertBusinessAccess).not.toHaveBeenCalled();
    expect(provider.findOne).not.toHaveBeenCalled();
    expect(configured.findAllProviders).not.toHaveBeenCalled();
    expect(configured.findProviderById).not.toHaveBeenCalled();
    expect(gemini.extractInvoiceData).not.toHaveBeenCalled();
    expect(mistral.extractInvoiceData).not.toHaveBeenCalled();
  });

  it('preserves zero and missing values for review', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: null,
          total_amount: null,
          data: {
            items: [
              { name: 'Producto', quantity: 0, cost_price: 0, total_price: 0 },
              { name: 'Incompleto', quantity: null },
            ],
          },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const result = await create().execute(
      file,
      dto,
      undefined,
      undefined,
      actor,
    );
    expect(result.code).toBe('');
    expect(result.total_amount).toBeNull();
    expect(result.data.items[0].quantity).toBe(0);
    expect(result.data.items[0].cost_price).toBe(0);
    expect(result.data.items[1].quantity).toBeNull();
    expect(result.data.items[1].unit_price).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([429, 503, 504, 422, 502])(
    'preserves HTTP %s without retrying or leaking the provider body',
    async (status) => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response('{"detail":"secret provider output"}', {
          status,
          headers: { 'Retry-After': '30', 'X-Request-ID': 'ab'.repeat(16) },
        }),
      );
      vi.stubGlobal('fetch', fetchMock);
      try {
        await create().execute(file, dto, undefined, undefined, actor);
        expect.fail('Expected upstream rejection');
      } catch (error) {
        expect(error).toBeInstanceOf(GeminiUpstreamException);
        const upstream = error as GeminiUpstreamException;
        expect(upstream.getStatus()).toBe(status);
        expect(upstream.retryAfterSeconds).toBe(30);
        expect(JSON.stringify(upstream.getResponse())).not.toContain('secret');
      }
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it.each([-1, '12', true])(
    'rejects invalid quantity %s at the adapter boundary',
    async (quantity) => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              data: { items: [{ name: 'Producto', quantity }] },
            }),
            { status: 200 },
          ),
        ),
      );
      await expect(
        create().execute(file, dto, undefined, undefined, actor),
      ).rejects.toThrow('valores numéricos inválidos');
    },
  );

  it.each([
    [504, 'analysis_timeout', 'tiempo máximo permitido'],
    [504, 'agentic_timeout', 'Antigravity CLI'],
    [504, 'provider_timeout', 'tiempo de espera'],
    [502, 'provider_response_error', 'respuesta válida'],
  ])(
    'preserves safe upstream cause %s/%s without exposing the body',
    async (status, code, message) => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response('{"detail":"private document and cookie"}', {
          status,
          headers: {
            'X-Nodia-Error-Code': code,
            'X-Request-ID': 'ab'.repeat(16),
          },
        }),
      );
      vi.stubGlobal('fetch', fetchMock);
      const error = await create()
        .execute(file, dto, undefined, undefined, actor)
        .catch((error: unknown) => error);
      expect(error).toBeInstanceOf(GeminiUpstreamException);
      const upstream = error as GeminiUpstreamException;
      expect(upstream.getStatus()).toBe(status);
      expect(upstream.getResponse()).toMatchObject({
        upstreamErrorCode: code,
        upstreamRequestId: 'ab'.repeat(16),
      });
      expect(JSON.stringify(upstream.getResponse())).toContain(message);
      expect(JSON.stringify(upstream.getResponse())).not.toContain('private');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    'private provider output',
    '__proto__',
    'constructor',
    'provider_response_error',
  ])('ignores untrusted or mismatched upstream cause %s', async (code) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('{"code":"secret"}', {
          status: 504,
          headers: { 'X-Nodia-Error-Code': code },
        }),
      ),
    );
    const error = (await create()
      .execute(file, dto, undefined, undefined, actor)
      .catch((error: unknown) => error)) as GeminiUpstreamException;
    expect(error.getStatus()).toBe(504);
    expect(error.getResponse()).not.toHaveProperty('upstreamErrorCode');
    expect(JSON.stringify(error.getResponse())).not.toContain('secret');
  });

  it('forwards exact agentic model and effort to the private explicit route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'SYNTHETIC',
          total_amount: 0,
          data: { items: [{ name: 'Synthetic product', quantity: 0 }] },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    await create().execute(
      file,
      {
        ...dto,
        engine: 'agentic',
        mode: 'agentic',
        thinking_level: 'high',
      },
      undefined,
      undefined,
      actor,
    );
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/agentic\/analyze-invoice$/);
    expect(options.body.get('engine')).toBe('agentic');
    expect(options.body.get('model')).toBe('discovered-model');
    expect(options.body.get('thinking_level')).toBe('high');
    expect(options.body.has('extended_thinking')).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    { mode: 'agentic', engine: 'web' },
    { mode: 'token_plan_web', engine: 'agentic' },
    { engine: 'agentic', thinking_level: 'max' },
    { mode: 'unknown' },
    { extended_thinking: 'invalid' },
    { mode: 'agentic', extended_thinking: true },
  ])(
    'rejects contradictory or malformed legacy options before transport (%j)',
    async (options) => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      await expect(
        create().execute(
          file,
          { ...dto, ...options } as AnalyzeInvoiceDto,
          undefined,
          undefined,
          actor,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
});

describe('AnalyzeInvoiceUseCase API routing', () => {
  const file = {
    buffer: Buffer.from('%PDF-1.4'),
    size: 8,
    mimetype: 'application/pdf',
  } as Express.Multer.File;
  const dto = {
    business_id: 'b7b80a11-827c-4712-9c17-9150d0325d7b',
    ai_provider_id: '42',
    mode: 'api_key',
  } as AnalyzeInvoiceDto;
  function setup() {
    const gemini = { extractInvoiceData: vi.fn() };
    const mistral = { extractInvoiceData: vi.fn() };
    const providers = {
      findProviderById: vi.fn().mockResolvedValue({
        id: '42',
        catalog: { key: 'openai' },
        default_mode: 'api_key',
        use_api_key: true,
      }),
      findAllProviders: vi.fn().mockResolvedValue({ data: [] }),
    };
    const api = {
      execute: vi.fn().mockResolvedValue({
        code: 'SYNTHETIC',
        total_amount: null,
        items: [],
      }),
    };
    const useCase = new AnalyzeInvoiceUseCase(
      gemini as unknown as GeminiService,
      mistral as unknown as MistralService,
      {} as ProviderService,
      providers as unknown as AiProviderService,
      api as unknown as ExecuteApiInvoiceUseCase,
      undefined,
      invoiceAccess as unknown as InvoiceService,
    );
    return { gemini, mistral, providers, api, useCase };
  }
  it('routes the exact OpenAI instance to API without calling a session adapter', async () => {
    const { api, gemini, mistral, useCase } = setup();
    expect(
      (await useCase.execute(file, dto, undefined, undefined, actor))
        .total_amount,
    ).toBeNull();
    expect(api.execute).toHaveBeenCalledWith(
      '42',
      undefined,
      file,
      undefined,
      19,
      undefined,
    );
    expect(gemini.extractInvoiceData).not.toHaveBeenCalled();
    expect(mistral.extractInvoiceData).not.toHaveBeenCalled();
  });
  it('preserves an explicit instance failure instead of choosing another connection', async () => {
    const { providers, api, useCase } = setup();
    providers.findProviderById.mockRejectedValue(
      new BadRequestException('Instance unavailable'),
    );
    await expect(
      useCase.execute(file, dto, undefined, undefined, actor),
    ).rejects.toThrow('Instance unavailable');
    expect(providers.findAllProviders).not.toHaveBeenCalled();
    expect(api.execute).not.toHaveBeenCalled();
  });
  it('passes the explicit API thinking level to the API use case without a session engine', async () => {
    const { api, gemini, useCase } = setup();
    await useCase.execute(
      file,
      { ...dto, thinking_level: 'low' },
      undefined,
      undefined,
      actor,
    );
    expect(api.execute).toHaveBeenCalledWith(
      '42',
      undefined,
      file,
      undefined,
      19,
      'low',
    );
    expect(gemini.extractInvoiceData).not.toHaveBeenCalled();
  });
  it('rejects OpenAI session modes and unknown provider selections before execution', async () => {
    const { api, gemini, useCase } = setup();
    await expect(
      useCase.execute(
        file,
        { ...dto, mode: 'token_plan_web' },
        undefined,
        undefined,
        actor,
      ),
    ).rejects.toThrow('Opciones de análisis inválidas.');
    await expect(
      useCase.execute(
        file,
        { business_id: dto.business_id, ai_provider: 'missing' },
        undefined,
        undefined,
        actor,
      ),
    ).rejects.toThrow('conexión activa');
    expect(api.execute).not.toHaveBeenCalled();
    expect(gemini.extractInvoiceData).not.toHaveBeenCalled();
  });
  it('rejects historical OpenAI Web configuration without executing API or Gemini', async () => {
    const { api, gemini, providers, useCase } = setup();
    providers.findProviderById.mockResolvedValue({
      id: '42',
      catalog: { key: 'openai' },
      default_mode: 'token_plan_web',
      use_api_key: true,
    });
    await expect(
      useCase.execute(
        file,
        { ...dto, mode: 'token_plan_web' },
        undefined,
        undefined,
        actor,
      ),
    ).rejects.toThrow('Opciones de análisis inválidas.');
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
    await expect(
      useCase.execute(spoofed, mockDto, undefined, undefined, actor),
    ).rejects.toThrow(BadRequestException);
    expect(geminiServiceMock.extractInvoiceData).not.toHaveBeenCalled();
  });

  const mockDto: AnalyzeInvoiceDto = {
    mode: 'agentic',
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
      undefined,
      undefined,
      undefined,
      invoiceAccess as unknown as InvoiceService,
    );
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should throw BadRequestException if no file is provided', async () => {
    await expect(
      useCase.execute(undefined, mockDto, undefined, undefined, actor),
    ).rejects.toThrow(BadRequestException);
    await expect(
      useCase.execute(
        { ...mockFile, buffer: undefined as any },
        mockDto,
        undefined,
        undefined,
        actor,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException if file MIME type is unsupported', async () => {
    const invalidFile = { ...mockFile, mimetype: 'text/plain' };
    await expect(
      useCase.execute(invalidFile, mockDto, undefined, undefined, actor),
    ).rejects.toThrow(BadRequestException);
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

    await expect(
      useCase.execute(mockFile, dtoWithProvider, undefined, undefined, actor),
    ).rejects.toThrow(BadRequestException);
  });

  it('should process invoice successfully without provider_id and without uploading to storage', async () => {
    const result = await useCase.execute(
      mockFile,
      mockDto,
      undefined,
      undefined,
      actor,
    );

    expect(geminiServiceMock.extractInvoiceData).toHaveBeenCalledWith(
      mockFile.buffer,
      mockFile.mimetype,
      undefined,
      19,
      undefined,
      undefined,
      'agentic',
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

    const result = await useCase.execute(
      mockFile,
      dtoWithProvider,
      undefined,
      undefined,
      actor,
    );

    expect(providerServiceMock.findOne).toHaveBeenCalledWith('1', actor);
    expect(geminiServiceMock.extractInvoiceData).toHaveBeenCalledWith(
      mockFile.buffer,
      mockFile.mimetype,
      providerMock.fields,
      19,
      undefined,
      undefined,
      'agentic',
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
        code: {
          value: 'CODIGO',
          instructions: 'Tomar la parte izquierda antes del guion',
        },
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

    const result = await useCase.execute(
      mockFile,
      dtoWithProvider,
      undefined,
      undefined,
      actor,
    );

    expect(providerServiceMock.findOne).toHaveBeenCalledWith('2', actor);
    expect(geminiServiceMock.extractInvoiceData).toHaveBeenCalledWith(
      mockFile.buffer,
      mockFile.mimetype,
      providerMock.fields,
      10,
      undefined,
      undefined,
      'agentic',
    );
    expect(result.provider_id).toBe('2');
  });

  it('should process invoice successfully using Mistral when ai_provider is mistral', async () => {
    const dtoWithMistral: AnalyzeInvoiceDto = {
      ...mockDto,
      ai_provider: 'mistral',
    };

    const result = await useCase.execute(
      mockFile,
      dtoWithMistral,
      undefined,
      undefined,
      actor,
    );

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

    const result = await useCase.execute(
      mockFile,
      dtoWithGemini,
      undefined,
      undefined,
      actor,
    );

    expect(geminiServiceMock.extractInvoiceData).toHaveBeenCalledWith(
      mockFile.buffer,
      mockFile.mimetype,
      undefined,
      19,
      undefined,
      undefined,
      'agentic',
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
      undefined,
      undefined,
      invoiceAccess as unknown as InvoiceService,
    );

    await useCaseWithAi.execute(
      mockFile,
      {
        ...mockDto,
        ai_provider: 'mistral',
      },
      undefined,
      undefined,
      actor,
    );

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
      undefined,
      undefined,
      invoiceAccess as unknown as InvoiceService,
    );

    await useCaseWithAi.execute(
      mockFile,
      {
        ...mockDto,
        ai_provider: 'mistral',
        model: 'custom-model-x',
      },
      undefined,
      undefined,
      actor,
    );

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
              enable_thinking_level: 'high',
              available_models: [
                {
                  id: 'gemini-3.8-flash-thinking',
                  capabilities: ['reasoning'],
                },
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
      undefined,
      undefined,
      invoiceAccess as unknown as InvoiceService,
    );

    await useCaseWithAi.execute(
      mockFile,
      {
        ...mockDto,
        ai_provider: 'gemini',
        thinking_level: 'high',
      },
      undefined,
      undefined,
      actor,
    );

    expect(geminiServiceMock.extractInvoiceData).toHaveBeenCalledWith(
      mockFile.buffer,
      mockFile.mimetype,
      undefined,
      19,
      'gemini-3.8-flash-thinking',
      undefined,
      'agentic',
      'high',
    );
  });

  it('should pass engine from DTO when provided', async () => {
    await useCase.execute(
      mockFile,
      {
        ...mockDto,
        ai_provider: 'gemini',
        engine: 'agentic',
      },
      undefined,
      undefined,
      actor,
    );

    expect(geminiServiceMock.extractInvoiceData).toHaveBeenCalledWith(
      mockFile.buffer,
      mockFile.mimetype,
      undefined,
      19,
      undefined,
      undefined,
      'agentic',
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
      undefined,
      undefined,
      invoiceAccess as unknown as InvoiceService,
    );

    await useCaseWithAi.execute(
      mockFile,
      {
        ...mockDto,
        ai_provider: 'gemini',
      },
      undefined,
      undefined,
      actor,
    );

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

  it('should map mode agentic to agentic engine and resolve mode-specific model', async () => {
    const aiProviderServiceMock = {
      findAllProviders: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'prov-gemini-multi',
            key: 'gemini',
            is_active: true,
            use_agentic: true,
            use_api_key: true,
            default_mode: 'api_key',
            fields: {
              agentic: {
                selected_model: 'gemini-3.1-pro',
              },
              api_key: {
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
      undefined,
      undefined,
      invoiceAccess as unknown as InvoiceService,
    );

    await useCaseWithAi.execute(
      mockFile,
      {
        ...mockDto,
        ai_provider: 'gemini',
        mode: 'agentic',
      },
      undefined,
      undefined,
      actor,
    );

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

  it('rejects retired Web mode without invoking an inference', async () => {
    await expect(
      useCase.execute(
        mockFile,
        { ...mockDto, mode: 'token_plan_web' } as never,
        undefined,
        undefined,
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(geminiServiceMock.extractInvoiceData).not.toHaveBeenCalled();
    expect(mistralServiceMock.extractInvoiceData).not.toHaveBeenCalled();
  });

  it('should pass thinking_level when provided in dto', async () => {
    await useCase.execute(
      mockFile,
      {
        ...mockDto,
        ai_provider: 'gemini',
        mode: 'agentic',
        thinking_level: 'high',
      },
      undefined,
      undefined,
      actor,
    );

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
            use_agentic: true,
            fields: {
              agentic: {
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
      undefined,
      undefined,
      invoiceAccess as unknown as InvoiceService,
    );

    await useCaseWithProv.execute(
      mockFile,
      {
        ...mockDto,
        ai_provider: 'gemini',
        mode: 'agentic',
        thinking_level: 'low',
      },
      undefined,
      undefined,
      actor,
    );

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
  const file = {
    buffer: Buffer.from('%PDF-1.4'),
    size: 8,
    mimetype: 'application/pdf',
  } as Express.Multer.File;
  const dto = {
    business_id: 'b7b80a11-827c-4712-9c17-9150d0325d7b',
    ai_provider_id: '42',
  } as AnalyzeInvoiceDto;
  const setup = (mode: 'agentic', options: Record<string, unknown>) => {
    const gemini = {
      extractInvoiceData: vi
        .fn()
        .mockResolvedValue({ code: null, total_amount: null, items: [] }),
    };
    const providers = {
      findProviderById: vi.fn().mockResolvedValue({
        id: '42',
        catalog: { key: 'gemini' },
        default_mode: mode,
        fields: { [mode]: { selected_model: 'opaque-live-id', ...options } },
      }),
    };
    const useCase = new AnalyzeInvoiceUseCase(
      gemini as unknown as GeminiService,
      {} as MistralService,
      {} as ProviderService,
      providers as unknown as AiProviderService,
      undefined,
      undefined,
      invoiceAccess as unknown as InvoiceService,
    );
    return { useCase, gemini };
  };
  it('rejects the retired extended-thinking boolean instead of inferring with Agentic', async () => {
    const { useCase, gemini } = setup('agentic', {
      enable_extended_thinking: true,
    });
    await expect(
      useCase.execute(
        file,
        { ...dto, extended_thinking: true },
        undefined,
        undefined,
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(gemini.extractInvoiceData).not.toHaveBeenCalled();
  });
  it('forwards configured Agentic level without a DTO override or a default model', async () => {
    const { useCase, gemini } = setup('agentic', {
      thinking_levels: { 'opaque-live-id': 'high' },
    });
    await useCase.execute(file, dto, undefined, undefined, actor);
    expect(gemini.extractInvoiceData).toHaveBeenCalledWith(
      file.buffer,
      file.mimetype,
      undefined,
      19,
      'opaque-live-id',
      undefined,
      'agentic',
      'high',
    );
  });
  it('does not invent Medium when the Agentic preference is absent', async () => {
    const { useCase, gemini } = setup('agentic', {});
    await useCase.execute(file, dto, undefined, undefined, actor);
    expect(gemini.extractInvoiceData).toHaveBeenCalledWith(
      file.buffer,
      file.mimetype,
      undefined,
      19,
      'opaque-live-id',
      undefined,
      'agentic',
    );
  });
  it.each(['low', 'medium', 'high'])(
    'forwards configured Agentic %s without the historical boolean',
    async (level) => {
      const { useCase, gemini } = setup('agentic', {
        enable_extended_thinking: true,
        thinking_levels: { 'opaque-live-id': level },
        thinking_level: 'high',
      });
      await useCase.execute(file, dto, undefined, undefined, actor);
      expect(gemini.extractInvoiceData).toHaveBeenCalledWith(
        file.buffer,
        file.mimetype,
        undefined,
        19,
        'opaque-live-id',
        undefined,
        'agentic',
        level,
      );
    },
  );
  it('respects Agentic override, explicit clearing, and rejects invalid persisted values or mixed options', async () => {
    const { useCase, gemini } = setup('agentic', {
      enable_extended_thinking: true,
      thinking_levels: { 'opaque-live-id': 'high' },
      thinking_level: 'high',
    });
    await useCase.execute(
      file,
      { ...dto, thinking_level: 'low' },
      undefined,
      undefined,
      actor,
    );
    expect(gemini.extractInvoiceData.mock.lastCall?.slice(5)).toEqual([
      undefined,
      'agentic',
      'low',
    ]);
    const cleared = setup('agentic', {
      enable_extended_thinking: true,
      thinking_levels: { 'opaque-live-id': null },
      thinking_level: 'high',
    });
    await cleared.useCase.execute(file, dto, undefined, undefined, actor);
    expect(cleared.gemini.extractInvoiceData.mock.lastCall?.slice(5)).toEqual([
      undefined,
      'agentic',
    ]);
    for (const options of [
      { thinking_level: 'invalid' },
      { thinking_levels: [] },
      { thinking_levels: { 'opaque-live-id': false } },
    ]) {
      const invalid = setup('agentic', options);
      await expect(
        invalid.useCase.execute(file, dto, undefined, undefined, actor),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(invalid.gemini.extractInvoiceData).not.toHaveBeenCalled();
    }
    await expect(
      useCase.execute(
        file,
        { ...dto, extended_thinking: true },
        undefined,
        undefined,
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('Analyze invoice Codex routing', () => {
  const setup = () => {
    const gemini = { extractInvoiceData: vi.fn() };
    const api = { execute: vi.fn() };
    const codex = {
      execute: vi.fn(async () => ({
        code: 'SYNTHETIC',
        issue_date: null,
        total_amount: 0,
        items: [],
      })),
    };
    const providers = {
      findProviderById: vi.fn(async () => ({
        id: '42',
        is_active: true,
        catalog: { key: 'openai' },
        use_agentic: true,
        default_mode: 'agentic',
        fields: { agentic: { selected_model: 'synthetic-codex' } },
      })),
    };
    const useCase = new AnalyzeInvoiceUseCase(
      gemini as unknown as GeminiService,
      {} as MistralService,
      {} as ProviderService,
      providers as unknown as AiProviderService,
      api as unknown as ExecuteApiInvoiceUseCase,
      codex as unknown as ExecuteCodexInvoiceUseCase,
      invoiceAccess as unknown as InvoiceService,
    );
    const file = {
      buffer: Buffer.from('89504e470d0a1a0a', 'hex'),
      mimetype: 'image/png',
    } as Express.Multer.File;
    const dto: AnalyzeInvoiceDto = {
      business_id: 'b7b80a11-827c-4712-9c17-9150d0325d7b',
      ai_provider_id: '42',
      ai_provider: 'openai',
      mode: 'agentic',
      thinking_level: 'new_effort',
    };
    return { useCase, gemini, api, codex, providers, file, dto };
  };
  it.each(['connection', 'catalog', 'connection_mode', 'catalog_mode'])(
    'rejects disabled %s before any paid or native dispatch',
    async (disabled) => {
      const x = setup();
      const provider = await x.providers.findProviderById();
      const flags = {
        ...provider,
        catalog: {
          ...provider.catalog,
          is_active: true,
          can_use_agentic: true,
        },
      };
      if (disabled === 'connection') flags.is_active = false;
      if (disabled === 'catalog') flags.catalog.is_active = false;
      if (disabled === 'connection_mode') flags.use_agentic = false;
      if (disabled === 'catalog_mode') flags.catalog.can_use_agentic = false;
      x.providers.findProviderById.mockResolvedValue(flags);
      await expect(
        x.useCase.execute(x.file, x.dto, undefined, undefined, actor),
      ).rejects.toMatchObject({ status: 400 });
      expect(x.codex.execute).not.toHaveBeenCalled();
      expect(x.api.execute).not.toHaveBeenCalled();
      expect(x.gemini.extractInvoiceData).not.toHaveBeenCalled();
    },
  );
  it('preserves the multipart output contract, exact connection, effort and cancellation', async () => {
    const x = setup();
    const signal = new AbortController().signal;
    const result = await x.useCase.execute(
      x.file,
      x.dto,
      signal,
      undefined,
      actor,
    );
    expect(result).toMatchObject({ total_amount: 0, data: { items: [] } });
    expect(x.codex.execute).toHaveBeenCalledWith(
      '42',
      'synthetic-codex',
      x.file,
      undefined,
      19,
      'new_effort',
      signal,
    );
    expect(x.gemini.extractInvoiceData).not.toHaveBeenCalled();
    expect(x.api.execute).not.toHaveBeenCalled();
  });
  it('rejects a contradictory provider instead of changing the selected connection', async () => {
    const x = setup();
    await expect(
      x.useCase.execute(
        x.file,
        { ...x.dto, ai_provider: 'gemini' },
        undefined,
        undefined,
        actor,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(x.codex.execute).not.toHaveBeenCalled();
  });
  it('does not route OpenAI Web to Codex or Gemini', async () => {
    const x = setup();
    await expect(
      x.useCase.execute(
        x.file,
        { ...x.dto, mode: 'token_plan_web' },
        undefined,
        undefined,
        actor,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(x.codex.execute).not.toHaveBeenCalled();
    expect(x.gemini.extractInvoiceData).not.toHaveBeenCalled();
  });
});
