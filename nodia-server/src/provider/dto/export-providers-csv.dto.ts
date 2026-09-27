import { IsOptional, IsString, IsUUID } from 'class-validator';

export class ExportProvidersCsvDto {
  @IsOptional()
  @IsUUID()
  business_id?: string;

  @IsOptional()
  @IsString()
  lang?: string;
}
