export type NewsTopic = 'technology' | 'programming' | 'ai';
export type NewsSourceKey = 'web-dev' | 'node-js';
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
  topic: 'programming';
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
export interface NewsRefreshResponse {
  source_key: NewsSourceKey;
  status: 'updated' | 'not_modified' | 'cached';
  received_count: number;
  stored_count: number;
  last_attempt_at: string;
  last_success_at: string | null;
  next_refresh_at: string;
}
export interface FeedResult {
  status: 'updated' | 'not_modified';
  articles: StoredNewsArticle[];
  etag: string | null;
  lastModified: string | null;
}
