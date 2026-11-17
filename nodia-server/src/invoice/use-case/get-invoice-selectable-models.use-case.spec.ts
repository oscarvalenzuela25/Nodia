import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiProviderService } from '../../ai-provider/ai-provider.service.js';
import { GetSelectableModelsUseCase } from '../../ai-provider/use-case/get-selectable-models.use-case.js';
import type { CodexRuntimeService } from '../../common/ai/codex/codex-runtime.service.js';
import type { GeminiService } from '../../common/ai/gemini.service.js';
import { GetInvoiceSelectableModelsUseCase } from './get-invoice-selectable-models.use-case.js';

const query = { provider_id: '9007199254740993', mode: 'agentic' } as const;
const connection = {
  id: query.provider_id,
  is_active: true,
  use_agentic: true,
  default_mode: 'api_key',
  catalog: { key: 'openai', is_active: true, can_use_agentic: true },
  fields: { agentic: { selected_model: 'example-model' } },
};

describe('selectable models for invoice OCR', () => {
  const findProviderById = vi.fn();
  const observe = vi.fn();
  const listModels = vi.fn();
  const useCase = new GetInvoiceSelectableModelsUseCase(
    new GetSelectableModelsUseCase(
      { findProviderById } as unknown as AiProviderService,
      {} as GeminiService,
      undefined,
      { observe, listModels } as unknown as CodexRuntimeService,
    ),
  );

  beforeEach(() => {
    vi.resetAllMocks();
    findProviderById.mockResolvedValue(connection);
    observe.mockResolvedValue({
      authenticated: true,
      planType: 'account-plan',
    });
    listModels.mockResolvedValue([
      {
        id: 'example-model',
        name: 'example',
        displayName: 'Example',
        inputModalities: ['text', 'image'],
        supportedReasoningEfforts: ['medium'],
        remainingTokens: 123,
      },
    ]);
  });

  it('keeps exact provider and mode and exposes only the OCR model projection', async () => {
    await expect(useCase.execute(query)).resolves.toEqual([
      {
        providerId: query.provider_id,
        mode: 'agentic',
        models_source: 'provider',
        models: [
          {
            id: 'example-model',
            name: 'example',
            displayName: 'Example',
            inputModalities: ['text', 'image'],
            supportedReasoningEfforts: ['medium'],
          },
        ],
      },
    ]);
    expect(findProviderById).toHaveBeenCalledWith(query.provider_id);
    expect(observe).toHaveBeenCalledWith(query.provider_id);
    expect(listModels).toHaveBeenCalledWith(query.provider_id);
  });

  it('does not discover models for missing, inactive or disabled selections', async () => {
    findProviderById.mockRejectedValueOnce(new NotFoundException());
    await expect(useCase.execute(query)).resolves.toEqual([]);
    findProviderById.mockResolvedValueOnce({ ...connection, is_active: false });
    await expect(useCase.execute(query)).resolves.toEqual([]);
    findProviderById.mockResolvedValueOnce({
      ...connection,
      use_agentic: false,
    });
    await expect(useCase.execute(query)).resolves.toEqual([]);
    expect(observe).not.toHaveBeenCalled();
    expect(listModels).not.toHaveBeenCalled();
  });

  it('reports a disconnected session without using stored model metadata', async () => {
    observe.mockResolvedValue({
      authenticated: false,
      planType: 'account-plan',
    });
    await expect(useCase.execute(query)).resolves.toEqual([
      {
        providerId: query.provider_id,
        mode: 'agentic',
        models_source: 'unavailable',
        models: [],
      },
    ]);
    expect(listModels).not.toHaveBeenCalled();
  });

  it('rejects identifiers exceeding the PostgreSQL bigint range before discovery', async () => {
    await expect(
      useCase.execute({ ...query, provider_id: '9223372036854775808' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(findProviderById).not.toHaveBeenCalled();
  });
});
