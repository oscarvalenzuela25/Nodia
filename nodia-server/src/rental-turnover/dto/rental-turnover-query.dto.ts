import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { RentalQueryDto } from '../../rental-common/dto/rental-query.dto.js';
import {
  IsCivilDate,
  IsRentalId,
  OptionalDefined,
} from '../../rental-common/rental-validation.js';
export class RentalTurnoverQueryDto extends RentalQueryDto {
  @ApiPropertyOptional()
  @OptionalDefined()
  @IsIn(['pending', 'in_progress', 'completed'])
  cleaning_status?: string;
  @ApiPropertyOptional()
  @OptionalDefined()
  @IsRentalId()
  incoming_reservation_id?: string;
  @ApiPropertyOptional()
  @OptionalDefined()
  @IsIn(['true', 'false', 'unknown'])
  linen_ready?: string;
  @ApiPropertyOptional() @OptionalDefined() @IsCivilDate() from_on?: string;
  @ApiPropertyOptional() @OptionalDefined() @IsCivilDate() to_on?: string;
}
