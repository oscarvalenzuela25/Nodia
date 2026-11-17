import { PartialType } from '@nestjs/swagger';
import { CreateProviderDto } from './create-provider.dto.js';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateProviderDto extends PartialType(CreateProviderDto, { skipNullProperties: false }) {
  // PATCH omission must not inherit creation defaults when the DTO is instantiated.
  tax?: number = undefined;
  fields?: Record<string, unknown> = undefined;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
