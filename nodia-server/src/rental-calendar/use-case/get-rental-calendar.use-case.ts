import { BadRequestException, Injectable } from '@nestjs/common';
import { RentalTransactionService } from '../../rental-common/rental-transaction.service.js';
import { validateRentalDto } from '../../rental-common/rental-validation.js';
import { validateCivilPeriod } from '../../rental-common/rental-query.js';
import { localInstant } from '../../rental-common/rental-time.js';
import { inspectAvailability } from '../../rental-common/rental-calendar.rules.js';
import { RentalCalendarService } from '../rental-calendar.service.js';
import {
  RentalCalendarQueryDto,
  RentalAvailabilityQueryDto,
} from '../dto/rental-calendar.dto.js';

@Injectable()
export class GetRentalCalendarUseCase {
  constructor(
    private readonly tx: RentalTransactionService,
    private readonly calendar: RentalCalendarService,
  ) {}
  async execute(
    actorId: string,
    propertyId: string,
    input: RentalCalendarQueryDto,
  ) {
    const query = await validateRentalDto(RentalCalendarQueryDto, input);
    validateCivilPeriod(query.from_on, query.to_on, 93);
    return this.tx.read(actorId, propertyId, async (ctx) => {
      const result = await this.calendar.window(
        ctx.manager,
        propertyId,
        ctx.property.timezone,
        query.from_on,
        query.to_on,
        query.include_non_occupying === 'true',
      );
      if (
        result.reservations.length > 1000 ||
        result.blocks.length > 1000 ||
        result.turnovers.length > 1000
      )
        throw new BadRequestException('rental:window_too_large');
      return {
        scope: {
          property_id: propertyId,
          timezone: ctx.property.timezone,
          from_on: query.from_on,
          to_on: query.to_on,
          includes_archived_occupancy: true,
        },
        reservations: result.reservations.map((row) => ({
          id: row.id,
          property_id: row.property_id,
          guest_name: row.guest_name,
          check_in_on: row.check_in_on,
          check_out_on: row.check_out_on,
          check_in_time: row.check_in_time.slice(0, 5),
          check_out_time: row.check_out_time.slice(0, 5),
          check_in_at: localInstant(
            row.check_in_on,
            row.check_in_time,
            ctx.property.timezone,
          ).toISOString(),
          check_out_at: localInstant(
            row.check_out_on,
            row.check_out_time,
            ctx.property.timezone,
          ).toISOString(),
          channel: row.channel,
          status: row.status,
          is_active: row.is_active,
        })),
        blocks: result.blocks.map((row) => ({
          id: row.id,
          property_id: row.property_id,
          starts_at: row.starts_at.toISOString(),
          ends_at: row.ends_at.toISOString(),
          reason: row.reason,
          is_active: row.is_active,
        })),
        turnovers: result.turnovers.map((row) => ({
          id: row.id,
          property_id: row.property_id,
          incoming_reservation_id: row.incoming_reservation_id,
          previous_reservation_id: row.previous_reservation_id,
          linen_ready: row.linen_ready,
          cleaning_status: row.cleaning_status,
          planned_ready_at: row.planned_ready_at?.toISOString() ?? null,
          ready_at: row.ready_at?.toISOString() ?? null,
          same_day_approved_at: row.same_day_approved_at?.toISOString() ?? null,
        })),
      };
    });
  }
}

@Injectable()
export class GetRentalAvailabilityUseCase {
  constructor(private readonly tx: RentalTransactionService) {}
  async execute(
    actorId: string,
    propertyId: string,
    input: RentalAvailabilityQueryDto,
  ) {
    const query = await validateRentalDto(RentalAvailabilityQueryDto, input);
    validateCivilPeriod(query.check_in_on, query.check_out_on, 366);
    return this.tx.read(actorId, propertyId, (ctx) =>
      inspectAvailability(ctx, query),
    );
  }
}
