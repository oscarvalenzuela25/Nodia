import { z } from "zod";

export const personalProviderSchema = z.enum(["dev-community", "daily-dev"]);
export type PersonalProvider = z.infer<typeof personalProviderSchema>;

const instant = z.iso.datetime({ offset: true }).nullable();
const errorCode = z.string().regex(/^(?:news:)?[a-z_]{1,96}$/).nullable();
const coverOrigin = "https://media2.dev.to";
const articleTags = z.array(z.string().trim().toLowerCase().min(1).max(64).regex(/^[\p{L}\p{N}_-]+$/u))
  .max(8)
  .transform((tags) => [...new Set(tags)])
  .optional()
  .catch(undefined);

function personalCoverUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 4096) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && url.origin === coverOrigin && !url.username && !url.password) {
      return url.href;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export const connectionSchema = z.object({
  provider: personalProviderSchema,
  state: z.enum(["disconnected", "connected", "reconnect_required", "pending"]),
  account_name: z.string().min(1).max(256).nullable(),
  key_hint: z.string().regex(/^[*•]{4,12}$/u).nullable(),
  last_tested_at: instant,
  last_test_error_code: errorCode,
  last_refresh_attempt_at: instant,
  last_refresh_success_at: instant,
  last_refresh_error_code: errorCode,
  next_refresh_at: instant,
  retry_source: z.enum(["provider", "local"]).nullable(),
  snapshot_status: z.enum(["updated", "empty", "no_followed_tags"]).nullable(),
});

const articleSchema = z.object({
  id: z.string().min(1).max(256),
  provider: personalProviderSchema,
  title: z.string().min(1).max(500),
  url: z.url({ protocol: /^https$/ }).max(4096).refine((value) => {
    const url = new URL(value);
    return !url.username && !url.password;
  }),
  published_at: instant,
  cover_image_url: z.preprocess(personalCoverUrl, z.string().optional()),
  tags: articleTags,
});

export const connectionsResponseSchema = z.object({
  connections: z.array(connectionSchema).length(2).refine(
    (connections) => new Set(connections.map(({ provider }) => provider)).size === 2,
  ),
});
export const articlesResponseSchema = z.object({ items: z.array(articleSchema).max(100) });
export const connectionResponseSchema = z.object({ connection: connectionSchema });
export const refreshResponseSchema = z.object({
  connection: connectionSchema,
  status: z.enum(["updated", "empty", "no_followed_tags", "cached"]),
  received_count: z.number().int().min(0).max(100),
});

export type PersonalConnection = z.infer<typeof connectionSchema>;
export type PersonalArticle = z.infer<typeof articleSchema>;
export type PersonalRefreshStatus = z.infer<typeof refreshResponseSchema>["status"];
