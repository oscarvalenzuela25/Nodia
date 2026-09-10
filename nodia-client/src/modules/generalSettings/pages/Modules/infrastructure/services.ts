import { mainInstance } from "../../../../../config/axiosInstance";
import type {
  ModuleEntity,
  GetModulesParams,
  PaginatedResponse,
  CreateModulePayload,
  UpdateModulePayload,
  ModuleGroupEntity,
  GetModuleGroupsParams,
  CreateModuleGroupPayload,
  UpdateModuleGroupPayload,
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

export const getModuleGroups = async (
  params?: GetModuleGroupsParams
): Promise<PaginatedResponse<ModuleGroupEntity>> => {
  const { data } = await mainInstance.get<PaginatedResponse<ModuleGroupEntity>>(
    getEndpoint("/module-groups"),
    { params }
  );
  return data;
};

export const createModuleGroup = async (
  payload: CreateModuleGroupPayload
): Promise<ModuleGroupEntity> => {
  const { data } = await mainInstance.post<ModuleGroupEntity>(
    getEndpoint("/module-group"),
    payload
  );
  return data;
};

export const updateModuleGroup = async (
  groupId: string,
  payload: UpdateModuleGroupPayload
): Promise<ModuleGroupEntity> => {
  const { data } = await mainInstance.put<ModuleGroupEntity>(
    getEndpoint(`/module-group/${groupId}`),
    payload
  );
  return data;
};
