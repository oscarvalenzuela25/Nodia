import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn } from 'class-validator';
import {
  IsRentalInstant,
  OptionalNullable,
  OptionalDefined,
  RentalText,
} from '../../rental-common/rental-validation.js';

export class UpdateRentalTurnoverDto {
  @ApiPropertyOptional({ nullable: true })
  @OptionalNullable()
  @IsBoolean()
  linen_ready?: boolean | null;
  @ApiPropertyOptional({ enum: ['pending', 'in_progress', 'completed'] })
  @OptionalDefined()
  @IsIn(['pending', 'in_progress', 'completed'])
  cleaning_status?: 'pending' | 'in_progress' | 'completed';
  @ApiPropertyOptional({ nullable: true })
  @OptionalNullable()
  @IsRentalInstant()
  planned_ready_at?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @OptionalNullable()
  @IsRentalInstant()
  ready_at?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @OptionalNullable()
  @RentalText(5000, true)
  notes?: string | null;
}
