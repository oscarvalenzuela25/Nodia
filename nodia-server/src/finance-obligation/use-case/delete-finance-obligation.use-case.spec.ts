import { describe, expect, it, vi } from 'vitest';
import { ledgerFixture } from './finance-ledger.fixtures.js';
import { DeleteFinanceObligationUseCase } from './delete-finance-obligation.use-case.js';

describe('Delete personal obligation', () => {
  function fixture() {
    const f = ledgerFixture();
    f.ledgerService.hasRepayments = vi.fn(async () => f.records.has('5'));
    f.ledgerService.deleteMovement = vi.fn(async (_tx, _actor, id) => {
      f.records.delete(id);
      return { affected: 1, raw: [] };
    });
    f.ledgerService.deleteObligation = vi.fn(async () => ({
      affected: 1,
      raw: [],
    }));
    return {
      ...f,
      useCase: new DeleteFinanceObligationUseCase(f.ledgerService),
    };
  }
  it.each(['loan', 'debt'] as const)(
    'deletes a %s and its unique initial movement in one transaction',
    async (type) => {
      const f = fixture();
      f.obligation.type = type;
      f.records.delete('5');
      await f.useCase.execute('1', '3');
      expect(f.records.has('4')).toBe(false);
      expect(f.ledgerService.deleteObligation).toHaveBeenCalledWith(
        f.manager,
        '1',
        '3',
      );
      expect(f.ledgerService.deleteMovement).toHaveBeenCalledWith(
        f.manager,
        '1',
        '4',
      );
    },
  );
  it.each(['received', 'pending', 'cancelled'] as const)(
    'rejects an obligation with %s inactive repayment without deleting either record',
    async (status) => {
      const f = fixture();
      f.payment.status = status;
      f.payment.is_active = false;
      await expect(f.useCase.execute('1', '3')).rejects.toThrow(
        'finance:obligation_has_payments',
      );
      expect(f.records.size).toBe(2);
      expect(f.ledgerService.deleteObligation).not.toHaveBeenCalled();
    },
  );
  it('does not delete another principal’s obligation', async () => {
    const f = fixture();
    await expect(f.useCase.execute('2', '3')).rejects.toThrow(
      'finance:not_found',
    );
    expect(f.ledgerService.hasRepayments).not.toHaveBeenCalled();
  });
  it('refuses inconsistent historical initial movements', async () => {
    const f = fixture();
    f.records.delete('5');
    f.ledger.initialMovements.mockResolvedValue([]);
    await expect(f.useCase.execute('1', '3')).rejects.toThrow(
      'finance:invalid_initial_movement',
    );
    expect(f.ledgerService.deleteMovement).not.toHaveBeenCalled();
  });
});
