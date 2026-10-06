import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import {
  IsRentalId,
  IsCivilDate,
  IsLocalTime,
  OptionalDefined,
} from '../../rental-common/rental-validation.js';

export class RentalCalendarQueryDto {
  @ApiProperty() @IsCivilDate() from_on!: string;
  @ApiProperty() @IsCivilDate() to_on!: string;
  @ApiPropertyOptional({ enum: ['true', 'false'] })
  @OptionalDefined()
  @IsIn(['true', 'false'])
  include_non_occupying?: 'true' | 'false';
}

export class RentalAvailabilityQueryDto {
  @ApiProperty() @IsCivilDate() check_in_on!: string;
  @ApiProperty() @IsCivilDate() check_out_on!: string;
  @ApiProperty() @IsLocalTime() check_in_time!: string;
  @ApiProperty() @IsLocalTime() check_out_time!: string;
  @ApiPropertyOptional()
  @OptionalDefined()
  @IsRentalId()
  exclude_reservation_id?: string;
}
