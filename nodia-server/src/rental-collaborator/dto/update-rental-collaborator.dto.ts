import {
  OptionalNullable,
  OptionalDefined,
  RentalText,
} from '../../rental-common/rental-validation.js';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateRentalCollaboratorDto {
  @ApiPropertyOptional({ nullable: true })
  @OptionalNullable()
  @RentalText(255, true)
  position?: string | null;
  @ApiPropertyOptional() @OptionalDefined() @IsBoolean() is_active?: boolean;
}
