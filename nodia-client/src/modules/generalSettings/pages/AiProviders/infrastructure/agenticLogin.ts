import { z } from "zod";

const authorizationUrl = z.string().max(4096).refine((value) => {
  try {
    const url = new URL(value);
    return !/\s/.test(value) && !Array.from(value).some((char) => char.charCodeAt(0) < 32)
      && url.protocol === "https:" && url.host === "accounts.google.com"
      && !url.username && !url.password && !url.hash
      && ["/o/oauth2/auth", "/o/oauth2/v2/auth"].includes(url.pathname)
      && url.searchParams.get("redirect_uri") === "https://antigravity.google/oauth-callback"
      && url.searchParams.get("response_type") === "code"
      && url.searchParams.get("code_challenge_method") === "S256"
      && ["client_id", "state", "code_challenge", "scope"].every((key) => Boolean(url.searchParams.get(key)))
      && Array.from(url.searchParams.keys()).every((key) => url.searchParams.getAll(key).length === 1)
      && ["access_token", "refresh_token", "id_token", "code"].every((key) => !url.searchParams.has(key));
  } catch { return false; }
});

export const geminiAgenticLoginSchema = z.object({
  id: z.string().regex(/^[0-9a-f]{32}$/),
  state: z.enum(["running", "waiting_code", "verifying", "succeeded", "failed", "cancelled"]),
  authorization_url: authorizationUrl.nullable(),
  reason: z.enum(["agentic_login_timeout", "agentic_login_failed"]).nullable(),
}).strict().refine((job) => job.state === "waiting_code"
  ? job.authorization_url !== null : job.authorization_url === null);

export type GeminiAgenticLoginJob = z.infer<typeof geminiAgenticLoginSchema>;
export const geminiAgenticCodeSchema = z.object({
  code: z.string().trim().regex(/^[A-Za-z0-9_./+~-]{8,2048}$/, "ai_providers:agentic_login.code_invalid"),
}).strict();
export type GeminiAgenticCode = z.infer<typeof geminiAgenticCodeSchema>;
export const currentGeminiAgenticLoginSchema = z.object({ job: geminiAgenticLoginSchema.nullable() }).strict();
export const agenticLoginIsActive = (job: GeminiAgenticLoginJob | null | undefined) =>
  Boolean(job && ["running", "waiting_code", "verifying"].includes(job.state));
