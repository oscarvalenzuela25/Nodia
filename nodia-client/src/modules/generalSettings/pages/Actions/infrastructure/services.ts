import { mainInstance } from "../../../../../config/api";
import type {
  Action,
  CreateActionPayload,
  GetActionsParams,
  PaginatedResponse,
  UpdateActionPayload,
  BusinessAction,
  CreateBusinessActionPayload,
  UpdateBusinessActionPayload,
} from "../types";

const getEndpoint = (path: string) => {
  const hasV1 = mainInstance.defaults.baseURL?.includes("/api/v1");
  return hasV1 ? path : `/api/v1${path}`;
};

export const getActions = async (
  params?: GetActionsParams
): Promise<PaginatedResponse<Action>> => {
  const { data } = await mainInstance.get<PaginatedResponse<Action>>(
    getEndpoint("/action"),
    { params }
  );
  return data;
};

export const createAction = async (
  payload: CreateActionPayload
): Promise<Action> => {
  const { data } = await mainInstance.post<Action>(
    getEndpoint("/action"),
    payload
  );
  return data;
};

export const updateAction = async (
  actionId: string,
  payload: UpdateActionPayload
): Promise<Action> => {
  const { data } = await mainInstance.put<Action>(
    getEndpoint(`/action/${actionId}`),
    payload
  );
  return data;
};

export const getBusinessActions = async (
  params?: GetActionsParams
): Promise<PaginatedResponse<BusinessAction>> => {
  const { data } = await mainInstance.get<PaginatedResponse<BusinessAction>>(
    getEndpoint("/business-action"),
    { params }
  );
  return data;
};

export const createBusinessAction = async (
  payload: CreateBusinessActionPayload
): Promise<BusinessAction> => {
  const { data } = await mainInstance.post<BusinessAction>(
    getEndpoint("/business-action"),
    payload
  );
  return data;
};

export const updateBusinessAction = async (
  actionId: string,
  payload: UpdateBusinessActionPayload
): Promise<BusinessAction> => {
  const { data } = await mainInstance.put<BusinessAction>(
    getEndpoint(`/business-action/${actionId}`),
    payload
  );
  return data;
};

export const deleteBusinessAction = async (
  actionId: string
): Promise<{ message: string }> => {
  const { data } = await mainInstance.delete<{ message: string }>(
    getEndpoint(`/business-action/${actionId}`)
  );
  return data;
};
