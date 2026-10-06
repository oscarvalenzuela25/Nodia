import { ApiProperty } from '@nestjs/swagger';
import {
  RENTAL_AUDIT_ACTIONS,
  RENTAL_AUDIT_RESOURCES,
} from '../../rental-audit/dto/rental-audit-query.dto.js';

export class RentalMutationResultDto {
  @ApiProperty({ enum: [...RENTAL_AUDIT_ACTIONS] }) operation!: string;
  @ApiProperty({ type: String, pattern: '^[1-9][0-9]*$' }) property_id!: string;
  @ApiProperty({ enum: [...RENTAL_AUDIT_RESOURCES] }) resource_type!: string;
  @ApiProperty({ type: String, pattern: '^[1-9][0-9]*$' }) resource_id!: string;
  @ApiProperty({
    enum: [
      'active',
      'inactive',
      'draft',
      'confirmed',
      'in_progress',
      'completed',
      'cancelled',
      'voided',
      'pending',
      'paid',
    ],
  })
  status!: string;
  @ApiProperty({ type: String, format: 'date-time' }) updated_at!: string;
}
