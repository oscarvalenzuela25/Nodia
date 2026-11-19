import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import type { NewsSourceKey, NewsTopic } from '../news.types.js';
import {
  LEGACY_PUBLIC_NEWS_CATALOG,
  RETIRED_NEWS_SOURCE_KEYS,
} from '../news.sources.js';

export class ListNewsDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === String(LEGACY_PUBLIC_NEWS_CATALOG)
      ? LEGACY_PUBLIC_NEWS_CATALOG
      : value,
  )
  @IsIn([LEGACY_PUBLIC_NEWS_CATALOG])
  catalog?: typeof LEGACY_PUBLIC_NEWS_CATALOG;

  @IsOptional() @IsIn(RETIRED_NEWS_SOURCE_KEYS) source_key?: NewsSourceKey;
  @IsOptional() @IsIn(['technology', 'programming', 'ai']) topic?: NewsTopic;
  @IsOptional() @IsIn(['recent', 'received']) order?: 'recent' | 'received';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10000) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number;
}
