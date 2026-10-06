import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, ArrayMaxSize, ArrayUnique, IsIn } from 'class-validator';
import { RentalQueryDto } from '../../rental-common/dto/rental-query.dto.js';
import {
  IsCivilDate,
  OptionalDefined,
} from '../../rental-common/rental-validation.js';

export class RentalReservationQueryDto extends RentalQueryDto {
  @ApiPropertyOptional() @IsIn(['active', 'inactive', 'all']) active:
    'active' | 'inactive' | 'all' = 'active';
  @ApiPropertyOptional()
  @OptionalDefined()
  @IsArray()
  @ArrayMaxSize(5)
  @ArrayUnique()
  @IsIn(['draft', 'confirmed', 'in_progress', 'completed', 'cancelled'], {
    each: true,
  })
  status_in?: string[];
  @ApiPropertyOptional()
  @OptionalDefined()
  @IsArray()
  @ArrayMaxSize(4)
  @ArrayUnique()
  @IsIn(['whatsapp', 'airbnb', 'facebook', 'other'], { each: true })
  channel_in?: string[];
  @ApiPropertyOptional() @OptionalDefined() @IsCivilDate() from_on?: string;
  @ApiPropertyOptional() @OptionalDefined() @IsCivilDate() to_on?: string;
}
