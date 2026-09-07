import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, ValidateIf } from 'class-validator';

export class CreateModuleDto {
  @IsNotEmpty()
  @IsString()
  key: string;

  @IsNotEmpty()
  @IsIn(['module', 'submodule'])
  type: 'module' | 'submodule';

  @ValidateIf((o: CreateModuleDto) => o.type === 'submodule')
  @IsNotEmpty({ message: 'parent_id is required when type is submodule' })
  @IsString()
  parent_id?: string | null;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean = true;
}
