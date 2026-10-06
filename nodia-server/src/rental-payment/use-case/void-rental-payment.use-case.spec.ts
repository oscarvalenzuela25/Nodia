import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VoidRentalPaymentUseCase } from './void-rental-payment.use-case.js';
import { RentalPaymentService } from '../rental-payment.service.js';
import { RentalPayment } from '../entities/rental-payment.entity.js';
import { RentalReservation } from '../../rental-reservation/entities/rental-reservation.entity.js';
import { RentalAuditEvent } from '../../rental-audit/entities/rental-audit-event.entity.js';
import {
  rentalTestFixture,
  rentalKey,
  secondRentalKey,
} from './rental-test-fixture.js';

describe('VoidRentalPaymentUseCase', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-04T16:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());
  function fixture(status = 'confirmed', type = 'payment') {
    const f = rentalTestFixture();
    Object.assign(f.table(RentalReservation)[0], {
      status,
      refund_amount: status === 'cancelled' ? '20000' : null,
    });
    f.seed(RentalPayment, {
      id: '50',
      property_id: '10',
      reservation_id: '40',
      type,
      amount: '40000',
      status: 'confirmed',
      updated_at: new Date(),
    });
    return {
      ...f,
      useCase: new VoidRentalPaymentUseCase(f.tx, new RentalPaymentService()),
    };
  }
  it('does not undermine the received deposit of a confirmed direct booking', async () => {
    const f = fixture();
    await expect(
      f.useCase.execute('1', '10', '50', { reason: 'Wrong entry' }, rentalKey),
    ).rejects.toThrow('rental:deposit_required');
    expect(f.table(RentalPayment)[0].status).toBe('confirmed');
  });
  it('can void a mistaken draft payment but preserves the frozen agreement and audit', async () => {
    const f = fixture('draft');
    const result = await f.useCase.execute(
      '1',
      '10',
      '50',
      { reason: 'Wrong entry' },
      rentalKey,
    );
    expect(result.status).toBe('voided');
    expect(f.table(RentalAuditEvent)[0].changes).toMatchObject({
      reason: 'Wrong entry',
    });
    expect(
      await f.useCase.execute(
        '1',
        '10',
        '50',
        { reason: 'Wrong entry' },
        rentalKey,
      ),
    ).toEqual(result);
    await expect(
      f.useCase.execute(
        '1',
        '10',
        '50',
        { reason: 'Wrong entry' },
        secondRentalKey,
      ),
    ).rejects.toThrow('rental:invalid_transition');
  });
  it('cannot void a received payment after cancellation, but can correct a refund', async () => {
    const paid = fixture('cancelled');
    await expect(
      paid.useCase.execute(
        '1',
        '10',
        '50',
        { reason: 'Wrong entry' },
        rentalKey,
      ),
    ).rejects.toThrow('rental:invalid_transition');
    const refunded = fixture('cancelled', 'refund');
    await refunded.useCase.execute(
      '1',
      '10',
      '50',
      { reason: 'Wrong refund' },
      rentalKey,
    );
    expect(refunded.table(RentalReservation)[0].refund_amount).toBe('20000');
    expect(refunded.table(RentalPayment)[0].status).toBe('voided');
  });
});
