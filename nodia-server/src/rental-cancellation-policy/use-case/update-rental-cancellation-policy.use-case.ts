import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RentalTransactionService } from '../../rental-common/rental-transaction.service.js';
import { RentalCancellationPolicyService } from '../rental-cancellation-policy.service.js';
import { UpdateRentalCancellationPolicyDto } from '../dto/update-rental-cancellation-policy.dto.js';
import { configurationCommand } from '../../rental-property/dto/configuration-validation.js';
import { normalizedCancellationRules } from '../types/rental-cancellation-policy.types.js';

@Injectable()
export class UpdateRentalCancellationPolicyUseCase {
  constructor(
    private readonly transactions: RentalTransactionService,
    private readonly service: RentalCancellationPolicyService,
  ) {}
  async execute(
    actorId: string,
    propertyId: string,
    id: string,
    input: UpdateRentalCancellationPolicyDto,
    requestKey: string,
  ) {
    const dto = await configurationCommand(
      UpdateRentalCancellationPolicyDto,
      input,
      true,
    );
    if (dto.rules !== undefined)
      dto.rules = normalizedCancellationRules(dto.rules);
    return this.transactions.mutate(
      {
        actorId,
        propertyId,
        requestKey,
        operation: 'policy.update',
        resourceId: id,
        command: dto,
        ownerOnly: true,
      },
      async (ctx) => {
        const row = await this.service.find(ctx.manager, propertyId, id);
        if (!row) throw new NotFoundException('rental:not_found');
        if (
          dto.is_active === false &&
          ctx.property.default_cancellation_policy_id === id
        )
          throw new ConflictException('rental:invalid_transition');
        if (dto.name !== undefined) row.name = dto.name;
        if (dto.is_active !== undefined) row.is_active = dto.is_active;
        row.updated_by = actorId;
        row.updated_at = ctx.now;
        const saved = await this.service.save(ctx.manager, row);
        if (dto.rules !== undefined)
          await this.service.replaceRules(
            ctx.manager,
            propertyId,
            id,
            dto.rules,
            actorId,
            ctx.now,
          );
        return {
          resource_id: saved.id,
          resource_type: 'policy',
          status: saved.is_active ? 'active' : 'inactive',
          updated_at: saved.updated_at,
          changes: { ...dto },
        };
      },
    );
  }
}
