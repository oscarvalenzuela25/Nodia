import { mainInstance } from "../../../../../config/api";
import type {
  GetSelectableModelsParams,
  ProviderSelectableModelsResult,
  AiProviderEntity,
  GetAiProvidersParams,
  CreateAiProviderPayload,
  UpdateAiProviderPayload,
  AiProvidersHealthResponse,
  AiProviderEventEntity,
  GetAiProviderEventsParams,
  PaginatedResponse,
  EnabledWebAiProvidersResponse,
  CreateAiApiKeyPayload,
  UpdateAiApiKeyPayload,
  GetAiApiKeysParams,
  AiApiKeyEntity,
  AiProviderCatalogEntity,
  SyncModelsResult,
} from "./types";

const getEndpoint = (path: string) => {
  const hasV1 = mainInstance.defaults.baseURL?.includes("/api/v1");
  return hasV1 ? path : `/api/v1${path}`;
};

export const getAiProviderCatalog = async (): Promise<AiProviderCatalogEntity[]> => {
  const { data } = await mainInstance.get<AiProviderCatalogEntity[]>(
    getEndpoint("/ai-providers/catalog")
  );
  return data;
};

export const getSupportedAiProviders = getAiProviderCatalog;

export const syncAiProviderModels = async (
  id: string,
  persist?: boolean
): Promise<SyncModelsResult> => {
  const query = persist !== undefined ? `?persist=${persist}` : "";
  const { data } = await mainInstance.post<SyncModelsResult>(
    getEndpoint(`/ai-providers/${id}/sync-models${query}`)
  );
  return data;
};

export const getAiProviders = async (
  params?: GetAiProvidersParams
): Promise<PaginatedResponse<AiProviderEntity>> => {
  const { data } = await mainInstance.get<PaginatedResponse<AiProviderEntity>>(
    getEndpoint("/ai-providers"),
    { params }
  );
  return data;
};

export const createAiProvider = async (
  payload: CreateAiProviderPayload
): Promise<AiProviderEntity> => {
  const { data } = await mainInstance.post<AiProviderEntity>(
    getEndpoint("/ai-provider"),
    payload
  );
  return data;
};

export const updateAiProvider = async (
  id: string,
  payload: UpdateAiProviderPayload
): Promise<AiProviderEntity> => {
  const { data } = await mainInstance.put<AiProviderEntity>(
    getEndpoint(`/ai-provider/${id}`),
    payload
  );
  return data;
};

export const getAiProvidersHealth = async (): Promise<AiProvidersHealthResponse> => {
  const { data } = await mainInstance.get<AiProvidersHealthResponse>(
    getEndpoint("/ai-providers/health")
  );
  return data;
};

export const getAiProviderEvents = async (
  params?: GetAiProviderEventsParams
): Promise<PaginatedResponse<AiProviderEventEntity>> => {
  const { data } = await mainInstance.get<PaginatedResponse<AiProviderEventEntity>>(
    getEndpoint("/ai-provider-events"),
    { params }
  );
  return data;
};

export const getSelectableModels = async (
  params?: GetSelectableModelsParams
): Promise<ProviderSelectableModelsResult[]> => {
  const { data } = await mainInstance.get<ProviderSelectableModelsResult[]>(
    getEndpoint("/ai-providers/models"),
    { params }
  );
  return data;
};

export const getEnabledWebAiProviders = async (): Promise<EnabledWebAiProvidersResponse> => {
  const { data } = await mainInstance.get<EnabledWebAiProvidersResponse>(
    getEndpoint("/ai-providers/web-enabled")
  );
  return data;
};

export const getAiApiKeys = async (
  params?: GetAiApiKeysParams
): Promise<PaginatedResponse<AiApiKeyEntity>> => {
  const { data } = await mainInstance.get<PaginatedResponse<AiApiKeyEntity>>(
    getEndpoint("/ai-api-keys"),
    { params }
  );
  return data;
};

export const createAiApiKey = async (
  payload: CreateAiApiKeyPayload
): Promise<AiApiKeyEntity> => {
  const { data } = await mainInstance.post<AiApiKeyEntity>(
    getEndpoint("/ai-api-keys"),
    payload
  );
  return data;
};

export const updateAiApiKey = async (
  id: string,
  payload: UpdateAiApiKeyPayload
): Promise<AiApiKeyEntity> => {
  const { data } = await mainInstance.put<AiApiKeyEntity>(
    getEndpoint(`/ai-api-keys/${id}`),
    payload
  );
  return data;
};

export const deleteAiApiKey = async (id: string): Promise<void> => {
  await mainInstance.delete(getEndpoint(`/ai-api-keys/${id}`));
};
