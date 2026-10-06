import { ConflictException, Injectable } from '@nestjs/common';
import { RentalTransactionService } from '../../rental-common/rental-transaction.service.js';
import { RentalCancellationPolicyService } from '../rental-cancellation-policy.service.js';
import { CreateRentalCancellationPolicyDto } from '../dto/create-rental-cancellation-policy.dto.js';
import { configurationCommand } from '../../rental-property/dto/configuration-validation.js';
import { normalizedCancellationRules } from '../types/rental-cancellation-policy.types.js';

@Injectable()
export class CreateRentalCancellationPolicyUseCase {
  constructor(
    private readonly transactions: RentalTransactionService,
    private readonly service: RentalCancellationPolicyService,
  ) {}
  async execute(
    actorId: string,
    propertyId: string,
    input: CreateRentalCancellationPolicyDto,
    requestKey: string,
  ) {
    const dto = await configurationCommand(
      CreateRentalCancellationPolicyDto,
      input,
    );
    const command = {
      ...dto,
      is_active: dto.is_active ?? true,
      rules: normalizedCancellationRules(dto.rules),
    };
    return this.transactions.mutate(
      {
        actorId,
        propertyId,
        requestKey,
        operation: 'policy.create',
        resourceId: null,
        command,
        ownerOnly: true,
      },
      async (ctx) => {
        if (!ctx.property.is_active)
          throw new ConflictException('rental:invalid_transition');
        const row = await this.service.insert(ctx.manager, {
          name: command.name,
          is_active: command.is_active,
          property_id: propertyId,
          created_by: actorId,
          updated_by: actorId,
          created_at: ctx.now,
          updated_at: ctx.now,
        });
        await this.service.replaceRules(
          ctx.manager,
          propertyId,
          row.id,
          command.rules,
          actorId,
          ctx.now,
        );
        return {
          resource_id: row.id,
          resource_type: 'policy',
          status: row.is_active ? 'active' : 'inactive',
          updated_at: row.updated_at,
          changes: command,
        };
      },
    );
  }
}
