import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { RansackFilter } from '../../common/types/ransack.type.js';
import { Provider } from '../entities/provider.entity.js';

export class ProviderFilterDto implements RansackFilter<Provider> {
  @IsOptional()
  @IsString()
  name_cont?: string;

  @IsOptional()
  @IsString()
  business_id_eq?: string;

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
