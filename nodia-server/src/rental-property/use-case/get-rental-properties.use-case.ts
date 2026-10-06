import { Injectable, UnauthorizedException } from '@nestjs/common';
import { RentalTransactionService } from '../../rental-common/rental-transaction.service.js';
import { RentalPropertyService } from '../rental-property.service.js';
import { RentalConfigurationQueryDto } from '../dto/rental-configuration-query.dto.js';
import {
  configurationCommand,
  configurationId,
} from '../dto/configuration-validation.js';
import {
  configurationPage,
  validateConfigurationQuery,
} from '../types/rental-configuration.types.js';
import { rentalPropertyResponse } from '../types/rental-property.types.js';

@Injectable()
export class GetRentalPropertiesUseCase {
  constructor(
    private readonly transactions: RentalTransactionService,
    private readonly service: RentalPropertyService,
  ) {}
  async execute(actorId: string, input: RentalConfigurationQueryDto) {
    if (!configurationId(actorId))
      throw new UnauthorizedException('rental:not_found');
    const query = await configurationCommand(
      RentalConfigurationQueryDto,
      input,
    );
    validateConfigurationQuery(query, 'property');
    return this.transactions.list(actorId, async (manager) => {
      const [rows, total] = await this.service.findPage(
        manager,
        actorId,
        query,
      );
      return configurationPage(
        rows.map((row) =>
          rentalPropertyResponse(row, row.owner_id === actorId),
        ),
        total,
        query,
      );
    });
  }
}
