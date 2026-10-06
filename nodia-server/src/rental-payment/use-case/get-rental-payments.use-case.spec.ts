import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import {
  GetRentalPaymentsUseCase,
  GetRentalPaymentUseCase,
} from './get-rental-payments.use-case.js';
import { RentalPaymentService } from '../rental-payment.service.js';
import { RentalPayment } from '../entities/rental-payment.entity.js';
import { rentalTestFixture } from './rental-test-fixture.js';
import type { RentalPaymentQueryDto } from '../dto/rental-payment.dto.js';

describe('Rental payment reads', () => {
  it('rejects extra or unsafe query fields before performing I/O', async () => {
    const f = rentalTestFixture();
    const service = new RentalPaymentService();
    const list = vi.spyOn(service, 'list');
    const useCase = new GetRentalPaymentsUseCase(f.tx, service);
    for (const query of [
      { all: 'true' },
      { active: 'active' },
      { q: { s: 'amount desc' } },
      { q: { guest_contact_cont: 'secret' } },
      { from_on: '2026-10-01' },
      { limit: '101' },
      { page: '1e2' },
      { type: null },
    ])
      await expect(
        useCase.execute('1', '10', query as unknown as RentalPaymentQueryDto),
      ).rejects.toThrow();
    expect(list).not.toHaveBeenCalled();
  });
  it('paginates a bounded database set without deriving total from visible rows', async () => {
    const f = rentalTestFixture();
    const row = f.seed(RentalPayment, {
      id: '50',
      property_id: '10',
      reservation_id: '40',
      amount: '9007199254740993',
      type: 'payment',
      status: 'confirmed',
      occurred_on: '2026-10-01',
      notes: null,
      method: null,
      reference: null,
      created_by: '1',
      updated_by: '1',
      created_at: new Date(),
      updated_at: new Date(),
    });
    const service = new RentalPaymentService();
    vi.spyOn(service, 'list').mockResolvedValue([[row], 25]);
    const useCase = new GetRentalPaymentsUseCase(f.tx, service);
    const result = await useCase.execute(
      '1',
      '10',
      {} as RentalPaymentQueryDto,
    );
    expect(result.meta).toEqual({
      page: 1,
      limit: 10,
      total_items: 25,
      total_pages: 3,
    });
    expect(result.data[0].amount).toBe('9007199254740993');
    await expect(
      useCase.execute('3', '10', {} as RentalPaymentQueryDto),
    ).rejects.toThrow('rental:not_found');
  });
  it('does not leak another property by an otherwise valid payment ID', async () => {
    const f = rentalTestFixture();
    f.seed(RentalPayment, {
      id: '50',
      property_id: '99',
      reservation_id: '40',
    });
    const useCase = new GetRentalPaymentUseCase(
      f.tx,
      new RentalPaymentService(),
    );
    await expect(useCase.execute('1', '10', '50')).rejects.toThrow(
      'rental:not_found',
    );
    await expect(useCase.execute('1', '10', '00')).rejects.toThrow(
      'rental:invalid_input',
    );
  });
});
