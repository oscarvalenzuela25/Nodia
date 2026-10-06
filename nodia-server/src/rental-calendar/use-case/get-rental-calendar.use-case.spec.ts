import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import {
  GetRentalCalendarUseCase,
  GetRentalAvailabilityUseCase,
} from './get-rental-calendar.use-case.js';
import { RentalCalendarService } from '../rental-calendar.service.js';
import { RentalReservation } from '../../rental-reservation/entities/rental-reservation.entity.js';
import { RentalBlock } from '../../rental-block/entities/rental-block.entity.js';
import { RentalTurnover } from '../../rental-turnover/entities/rental-turnover.entity.js';
import { rentalTestFixture } from '../../rental-payment/use-case/rental-test-fixture.js';

describe('Rental calendar reads', () => {
  function fixture() {
    const f = rentalTestFixture();
    return {
      ...f,
      calendar: new GetRentalCalendarUseCase(f.tx, new RentalCalendarService()),
      availability: new GetRentalAvailabilityUseCase(f.tx),
    };
  }
  it('returns a real empty state, distinct from authorization or DB failure', async () => {
    const f = fixture();
    const result = await f.calendar.execute('1', '10', {
      from_on: '2026-10-01',
      to_on: '2026-11-01',
    });
    expect(result).toMatchObject({
      reservations: [],
      blocks: [],
      turnovers: [],
      scope: { includes_archived_occupancy: true },
    });
    await expect(
      f.calendar.execute('3', '10', {
        from_on: '2026-10-01',
        to_on: '2026-11-01',
      }),
    ).rejects.toThrow('rental:not_found');
  });
  it('projects archived occupation and preparation without contact or notes', async () => {
    const f = fixture();
    const row = f.table(RentalReservation)[0];
    Object.assign(row, {
      check_in_on: '2026-10-10',
      check_out_on: '2026-10-11',
      check_in_time: '15:00:00',
      check_out_time: '11:00:00',
      guest_name: 'Synthetic guest',
      guest_contact: 'SECRET-CONTACT',
      notes: 'SECRET-NOTE',
      status: 'confirmed',
      is_active: false,
    });
    f.queryRows(RentalReservation, [row]);
    f.queryRows(RentalBlock, []);
    f.queryRows(RentalTurnover, []);
    const result = await f.calendar.execute('1', '10', {
      from_on: '2026-10-01',
      to_on: '2026-11-01',
    });
    expect(result.reservations[0]).toMatchObject({
      is_active: false,
      check_in_at: '2026-10-10T18:00:00.000Z',
    });
    expect(JSON.stringify(result)).not.toContain('SECRET');
  });
  it('rejects over-limit event sets instead of presenting a truncated calendar', async () => {
    const f = fixture();
    f.queryRows(
      RentalReservation,
      Array.from({ length: 1001 }, () => ({ id: '40' })),
    );
    await expect(
      f.calendar.execute('1', '10', {
        from_on: '2026-10-01',
        to_on: '2026-11-01',
      }),
    ).rejects.toThrow('rental:window_too_large');
  });
  it('does not require a midnight that does not exist at a Santiago DST boundary', async () => {
    const f = fixture();
    await expect(
      f.calendar.execute('1', '10', {
        from_on: '2026-09-06',
        to_on: '2026-09-07',
      }),
    ).resolves.toMatchObject({ reservations: [] });
  });
  it('rejects unbounded windows, extra fields and ambiguous/nonexistent agreed local hours', async () => {
    const f = fixture();
    await expect(
      f.calendar.execute('1', '10', {
        from_on: '2026-01-01',
        to_on: '2026-12-31',
      }),
    ).rejects.toThrow('rental:invalid_input');
    await expect(
      f.calendar.execute('1', '10', {
        from_on: '2026-10-01',
        to_on: '2026-11-01',
        user_id: '3',
      } as { from_on: string; to_on: string }),
    ).rejects.toThrow('rental:invalid_input');
    await expect(
      f.availability.execute('1', '10', {
        check_in_on: '2026-09-06',
        check_out_on: '2026-09-07',
        check_in_time: '00:30',
        check_out_time: '11:00',
      }),
    ).rejects.toThrow('rental:invalid_local_time');
  });
  it('keeps availability informational and reports DB conflicts using the shared rule', async () => {
    const f = fixture();
    f.queryRows(RentalBlock, [
      {
        id: '70',
        starts_at: new Date('2026-10-10T18:00:00Z'),
        ends_at: new Date('2026-10-11T14:00:00Z'),
      },
    ]);
    const result = await f.availability.execute('1', '10', {
      check_in_on: '2026-10-10',
      check_out_on: '2026-10-11',
      check_in_time: '15:00',
      check_out_time: '11:00',
    });
    expect(result.available).toBe(false);
    expect(result.conflicts).toEqual([
      {
        resource_type: 'block',
        id: '70',
        starts_at: '2026-10-10T18:00:00.000Z',
        ends_at: '2026-10-11T14:00:00.000Z',
      },
    ]);
    expect(f.table(RentalReservation)[0].status).toBe('draft');
  });
});
