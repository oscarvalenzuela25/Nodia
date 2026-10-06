import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { GetRentalOverviewUseCase } from './get-rental-overview.use-case.js';
import { RentalOverviewService } from '../rental-overview.service.js';
import { rentalTestFixture } from '../../rental-payment/use-case/rental-test-fixture.js';

describe('GetRentalOverviewUseCase', () => {
  function fixture() {
    const f = rentalTestFixture();
    const service = new RentalOverviewService();
    const aggregate = vi
      .spyOn(service, 'aggregate')
      .mockResolvedValue({
        received_amount: '194000',
        refunded_amount: '12000',
        paid_expenses_amount: '5000',
        reservation_balance_amount: '0',
        refund_amount: '8000',
        expense_amount: '1000',
        draft_received_amount: '40000',
        draft_count: '1',
        confirmed_reservations: '3',
        in_progress_reservations: '1',
        pending_turnovers: '2',
      });
    vi.spyOn(service, 'upcoming').mockResolvedValue([]);
    vi.spyOn(service, 'pendingTurnovers').mockResolvedValue([]);
    return {
      ...f,
      service,
      aggregate,
      useCase: new GetRentalOverviewUseCase(f.tx, service),
    };
  }
  it('separates actual net cash from approved refunds, pending bills and draft deposits', async () => {
    const f = fixture();
    const result = await f.useCase.execute('2', '10', {
      from_on: '2026-10-01',
      to_on: '2026-11-01',
    });
    expect(result.cash).toEqual({
      received_amount: '194000',
      refunded_amount: '12000',
      paid_expenses_amount: '5000',
      net_amount: '177000',
    });
    expect(result.pending).toEqual({
      reservation_balance_amount: '0',
      refund_amount: '8000',
      expense_amount: '1000',
      draft_received_amount: '40000',
    });
    expect(result.scope.pending_scope).toBe('all_current_property_records');
    expect(result.counts.confirmed_reservations).toBe(3);
    expect(result.upcoming_check_ins).toEqual([]);
  });
  it('preserves aggregate arithmetic even beyond a bigint row and supports negative cash', async () => {
    const f = fixture();
    f.aggregate.mockResolvedValue({
      received_amount: '18446744073709551614',
      refunded_amount: '18446744073709551615',
      paid_expenses_amount: '1',
      reservation_balance_amount: '18446744073709551614',
      refund_amount: '0',
      expense_amount: '0',
      draft_received_amount: '0',
      draft_count: '0',
      confirmed_reservations: '0',
      in_progress_reservations: '0',
      pending_turnovers: '0',
    });
    const result = await f.useCase.execute('1', '10', {
      from_on: '2026-10-01',
      to_on: '2026-11-01',
    });
    expect(result.cash.net_amount).toBe('-2');
    expect(result.pending.reservation_balance_amount).toBe(
      '18446744073709551614',
    );
  });
  it('never substitutes a failed aggregate with fabricated zeros', async () => {
    const f = fixture();
    f.aggregate.mockRejectedValue(new Error('Synthetic DB failure'));
    await expect(
      f.useCase.execute('1', '10', {
        from_on: '2026-10-01',
        to_on: '2026-11-01',
      }),
    ).rejects.toThrow('rental:server_error');
    await expect(
      f.useCase.execute('3', '10', {
        from_on: '2026-10-01',
        to_on: '2026-11-01',
      }),
    ).rejects.toThrow('rental:not_found');
  });
  it('bounds period and rejects unknown filters', async () => {
    const f = fixture();
    for (const query of [
      { from_on: '2026-10-01', to_on: '2026-10-01' },
      { from_on: '2026-01-01', to_on: '2028-01-01' },
      { from_on: '2026-10-01', to_on: '2026-11-01', all: true },
    ])
      await expect(f.useCase.execute('1', '10', query)).rejects.toThrow(
        'rental:invalid_input',
      );
    expect(f.aggregate).not.toHaveBeenCalled();
  });
});
