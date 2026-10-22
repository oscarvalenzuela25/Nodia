import { describe, expect, it, vi } from 'vitest';
import type { NodiaAiPreferenceService } from '../nodia-ai-preference.service.js';
import type { PrepareNodiaAiProposalUseCase } from '../../nodia-ai-proposal/use-case/prepare-nodia-ai-proposal.use-case.js';
import { PrepareNodiaAiPreferenceUseCase } from './prepare-nodia-ai-preference.use-case.js';
import { preferenceFixture } from './preference.fixture.js';
describe('human memory preparation boundary', () => {
  it('creates a proposal using the exact authenticated identity without persisting a preference', async () => {
    const f = preferenceFixture(),
      prepare = { execute: vi.fn(async () => ({ status: 'ready' })) },
      usecase = new PrepareNodiaAiPreferenceUseCase(
        f.store as unknown as NodiaAiPreferenceService,
        prepare as unknown as PrepareNodiaAiProposalUseCase,
      );
    await usecase.execute(f.identity, {
      conversation_id: f.context.conversationId,
      operation: 'create',
      ...f.create,
    });
    expect(prepare.execute).toHaveBeenCalledWith(f.manager, f.identity, {
      conversationId: f.context.conversationId,
      toolName: 'nodia_preferences_prepare_create',
      partial: f.create,
    });
    expect(f.rows).toHaveLength(0);
  });
  it.each([
    { owner_id: '2' },
    { expected_revision: 1 },
    { preference_id: '11111111-1111-4111-8111-111111111111' },
    { scope: undefined },
  ])(
    'rejects mixed operations and missing required values %j',
    async (delta) => {
      const f = preferenceFixture(),
        prepare = { execute: vi.fn() },
        usecase = new PrepareNodiaAiPreferenceUseCase(
          f.store as unknown as NodiaAiPreferenceService,
          prepare as unknown as PrepareNodiaAiProposalUseCase,
        );
      await expect(
        usecase.execute(f.identity, {
          conversation_id: f.context.conversationId,
          operation: 'create',
          ...f.create,
          ...delta,
        }),
      ).rejects.toThrow();
      expect(prepare.execute).not.toHaveBeenCalled();
    },
  );
});
