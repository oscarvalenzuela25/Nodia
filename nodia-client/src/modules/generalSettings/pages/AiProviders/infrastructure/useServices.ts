import { getAiApiKeys, createAiApiKey, updateAiApiKey, deleteAiApiKey } from "./services";
import type { GetAiApiKeysParams } from "./types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAiProviders,
  createAiProvider,
  updateAiProvider,
  getAiProvidersHealth,
  getAiProviderEvents,
  getSelectableModels,
  getEnabledWebAiProviders,
  getSupportedAiProviders,
  getAiProviderCatalog,
  syncAiProviderModels,
  startGeminiLogin,
  getGeminiLoginStatus,
  cancelGeminiLogin,
  startGeminiAgenticLogin,
  getCurrentGeminiAgenticLogin,
  getGeminiAgenticLoginStatus,
  submitGeminiAgenticCode,
  cancelGeminiAgenticLogin,
} from "./services";
import type {
  GetAiProvidersParams,
  CreateAiProviderPayload,
  UpdateAiProviderPayload,
  GetAiProviderEventsParams,
  GetSelectableModelsParams,
  AiProvidersHealthResponse,
} from "./types";
import { agenticLoginIsActive } from "./agenticLogin";

export const useStartGeminiAgenticLogin = () => useMutation({ mutationFn: startGeminiAgenticLogin, retry: false, gcTime: 0 });
export const useSubmitGeminiAgenticCode = () => useMutation({ mutationFn: submitGeminiAgenticCode, retry: false, gcTime: 0 });
export const useCancelGeminiAgenticLogin = () => useMutation({ mutationFn: cancelGeminiAgenticLogin, retry: false, gcTime: 0 });
export const useCurrentGeminiAgenticLogin = (enabled: boolean) => useQuery({
  queryKey: ["gemini-agentic-login", "current"], queryFn: getCurrentGeminiAgenticLogin,
  enabled, retry: false, gcTime: 0, refetchOnWindowFocus: false,
});
export const useGeminiAgenticLoginStatus = (id: string | null) => useQuery({
  queryKey: ["gemini-agentic-login", id], queryFn: () => getGeminiAgenticLoginStatus(id!),
  enabled: Boolean(id), retry: false, gcTime: 0, refetchOnWindowFocus: false,
  refetchInterval: (query) => query.state.error ? false
    : agenticLoginIsActive(query.state.data) || !query.state.data ? 2000 : false,
});

export const useAiProviderCatalog = () => {
  return useQuery({
    queryKey: ["ai-provider-catalog"],
    queryFn: () => getAiProviderCatalog(),
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
};

export const useStartGeminiLogin = () => useMutation({ mutationFn: startGeminiLogin });

export const useGeminiLoginStatus = (jobId: string | null, enabled: boolean) =>
  useQuery({
    queryKey: ["gemini-login", jobId],
    queryFn: () => getGeminiLoginStatus(jobId!),
    enabled: enabled && Boolean(jobId),
    refetchInterval: (query) =>
      query.state.data?.state === "running" || !query.state.data ? 2000 : false,
  });

export const useCancelGeminiLogin = () =>
  useMutation({ mutationFn: cancelGeminiLogin });

export const useSyncAiProviderModels = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (
      args:
        | string
        | { id: string; persist?: boolean; mode?: string; engine?: string }
    ) => {
      if (typeof args === "string") {
        return syncAiProviderModels(args);
      }
      return syncAiProviderModels(args.id, args.persist, args.mode, args.engine);
    },
    onSuccess: (_data, variables) => {
      const shouldPersist =
        typeof variables === "string" || variables.persist !== false;
      if (shouldPersist) {
        queryClient.invalidateQueries({ queryKey: ["ai-providers"] });
        queryClient.invalidateQueries({ queryKey: ["ai-providers-health"] });
      }
    },
  });
};

export const useSupportedAiProviders = () => {
  return useQuery({
    queryKey: ["ai-supported-providers"],
    queryFn: () => getSupportedAiProviders(),
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
};

export const useAiProviders = (params?: GetAiProvidersParams) => {
  return useQuery({
    queryKey: ["ai-providers", params],
    queryFn: () => getAiProviders(params),
  });
};

// One HTTP response and one cache entry for badges, alerts and session panels.
const providerHealthOptions = {
  queryKey: ["ai-providers-health"],
  queryFn: () => getAiProvidersHealth(),
  staleTime: 30_000,
  refetchInterval: 30_000,
};

export const useAiProvidersHealth = () => useQuery(providerHealthOptions);

export const useAiProviderEvents = (params?: GetAiProviderEventsParams) => {
  return useQuery({
    queryKey: ["ai-provider-events", params],
    queryFn: () => getAiProviderEvents(params),
  });
};

export const useSelectableModels = (params?: GetSelectableModelsParams, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ["ai-selectable-models", params],
    queryFn: () => getSelectableModels(params),
    enabled: options?.enabled ?? true,
  });
};

export const useCreateAiProvider = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateAiProviderPayload) => createAiProvider(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-providers"] });
      queryClient.invalidateQueries({ queryKey: ["ai-providers-health"] });
    },
  });
};

export const useUpdateAiProvider = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      payload,
      data,
    }: {
      id: string;
      payload?: UpdateAiProviderPayload;
      data?: UpdateAiProviderPayload;
    }) => updateAiProvider(id, (payload || data)!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-providers"] });
      queryClient.invalidateQueries({ queryKey: ["ai-providers-health"] });
    },
  });
};

export const useEnabledWebAiProviders = () => {
  return useQuery({
    queryKey: ["ai-enabled-web-providers"],
    queryFn: () => getEnabledWebAiProviders(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

export const useGeminiEngines = (options?: { enabled?: boolean }) => {
  return useQuery({
    ...providerHealthOptions,
    enabled: options?.enabled ?? true,
    select: (health: AiProvidersHealthResponse) => health.engines ?? null,
  });
};

export const useAiApiKeys = (params: GetAiApiKeysParams) => useQuery({ queryKey: ["ai-api-keys", params], queryFn: () => getAiApiKeys(params) });
const useRefreshApiConnections = () => {
  const client = useQueryClient();
  return async () => { await Promise.all(["ai-api-keys", "ai-providers", "ai-providers-health", "ai-selectable-models"].map((key) => client.invalidateQueries({ queryKey: [key] }))); };
};
export const useCreateAiApiKey = () => useMutation({ mutationFn: (payload: import("./types").CreateAiApiKeyPayload) => createAiApiKey(payload), gcTime: 0, onSuccess: useRefreshApiConnections() });
export const useUpdateAiApiKey = () => useMutation({ mutationFn: ({ id, payload }: { id: string; payload: import("./types").UpdateAiApiKeyPayload }) => updateAiApiKey(id, payload), onSuccess: useRefreshApiConnections() });
export const useDeleteAiApiKey = () => useMutation({ mutationFn: (id: string) => deleteAiApiKey(id), onSuccess: useRefreshApiConnections() });
