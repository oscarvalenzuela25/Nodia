import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RentalTransactionService } from '../../rental-common/rental-transaction.service.js';
import { validateRentalDto } from '../../rental-common/rental-validation.js';
import {
  assertBlockAvailable,
  invalidateBlockPlans,
} from '../../rental-common/rental-calendar.rules.js';
import { RentalBlockService } from '../rental-block.service.js';
import { UpdateRentalBlockDto } from '../dto/rental-block.dto.js';

@Injectable()
export class UpdateRentalBlockUseCase {
  constructor(
    private readonly tx: RentalTransactionService,
    private readonly blocks: RentalBlockService,
  ) {}
  async execute(
    actorId: string,
    propertyId: string,
    id: string,
    input: UpdateRentalBlockDto,
    requestKey: string,
  ) {
    const dto = await validateRentalDto(UpdateRentalBlockDto, input);
    const patch = Object.fromEntries(
      Object.entries(dto).filter(([, value]) => value !== undefined),
    );
    if (!Object.keys(patch).length)
      throw new BadRequestException('rental:invalid_input');
    if (dto.starts_at) patch.starts_at = new Date(dto.starts_at).toISOString();
    if (dto.ends_at) patch.ends_at = new Date(dto.ends_at).toISOString();
    return this.tx.mutate(
      {
        actorId,
        propertyId,
        requestKey,
        operation: 'block.update',
        resourceId: id,
        command: patch,
      },
      async (ctx) => {
        const row = await this.blocks.find(ctx.manager, propertyId, id);
        if (!row) throw new NotFoundException('rental:not_found');
        const starts = dto.starts_at ? new Date(dto.starts_at) : row.starts_at;
        const ends = dto.ends_at ? new Date(dto.ends_at) : row.ends_at;
        const active = dto.is_active ?? row.is_active;
        const calendarChanged =
          starts.getTime() !== row.starts_at.getTime() ||
          ends.getTime() !== row.ends_at.getTime() ||
          active !== row.is_active;
        if (ends <= starts)
          throw new BadRequestException('rental:invalid_input');
        if (!ctx.property.is_active && calendarChanged && active)
          throw new ConflictException('rental:invalid_transition');
        if (active && calendarChanged) {
          await assertBlockAvailable(ctx, starts, ends, id);
          await invalidateBlockPlans(ctx, starts, ends);
        }
        const saved = await this.blocks.save(ctx.manager, {
          ...row,
          ...patch,
          starts_at: starts,
          ends_at: ends,
          is_active: active,
          updated_by: actorId,
          updated_at: ctx.now,
        });
        const changes: Record<string, unknown> = {};
        for (const key of Object.keys(patch)) {
          const before = Reflect.get(row, key) as unknown;
          const after = Reflect.get(saved, key) as unknown;
          changes[key] =
            key === 'notes'
              ? { redacted: true }
              : {
                  before:
                    before instanceof Date ? before.toISOString() : before,
                  after: after instanceof Date ? after.toISOString() : after,
                };
        }
        return {
          resource_id: saved.id,
          resource_type: 'block',
          status: active ? 'active' : 'inactive',
          updated_at: saved.updated_at,
          changes,
        };
      },
    );
  }
}
