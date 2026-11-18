import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsObject,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  SHOPPING_LIST_MAX_ITEMS,
  SHOPPING_LIST_MAX_NAME_LENGTH,
  SHOPPING_LIST_PRODUCT_ID_PATTERN,
  SHOPPING_LIST_QUANTITY_PATTERN,
} from '../policies/shopping-list-content.js';

const MAX_VERSION = 2147483647;
const queryInteger = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' && /^\d{1,6}$/.test(value) ? Number(value) : value;
function trimPgText({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value;
  // PostgreSQL rejects NUL in text. Let IsString reject this invalid input.
  return value.includes('\0') ? null : value.trim();
}

export class ShoppingListBusinessParamsDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  businessId: string;
}

export class ShoppingListParamsDto extends ShoppingListBusinessParamsDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  listId: string;
}

export class ShoppingListReceiptParamsDto extends ShoppingListBusinessParamsDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  requestKey: string;
}

export class ShoppingListCheckParamsDto extends ShoppingListParamsDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  itemId: string;
}

export class ShoppingListQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: 100000 })
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(queryInteger)
  @IsInt()
  @Min(1)
  @Max(100000)
  page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(queryInteger)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ maxLength: SHOPPING_LIST_MAX_NAME_LENGTH })
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trimPgText)
  @IsString()
  @MaxLength(SHOPPING_LIST_MAX_NAME_LENGTH)
  search?: string;
}

class ShoppingListNewItemDto {
  @ApiProperty({ description: 'Canonical PostgreSQL bigint ID as text' })
  @Matches(SHOPPING_LIST_PRODUCT_ID_PATTERN)
  product_id: string;

  @ApiProperty({
    description: 'Positive decimal as text, up to 3 fractional digits',
    example: '1.25',
  })
  @Matches(SHOPPING_LIST_QUANTITY_PATTERN)
  quantity: string;
}

class ShoppingListEditItemDto extends ShoppingListNewItemDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Specify to retain the existing item and its check',
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsUUID()
  item_id?: string;
}

class ShoppingListNamedDto {
  @ApiProperty({ minLength: 1, maxLength: SHOPPING_LIST_MAX_NAME_LENGTH })
  @Transform(trimPgText)
  @IsString()
  @MinLength(1)
  @MaxLength(SHOPPING_LIST_MAX_NAME_LENGTH)
  name: string;
}

export class CreateShoppingListDto extends ShoppingListNamedDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  request_key: string;

  @ApiProperty({
    type: () => [ShoppingListNewItemDto],
    maxItems: SHOPPING_LIST_MAX_ITEMS,
  })
  @IsArray()
  @ArrayMaxSize(SHOPPING_LIST_MAX_ITEMS)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => ShoppingListNewItemDto)
  items: ShoppingListNewItemDto[];
}

export class EditShoppingListDto extends ShoppingListNamedDto {
  @ApiProperty({ minimum: 1, maximum: MAX_VERSION })
  @IsInt()
  @Min(1)
  @Max(MAX_VERSION)
  version: number;

  @ApiProperty({
    type: () => [ShoppingListEditItemDto],
    maxItems: SHOPPING_LIST_MAX_ITEMS,
  })
  @IsArray()
  @ArrayMaxSize(SHOPPING_LIST_MAX_ITEMS)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => ShoppingListEditItemDto)
  items: ShoppingListEditItemDto[];
}

export class ChangeShoppingListActivityDto {
  @ApiProperty({ minimum: 1, maximum: MAX_VERSION })
  @IsInt()
  @Min(1)
  @Max(MAX_VERSION)
  version: number;

  @ApiProperty()
  @IsBoolean()
  is_active: boolean;
}

export class SetShoppingListCheckDto {
  @ApiProperty({ minimum: 1, maximum: MAX_VERSION })
  @IsInt()
  @Min(1)
  @Max(MAX_VERSION)
  check_version: number;

  @ApiProperty()
  @IsBoolean()
  checked: boolean;
}
