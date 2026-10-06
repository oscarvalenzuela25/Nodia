import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CreateRentalExpenseUseCase } from './create-rental-expense.use-case.js';
import { UpdateRentalExpenseUseCase } from './update-rental-expense.use-case.js';
import { PayRentalExpenseUseCase } from './pay-rental-expense.use-case.js';
import { VoidRentalExpenseUseCase } from './void-rental-expense.use-case.js';
import { RentalExpenseService } from '../rental-expense.service.js';
import { RentalExpense } from '../entities/rental-expense.entity.js';
import { RentalAuditEvent } from '../../rental-audit/entities/rental-audit-event.entity.js';
import { RentalOperation } from '../../rental-operation/entities/rental-operation.entity.js';
import { RentalProperty } from '../../rental-property/entities/rental-property.entity.js';
import {
  rentalTestFixture,
  rentalKey,
  secondRentalKey,
} from '../../rental-payment/use-case/rental-test-fixture.js';

describe('Rental expense use cases', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-04T16:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());
  const draft = {
    name: 'Laundry',
    amount: '5000',
    incurred_on: '2026-10-02',
    status: 'pending' as const,
  };
  function fixture() {
    const f = rentalTestFixture();
    const service = new RentalExpenseService();
    return {
      ...f,
      create: new CreateRentalExpenseUseCase(f.tx, service),
      update: new UpdateRentalExpenseUseCase(f.tx, service),
      pay: new PayRentalExpenseUseCase(f.tx, service),
      void: new VoidRentalExpenseUseCase(f.tx, service),
    };
  }

  it('allows optional expenses without a booking, including an archived house', async () => {
    const f = fixture();
    f.table(RentalProperty)[0].is_active = false;
    const result = await f.create.execute(
      '2',
      '10',
      { ...draft, notes: '  ' },
      rentalKey,
    );
    expect(result.status).toBe('pending');
    expect(f.table(RentalExpense)[0]).toMatchObject({
      amount: '5000',
      paid_on: null,
      reservation_id: null,
      notes: null,
      created_by: '2',
    });
    expect(
      await f.create.execute(
        '2',
        '10',
        {
          ...draft,
          notes: null,
          category: null,
          reservation_id: null,
          paid_on: null,
        },
        rentalKey,
      ),
    ).toEqual(result);
    expect(f.table(RentalExpense)).toHaveLength(1);
  });

  it('validates dates and paid-state coherence without manufacturing a payment date', async () => {
    const f = fixture();
    for (const input of [
      { ...draft, status: 'paid' },
      { ...draft, paid_on: '2026-10-03' },
      { ...draft, incurred_on: '2026-10-05' },
      { ...draft, status: 'paid', paid_on: '2026-10-01' },
      { ...draft, status: 'paid', paid_on: '2026-10-05' },
      { ...draft, incurred_on: '2026-02-30' },
    ])
      await expect(
        f.create.execute('1', '10', input as typeof draft, rentalKey),
      ).rejects.toThrow('rental:invalid_input');
    expect(f.table(RentalExpense)).toHaveLength(0);
  });

  it('rejects unknown authority and a reservation from another scope', async () => {
    const f = fixture();
    await expect(f.create.execute('3', '10', draft, rentalKey)).rejects.toThrow(
      'rental:not_found',
    );
    await expect(
      f.create.execute(
        '1',
        '10',
        { ...draft, reservation_id: '99' },
        rentalKey,
      ),
    ).rejects.toThrow('rental:not_found');
    await expect(
      f.create.execute(
        '1',
        '10',
        { ...draft, updated_by: '3' } as typeof draft,
        rentalKey,
      ),
    ).rejects.toThrow('rental:invalid_input');
  });

  it('edits pending amounts, preserves omitted values and explicitly clears nullable information', async () => {
    const f = fixture();
    const result = await f.create.execute(
      '1',
      '10',
      { ...draft, category: 'Cleaning', notes: 'Original' },
      rentalKey,
    );
    await f.update.execute(
      '2',
      '10',
      result.resource_id,
      { amount: '9007199254740993', notes: null },
      secondRentalKey,
    );
    expect(f.table(RentalExpense)[0]).toMatchObject({
      amount: '9007199254740993',
      category: 'Cleaning',
      notes: null,
      updated_by: '2',
    });
    await expect(
      f.update.execute(
        '1',
        '10',
        result.resource_id,
        {},
        '33333333-3333-4333-8333-333333333333',
      ),
    ).rejects.toThrow('rental:invalid_input');
  });

  it('pays once, refuses money rewrites and preserves the original effective date in void audit', async () => {
    const f = fixture();
    const created = await f.create.execute('1', '10', draft, rentalKey);
    const paid = await f.pay.execute(
      '1',
      '10',
      created.resource_id,
      { paid_on: '2026-10-03' },
      secondRentalKey,
    );
    expect(
      await f.pay.execute(
        '1',
        '10',
        created.resource_id,
        { paid_on: '2026-10-03' },
        secondRentalKey,
      ),
    ).toEqual(paid);
    await expect(
      f.update.execute(
        '1',
        '10',
        created.resource_id,
        { amount: '6000' },
        '33333333-3333-4333-8333-333333333333',
      ),
    ).rejects.toThrow('rental:agreement_immutable');
    await f.void.execute(
      '1',
      '10',
      created.resource_id,
      { reason: 'Wrong date entry' },
      '44444444-4444-4444-8444-444444444444',
    );
    expect(f.table(RentalExpense)[0]).toMatchObject({
      status: 'voided',
      paid_on: null,
      amount: '5000',
    });
    expect(f.table(RentalAuditEvent)[2].changes).toMatchObject({
      paid_on: { before: '2026-10-03', after: null },
      reason: 'Wrong date entry',
    });
    await expect(
      f.pay.execute(
        '1',
        '10',
        created.resource_id,
        { paid_on: '2026-10-04' },
        '55555555-5555-4555-8555-555555555555',
      ),
    ).rejects.toThrow('rental:invalid_transition');
  });

  it('rolls back an expense when its operation response cannot be persisted', async () => {
    const f = fixture();
    f.failOn(RentalOperation);
    await expect(
      f.create.execute(
        '1',
        '10',
        { ...draft, status: 'paid', paid_on: '2026-10-03' },
        rentalKey,
      ),
    ).rejects.toThrow('rental:server_error');
    expect(f.table(RentalExpense)).toHaveLength(0);
    expect(f.table(RentalAuditEvent)).toHaveLength(0);
  });
});
