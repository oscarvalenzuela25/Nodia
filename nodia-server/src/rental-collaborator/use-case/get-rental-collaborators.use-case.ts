import { Injectable } from '@nestjs/common';
import { RentalTransactionService } from '../../rental-common/rental-transaction.service.js';
import { RentalCollaboratorService } from '../rental-collaborator.service.js';
import { RentalConfigurationQueryDto } from '../../rental-property/dto/rental-configuration-query.dto.js';
import { configurationCommand } from '../../rental-property/dto/configuration-validation.js';
import {
  configurationPage,
  validateConfigurationQuery,
} from '../../rental-property/types/rental-configuration.types.js';
import { rentalCollaboratorResponse } from '../types/rental-collaborator.types.js';

@Injectable()
export class GetRentalCollaboratorsUseCase {
  constructor(
    private readonly transactions: RentalTransactionService,
    private readonly service: RentalCollaboratorService,
  ) {}
  async execute(
    actorId: string,
    propertyId: string,
    input: RentalConfigurationQueryDto,
  ) {
    const query = await configurationCommand(
      RentalConfigurationQueryDto,
      input,
    );
    validateConfigurationQuery(query, 'collaborator');
    return this.transactions.read(actorId, propertyId, async (ctx) => {
      const [rows, total] = await this.service.findPage(
        ctx.manager,
        propertyId,
        query,
      );
      return configurationPage(
        rows.map(rentalCollaboratorResponse),
        total,
        query,
      );
    });
  }
}
