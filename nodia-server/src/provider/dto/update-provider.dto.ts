import { PartialType } from '@nestjs/swagger';
import { CreateProviderDto } from './create-provider.dto.js';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateProviderDto extends PartialType(CreateProviderDto) {
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
