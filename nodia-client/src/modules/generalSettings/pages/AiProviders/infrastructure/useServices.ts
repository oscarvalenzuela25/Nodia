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
  getGeminiEngines,
} from "./services";
import type {
  GetAiProvidersParams,
  CreateAiProviderPayload,
  UpdateAiProviderPayload,
  GetAiProviderEventsParams,
  GetSelectableModelsParams,
} from "./types";

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
        queryClient.invalidateQueries({ queryKey: ["gemini-engines"] });
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

export const useAiProvidersHealth = () => {
  return useQuery({
    queryKey: ["ai-providers-health"],
    queryFn: () => getAiProvidersHealth(),
    staleTime: 1000 * 30, // 30 seconds
  });
};

export const useAiProviderEvents = (params?: GetAiProviderEventsParams) => {
  return useQuery({
    queryKey: ["ai-provider-events", params],
    queryFn: () => getAiProviderEvents(params),
  });
};

export const useSelectableModels = (params?: GetSelectableModelsParams) => {
  return useQuery({
    queryKey: ["ai-selectable-models", params],
    queryFn: () => getSelectableModels(params),
  });
};

export const useCreateAiProvider = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateAiProviderPayload) => createAiProvider(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-providers"] });
      queryClient.invalidateQueries({ queryKey: ["ai-providers-health"] });
      queryClient.invalidateQueries({ queryKey: ["gemini-engines"] });
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
      queryClient.invalidateQueries({ queryKey: ["gemini-engines"] });
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
    queryKey: ["gemini-engines"],
    queryFn: getGeminiEngines,
    enabled: options?.enabled ?? true,
    staleTime: 1000 * 30,
  });
};
