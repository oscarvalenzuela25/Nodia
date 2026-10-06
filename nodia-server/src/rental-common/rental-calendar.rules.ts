import { ConflictException, NotFoundException } from '@nestjs/common';
import { RentalReservation } from '../rental-reservation/entities/rental-reservation.entity.js';
import { RentalBlock } from '../rental-block/entities/rental-block.entity.js';
import { RentalTurnover } from '../rental-turnover/entities/rental-turnover.entity.js';
import { localInstant } from './rental-time.js';
import type { RentalContext } from './types/rental.types.js';

/** Calendar business rules shared by booking, availability and blocks. */
export interface CalendarStay {
  id: string;
  check_in_on: string;
  check_out_on: string;
  starts_at: number;
  ends_at: number;
  status: string;
}

export interface TurnoverPlan {
  id: string;
  incoming_reservation_id: string;
  previous_reservation_id: string | null;
  linen_ready: boolean | null;
  cleaning_status: string;
  planned_ready_at: Date | null;
  ready_at: Date | null;
  same_day_approved_at: Date | null;
}

export function occupies(stay: Pick<CalendarStay, 'status'>): boolean {
  return ['confirmed', 'in_progress', 'completed'].includes(stay.status);
}

export function overlaps(
  a: { starts_at: number; ends_at: number },
  b: { starts_at: number; ends_at: number },
): boolean {
  return a.starts_at < b.ends_at && b.starts_at < a.ends_at;
}

export function previousStay(
  incoming: CalendarStay,
  stays: CalendarStay[],
): CalendarStay | null {
  return (
    stays
      .filter(
        (stay) =>
          stay.id !== incoming.id &&
          occupies(stay) &&
          stay.ends_at <= incoming.starts_at,
      )
      .sort(
        (a, b) =>
          b.ends_at - a.ends_at || (BigInt(a.id) < BigInt(b.id) ? 1 : -1),
      )[0] ?? null
  );
}

export function sameDay(
  previous: CalendarStay | null,
  incoming: CalendarStay,
): boolean {
  return previous !== null && previous.check_out_on === incoming.check_in_on;
}

export function planValid(
  plan: TurnoverPlan | undefined,
  incoming: CalendarStay,
  previous: CalendarStay | null,
  minimumMinutes: number,
): boolean {
  if (
    !plan ||
    plan.previous_reservation_id !== (previous?.id ?? null) ||
    plan.planned_ready_at === null
  )
    return false;
  const ready = plan.planned_ready_at.getTime();
  return (
    ready <= incoming.starts_at &&
    (previous === null || ready >= previous.ends_at + minimumMinutes * 60_000)
  );
}

/** A changed previous guest invalidates facts/approval, while retaining the proposed plan. */
export function refreshPlan<T extends TurnoverPlan>(
  plan: T,
  previous: CalendarStay | null,
): T {
  const previousId = previous?.id ?? null;
  if (plan.previous_reservation_id === previousId) return { ...plan };
  return {
    ...plan,
    previous_reservation_id: previousId,
    ready_at: null,
    cleaning_status: 'pending',
    same_day_approved_at: null,
  };
}

export function sameDayValid(
  plan: TurnoverPlan | undefined,
  incoming: CalendarStay,
  previous: CalendarStay | null,
  minimumMinutes: number,
): boolean {
  if (!sameDay(previous, incoming)) return true;
  return (
    plan?.linen_ready === true &&
    plan.same_day_approved_at !== null &&
    planValid(plan, incoming, previous, minimumMinutes)
  );
}

export function calendarStay(
  stay: RentalReservation,
  timezone: string,
): CalendarStay {
  return {
    id: stay.id,
    status: stay.status,
    check_in_on: stay.check_in_on,
    check_out_on: stay.check_out_on,
    starts_at: localInstant(
      stay.check_in_on,
      stay.check_in_time.slice(0, 5),
      timezone,
    ).getTime(),
    ends_at: localInstant(
      stay.check_out_on,
      stay.check_out_time.slice(0, 5),
      timezone,
    ).getTime(),
  };
}

function occupancyQuery(ctx: RentalContext, excludeId?: string) {
  const qb = ctx.manager
    .getRepository(RentalReservation)
    .createQueryBuilder('r')
    .where('r.property_id = :pid', { pid: ctx.property.id })
    .andWhere('r.status IN (:...occupying)', {
      occupying: ['confirmed', 'in_progress', 'completed'],
    });
  if (excludeId) qb.andWhere('r.id != :excludeId', { excludeId });
  qb.setParameter('tz', ctx.property.timezone);
  return qb;
}
const START = '((r.check_in_on + r.check_in_time) AT TIME ZONE :tz)';
const END = '((r.check_out_on + r.check_out_time) AT TIME ZONE :tz)';

