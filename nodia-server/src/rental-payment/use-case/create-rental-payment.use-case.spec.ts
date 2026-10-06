import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CreateRentalPaymentUseCase } from './create-rental-payment.use-case.js';
import { RentalPaymentService } from '../rental-payment.service.js';
import { RentalPayment } from '../entities/rental-payment.entity.js';
import { RentalReservation } from '../../rental-reservation/entities/rental-reservation.entity.js';
import { RentalOperation } from '../../rental-operation/entities/rental-operation.entity.js';
import { RentalAuditEvent } from '../../rental-audit/entities/rental-audit-event.entity.js';
import { RentalCollaborator } from '../../rental-collaborator/entities/rental-collaborator.entity.js';
import {
  rentalTestFixture,
  rentalKey,
  secondRentalKey,
} from './rental-test-fixture.js';

describe('CreateRentalPaymentUseCase', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-04T16:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());
  const input = {
    reservation_id: '40',
    type: 'payment' as const,
    amount: '40000',
    occurred_on: '2026-10-04',
  };

  it('records received money without holding dates and freezes the complete direct policy', async () => {
    const f = rentalTestFixture();
    const useCase = new CreateRentalPaymentUseCase(
      f.tx,
      new RentalPaymentService(),
    );
    const result = await useCase.execute('2', '10', input, rentalKey);
    expect(result).toMatchObject({
      operation: 'payment.create',
      resource_type: 'payment',
      status: 'confirmed',
    });
    expect(f.table(RentalPayment)[0]).toMatchObject({
      amount: '40000',
      method: null,
      created_by: '2',
    });
    expect(f.table(RentalReservation)[0]).toMatchObject({
      status: 'draft',
      policy_snapshot: {
        kind: 'direct',
        rules: [{ min_days_before: 0, refund_percent: '50.00' }],
      },
    });
    expect(f.table(RentalAuditEvent)).toHaveLength(1);
    expect(f.table(RentalOperation)).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain('guest_contact');
  });

  it('replays the same intention before rechecking consumed financial conditions', async () => {
    const f = rentalTestFixture();
    const useCase = new CreateRentalPaymentUseCase(
      f.tx,
      new RentalPaymentService(),
    );
    const exact = { ...input, amount: '200000' };
    const first = await useCase.execute('1', '10', exact, rentalKey);
    expect(
      await useCase.execute(
        '1',
        '10',
        { ...exact, notes: null, method: null, reference: null },
        rentalKey,
      ),
    ).toEqual(first);
    expect(f.table(RentalPayment)).toHaveLength(1);
    expect(f.table(RentalAuditEvent)).toHaveLength(1);
    await expect(
      useCase.execute('1', '10', { ...input, amount: '1' }, rentalKey),
    ).rejects.toThrow('rental:idempotency_conflict');
    await expect(
      useCase.execute('1', '10', input, secondRentalKey),
    ).rejects.toThrow('rental:overpayment');
  });

  it('denies outsiders and replay after collaborator revocation', async () => {
    const f = rentalTestFixture();
    const useCase = new CreateRentalPaymentUseCase(
      f.tx,
      new RentalPaymentService(),
    );
    await expect(useCase.execute('3', '10', input, rentalKey)).rejects.toThrow(
      'rental:not_found',
    );
    await useCase.execute('2', '10', input, rentalKey);
    f.table(RentalCollaborator)[0].is_active = false;
    await expect(useCase.execute('2', '10', input, rentalKey)).rejects.toThrow(
      'rental:not_found',
    );
    expect(f.table(RentalPayment)).toHaveLength(1);
  });

  it('rejects future date, number money, unknown authority, null required and nested extra fields', async () => {
    const f = rentalTestFixture();
    const useCase = new CreateRentalPaymentUseCase(
      f.tx,
      new RentalPaymentService(),
    );
    for (const payload of [
      { ...input, occurred_on: '2026-10-05' },
      { ...input, amount: 40000 },
      { ...input, created_by: '3' },
      { ...input, amount: null },
      {
        ...input,
        platform_policy: { reference: 'r', description: 'd', secret: 'x' },
      },
    ])
      await expect(
        useCase.execute(
          '1',
          '10',
          payload as unknown as typeof input,
          rentalKey,
        ),
      ).rejects.toThrow('rental:invalid_input');
    expect(f.table(RentalPayment)).toHaveLength(0);
  });

  it('keeps CLP above the safe integer range exact', async () => {
    const f = rentalTestFixture();
    f.table(RentalReservation)[0].total_amount = '9007199254740993';
    const useCase = new CreateRentalPaymentUseCase(
      f.tx,
      new RentalPaymentService(),
    );
    await useCase.execute(
      '1',
      '10',
      { ...input, amount: '9007199254740993' },
      rentalKey,
    );
    expect(f.table(RentalPayment)[0].amount).toBe('9007199254740993');
  });

  it('records Airbnb net once with first-payment platform conditions and no direct deposit', async () => {
    const f = rentalTestFixture();
    Object.assign(f.table(RentalReservation)[0], {
      channel: 'airbnb',
      commission_amount: '6000',
      deposit_amount: '0',
      cancellation_policy_id: null,
      external_reference: 'EXTERNAL-1',
    });
    const useCase = new CreateRentalPaymentUseCase(
      f.tx,
      new RentalPaymentService(),
    );
    await useCase.execute(
      '1',
      '10',
      {
        ...input,
        amount: '194000',
        platform_policy: {
          reference: 'terms',
          description: 'Synthetic external terms',
        },
      },
      rentalKey,
    );
    expect(f.table(RentalReservation)[0]).toMatchObject({
      status: 'draft',
      total_amount: '200000',
      policy_snapshot: { kind: 'platform' },
    });
    expect(f.table(RentalPayment)).toHaveLength(1);
    expect(f.table(RentalPayment)[0].amount).toBe('194000');
  });

  it('refunds only the approved cancellation budget and refuses changing its received base', async () => {
    const f = rentalTestFixture();
    Object.assign(f.table(RentalReservation)[0], {
      status: 'cancelled',
      refund_amount: '20000',
      cancelled_at: new Date('2026-10-03T16:00:00Z'),
    });
    f.seed(RentalPayment, {
      id: '50',
      property_id: '10',
      reservation_id: '40',
      type: 'payment',
      amount: '40000',
      status: 'confirmed',
    });
    const useCase = new CreateRentalPaymentUseCase(
      f.tx,
      new RentalPaymentService(),
    );
    await useCase.execute(
      '1',
      '10',
      { ...input, type: 'refund', amount: '12000' },
      rentalKey,
    );
    await expect(
      useCase.execute(
        '1',
        '10',
        { ...input, type: 'refund', amount: '9000' },
        secondRentalKey,
      ),
    ).rejects.toThrow('rental:refund_exceeds_approved');
    await expect(
      useCase.execute('1', '10', input, secondRentalKey),
    ).rejects.toThrow('rental:invalid_transition');
    await expect(
      useCase.execute(
        '1',
        '10',
        { ...input, type: 'refund', amount: '8000', occurred_on: '2026-10-02' },
        secondRentalKey,
      ),
    ).rejects.toThrow('rental:invalid_input');
  });

  it('rolls back snapshot and money if audit/operation persistence fails', async () => {
    const f = rentalTestFixture();
    f.failOn(RentalOperation);
    const useCase = new CreateRentalPaymentUseCase(
      f.tx,
      new RentalPaymentService(),
    );
    await expect(useCase.execute('1', '10', input, rentalKey)).rejects.toThrow(
      'rental:server_error',
    );
    expect(f.table(RentalPayment)).toHaveLength(0);
    expect(f.table(RentalAuditEvent)).toHaveLength(0);
    expect(f.table(RentalReservation)[0].policy_snapshot).toBeNull();
  });
  it('classifies connection loss without exposing driver details or recording money', async () => {
    const f = rentalTestFixture(),
      createRunner = f.source.createQueryRunner.bind(f.source);
    f.source.createQueryRunner = () => {
      const runner = createRunner();
      runner.connect = async () => {
        throw Object.assign(new Error('PRIVATE-DRIVER-MARKER'), {
          code: 'ECONNRESET',
        });
      };
      return runner;
    };
    await expect(
      new CreateRentalPaymentUseCase(f.tx, new RentalPaymentService()).execute(
        '1',
        '10',
        input,
        rentalKey,
      ),
    ).rejects.toThrow('rental:temporarily_busy');
    expect(f.table(RentalPayment)).toHaveLength(0);
  });
  it('does not acknowledge success when rollback cannot be completed', async () => {
    const f = rentalTestFixture(),
      createRunner = f.source.createQueryRunner.bind(f.source);
    f.source.createQueryRunner = () => {
      const runner = createRunner();
      runner.rollbackTransaction = async () => {
        throw new Error('PRIVATE-DRIVER-MARKER');
      };
      return runner;
    };
    f.failOn(RentalOperation);
    await expect(
      new CreateRentalPaymentUseCase(f.tx, new RentalPaymentService()).execute(
        '1',
        '10',
        input,
        rentalKey,
      ),
    ).rejects.toThrow('rental:temporarily_busy');
  });
  it('returns the committed acknowledgement even if releasing its connection fails', async () => {
    const f = rentalTestFixture(),
      createRunner = f.source.createQueryRunner.bind(f.source);
    f.source.createQueryRunner = () => {
      const runner = createRunner();
      runner.release = async () => {
        throw new Error('PRIVATE-DRIVER-MARKER');
      };
      return runner;
    };
    const result = await new CreateRentalPaymentUseCase(
      f.tx,
      new RentalPaymentService(),
    ).execute('1', '10', input, rentalKey);
    expect(result.status).toBe('confirmed');
    expect(f.table(RentalOperation)).toHaveLength(1);
    expect(f.table(RentalPayment)).toHaveLength(1);
  });
});
