import { Injectable, ConflictException } from '@nestjs/common';
import { RentalTransactionService } from '../../rental-common/rental-transaction.service.js';
import { validateRentalDto } from '../../rental-common/rental-validation.js';
import { reconcileNeighbors } from '../../rental-common/rental-calendar.rules.js';
import { CancelRentalReservationDto } from '../dto/reservation-commands.dto.js';
import { RentalReservationService } from '../rental-reservation.service.js';
import { cancellationCalculation } from '../types/rental-cancellation.rules.js';
@Injectable()
export class CancelRentalReservationUseCase {
  constructor(
    private readonly transactions: RentalTransactionService,
    private readonly reservations: RentalReservationService,
  ) {}
  async execute(
    actorId: string,
    propertyId: string,
    id: string,
    input: CancelRentalReservationDto,
    requestKey: string,
  ) {
    const dto = await validateRentalDto(CancelRentalReservationDto, input);
    return this.transactions.mutate(
      {
        actorId,
        propertyId,
        requestKey,
        operation: 'reservation.cancel',
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
        const preview = await cancellationCalculation(ctx, row, dto);
        if (preview.refund_amount !== dto.expected_refund_amount)
          throw new ConflictException('rental:cancellation_changed');
        const oldStatus = row.status;
        row.status = 'cancelled';
        row.cancelled_at = new Date(dto.cancelled_at);
        row.refund_amount = preview.refund_amount;
        row.cancellation_snapshot = preview.cancellation_snapshot;
        row.updated_by = actorId;
        const saved = await this.reservations.save(ctx.manager, row);
        await reconcileNeighbors(ctx, [], saved);
        return {
          resource_id: id,
          resource_type: 'reservation',
          status: saved.status,
          updated_at: saved.updated_at,
          changes: {
            status: { before: oldStatus, after: 'cancelled' },
            refund_amount: preview.refund_amount,
            cancelled_at: row.cancelled_at,
          },
        };
      },
    );
  }
}
