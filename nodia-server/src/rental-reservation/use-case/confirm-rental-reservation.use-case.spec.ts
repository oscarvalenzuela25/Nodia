import { describe, it, expect } from 'vitest';
import { ConfirmRentalReservationUseCase } from './confirm-rental-reservation.use-case.js';
import { CreateRentalReservationUseCase } from './create-rental-reservation.use-case.js';
import { UpdateRentalReservationUseCase } from './update-rental-reservation.use-case.js';
import { StartRentalReservationUseCase } from './start-rental-reservation.use-case.js';
import { CompleteRentalReservationUseCase } from './complete-rental-reservation.use-case.js';
import { RentalReservationService } from '../rental-reservation.service.js';
import { bookingFixture } from './rental-booking.fixture.js';
import { capturePolicySnapshot } from '../../rental-common/rental-money.js';
import { localInstant } from '../../rental-common/rental-time.js';
import type { RentalReservation } from '../entities/rental-reservation.entity.js';
const key = '10000000-0000-4000-8000-000000000001';
function paid(f: ReturnType<typeof bookingFixture>, amount = '20000') {
  f.rows('RentalPayment').push({
    id: '50',
    property_id: '1',
    reservation_id: '10',
    type: 'payment',
    status: 'confirmed',
    amount,
    occurred_on: '2026-10-05',
  });
}
function command(f: ReturnType<typeof bookingFixture>) {
  const r = f.reservation;
  return {
    guest_name: r.guest_name,
    guest_contact: r.guest_contact,
    guests_count: r.guests_count,
    channel: 'whatsapp' as const,
    check_in_on: r.check_in_on,
    check_out_on: r.check_out_on,
    check_in_time: r.check_in_time,
    check_out_time: r.check_out_time,
    nightly_rate: r.nightly_rate,
    deposit_amount: r.deposit_amount,
    cancellation_policy_id: r.cancellation_policy_id,
  };
}
describe('Booking lifecycle rules through real use cases', () => {
  it('creates only a draft and its nullable preparation without holding dates', async () => {
    const f = bookingFixture();
    const usecase = new CreateRentalReservationUseCase(
      f.transactions,
      new RentalReservationService(),
    );
    const result = await usecase.execute('1', '1', command(f), key);
    expect(result.status).toBe('draft');
    expect(f.rows('RentalTurnover')).toHaveLength(2);
    expect(f.rows('RentalTurnover')[1]).toMatchObject({
      linen_ready: null,
      cleaning_status: 'pending',
      same_day_approved_at: null,
    });
  });
  it.each([
    { nightly_rate: '0' },
    { nightly_rate: 50000 },
    { nightly_rate: '050000' },
    { deposit_amount: null },
    { check_out_on: '2026-02-30' },
    { check_in_time: '24:00' },
    { guests_count: 0 },
    { owner_id: '2' },
    { total_amount: '100' },
  ])('rejects invalid creation fields %j', async (patch) => {
    const f = bookingFixture();
    const usecase = new CreateRentalReservationUseCase(
      f.transactions,
      new RentalReservationService(),
    );
    await expect(
      usecase.execute('1', '1', { ...command(f), ...patch } as never, key),
    ).rejects.toThrow();
    expect(f.rows('RentalReservation')).toHaveLength(1);
  });
  it.each([
    { guests_count: 5 },
    { check_out_on: '2026-10-20' },
    { discount_amount: '100000' },
    { commission_amount: '100000' },
    { deposit_amount: '100001' },
    { check_out_on: '2027-10-22' },
    { deposit_due_at: '2026-10-21T00:00:00Z' },
  ])('rejects invalid agreement %j', async (patch) => {
    const f = bookingFixture();
    await expect(
      new CreateRentalReservationUseCase(
        f.transactions,
        new RentalReservationService(),
      ).execute('1', '1', { ...command(f), ...patch }, key),
    ).rejects.toThrow();
  });
  it('computes money above Number precision exactly', async () => {
    const f = bookingFixture();
    const result = await new CreateRentalReservationUseCase(
      f.transactions,
      new RentalReservationService(),
    ).execute(
      '1',
      '1',
      { ...command(f), nightly_rate: '4503599627370497', deposit_amount: '0' },
      key,
    );
    expect(
      f.rows('RentalReservation').find((r) => r.id === result.resource_id)
        ?.total_amount,
    ).toBe('9007199254740994');
  });
  it('rejects a direct confirmation without actual agreed deposit', async () => {
    const f = bookingFixture();
    await expect(
      new ConfirmRentalReservationUseCase(
        f.transactions,
        new RentalReservationService(),
      ).execute('1', '1', '10', {}, key),
    ).rejects.toThrow('rental:deposit_required');
    expect(f.effects).toHaveLength(0);
  });
  it('captures complete policy at confirmation and keeps first-payment snapshot immutable', async () => {
    const f = bookingFixture();
    paid(f);
    f.reservation.policy_snapshot = await capturePolicySnapshot(
      f.ctx,
      f.reservation,
    );
    f.rows('RentalCancellationRule')[1].refund_percent = '100.00';
    const result = await new ConfirmRentalReservationUseCase(
      f.transactions,
      new RentalReservationService(),
    ).execute('1', '1', '10', {}, key);
    expect(result.status).toBe('confirmed');
    expect(f.rows('RentalReservation')[0].policy_snapshot).toMatchObject({
      rules: expect.arrayContaining([
        { min_days_before: 7, refund_percent: '33.33' },
      ]),
    });
  });
  it('requires a nonzero agreed deposit even if a draft has payments', async () => {
    const f = bookingFixture();
    paid(f);
    f.reservation.deposit_amount = '0';
    await expect(
      new ConfirmRentalReservationUseCase(
        f.transactions,
        new RentalReservationService(),
      ).execute('1', '1', '10', {}, key),
    ).rejects.toThrow('rental:deposit_required');
  });
  it('Airbnb confirmation records explicit platform terms without demanding payout', async () => {
    const f = bookingFixture();
    Object.assign(f.reservation, {
      channel: 'airbnb',
      deposit_amount: '0',
      cancellation_policy_id: null,
      external_reference: 'AB-EXAMPLE',
    });
    const result = await new ConfirmRentalReservationUseCase(
      f.transactions,
      new RentalReservationService(),
    ).execute(
      '1',
      '1',
      '10',
      {
        platform_policy: {
          reference: 'COND-1',
          description: 'Condiciones registradas',
        },
      },
      key,
    );
    expect(result.status).toBe('confirmed');
    expect(f.rows('RentalReservation')[0].policy_snapshot).toMatchObject({
      kind: 'platform',
      platform_reference: 'COND-1',
    });
  });
  it('Airbnb confirmation rejects changed externally frozen terms', async () => {
    const f = bookingFixture();
    Object.assign(f.reservation, {
      channel: 'airbnb',
      deposit_amount: '0',
      cancellation_policy_id: null,
      external_reference: 'AB-EXAMPLE',
    });
    f.reservation.policy_snapshot = await capturePolicySnapshot(
      f.ctx,
      f.reservation,
      { reference: 'COND-1', description: 'Original' },
    );
    await expect(
      new ConfirmRentalReservationUseCase(
        f.transactions,
        new RentalReservationService(),
      ).execute(
        '1',
        '1',
        '10',
        { platform_policy: { reference: 'COND-1', description: 'Reemplazo' } },
        key,
      ),
    ).rejects.toThrow('rental:agreement_immutable');
  });
  it('archived occupying reservations still block confirmation', async () => {
    const f = bookingFixture();
    paid(f);
    f.rows('RentalReservation').push({
      ...f.reservation,
      id: '11',
      status: 'confirmed',
      is_active: false,
    });
    await expect(
      new ConfirmRentalReservationUseCase(
        f.transactions,
        new RentalReservationService(),
      ).execute('1', '1', '10', {}, key),
    ).rejects.toThrow('rental:availability_conflict');
  });
  it('active blocks prevent confirmation', async () => {
    const f = bookingFixture();
    paid(f);
    f.rows('RentalBlock').push({
      id: '70',
      property_id: '1',
      is_active: true,
      starts_at: new Date('2026-10-20T19:00:00Z'),
      ends_at: new Date('2026-10-20T20:00:00Z'),
    });
    await expect(
      new ConfirmRentalReservationUseCase(
        f.transactions,
        new RentalReservationService(),
      ).execute('1', '1', '10', {}, key),
    ).rejects.toThrow('rental:availability_conflict');
  });
  it('requires explicit same-day approval even with a compatible plan', async () => {
    const f = bookingFixture();
    paid(f);
    f.rows('RentalReservation').push({
      ...f.reservation,
      id: '9',
      status: 'completed',
      check_in_on: '2026-10-18',
      check_out_on: '2026-10-20',
    });
    Object.assign(f.turnover, {
      previous_reservation_id: '9',
      linen_ready: true,
      planned_ready_at: new Date('2026-10-20T17:00:00Z'),
    });
    await expect(
      new ConfirmRentalReservationUseCase(
        f.transactions,
        new RentalReservationService(),
      ).execute('1', '1', '10', {}, key),
    ).rejects.toThrow('rental:turnover_required');
  });
  it('atomically accepts the current same-day turnover plan during confirmation', async () => {
    const f = bookingFixture();
    paid(f);
    f.rows('RentalReservation').push({
      ...f.reservation,
      id: '9',
      status: 'completed',
      check_in_on: '2026-10-18',
      check_out_on: '2026-10-20',
    });
    Object.assign(f.turnover, {
      previous_reservation_id: '9',
      linen_ready: true,
      planned_ready_at: new Date('2026-10-20T17:00:00Z'),
    });
    const result = await new ConfirmRentalReservationUseCase(
      f.transactions,
      new RentalReservationService(),
    ).execute('1', '1', '10', { same_day_approvals: ['20'] }, key);
    expect(result.status).toBe('confirmed');
    expect(f.rows('RentalTurnover')[0].same_day_approved_at).toEqual(f.now);
  });
  it('rejects arbitrary approval IDs', async () => {
    const f = bookingFixture();
    paid(f);
    await expect(
      new ConfirmRentalReservationUseCase(
        f.transactions,
        new RentalReservationService(),
      ).execute('1', '1', '10', { same_day_approvals: ['999'] }, key),
    ).rejects.toThrow('rental:invalid_approval');
  });
  it('a voided first payment still freezes the agreement', async () => {
    const f = bookingFixture();
    paid(f);
    f.rows('RentalPayment')[0].status = 'voided';
    await expect(
      new UpdateRentalReservationUseCase(
        f.transactions,
        new RentalReservationService(),
      ).execute('1', '1', '10', { nightly_rate: '60000' }, key),
    ).rejects.toThrow('rental:agreement_immutable');
  });
  it('allows contact correction after confirmation without repricing', async () => {
    const f = bookingFixture();
    f.reservation.status = 'confirmed';
    await new UpdateRentalReservationUseCase(
      f.transactions,
      new RentalReservationService(),
    ).execute(
      '1',
      '1',
      '10',
      { guest_contact: 'Nuevo contacto', is_active: false },
      key,
    );
    expect(f.rows('RentalReservation')[0]).toMatchObject({
      guest_contact: 'Nuevo contacto',
      is_active: false,
      total_amount: '100000',
      status: 'confirmed',
    });
  });
  it('start requires real cleaning, not merely a future plan', async () => {
    const f = bookingFixture();
    f.reservation.status = 'confirmed';
    f.ctx.now = localInstant('2026-10-20', '16:00', f.property.timezone);
    f.turnover.linen_ready = true;
    f.turnover.planned_ready_at = new Date('2026-10-20T17:00:00Z');
    await expect(
      new StartRentalReservationUseCase(
        f.transactions,
        new RentalReservationService(),
      ).execute('1', '1', '10', {}, key),
    ).rejects.toThrow('rental:turnover_required');
  });
  it('cannot start before arrival or retrospectively after checkout', async () => {
    const f = bookingFixture();
    f.reservation.status = 'confirmed';
    Object.assign(f.turnover, {
      linen_ready: true,
      cleaning_status: 'completed',
      ready_at: f.now,
    });
    await expect(
      new StartRentalReservationUseCase(
        f.transactions,
        new RentalReservationService(),
      ).execute('1', '1', '10', {}, key),
    ).rejects.toThrow('rental:invalid_transition');
    f.ctx.now = localInstant('2026-10-22', '11:00', f.property.timezone);
    await expect(
      new StartRentalReservationUseCase(
        f.transactions,
        new RentalReservationService(),
      ).execute('1', '1', '10', {}, key),
    ).rejects.toThrow('rental:invalid_transition');
  });
  it('starts a prepared stay, completes only at checkout, and preserves archived occupancy', async () => {
    const f = bookingFixture();
    f.reservation.status = 'confirmed';
    f.reservation.is_active = false;
    f.ctx.now = localInstant('2026-10-20', '16:00', f.property.timezone);
    Object.assign(f.turnover, {
      linen_ready: true,
      cleaning_status: 'completed',
      ready_at: f.now,
    });
    expect(
      (
        await new StartRentalReservationUseCase(
          f.transactions,
          new RentalReservationService(),
        ).execute('1', '1', '10', {}, key)
      ).status,
    ).toBe('in_progress');
    const complete = new CompleteRentalReservationUseCase(
      f.transactions,
      new RentalReservationService(),
    );
    await expect(complete.execute('1', '1', '10', {}, key)).rejects.toThrow(
      'rental:invalid_transition',
    );
    f.ctx.now = localInstant('2026-10-22', '11:00', f.property.timezone);
    expect((await complete.execute('1', '1', '10', {}, key)).status).toBe(
      'completed',
    );
    expect(f.rows('RentalReservation')[0].is_active).toBe(false);
  });
  it('does not complete a confirmed stay that was never started', async () => {
    const f = bookingFixture();
    f.reservation.status = 'confirmed';
    f.ctx.now = localInstant('2026-10-22', '11:00', f.property.timezone);
    await expect(
      new CompleteRentalReservationUseCase(
        f.transactions,
        new RentalReservationService(),
      ).execute('1', '1', '10', {}, key),
    ).rejects.toThrow('rental:invalid_transition');
  });
  it('rejects forged snapshots and unknown command fields', async () => {
    const f = bookingFixture();
    await expect(
      new ConfirmRentalReservationUseCase(
        f.transactions,
        new RentalReservationService(),
      ).execute('1', '1', '10', { policy_snapshot: {} } as never, key),
    ).rejects.toThrow();
    await expect(
      new StartRentalReservationUseCase(
        f.transactions,
        new RentalReservationService(),
      ).execute('1', '1', '10', { now: '2026-10-20' } as never, key),
    ).rejects.toThrow();
  });
  it('rejects inconsistent existing policy snapshot instead of fabricating fallback terms', async () => {
    const f = bookingFixture();
    paid(f);
    f.reservation.policy_snapshot = {
      kind: 'direct',
      schema_version: 1,
    } as RentalReservation['policy_snapshot'];
    await expect(
      new ConfirmRentalReservationUseCase(
        f.transactions,
        new RentalReservationService(),
      ).execute('1', '1', '10', {}, key),
    ).rejects.toThrow();
  });
  it('optional blank references and notes normalize to null', async () => {
    const f = bookingFixture();
    const result = await new CreateRentalReservationUseCase(
      f.transactions,
      new RentalReservationService(),
    ).execute(
      '1',
      '1',
      { ...command(f), external_reference: '   ', notes: '   ' },
      key,
    );
    expect(
      f.rows('RentalReservation').find((r) => r.id === result.resource_id),
    ).toMatchObject({ external_reference: null, notes: null });
  });
  it('new preceding guest invalidates an existing future guest approval unless approved atomically', async () => {
    const f = bookingFixture();
    paid(f);
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
      previous_reservation_id: '8',
      linen_ready: true,
      planned_ready_at: new Date('2026-10-22T17:00:00Z'),
      same_day_approved_at: f.now,
      ready_at: f.now,
      cleaning_status: 'completed',
    });
    await expect(
      new ConfirmRentalReservationUseCase(
        f.transactions,
        new RentalReservationService(),
      ).execute('1', '1', '10', {}, key),
    ).rejects.toThrow('rental:turnover_required');
  });
  it('approves the affected future guest turnover for its new preceding guest', async () => {
    const f = bookingFixture();
    paid(f);
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
      previous_reservation_id: '8',
      linen_ready: true,
      planned_ready_at: new Date('2026-10-22T17:00:00Z'),
      same_day_approved_at: f.now,
      ready_at: f.now,
      cleaning_status: 'completed',
    });
    const result = await new ConfirmRentalReservationUseCase(
      f.transactions,
      new RentalReservationService(),
    ).execute('1', '1', '10', { same_day_approvals: ['21'] }, key);
    expect(result.status).toBe('confirmed');
    expect(f.rows('RentalTurnover')[1]).toMatchObject({
      previous_reservation_id: '10',
      same_day_approved_at: f.now,
      ready_at: null,
      cleaning_status: 'pending',
    });
  });
});
