import type { GeminiService } from '../../common/ai/gemini.service.js';
import { describe, expect, it, vi } from 'vitest';
import {
  ManageAiProviderSecureSessionUseCase,
  type AiProviderSecureMode,
  type AiProviderSecureReference,
} from './manage-ai-provider-secure-session.use-case.js';
import { configurationFixture } from '../../../test/fixtures/ai-provider-configuration.fixture.js';
import type { ManageGeminiAgenticLoginUseCase } from './manage-gemini-agentic-login.use-case.js';
import type { ManageCodexSessionUseCase } from './manage-codex-session.use-case.js';
import type { SyncAiProviderModelsUseCase } from './sync-ai-provider-models.use-case.js';

describe('ManageAiProviderSecureSessionUseCase', () => {
  const fixture = () => {
    const f = configurationFixture();
    f.existing.use_api_key = true;
    f.existing.use_agentic = true;
    const native = { id: 'a'.repeat(32), state: 'running' };
    const agentic = {
      start: vi.fn(async () => native),
      status: vi.fn(async () => native),
      cancel: vi.fn(async () => ({ ...native, state: 'cancelled' })),
      submit: vi.fn(async () => native),
    };
    const codexNative = {
      id: '11111111-1111-4111-8111-111111111111',
      state: 'running',
    };
    const codex = {
      acknowledgeRequest: vi.fn(async () => ({ acknowledged: true })),
      start: vi.fn(async () => codexNative),
      status: vi.fn(async () => codexNative),
      cancel: vi.fn(async () => ({ ...codexNative, state: 'cancelled' })),
      logout: vi.fn(async () => ({ disconnected: true })),
      statusRequest: vi.fn(async () => codexNative),
      cancelRequest: vi.fn(async () => ({
        ...codexNative,
        state: 'cancelled',
      })),
    };
    const models = [
      {
        id: 'synthetic-discovered',
        name: 'Synthetic',
        displayName: 'Synthetic',
        description: '',
        contextWindow: null,
        capabilities: [],
        isRecommended: false,
      },
    ];
    const sync = {
      execute: vi.fn(async () => ({ models, providerId: f.existing.id })),
    };
    const ref: AiProviderSecureReference = {
      provider_id: f.existing.id,
      provider_key: 'gemini',
      mode: 'agentic',
      job_id: native.id,
    };
    const update = vi.fn(async () => undefined);
    Object.assign(f.providerRepo, { update });
    const direct = {
      acknowledgeLoginRequest: vi.fn(async () => undefined),
      durableLoginRequest: vi.fn(async (_engine, _action, id: string) => ({
        ...native,
        id: id.replaceAll('-', ''),
      })),
    };
    const uc = new ManageAiProviderSecureSessionUseCase(
      f.source,
      agentic as unknown as ManageGeminiAgenticLoginUseCase,
      codex as unknown as ManageCodexSessionUseCase,
      sync as unknown as SyncAiProviderModelsUseCase,
      direct as unknown as GeminiService,
    );
    return {
      ...f,
      native,
      codexNative,
      agentic,
      codex,
      sync,
      models,
      ref,
      uc,
      update,
      direct,
    };
  };
  it('authorizes under the inherited manager and exposes only safe provider identity', async () => {
    const f = fixture();
    const result = await f.uc.authorize(
      f.manager,
      f.actor,
      f.existing.id,
      'agentic',
    );
    expect(result).toEqual({
      id: f.existing.id,
      key: 'gemini',
      mode: 'agentic',
    });
    expect(f.source.transaction).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('private');
  });
  it('commits the short authority check before entering the actual native login', async () => {
    const f = fixture();
    let sqlOpen = false;
    vi.mocked(f.source.transaction).mockImplementation(async (work: never) => {
      sqlOpen = true;
      try {
        return await (work as (m: typeof f.manager) => Promise<unknown>)(
          f.manager,
        );
      } finally {
        sqlOpen = false;
      }
    });
    f.agentic.start.mockImplementationOnce(async () => {
      expect(sqlOpen).toBe(false);
      return f.native;
    });
    const result = await f.uc.start(f.existing.id, 'agentic', f.actor);
    expect(result.state).toBe('pending');
    expect(result.reference).toEqual(f.ref);
    expect(f.agentic.start).toHaveBeenCalledWith(f.actor.userId);
  });
  it('routes Gemini Agentic independently and keeps the native URL in human response only', async () => {
    const f = fixture();
    f.agentic.start.mockResolvedValueOnce({
      ...f.native,
      state: 'waiting_code',
      authorization_url: 'synthetic-human-only',
    } as never);
    const result = await f.uc.start(f.existing.id, 'agentic', f.actor);
    expect(result.human.kind).toBe('gemini_agentic');
    expect(f.codex.start).not.toHaveBeenCalled();
    expect(JSON.stringify(result.reference)).not.toContain(
      'synthetic-human-only',
    );
  });
  it('routes Codex to the exact provider id and actor', async () => {
    const f = fixture();
    f.catalog.key = 'openai';
    const result = await f.uc.start(f.existing.id, 'agentic', f.actor);
    expect(result.human.kind).toBe('codex');
    expect(f.codex.start).toHaveBeenCalledWith(f.existing.id, f.actor.userId);
  });
  it.each(['succeeded', 'failed', 'cancelled', 'verifying'])(
    'maps actual observed %s without client asserted success',
    async (state) => {
      const f = fixture();
      f.agentic.status.mockResolvedValueOnce({ ...f.native, state });
      const result = await f.uc.status(f.ref, f.actor);
      expect(result.state).toBe(
        state === 'succeeded'
          ? 'completed'
          : state === 'verifying'
            ? 'pending'
            : state,
      );
    },
  );
  it('refuses network IO under the coordinator transaction', async () => {
    const f = fixture();
    await expect(
      f.uc.start(f.existing.id, 'agentic', {
        ...f.actor,
        transaction: f.manager,
      }),
    ).rejects.toThrow('external_transaction_forbidden');
    expect(f.agentic.start).not.toHaveBeenCalled();
  });
  it('revalidates permission and current session before every native action', async () => {
    const f = fixture();
    f.setSession(false);
    await expect(f.uc.status(f.ref, f.actor)).rejects.toThrow(
      'session_expired',
    );
    expect(f.agentic.status).not.toHaveBeenCalled();
    f.setSession(true);
    f.setAdmin(false);
    f.setModule(false);
    await expect(f.uc.cancel(f.ref, f.actor)).rejects.toThrow(
      'core:module_access_required',
    );
    expect(f.agentic.cancel).not.toHaveBeenCalled();
  });
  it.each(['is_active', 'use_agentic'])(
    'blocks a disabled connection flag %s before native IO',
    async (flag) => {
      const f = fixture();
      Object.assign(f.existing, { [flag]: false });
      await expect(
        f.uc.start(f.existing.id, 'agentic', f.actor),
      ).rejects.toThrow('channel_disabled');
      expect(f.agentic.start).not.toHaveBeenCalled();
    },
  );
  it('does not bypass native busy/quarantine or silently fall back', async () => {
    const f = fixture();
    f.agentic.start.mockRejectedValueOnce(new Error('runtime_busy'));
    await expect(f.uc.start(f.existing.id, 'agentic', f.actor)).rejects.toThrow(
      'runtime_busy',
    );
    expect(f.agentic.start).toHaveBeenCalledOnce();
    expect(f.codex.start).not.toHaveBeenCalled();
  });
  it('allows observing and cancelling a known login after the connection or channel is disabled', async () => {
    const f = fixture();
    f.existing.is_active = false;
    f.existing.use_agentic = false;
    f.catalog.can_use_agentic = false;
    await expect(f.uc.status(f.ref, f.actor)).resolves.toMatchObject({
      state: 'pending',
    });
    await expect(f.uc.cancel(f.ref, f.actor)).resolves.toMatchObject({
      state: 'cancelled',
    });
    await expect(f.uc.start(f.existing.id, 'agentic', f.actor)).rejects.toThrow(
      'channel_disabled',
    );
    expect(f.agentic.start).not.toHaveBeenCalled();
  });
  it('disabled channel cleanup still requires current permission and the exact provider reference', async () => {
    const f = fixture();
    f.existing.use_agentic = false;
    f.setSession(false);
    await expect(f.uc.cancel(f.ref, f.actor)).rejects.toThrow(
      'session_expired',
    );
    expect(f.agentic.cancel).not.toHaveBeenCalled();
  });
  it('does not resend a start with unknown result', async () => {
    const f = fixture();
    const expiresAt = new Date(Date.now() + 290_000).toISOString();
    f.direct.durableLoginRequest.mockRejectedValueOnce(
      new Error('response lost'),
    );
    await expect(
      f.uc.start(
        f.existing.id,
        'agentic',
        f.actor,
        f.actor.sessionId,
        expiresAt,
      ),
    ).rejects.toThrow('response lost');
    expect(f.direct.durableLoginRequest).toHaveBeenCalledExactlyOnceWith(
      'agentic',
      'start',
      f.actor.sessionId,
      f.existing.id,
      f.actor.userId,
      expiresAt,
    );
    expect(f.agentic.start).not.toHaveBeenCalled();
  });
  it('reconciles a durable request without starting another login or requiring a revoked session', async () => {
    const f = fixture();
    f.setSession(false);
    const target = {
      provider_id: f.existing.id,
      provider_key: 'gemini' as const,
      mode: 'agentic' as const,
      request_id: f.actor.sessionId,
    };
    await expect(
      f.uc.observeRequest(target, f.actor.userId),
    ).resolves.toMatchObject({
      state: 'pending',
      reference: { job_id: f.actor.sessionId.replaceAll('-', '') },
    });
    await f.uc.cancelRequest(target, f.actor.userId);
    expect(f.direct.durableLoginRequest).toHaveBeenLastCalledWith(
      'agentic',
      'cancel',
      target.request_id,
      target.provider_id,
      f.actor.userId,
    );
    expect(f.source.transaction).not.toHaveBeenCalled();
    expect(f.agentic.start).not.toHaveBeenCalled();
  });
  it('does not reinterpret missing native proof as terminal cancellation', async () => {
    const f = fixture();
    f.direct.durableLoginRequest.mockRejectedValueOnce(
      new Error('native unknown'),
    );
    await expect(
      f.uc.cancelRequest(
        {
          provider_id: f.existing.id,
          provider_key: 'gemini',
          mode: 'agentic',
          request_id: f.actor.sessionId,
        },
        f.actor.userId,
      ),
    ).rejects.toThrow('native unknown');
    expect(f.agentic.start).not.toHaveBeenCalled();
    expect(f.codex.logout).not.toHaveBeenCalled();
  });
  it('forwards a post-commit acknowledgement without starting login or asserting a new result', async () => {
    const f = fixture();
    const target = {
      provider_id: f.existing.id,
      provider_key: 'gemini' as const,
      mode: 'agentic' as const,
      request_id: f.actor.sessionId,
    };
    await f.uc.acknowledgeRequest(target, f.actor.userId);
    expect(f.direct.acknowledgeLoginRequest).toHaveBeenLastCalledWith(
      'agentic',
      target.request_id,
      target.provider_id,
      f.actor.userId,
    );
    f.direct.acknowledgeLoginRequest.mockRejectedValueOnce(
      new Error('ACK response lost'),
    );
    await expect(
      f.uc.acknowledgeRequest(target, f.actor.userId),
    ).rejects.toThrow('ACK response lost');
    expect(f.agentic.start).not.toHaveBeenCalled();
  });
  it('rejects expired or missing native deadlines before dispatch and binds successful starts to the stable request id', async () => {
    const f = fixture();
    for (const deadline of [
      undefined,
      'invalid',
      new Date(Date.now() - 1).toISOString(),
      new Date(Date.now() + 400_000).toISOString(),
    ]) {
      await expect(
        f.uc.start(
          f.existing.id,
          'agentic',
          f.actor,
          f.actor.sessionId,
          deadline,
        ),
      ).rejects.toThrow('invalid_login_deadline');
    }
    expect(f.direct.durableLoginRequest).not.toHaveBeenCalled();
    f.direct.durableLoginRequest.mockResolvedValueOnce(f.native);
    await expect(
      f.uc.start(
        f.existing.id,
        'agentic',
        f.actor,
        f.actor.sessionId,
        new Date(Date.now() + 290_000).toISOString(),
      ),
    ).rejects.toThrow('invalid_login_observation');
  });
  it('rejects malformed or cross-provider durable targets before transport', async () => {
    const f = fixture();
    const target = {
      provider_id: f.existing.id,
      provider_key: 'gemini' as const,
      mode: 'agentic' as const,
      request_id: f.actor.sessionId,
    };
    for (const invalid of [
      { ...target, request_id: '../unsafe' },
      { ...target, provider_key: 'google' },
      { ...target, extra: 'denied' },
    ]) {
      await expect(
        f.uc.cancelRequest(invalid as typeof target, f.actor.userId),
      ).rejects.toThrow('invalid_login_request');
    }
    expect(f.direct.durableLoginRequest).not.toHaveBeenCalled();
  });
  it('trusted cleanup releases only an owned existing native job after permission revocation', async () => {
    const f = fixture();
    f.setSession(false);
    await expect(f.uc.cleanup(f.ref, f.actor.userId)).resolves.toMatchObject({
      state: 'cancelled',
    });
    expect(f.source.transaction).not.toHaveBeenCalled();
    expect(f.agentic.cancel).toHaveBeenCalledWith(f.ref.job_id, f.actor.userId);
    expect(f.agentic.start).not.toHaveBeenCalled();
    expect(f.codex.logout).not.toHaveBeenCalled();
  });
  it('keeps Agentic observation and cleanup bound to native ownership', async () => {
    const f = fixture();
    await f.uc.status(f.ref, f.actor);
    await f.uc.cleanup(f.ref, f.actor.userId);
    expect(f.agentic.status).toHaveBeenCalledWith(f.ref.job_id, f.actor.userId);
    expect(f.agentic.cancel).toHaveBeenCalledWith(f.ref.job_id, f.actor.userId);
    expect(f.agentic.start).not.toHaveBeenCalled();
  });
  it('has no browser viewer transport in the Agentic session manager', () => {
    const f = fixture();
    expect(f.uc).not.toHaveProperty('frame');
    expect(f.uc).not.toHaveProperty('input');
  });
  it('does not claim Codex cleanup succeeded when a restarted process no longer owns the native job', async () => {
    const f = fixture();
    f.codex.cancel.mockRejectedValueOnce(
      new Error('Codex native job no longer present'),
    );
    await expect(
      f.uc.cleanup(
        {
          ...f.ref,
          provider_key: 'openai',
          mode: 'agentic',
          job_id: f.codexNative.id,
        },
        f.actor.userId,
      ),
    ).rejects.toThrow('no longer present');
    expect(f.codex.logout).not.toHaveBeenCalled();
    expect(f.codex.start).not.toHaveBeenCalled();
  });
  it('trusted cleanup still rejects invented native references and actors', async () => {
    const f = fixture();
    await expect(
      f.uc.cleanup({ ...f.ref, mode: 'api_key' }, f.actor.userId),
    ).rejects.toThrow('invalid_login_reference');
    await expect(f.uc.cleanup(f.ref, '0')).rejects.toThrow('invalid_actor');
    expect(f.agentic.cancel).not.toHaveBeenCalled();
  });
  it('rejects malformed or cross-provider native references before status', async () => {
    const f = fixture();
    for (const ref of [
      { ...f.ref, job_id: '../unsafe' },
      { ...f.ref, provider_key: 'openai' as const },
    ])
      await expect(f.uc.status(ref, f.actor)).rejects.toThrow(
        'invalid_login_reference',
      );
    expect(f.agentic.status).not.toHaveBeenCalled();
  });
  it('rejects native job identity or state changes rather than reporting success', async () => {
    const f = fixture();
    f.agentic.status.mockResolvedValueOnce({
      id: 'b'.repeat(32),
      state: 'succeeded',
    });
    await expect(f.uc.status(f.ref, f.actor)).rejects.toThrow(
      'invalid_login_observation',
    );
    f.agentic.status.mockResolvedValueOnce({ ...f.native, state: 'invented' });
    await expect(f.uc.status(f.ref, f.actor)).rejects.toThrow(
      'invalid_login_observation',
    );
  });
  it('forwards secret authorization code only to the native Agentic input', async () => {
    const f = fixture();
    const ref = { ...f.ref, mode: 'agentic' as const };
    await f.uc.submitCode(ref, 'synthetic-secret-code', f.actor);
    expect(f.agentic.submit).toHaveBeenCalledWith(ref.job_id, f.actor.userId, {
      code: 'synthetic-secret-code',
    });
    f.catalog.key = 'openai';
    await expect(
      f.uc.submitCode(
        { ...f.ref, provider_key: 'openai', job_id: f.codexNative.id },
        'synthetic',
        f.actor,
      ),
    ).rejects.toThrow('code_unsupported');
  });
  it('rejects retired Web references before any session transport', async () => {
    const f = fixture();
    await expect(
      f.uc.status({ ...f.ref, mode: 'token_plan_web' } as never, f.actor),
    ).rejects.toThrow('invalid_mode');
    expect(f.agentic.status).not.toHaveBeenCalled();
    expect(f.codex.status).not.toHaveBeenCalled();
  });
  it('delegates actual ownership and TTL rejection instead of replacing the native job', async () => {
    const f = fixture();
    f.agentic.status.mockRejectedValueOnce(
      new Error('native job expired or other owner'),
    );
    await expect(f.uc.status(f.ref, f.actor)).rejects.toThrow(
      'expired or other owner',
    );
    expect(f.agentic.start).not.toHaveBeenCalled();
  });
  it('logs out only supported independent profiles', async () => {
    const f = fixture();
    await expect(
      f.uc.logout(f.existing.id, 'agentic', f.actor),
    ).rejects.toThrow('logout_unsupported');
    f.catalog.key = 'openai';
    await f.uc.logout(f.existing.id, 'agentic', f.actor);
    expect(f.codex.logout).toHaveBeenCalledWith(f.existing.id);
  });
  it('discovers outside SQL without persisting a remote snapshot prematurely', async () => {
    const f = fixture();
    await f.uc.discover(f.existing.id, 'agentic', f.actor);
    expect(f.sync.execute).toHaveBeenCalledWith(f.existing.id, {
      mode: 'agentic',
      persist: false,
    });
    expect(f.update).not.toHaveBeenCalled();
  });
  it('merges observed models with the receipt manager, preserving newer preferences and other channels', async () => {
    const f = fixture();
    const previous = structuredClone(f.existing.fields);
    await f.uc.commitDiscovery(
      f.manager,
      f.actor,
      f.existing.id,
      'agentic',
      f.models,
    );
    expect(f.source.transaction).not.toHaveBeenCalled();
    const fields = f.update.mock.calls[0][1].fields;
    expect(fields.legacy).toEqual(previous.legacy);
    expect(fields.agentic.selected_model).toBe('synthetic-model');
    expect(fields.agentic.available_models[0].id).toBe('synthetic-discovered');
  });
  it('revocation prevents persisting discovery even after remote work completed', async () => {
    const f = fixture();
    f.setSession(false);
    await expect(
      f.uc.commitDiscovery(
        f.manager,
        f.actor,
        f.existing.id,
        'agentic',
        f.models,
      ),
    ).rejects.toThrow('session_expired');
    expect(f.update).not.toHaveBeenCalled();
  });
  it.each([[], [{ id: '' }], [{ id: 'x'.repeat(513) }]])(
    'rejects invalid discovery observations %j',
    async (models) => {
      const f = fixture();
      await expect(
        f.uc.commitDiscovery(
          f.manager,
          f.actor,
          f.existing.id,
          'agentic',
          models as never,
        ),
      ).rejects.toThrow('invalid_models');
    },
  );
  it.each(['api_key', 'invented'])(
    'does not start a native login for mode %s',
    async (mode) => {
      const f = fixture();
      await expect(
        f.uc.start(f.existing.id, mode as AiProviderSecureMode, f.actor),
      ).rejects.toThrow();
      expect(f.agentic.start).not.toHaveBeenCalled();
    },
  );
});
