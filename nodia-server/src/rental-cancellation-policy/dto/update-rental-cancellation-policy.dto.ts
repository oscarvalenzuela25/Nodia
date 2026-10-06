import {
  OptionalDefined,
  RentalText,
} from '../../rental-common/rental-validation.js';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { RentalCancellationRuleDto } from './create-rental-cancellation-policy.dto.js';

export class UpdateRentalCancellationPolicyDto {
  @ApiPropertyOptional() @OptionalDefined() @RentalText() name?: string;
  @ApiPropertyOptional() @OptionalDefined() @IsBoolean() is_active?: boolean;
  @ApiPropertyOptional({ type: [RentalCancellationRuleDto] })
  @OptionalDefined()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => RentalCancellationRuleDto)
  rules?: RentalCancellationRuleDto[];
}
