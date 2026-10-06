import { Injectable } from '@nestjs/common';
import { RentalTransactionService } from '../../rental-common/rental-transaction.service.js';
import { RentalCancellationPolicyService } from '../rental-cancellation-policy.service.js';
import { RentalConfigurationQueryDto } from '../../rental-property/dto/rental-configuration-query.dto.js';
import { configurationCommand } from '../../rental-property/dto/configuration-validation.js';
import {
  configurationPage,
  validateConfigurationQuery,
} from '../../rental-property/types/rental-configuration.types.js';
import { rentalCancellationPolicyResponse } from '../types/rental-cancellation-policy.types.js';

@Injectable()
export class GetRentalCancellationPoliciesUseCase {
  constructor(
    private readonly transactions: RentalTransactionService,
    private readonly service: RentalCancellationPolicyService,
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
    validateConfigurationQuery(query, 'policy');
    return this.transactions.read(actorId, propertyId, async (ctx) => {
      const [rows, total] = await this.service.findPage(
        ctx.manager,
        propertyId,
        query,
      );
      const rules = await this.service.rulesForPolicies(
        ctx.manager,
        propertyId,
        rows.map((row) => row.id),
      );
      return configurationPage(
        rows.map((row) => rentalCancellationPolicyResponse(row, rules)),
        total,
        query,
      );
    });
  }
}
