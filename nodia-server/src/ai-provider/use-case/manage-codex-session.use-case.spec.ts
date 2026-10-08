import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ManageCodexSessionUseCase } from './manage-codex-session.use-case.js';
import { CodexRuntimeService } from '../../common/ai/codex/codex-runtime.service.js';
import type { AiProviderService } from '../ai-provider.service.js';
import type { AiProvider } from '../entities/ai-provider.entity.js';

describe('Codex account connection use case', () => {
  let runtime: CodexRuntimeService;
  let useCase: ManageCodexSessionUseCase;
  let provider: AiProvider;
  let rpc: EventEmitter & { request: ReturnType<typeof vi.fn> };
  beforeEach(() => {
    provider = {
      id: '42',
      is_active: true,
      catalog: { key: 'openai', is_active: true },
    } as AiProvider;
    runtime = new CodexRuntimeService();
    rpc = Object.assign(new EventEmitter(), {
      request: vi
        .fn()
        .mockResolvedValue({
          type: 'chatgptDeviceCode',
          loginId: 'runtime-login',
          verificationUrl: 'https://auth.openai.com/codex/device',
          userCode: 'TEST-1234',
        }),
    });
    const profile = {
      rpc,
      busy: false,
      lastUsed: Date.now(),
    } as unknown as Awaited<ReturnType<CodexRuntimeService['get']>>;
    vi.spyOn(runtime, 'get').mockResolvedValue(profile);
    vi.spyOn(runtime, 'stop').mockResolvedValue();
    vi.spyOn(runtime, 'invalidate').mockImplementation(() => undefined);
    vi.spyOn(runtime, 'observe').mockResolvedValue({
      available: true,
      authenticated: true,
      planType: 'synthetic',
      checkedAt: null,
      quotas: null,
      reason: null,
      lastInferenceAt: null,
      usageAllowed: null,
    });
    useCase = new ManageCodexSessionUseCase(
      {
        findProviderById: vi.fn(async () => provider),
      } as unknown as AiProviderService,
      runtime,
    );
  });
  afterEach(async () => {
    useCase.onModuleDestroy();
    await runtime.onModuleDestroy();
  });
  it('returns only a code and official URL, never credentials; completion requires observed ChatGPT session', async () => {
    const job = await useCase.start('42', '9007199254740993');
    expect(job).toMatchObject({
      state: 'waiting_authorization',
      userCode: 'TEST-1234',
      verificationUrl: 'https://auth.openai.com/codex/device',
    });
    expect(JSON.stringify(job)).not.toContain('runtime-login');
    rpc.emit('notification', 'account/login/completed', {
      loginId: 'runtime-login',
      success: true,
      access_token: 'SYNTHETIC-SECRET',
    });
    await vi.waitFor(async () =>
      expect(
        await useCase.status('42', job.id, '9007199254740993'),
      ).toMatchObject({
        state: 'succeeded',
        userCode: null,
        verificationUrl: null,
      }),
    );
    expect(
      JSON.stringify(await useCase.status('42', job.id, '9007199254740993')),
    ).not.toContain('SYNTHETIC-SECRET');
  });
  it('does not confuse adjacent BIGINT actors or expose another actor’s current job', async () => {
    const job = await useCase.start('42', '9007199254740993');
    await expect(
      useCase.status('42', job.id, '9007199254740992'),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      useCase.cancel('42', job.id, '9007199254740992'),
    ).rejects.toMatchObject({ status: 404 });
    expect(await useCase.current('42', '9007199254740992')).toEqual({
      job: null,
    });
  });
  it('rejects overlapping login, extraction or logout on the same profile', async () => {
    await useCase.start('42', '1');
    await expect(useCase.start('42', '1')).rejects.toMatchObject({
      status: 409,
    });
    await expect(useCase.logout('42')).rejects.toMatchObject({ status: 409 });
    await expect(runtime.acquire('42')).rejects.toMatchObject({ status: 409 });
  });
  it.each([
    'http://auth.openai.com/codex/device',
    'https://auth.openai.com.evil.test/codex/device',
    'https://auth.openai.com/codex/device?token=secret',
  ])(
    'rejects unsafe login URL %s and closes only this profile',
    async (verificationUrl) => {
      rpc.request.mockResolvedValue({
        type: 'chatgptDeviceCode',
        loginId: 'runtime-login',
        verificationUrl,
        userCode: 'TEST-1234',
      });
      await expect(useCase.start('42', '1')).rejects.toMatchObject({
        status: 502,
      });
      expect(runtime.stop).toHaveBeenCalledWith('42');
    },
  );
  it('cancels only its instance and removes device codes', async () => {
    const job = await useCase.start('42', '1');
    const result = await useCase.cancel('42', job.id, '1');
    expect(rpc.request).toHaveBeenLastCalledWith('account/login/cancel', {
      loginId: 'runtime-login',
    });
    expect(result).toMatchObject({
      state: 'cancelled',
      userCode: null,
      verificationUrl: null,
    });
    expect(await useCase.current('42', '1')).toEqual({ job: null });
  });
  it('keeps failed completion separate from authentication and permits a fresh attempt', async () => {
    const first = await useCase.start('42', '1');
    rpc.emit('notification', 'account/login/completed', {
      loginId: 'runtime-login',
      success: false,
      error: 'SYNTHETIC-PRIVATE',
    });
    expect(await useCase.status('42', first.id, '1')).toMatchObject({
      state: 'failed',
      reason: 'codex_login_failed',
      userCode: null,
    });
    expect((await useCase.start('42', '1')).id).not.toBe(first.id);
  });
  it('does not certify an API account or a missing observation as Codex authentication', async () => {
    vi.mocked(runtime.observe).mockResolvedValue({
      available: true,
      authenticated: false,
      planType: null,
      checkedAt: null,
      quotas: null,
      reason: null,
      lastInferenceAt: null,
      usageAllowed: null,
    });
    const job = await useCase.start('42', '1');
    rpc.emit('notification', 'account/login/completed', {
      loginId: 'runtime-login',
      success: true,
    });
    await vi.waitFor(async () =>
      expect(await useCase.status('42', job.id, '1')).toMatchObject({
        state: 'failed',
        reason: 'codex_session_required',
      }),
    );
  });
  it('rejects other providers, inactive connections and missing connections before touching runtime', async () => {
    provider.catalog!.key = 'gemini';
    await expect(useCase.start('42', '1')).rejects.toMatchObject({
      status: 400,
    });
    expect(runtime.get).not.toHaveBeenCalled();
  });
  it('handles completion arriving before the start response', async () => {
    rpc.request.mockImplementation(async () => {
      rpc.emit('notification', 'account/login/completed', {
        loginId: 'runtime-login',
        success: true,
      });
      return {
        type: 'chatgptDeviceCode',
        loginId: 'runtime-login',
        verificationUrl: 'https://auth.openai.com/codex/device',
        userCode: 'TEST-1234',
      };
    });
    const job = await useCase.start('42', '1');
    await vi.waitFor(async () =>
      expect(await useCase.status('42', job.id, '1')).toMatchObject({
        state: 'succeeded',
      }),
    );
  });
});
