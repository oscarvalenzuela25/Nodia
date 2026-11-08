import { describe, expect, it, vi } from 'vitest';
import { ManageGeminiLoginUseCase } from './manage-gemini-login.use-case.js';

describe('retired Gemini Web login', () => {
  it.each([
    'start',
    'disconnect',
    'status',
    'cancel',
    'frame',
    'input',
  ] as const)(
    'rejects %s with 410 before any external operation',
    (operation) => {
      const boundary = {
        start: vi.fn(),
        disconnect: vi.fn(),
        status: vi.fn(),
        cancel: vi.fn(),
        frame: vi.fn(),
        input: vi.fn(),
      };
      const useCase = new ManageGeminiLoginUseCase(boundary);
      expect(() => useCase[operation]('synthetic')).toThrow(
        expect.objectContaining({
          status: 410,
          message: 'ai_provider:mode_retired',
        }),
      );
      for (const method of Object.values(boundary))
        expect(method).not.toHaveBeenCalled();
    },
  );
});
