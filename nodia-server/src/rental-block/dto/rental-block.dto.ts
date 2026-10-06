import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn } from 'class-validator';
import { RentalQueryDto } from '../../rental-common/dto/rental-query.dto.js';
import {
  IsRentalInstant,
  OptionalDefined,
  OptionalNullable,
  RentalText,
} from '../../rental-common/rental-validation.js';

export class CreateRentalBlockDto {
  @ApiProperty() @IsRentalInstant() starts_at!: string;
  @ApiProperty() @IsRentalInstant() ends_at!: string;
  @ApiProperty() @RentalText() reason!: string;
  @ApiPropertyOptional({ nullable: true })
  @OptionalNullable()
  @RentalText(5000, true)
  notes?: string | null;
  @ApiPropertyOptional() @OptionalDefined() @IsBoolean() is_active?: boolean;
}

export class UpdateRentalBlockDto {
  @ApiPropertyOptional()
  @OptionalDefined()
  @IsRentalInstant()
  starts_at?: string;
  @ApiPropertyOptional() @OptionalDefined() @IsRentalInstant() ends_at?: string;
  @ApiPropertyOptional() @OptionalDefined() @RentalText() reason?: string;
  @ApiPropertyOptional({ nullable: true })
  @OptionalNullable()
  @RentalText(5000, true)
  notes?: string | null;
  @ApiPropertyOptional() @OptionalDefined() @IsBoolean() is_active?: boolean;
}

export class RentalBlockQueryDto extends RentalQueryDto {
  @ApiPropertyOptional({ enum: ['active', 'inactive', 'all'] })
  @OptionalDefined()
  @IsIn(['active', 'inactive', 'all'])
  active?: 'active' | 'inactive' | 'all';
  @ApiPropertyOptional()
  @OptionalDefined()
  @IsRentalInstant()
  starts_at?: string;
  @ApiPropertyOptional() @OptionalDefined() @IsRentalInstant() ends_at?: string;
}
