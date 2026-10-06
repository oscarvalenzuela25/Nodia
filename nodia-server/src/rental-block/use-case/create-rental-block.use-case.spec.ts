import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CreateRentalBlockUseCase } from './create-rental-block.use-case.js';
import { UpdateRentalBlockUseCase } from './update-rental-block.use-case.js';
import { RentalBlockService } from '../rental-block.service.js';
import { RentalBlock } from '../entities/rental-block.entity.js';
import { RentalProperty } from '../../rental-property/entities/rental-property.entity.js';
import { RentalReservation } from '../../rental-reservation/entities/rental-reservation.entity.js';
import { RentalTurnover } from '../../rental-turnover/entities/rental-turnover.entity.js';
import { RentalOperation } from '../../rental-operation/entities/rental-operation.entity.js';
import {
  rentalTestFixture,
  rentalKey,
  secondRentalKey,
} from '../../rental-payment/use-case/rental-test-fixture.js';

describe('Rental block use cases', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-04T16:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());
  const input = {
    starts_at: '2026-10-10T10:00:00-03:00',
    ends_at: '2026-10-10T13:00:00-03:00',
    reason: 'Maintenance',
  };
  function fixture() {
    const f = rentalTestFixture();
    const service = new RentalBlockService();
    return {
      ...f,
      create: new CreateRentalBlockUseCase(f.tx, service),
      update: new UpdateRentalBlockUseCase(f.tx, service),
    };
  }
  it('records a whole-house block with canonical instants and replays equivalent offsets', async () => {
    const f = fixture();
    const first = await f.create.execute('2', '10', input, rentalKey);
    expect(f.table(RentalBlock)[0]).toMatchObject({
      starts_at: new Date('2026-10-10T13:00:00Z'),
      is_active: true,
      created_by: '2',
    });
    expect(
      await f.create.execute(
        '2',
        '10',
        {
          ...input,
          starts_at: '2026-10-10T13:00:00Z',
          ends_at: '2026-10-10T16:00:00Z',
          notes: null,
          is_active: true,
        },
        rentalKey,
      ),
    ).toEqual(first);
    expect(f.table(RentalBlock)).toHaveLength(1);
  });
  it('rejects invalid range, outsider and creation on an archived house', async () => {
    const f = fixture();
    await expect(
      f.create.execute(
        '1',
        '10',
        { ...input, ends_at: input.starts_at },
        rentalKey,
      ),
    ).rejects.toThrow('rental:invalid_input');
    await expect(f.create.execute('3', '10', input, rentalKey)).rejects.toThrow(
      'rental:not_found',
    );
    f.table(RentalProperty)[0].is_active = false;
    await expect(f.create.execute('1', '10', input, rentalKey)).rejects.toThrow(
      'rental:invalid_transition',
    );
    expect(f.table(RentalBlock)).toHaveLength(0);
  });
  it('runs the shared availability rule against DB-reported occupation before saving', async () => {
    const f = fixture();
    f.queryExists(RentalReservation, true);
    await expect(f.create.execute('1', '10', input, rentalKey)).rejects.toThrow(
      'rental:availability_conflict',
    );
    expect(f.table(RentalBlock)).toHaveLength(0);
  });
  it('can archive to release availability, but a fresh activation rechecks conflicts', async () => {
    const f = fixture();
    const result = await f.create.execute('1', '10', input, rentalKey);
    await f.update.execute(
      '1',
      '10',
      result.resource_id,
      { is_active: false },
      secondRentalKey,
    );
    expect(f.table(RentalBlock)[0].is_active).toBe(false);
    f.queryExists(RentalReservation, true);
    await expect(
      f.update.execute(
        '1',
        '10',
        result.resource_id,
        { is_active: true },
        '33333333-3333-4333-8333-333333333333',
      ),
    ).rejects.toThrow('rental:availability_conflict');
    expect(f.table(RentalBlock)[0].is_active).toBe(false);
  });
  it('does not invalidate a prepared transition for a metadata-only edit', async () => {
    const f = fixture();
    const result = await f.create.execute('1', '10', input, rentalKey);
    const plan = f.seed(RentalTurnover, {
      id: '60',
      property_id: '10',
      incoming_reservation_id: '40',
      previous_reservation_id: null,
      linen_ready: true,
      cleaning_status: 'completed',
      ready_at: new Date('2026-10-10T14:00:00Z'),
      planned_ready_at: new Date('2026-10-10T14:00:00Z'),
      same_day_approved_at: new Date(),
    });
    f.queryRows(RentalTurnover, [plan]);
    await f.update.execute(
      '1',
      '10',
      result.resource_id,
      { reason: 'Changed label' },
      secondRentalKey,
    );
    expect(f.table(RentalTurnover)[0].cleaning_status).toBe('completed');
  });
  it('rolls back block/neighbor changes when persisting the intention fails', async () => {
    const f = fixture();
    f.failOn(RentalOperation);
    await expect(f.create.execute('1', '10', input, rentalKey)).rejects.toThrow(
      'rental:server_error',
    );
    expect(f.table(RentalBlock)).toHaveLength(0);
  });
});
