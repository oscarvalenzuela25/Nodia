import { describe, expect, it, vi } from 'vitest';
import { CreateFinanceObligationUseCase } from './create-finance-obligation.use-case.js';
import { UpdateFinanceObligationUseCase } from './update-finance-obligation.use-case.js';
import { GetFinanceObligationByIdUseCase } from './get-finance-obligation-by-id.use-case.js';
import { CreateFinanceMovementUseCase } from '../../finance-movement/use-case/create-finance-movement.use-case.js';
import { UpdateFinanceMovementUseCase } from '../../finance-movement/use-case/update-finance-movement.use-case.js';
import { GetFinanceMovementByIdUseCase } from '../../finance-movement/use-case/get-finance-movement-by-id.use-case.js';
import type { FinanceObligationService } from '../finance-obligation.service.js';
import { ledgerFixture } from './finance-ledger.fixtures.js';
import { UpdateFinanceMovementDto } from '../../finance-movement/dto/update-finance-movement.dto.js';
import { UpdateFinanceObligationDto } from '../dto/update-finance-obligation.dto.js';
import type { EntityManager } from 'typeorm';

const obligationDto = {
  name: 'Loan',
  key: 'loan',
  type: 'loan' as const,
  amount: '100000',
  category_id: '2',
};
const paymentDto = {
  name: 'Payment',
  type: 'income' as const,
  status: 'received' as const,
  amount: '20000',
  category_id: '2',
  obligation_id: '3',
};

