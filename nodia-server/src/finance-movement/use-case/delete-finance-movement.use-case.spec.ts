import { describe, expect, it, vi } from 'vitest';
import { ledgerFixture } from '../../finance-obligation/use-case/finance-ledger.fixtures.js';
import { DeleteFinanceMovementUseCase } from './delete-finance-movement.use-case.js';

describe('Delete personal movement', () => {
  function fixture() {
    const f = ledgerFixture();
    f.ledgerService.deleteMovement = vi.fn(async (_tx, userId, id) => {
      if (f.records.get(id)?.user_id === userId) f.records.delete(id);
      return { affected: 1, raw: [] };
    });
    return { ...f, useCase: new DeleteFinanceMovementUseCase(f.ledgerService) };
  }
  it('removes an ordinary movement and its value from confirmed history', async () => {
    const f = fixture();
    f.payment.obligation_id = null;
    await f.useCase.execute('1', '5');
    expect(f.records.has('5')).toBe(false);
    expect(f.calls).toEqual(['movement-read', 'movement-lock']);
  });
  it('removes a repayment under the common lock order and recomputes paid from surviving history', async () => {
    const f = fixture();
    await f.useCase.execute('1', '5');
    expect(f.calls).toEqual(['movement-read', 'obligation', 'movement-lock']);
    expect(await f.ledger.confirmedPaid(f.manager, f.obligation)).toBe('0');
    expect(f.records.has('4')).toBe(true);
  });
  it.each(['loan', 'debt'] as const)(
    'protects the initial movement of a %s',
    async (type) => {
      const f = fixture();
      f.obligation.type = type;
      f.origin.type = type === 'loan' ? 'expense' : 'income';
      await expect(f.useCase.execute('1', '4')).rejects.toThrow(
        'finance:delete_initial_on_obligation',
      );
      expect(f.ledgerService.deleteMovement).not.toHaveBeenCalled();
    },
  );
  it('rejects another user without locking or deleting their obligation', async () => {
    const f = fixture();
    await expect(f.useCase.execute('2', '5')).rejects.toThrow(
      'finance:not_found',
    );
    expect(f.ledger.obligation).not.toHaveBeenCalled();
    expect(f.ledgerService.deleteMovement).not.toHaveBeenCalled();
  });
});
