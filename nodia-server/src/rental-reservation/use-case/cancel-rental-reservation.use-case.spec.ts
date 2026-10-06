import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { CancelRentalReservationUseCase } from './cancel-rental-reservation.use-case.js';
import { PreviewRentalCancellationUseCase } from './preview-rental-cancellation.use-case.js';
import { RentalReservationService } from '../rental-reservation.service.js';
import { bookingFixture } from './rental-booking.fixture.js';
import { capturePolicySnapshot } from '../../rental-common/rental-money.js';
const key = '10000000-0000-4000-8000-000000000001';
async function funded() {
  const f = bookingFixture();
  f.ctx.now = new Date('2026-10-10T15:00:00Z');
  f.rows('RentalPayment').push({
    id: '50',
    property_id: '1',
    reservation_id: '10',
    type: 'payment',
    status: 'confirmed',
    amount: '10001',
    occurred_on: '2026-10-05',
  });
  f.reservation.policy_snapshot = await capturePolicySnapshot(
    f.ctx,
    f.reservation,
  );
  return f;
}
describe('Cancellation resolution through actual preview/cancel rules', () => {
  it('uses calendar anticipation and floors fractional CLP from actual receipts', async () => {
    const f = await funded();
    const preview = await new PreviewRentalCancellationUseCase(
      f.transactions,
      new RentalReservationService(),
    ).execute('1', '1', '10', { cancelled_at: '2026-10-10T13:00:00Z' });
    expect(preview.refund_amount).toBe('3333');
    expect(preview.cancellation_snapshot).toMatchObject({
      kind: 'direct',
      days_before: 10,
      received_amount: '10001',
      selected_rule: { min_days_before: 7, refund_percent: '33.33' },
      retained_amount: '6668',
      payment_count: 1,
    });
    const hash = createHash('sha256')
      .update(
        JSON.stringify([
          { amount: '10001', id: '50', occurred_on: '2026-10-05' },
        ]),
      )
      .digest('hex');
    expect(preview.cancellation_snapshot.payment_ledger_sha256).toBe(hash);
    expect(f.effects).toHaveLength(0);
    expect(f.reservation.status).toBe('draft');
    expect(f.reservation.cancellation_snapshot).toBeNull();
  });
  it('excludes voided records and other houses from the frozen cancellation base', async () => {
    const f = await funded();
    f.rows('RentalPayment').push(
      {
        id: '51',
        property_id: '1',
        reservation_id: '10',
        type: 'payment',
        status: 'voided',
        amount: '20000',
        occurred_on: '2026-10-05',
      },
      {
        id: '52',
        property_id: '2',
        reservation_id: '10',
        type: 'payment',
        status: 'confirmed',
        amount: '20000',
        occurred_on: '2026-10-05',
      },
    );
    const preview = await new PreviewRentalCancellationUseCase(
      f.transactions,
      new RentalReservationService(),
    ).execute('1', '1', '10', { cancelled_at: '2026-10-10T13:00:00Z' });
    expect(preview.refund_amount).toBe('3333');
    expect(preview.cancellation_snapshot.payment_count).toBe(1);
  });
  it('preserves original rules after current policy changes', async () => {
    const f = await funded();
    f.rows('RentalCancellationRule')[1].refund_percent = '100.00';
    const preview = await new PreviewRentalCancellationUseCase(
      f.transactions,
      new RentalReservationService(),
    ).execute('1', '1', '10', { cancelled_at: '2026-10-10T13:00:00Z' });
    expect(preview.refund_amount).toBe('3333');
  });
  it('no unpaid balance is collected after cancel and no refund row is invented', async () => {
    const f = await funded();
    f.property.is_active = false;
    const result = await new CancelRentalReservationUseCase(
      f.transactions,
      new RentalReservationService(),
    ).execute(
      '1',
      '1',
      '10',
      { cancelled_at: '2026-10-10T13:00:00Z', expected_refund_amount: '3333' },
      key,
    );
    expect(result.status).toBe('cancelled');
    expect(f.rows('RentalReservation')[0]).toMatchObject({
      total_amount: '100000',
      refund_amount: '3333',
      status: 'cancelled',
    });
    expect(f.rows('RentalPayment')).toHaveLength(1);
  });
  it('requires preview review again if receipts change the refund', async () => {
    const f = await funded();
    f.rows('RentalPayment').push({
      id: '51',
      property_id: '1',
      reservation_id: '10',
      type: 'payment',
      status: 'confirmed',
      amount: '9999',
      occurred_on: '2026-10-05',
    });
    await expect(
      new CancelRentalReservationUseCase(
        f.transactions,
        new RentalReservationService(),
      ).execute(
        '1',
        '1',
        '10',
        {
          cancelled_at: '2026-10-10T13:00:00Z',
          expected_refund_amount: '3333',
        },
        key,
      ),
    ).rejects.toThrow('rental:cancellation_changed');
    expect(f.effects).toHaveLength(0);
    expect(f.reservation.status).toBe('draft');
  });
  it('unpaid draft cancels with explicit zero and no artificial policy', async () => {
    const f = bookingFixture();
    f.reservation.cancellation_policy_id = null;
    const preview = await new PreviewRentalCancellationUseCase(
      f.transactions,
      new RentalReservationService(),
    ).execute('1', '1', '10', { cancelled_at: f.now.toISOString() });
    expect(preview.cancellation_snapshot).toMatchObject({
      kind: 'unpaid_draft',
      reason: 'no_received_payment',
      received_amount: '0',
      refund_amount: '0',
    });
    expect(preview.cancellation_snapshot).not.toHaveProperty(
      'payment_ledger_sha256',
    );
  });
  it('counts local midnight boundaries, not completed 24-hour blocks', async () => {
    const f = await funded();
    f.reservation.check_in_on = '2026-10-11';
    f.ctx.now = new Date('2026-10-11T12:00:00Z');
    const preview = await new PreviewRentalCancellationUseCase(
      f.transactions,
      new RentalReservationService(),
    ).execute('1', '1', '10', { cancelled_at: '2026-10-11T02:59:00Z' });
    expect(preview.cancellation_snapshot).toMatchObject({
      days_before: 1,
      cancellation_local_on: '2026-10-10',
    });
  });
  it('same-day notice before checkin uses the explicit zero-day rule', async () => {
    const f = await funded();
    f.ctx.now = new Date('2026-10-20T17:00:00Z');
    const preview = await new PreviewRentalCancellationUseCase(
      f.transactions,
      new RentalReservationService(),
    ).execute('1', '1', '10', { cancelled_at: '2026-10-20T16:59:00Z' });
    expect(preview.cancellation_snapshot.days_before).toBe(0);
    expect(preview.refund_amount).toBe('0');
  });
  it.each(['2026-10-10T16:00:00Z', '2026-10-20T18:00:00Z'])(
    'rejects future or arrival-time cancellation %s',
    async (cancelled_at) => {
      const f = await funded();
      await expect(
        new PreviewRentalCancellationUseCase(
          f.transactions,
          new RentalReservationService(),
        ).execute('1', '1', '10', { cancelled_at }),
      ).rejects.toThrow('rental:invalid_cancellation_time');
    },
  );
  it('rejects no-show or early-departure use of the cancellation calculator', async () => {
    const f = await funded();
    f.ctx.now = new Date('2026-10-21T12:00:00Z');
    await expect(
      new PreviewRentalCancellationUseCase(
        f.transactions,
        new RentalReservationService(),
      ).execute('1', '1', '10', { cancelled_at: '2026-10-20T18:00:00Z' }),
    ).rejects.toThrow('rental:invalid_cancellation_time');
    f.reservation.status = 'in_progress';
    await expect(
      new PreviewRentalCancellationUseCase(
        f.transactions,
        new RentalReservationService(),
      ).execute('1', '1', '10', { cancelled_at: '2026-10-10T13:00:00Z' }),
    ).rejects.toThrow('rental:invalid_transition');
  });
  it('direct cancellation rejects manually overridden refund and unknown snapshot keys', async () => {
    const f = await funded();
    await expect(
      new PreviewRentalCancellationUseCase(
        f.transactions,
        new RentalReservationService(),
      ).execute('1', '1', '10', {
        cancelled_at: '2026-10-10T13:00:00Z',
        refund_amount: '10001',
      }),
    ).rejects.toThrow('rental:invalid_input');
    Object.assign(f.reservation.policy_snapshot!, { extra: 'unauthorized' });
    await expect(
      new PreviewRentalCancellationUseCase(
        f.transactions,
        new RentalReservationService(),
      ).execute('1', '1', '10', { cancelled_at: '2026-10-10T13:00:00Z' }),
    ).rejects.toThrow('rental:invalid_input');
  });
  it('Airbnb requires explicit external refund resolution within net receipts', async () => {
    const f = await funded();
    Object.assign(f.reservation, {
      channel: 'airbnb',
      cancellation_policy_id: null,
      deposit_amount: '0',
      external_reference: 'AB-1',
      policy_snapshot: null,
    });
    f.reservation.policy_snapshot = await capturePolicySnapshot(
      f.ctx,
      f.reservation,
      { reference: 'COND-1', description: 'Acuerdo externo' },
    );
    const preview = new PreviewRentalCancellationUseCase(
      f.transactions,
      new RentalReservationService(),
    );
    await expect(
      preview.execute('1', '1', '10', { cancelled_at: '2026-10-10T13:00:00Z' }),
    ).rejects.toThrow('rental:invalid_refund');
    await expect(
      preview.execute('1', '1', '10', {
        cancelled_at: '2026-10-10T13:00:00Z',
        refund_amount: '10002',
        resolution_note: 'Externa',
      }),
    ).rejects.toThrow('rental:invalid_refund');
    const result = await preview.execute('1', '1', '10', {
      cancelled_at: '2026-10-10T13:00:00Z',
      refund_amount: '2500',
      resolution_note: 'Resolución de plataforma',
    });
    expect(result.refund_amount).toBe('2500');
    expect(result.cancellation_snapshot).toMatchObject({
      kind: 'platform',
      resolution: 'manual_external',
      resolution_note: 'Resolución de plataforma',
      retained_amount: '7501',
    });
  });
  it('does not recancel a cancellation with a new intention', async () => {
    const f = await funded();
    const usecase = new CancelRentalReservationUseCase(
      f.transactions,
      new RentalReservationService(),
    );
    const dto = {
      cancelled_at: '2026-10-10T13:00:00Z',
      expected_refund_amount: '3333',
    };
    await usecase.execute('1', '1', '10', dto, key);
    await expect(usecase.execute('1', '1', '10', dto, key)).rejects.toThrow(
      'rental:invalid_transition',
    );
  });
  it('cancellation recalculates the following guest and discards readiness for the former transition', async () => {
    const f = await funded();
    f.reservation.status = 'confirmed';
    f.rows('RentalReservation').push({
      ...f.reservation,
      id: '11',
      status: 'confirmed',
      check_in_on: '2026-10-22',
      check_out_on: '2026-10-24',
    });
    f.rows('RentalTurnover').push({
      ...f.turnover,
      id: '21',
      incoming_reservation_id: '11',
      previous_reservation_id: '10',
      linen_ready: true,
      planned_ready_at: new Date('2026-10-22T17:00:00Z'),
      same_day_approved_at: f.now,
      ready_at: f.now,
      cleaning_status: 'completed',
    });
    await new CancelRentalReservationUseCase(
      f.transactions,
      new RentalReservationService(),
    ).execute(
      '1',
      '1',
      '10',
      { cancelled_at: '2026-10-10T13:00:00Z', expected_refund_amount: '3333' },
      key,
    );
    expect(f.rows('RentalTurnover')[1]).toMatchObject({
      previous_reservation_id: null,
      same_day_approved_at: null,
      ready_at: null,
      cleaning_status: 'pending',
    });
  });
});
