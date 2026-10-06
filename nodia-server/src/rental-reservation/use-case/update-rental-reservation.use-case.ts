import { Injectable, ConflictException } from '@nestjs/common';
import { RentalTransactionService } from '../../rental-common/rental-transaction.service.js';
import {
  validateRentalDto,
  requireNonEmptyUpdate,
} from '../../rental-common/rental-validation.js';
import { reconcileNeighbors } from '../../rental-common/rental-calendar.rules.js';
import { UpdateRentalReservationDto } from '../dto/update-rental-reservation.dto.js';
import { RentalReservationService } from '../rental-reservation.service.js';
import { validateAgreement } from '../types/rental-reservation.rules.js';

@Injectable()
export class UpdateRentalReservationUseCase {
  constructor(
    private readonly transactions: RentalTransactionService,
    private readonly reservations: RentalReservationService,
  ) {}
  async execute(
    actorId: string,
    propertyId: string,
    id: string,
    input: UpdateRentalReservationDto,
    requestKey: string,
  ) {
    const dto = await validateRentalDto(UpdateRentalReservationDto, input);
    requireNonEmptyUpdate(dto);
    return this.transactions.mutate(
      {
        actorId,
        propertyId,
        requestKey,
        operation: 'reservation.update',
        resourceId: id,
        command: dto,
      },
      async (ctx) => {
        const row = await this.reservations.find(
          ctx.manager,
          propertyId,
          id,
          true,
        );
        const flexible =
          row.status === 'draft' &&
          !(await this.reservations.hasMoney(ctx.manager, propertyId, id));
        const keys = Object.keys(dto).filter(
          (key) => dto[key as keyof typeof dto] !== undefined,
        );
        if (
          !flexible &&
          keys.some(
            (key) =>
              !['guest_name', 'guest_contact', 'notes', 'is_active'].includes(
                key,
              ),
          )
        )
          throw new ConflictException('rental:agreement_immutable');
        if (
          !ctx.property.is_active &&
          keys.some(
            (key) =>
              !['guest_name', 'guest_contact', 'notes', 'is_active'].includes(
                key,
              ),
          )
        )
          throw new ConflictException('rental:property_inactive');
        const previousInterval = `${row.check_in_on}|${row.check_out_on}|${row.check_in_time}|${row.check_out_time}`;
        for (const key of keys) {
          if (key === 'deposit_due_at' || key === 'balance_due_at')
            row[key] = dto[key] ? new Date(dto[key]) : null;
          else Object.assign(row, { [key]: dto[key as keyof typeof dto] });
        }
        if (flexible) {
          await this.reservations.assertPolicy(
            ctx.manager,
            propertyId,
            row.cancellation_policy_id,
          );
          row.total_amount = validateAgreement(ctx.property, row);
        }
        row.updated_by = actorId;
        const saved = await this.reservations.save(ctx.manager, row);
        if (
          flexible &&
          previousInterval !==
            `${row.check_in_on}|${row.check_out_on}|${row.check_in_time}|${row.check_out_time}`
        ) {
          await ctx.manager.query(
            "UPDATE rental_turnovers SET same_day_approved_at=NULL, ready_at=NULL, cleaning_status='pending', updated_by=$1, updated_at=now() WHERE property_id=$2 AND incoming_reservation_id=$3",
            [actorId, propertyId, id],
          );
          await reconcileNeighbors(ctx, [], saved);
        }
        return {
          resource_id: id,
          resource_type: 'reservation',
          status: saved.status,
          updated_at: saved.updated_at,
          changes: { fields: keys },
        };
      },
    );
  }
}
