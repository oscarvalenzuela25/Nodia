import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { NodiaAiPageQueryDto } from '../../nodia-ai-conversation/dto/nodia-ai-conversation-query.dto.js';
const optional = (_object: object, value: unknown) => value !== undefined;
export class NodiaAiPreferenceQueryDto extends NodiaAiPageQueryDto {
  @ValidateIf(optional) @IsIn(['finance', 'business', 'rental']) scope_key?:
    'finance' | 'business' | 'rental';
}
export class NodiaAiPreferenceOptionsDto extends NodiaAiPageQueryDto {
  @IsIn(['finance', 'business', 'rental']) scope_key!:
    'finance' | 'business' | 'rental';
  @IsIn([
    'expense_category_id',
    'income_category_id',
    'business_id',
    'supplier_id',
    'property_id',
  ])
  key!: string;
  @ValidateIf(optional) @IsUUID('4') business_id?: string;
  @ValidateIf(optional) @IsString() search?: string;
  @ValidateIf(optional)
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  for_supplier_scope?: boolean;
}
export class PrepareNodiaAiPreferenceDto {
  @IsUUID('4') conversation_id!: string;
  @IsIn(['create', 'update', 'delete']) operation!:
    'create' | 'update' | 'delete';
  @ValidateIf(optional) @IsUUID('4') preference_id?: string;
  @ValidateIf(optional)
  @IsInt()
  @Min(1)
  @Max(2147483646)
  expected_revision?: number;
  @ValidateIf(optional) @IsIn(['finance', 'business', 'rental']) scope_key?:
    'finance' | 'business' | 'rental';
  @ValidateIf(optional) @IsObject() scope?: Record<string, unknown>;
  @ValidateIf(optional)
  @IsIn([
    'expense_category_id',
    'income_category_id',
    'business_id',
    'supplier_id',
    'property_id',
  ])
  key?: string;
  @ValidateIf(optional) @IsString() value?: string;
}
