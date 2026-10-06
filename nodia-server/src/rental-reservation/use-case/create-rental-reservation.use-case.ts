import { Injectable, ConflictException } from '@nestjs/common';
import { RentalTransactionService } from '../../rental-common/rental-transaction.service.js';
import { validateRentalDto } from '../../rental-common/rental-validation.js';
import { RentalTurnover } from '../../rental-turnover/entities/rental-turnover.entity.js';
import {
  calendarStay,
  immediateNeighbors,
} from '../../rental-common/rental-calendar.rules.js';
import { CreateRentalReservationDto } from '../dto/create-rental-reservation.dto.js';
import { RentalReservationService } from '../rental-reservation.service.js';
import { validateAgreement } from '../types/rental-reservation.rules.js';

@Injectable()
export class CreateRentalReservationUseCase {
  constructor(
    private readonly transactions: RentalTransactionService,
    private readonly reservations: RentalReservationService,
  ) {}
  async execute(
    actorId: string,
    propertyId: string,
    input: CreateRentalReservationDto,
    requestKey: string,
  ) {
    const dto = await validateRentalDto(CreateRentalReservationDto, input);
    return this.transactions.mutate(
      {
        actorId,
        propertyId,
        requestKey,
        operation: 'reservation.create',
        resourceId: null,
        command: dto,
      },
      async (ctx) => {
        if (!ctx.property.is_active)
          throw new ConflictException('rental:property_inactive');
        await this.reservations.assertPolicy(
          ctx.manager,
          propertyId,
          dto.cancellation_policy_id ?? null,
        );
        const total = validateAgreement(ctx.property, dto);
        const saved = await this.reservations.save(ctx.manager, {
          ...dto,
          property_id: propertyId,
          external_reference: dto.external_reference ?? null,
          cleaning_fee: dto.cleaning_fee ?? '0',
          discount_amount: dto.discount_amount ?? '0',
          commission_amount: dto.commission_amount ?? '0',
          total_amount: total,
          deposit_due_at: dto.deposit_due_at
            ? new Date(dto.deposit_due_at)
            : null,
          balance_due_at: dto.balance_due_at
            ? new Date(dto.balance_due_at)
            : null,
          cancellation_policy_id: dto.cancellation_policy_id ?? null,
          notes: dto.notes ?? null,
          is_active: dto.is_active ?? true,
          status: 'draft',
          policy_snapshot: null,
          cancelled_at: null,
          cancellation_snapshot: null,
          refund_amount: null,
          created_by: actorId,
          updated_by: actorId,
        });
        const { previous } = await immediateNeighbors(
          ctx,
          calendarStay(saved, ctx.property.timezone),
        );
        await ctx.manager
          .getRepository(RentalTurnover)
          .save({
            property_id: propertyId,
            incoming_reservation_id: saved.id,
            previous_reservation_id: previous?.id ?? null,
            linen_ready: null,
            cleaning_status: 'pending',
            planned_ready_at: null,
            ready_at: null,
            same_day_approved_at: null,
            notes: null,
            created_by: actorId,
            updated_by: actorId,
          });
        return {
          resource_id: saved.id,
          resource_type: 'reservation',
          status: saved.status,
          updated_at: saved.updated_at,
          changes: {
            status: { before: null, after: 'draft' },
            total_amount: total,
          },
        };
      },
    );
  }
}
