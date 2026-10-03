import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ManageGeminiLoginUseCase } from './manage-gemini-login.use-case.js';
import type { GeminiService } from '../../common/ai/gemini.service.js';

describe('ManageGeminiLoginUseCase', () => {
  const originalEnvironment = process.env.NODE_ENV;
  const job = { id: 'a'.repeat(32), state: 'running' as const };
  const geminiService = {
    startInteractiveLogin: vi.fn().mockResolvedValue(job),
    getInteractiveLoginStatus: vi.fn().mockResolvedValue(job),
    cancelInteractiveLogin: vi.fn().mockResolvedValue({ ...job, state: 'cancelled' }),
  };
  const useCase = new ManageGeminiLoginUseCase(
    geminiService as unknown as GeminiService,
  );

  beforeEach(() => {
    process.env.NODE_ENV = 'development';
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnvironment;
  });

  it('starts and observes a local login through the Gemini adapter', async () => {
    await expect(useCase.start('7')).resolves.toEqual(job);
    await expect(useCase.status(job.id)).resolves.toEqual(job);
    await expect(useCase.cancel(job.id, '7')).resolves.toMatchObject({
      state: 'cancelled',
    });
    expect(geminiService.startInteractiveLogin).toHaveBeenCalledOnce();
    expect(geminiService.getInteractiveLoginStatus).toHaveBeenCalledWith(job.id);
    expect(geminiService.cancelInteractiveLogin).toHaveBeenCalledWith(job.id);
  });

  it('does not make the local browser endpoint available in production', async () => {
    process.env.NODE_ENV = 'production';
    await expect(useCase.start('7')).rejects.toMatchObject({ status: 404 });
    expect(geminiService.startInteractiveLogin).not.toHaveBeenCalled();
  });

  it('rejects malformed job identifiers before calling Gemini', async () => {
    expect(() => useCase.status('../models')).toThrow();
    expect(geminiService.getInteractiveLoginStatus).not.toHaveBeenCalled();
  });
});
