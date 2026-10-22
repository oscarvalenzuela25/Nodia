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
    getInteractiveLoginFrame: vi.fn().mockResolvedValue({ ready: false, frame_id: null, image: null, width: 1280, height: 850 }),
    sendInteractiveLoginInput: vi.fn().mockResolvedValue(job),
    disconnectWebSession: vi.fn().mockResolvedValue({ status: 'disconnected' }),
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
    await expect(useCase.status(job.id, '7')).resolves.toEqual(job);
    await expect(useCase.cancel(job.id, '7')).resolves.toMatchObject({
      state: 'cancelled',
    });
    expect(geminiService.startInteractiveLogin).toHaveBeenCalledOnce();
    expect(geminiService.getInteractiveLoginStatus).toHaveBeenCalledWith(job.id, '7');
    expect(geminiService.cancelInteractiveLogin).toHaveBeenCalledWith(job.id, '7');
  });

  it('supports the authorized viewer in production through the private adapter', async () => {
    process.env.NODE_ENV = 'production';
    await expect(useCase.start('7')).resolves.toEqual(job);
    await expect(useCase.frame(job.id, '7')).resolves.toMatchObject({ ready: false });
    expect(geminiService.startInteractiveLogin).toHaveBeenCalledWith('7');
  });

  it('rejects malformed job identifiers before calling Gemini', async () => {
    expect(() => useCase.status('../models', '7')).toThrow();
    expect(geminiService.getInteractiveLoginStatus).not.toHaveBeenCalled();
  });

  it('blocks another administrator from observing, controlling or cancelling the job', async () => {
    await useCase.start('9007199254740993');
    for (const operation of [() => useCase.status(job.id, '9007199254740992'),
      () => useCase.frame(job.id, '9007199254740992'),
      () => useCase.input(job.id, '9007199254740992', { action: 'key', key: 'Enter', frame_id: job.id })]) {
      expect(operation).toThrow('La sesión de login Gemini no existe.');
    }
    await expect(useCase.cancel(job.id, '9007199254740992')).rejects.toMatchObject({ status: 404 });
    expect(geminiService.sendInteractiveLoginInput).not.toHaveBeenCalled();
    expect(geminiService.getInteractiveLoginFrame).not.toHaveBeenCalled();
  });

  it('forwards a bounded command and rejects mixed actions, browser shortcuts and invalid coordinates', async () => {
    await useCase.start('7');
    await expect(useCase.input(job.id, '7', { action: 'key', key: 'Tab', frame_id: job.id })).resolves.toEqual(job);
    expect(geminiService.sendInteractiveLoginInput).toHaveBeenCalledWith(job.id, '7', { action: 'key', key: 'Tab', frame_id: job.id });
    for (const command of [{ action: 'key' as const, key: 'Control+L' },
      { action: 'text' as const, text: 'x'.repeat(2049) },
      { action: 'click' as const, x: 1280, y: 0 }, { action: 'click' as const, x: 0, y: 0, text: 'mixed' },
      { action: 'scroll' as const, delta: NaN }]) {
      expect(() => useCase.input(job.id, '7', { ...command, frame_id: job.id })).toThrow('Comando de visor inválido.');
    }
  });

  it('expires access without issuing a private request', async () => {
    await useCase.start('7');
    const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 311_000);
    try { expect(() => useCase.frame(job.id, '7')).toThrow(); }
    finally { clock.mockRestore(); }
    expect(geminiService.getInteractiveLoginFrame).not.toHaveBeenCalled();
  });

  it('rejects noncanonical actor IDs before starting a browser', async () => {
    for (const actor of ['0', '07', '-1', '9223372036854775808', 'uuid']) {
      await expect(useCase.start(actor)).rejects.toMatchObject({ status: 400 });
    }
    expect(geminiService.startInteractiveLogin).not.toHaveBeenCalled();
  });

  it('validates the actor and invalidates the previous viewer only after successful Web disconnect', async () => {
    await useCase.start('7');
    await expect(useCase.disconnect('07')).rejects.toMatchObject({ status: 400 });
    expect(geminiService.disconnectWebSession).not.toHaveBeenCalled();
    geminiService.disconnectWebSession.mockRejectedValueOnce(new Error('unavailable'));
    await expect(useCase.disconnect('7')).rejects.toThrow('unavailable');
    await expect(useCase.status(job.id, '7')).resolves.toEqual(job);
    await expect(useCase.disconnect('7')).resolves.toEqual({ status: 'disconnected' });
    expect(() => useCase.status(job.id, '7')).toThrow();
    expect(geminiService.disconnectWebSession).toHaveBeenLastCalledWith('7');
  });
});
