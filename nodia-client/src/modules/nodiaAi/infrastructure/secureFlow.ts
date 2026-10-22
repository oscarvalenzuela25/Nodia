import { z } from "zod";
import { isAxiosError } from "axios";
import { mainInstance } from "../../../config/api";
import { geminiAgenticLoginSchema } from "../../generalSettings/pages/AiProviders/infrastructure/agenticLogin";
import { geminiWebLoginSchema, geminiLoginFrameSchema } from "../../generalSettings/pages/AiProviders/infrastructure/webLogin";
import { codexJobSchema } from "../../generalSettings/pages/AiProviders/infrastructure/codexSession";

const uuid = z.uuid();
const id = z.string().regex(/^[1-9]\d{0,18}$/).refine(value => /^[1-9]\d{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n);
export const secureFlowSchema = z.object({
  reference: uuid,
  kind: z.enum(["api_key_create", "api_key_update", "api_key_delete", "connection_login", "nodia_logout", "codex_logout", "gemini_web_logout", "sync_models"]),
  provider_id: id.nullable(), key_id: id.nullable(),
  provider_key: z.string().min(1).max(64).nullable(),
  mode: z.enum(["api_key", "token_plan_web", "token_plan_agentic"]).nullable(),
  expires_at: z.iso.datetime({ offset: true }),
  status: z.enum(["waiting", "invoking", "pending", "completed", "unknown", "cancelled", "expired", "failed"]),
  revision: z.number().int().positive(),
}).strict().refine(flow => flow.kind === "nodia_logout" ? flow.provider_id === null && flow.key_id === null && flow.mode === null && flow.provider_key === null
  : flow.provider_id !== null && (flow.kind === "api_key_update" || flow.kind === "api_key_delete" ? flow.key_id !== null : flow.key_id === null));
export const secureFlowResponseSchema = z.object({ flow: secureFlowSchema,
  interaction: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("gemini_web"), data: geminiWebLoginSchema }).strict(),
    z.object({ kind: z.literal("gemini_agentic"), data: geminiAgenticLoginSchema }).strict(),
    z.object({ kind: z.literal("codex"), data: codexJobSchema }).strict(),
  ]).optional(),
  frame: geminiLoginFrameSchema.optional(),
}).strict().refine(value => !value.interaction || value.flow.kind === "connection_login" && (
  value.interaction.kind === "gemini_web" && value.flow.provider_key === "gemini" && value.flow.mode === "token_plan_web"
  || value.interaction.kind === "gemini_agentic" && value.flow.provider_key === "gemini" && value.flow.mode === "token_plan_agentic"
  || value.interaction.kind === "codex" && value.flow.provider_key === "openai" && value.flow.mode === "token_plan_agentic"))
  .refine(value => value.frame === undefined || value.flow.kind === "connection_login" && value.flow.provider_key === "gemini" && value.flow.mode === "token_plan_web");
export type SecureFlow = z.infer<typeof secureFlowSchema>;
export type SecureFlowResponse = z.infer<typeof secureFlowResponseSchema>;
export type SecureFlowAction = "key" | "delete" | "sync" | "start" | "status" | "code" | "frame" | "input" | "cancel" | "logout";
export type SecureFlowPayload = Record<string, string | number | undefined>;
const path = (executionId: string) => `/nodia-ai/operations/${encodeURIComponent(uuid.parse(executionId))}/secure-flow`;

/** Direct human transport. Secret/code/frame values never enter the query or mutation caches. */
export async function getNodiaAiSecureFlow(executionId: string, signal?: AbortSignal): Promise<SecureFlowResponse> {
  const { data } = await mainInstance.get<unknown>(path(executionId), { signal });
  return z.object({ flow: secureFlowSchema }).strict().parse(data);
}
export async function actNodiaAiSecureFlow(executionId: string, flow: SecureFlow, action: SecureFlowAction,
  clientRequestId: string, payload?: SecureFlowPayload): Promise<SecureFlowResponse> {
  const body = { expected_execution_revision: flow.revision, client_request_id: uuid.parse(clientRequestId), ...(payload ? { payload: { ...payload } } : {}) };
  try {
    const response = await mainInstance.post<unknown>(`${path(executionId)}/${encodeURIComponent(flow.reference)}/${action}`, body);
    if (response.config) response.config.data = undefined;
    const result = secureFlowResponseSchema.parse(response.data);
    if (result.flow.reference !== flow.reference || result.flow.provider_id !== flow.provider_id || result.flow.kind !== flow.kind
      || result.flow.key_id !== flow.key_id || result.flow.provider_key !== flow.provider_key || result.flow.mode !== flow.mode || result.flow.revision < flow.revision)
      throw new Error("nodia_ai:invalid_response");
    return result;
  } catch (error) {
    // Axios retains the serialized request on errors. Remove that transport copy
    // before feedback; the form alone keeps the user's input for a failed save.
    if (isAxiosError(error)) {
      if (error.config) error.config.data = undefined;
      if (error.response) error.response.config.data = undefined;
      const privateValues = [payload?.secret, payload?.code, payload?.text].filter((value): value is string => typeof value === "string" && value.length > 0);
      if (privateValues.some(value => JSON.stringify(error.response?.data ?? "").includes(value) || error.message.includes(value))) {
        error.message = "core:server_error_toast";
        if (error.response) error.response.data = { message: "core:server_error_toast" };
      }
    }
    throw error;
  } finally {
    if (body.payload) for (const key of Object.keys(body.payload)) delete body.payload[key];
  }
}
