import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RentalTransactionService } from '../../rental-common/rental-transaction.service.js';
import { RentalPropertyService } from '../rental-property.service.js';
import { UpdateRentalPropertyDto } from '../dto/update-rental-property.dto.js';
import {
  configurationCommand,
  normalizeConfigurationPercent,
} from '../dto/configuration-validation.js';

@Injectable()
export class UpdateRentalPropertyUseCase {
  constructor(
    private readonly transactions: RentalTransactionService,
    private readonly service: RentalPropertyService,
  ) {}
  async execute(
    actorId: string,
    propertyId: string,
    input: UpdateRentalPropertyDto,
    requestKey: string,
  ) {
    const dto = await configurationCommand(
      UpdateRentalPropertyDto,
      input,
      true,
    );
    if (dto.default_deposit_percent != null)
      dto.default_deposit_percent = normalizeConfigurationPercent(
        dto.default_deposit_percent,
      );
    return this.transactions.mutate(
      {
        actorId,
        propertyId,
        requestKey,
        operation: 'property.update',
        resourceId: propertyId,
        command: dto,
        ownerOnly: true,
      },
      async (ctx) => {
        const property = ctx.property;
        if (
          dto.timezone !== undefined &&
          dto.timezone !== property.timezone &&
          (await this.service.hasHistory(ctx.manager, propertyId))
        )
          throw new ConflictException('rental:agreement_immutable');
        if (
          dto.max_guests !== undefined &&
          dto.max_guests < property.max_guests &&
          dto.max_guests <
            (await this.service.maximumCurrentGuests(
              ctx.manager,
              property,
              ctx.now,
            ))
        )
          throw new ConflictException('rental:invalid_transition');
        if (
          dto.minimum_turnover_minutes !== undefined &&
          dto.minimum_turnover_minutes > property.minimum_turnover_minutes
        ) {
          const minimumMs = dto.minimum_turnover_minutes * 60000;
          for (const row of await this.service.pendingApprovedTransitions(
            ctx.manager,
            property,
            ctx.now,
          )) {
            const earliest = row.previous_out.getTime() + minimumMs;
            if (
              !row.linen_ready ||
              !row.planned_ready_at ||
              row.incoming_at.getTime() < earliest ||
              row.planned_ready_at.getTime() < earliest ||
              row.planned_ready_at > row.incoming_at
            )
              throw new ConflictException('rental:turnover_required');
          }
        }
        if (dto.default_cancellation_policy_id != null) {
          const policy = await this.service.findPolicy(
            ctx.manager,
            propertyId,
            dto.default_cancellation_policy_id,
          );
          if (!policy) throw new NotFoundException('rental:not_found');
          if (!policy.is_active)
            throw new ConflictException('rental:invalid_transition');
        }
        const changes: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(dto))
          if (value !== undefined)
            changes[key] = key === 'notes' ? { redacted: true } : value;
        Object.assign(
          property,
          Object.fromEntries(
            Object.entries(dto).filter(([, value]) => value !== undefined),
          ),
          { updated_by: actorId, updated_at: ctx.now },
        );
        const saved = await this.service.save(ctx.manager, property);
        return {
          resource_id: saved.id,
          resource_type: 'property',
          status: saved.is_active ? 'active' : 'inactive',
          updated_at: saved.updated_at,
          changes,
        };
      },
    );
  }
}
