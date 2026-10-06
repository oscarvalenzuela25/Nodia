import { Injectable } from '@nestjs/common';
import { RentalTransactionService } from '../../rental-common/rental-transaction.service.js';
import { RentalCollaboratorService } from '../rental-collaborator.service.js';
import { RentalCollaboratorCandidatesQueryDto } from '../../rental-property/dto/rental-configuration-query.dto.js';
import { configurationCommand } from '../../rental-property/dto/configuration-validation.js';
import { configurationPage } from '../../rental-property/types/rental-configuration.types.js';

@Injectable()
export class GetRentalCollaboratorCandidatesUseCase {
  constructor(
    private readonly transactions: RentalTransactionService,
    private readonly service: RentalCollaboratorService,
  ) {}
  async execute(
    actorId: string,
    propertyId: string,
    input: RentalCollaboratorCandidatesQueryDto,
  ) {
    const query = await configurationCommand(
      RentalCollaboratorCandidatesQueryDto,
      input,
    );
    return this.transactions.read(
      actorId,
      propertyId,
      async (ctx) => {
        const [rows, total] = await this.service.candidates(
          ctx.manager,
          propertyId,
          ctx.property.owner_id,
          query,
        );
        return configurationPage(
          rows.map((row) => ({
            id: row.id,
            name: row.name,
            image_url: row.image_url ?? null,
          })),
          total,
          query,
        );
      },
      true,
    );
  }
}
