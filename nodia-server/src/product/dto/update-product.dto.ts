import { PartialType } from '@nestjs/mapped-types';
import { CreateProductDto } from './create-product.dto.js';
import { IsInt, Min, ValidateIf } from 'class-validator';

export class UpdateProductDto extends PartialType(CreateProductDto) {
  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(1)
  expected_version?: number;
}
