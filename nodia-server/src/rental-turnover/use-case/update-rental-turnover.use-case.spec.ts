import { describe, it, expect } from 'vitest';
import { bookingFixture } from '../../rental-reservation/use-case/rental-booking.fixture.js';
import { RentalTurnoverService } from '../rental-turnover.service.js';
import { UpdateRentalTurnoverUseCase } from './update-rental-turnover.use-case.js';
import { ApproveSameDayRentalTurnoverUseCase } from './approve-same-day-rental-turnover.use-case.js';
const key = '10000000-0000-4000-8000-000000000001';
function transition() {
  const f = bookingFixture();
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
  return f;
}
describe('Actual preparation rules through turnover use cases', () => {
  it('accepts a future compatible plan without claiming cleaning was completed', async () => {
    const f = transition();
    const result = await new ApproveSameDayRentalTurnoverUseCase(
      f.transactions,
      new RentalTurnoverService(),
    ).execute('1', '1', '20', {}, key);
    expect(result.status).toBe('pending');
    expect(f.rows('RentalTurnover')[0]).toMatchObject({
      same_day_approved_at: f.now,
      cleaning_status: 'pending',
      ready_at: null,
    });
  });
  it('zero minimum minutes does not imply automatic approval or readiness', async () => {
    const f = transition();
    f.property.minimum_turnover_minutes = 0;
    f.turnover.linen_ready = false;
    await expect(
      new ApproveSameDayRentalTurnoverUseCase(
        f.transactions,
        new RentalTurnoverService(),
      ).execute('1', '1', '20', {}, key),
    ).rejects.toThrow('rental:turnover_required');
  });
  it.each(['2026-10-20T14:30:00Z', '2026-10-20T18:01:00Z'])(
    'rejects incompatible proposed ready time %s',
    async (planned_ready_at) => {
      const f = transition();
      await expect(
        new UpdateRentalTurnoverUseCase(
          f.transactions,
          new RentalTurnoverService(),
        ).execute('1', '1', '20', { planned_ready_at }, key),
      ).rejects.toThrow('rental:invalid_turnover_plan');
    },
  );
  it.each([
    { ready_at: '2026-10-20T17:00:00Z' },
    { linen_ready: true, ready_at: '2026-10-05T14:00:00Z' },
    {
      linen_ready: true,
      cleaning_status: 'completed',
      ready_at: '2026-10-20T13:00:00Z',
    },
  ])(
    'rejects invalid readiness without completed current facts %j',
    async (dto) => {
      const f = transition();
      await expect(
        new UpdateRentalTurnoverUseCase(
          f.transactions,
          new RentalTurnoverService(),
        ).execute('1', '1', '20', dto as never, key),
      ).rejects.toThrow('rental:invalid_turnover_ready');
    },
  );
  it('allows a late real readiness time without declaring it punctual', async () => {
    const f = transition();
    f.ctx.now = new Date('2026-10-20T21:00:00Z');
    const result = await new UpdateRentalTurnoverUseCase(
      f.transactions,
      new RentalTurnoverService(),
    ).execute(
      '1',
      '1',
      '20',
      {
        linen_ready: true,
        cleaning_status: 'completed',
        ready_at: '2026-10-20T20:00:00Z',
      },
      key,
    );
    expect(result.status).toBe('completed');
    expect(f.rows('RentalTurnover')[0].ready_at).toEqual(
      new Date('2026-10-20T20:00:00Z'),
    );
  });
  it('changing planned time invalidates previous approval', async () => {
    const f = transition();
    f.turnover.same_day_approved_at = f.now;
    await new UpdateRentalTurnoverUseCase(
      f.transactions,
      new RentalTurnoverService(),
    ).execute(
      '1',
      '1',
      '20',
      { planned_ready_at: '2026-10-20T17:30:00Z' },
      key,
    );
    expect(f.rows('RentalTurnover')[0].same_day_approved_at).toBeNull();
  });
  it('new preceding reservation invalidates approval and actual readiness for the old transition', async () => {
    const f = transition();
    f.ctx.now = new Date('2026-10-20T21:00:00Z');
    Object.assign(f.turnover, {
      previous_reservation_id: '8',
      cleaning_status: 'completed',
      ready_at: new Date('2026-10-20T17:00:00Z'),
      same_day_approved_at: f.now,
    });
    await new UpdateRentalTurnoverUseCase(
      f.transactions,
      new RentalTurnoverService(),
    ).execute('1', '1', '20', { notes: 'Revisar preparación' }, key);
    expect(f.rows('RentalTurnover')[0]).toMatchObject({
      previous_reservation_id: '9',
      cleaning_status: 'pending',
      ready_at: null,
      same_day_approved_at: null,
    });
  });
  it('notes-only correction keeps a valid approval and ready fact', async () => {
    const f = transition();
    f.ctx.now = new Date('2026-10-20T21:00:00Z');
    Object.assign(f.turnover, {
      cleaning_status: 'completed',
      ready_at: new Date('2026-10-20T17:00:00Z'),
      same_day_approved_at: f.now,
    });
    await new UpdateRentalTurnoverUseCase(
      f.transactions,
      new RentalTurnoverService(),
    ).execute('1', '1', '20', { notes: 'Observación' }, key);
    expect(f.rows('RentalTurnover')[0].same_day_approved_at).toEqual(f.now);
    expect(f.rows('RentalTurnover')[0].ready_at).not.toBeNull();
  });
  it('rejects client-forged approval or previous guest', async () => {
    const f = transition();
    const update = new UpdateRentalTurnoverUseCase(
      f.transactions,
      new RentalTurnoverService(),
    );
    await expect(
      update.execute(
        '1',
        '1',
        '20',
        { previous_reservation_id: '999' } as never,
        key,
      ),
    ).rejects.toThrow('rental:invalid_input');
    await expect(
      update.execute(
        '1',
        '1',
        '20',
        { same_day_approved_at: f.now.toISOString() } as never,
        key,
      ),
    ).rejects.toThrow('rental:invalid_input');
  });
  it('rejects approval for a transition that is not the same local day', async () => {
    const f = bookingFixture();
    f.turnover.linen_ready = true;
    f.turnover.planned_ready_at = new Date('2026-10-20T17:00:00Z');
    await expect(
      new ApproveSameDayRentalTurnoverUseCase(
        f.transactions,
        new RentalTurnoverService(),
      ).execute('1', '1', '20', {}, key),
    ).rejects.toThrow('rental:turnover_required');
  });
  it('scope-constrained lookup does not associate preparations from another house', async () => {
    const f = transition();
    f.turnover.property_id = '2';
    await expect(
      new UpdateRentalTurnoverUseCase(
        f.transactions,
        new RentalTurnoverService(),
      ).execute('1', '1', '20', { notes: 'Corrección' }, key),
    ).rejects.toThrow('rental:not_found');
  });
});
