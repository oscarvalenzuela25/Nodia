import { describe, expect, it } from 'vitest';
import { GetRentalAuditEventsUseCase } from './get-rental-audit-events.use-case.js';
import { RentalAuditService } from '../rental-audit.service.js';
import { RentalAuditEvent } from '../entities/rental-audit-event.entity.js';
import { RentalCollaborator } from '../../rental-collaborator/entities/rental-collaborator.entity.js';
import { rentalTestFixture } from '../../rental-payment/use-case/rental-test-fixture.js';
import { RentalAuditQueryDto } from '../dto/rental-audit-query.dto.js';

describe('Rental audit access and public query', () => {
  it('projects the audit event and serializes timestamps within the house scope', async () => {
    const f = rentalTestFixture();
    f.seed(RentalAuditEvent, {
      id: '60',
      property_id: '10',
      actor_id: '2',
      action: 'payment.create',
      resource_type: 'payment',
      resource_id: '50',
      changes: { amount: '40000' },
      created_at: new Date('2026-10-01T12:00:00Z'),
    });
    const event = f.table(RentalAuditEvent)[0];
    const service = new RentalAuditService();
    // SQL pagination is covered by the PostgreSQL integration, not this double.
    service.page = async () => [
      [Object.assign(new RentalAuditEvent(), event)],
      1,
    ];
    const result = await new GetRentalAuditEventsUseCase(f.tx, service).execute(
      '2',
      '10',
      new RentalAuditQueryDto(),
    );
    expect(result.data[0]).toEqual({
      ...event,
      created_at: '2026-10-01T12:00:00.000Z',
    });
    expect(result.meta.total_items).toBe(1);
  });
  it('rejects outsiders and revoked members before loading history', async () => {
    const f = rentalTestFixture(),
      service = new RentalAuditService();
    service.page = async () => {
      throw new Error('History must not be loaded');
    };
    const useCase = new GetRentalAuditEventsUseCase(f.tx, service);
    await expect(
      useCase.execute('3', '10', new RentalAuditQueryDto()),
    ).rejects.toThrow('rental:not_found');
    f.table(RentalCollaborator)[0].is_active = false;
    await expect(
      useCase.execute('2', '10', new RentalAuditQueryDto()),
    ).rejects.toThrow('rental:not_found');
  });
  it('rejects authority filters, unknown actions and unpaired windows', async () => {
    const f = rentalTestFixture(),
      useCase = new GetRentalAuditEventsUseCase(f.tx, new RentalAuditService());
    for (const input of [
      { q: { actor_id_eq: '1' } },
      { action: 'audit.delete' },
      { from_at: '2026-10-01T12:00:00Z' },
    ])
      await expect(
        useCase.execute('1', '10', input as RentalAuditQueryDto),
      ).rejects.toThrow('rental:invalid_input');
  });
});
