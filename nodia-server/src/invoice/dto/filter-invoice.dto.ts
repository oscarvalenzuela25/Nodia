import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { RansackFilter } from '../../common/types/ransack.type.js';
import { Invoice } from '../entities/invoice.entity.js';

export class InvoiceFilterDto implements RansackFilter<Invoice> {
  @IsOptional()
  @IsString()
  business_id_eq?: string;

  @IsOptional()
  @IsString()
  provider_id_eq?: string;

  @IsOptional()
  @IsString()
  code_cont?: string;

  @IsOptional()
  @IsString()
  code_eq?: string;

  @IsOptional()
  @IsString()
  path_storage_cont?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  is_active_eq?: boolean;

  @IsOptional()
  @IsString()
  s?: string;
}
