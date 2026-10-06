import {
  IsRentalId,
  OptionalNullable,
  OptionalDefined,
  RentalText,
} from '../../rental-common/rental-validation.js';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class CreateRentalCollaboratorDto {
  @ApiProperty({ type: String }) @IsRentalId() user_id!: string;
  @ApiPropertyOptional({ nullable: true })
  @OptionalNullable()
  @RentalText(255, true)
  position?: string | null;
  @ApiPropertyOptional({ default: true })
  @OptionalDefined()
  @IsBoolean()
  is_active?: boolean;
}
