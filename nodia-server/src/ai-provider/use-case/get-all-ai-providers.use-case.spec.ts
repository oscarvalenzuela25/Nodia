import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetAllAiProvidersUseCase } from './get-all-ai-providers.use-case.js';
import { AiProviderService } from '../ai-provider.service.js';
import { AiProvider } from '../entities/ai-provider.entity.js';
import { AiProviderCatalog } from '../entities/ai-provider-catalog.entity.js';
import type { AiApiKey } from '../entities/ai-api-key.entity.js';
import type { AiProviderEvent } from '../entities/ai-provider-event.entity.js';
import { TranslationService } from '../../translation/translation.service.js';
import type { Translation } from '../../translation/entities/translation.entity.js';
import type { Repository } from 'typeorm';
import { GetSelectableModelsUseCase } from './get-selectable-models.use-case.js';
import type { GeminiService } from '../../common/ai/gemini.service.js';
import type { GetAiProvidersDto } from '../dto/get-ai-providers.dto.js';
import type { GetAiProvidersResponse } from '../types/ai-provider.types.js';

describe('GetAllAiProvidersUseCase', () => {
  let useCase: GetAllAiProvidersUseCase;
  let serviceMock: Partial<AiProviderService>;

  beforeEach(() => {
    serviceMock = {
      findAllProviders: vi.fn(),
    };
    useCase = new GetAllAiProvidersUseCase(serviceMock as AiProviderService);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call aiProviderService.findAllProviders with provided query and return response', async () => {
    const dto: GetAiProvidersDto = { page: 1, limit: 10, all: false };
    const mockResponse: GetAiProvidersResponse = {
      data: [
        {
          id: '1',
          key: 'gemini',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
          connections: [],
          events: [],
        },
      ],
      meta: { page: 1, limit: 10, total_items: 1, total_pages: 1 },
    };

    vi.mocked(serviceMock.findAllProviders!).mockResolvedValue(mockResponse);

    const result = await useCase.execute(dto);

    expect(serviceMock.findAllProviders).toHaveBeenCalledWith(dto);
    expect(result).toEqual(mockResponse);
  });
});

describe('AI provider public contract through real translation attachment', () => {
  const setup = () => {
    const provider = Object.assign(new AiProvider(), {
      id: '1',
      catalog: Object.assign(new AiProviderCatalog(), {
        id: '7',
        key: 'gemini',
      }),
      default_mode: 'token_plan_web' as const,
      use_token_plan_web: true,
      is_active: true,
      fields: { selected_model: 'discovered-model', secret: 'sensitive-value' },
    });
    const qb = {
      leftJoinAndSelect: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      addSelect: vi.fn().mockReturnThis(),
      addOrderBy: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      take: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue([provider]),
      getManyAndCount: vi.fn().mockResolvedValue([[provider], 1]),
    };
    const translations = new TranslationService({
      find: vi
        .fn()
        .mockResolvedValue([
          {
            source_id: '1',
            source_key: 'name',
            locale: 'es',
            value: 'Sesión Web',
          },
        ]),
    } as unknown as Repository<Translation>);
    const service = new AiProviderService(
      {
        createQueryBuilder: vi.fn().mockReturnValue(qb),
      } as unknown as Repository<AiProvider>,
      {} as Repository<AiApiKey>,
      {} as Repository<AiProviderEvent>,
      {} as Repository<AiProviderCatalog>,
      translations,
    );
    return {
      provider,
      qb,
      service,
      useCase: new GetAllAiProvidersUseCase(service),
    };
  };

  it.each([true, false])(
    'serializes identity and configured mode after translation (all=%s)',
    async (all) => {
      const { useCase, provider } = setup();
      const result = await useCase.execute({ all, page: 1, limit: 25 });
      const serialized = JSON.parse(JSON.stringify(result));
      expect(serialized.data[0]).toMatchObject({
        key: 'gemini',
        mode: 'token_plan_web',
        default_mode: 'token_plan_web',
      });
      expect(serialized.data[0].translates).toEqual([
        { key: 'name', es: 'Sesión Web', en: '' },
      ]);
      expect(serialized.data[0].fields.secret).not.toBe('sensitive-value');
      expect(provider.fields.secret).toBe('sensitive-value');
    },
  );

  it('retains identity when relations are excluded from the public response', async () => {
    const { useCase, qb } = setup();
    const result = await useCase.execute({ all: true, includes: false });
    expect(qb.addSelect).toHaveBeenCalledWith(['catalog.id', 'catalog.key']);
    expect(result.data[0].key).toBe('gemini');
    expect(result.data[0]).not.toHaveProperty('catalog');
  });

  it('filters selectable models using the serialized provider without a TypeError', async () => {
    const { service } = setup();
    const gemini = {
      getModelsAndQuota: vi
        .fn()
        .mockResolvedValue({ authenticated: false, models: [] }),
    };
    const result = await new GetSelectableModelsUseCase(
      service,
      gemini as unknown as GeminiService,
    ).execute({ provider: 'gemini' });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      provider: 'gemini',
      mode: 'token_plan_web',
      selectedModel: 'discovered-model',
    });
    expect(result[0].tokenPlan?.authenticated).toBe(false);
    expect(gemini.getModelsAndQuota).toHaveBeenCalledWith('web');
  });

  it('revokes cached model and quota claims without changing stored configuration', async () => {
    const { useCase, provider } = setup();
    const model = { id: 'saved-id', contextWindow: 128000, capabilities: ['vision', 'reasoning'], isRecommended: true, remaining_credits: 2400 };
    provider.fields.available_models = [model];
    provider.fields.quota = { remaining: 2400 };
    provider.fields.token_plan_web = { selected_model: 'saved-id', available_models: [model], usage_info: { weekly: 99 } };
    const response = await useCase.execute({ all: true });
    expect(response.data[0].fields).not.toHaveProperty('quota');
    expect(response.data[0].fields.token_plan_web).not.toHaveProperty('usage_info');
    expect(response.data[0].fields.available_models[0]).toMatchObject({ id: 'saved-id', contextWindow: null, capabilities: [], isRecommended: false });
    expect(response.data[0].fields.available_models[0]).not.toHaveProperty('remaining_credits');
    expect(provider.fields.available_models[0]).toEqual(model);
    expect(provider.fields.token_plan_web.selected_model).toBe('saved-id');
  });
});
