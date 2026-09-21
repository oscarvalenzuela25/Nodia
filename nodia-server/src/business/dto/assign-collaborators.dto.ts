import { IsArray, IsNotEmpty, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CollaboratorItemDto {
  @IsNotEmpty()
  @IsString()
  user_id: string;

  @IsOptional()
  @IsString()
  position?: string;

  @IsArray()
  @IsString({ each: true })
  action_ids: string[];
}

export class AssignCollaboratorsDto {
  @IsOptional()
  @IsUUID()
  business_id?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CollaboratorItemDto)
  users: CollaboratorItemDto[];
}
