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
  createAiApiKey,
  getAiApiKeys,
  updateAiApiKey,
  deleteAiApiKey,
} from "./services";
import type {
  GetAiProvidersParams,
  CreateAiProviderPayload,
  UpdateAiProviderPayload,
  GetAiProviderEventsParams,
  GetSelectableModelsParams,
  CreateAiApiKeyPayload,
  GetAiApiKeysParams,
  UpdateAiApiKeyPayload,
} from "./types";

export const useAiProviderCatalog = () => {
  return useQuery({
    queryKey: ["ai-provider-catalog"],
    queryFn: () => getAiProviderCatalog(),
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
};

export const useSyncAiProviderModels = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (args: string | { id: string; persist?: boolean }) => {
      if (typeof args === "string") {
        return syncAiProviderModels(args);
      }
      return syncAiProviderModels(args.id, args.persist);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-providers"] });
      queryClient.invalidateQueries({ queryKey: ["ai-providers-health"] });
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

export const useAiApiKeys = (params?: GetAiApiKeysParams) => {
  return useQuery({
    queryKey: ["ai-api-keys", params],
    queryFn: () => getAiApiKeys(params),
  });
};

export const useCreateAiApiKey = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateAiApiKeyPayload) => createAiApiKey(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-providers-health"] });
      queryClient.invalidateQueries({ queryKey: ["ai-api-keys"] });
    },
  });
};

export const useUpdateAiApiKey = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateAiApiKeyPayload;
    }) => updateAiApiKey(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-providers-health"] });
      queryClient.invalidateQueries({ queryKey: ["ai-api-keys"] });
    },
  });
};

export const useDeleteAiApiKey = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteAiApiKey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-providers-health"] });
      queryClient.invalidateQueries({ queryKey: ["ai-api-keys"] });
    },
  });
};
