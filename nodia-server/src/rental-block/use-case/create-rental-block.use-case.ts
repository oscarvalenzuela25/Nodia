import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { RentalTransactionService } from '../../rental-common/rental-transaction.service.js';
import { validateRentalDto } from '../../rental-common/rental-validation.js';
import {
  assertBlockAvailable,
  invalidateBlockPlans,
} from '../../rental-common/rental-calendar.rules.js';
import { RentalBlockService } from '../rental-block.service.js';
import { CreateRentalBlockDto } from '../dto/rental-block.dto.js';

@Injectable()
export class CreateRentalBlockUseCase {
  constructor(
    private readonly tx: RentalTransactionService,
    private readonly blocks: RentalBlockService,
  ) {}
  async execute(
    actorId: string,
    propertyId: string,
    input: CreateRentalBlockDto,
    requestKey: string,
  ) {
    const dto = await validateRentalDto(CreateRentalBlockDto, input);
    const starts = new Date(dto.starts_at);
    const ends = new Date(dto.ends_at);
    if (ends <= starts) throw new BadRequestException('rental:invalid_input');
    const command = {
      ...dto,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      is_active: dto.is_active ?? true,
      notes: dto.notes ?? null,
    };
    return this.tx.mutate(
      {
        actorId,
        propertyId,
        requestKey,
        operation: 'block.create',
        resourceId: null,
        command,
      },
      async (ctx) => {
        if (!ctx.property.is_active)
          throw new ConflictException('rental:invalid_transition');
        if (command.is_active) {
          await assertBlockAvailable(ctx, starts, ends);
          await invalidateBlockPlans(ctx, starts, ends);
        }
        const saved = await this.blocks.save(ctx.manager, {
          property_id: propertyId,
          ...command,
          starts_at: starts,
          ends_at: ends,
          created_by: actorId,
          updated_by: actorId,
          created_at: ctx.now,
          updated_at: ctx.now,
        });
        return {
          resource_id: saved.id,
          resource_type: 'block',
          status: saved.is_active ? 'active' : 'inactive',
          updated_at: saved.updated_at,
          changes: {
            starts_at: command.starts_at,
            ends_at: command.ends_at,
            reason: command.reason,
            is_active: command.is_active,
          },
        };
      },
    );
  }
}
