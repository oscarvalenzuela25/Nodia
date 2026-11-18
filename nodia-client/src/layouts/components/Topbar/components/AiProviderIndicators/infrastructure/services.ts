import { apiPath } from "../../../../../../config/apiPath";
import { mainInstance } from "../../../../../../config/api";
import { z } from "zod";

const topbarStatusSchema = z.object({
  provider: z.object({
    name: z.string().min(1),
    key: z.string(),
    isActive: z.boolean(),
    use_api_key: z.boolean(),
    use_agentic: z.boolean(),
    hasApiKey: z.boolean(),
    agentic: z.object({
      available: z.boolean().nullable(),
      authenticated: z.boolean().nullable(),
      usageAllowed: z.boolean().nullable().optional(),
      reason: z.enum(["codex_runtime_unverified", "codex_profile_busy", "runtime_busy"]).optional(),
    }).nullable(),
  }).nullable(),
});

export async function getTopbarAiStatus(signal: AbortSignal) {
  const { data } = await mainInstance.get<unknown>(apiPath("/ai-providers/topbar-status"), { signal, timeout: 45_000 });
  return topbarStatusSchema.parse(data);
}
