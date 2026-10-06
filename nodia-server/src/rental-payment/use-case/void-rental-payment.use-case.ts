import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RentalTransactionService } from '../../rental-common/rental-transaction.service.js';
import { validateRentalDto } from '../../rental-common/rental-validation.js';
import { paymentTotals } from '../../rental-common/rental-money.js';
import { RentalPaymentService } from '../rental-payment.service.js';
import { VoidRentalPaymentDto } from '../dto/rental-payment.dto.js';

@Injectable()
export class VoidRentalPaymentUseCase {
  constructor(
    private readonly tx: RentalTransactionService,
    private readonly payments: RentalPaymentService,
  ) {}

  async execute(
    actorId: string,
    propertyId: string,
    id: string,
    input: VoidRentalPaymentDto,
    requestKey: string,
  ) {
    const dto = await validateRentalDto(VoidRentalPaymentDto, input);
    return this.tx.mutate(
      {
        actorId,
        propertyId,
        requestKey,
        operation: 'payment.void',
        resourceId: id,
        command: dto,
      },
      async (ctx) => {
        const payment = await this.payments.find(ctx.manager, propertyId, id);
        if (!payment) throw new NotFoundException('rental:not_found');
        const reservation = await this.payments.reservation(
          ctx.manager,
          propertyId,
          payment.reservation_id,
        );
        if (!reservation) throw new NotFoundException('rental:not_found');
        if (payment.status !== 'confirmed')
          throw new ConflictException('rental:invalid_transition');
        if (payment.type === 'payment') {
          if (reservation.status === 'cancelled')
            throw new ConflictException('rental:invalid_transition');
          const totals = await paymentTotals(
            ctx.manager,
            propertyId,
            reservation.id,
          );
          if (
            reservation.channel !== 'airbnb' &&
            reservation.status !== 'draft' &&
            totals.received - BigInt(payment.amount) <
              BigInt(reservation.deposit_amount)
          )
            throw new ConflictException('rental:deposit_required');
        } else if (reservation.status !== 'cancelled')
          throw new ConflictException('rental:invalid_transition');
        const saved = await this.payments.save(ctx.manager, {
          ...payment,
          status: 'voided',
          updated_by: actorId,
          updated_at: ctx.now,
        });
        return {
          resource_id: saved.id,
          resource_type: 'payment',
          status: saved.status,
          updated_at: saved.updated_at,
          changes: {
            status: { before: 'confirmed', after: 'voided' },
            reservation_id: reservation.id,
            type: payment.type,
            amount: payment.amount,
            reason: dto.reason,
          },
        };
      },
    );
  }
}
