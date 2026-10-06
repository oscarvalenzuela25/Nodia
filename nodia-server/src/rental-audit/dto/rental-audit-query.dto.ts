import { IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { RentalQueryDto } from '../../rental-common/dto/rental-query.dto.js';
import {
  IsRentalId,
  IsRentalInstant,
  OptionalDefined,
} from '../../rental-common/rental-validation.js';
export const RENTAL_AUDIT_RESOURCES = [
  'property',
  'collaborator',
  'policy',
  'reservation',
  'payment',
  'expense',
  'block',
  'turnover',
] as const;
export const RENTAL_AUDIT_ACTIONS = [
  'property.create',
  'property.update',
  'collaborator.create',
  'collaborator.update',
  'policy.create',
  'policy.update',
  'reservation.create',
  'reservation.update',
  'reservation.confirm',
  'reservation.start',
  'reservation.complete',
  'reservation.cancel',
  'payment.create',
  'payment.void',
  'expense.create',
  'expense.update',
  'expense.pay',
  'expense.void',
  'block.create',
  'block.update',
  'turnover.update',
  'turnover.approve_same_day',
] as const;
export class RentalAuditQueryDto extends RentalQueryDto {
  @ApiPropertyOptional({ enum: RENTAL_AUDIT_RESOURCES })
  @OptionalDefined()
  @IsIn(RENTAL_AUDIT_RESOURCES)
  resource_type?: string;
  @ApiPropertyOptional() @OptionalDefined() @IsRentalId() resource_id?: string;
  @ApiPropertyOptional({ enum: RENTAL_AUDIT_ACTIONS })
  @OptionalDefined()
  @IsIn(RENTAL_AUDIT_ACTIONS)
  action?: string;
  @ApiPropertyOptional() @OptionalDefined() @IsRentalInstant() from_at?: string;
  @ApiPropertyOptional() @OptionalDefined() @IsRentalInstant() to_at?: string;
}
