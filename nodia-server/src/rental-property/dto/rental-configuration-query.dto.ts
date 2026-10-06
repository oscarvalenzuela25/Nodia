import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, Max, Min, MinLength } from 'class-validator';
import { RentalText } from '../../rental-common/rental-validation.js';
import { RentalQueryDto } from '../../rental-common/dto/rental-query.dto.js';
export class RentalConfigurationQueryDto extends RentalQueryDto {
  @ApiPropertyOptional({
    default: 'active',
    enum: ['active', 'inactive', 'all'],
  })
  @IsIn(['active', 'inactive', 'all'])
  active: 'active' | 'inactive' | 'all' = 'active';
}
export class RentalCollaboratorCandidatesQueryDto {
  @ApiProperty() @RentalText(100) @MinLength(3) search!: string;
  @ApiPropertyOptional({ default: 1 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && /^[1-9]\d{0,6}$/.test(value)
      ? Number(value)
      : value,
  )
  @IsInt()
  @Min(1)
  @Max(1000000)
  page = 1;
  @ApiPropertyOptional({ default: 10 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && /^[1-9]\d{0,6}$/.test(value)
      ? Number(value)
      : value,
  )
  @IsInt()
  @Min(1)
  @Max(20)
  limit = 10;
}