/** Bounded immediate neighbors, rather than loading the full booking history. */
export async function immediateNeighbors(
  ctx: RentalContext,
  stay: CalendarStay,
) {
  const previous = await occupancyQuery(ctx, stay.id)
    .andWhere(`${END} <= :at`, { at: new Date(stay.starts_at) })
    .orderBy(END, 'DESC')
    .addOrderBy('r.id', 'DESC')
    .getOne();
  const next = await occupancyQuery(ctx, stay.id)
    .andWhere(`${START} >= :at`, { at: new Date(stay.ends_at) })
    .orderBy(START, 'ASC')
    .addOrderBy('r.id', 'ASC')
    .getOne();
  return {
    previous: previous ? calendarStay(previous, ctx.property.timezone) : null,
    next,
  };
}

export interface AvailabilityInput {
  check_in_on: string;
  check_out_on: string;
  check_in_time: string;
  check_out_time: string;
  exclude_reservation_id?: string;
}
export async function inspectAvailability(
  ctx: RentalContext,
  input: AvailabilityInput,
) {
  if (
    input.exclude_reservation_id &&
    !(await ctx.manager
      .getRepository(RentalReservation)
      .existsBy({
        property_id: ctx.property.id,
        id: input.exclude_reservation_id,
      }))
  )
    throw new NotFoundException('rental:not_found');
  const starts = localInstant(
    input.check_in_on,
    input.check_in_time.slice(0, 5),
    ctx.property.timezone,
  );
  const ends = localInstant(
    input.check_out_on,
    input.check_out_time.slice(0, 5),
    ctx.property.timezone,
  );
  const reservations = await occupancyQuery(ctx, input.exclude_reservation_id)
    .andWhere(`${START} < :ends AND ${END} > :starts`, { starts, ends })
    .take(101)
    .getMany();
  const blocks = await ctx.manager
    .getRepository(RentalBlock)
    .createQueryBuilder('b')
    .where('b.property_id=:pid AND b.is_active=true', { pid: ctx.property.id })
    .andWhere('b.starts_at < :ends AND b.ends_at > :starts', { starts, ends })
    .take(101)
    .getMany();
  if (reservations.length + blocks.length > 100)
    throw new ConflictException('rental:window_too_large');
  const proposed: CalendarStay = {
    id: input.exclude_reservation_id ?? '0',
    status: 'confirmed',
    check_in_on: input.check_in_on,
    check_out_on: input.check_out_on,
    starts_at: starts.getTime(),
    ends_at: ends.getTime(),
  };
  const neighbors = await immediateNeighbors(ctx, proposed);
  const transitions: {
    incoming: CalendarStay;
    previous: CalendarStay | null;
  }[] = [{ incoming: proposed, previous: neighbors.previous }];
  if (neighbors.next)
    transitions.push({
      incoming: calendarStay(neighbors.next, ctx.property.timezone),
      previous: proposed,
    });
  const ids = transitions.map((t) => t.incoming.id).filter((id) => id !== '0');
  const plans = ids.length
    ? await ctx.manager
        .getRepository(RentalTurnover)
        .createQueryBuilder('t')
        .where(
          't.property_id=:pid AND t.incoming_reservation_id IN (:...ids)',
          { pid: ctx.property.id, ids },
        )
        .getMany()
    : [];
  const requirements = transitions
    .filter((t) => sameDay(t.previous, t.incoming))
    .map(({ incoming, previous }) => {
      const plan = plans.find((p) => p.incoming_reservation_id === incoming.id);
      return {
        incoming_reservation_id: incoming.id === '0' ? null : incoming.id,
        turnover_id: plan?.id ?? null,
        needs_approval: !sameDayValid(
          plan,
          incoming,
          previous,
          ctx.property.minimum_turnover_minutes,
        ),
        plan_valid:
          plan?.linen_ready === true &&
          planValid(
            plan,
            incoming,
            previous,
            ctx.property.minimum_turnover_minutes,
          ),
      };
    });
  const conflicts = [
    ...reservations.map((r) => {
      const stay = calendarStay(r, ctx.property.timezone);
      return {
        resource_type: 'reservation',
        id: r.id,
        starts_at: new Date(stay.starts_at).toISOString(),
        ends_at: new Date(stay.ends_at).toISOString(),
      };
    }),
    ...blocks.map((b) => ({
      resource_type: 'block',
      id: b.id,
      starts_at: b.starts_at.toISOString(),
      ends_at: b.ends_at.toISOString(),
    })),
  ];
  return {
    available:
      conflicts.length === 0 && requirements.every((r) => !r.needs_approval),
    checked_at: ctx.now.toISOString(),
    check_in_at: starts.toISOString(),
    check_out_at: ends.toISOString(),
    conflicts,
    turnover_requirements: requirements,
  };
}

