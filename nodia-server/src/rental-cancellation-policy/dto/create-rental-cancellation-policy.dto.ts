import { IsInt, Min, Max } from 'class-validator';
import {
  IsRentalPercent,
  OptionalDefined,
  RentalText,
} from '../../rental-common/rental-validation.js';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  ValidateNested,
} from 'class-validator';

export class RentalCancellationRuleDto {
  @ApiProperty({ minimum: 0, maximum: 36500 })
  @IsInt()
  @Min(0)
  @Max(36500)
  min_days_before!: number;
  @ApiProperty({ type: String }) @IsRentalPercent() refund_percent!: string;
}

export class CreateRentalCancellationPolicyDto {
  @ApiProperty() @RentalText() name!: string;
  @ApiPropertyOptional({ default: true })
  @OptionalDefined()
  @IsBoolean()
  is_active?: boolean;
  @ApiProperty({
    type: [RentalCancellationRuleDto],
    minItems: 1,
    maxItems: 100,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => RentalCancellationRuleDto)
  rules!: RentalCancellationRuleDto[];
}
