import type { ActorReference } from '../../authorization/authority-transaction.js';
import { Injectable } from '@nestjs/common';
import { RentalTransactionService } from '../../rental-common/rental-transaction.service.js';
import { RentalReservationService } from '../rental-reservation.service.js';
import { projectReservation } from '../types/rental-reservation.projection.js';
@Injectable()
export class GetRentalReservationUseCase {
  constructor(
    private readonly transactions: RentalTransactionService,
    private readonly reservations: RentalReservationService,
  ) {}
  async execute(actor: ActorReference, propertyId: string, id: string) {
    return this.transactions.read(actor, propertyId, async (ctx) => {
      const row = await this.reservations.find(ctx.manager, propertyId, id);
      const sums = await this.reservations.summaries(ctx.manager, propertyId, [
        id,
      ]);
      return projectReservation(row, ctx.property.timezone, sums.get(id)!);
    });
  }
}
