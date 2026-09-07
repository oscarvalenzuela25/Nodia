import { mainInstance } from "../../../../../config/axiosInstance";
import type {
  ModuleEntity,
  GetModulesParams,
  PaginatedResponse,
  CreateModulePayload,
  UpdateModulePayload,
} from "../types";

const getEndpoint = (path: string) => {
  const hasV1 = mainInstance.defaults.baseURL?.includes("/api/v1");
  return hasV1 ? path : `/api/v1${path}`;
};

export const getModules = async (
  params?: GetModulesParams
): Promise<PaginatedResponse<ModuleEntity>> => {
  const { data } = await mainInstance.get<PaginatedResponse<ModuleEntity>>(
    getEndpoint("/modules"),
    { params }
  );
  return data;
};

export const createModule = async (
  payload: CreateModulePayload
): Promise<ModuleEntity> => {
  const { data } = await mainInstance.post<ModuleEntity>(
    getEndpoint("/module"),
    payload
  );
  return data;
};

export const updateModule = async (
  moduleId: string,
  payload: UpdateModulePayload
): Promise<ModuleEntity> => {
  const { data } = await mainInstance.put<ModuleEntity>(
    getEndpoint(`/module/${moduleId}`),
    payload
  );
  return data;
};
