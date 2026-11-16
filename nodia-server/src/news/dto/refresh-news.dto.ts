import { IsIn } from 'class-validator';
import { NEWS_SOURCE_KEYS } from '../news.sources.js';
import type { NewsSourceKey } from '../news.types.js';
export class RefreshNewsDto {
  @IsIn(NEWS_SOURCE_KEYS) source_key: NewsSourceKey;
}
