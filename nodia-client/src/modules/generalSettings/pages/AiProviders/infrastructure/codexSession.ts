import { z } from "zod";
import { mainInstance } from "../../../../../config/api";

export const codexJobSchema = z
  .object({
    id: z.uuid(),
    state: z.enum([
      "running",
      "waiting_authorization",
      "verifying",
      "succeeded",
      "failed",
      "cancelled",
    ]),
    verificationUrl: z
      .literal("https://auth.openai.com/codex/device")
      .nullable(),
    userCode: z
      .string()
      .regex(/^[A-Za-z0-9-]{4,32}$/)
      .nullable(),
    reason: z.string().max(128).nullable(),
  })
  .strict()
  .refine((v) =>
    v.state === "waiting_authorization"
      ? v.verificationUrl !== null && v.userCode !== null
      : v.verificationUrl === null && v.userCode === null,
  );
export type CodexJob = z.infer<typeof codexJobSchema>;
const windowSchema = z
  .object({
    usedPercent: z.number().min(0).max(100).nullable(),
    windowDurationMins: z.number().nonnegative().nullable(),
    resetsAt: z.number().nonnegative().nullable(),
  })
  .strict();
export const codexSessionSchema = z
  .object({
    usageAllowed: z.boolean().nullable(),
    available: z.boolean(),
    authenticated: z.boolean().nullable(),
    planType: z.string().nullable(),
    checkedAt: z.string().nullable(),
    reason: z.string().max(128).nullable(),
    lastInferenceAt: z.string().nullable(),
    quotas: z
      .array(
        z
          .object({
            id: z.string(),
            name: z.string().nullable(),
            primary: windowSchema.nullable(),
            secondary: windowSchema.nullable(),
          })
          .strict(),
      )
      .max(100)
      .nullable(),
  })
  .strict();
export type CodexSession = z.infer<typeof codexSessionSchema>;
export const codexJobActive = (v?: CodexJob | null) =>
  !!v && ["running", "waiting_authorization", "verifying"].includes(v.state);
const endpoint = (id: string, suffix: string) =>
  `${mainInstance.defaults.baseURL?.includes("/api/v1") ? "" : "/api/v1"}/ai-providers/${encodeURIComponent(id)}/session${suffix}`;
export const getCurrentCodexLogin = async (id: string) => {
  const { data } = await mainInstance.get<unknown>(
    endpoint(id, "/login/current"),
  );
  return z.object({ job: codexJobSchema.nullable() }).strict().parse(data).job;
};
export const getCodexLogin = async (id: string, jobId: string) => {
  const { data } = await mainInstance.get<unknown>(
    endpoint(id, `/login/${encodeURIComponent(jobId)}`),
  );
  return codexJobSchema.parse(data);
};
export const startCodexLogin = async (id: string) => {
  const { data } = await mainInstance.post<unknown>(
    endpoint(id, "/login"),
    { mode: "token_plan_agentic" },
    { timeout: 65000 },
  );
  return codexJobSchema.parse(data);
};
export const cancelCodexLogin = async (id: string, jobId: string) => {
  const { data } = await mainInstance.post<unknown>(
    endpoint(id, `/login/${encodeURIComponent(jobId)}/cancel`),
  );
  return codexJobSchema.parse(data);
};
export const logoutCodex = async (id: string) => {
  const { data } = await mainInstance.post<unknown>(endpoint(id, "/logout"), {
    mode: "token_plan_agentic",
  });
  return z
    .object({ disconnected: z.literal(true) })
    .strict()
    .parse(data);
};

export const getCodexSession = async (id: string) => {
  const { data } = await mainInstance.get<unknown>(
    endpoint(id, "?mode=token_plan_agentic"),
    { timeout: 65000 },
  );
  return codexSessionSchema.parse(data);
};
