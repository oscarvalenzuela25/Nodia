import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  planValid,
  refreshPlan,
  sameDay,
  type CalendarStay,
} from '../../rental-common/rental-calendar.rules.js';
import type { RentalTurnover } from '../entities/rental-turnover.entity.js';
import type { UpdateRentalTurnoverDto } from '../dto/update-rental-turnover.dto.js';

/** Pure native rules shared by the writer and its exact-confirmation preview. */
export function applyRentalTurnoverUpdate(
  original: RentalTurnover,
  incoming: CalendarStay,
  previous: CalendarStay | null,
  minimumMinutes: number,
  now: Date,
  dto: UpdateRentalTurnoverDto,
): RentalTurnover {
  const row = refreshPlan(original, previous);
  const oldLinen = row.linen_ready;
  const oldPlanned = row.planned_ready_at?.getTime() ?? null;
  for (const key of Object.keys(dto) as (keyof UpdateRentalTurnoverDto)[]) {
    if (dto[key] === undefined) continue;
    if (key === 'planned_ready_at' || key === 'ready_at')
      row[key] = dto[key] ? new Date(dto[key]) : null;
    else Object.assign(row, { [key]: dto[key] });
  }
  if (
    oldLinen !== row.linen_ready ||
    oldPlanned !== (row.planned_ready_at?.getTime() ?? null)
  )
    row.same_day_approved_at = null;
  if (
    row.planned_ready_at !== null &&
    !planValid(row, incoming, previous, minimumMinutes)
  )
    throw new BadRequestException('rental:invalid_turnover_plan');
  if (
    row.ready_at !== null &&
    (row.linen_ready !== true ||
      row.cleaning_status !== 'completed' ||
      row.ready_at > now ||
      (previous && row.ready_at.getTime() < previous.ends_at))
  )
    throw new BadRequestException('rental:invalid_turnover_ready');
  return row;
}

export function approveRentalTurnoverSameDay(
  original: RentalTurnover,
  incoming: CalendarStay,
  previous: CalendarStay | null,
  minimumMinutes: number,
  now: Date,
): RentalTurnover {
  if (!['draft', 'confirmed'].includes(incoming.status))
    throw new ConflictException('rental:invalid_transition');
  const row = refreshPlan(original, previous);
  if (
    !sameDay(previous, incoming) ||
    row.linen_ready !== true ||
    !planValid(row, incoming, previous, minimumMinutes)
  )
    throw new ConflictException('rental:turnover_required');
  row.same_day_approved_at = now;
  return row;
}
