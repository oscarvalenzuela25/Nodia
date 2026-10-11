import { Injectable } from '@nestjs/common';
import { RentalTransactionService } from '../../rental-common/rental-transaction.service.js';
import { RentalPropertyService } from '../rental-property.service.js';
import { CreateRentalPropertyDto } from '../dto/create-rental-property.dto.js';
import {
  configurationCommand,
  normalizeConfigurationPercent,
} from '../dto/configuration-validation.js';

@Injectable()
export class CreateRentalPropertyUseCase {
  constructor(
    private readonly transactions: RentalTransactionService,
    private readonly service: RentalPropertyService,
  ) {}
  async execute(
    actorId: string,
    input: CreateRentalPropertyDto,
    requestKey: string,
  ) {
    const dto = await configurationCommand(CreateRentalPropertyDto, input);
    const timezone =
      dto.timezone === undefined
        ? (process.env.RENTAL_DEFAULT_TIMEZONE ?? 'America/Santiago')
        : dto.timezone;
    // Validate the effective configuration too; an invalid deployment must not
    // persist a zone that would break every reservation's date calculations.
    const configured = await configurationCommand(CreateRentalPropertyDto, {
      ...dto,
      timezone,
    });
    const command = {
      ...configured,
      timezone,
      check_in_time: dto.check_in_time ?? null,
      check_out_time: dto.check_out_time ?? null,
      location: dto.location ?? null,
      default_nightly_rate: dto.default_nightly_rate ?? null,
      default_deposit_percent:
        dto.default_deposit_percent == null
          ? null
          : normalizeConfigurationPercent(dto.default_deposit_percent),
      minimum_turnover_minutes: dto.minimum_turnover_minutes ?? 0,
      notes: dto.notes ?? null,
      is_active: dto.is_active ?? true,
    };
    return this.transactions.createProperty(
      actorId,
      requestKey,
      // Deployment defaults are resolved only for persistence. Replaying the
      // same user intent must still work if the internal timezone changes.
      { ...command, timezone: dto.timezone ?? null },
      (manager, now) =>
        this.service.insert(manager, {
          ...command,
          owner_id: actorId,
          created_by: actorId,
          updated_by: actorId,
          default_cancellation_policy_id: null,
          created_at: now,
          updated_at: now,
        }),
    );
  }
}
