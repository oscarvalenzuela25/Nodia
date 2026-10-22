import type { RecoverNodiaAiSecureFlowsUseCase } from '../../nodia-ai-secure-flow/use-case/recover-nodia-ai-secure-flows.use-case.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MaintainNodiaAiRuntimeUseCase } from './maintain-nodia-ai-runtime.use-case.js';
import { runtimeFixture } from './runtime.fixture.js';
import type { ExpireNodiaAiConversationsUseCase } from '../../nodia-ai-conversation/use-case/expire-nodia-ai-conversations.use-case.js';
import type { CleanupNodiaAiRuntimeProofsUseCase } from './cleanup-nodia-ai-runtime-proofs.use-case.js';

describe('MaintainNodiaAiRuntimeUseCase', () => {
  afterEach(() => vi.useRealTimers());
  it('runs proof cleanup on every heartbeat but expiry only at its separate sweep interval', async () => {
    vi.useFakeTimers();
    const f = runtimeFixture(),
      expiry = {
        execute: vi.fn(async () => ({ purged_chats: 0, unresolved_jobs: 0 })),
      },
      cleanup = { execute: vi.fn(async () => ({ processed: 0, settled: 0 })) },
      secure = { execute: vi.fn(async () => 0) };
    const usecase = new MaintainNodiaAiRuntimeUseCase(
      expiry as unknown as ExpireNodiaAiConversationsUseCase,
      cleanup as unknown as CleanupNodiaAiRuntimeProofsUseCase,
      f.policy,
      secure as unknown as RecoverNodiaAiSecureFlowsUseCase,
    );
    await usecase.execute();
    await usecase.execute();
    expect(expiry.execute).toHaveBeenCalledTimes(1);
    expect(cleanup.execute).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(f.policy.retention.sweep_seconds * 1000);
    await usecase.execute();
    expect(expiry.execute).toHaveBeenCalledTimes(2);
    expect(cleanup.execute).toHaveBeenCalledTimes(3);
    expect(secure.execute).toHaveBeenCalledTimes(3);
  });
  it.each(['expiry', 'cleanup', 'secure'])(
    'does not starve the other maintenance duty after %s fails',
    async (failed) => {
      const f = runtimeFixture(),
        expiry = {
          execute: vi.fn(async () => ({ purged_chats: 0, unresolved_jobs: 0 })),
        },
        cleanup = {
          execute: vi.fn(async () => ({ processed: 0, settled: 0 })),
        },
        secure = { execute: vi.fn(async () => 0) };
      if (failed === 'expiry')
        expiry.execute.mockRejectedValueOnce(Error('offline'));
      else if (failed === 'cleanup')
        cleanup.execute.mockRejectedValueOnce(Error('offline'));
      else secure.execute.mockRejectedValueOnce(Error('offline'));
      const usecase = new MaintainNodiaAiRuntimeUseCase(
        expiry as unknown as ExpireNodiaAiConversationsUseCase,
        cleanup as unknown as CleanupNodiaAiRuntimeProofsUseCase,
        f.policy,
        secure as unknown as RecoverNodiaAiSecureFlowsUseCase,
      );
      await expect(usecase.execute()).rejects.toThrow(
        'maintenance_unavailable',
      );
      expect(expiry.execute).toHaveBeenCalledTimes(1);
      expect(cleanup.execute).toHaveBeenCalledTimes(1);
      expect(secure.execute).toHaveBeenCalledTimes(1);
    },
  );
});
