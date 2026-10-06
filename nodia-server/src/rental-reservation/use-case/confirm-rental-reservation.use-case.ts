import {
  Injectable,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { RentalTransactionService } from '../../rental-common/rental-transaction.service.js';
import { validateRentalDto } from '../../rental-common/rental-validation.js';
import {
  paymentTotals,
  capturePolicySnapshot,
} from '../../rental-common/rental-money.js';
import {
  inspectAvailability,
  reconcileNeighbors,
} from '../../rental-common/rental-calendar.rules.js';
import { ConfirmRentalReservationDto } from '../dto/reservation-commands.dto.js';
import { RentalReservationService } from '../rental-reservation.service.js';
import {
  assertPhase,
  validateAgreement,
} from '../types/rental-reservation.rules.js';
@Injectable()
export class ConfirmRentalReservationUseCase {
  constructor(
    private readonly transactions: RentalTransactionService,
    private readonly reservations: RentalReservationService,
  ) {}
  async execute(
    actorId: string,
    propertyId: string,
    id: string,
    input: ConfirmRentalReservationDto,
    requestKey: string,
  ) {
    const dto = await validateRentalDto(ConfirmRentalReservationDto, input);
    return this.transactions.mutate(
      {
        actorId,
        propertyId,
        requestKey,
        operation: 'reservation.confirm',
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
        assertPhase(row, ['draft']);
        if (!ctx.property.is_active || !row.is_active)
          throw new ConflictException('rental:property_inactive');
        validateAgreement(ctx.property, row);
        const totals = await paymentTotals(ctx.manager, propertyId, id);
        if (row.channel !== 'airbnb') {
          if (dto.platform_policy !== undefined)
            throw new BadRequestException('rental:invalid_platform_agreement');
          if (
            BigInt(row.deposit_amount) <= 0n ||
            totals.received < BigInt(row.deposit_amount)
          )
            throw new ConflictException('rental:deposit_required');
        } else {
          if (!row.external_reference || !dto.platform_policy)
            throw new BadRequestException('rental:invalid_platform_agreement');
          if (
            row.policy_snapshot?.kind === 'platform' &&
            (row.policy_snapshot.platform_reference !==
              dto.platform_policy.reference ||
              row.policy_snapshot.platform_description !==
                dto.platform_policy.description)
          )
            throw new ConflictException('rental:agreement_immutable');
        }
        const availability = await inspectAvailability(ctx, {
          ...row,
          exclude_reservation_id: id,
        });
        if (availability.conflicts.length)
          throw new ConflictException('rental:availability_conflict');
        row.policy_snapshot = await capturePolicySnapshot(
          ctx,
          row,
          dto.platform_policy,
        );
        row.status = 'confirmed';
        row.updated_by = actorId;
        const saved = await this.reservations.save(ctx.manager, row);
        await reconcileNeighbors(ctx, dto.same_day_approvals ?? [], saved);
        return {
          resource_id: id,
          resource_type: 'reservation',
          status: saved.status,
          updated_at: saved.updated_at,
          changes: {
            status: { before: 'draft', after: 'confirmed' },
            approved_turnover_ids: dto.same_day_approvals ?? [],
          },
        };
      },
    );
  }
}
