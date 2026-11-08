import { Type } from 'class-transformer';
import {
  IsDefined,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { MAX_SORT_ORDER } from './order-policy.js';

export class OrderNeighborDto {
  @IsString()
  @Matches(/^[1-9]\d{0,18}$/)
  id: string;

  @IsInt()
  @Min(0)
  @Max(MAX_SORT_ORDER)
  sort_order: number;
}

export class MoveOrderDto {
  @IsIn(['up', 'down', 'before', 'after'])
  direction: 'up' | 'down' | 'before' | 'after';

  @IsInt()
  @Min(0)
  @Max(MAX_SORT_ORDER)
  expected_sort_order: number;

  @ValidateIf((object: MoveOrderDto, value: unknown) =>
    value !== null || object.direction === 'before' || object.direction === 'after',
  )
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => OrderNeighborDto)
  expected_neighbor: OrderNeighborDto | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  page_size?: number;
}
