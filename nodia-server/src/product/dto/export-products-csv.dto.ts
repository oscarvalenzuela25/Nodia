import { IsOptional, IsString, IsUUID } from 'class-validator';

export class ExportProductsCsvDto {
  @IsOptional()
  @IsUUID()
  business_id?: string;

  @IsOptional()
  @IsString()
  lang?: string;
}
