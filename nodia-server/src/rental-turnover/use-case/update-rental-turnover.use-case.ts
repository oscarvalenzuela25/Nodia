import type { ActorReference } from '../../authorization/authority-transaction.js';
import { Injectable } from '@nestjs/common';
import { RentalTransactionService } from '../../rental-common/rental-transaction.service.js';
import {
  validateRentalDto,
  requireNonEmptyUpdate,
} from '../../rental-common/rental-validation.js';
import {
  calendarStay,
  immediateNeighbors,
} from '../../rental-common/rental-calendar.rules.js';
import { RentalTurnoverService } from '../rental-turnover.service.js';
import { UpdateRentalTurnoverDto } from '../dto/update-rental-turnover.dto.js';
import { applyRentalTurnoverUpdate } from '../types/rental-turnover.rules.js';
@Injectable()
export class UpdateRentalTurnoverUseCase {
  constructor(
    private readonly transactions: RentalTransactionService,
    private readonly turnovers: RentalTurnoverService,
  ) {}
  async execute(
    actor: ActorReference,
    propertyId: string,
    id: string,
    input: UpdateRentalTurnoverDto,
    requestKey: string,
  ) {
    const actorId = actor.userId;
    const dto = await validateRentalDto(UpdateRentalTurnoverDto, input);
    requireNonEmptyUpdate(dto);
    return this.transactions.mutate(
      {
        actor,
        propertyId,
        requestKey,
        operation: 'turnover.update',
        resourceId: id,
        command: dto,
      },
      async (ctx) => {
        const original = await this.turnovers.find(ctx.manager, propertyId, id);
        const incoming = calendarStay(
          await this.turnovers.incoming(
            ctx.manager,
            propertyId,
            original.incoming_reservation_id,
          ),
          ctx.property.timezone,
        );
        const { previous } = await immediateNeighbors(ctx, incoming);
        const row = applyRentalTurnoverUpdate(
          original,
          incoming,
          previous,
          ctx.property.minimum_turnover_minutes,
          ctx.now,
          dto,
        );
        const keys = Object.keys(dto).filter(
          (key) => dto[key as keyof typeof dto] !== undefined,
        );
        row.updated_by = actorId;
        const saved = await this.turnovers.save(ctx.manager, row);
        return {
          resource_id: id,
          resource_type: 'turnover',
          status: saved.cleaning_status,
          updated_at: saved.updated_at,
          changes: {
            fields: keys,
            previous_reservation_id: saved.previous_reservation_id,
            same_day_approved_at: saved.same_day_approved_at,
          },
        };
      },
    );
  }
}
