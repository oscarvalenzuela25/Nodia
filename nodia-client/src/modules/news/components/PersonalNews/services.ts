import { CanceledError, isAxiosError, isCancel } from "axios";
import { z } from "zod";
import { mainInstance } from "../../../../config/api";
import { apiPath } from "../../../../config/apiPath";
import { getServerErrorCode } from "../../../../config/axiosInstance";
import useAuthStore, { hasValidatedSession } from "../../../../store/authStore";
import {
  articlesResponseSchema, connectionResponseSchema, connectionsResponseSchema,
  refreshResponseSchema, type PersonalProvider,
} from "./types";

const feedbackCodes = [
  "provider_credentials_invalid",
  "provider_rate_limited",
  "provider_unavailable",
  "provider_invalid_response",
  "provider_pending",
  "connection_required",
  "operation_in_progress",
  "operation_superseded",
  "invalid_input",
] as const;
type FeedbackCode = typeof feedbackCodes[number];
const serverFeedback = new Set<string>(feedbackCodes);

export class PersonalNewsError extends Error {
  readonly code: FeedbackCode | "invalid_response" | "unknown";

  constructor(code: FeedbackCode | "invalid_response" | "unknown") {
    super(code);
    this.code = code;
  }
}

export function personalNewsErrorKey(code: string | null, provider?: PersonalProvider): string {
  const key = code?.replace(/^news:/u, "");
  if (key === "provider_credentials_invalid" && provider === "daily-dev")
    return "news:personal_daily_credentials_invalid";
  if (key === "invalid_response") return "news:invalid_response";
  return key && serverFeedback.has(key) ? `news:${key}` : "core:server_error_toast";
}

export function currentPersonalNewsActor(state = useAuthStore.getState()) {
  return hasValidatedSession(state) && state.user?.id
    ? `${state.user.id}:${state.sessionVersion}`
    : null;
}

async function requestForActor<T>(
  actorKey: string,
  signal: AbortSignal | undefined,
  request: (requestSignal: AbortSignal) => Promise<T>,
): Promise<T> {
  if (signal?.aborted || currentPersonalNewsActor() !== actorKey)
    throw new CanceledError("Session changed");
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  const unsubscribe = useAuthStore.subscribe((state) => {
    if (currentPersonalNewsActor(state) !== actorKey) abort();
  });
  try {
    const result = await request(controller.signal);
    if (controller.signal.aborted || currentPersonalNewsActor() !== actorKey)
      throw new CanceledError("Session changed");
    return result;
  } catch (error) {
    if (controller.signal.aborted || isCancel(error) || currentPersonalNewsActor() !== actorKey)
      throw new CanceledError("Session changed");
    if (error instanceof PersonalNewsError) throw error;
    const data: unknown = isAxiosError(error) ? error.response?.data : undefined;
    const rawCode = getServerErrorCode(error) ??
      (data && typeof data === "object" && "message" in data ? data.message : undefined);
    const code = typeof rawCode === "string" ? rawCode.replace(/^news:/u, "") : "";
    // Axios errors can retain the request body. Only an allowlisted code may escape.
    throw new PersonalNewsError(serverFeedback.has(code) ? code as FeedbackCode : "unknown");
  } finally {
    signal?.removeEventListener("abort", abort);
    unsubscribe();
  }
}

function parseResponse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) throw new PersonalNewsError("invalid_response");
  return result.data;
}

const connectionPath = (provider: PersonalProvider) => apiPath(`/news/personal/connections/${provider}`);

export function getPersonalConnections(actor: string, signal: AbortSignal) {
  return requestForActor(actor, signal, async (requestSignal) => {
    const { data } = await mainInstance.get<unknown>(apiPath("/news/personal/connections"), { signal: requestSignal });
    return parseResponse(connectionsResponseSchema, data);
  });
}

export function getPersonalArticles(actor: string, provider: PersonalProvider | undefined, signal: AbortSignal) {
  return requestForActor(actor, signal, async (requestSignal) => {
    const { data } = await mainInstance.get<unknown>(apiPath("/news/personal/articles"), {
      params: { provider },
      signal: requestSignal,
    });
    const articles = parseResponse(articlesResponseSchema, data);
    if (articles.items.some((item) => item.provider !== (provider ?? "dev-community")) ||
      (provider === "daily-dev" && articles.items.length > 10))
      throw new PersonalNewsError("invalid_response");
    return articles;
  });
}

export function connectPersonalSource(actor: string, provider: PersonalProvider, apiKey: string, signal: AbortSignal) {
  return requestForActor(actor, signal, async (requestSignal) => {
    const { data } = await mainInstance.post<unknown>(connectionPath(provider), { api_key: apiKey }, {
      signal: requestSignal,
      // A credential submission must not replay after an authentication failure.
      authRetried: true,
    });
    return connectionForProvider(connectionResponseSchema, data, provider);
  });
}

export function testPersonalSource(actor: string, provider: PersonalProvider, signal: AbortSignal) {
  return requestForActor(actor, signal, async (requestSignal) => {
    const { data } = await mainInstance.post<unknown>(`${connectionPath(provider)}/test`, undefined, {
      signal: requestSignal,
      authRetried: true,
    });
    return connectionForProvider(connectionResponseSchema, data, provider);
  });
}

export function refreshPersonalSource(actor: string, provider: PersonalProvider, signal: AbortSignal) {
  return requestForActor(actor, signal, async (requestSignal) => {
    const { data } = await mainInstance.post<unknown>(`${connectionPath(provider)}/refresh`, undefined, {
      signal: requestSignal,
      authRetried: true,
    });
    return connectionForProvider(refreshResponseSchema, data, provider);
  });
}

export function disconnectPersonalSource(actor: string, provider: PersonalProvider, signal: AbortSignal) {
  return requestForActor(actor, signal, async (requestSignal) => {
    const { status } = await mainInstance.delete(connectionPath(provider), { signal: requestSignal, authRetried: true });
    if (status !== 204) throw new PersonalNewsError("invalid_response");
  });
}

function connectionForProvider<T extends z.infer<typeof connectionResponseSchema>>(
  schema: z.ZodType<T>,
  data: unknown,
  provider: PersonalProvider,
): T {
  const result = parseResponse(schema, data);
  if (result.connection.provider !== provider) throw new PersonalNewsError("invalid_response");
  return result;
}
