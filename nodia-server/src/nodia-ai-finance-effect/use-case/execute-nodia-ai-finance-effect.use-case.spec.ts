import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import type { NodiaAiFinanceOperation } from '../types/financial-operation.types.js';
import type {
  ProposalPreparerContext,
  StoredProposalStep,
} from '../../nodia-ai-proposal/types/proposal-preparer.types.js';
import type { ExecuteNodiaAiFinanceMovementEffectUseCase } from './execute-nodia-ai-finance-movement-effect.use-case.js';
import { ExecuteNodiaAiFinanceEffectUseCase } from './execute-nodia-ai-finance-effect.use-case.js';

function fixture() {
  const execute = vi
    .fn()
    .mockResolvedValue({ id: '9007199254740993', ownerId: '1' });
  const legacy = {
    execute: vi.fn().mockResolvedValue({ id: '2', ownerId: '1' }),
  };
  const operation = {
    toolName: 'nodia_finance_obligations_prepare_delete',
    resourceKey: 'finance_obligations',
    operation: 'delete',
    contractHash: 'a'.repeat(64),
    executeConfirmed: execute,
  } as unknown as NodiaAiFinanceOperation;
  const step = {
    toolName: operation.toolName,
    contractHash: operation.contractHash,
  } as StoredProposalStep;
  const context = {} as ProposalPreparerContext;
  const create = (ports = [operation]) =>
    new ExecuteNodiaAiFinanceEffectUseCase(
      legacy as unknown as ExecuteNodiaAiFinanceMovementEffectUseCase,
      ports,
    );
  return { execute, legacy, operation, step, context, create };
}

describe('NodiaAI frozen financial effect routing', () => {
  it('dispatches the exact registered native contract with the original transaction context', async () => {
    const f = fixture();
    await expect(f.create().execute(f.step, f.context)).resolves.toEqual({
      id: '9007199254740993',
      ownerId: '1',
    });
    expect(f.execute).toHaveBeenCalledWith(f.step, f.context);
    expect(f.legacy.execute).not.toHaveBeenCalled();
  });
  it.each(['unknown', 'contract_changed'])(
    'refuses %s before invoking a domain writer',
    async (variant) => {
      const f = fixture();
      if (variant === 'unknown') f.step.toolName = 'nodia_users_prepare_delete';
      else f.step.contractHash = 'b'.repeat(64);
      await expect(f.create().execute(f.step, f.context)).rejects.toThrow(
        'nodia_ai:catalog_changed',
      );
      expect(f.execute).not.toHaveBeenCalled();
      expect(f.legacy.execute).not.toHaveBeenCalled();
    },
  );
  it.each([
    'duplicate',
    'wrong_resource',
    'wrong_operation',
    'legacy_override',
    'unknown_tool',
  ])('refuses invalid code registration: %s', (variant) => {
    const f = fixture();
    const port = { ...f.operation };
    if (variant === 'wrong_resource')
      Object.assign(port, { resourceKey: 'finance_movements' });
    if (variant === 'wrong_operation')
      Object.assign(port, { operation: 'create' });
    if (variant === 'legacy_override')
      Object.assign(port, {
        toolName: 'nodia_finance_movements_prepare_create',
        resourceKey: 'finance_movements',
        operation: 'create',
      });
    if (variant === 'unknown_tool')
      Object.assign(port, { toolName: 'nodia_unknown_prepare_delete' });
    expect(() =>
      f.create(variant === 'duplicate' ? [port, port] : [port]),
    ).toThrow('nodia_ai:invalid_financial_operation');
    expect(f.execute).not.toHaveBeenCalled();
  });
  it('preserves the legacy AI-19 effect path and its historical witness', async () => {
    const f = fixture();
    f.step.toolName = 'nodia_finance_movements_prepare_create';
    await f.create().execute(f.step, f.context);
    expect(f.legacy.execute).toHaveBeenCalledWith(f.step, f.context);
    expect(f.execute).not.toHaveBeenCalled();
  });
});
