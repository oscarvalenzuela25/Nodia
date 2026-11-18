import { z } from "zod";

const safeUrl = z.string().url().max(4096).refine((value) => {
  const url = new URL(value);
  return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password;
});
const instant = z.string().refine((value) => value.includes("T") && Number.isFinite(Date.parse(value)));
export const NEWS_CATALOG_VERSION = 2;
export const newsSourceKeySchema = z.enum(["go-blog", "rust-blog", "kubernetes-blog"]);
const maxSources = newsSourceKeySchema.options.length;
const provenanceSchema = z.object({ source_key: newsSourceKeySchema, source_name: z.string().min(1), license_url: safeUrl });
export const articleSchema = z.object({
  id: z.string().min(1), source_key: newsSourceKeySchema, source_name: z.string().min(1),
  title: z.string().min(1).max(2000), url: safeUrl, excerpt: z.string().max(10000).nullable(),
  author: z.string().nullable(), topic: z.enum(["programming", "technology"]), published_at: instant.nullable(),
  received_at: instant, license_url: safeUrl, provenances: z.array(provenanceSchema).min(1).max(maxSources),
}).refine((article) => new Set(article.provenances.map((source) => source.source_key)).size === article.provenances.length)
  .refine((article) => article.provenances.some((source) => source.source_key === article.source_key && source.source_name === article.source_name && source.license_url === article.license_url));
export const sourceSchema = z.object({
  key: newsSourceKeySchema, name: z.string().min(1), home_url: safeUrl, license_url: safeUrl,
  last_attempt_at: instant.nullable(), last_success_at: instant.nullable(),
  next_refresh_at: instant.nullable(), last_error_code: z.string().nullable(),
});
export const newsResponseSchema = z.object({
  items: z.array(articleSchema).max(50), sources: z.array(sourceSchema).max(maxSources).refine((sources) => new Set(sources.map((source) => source.key)).size === sources.length),
  pagination: z.object({ page: z.number().int().positive(), limit: z.number().int().positive().max(50), total: z.number().int().nonnegative(), total_pages: z.number().int().nonnegative() }),
});
export const refreshResponseSchema = z.object({
  source_key: newsSourceKeySchema, status: z.enum(["updated", "not_modified", "cached"]),
  received_count: z.number().int().nonnegative(), stored_count: z.number().int().nonnegative(),
  last_attempt_at: instant, last_success_at: instant.nullable(), next_refresh_at: instant,
});
export type NewsArticle = z.infer<typeof articleSchema>;
export type NewsSourceStatus = z.infer<typeof sourceSchema>;
export type NewsResponse = z.infer<typeof newsResponseSchema>;
export type NewsRefreshResponse = z.infer<typeof refreshResponseSchema>;
export type NewsSourceKey = z.infer<typeof newsSourceKeySchema>;
export type NewsFilters = { topic: "all" | "technology" | "programming" | "ai"; source: "all" | NewsSourceKey; order: "recent" | "received"; page: number };
