import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateAiProviderUseCase } from './create-ai-provider.use-case.js';
import type { AiProviderService } from '../ai-provider.service.js';
import type { CreateAiProviderDto } from '../dto/create-ai-provider.dto.js';
import type { AiProvider } from '../entities/ai-provider.entity.js';

describe('CreateAiProviderUseCase', () => {
  let useCase: CreateAiProviderUseCase;
  let serviceMock: Partial<AiProviderService>;

  beforeEach(() => {
    serviceMock = {
      createProvider: vi.fn(),
    };
    useCase = new CreateAiProviderUseCase(serviceMock as AiProviderService);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call aiProviderService.createProvider and return the created provider', async () => {
    const dto: CreateAiProviderDto = { key: 'mistral', is_active: true };
    const mockProvider = {
      id: '1',
      key: 'mistral',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    } as AiProvider;

    vi.mocked(serviceMock.createProvider!).mockResolvedValue(mockProvider);

    const result = await useCase.execute(dto);

    expect(serviceMock.createProvider).toHaveBeenCalledWith(dto);
    expect(result).toEqual(mockProvider);
  });

  it('should pass translates to aiProviderService.createProvider when provided', async () => {
    const dto: CreateAiProviderDto = {
      key: 'gemini',
      is_active: true,
      translates: [{ key: 'key', es: 'Gemini', en: 'Gemini' }],
    };
    const mockProvider = {
      id: '2',
      key: 'gemini',
      is_active: true,
      translates: [{ key: 'key', es: 'Gemini', en: 'Gemini' }],
      created_at: new Date(),
      updated_at: new Date(),
    } as AiProvider;

    vi.mocked(serviceMock.createProvider!).mockResolvedValue(mockProvider);

    const result = await useCase.execute(dto);

    expect(serviceMock.createProvider).toHaveBeenCalledWith(dto);
    expect(result.translates).toEqual(dto.translates);
  });

  it('should pass multi-channel flags and default_mode to aiProviderService.createProvider', async () => {
    const dto: CreateAiProviderDto = {
      catalog_id: '1',
      use_api_key: true,
      use_token_plan_web: true,
      use_token_plan_agentic: true,
      default_mode: 'token_plan_agentic',
    };
    const mockProvider = {
      id: '1',
      catalog_id: '1',
      use_api_key: true,
      use_token_plan_web: true,
      use_token_plan_agentic: true,
      default_mode: 'token_plan_agentic',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    } as unknown as AiProvider;

    vi.mocked(serviceMock.createProvider!).mockResolvedValue(mockProvider);

    const result = await useCase.execute(dto);

    expect(serviceMock.createProvider).toHaveBeenCalledWith(dto);
    expect(result.default_mode).toBe('token_plan_agentic');
    expect(result.use_token_plan_agentic).toBe(true);
  });
});
