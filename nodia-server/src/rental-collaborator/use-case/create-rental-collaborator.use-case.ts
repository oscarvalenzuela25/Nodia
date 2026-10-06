import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RentalTransactionService } from '../../rental-common/rental-transaction.service.js';
import { RentalCollaboratorService } from '../rental-collaborator.service.js';
import { CreateRentalCollaboratorDto } from '../dto/create-rental-collaborator.dto.js';
import { configurationCommand } from '../../rental-property/dto/configuration-validation.js';

@Injectable()
export class CreateRentalCollaboratorUseCase {
  constructor(
    private readonly transactions: RentalTransactionService,
    private readonly service: RentalCollaboratorService,
  ) {}
  async execute(
    actorId: string,
    propertyId: string,
    input: CreateRentalCollaboratorDto,
    requestKey: string,
  ) {
    const dto = await configurationCommand(CreateRentalCollaboratorDto, input);
    const command = {
      ...dto,
      position: dto.position ?? null,
      is_active: dto.is_active ?? true,
    };
    return this.transactions.mutate(
      {
        actorId,
        propertyId,
        requestKey,
        operation: 'collaborator.create',
        resourceId: null,
        command,
        ownerOnly: true,
      },
      async (ctx) => {
        if (!ctx.property.is_active || dto.user_id === ctx.property.owner_id)
          throw new ConflictException('rental:invalid_transition');
        if (!(await this.service.findUser(ctx.manager, dto.user_id)))
          throw new NotFoundException('rental:not_found');
        if (await this.service.findByUser(ctx.manager, propertyId, dto.user_id))
          throw new ConflictException('rental:invalid_transition');
        const saved = await this.service.insert(ctx.manager, {
          ...command,
          property_id: propertyId,
          created_by: actorId,
          updated_by: actorId,
          created_at: ctx.now,
          updated_at: ctx.now,
        });
        return {
          resource_id: saved.id,
          resource_type: 'collaborator',
          status: saved.is_active ? 'active' : 'inactive',
          updated_at: saved.updated_at,
          changes: command,
        };
      },
    );
  }
}
