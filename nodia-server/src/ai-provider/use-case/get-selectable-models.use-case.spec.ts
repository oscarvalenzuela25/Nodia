import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GetSelectableModelsUseCase } from './get-selectable-models.use-case.js';
import type { AiProviderService } from '../ai-provider.service.js';
import type { GeminiService } from '../../common/ai/gemini.service.js';

const provider = { id: '1', key: 'gemini', is_active: true, is_default: true,
  mode: 'token_plan_web', default_mode: 'token_plan_web', use_token_plan_web: true, use_token_plan_agentic: true,
  fields: { token_plan_web: { selected_model: 'live-model', available_models: [{ id: 'invented-model', contextWindow: 128000, capabilities: ['vision'] }] },
    token_plan_agentic: { selected_model: 'agent-model' } } };

describe('GetSelectableModelsUseCase observed data', () => {
  let list: ReturnType<typeof vi.fn>;
  let discovery: ReturnType<typeof vi.fn>;
  let useCase: GetSelectableModelsUseCase;
  beforeEach(() => {
    list = vi.fn().mockResolvedValue({ data: [provider] });
    discovery = vi.fn().mockResolvedValue({ authenticated: true, models: [{ id: 'live-model' }] });
    useCase = new GetSelectableModelsUseCase({ findAllProviders: list } as unknown as AiProviderService,
      { getModelsAndQuota: discovery } as unknown as GeminiService);
  });
  it('uses live discovery and never saved model metrics', async () => {
    const [result] = await useCase.execute({ provider_id: '1' });
    expect(result.providerId).toBe('1');
    expect(result.selectedModel).toBe('live-model');
    expect(result.models_source).toBe('provider');
    expect(result.models).toEqual([expect.objectContaining({ id: 'live-model', contextWindow: null, capabilities: [], isRecommended: false,
      remainingTokens: null, usagePercentage: null, isCurrent: true })]);
  });
  it('preserves explicit provider metadata without adding audio/video/reasoning', async () => {
    discovery.mockResolvedValue({ authenticated: true, models: [{ id: 'live-model', context_window: 32000, capabilities: ['vision'] }] });
    expect((await useCase.execute({}))[0].models[0]).toMatchObject({ contextWindow: 32000, capabilities: ['vision'] });
  });
  it('keeps quota windows separate and does not call credits tokens', async () => {
    discovery.mockResolvedValue({ authenticated: true, models: [{ id: 'live-model', remaining_credits: 999 }], quota_source: 'web', quota_observed_at: Date.now() / 1000,
      usage_info: { current_5h: { usage_percentage: 0, remaining_credits: 0 }, weekly: { usage_percentage: 70, remaining_credits: 100 } } });
    const [result] = await useCase.execute({});
    expect(result.models[0].remainingTokens).toBeNull();
    expect(result.tokenPlan).toMatchObject({ remainingCredits: null, usagePercentage: null, current5h: { usagePercentage: 0, remainingCredits: 0 }, weekly: { usagePercentage: 70, remainingCredits: 100 } });
  });
  it('does not expose unproven, old or invalid quota data', async () => {
    discovery.mockResolvedValue({ authenticated: true, models: [], usage_info: { weekly: { usage_percentage: 80, remaining_credits: 999 } } });
    expect((await useCase.execute({}))[0].tokenPlan?.weekly).toBeNull();
  });
  it('uses the requested instance and subscription mode without root fallback', async () => {
    list.mockResolvedValue({ data: [provider, { ...provider, id: '2' }] });
    discovery.mockResolvedValue({ available: true, authenticated: true, models: [{ id: 'agent-model' }] });
    const [result] = await useCase.execute({ provider_id: '2', mode: 'token_plan_agentic' });
    expect(result.providerId).toBe('2');
    expect(result.selectedModel).toBe('agent-model');
    expect(discovery).toHaveBeenCalledWith('agentic');
    expect(result.models[0].isCurrent).toBe(true);
  });
  it('does not authenticate an agentic adapter from authentication alone', async () => {
    discovery.mockResolvedValue({ available: false, authenticated: true, models: [{ id: 'agent-model' }] });
    const [result] = await useCase.execute({ mode: 'token_plan_agentic' });
    expect(result.models).toEqual([]);
    expect(result.tokenPlan?.authenticated).toBe(false);
  });
  it('retains an unassigned model even when the provider reports a recommendation', async () => {
    list.mockResolvedValue({ data: [{ ...provider, fields: {} }] });
    discovery.mockResolvedValue({ authenticated: true, models: [{ id: 'recommended', isRecommended: true }] });
    expect((await useCase.execute({}))[0].selectedModel).toBeNull();
  });
  it('returns unavailable data for a disconnected engine', async () => {
    discovery.mockResolvedValue({ authenticated: false, models: [{ id: 'ghost' }] });
    const [result] = await useCase.execute({});
    expect(result.models_source).toBe('unavailable');
    expect(result.models).toEqual([]);
    expect(result.models_observed_at).toBeNull();
  });
  it('keeps historical API configuration from claiming real models, quotas or availability', async () => {
    list.mockResolvedValue({ data: [{ ...provider, key: 'mistral', mode: 'api_key', default_mode: 'api_key', fields: { selected_model: 'configured' } }] });
    const [result] = await useCase.execute({ provider: 'mistral' });
    expect(result.selectedModel).toBe('configured');
    expect(result.models).toEqual([]);
    expect(result).not.toHaveProperty('apiKeyPlan');
    expect(discovery).not.toHaveBeenCalled();
  });
  it('returns empty results for missing provider and disabled mode', async () => {
    expect(await useCase.execute({ provider: 'missing' })).toEqual([]);
    list.mockResolvedValue({ data: [{ ...provider, use_token_plan_agentic: false }] });
    expect(await useCase.execute({ mode: 'token_plan_agentic' })).toEqual([]);
    list.mockResolvedValue({ data: [] });
    expect(await useCase.execute({})).toEqual([]);
  });
  it('rejects malformed live model data with a controlled upstream error', async () => {
    discovery.mockResolvedValue({ authenticated: true, models: [{ id: '' }] });
    await expect(useCase.execute({})).rejects.toMatchObject({ status: 502 });
  });
});
