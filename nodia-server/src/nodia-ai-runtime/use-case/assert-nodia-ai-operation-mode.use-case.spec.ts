import { describe, expect, it } from 'vitest';
import { AssertNodiaAiOperationModeUseCase } from './assert-nodia-ai-operation-mode.use-case.js';

describe('AssertNodiaAiOperationModeUseCase', () => {
  const gate = new AssertNodiaAiOperationModeUseCase();
  it('preserves normal startup for existing deployments without the setting', () => {
    expect(gate.execute({})).toBe('normal');
    expect(gate.execute({ NODIA_AI_OPERATION_MODE: 'normal' })).toBe('normal');
  });
  it('blocks both serving entrypoints while quarantined', () => {
    expect(() => gate.execute({ NODIA_AI_OPERATION_MODE: 'quarantine' }))
      .toThrow('nodia_ai:quarantine_blocks_startup');
  });
  it('requires explicit quarantine for the offline restore command', () => {
    expect(gate.execute({ NODIA_AI_OPERATION_MODE: 'quarantine' }, 'restore')).toBe('quarantine');
    expect(() => gate.execute({}, 'restore')).toThrow('nodia_ai:restore_requires_quarantine');
    expect(() => gate.execute({ NODIA_AI_OPERATION_MODE: 'normal' }, 'restore'))
      .toThrow('nodia_ai:restore_requires_quarantine');
  });
  it.each(['', 'NORMAL', ' quarantine', 'normal ', 'restore', 'false', null, false, 0, {}])(
    'rejects an invalid mode without including the value in the diagnostic: %j', (value) => {
      expect(() => gate.execute({ NODIA_AI_OPERATION_MODE: value }))
        .toThrow(/^nodia_ai:invalid_operation_mode$/);
    },
  );
});