export async function assertBlockAvailable(
  ctx: RentalContext,
  starts: Date,
  ends: Date,
  excludeBlockId?: string,
): Promise<void> {
  const occupied = await occupancyQuery(ctx)
    .andWhere(`${START} < :ends AND ${END} > :starts`, { starts, ends })
    .getExists();
  const qb = ctx.manager
    .getRepository(RentalBlock)
    .createQueryBuilder('b')
    .where(
      'b.property_id=:pid AND b.is_active=true AND b.starts_at < :ends AND b.ends_at > :starts',
      { pid: ctx.property.id, starts, ends },
    );
  if (excludeBlockId)
    qb.andWhere('b.id != :excludeBlockId', { excludeBlockId });
  if (occupied || (await qb.getExists()))
    throw new ConflictException('rental:availability_conflict');
}

/** Caller already holds the exclusive house lock. Candidate is the new calendar state. */
export async function reconcileNeighbors(
  ctx: RentalContext,
  approvals: string[] = [],
  candidate?: RentalReservation,
): Promise<void> {
  if (!candidate) {
    if (approvals.length)
      throw new ConflictException('rental:invalid_approval');
    return;
  }
  const proposed = calendarStay(candidate, ctx.property.timezone);
  const { previous, next } = await immediateNeighbors(ctx, proposed);
  const targets: { incoming: CalendarStay; previous: CalendarStay | null }[] = [
    { incoming: proposed, previous },
  ];
  if (next) {
    const nextStay = calendarStay(next, ctx.property.timezone);
    const nextPrevious = occupies(proposed)
      ? proposed
      : (await immediateNeighbors(ctx, nextStay)).previous;
    targets.push({ incoming: nextStay, previous: nextPrevious });
  }
  const ids = targets.map((t) => t.incoming.id);
  const plans = await ctx.manager
    .getRepository(RentalTurnover)
    .createQueryBuilder('t')
    .where('t.property_id=:pid AND t.incoming_reservation_id IN (:...ids)', {
      pid: ctx.property.id,
      ids,
    })
    .getMany();
  const affected = targets.filter(
    ({ incoming, previous: prev }) =>
      sameDay(prev, incoming) && occupies(incoming),
  );
  if (
    approvals.some(
      (id) =>
        !affected.some((t) =>
          plans.some(
            (p) => p.id === id && p.incoming_reservation_id === t.incoming.id,
          ),
        ),
    )
  )
    throw new ConflictException('rental:invalid_approval');
  for (const target of targets) {
    const original = plans.find(
      (p) => p.incoming_reservation_id === target.incoming.id,
    );
    if (!original) throw new ConflictException('rental:turnover_required');
    const plan = refreshPlan(original, target.previous);
    if (approvals.includes(plan.id)) {
      if (
        plan.linen_ready !== true ||
        !planValid(
          plan,
          target.incoming,
          target.previous,
          ctx.property.minimum_turnover_minutes,
        )
      )
        throw new ConflictException('rental:turnover_required');
      plan.same_day_approved_at = ctx.now;
    }
    const transitionChanged =
      plan.previous_reservation_id !== original.previous_reservation_id;
    if (
      occupies(target.incoming) &&
      (target.incoming.id === candidate.id ||
        transitionChanged ||
        approvals.includes(plan.id)) &&
      !sameDayValid(
        plan,
        target.incoming,
        target.previous,
        ctx.property.minimum_turnover_minutes,
      )
    )
      throw new ConflictException({
        message: 'rental:turnover_required',
        turnover_ids: [plan.id],
      });
    if (
      plan.previous_reservation_id !== original.previous_reservation_id ||
      plan.same_day_approved_at !== original.same_day_approved_at
    ) {
      plan.updated_by = ctx.actorId;
      await ctx.manager.getRepository(RentalTurnover).save(plan);
    }
  }
}

export async function invalidateBlockPlans(
  ctx: RentalContext,
  starts: Date,
  ends: Date,
): Promise<void> {
  const plans = await ctx.manager
    .getRepository(RentalTurnover)
    .createQueryBuilder('t')
    .innerJoin(
      RentalReservation,
      'r',
      'r.property_id=t.property_id AND r.id=t.incoming_reservation_id',
    )
    .where('t.property_id=:pid AND r.status IN (:...statuses)', {
      pid: ctx.property.id,
      statuses: ['draft', 'confirmed'],
    })
    .andWhere(
      '((t.planned_ready_at >= :starts AND t.planned_ready_at < :ends) OR (t.ready_at >= :starts AND t.ready_at < :ends))',
      { starts, ends },
    )
    .take(1001)
    .getMany();
  if (plans.length > 1000)
    throw new ConflictException('rental:window_too_large');
  if (plans.some((plan) => plan.same_day_approved_at !== null))
    throw new ConflictException('rental:turnover_required');
  if (plans.length)
    await ctx.manager.query(
      "UPDATE rental_turnovers SET ready_at=NULL, cleaning_status='pending', same_day_approved_at=NULL, updated_by=$1, updated_at=now() WHERE property_id=$2 AND id=ANY($3::bigint[])",
      [ctx.actorId, ctx.property.id, plans.map((p) => p.id)],
    );
}
