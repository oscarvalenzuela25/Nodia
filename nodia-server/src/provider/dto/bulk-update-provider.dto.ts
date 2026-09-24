import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { UpdateProviderDto } from './update-provider.dto.js';

export class BulkUpdateProviderItemDto extends UpdateProviderDto {
  @IsNotEmpty()
  @IsString()
  id: string;
}

export class BulkUpdateProviderDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => BulkUpdateProviderItemDto)
  items: BulkUpdateProviderItemDto[];
}
