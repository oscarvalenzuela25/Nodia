import { IsIn } from 'class-validator';
import { RETIRED_NEWS_SOURCE_KEYS } from '../news.sources.js';
import type { NewsSourceKey } from '../news.types.js';
export class RefreshNewsDto {
  @IsIn(RETIRED_NEWS_SOURCE_KEYS) source_key: NewsSourceKey;
}
