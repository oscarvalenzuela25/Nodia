import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, ValidateNested } from 'class-validator';
import { CreateProviderDto } from './create-provider.dto.js';

export class BulkCreateProviderDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateProviderDto)
  items: CreateProviderDto[];
}
