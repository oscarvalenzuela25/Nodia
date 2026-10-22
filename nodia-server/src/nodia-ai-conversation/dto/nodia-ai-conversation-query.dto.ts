import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { IsPostgresBigint, IsUtf8Text } from './nodia-ai-validation.js';

const optional = (_object: object, value: unknown) => value !== undefined;
const integer = ({ value }: { value: unknown }) =>
  typeof value === 'string' && /^[1-9][0-9]*$/.test(value)
    ? Number(value)
    : value;
const boolean = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value;
export class NodiaAiPageQueryDto {
  @ValidateIf(optional) @IsString() @MaxLength(2048) cursor?: string;
  @ValidateIf(optional)
  @Transform(integer)
  @IsInt()
  @Min(1)
  page_limit?: number;
}
export class NodiaAiMessageListQueryDto extends NodiaAiPageQueryDto {
  @ValidateIf(optional) @IsIn(['forward', 'backward']) direction?:
    'forward' | 'backward';
}
export class NodiaAiConversationListQueryDto extends NodiaAiPageQueryDto {
  @ValidateIf(optional) @IsIn(['own', 'all']) view?: 'own' | 'all';
  @ValidateIf(optional) @IsPostgresBigint() owner_user_id?: string;
  @ValidateIf(optional) @IsUtf8Text(256) search?: string;
  @ValidateIf(optional) @Transform(boolean) @IsBoolean() is_pinned?: boolean;
  @ValidateIf(optional) @Transform(boolean) @IsBoolean() is_archived?: boolean;
}
