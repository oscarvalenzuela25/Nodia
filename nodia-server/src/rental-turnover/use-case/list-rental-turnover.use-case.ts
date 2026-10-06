import { Injectable } from '@nestjs/common';
import { RentalTransactionService } from '../../rental-common/rental-transaction.service.js';
import { validateRentalDto } from '../../rental-common/rental-validation.js';
import {
  pageResult,
  validateRentalQuery,
} from '../../rental-common/rental-query.js';
import { RentalTurnoverService } from '../rental-turnover.service.js';
import { RentalTurnoverQueryDto } from '../dto/rental-turnover-query.dto.js';
import { projectTurnover } from '../types/rental-turnover.projection.js';
@Injectable()
export class ListRentalTurnoverUseCase {
  constructor(
    private readonly transactions: RentalTransactionService,
    private readonly turnovers: RentalTurnoverService,
  ) {}
  async execute(
    actorId: string,
    propertyId: string,
    input: RentalTurnoverQueryDto,
  ) {
    const dto = await validateRentalDto(RentalTurnoverQueryDto, input);
    validateRentalQuery(dto, 'turnovers');
    return this.transactions.read(actorId, propertyId, async (ctx) => {
      const [rows, total] = await this.turnovers.list(
        ctx.manager,
        propertyId,
        dto,
      );
      return pageResult(rows.map(projectTurnover), total, dto);
    });
  }
}
