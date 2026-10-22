import type { ActorReference } from '../../authorization/authority-transaction.js';
import { Injectable } from '@nestjs/common';
import { RentalTransactionService } from '../../rental-common/rental-transaction.service.js';
import { validateRentalDto } from '../../rental-common/rental-validation.js';
import { PreviewRentalCancellationDto } from '../dto/reservation-commands.dto.js';
import { RentalReservationService } from '../rental-reservation.service.js';
import { cancellationCalculation } from '../types/rental-cancellation.rules.js';
@Injectable()
export class PreviewRentalCancellationUseCase {
  constructor(
    private readonly transactions: RentalTransactionService,
    private readonly reservations: RentalReservationService,
  ) {}
  async execute(
    actor: ActorReference,
    propertyId: string,
    id: string,
    input: PreviewRentalCancellationDto,
  ) {
    const dto = await validateRentalDto(PreviewRentalCancellationDto, input);
    return this.transactions.read(actor, propertyId, async (ctx) =>
      cancellationCalculation(
        ctx,
        await this.reservations.find(ctx.manager, propertyId, id),
        dto,
      ),
    );
  }
}
