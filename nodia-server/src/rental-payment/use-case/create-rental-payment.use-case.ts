import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RentalTransactionService } from '../../rental-common/rental-transaction.service.js';
import { validateRentalDto } from '../../rental-common/rental-validation.js';
import {
  capturePolicySnapshot,
  paymentTotals,
} from '../../rental-common/rental-money.js';
import { formatLocalOn } from '../../rental-common/rental-time.js';
import { RentalPaymentService } from '../rental-payment.service.js';
import { CreateRentalPaymentDto } from '../dto/rental-payment.dto.js';

@Injectable()
export class CreateRentalPaymentUseCase {
  constructor(
    private readonly tx: RentalTransactionService,
    private readonly payments: RentalPaymentService,
  ) {}

  async execute(
    actorId: string,
    propertyId: string,
    input: CreateRentalPaymentDto,
    requestKey: string,
  ) {
    const dto = await validateRentalDto(CreateRentalPaymentDto, input);
    const command = {
      ...dto,
      method: dto.method ?? null,
      reference: dto.reference ?? null,
      notes: dto.notes ?? null,
    };
    return this.tx.mutate(
      {
        actorId,
        propertyId,
        requestKey,
        operation: 'payment.create',
        resourceId: null,
        command,
      },
      async (ctx) => {
        const reservation = await this.payments.reservation(
          ctx.manager,
          propertyId,
          dto.reservation_id,
        );
        if (!reservation) throw new NotFoundException('rental:not_found');
        const today = formatLocalOn(ctx.now, ctx.property.timezone);
        if (dto.occurred_on > today)
          throw new BadRequestException('rental:invalid_input');
        const totals = await paymentTotals(
          ctx.manager,
          propertyId,
          reservation.id,
        );
        const amount = BigInt(dto.amount);
        if (dto.type === 'payment') {
          if (reservation.status === 'cancelled')
            throw new ConflictException('rental:invalid_transition');
          const expected =
            BigInt(reservation.total_amount) -
            BigInt(reservation.commission_amount);
          if (totals.received + amount > expected)
            throw new ConflictException('rental:overpayment');
          if (
            reservation.channel !== 'airbnb' &&
            (BigInt(reservation.deposit_amount) <= 0n ||
              BigInt(reservation.deposit_amount) > expected)
          )
            throw new ConflictException('rental:deposit_required');
          if (
            dto.platform_policy &&
            (reservation.channel !== 'airbnb' ||
              reservation.status !== 'draft' ||
              reservation.policy_snapshot !== null)
          )
            throw new BadRequestException('rental:invalid_input');
          if (!reservation.policy_snapshot) {
            reservation.policy_snapshot = await capturePolicySnapshot(
              ctx,
              reservation,
              dto.platform_policy,
            );
            reservation.updated_by = actorId;
            reservation.updated_at = ctx.now;
            await this.payments.saveReservation(ctx.manager, reservation);
          }
        } else {
          if (dto.platform_policy)
            throw new BadRequestException('rental:invalid_input');
          if (
            reservation.status !== 'cancelled' ||
            reservation.refund_amount === null
          )
            throw new ConflictException('rental:invalid_transition');
          if (
            amount + totals.refunded > BigInt(reservation.refund_amount) ||
            amount + totals.refunded > totals.received
          )
            throw new ConflictException('rental:refund_exceeds_approved');
          if (
            !reservation.cancelled_at ||
            dto.occurred_on <
              formatLocalOn(reservation.cancelled_at, ctx.property.timezone)
          )
            throw new BadRequestException('rental:invalid_input');
        }
        const saved = await this.payments.save(ctx.manager, {
          property_id: propertyId,
          reservation_id: reservation.id,
          type: dto.type,
          amount: dto.amount,
          occurred_on: dto.occurred_on,
          method: dto.method ?? null,
          reference: dto.reference ?? null,
          notes: dto.notes ?? null,
          status: 'confirmed',
          created_by: actorId,
          updated_by: actorId,
          created_at: ctx.now,
          updated_at: ctx.now,
        });
        return {
          resource_id: saved.id,
          resource_type: 'payment',
          status: saved.status,
          updated_at: saved.updated_at,
          changes: {
            reservation_id: reservation.id,
            type: dto.type,
            amount: dto.amount,
            occurred_on: dto.occurred_on,
            status: saved.status,
          },
        };
      },
    );
  }
}
