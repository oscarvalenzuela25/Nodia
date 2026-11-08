import { mainInstance } from "../../../../../config/api";
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
  MoveOrderCommand,
  MoveModuleOrderCommand,
  OrderMoveResult,
} from "../types";
import { groupMoveCommandSchema, moduleMoveCommandSchema, parseOrderMoveResult, validateOrderId, validateOrderingPage } from "./orderSchemas";

const getEndpoint = (path: string) => {
  const hasV1 = mainInstance.defaults.baseURL?.includes("/api/v1");
  return hasV1 ? path : `/api/v1${path}`;
};

function canonicalPaginationParams<T extends { size?: number; limit?: number }>(params?: T) {
  if (!params) return undefined;
  const { size, ...rest } = params;
  return size === undefined ? rest : { ...rest, limit: params.limit ?? size };
}

export const getModules = async (
  params?: GetModulesParams,
): Promise<PaginatedResponse<ModuleEntity>> => {
  const { data } = await mainInstance.get<PaginatedResponse<ModuleEntity>>(
    getEndpoint("/modules"),
    { params: canonicalPaginationParams(params) },
  );
  return params?.ordering ? validateOrderingPage(data, "module", params.includes !== false) : data;
};

export const createModule = async (
  payload: CreateModulePayload,
): Promise<ModuleEntity> => {
  const { data } = await mainInstance.post<ModuleEntity>(
    getEndpoint("/module"),
    payload,
  );
  return data;
};

export const updateModule = async (
  moduleId: string,
  payload: UpdateModulePayload,
): Promise<ModuleEntity> => {
  const { data } = await mainInstance.put<ModuleEntity>(
    getEndpoint(`/module/${moduleId}`),
    payload,
  );
  return data;
};

export const getModuleGroups = async (
  params?: GetModuleGroupsParams,
): Promise<PaginatedResponse<ModuleGroupEntity>> => {
  const { data } = await mainInstance.get<PaginatedResponse<ModuleGroupEntity>>(
    getEndpoint("/module-groups"),
    { params: canonicalPaginationParams(params) },
  );
  return params?.ordering ? validateOrderingPage(data, "group") : data;
};

export const createModuleGroup = async (
  payload: CreateModuleGroupPayload,
): Promise<ModuleGroupEntity> => {
  const { data } = await mainInstance.post<ModuleGroupEntity>(
    getEndpoint("/module-group"),
    payload,
  );
  return data;
};

export const updateModuleGroup = async (
  groupId: string,
  payload: UpdateModuleGroupPayload,
): Promise<ModuleGroupEntity> => {
  const { data } = await mainInstance.put<ModuleGroupEntity>(
    getEndpoint(`/module-group/${groupId}`),
    payload,
  );
  return data;
};

export const deleteModule = async (moduleId: string): Promise<void> => {
  await mainInstance.delete(getEndpoint(`/module/${moduleId}`));
};

export const deleteModuleGroup = async (groupId: string): Promise<void> => {
  await mainInstance.delete(getEndpoint(`/module-group/${groupId}`));
};

export const moveModuleOrder = async (id: string, command: MoveModuleOrderCommand): Promise<OrderMoveResult> => {
  validateOrderId(id);
  const body = moduleMoveCommandSchema.parse(command);
  const { data } = await mainInstance.patch<unknown>(getEndpoint(`/module/${id}/order`), body);
  return parseOrderMoveResult(data, "module", id, body);
};

export const moveModuleGroupOrder = async (id: string, command: MoveOrderCommand): Promise<OrderMoveResult> => {
  validateOrderId(id);
  const body = groupMoveCommandSchema.parse(command);
  const { data } = await mainInstance.patch<unknown>(getEndpoint(`/module-group/${id}/order`), body);
  return parseOrderMoveResult(data, "group", id, body);
};
