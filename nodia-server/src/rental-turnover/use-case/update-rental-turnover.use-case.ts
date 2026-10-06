import { Injectable, BadRequestException } from '@nestjs/common';
import { RentalTransactionService } from '../../rental-common/rental-transaction.service.js';
import {
  validateRentalDto,
  requireNonEmptyUpdate,
} from '../../rental-common/rental-validation.js';
import {
  calendarStay,
  immediateNeighbors,
  refreshPlan,
  planValid,
} from '../../rental-common/rental-calendar.rules.js';
import { RentalTurnoverService } from '../rental-turnover.service.js';
import { UpdateRentalTurnoverDto } from '../dto/update-rental-turnover.dto.js';
@Injectable()
export class UpdateRentalTurnoverUseCase {
  constructor(
    private readonly transactions: RentalTransactionService,
    private readonly turnovers: RentalTurnoverService,
  ) {}
  async execute(
    actorId: string,
    propertyId: string,
    id: string,
    input: UpdateRentalTurnoverDto,
    requestKey: string,
  ) {
    const dto = await validateRentalDto(UpdateRentalTurnoverDto, input);
    requireNonEmptyUpdate(dto);
    return this.transactions.mutate(
      {
        actorId,
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
        const row = refreshPlan(original, previous);
        const keys = Object.keys(dto).filter(
          (key) => dto[key as keyof typeof dto] !== undefined,
        );
        const oldLinen = row.linen_ready;
        const oldPlanned = row.planned_ready_at?.getTime() ?? null;
        for (const key of keys) {
          if (key === 'planned_ready_at' || key === 'ready_at')
            row[key] = dto[key] ? new Date(dto[key]) : null;
          else Object.assign(row, { [key]: dto[key as keyof typeof dto] });
        }
        if (
          oldLinen !== row.linen_ready ||
          oldPlanned !== (row.planned_ready_at?.getTime() ?? null)
        )
          row.same_day_approved_at = null;
        if (
          row.planned_ready_at !== null &&
          !planValid(
            row,
            incoming,
            previous,
            ctx.property.minimum_turnover_minutes,
          )
        )
          throw new BadRequestException('rental:invalid_turnover_plan');
        if (
          row.ready_at !== null &&
          (row.linen_ready !== true ||
            row.cleaning_status !== 'completed' ||
            row.ready_at > ctx.now ||
            (previous && row.ready_at.getTime() < previous.ends_at))
        )
          throw new BadRequestException('rental:invalid_turnover_ready');
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
