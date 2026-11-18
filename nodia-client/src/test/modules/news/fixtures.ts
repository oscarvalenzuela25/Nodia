import type { NewsArticle, NewsResponse, NewsRefreshResponse } from "../../../modules/news/types";

// Synthetic metadata for isolated tests, never imported by production code.
export const article: NewsArticle = {
  id: "synthetic-news-1", source_key: "go-blog", source_name: "Synthetic editor",
  title: "Synthetic publication", url: "https://example.test/article", excerpt: "A synthetic plain-text excerpt.",
  author: null, topic: "programming", published_at: "2026-10-01T10:00:00.000Z",
  received_at: "2026-10-02T10:00:00.000Z", license_url: "https://example.test/license",
  provenances: [{ source_key: "go-blog", source_name: "Synthetic editor", license_url: "https://example.test/license" }],
};
export const news: NewsResponse = { items: [article], sources: [{ key: "go-blog", name: "Synthetic editor", home_url: "https://example.test", license_url: "https://example.test/license", last_attempt_at: null, last_success_at: null, next_refresh_at: null, last_error_code: null }], pagination: { page: 1, limit: 20, total: 1, total_pages: 1 } };
export const refreshed: NewsRefreshResponse = { source_key: "go-blog", status: "updated", received_count: 1, stored_count: 1, last_attempt_at: "2026-10-02T10:00:00.000Z", last_success_at: "2026-10-02T10:00:00.000Z", next_refresh_at: "2026-10-02T10:15:00.000Z" };
