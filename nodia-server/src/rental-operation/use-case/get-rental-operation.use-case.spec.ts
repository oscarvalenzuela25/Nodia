import { describe, expect, it } from 'vitest';
import { GetRentalOperationUseCase } from './get-rental-operation.use-case.js';
import { CreateRentalPaymentUseCase } from '../../rental-payment/use-case/create-rental-payment.use-case.js';
import { RentalPaymentService } from '../../rental-payment/rental-payment.service.js';
import {
  rentalTestFixture,
  rentalKey,
} from '../../rental-payment/use-case/rental-test-fixture.js';
import { RentalOperation } from '../entities/rental-operation.entity.js';
import { RentalCollaborator } from '../../rental-collaborator/entities/rental-collaborator.entity.js';

async function recorded() {
  const fixture = rentalTestFixture();
  const result = await new CreateRentalPaymentUseCase(
    fixture.tx,
    new RentalPaymentService(),
  ).execute(
    '2',
    '10',
    {
      reservation_id: '40',
      type: 'payment',
      amount: '40000',
      occurred_on: '2026-10-01',
      notes: 'PRIVATE-MARKER',
    },
    rentalKey,
  );
  return {
    ...fixture,
    result,
    useCase: new GetRentalOperationUseCase(fixture.tx),
  };
}
describe('Recover a rental intent', () => {
  it('recovers the original acknowledgement without the payment body or private notes', async () => {
    const f = await recorded();
    const result = await f.useCase.execute('2', '10', rentalKey);
    expect(result).toEqual({
      schema_version: 1,
      http_status: 201,
      body: f.result,
    });
    expect(JSON.stringify(result)).not.toContain('PRIVATE-MARKER');
    expect(f.table(RentalOperation)).toHaveLength(1);
  });
  it('does not give an owner another actor’s operation', async () => {
    const f = await recorded();
    await expect(f.useCase.execute('1', '10', rentalKey)).rejects.toThrow(
      'rental:not_found',
    );
  });
  it('checks current membership before returning a recorded success', async () => {
    const f = await recorded();
    f.table(RentalCollaborator)[0].is_active = false;
    await expect(f.useCase.execute('2', '10', rentalKey)).rejects.toThrow(
      'rental:not_found',
    );
  });
  it('rejects another house and invalid intent keys', async () => {
    const f = await recorded();
    await expect(f.useCase.execute('2', '11', rentalKey)).rejects.toThrow(
      'rental:not_found',
    );
    expect(() => f.useCase.execute('2', '10', 'invalid')).toThrow(
      'rental:invalid_input',
    );
  });
  it('fails closed when a stored acknowledgement contains extra private fields', async () => {
    const f = await recorded();
    const response = f.table(RentalOperation)[0].response as {
      body: Record<string, unknown>;
    };
    response.body.notes = 'PRIVATE-MARKER';
    await expect(f.useCase.execute('2', '10', rentalKey)).rejects.toThrow(
      'rental:server_error',
    );
  });
  it('fails closed when a stored response changes resource or HTTP status', async () => {
    const f = await recorded();
    const response = f.table(RentalOperation)[0].response as {
      http_status: number;
      body: Record<string, unknown>;
    };
    response.http_status = 200;
    await expect(f.useCase.execute('2', '10', rentalKey)).rejects.toThrow(
      'rental:server_error',
    );
    response.http_status = 201;
    response.body.resource_type = 'expense';
    await expect(f.useCase.execute('2', '10', rentalKey)).rejects.toThrow(
      'rental:server_error',
    );
  });
});
