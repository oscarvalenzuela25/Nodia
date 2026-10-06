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
    const command = {
      ...dto,
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
      command,
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
