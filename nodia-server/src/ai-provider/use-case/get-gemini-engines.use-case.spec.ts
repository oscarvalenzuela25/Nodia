import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GetGeminiEnginesUseCase } from './get-gemini-engines.use-case.js';
import { GeminiService } from '../../common/ai/gemini.service.js';

vi.mock('../../config/envs.config.js', () => ({
  envs: {
    GEMINI_MICROSERVICE_URL: 'http://127.0.0.1:8000',
    GEMINI_SERVICE_TOKEN: 'a'.repeat(64),
  },
}));

describe('GetGeminiEnginesUseCase', () => {
  let useCase: GetGeminiEnginesUseCase;
  let geminiServiceMock: Partial<GeminiService>;

  beforeEach(() => {
    geminiServiceMock = {
      getDualEngineStatus: vi.fn().mockResolvedValue({
        active_engine: 'agentic',
        agentic: {
          available: true,
          authenticated: true,
          tier: 'ANTIGRAVITY_PRO',
        },
        web: {
          available: true,
          authenticated: true,
        },
      }),
    };

    useCase = new GetGeminiEnginesUseCase(geminiServiceMock as GeminiService);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should return dual engine status from geminiService', async () => {
    const result = await useCase.execute();

    expect(geminiServiceMock.getDualEngineStatus).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      active_engine: 'agentic',
      agentic: {
        available: true,
        authenticated: true,
        tier: 'ANTIGRAVITY_PRO',
      },
      web: {
        available: true,
        authenticated: true,
      },
    });
  });
});

describe('GetGeminiEnginesUseCase with the microservice status contract', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([true, false])(
    'normalizes Web authentication without an invented available flag (authenticated=%s)',
    async (authenticated) => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            default_engine: 'web',
            web: { authenticated, tier: 'UNKNOWN' },
            agentic: {
              available: false,
              has_active_session: false,
              reason: 'session_adapter_unverified',
            },
          }),
        }),
      );
      const result = await new GetGeminiEnginesUseCase(
        new GeminiService(),
      ).execute();
      expect(result?.active_engine).toBe('web');
      expect(result?.web).toMatchObject({
        available: authenticated,
        authenticated,
        tier: 'UNKNOWN',
      });
      expect(result?.agentic).toMatchObject({
        available: false,
        authenticated: false,
        reason: 'session_adapter_unverified',
      });
    },
  );

  it.each([
    { available: true, has_active_session: true, expected: true },
    { available: true, has_active_session: false, expected: false },
    { available: false, has_active_session: true, expected: false },
    {
      available: true,
      has_active_session: true,
      authenticated: false,
      expected: false,
    },
  ])(
    'requires both adapter availability and session evidence: %j',
    async ({ expected, ...agentic }) => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValue({
            ok: true,
            json: async () => ({ agentic, web: {} }),
          }),
      );
      const result = await new GetGeminiEnginesUseCase(
        new GeminiService(),
      ).execute();
      expect(result?.agentic.authenticated).toBe(expected);
      expect(result?.active_engine).toBeNull();
    },
  );
});

describe('GetGeminiEnginesUseCase quota provenance', () => {
  afterEach(() => vi.unstubAllGlobals());
  it.each([
    { quota_source: undefined }, { quota_source: 'agentic' }, { authenticated: false },
    { quota_observed_at: null }, { quota_observed_at: (Date.now() - 61000) / 1000 },
    { quota: { bad: { usage_percentage: -1 } } }, { quota: { bad: { usage_percentage: 101 } } },
    { quota: { bad: { usage_percentage: 50, remaining: 11, total: 10 } } },
  ])('does not present invalid or unattributed quota metrics: %j', async (override) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      web: { authenticated: true, quota_source: 'web', quota_observed_at: Date.now() / 1000,
        quota: { observed: { usage_percentage: 0, remaining: 0, total: 0 } }, ...override },
      agentic: { available: false, quota: { fake: { usage_percentage: 100 } } },
    }) }));
    const result = await new GetGeminiEnginesUseCase(new GeminiService()).execute();
    expect(Object.keys(result?.web.quota ?? {})).toHaveLength(0);
    expect(result?.agentic.quota).toBeNull();
  });
  it('preserves recently observed real zero metrics without relabeling the bucket', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ web: {
      authenticated: true, quota_source: 'web', quota_observed_at: Date.now() / 1000,
      quota: { '4-123': { usage_percentage: 0, remaining: 0, total: 0, label: 'Unverified model label' } },
    } }) }));
    const result = await new GetGeminiEnginesUseCase(new GeminiService()).execute();
    expect(result?.web.quota).toMatchObject({ '4-123': { usage_percentage: 0, remaining: 0, total: 0 } });
    expect((result?.web.quota as Record<string, unknown> | undefined)?.['4-123']).not.toHaveProperty('label');
  });

  it.each([
    { quota_source: 'web' }, { quota_observed_at: null },
    { quota_observed_at: (Date.now() - 61000) / 1000 }, { has_active_session: false },
  ])('does not attribute wrong-source, stale or unauthenticated quota to Agentic (%j)', async (override) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ agentic: {
      available: true, has_active_session: true, quota_source: 'agentic_cli', quota_observed_at: Date.now() / 1000,
      quota: { 'observed-window': { usage_percentage: 0 } }, ...override,
    } }) }));
    const result = await new GetGeminiEnginesUseCase(new GeminiService()).execute();
    expect(result?.agentic.quota).toBeNull();
  });

  it('preserves Agentic zero from the verified CLI report with its own source', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ agentic: {
      available: true, has_active_session: true, quota_source: 'agentic_cli', quota_observed_at: Date.now() / 1000,
      quota: { 'observed-window': { usage_percentage: 0, remaining: null, total: null } },
    } }) }));
    const result = await new GetGeminiEnginesUseCase(new GeminiService()).execute();
    expect(result?.agentic.quota_source).toBe('agentic_cli');
    expect(result?.agentic.quota).toMatchObject({ 'observed-window': { usage_percentage: 0, remaining: null, total: null } });
  });
});
