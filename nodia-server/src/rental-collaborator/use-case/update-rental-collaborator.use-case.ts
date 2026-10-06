import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RentalTransactionService } from '../../rental-common/rental-transaction.service.js';
import { RentalCollaboratorService } from '../rental-collaborator.service.js';
import { UpdateRentalCollaboratorDto } from '../dto/update-rental-collaborator.dto.js';
import { configurationCommand } from '../../rental-property/dto/configuration-validation.js';

@Injectable()
export class UpdateRentalCollaboratorUseCase {
  constructor(
    private readonly transactions: RentalTransactionService,
    private readonly service: RentalCollaboratorService,
  ) {}
  async execute(
    actorId: string,
    propertyId: string,
    id: string,
    input: UpdateRentalCollaboratorDto,
    requestKey: string,
  ) {
    const dto = await configurationCommand(
      UpdateRentalCollaboratorDto,
      input,
      true,
    );
    return this.transactions.mutate(
      {
        actorId,
        propertyId,
        requestKey,
        operation: 'collaborator.update',
        resourceId: id,
        command: dto,
        ownerOnly: true,
      },
      async (ctx) => {
        const row = await this.service.find(ctx.manager, propertyId, id);
        if (!row) throw new NotFoundException('rental:not_found');
        if (dto.is_active === true && !row.is_active) {
          if (!ctx.property.is_active)
            throw new ConflictException('rental:invalid_transition');
          if (!(await this.service.findUser(ctx.manager, row.user_id)))
            throw new NotFoundException('rental:not_found');
        }
        Object.assign(
          row,
          Object.fromEntries(
            Object.entries(dto).filter(([, value]) => value !== undefined),
          ),
          { updated_by: actorId, updated_at: ctx.now },
        );
        const saved = await this.service.save(ctx.manager, row);
        return {
          resource_id: saved.id,
          resource_type: 'collaborator',
          status: saved.is_active ? 'active' : 'inactive',
          updated_at: saved.updated_at,
          changes: { ...dto },
        };
      },
    );
  }
}
