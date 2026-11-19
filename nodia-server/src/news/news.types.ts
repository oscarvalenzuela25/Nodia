import type { RETIRED_NEWS_SOURCE_KEYS } from './news.sources.js';

export type NewsTopic = 'technology' | 'programming' | 'ai';
export type NewsSourceKey = (typeof RETIRED_NEWS_SOURCE_KEYS)[number];
export interface NewsProvenance {
  source_key: NewsSourceKey;
  source_name: string;
  license_url: string;
}
interface NewsArticleMetadata extends NewsProvenance {
  id: string;
  title: string;
  url: string;
  excerpt: string | null;
  author: string | null;
  topic: NewsTopic;
  published_at: string | null;
  received_at: string;
}
export interface NewsArticle extends NewsArticleMetadata {
  provenances: NewsProvenance[];
}
export interface StoredNewsArticle extends NewsArticleMetadata {
  last_seen_at: string;
}
export interface NewsSourceStatus {
  key: NewsSourceKey;
  name: string;
  home_url: string;
  license_url: string;
  last_attempt_at: string | null;
  last_success_at: string | null;
  next_refresh_at: string | null;
  last_error_code: string | null;
}
export interface NewsListResponse {
  items: NewsArticle[];
  sources: NewsSourceStatus[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}