describe('Personal finance ledger use cases', () => {
  it('preserves omitted fields from an actual partial movement DTO instance', async () => {
    const f = ledgerFixture();
    const dto = new UpdateFinanceMovementDto();
    dto.is_active = false;
    const result = await new UpdateFinanceMovementUseCase(
      f.ledgerService,
      f.movementService,
    ).execute('1', '5', dto);
    expect(result.is_active).toBe(false);
    expect(result.amount).toBe('20000');
    expect(result.type).toBe('income');
    expect(result.status).toBe('received');
    expect(result.name).toBe('Payment');
  });

  it('preserves omitted fields from an actual partial obligation DTO instance', async () => {
    const f = ledgerFixture();
    const dto = new UpdateFinanceObligationDto();
    dto.amount = '120000';
    const result = await new UpdateFinanceObligationUseCase(
      f.ledgerService,
    ).execute('1', '3', dto);
    expect(result.amount).toBe('120000');
    expect(result.type).toBe('loan');
    expect(result.name).toBe('Loan');
    expect(result.key).toBe('loan');
    expect(result.description).toBeNull();
    expect(result.is_active).toBe(true);
  });

  it('allows changing ordinary confirmed income to confirmed expense with a compatible final state', async () => {
    const f = ledgerFixture();
    f.payment.obligation_id = null;
    f.payment.obligation = null;
    const result = await new UpdateFinanceMovementUseCase(
      f.ledgerService,
      f.movementService,
    ).execute('1', '5', { type: 'expense', status: 'paid' });
    expect(result.type).toBe('expense');
    expect(result.status).toBe('paid');
  });
  it.each(['loan', 'debt'] as const)(
    'creates %s with one confirmed initial movement and unchanged principal',
    async (type) => {
      const f = ledgerFixture();
      const result = await new CreateFinanceObligationUseCase(
        f.ledgerService,
      ).execute('1', { ...obligationDto, type });
      expect(result.amount).toBe('100000');
      expect(result.remaining_amount).toBe('100000');
      expect(result.initial_movement.type).toBe(
        type === 'loan' ? 'expense' : 'income',
      );
      expect(result.initial_movement.status).toBe(
        type === 'loan' ? 'paid' : 'received',
      );
      expect(f.ledger.saveMovement).toHaveBeenCalledTimes(1);
      expect(f.ledger.saveObligation.mock.calls[0][0]).toBe(f.manager);
      expect(f.ledger.saveMovement.mock.calls[0][0]).toBe(f.manager);
    },
  );

  it('propagates initial movement persistence failure instead of reporting a created obligation', async () => {
    const f = ledgerFixture();
    f.ledger.saveMovement.mockRejectedValueOnce(
      new Error('synthetic write failure'),
    );
    await expect(
      new CreateFinanceObligationUseCase(f.ledgerService).execute(
        '1',
        obligationDto,
      ),
    ).rejects.toThrow('synthetic write failure');
  });

  it.each(['foreign', 'inactive'] as const)(
    'rejects %s category before creating obligation',
    async (kind) => {
      const f = ledgerFixture();
      if (kind === 'inactive') f.category.is_active = false;
      await expect(
        new CreateFinanceObligationUseCase(f.ledgerService).execute(
          kind === 'foreign' ? '9' : '1',
          obligationDto,
        ),
      ).rejects.toThrow(
        kind === 'foreign' ? 'finance:not_found' : 'finance:inactive_category',
      );
      expect(f.ledger.saveObligation).not.toHaveBeenCalled();
    },
  );

  it('preserves exact bigint amounts above JavaScript safe integer', async () => {
    const f = ledgerFixture();
    const result = await new CreateFinanceObligationUseCase(
      f.ledgerService,
    ).execute('1', { ...obligationDto, amount: '9223372036854775807' });
    expect(result.amount).toBe('9223372036854775807');
    expect(result.remaining_amount).toBe('9223372036854775807');
  });

  it('allows regular movements without an obligation and never looks up an obligation', async () => {
    const f = ledgerFixture();
    const result = await new CreateFinanceMovementUseCase(
      f.ledgerService,
      f.movementService,
    ).execute('1', { ...paymentDto, obligation_id: null });
    expect(result.obligation).toBeNull();
    expect(f.ledger.obligation).not.toHaveBeenCalled();
    expect(f.ledger.confirmedPaid).not.toHaveBeenCalled();
  });

  it.each([
    ['income', 'paid'],
    ['expense', 'received'],
  ] as const)('rejects incompatible %s/%s', async (type, status) => {
    const f = ledgerFixture();
    await expect(
      new CreateFinanceMovementUseCase(
        f.ledgerService,
        f.movementService,
      ).execute('1', { ...paymentDto, type, status }),
    ).rejects.toThrow('finance:invalid_movement_state');
    expect(f.ledger.transaction).not.toHaveBeenCalled();
  });

  it('rejects second initial disbursement through movement create', async () => {
    const f = ledgerFixture();
    await expect(
      new CreateFinanceMovementUseCase(
        f.ledgerService,
        f.movementService,
      ).execute('1', { ...paymentDto, type: 'expense', status: 'paid' }),
    ).rejects.toThrow('finance:invalid_repayment_direction');
    expect(f.ledger.saveMovement).not.toHaveBeenCalled();
  });

  it.each(['inactive', 'cancelled', 'foreign'] as const)(
    'rejects payment on %s obligation',
    async (kind) => {
      const f = ledgerFixture();
      if (kind === 'inactive') f.obligation.is_active = false;
      if (kind === 'cancelled') f.origin.status = 'cancelled';
      await expect(
        new CreateFinanceMovementUseCase(
          f.ledgerService,
          f.movementService,
        ).execute(kind === 'foreign' ? '9' : '1', paymentDto),
      ).rejects.toThrow(
        kind === 'foreign'
          ? 'finance:not_found'
          : kind === 'inactive'
            ? 'finance:inactive_obligation'
            : 'finance:cancelled_obligation',
      );
      expect(f.ledger.saveMovement).not.toHaveBeenCalled();
    },
  );

  it('rejects overpayment including confirmed archived payments', async () => {
    const f = ledgerFixture();
    f.payment.is_active = false;
    await expect(
      new CreateFinanceMovementUseCase(
        f.ledgerService,
        f.movementService,
      ).execute('1', { ...paymentDto, amount: '80001' }),
    ).rejects.toThrow('finance:overpayment');
    expect(f.ledger.saveMovement).not.toHaveBeenCalled();
  });

  it('accepts exact remaining principal and leaves initial amount untouched', async () => {
    const f = ledgerFixture();
    await new CreateFinanceMovementUseCase(
      f.ledgerService,
      f.movementService,
    ).execute('1', { ...paymentDto, amount: '80000' });
    expect(f.origin.amount).toBe('100000');
    expect(f.ledger.saveObligation).not.toHaveBeenCalled();
  });

  it('pending repayments do not reserve balance or require payment amount within current principal', async () => {
    const f = ledgerFixture();
    await new CreateFinanceMovementUseCase(
      f.ledgerService,
      f.movementService,
    ).execute('1', { ...paymentDto, status: 'pending', amount: '100001' });
    expect(f.ledger.saveMovement).toHaveBeenCalledTimes(1);
  });

  it('rejects confirming a pending amount above remaining balance', async () => {
    const f = ledgerFixture();
    f.payment.status = 'pending';
    f.payment.amount = '100001';
    await expect(
      new UpdateFinanceMovementUseCase(
        f.ledgerService,
        f.movementService,
      ).execute('1', '5', { status: 'received' }),
    ).rejects.toThrow('finance:overpayment');
  });

  it('locks obligation before movement and sums after both locks', async () => {
    const f = ledgerFixture();
    await new UpdateFinanceMovementUseCase(
      f.ledgerService,
      f.movementService,
    ).execute('1', '5', { amount: '40000' });
    expect(f.calls).toEqual([
      'movement-read',
      'obligation',
      'movement-lock',
      'sum',
    ]);
    expect(f.records.get('5')?.amount).toBe('40000');
  });

  it('archiving a repayment retains its confirmed balance contribution', async () => {
    const f = ledgerFixture();
    await new UpdateFinanceMovementUseCase(
      f.ledgerService,
      f.movementService,
    ).execute('1', '5', { is_active: false });
    const result = await new UpdateFinanceObligationUseCase(
      f.ledgerService,
    ).execute('1', '3', { name: 'Archived payment remains valid' });
    expect(result.remaining_amount).toBe('80000');
    expect(result.paid_amount).toBe('20000');
  });

  it('cancelling a repayment removes it from balance without an inverse movement', async () => {
    const f = ledgerFixture();
    await new UpdateFinanceMovementUseCase(
      f.ledgerService,
      f.movementService,
    ).execute('1', '5', { status: 'cancelled' });
    const result = await new UpdateFinanceObligationUseCase(
      f.ledgerService,
    ).execute('1', '3', { name: 'Cancellation' });
    expect(result.remaining_amount).toBe('100000');
    expect(f.records.size).toBe(2);
  });

  it.each(['pending', 'received'] as const)(
    'cannot revive a cancelled movement as %s',
    async (status) => {
      const f = ledgerFixture();
      f.payment.status = 'cancelled';
      await expect(
        new UpdateFinanceMovementUseCase(
          f.ledgerService,
          f.movementService,
        ).execute('1', '5', { status }),
      ).rejects.toThrow('finance:invalid_status_transition');
    },
  );

  it('cannot return a confirmed movement to pending', async () => {
    const f = ledgerFixture();
    await expect(
      new UpdateFinanceMovementUseCase(
        f.ledgerService,
        f.movementService,
      ).execute('1', '5', { status: 'pending' }),
    ).rejects.toThrow('finance:invalid_status_transition');
  });

  it('cannot edit linked repayment direction', async () => {
    const f = ledgerFixture();
    f.payment.status = 'pending';
    await expect(
      new UpdateFinanceMovementUseCase(
        f.ledgerService,
        f.movementService,
      ).execute('1', '5', { type: 'expense' }),
    ).rejects.toThrow('finance:immutable_linked_direction');
  });

  it('cannot edit initial amount directly on the movement endpoint', async () => {
    const f = ledgerFixture();
    await expect(
      new UpdateFinanceMovementUseCase(
        f.ledgerService,
        f.movementService,
      ).execute('1', '4', { amount: '200000' }),
    ).rejects.toThrow('finance:edit_principal_on_obligation');
  });

  it('blocks cancellation of initial movement when confirmed repayments exist', async () => {
    const f = ledgerFixture();
    await expect(
      new UpdateFinanceMovementUseCase(
        f.ledgerService,
        f.movementService,
      ).execute('1', '4', { status: 'cancelled' }),
    ).rejects.toThrow('finance:initial_has_payments');
  });

  it('allows initial cancellation with pending repayments and reports null remaining amount', async () => {
    const f = ledgerFixture();
    f.payment.status = 'pending';
    await new UpdateFinanceMovementUseCase(
      f.ledgerService,
      f.movementService,
    ).execute('1', '4', { status: 'cancelled' });
    const result = await new UpdateFinanceObligationUseCase(
      f.ledgerService,
    ).execute('1', '3', { name: 'Cancelled' });
    expect(result.remaining_amount).toBeNull();
    await expect(
      new UpdateFinanceMovementUseCase(
        f.ledgerService,
        f.movementService,
      ).execute('1', '5', { status: 'received' }),
    ).rejects.toThrow('finance:cancelled_obligation');
  });

  it('allows metadata edits against historical inactive category and obligation', async () => {
    const f = ledgerFixture();
    f.category.is_active = false;
    f.obligation.is_active = false;
    const result = await new UpdateFinanceMovementUseCase(
      f.ledgerService,
      f.movementService,
    ).execute('1', '5', { name: 'Corrected name' });
    expect(result.name).toBe('Corrected name');
    expect(f.ledger.category).not.toHaveBeenCalled();
  });

  it('rejects replacing a category with a foreign category without writes', async () => {
    const f = ledgerFixture();
    await expect(
      new UpdateFinanceMovementUseCase(
        f.ledgerService,
        f.movementService,
      ).execute('1', '5', { category_id: '9' }),
    ).rejects.toThrow('finance:not_found');
    expect(f.ledger.saveMovement).not.toHaveBeenCalled();
  });

  it('updates principal and initial movement amount atomically without decrementing principal', async () => {
    const f = ledgerFixture();
    const result = await new UpdateFinanceObligationUseCase(
      f.ledgerService,
    ).execute('1', '3', { amount: '120000' });
    expect(result.amount).toBe('120000');
    expect(result.initial_movement.amount).toBe('120000');
    expect(result.remaining_amount).toBe('100000');
    expect(f.ledger.saveMovement.mock.calls[0][0]).toBe(
      f.ledger.saveObligation.mock.calls[0][0],
    );
  });

  it('rejects decreasing principal below confirmed archived repayments', async () => {
    const f = ledgerFixture();
    f.payment.is_active = false;
    await expect(
      new UpdateFinanceObligationUseCase(f.ledgerService).execute('1', '3', {
        amount: '19999',
      }),
    ).rejects.toThrow('finance:principal_below_payments');
    expect(f.ledger.saveObligation).not.toHaveBeenCalled();
    expect(f.ledger.saveMovement).not.toHaveBeenCalled();
  });

  it('allows principal to equal total confirmed repayments', async () => {
    const f = ledgerFixture();
    const result = await new UpdateFinanceObligationUseCase(
      f.ledgerService,
    ).execute('1', '3', { amount: '20000' });
    expect(result.remaining_amount).toBe('0');
  });

  it('foreign owners cannot update movements or obligations', async () => {
    const f = ledgerFixture();
    await expect(
      new UpdateFinanceMovementUseCase(
        f.ledgerService,
        f.movementService,
      ).execute('9', '5', { name: 'Hijacked' }),
    ).rejects.toThrow('finance:not_found');
    await expect(
      new UpdateFinanceObligationUseCase(f.ledgerService).execute('9', '3', {
        name: 'Hijacked',
      }),
    ).rejects.toThrow('finance:not_found');
    expect(f.ledger.saveMovement).not.toHaveBeenCalled();
    expect(f.ledger.saveObligation).not.toHaveBeenCalled();
  });

  it('foreign movement lookup returns uniform not found', async () => {
    const f = ledgerFixture();
    await expect(
      new GetFinanceMovementByIdUseCase(f.movementService).execute('9', '5'),
    ).rejects.toThrow('finance:not_found');
  });

  it('foreign obligation lookup does not load repayment history', async () => {
    const service = {
      snapshot: vi.fn(async <T>(work: (manager: EntityManager) => Promise<T>) =>
        work({} as EntityManager),
      ),
      findOne: vi.fn().mockResolvedValue(null),
      settlement: vi.fn(),
    };
    await expect(
      new GetFinanceObligationByIdUseCase(
        service as unknown as FinanceObligationService,
      ).execute('9', '3'),
    ).rejects.toThrow('finance:not_found');
    expect(service.settlement).not.toHaveBeenCalled();
  });

  it('reads principal and settlement within the same snapshot manager', async () => {
    const f = ledgerFixture();
    const service = {
      snapshot: vi.fn(async <T>(work: (manager: EntityManager) => Promise<T>) =>
        work(f.manager),
      ),
      findOne: vi.fn().mockResolvedValue(f.obligation),
      settlement: vi
        .fn()
        .mockResolvedValue({
          initial: [f.origin],
          payments: [{ obligation_id: '3', amount: '40000' }],
        }),
    };
    const result = await new GetFinanceObligationByIdUseCase(
      service as unknown as FinanceObligationService,
    ).execute('1', '3');
    expect(result.remaining_amount).toBe('60000');
    expect(service.findOne).toHaveBeenCalledWith('1', '3', f.manager);
    expect(service.settlement).toHaveBeenCalledWith(
      '1',
      [f.obligation],
      f.manager,
    );
  });

  it('debt repayment uses expense/paid and cannot exceed unpaid principal', async () => {
    const f = ledgerFixture();
    f.obligation.type = 'debt';
    f.origin.type = 'income';
    f.origin.status = 'received';
    f.payment.type = 'expense';
    f.payment.status = 'paid';
    const dto = {
      ...paymentDto,
      type: 'expense' as const,
      status: 'paid' as const,
    };
    await expect(
      new CreateFinanceMovementUseCase(
        f.ledgerService,
        f.movementService,
      ).execute('1', { ...dto, amount: '80001' }),
    ).rejects.toThrow('finance:overpayment');
    const result = await new CreateFinanceMovementUseCase(
      f.ledgerService,
      f.movementService,
    ).execute('1', { ...dto, amount: '80000' });
    expect(result.type).toBe('expense');
    expect(result.status).toBe('paid');
  });

  it('projects only admitted fields and excludes user relations', async () => {
    const f = ledgerFixture();
    const result = await new GetFinanceMovementByIdUseCase(
      f.movementService,
    ).execute('1', '5');
    expect(result).not.toHaveProperty('user');
    expect(result.category).toEqual({
      id: '2',
      name: 'Personal',
      key: 'personal',
    });
    expect(result.obligation).toEqual({ id: '3', name: 'Loan', type: 'loan' });
  });
});
