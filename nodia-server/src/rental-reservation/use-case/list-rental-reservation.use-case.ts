import { Injectable } from '@nestjs/common';
import { RentalTransactionService } from '../../rental-common/rental-transaction.service.js';
import { validateRentalDto } from '../../rental-common/rental-validation.js';
import {
  pageResult,
  validateRentalQuery,
} from '../../rental-common/rental-query.js';
import { RentalReservationQueryDto } from '../dto/rental-reservation-query.dto.js';
import { RentalReservationService } from '../rental-reservation.service.js';
import { projectReservation } from '../types/rental-reservation.projection.js';
@Injectable()
export class ListRentalReservationUseCase {
  constructor(
    private readonly transactions: RentalTransactionService,
    private readonly reservations: RentalReservationService,
  ) {}
  async execute(
    actorId: string,
    propertyId: string,
    input: RentalReservationQueryDto,
  ) {
    const query = await validateRentalDto(RentalReservationQueryDto, input);
    validateRentalQuery(query, 'reservations');
    return this.transactions.read(actorId, propertyId, async (ctx) => {
      const [rows, count] = await this.reservations.list(
        ctx.manager,
        propertyId,
        query,
      );
      const sums = await this.reservations.summaries(
        ctx.manager,
        propertyId,
        rows.map((r) => r.id),
      );
      return pageResult(
        rows.map((r) =>
          projectReservation(r, ctx.property.timezone, sums.get(r.id)!),
        ),
        count,
        query,
      );
    });
  }
}
