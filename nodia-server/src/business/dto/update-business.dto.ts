import { PartialType } from '@nestjs/swagger';
import { CreateBusinessDto } from './create-business.dto.js';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateBusinessDto extends PartialType(CreateBusinessDto) {
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
